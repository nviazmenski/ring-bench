"use strict";
const REFERENCE_KEY="ringbench.references.v2";
const SPECIMEN_KEY="ringbench.specimens.v1";
const VERIFICATION_METHODS=["Independent instrument test","Professional authentication","Assay / documented composition","Other independent evidence"];
function validSpecimen(r){
  return validReference(r)&&r.collectionVersion===1&&typeof r.specimenId==="string"&&r.specimenId.trim().length>0&&r.specimenId.length<=100&&
    VERIFICATION_METHODS.includes(r.verificationMethod)&&r.strikes.every(s=>typeof s.when==="string"&&Number.isFinite(Date.parse(s.when)))&&
    r.settings.mass>0&&Number.isFinite(r.settings.mass)&&r.settings.diameter>0&&Number.isFinite(r.settings.diameter);
}
function specimenKey(r){return r.settings.coin+"|"+r.settings.alloy+"|"+r.specimenId.trim().toLowerCase();}
function mergeSpecimens(existing,incoming){
  const out={...existing};
  for(const r of incoming){
    if(!validSpecimen(r))continue;
    const key=specimenKey(r),duplicate=Object.entries(out).find(([k,old])=>k!==key&&old.strikes.some(s=>r.strikes.some(t=>s.when===t.when)));
    if(!duplicate)out[key]=r;
  }
  return out;
}
function specimenStats(collection,coin,alloy){
  const samples=Object.values(collection).filter(r=>validSpecimen(r)&&r.settings.coin===coin&&r.settings.alloy===alloy),fs=samples.map(r=>r.f0).filter(Number.isFinite);
  return {count:samples.length,samples,fingerprintCount:samples.filter(r=>r.fingerprint?.tracks?.length).length,median:fs.length?median(fs):null,min:fs.length?Math.min(...fs):null,max:fs.length?Math.max(...fs):null};
}
function validReference(r){
  const v3=r?.format==="ringbench-reference"&&r.version===3;
  if(!r||!((r.format==="ringbench-reference"&&(r.version===2||r.version===3))||(r.format==="ringbench-lite-reference"&&r.version===1))||r.trusted!==true||
    typeof r.note!=="string"||!r.note.trim()||r.note.length>500||!r.settings||
    !flat.some(c=>c.n===r.settings.coin)||!Object.hasOwn(ALLOYS,r.settings.alloy)||
    !Array.isArray(r.strikes)||r.strikes.length<2||r.strikes.length>10)return false;
  for(const s of r.strikes){
    if(!s||!Number.isFinite(s.f0)||s.f0<220||s.f0>22000||s.offwindow!==false||!Array.isArray(s.peaks)||s.peaks.length>40)return false;
    if(s.peaks.some(p=>!p||!Number.isFinite(p.f)||p.f<220||p.f>22000))return false;
  }
  if(v3&&r.pitchRole==="modal-fingerprint"){
    const tracks=r.fingerprint?.tracks;
    return (r.f0===null||Number.isFinite(r.f0))&&r.fingerprint?.version===1&&r.fingerprint.taps===r.strikes.length&&Array.isArray(tracks)&&tracks.length>0&&tracks.every(t=>Array.isArray(t.frequencies)&&t.frequencies.length===r.strikes.length&&t.frequencies.every(Number.isFinite)&&Number.isFinite(t.f)&&Number.isFinite(t.spread)&&t.spread<=RULES.repeatability);
  }
  const fs=r.strikes.map(s=>s.f0),mid=median(fs);
  return Number.isFinite(r.f0)&&Math.abs(r.f0-mid)<.001&&(Math.max(...fs)-Math.min(...fs))/mid<=RULES.repeatability;
}
function referenceState(ref,settings){
  return {usable:validReference(ref)&&ref.settings.coin===settings.coin&&ref.settings.alloy===settings.alloy};
}
// Relabel saved data whose catalogue preset was corrected; everything else is returned as-is.
function migrateSaved(r){
  const alloy=r?.settings&&ALLOY_SUCCESSORS[r.settings.coin+"|"+r.settings.alloy];
  return alloy?{...r,settings:{...r.settings,alloy},migratedFrom:{coin:r.settings.coin,alloy:r.settings.alloy}}:r;
}
function referenceFromReading(r,note){
  const fingerprint=r.fingerprint?{version:1,taps:r.fingerprint.taps,tracks:r.fingerprint.tracks.map(t=>({f:t.f,frequencies:t.frequencies,spread:t.spread,snrDb:t.snrDb,relativeDb:t.relativeDb,relativeRangeDb:t.relativeRangeDb,persistenceDropDb:t.persistenceDropDb})),families:r.fingerprint.families.map(f=>({centre:f.centre,frequencies:f.frequencies,split:f.split,kind:f.kind,harmonicOf:f.harmonicOf??null,harmonicOrder:f.harmonicOrder??null,harmonicError:f.harmonicError??null})),ratios:r.fingerprint.ratios.map(x=>({frequencies:x.frequencies,observed:x.observed,joint:!!x.joint,bestModelRatio:x.best?.modelRatio??null,bestRatioError:x.best?.ratioError??null,bestScale:x.best?.scale??null})),decay:r.fingerprint.decay}:null;
  return {format:"ringbench-reference",version:3,trusted:true,note,f0:r.f0,pitchRole:r.pitchRole||"legacy-pitch",when:new Date().toISOString(),settings:r.settings,fingerprint,
    source:r.source,strikes:r.strikes.map(s=>({f0:s.f0,offwindow:s.offwindow,peaks:s.peaks.map(p=>({f:p.f,snrDb:p.snrDb,persistenceDropDb:p.persistenceDropDb})),when:s.when}))};
}
// Old full-app references require explicit import and renewed provenance confirmation.
function importReferences(data){
  const candidates=Array.isArray(data)?data:validReference(data)?[data]:data?.references?Object.values(data.references):data?.settings&&data?.strikes?[data]:Object.values(data||{});
  return candidates.map(migrateSaved).map(raw=>{
    if(validReference(raw))return raw;
    if(raw?.version===2&&raw.trusted&&raw.settings&&raw.strikes&&raw.note){
      const converted={...raw,format:"ringbench-reference",version:2,strikes:raw.strikes.map(s=>({...s,offwindow:s.offwindow??false}))};
      if(validReference(converted))return converted;
    }
    return null;
  }).filter(Boolean);
}
