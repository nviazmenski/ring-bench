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
function referenceRatios(ref){
  const first=ref.strikes[0],used=ref.strikes.map(()=>new Set()),out=[];
  for(const p of first.peaks.filter(p=>p.f>first.f0*1.08).sort((a,b)=>a.f-b.f)){
    const ratio=p.f/first.f0,picks=ref.strikes.slice(1).map((s,k)=>s.peaks.map((q,i)=>({i,ratio:q.f/s.f0,error:Math.abs(q.f/s.f0/ratio-1)}))
      .filter(q=>!used[k+1].has(q.i)&&q.ratio>1.08&&q.error<=RULES.repeatability).sort((a,b)=>a.error-b.error)[0]);
    if(picks.every(Boolean)){picks.forEach((p,k)=>used[k+1].add(p.i));out.push(median([ratio,...picks.map(p=>p.ratio)]));}
  }
  return out;
}
function empiricalMatches(strike,ratios){
  const used=new Set(),matches=[];
  ratios.forEach((ratio,index)=>{
    const best=strike.peaks.map((p,i)=>({i,f:p.f,error:Math.abs(p.f/strike.f0/ratio-1)}))
      .filter(p=>!used.has(p.i)&&p.f>strike.f0*1.08&&p.error<=RULES.referencePitch).sort((a,b)=>a.error-b.error)[0];
    if(best){used.add(best.i);matches.push({index,f:best.f,error:best.error});}
  });return matches;
}
function evaluateReading(r,c,ref){
  const reference=referenceState(ref,r.settings),expected=reference.usable?ref.f0:P(c).f[0];
  const dev=r.f0/expected-1,band=reference.usable?RULES.referencePitch:null;
  const repeatable=r.strikes.length>=2&&r.spread<=RULES.repeatability,uncertain=r.strikes.some(s=>s.offwindow);
  let extra=r.commonModes.length;
  if(reference.usable){
    const matches=r.strikes.map(s=>empiricalMatches(s,referenceRatios(ref)));
    extra=matches[0].filter(m=>{const fs=matches.map(ms=>ms.find(x=>x.index===m.index)?.f);return fs.every(Number.isFinite)&&(Math.max(...fs)-Math.min(...fs))/median(fs)<=RULES.repeatability;}).length;
  }
  const selfReference=reference.usable&&r.strikes.some(s=>s.when&&ref.strikes.some(t=>t.when===s.when));
  const pitchOK=reference.usable?Math.abs(dev)<=band:null;
  const state=selfReference?"reference":uncertain?"uncertain":r.strikes.length<2?"preliminary":!repeatable?"unstable":!reference.usable?"theory":pitchOK?"consistent":"mismatch";
  return {reference,expected,dev,band,repeatable,uncertain,extra,selfReference,pitchOK,state};
}
function referenceFromReading(r,note){
  const fingerprint=r.fingerprint?{version:1,taps:r.fingerprint.taps,tracks:r.fingerprint.tracks.map(t=>({f:t.f,frequencies:t.frequencies,spread:t.spread,snrDb:t.snrDb,relativeDb:t.relativeDb,relativeRangeDb:t.relativeRangeDb,persistenceDropDb:t.persistenceDropDb})),families:r.fingerprint.families.map(f=>({centre:f.centre,frequencies:f.frequencies,split:f.split,kind:f.kind,harmonicOf:f.harmonicOf??null,harmonicOrder:f.harmonicOrder??null,harmonicError:f.harmonicError??null})),ratios:r.fingerprint.ratios.map(x=>({frequencies:x.frequencies,observed:x.observed,joint:!!x.joint,bestModelRatio:x.best?.modelRatio??null,bestRatioError:x.best?.ratioError??null,bestScale:x.best?.scale??null})),decay:r.fingerprint.decay}:null;
  return {format:"ringbench-reference",version:3,trusted:true,note,f0:r.f0,pitchRole:r.pitchRole||"legacy-pitch",when:new Date().toISOString(),settings:r.settings,fingerprint,
    source:r.source,strikes:r.strikes.map(s=>({f0:s.f0,offwindow:s.offwindow,peaks:s.peaks.map(p=>({f:p.f,snrDb:p.snrDb,persistenceDropDb:p.persistenceDropDb})),when:s.when}))};
}
// Old full-app references require explicit import and renewed provenance confirmation.
function importReferences(data){
  const candidates=Array.isArray(data)?data:validReference(data)?[data]:data?.references?Object.values(data.references):data?.settings&&data?.strikes?[data]:Object.values(data||{});
  return candidates.map(raw=>{
    if(validReference(raw))return raw;
    if(raw?.version===2&&raw.trusted&&raw.settings&&raw.strikes&&raw.note){
      const converted={...raw,format:"ringbench-reference",version:2,strikes:raw.strikes.map(s=>({...s,offwindow:s.offwindow??false}))};
      if(validReference(converted))return converted;
    }
    return null;
  }).filter(Boolean);
}
