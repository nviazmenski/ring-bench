"use strict";
// Experimental Kirchhoff–Love Rayleigh–Ritz model; derivation and limits in MODEL.md.
const GEOMETRY_MODEL="stepped-rim-ritz-v1";
// Joint-fit tolerance: 3% for the thin-plate model, whose own (3,0)/(2,0) bias is about 2% at h/a ≈ 0.12;
// 1% for the 3D solid model (genuine coins fit within 0.3%). MODEL.md, "Two-mode rule".
const FAMILY_DEFAULTS=Object.freeze({widthMax:.16,ratioMax:1.75,ePct:5,rhoPct:1,massPct:1,diaPct:.5,edgePct:2,fitPct:3,solidFitPct:1});
// Pro's joint fit needs the lowest repeatable resonance and one more distinct mode. A third mode is used when
// recorded, but the (4,0) of most coins lies near or above a phone's usable bandwidth.
const PRO_MIN_MODES=2;
const rimEigenCache=new Map(),familyCache=new Map(),fitCache=new WeakMap();
// Cyclic Jacobi: sweep every off-diagonal pair instead of searching for the largest.
// Same rotations and stopping rule as the earlier largest-pivot version, about four
// times faster; eigenvalues agree to better than 1e-12 on the solver's matrices.
function symmetricEigenvalues(input){
  const a=input.map(r=>r.slice()),n=a.length;
  for(let sweep=0;sweep<100;sweep++){
    let big=0,diag=0;
    for(let i=0;i<n;i++){diag=Math.max(diag,Math.abs(a[i][i]));for(let j=i+1;j<n;j++)big=Math.max(big,Math.abs(a[i][j]));}
    if(big<1e-13*Math.max(1,diag))return a.map((r,i)=>r[i]).sort((a,b)=>a-b);
    for(let p=0;p<n-1;p++)for(let q=p+1;q<n;q++){
      if(a[p][q]===0)continue;
      const theta=.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]),c=Math.cos(theta),s=Math.sin(theta),pp=a[p][p],qq=a[q][q],pq=a[p][q];
      for(let k=0;k<n;k++)if(k!==p&&k!==q){const x=a[k][p],y=a[k][q];a[k][p]=a[p][k]=c*x-s*y;a[k][q]=a[q][k]=s*x+c*y;}
      a[p][p]=c*c*pp-2*s*c*pq+s*s*qq;a[q][q]=s*s*pp+2*s*c*pq+c*c*qq;a[p][q]=a[q][p]=0;
    }
  }
  throw Error("Geometry eigensolver did not converge.");
}
function generalizedEigenvalues(K,M){
  const n=M.length,L=Array.from({length:n},()=>Array(n).fill(0));
  for(let i=0;i<n;i++)for(let j=0;j<=i;j++){
    let v=M[i][j];for(let k=0;k<j;k++)v-=L[i][k]*L[j][k];
    if(i===j){if(!(v>0))throw Error("Geometry basis lost numerical precision.");L[i][j]=Math.sqrt(v);}else L[i][j]=v/L[j][j];
  }
  const inv=Array.from({length:n},()=>Array(n).fill(0));
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){let v=i===j?1:0;for(let k=0;k<i;k++)v-=L[i][k]*inv[k][j];inv[i][j]=v/L[i][i];}
  const A=Array.from({length:n},()=>Array(n).fill(0));
  for(let i=0;i<n;i++)for(let j=0;j<n;j++)for(let k=0;k<n;k++)for(let l=0;l<n;l++)A[i][j]+=inv[i][k]*K[k][l]*inv[j][l];
  for(let i=0;i<n;i++)for(let j=0;j<i;j++)A[i][j]=A[j][i]=(A[i][j]+A[j][i])/2;
  return symmetricEigenvalues(A);
}
function rimEigenvalues(nu,width,ratio,terms=6){
  const key=JSON.stringify([nu,width,ratio,terms]);if(rimEigenCache.has(key))return rimEigenCache.get(key);
  const b=1-width,hc=1/(b*b+ratio*(1-b*b)),hr=hc*ratio;
  const integral=(power,cube=false)=>{if(power<=-1)throw Error("Invalid radial integral.");const e=power+1;return ((cube?hc**3:hc)*b**e+(cube?hr**3:hr)*(1-b**e))/e;};
  const eigen={};
  for(const n of [0,1,2,3,4]){
    const ps=Array.from({length:terms},(_,k)=>n+2*(k+(n<2?1:0))),rigid=n;
    const K=ps.map(p=>ps.map(q=>{
      const A=p*(p-1),B=p-n*n,C=n*(p-1),D=q*(q-1),F=q-n*n,G=n*(q-1);
      return (A*D+B*F+nu*(A*F+B*D)+2*(1-nu)*C*G)*integral(p+q-3,true);
    }));
    const M=ps.map(p=>ps.map(q=>integral(p+q+1)-(n<2?integral(p+rigid+1)*integral(q+rigid+1)/integral(2*rigid+1):0)));
    eigen[n]=generalizedEigenvalues(K,M).map(v=>Math.sqrt(v));
  }
  const result=[eigen[2][0],eigen[0][0],eigen[3][0],eigen[1][0],eigen[4][0],eigen[2][1]];
  if(result.some(v=>!Number.isFinite(v)||v<=0))throw Error("Invalid geometry frequencies.");
  if(rimEigenCache.size>20000)rimEigenCache.clear();rimEigenCache.set(key,result);return result;
}
function familyOptions(c){return {...FAMILY_DEFAULTS,...c.family};}
function fitTolerance(family){return (family.source==="solid"?family.options.solidFitPct:family.options.fitPct)/100;}
// ───────── experimental 3D solid family (Pro) ─────────
// Plate-equivalent λ² from pro/solid-tables.js (Pro only), interpolated in volume-equivalent thickness/radius,
// rim/volume-equivalent thickness and ν by solidLookup in pro/solid.js. Each table sample is one admissible
// cross-section from the priors in MODEL.md. The Morgan has its own cross-section family; every other coin uses the
// generic one. The rim thickness is the entered caliper reading ±SOLID_RIM_TOLERANCE_MM, or a prior ratio to the
// hypothesis's own volume-equivalent thickness, so a fake of the same weight is judged by the same rule.
const SOLID_RIM_PRIOR={"morgan-solid":[1.034,1.254],"generic-solid":[1.03,1.45]};
const SOLID_RIM_TOLERANCE_MM=.03;
// Mesh and quantisation error; each table adds its own measured interpolation error on top.
const SOLID_MIN_NUMERICAL_ERROR=2e-4;
// A centre support (Pocket Pinger, fingertip, tongs) touches the axisymmetric (0,s) and tilting (1,s) modes where
// they move, damping and stiffening them; the n≥2 modes have zero displacement and slope at the centre.
const SOLID_SUPPORT_AFFECTED=[1,3],SOLID_SUPPORT_SHIFT=.15;
const SOLID_FAMILY_NAMES={"morgan-solid":"Morgan","generic-solid":"generic coin"};
function solidFamily(c,o,h,scale,lowScale,highScale){
  const table=typeof solidTable==="function"?solidTable(c.plateModel):null,a=c.dia/2,candidates=[];
  const base={model:table?.model||c.plateModel,solver:table?.solver,crossSection:c.plateModel,crossSectionName:SOLID_FAMILY_NAMES[c.plateModel]||c.plateModel,options:o,candidates,h,lowScale,highScale,source:"solid",edge:o.edgePct/100,
    support:c.support==="other"?"other":"centre"};
  base.scored=[0,1,2,3,4,5].map(i=>base.support!=="centre"||!SOLID_SUPPORT_AFFECTED.includes(i));
  if(!table)return {...base,low:NaN,high:NaN,valid:false,reason:"The solid model tables are not loaded."};
  const hbar=h/a,measured=c.rimThickness>0,numericalError=Math.max(SOLID_MIN_NUMERICAL_ERROR,table.interpolationError||0);
  const [lo,hi]=measured?[c.rimThickness-SOLID_RIM_TOLERANCE_MM,c.rimThickness+SOLID_RIM_TOLERANCE_MM]:SOLID_RIM_PRIOR[c.plateModel].map(r=>r*h);
  const rims=[...new Set([lo,...table.grid.rim.map(r=>r*h).filter(t=>t>lo&&t<hi),measured?c.rimThickness:hi,hi])].sort((x,y)=>x-y);
  table.samples.forEach((x,si)=>{
    const params=Object.fromEntries(table.keys.map((k,i)=>[k,x[i]])),basinMm=table.basin==="mm"?params.s:params.sRel*h;
    for(const rim of rims){
      const lam=solidLookup(table,si,hbar,rim/h,c.nu);
      if(lam)candidates.push({sample:si,params:{...params,basinMm},rim,width:params.wR,ratio:rim/h,f:lam.map(v=>v*scale),errors:lam.map(()=>numericalError),numericalError});
    }
  });
  const low=candidates.length?Math.min(...candidates.map(g=>g.f[0]*(1-2*g.numericalError)*lowScale)):NaN;
  const high=candidates.length?Math.max(...candidates.map(g=>g.f[0]*(1+2*g.numericalError)*highScale)):NaN;
  const G=table.grid,thick=hbar>G.hbar.at(-1),inside=hbar>=G.hbar[0]&&!thick&&c.nu>=G.nu[0]&&c.nu<=G.nu.at(-1);
  const reason=candidates.length?"":thick?"At this weight and diameter the coin would be thicker than the solid model's tables (volume-equivalent thickness/radius above "+G.hbar.at(-1)+").":!inside?"The entered mass, diameter and Poisson ratio are outside the solid model's tables (thickness/radius "+G.hbar[0]+"–"+G.hbar.at(-1)+", ν "+G.nu[0]+"–"+G.nu.at(-1)+").":"No sampled cross-section fits this mass with a rim of "+lo.toFixed(2)+"–"+hi.toFixed(2)+" mm.";
  return {...base,low,high,rims:[lo,hi],rimMeasured:measured,numericalError,valid:candidates.length>0&&low>0,reason,beyondThickness:thick};
}
function geometryFamily(c){
  const o=familyOptions(c),key=JSON.stringify([c.mass,c.dia,c.rho,c.E,c.nu,c.rimThickness||0,o,c.plateModel||"plate",c.support||"centre"]);
  if(familyCache.has(key))return familyCache.get(key);
  const h=c.mass/(c.rho*Math.PI*(c.dia/20)**2)*10,a=c.dia/2000;
  const scale=h/1000/(2*Math.PI*a*a)*Math.sqrt(c.E*1e9/(12*(1-c.nu*c.nu)*c.rho*1000));
  if(c.plateModel&&c.plateModel!=="plate"){
    const lowScale=(1-o.massPct/100)*Math.sqrt(1-o.ePct/100)/((1+o.diaPct/100)**4*(1+o.rhoPct/100)**1.5);
    const highScale=(1+o.massPct/100)*Math.sqrt(1+o.ePct/100)/((1-o.diaPct/100)**4*(1-o.rhoPct/100)**1.5);
    const result=solidFamily(c,o,h,scale,lowScale,highScale);
    if(familyCache.size>150)familyCache.clear();familyCache.set(key,result);return result;
  }
  const candidates=[],widths=[.03,.06,.09,.12,.16].filter(w=>w<o.widthMax).concat(o.widthMax);
  for(const width of widths)for(let step=0;step<=4;step++){
    let ratio=1+(o.ratioMax-1)*step/4;
    if(!c.rimThickness&&step===0&&candidates.length)continue;
    const b=1-width,area=1-b*b;
    if(c.rimThickness){
      if(step>0)continue;
      const centre=(h-area*c.rimThickness)/(b*b);ratio=c.rimThickness/centre;
      if(!(centre>0)||ratio<1||ratio>o.ratioMax)continue;
    }
    const centre=h/(b*b+ratio*area),rim=centre*ratio;
    // Thin-plate applicability guard: local h/a above 0.25 is outside this model.
    if(rim/(c.dia/2)>.25)continue;
    const coarse=rimEigenvalues(c.nu,width,ratio,6),fine=rimEigenvalues(c.nu,width,ratio,8);
    const errors=fine.map((v,i)=>Math.abs(coarse[i]/v-1));
    candidates.push({width,ratio,centre,rim,f:fine.map(v=>v*scale),errors,numericalError:Math.max(...errors)});
  }
  const lowScale=(1-o.massPct/100)*Math.sqrt(1-o.ePct/100)/((1+o.diaPct/100)**4*(1+o.rhoPct/100)**1.5);
  const highScale=(1+o.massPct/100)*Math.sqrt(1+o.ePct/100)/((1-o.diaPct/100)**4*(1-o.rhoPct/100)**1.5);
  const low=candidates.length?Math.min(...candidates.map(g=>Math.min(...g.f)*(1-2*g.numericalError)*lowScale)):NaN;
  const high=candidates.length?Math.max(...candidates.map(g=>Math.min(...g.f)*(1+2*g.numericalError)*highScale)):NaN;
  const result={model:GEOMETRY_MODEL,options:o,candidates,h,low,high,lowScale,highScale,source:"model",valid:candidates.length>0&&low>0,edge:o.edgePct/100,scored:[true,true,true,true,true,true]};
  if(familyCache.size>150)familyCache.clear();familyCache.set(key,result);return result;
}
// The solid model predicts the axisymmetric frequency; a split pair (relief, rolling texture) straddles it.
// To first order the split moves ω² symmetrically, so each family is scored at its RMS frequency.
function familyObservations(reading,c,harmonic=false){
  return modalFamilies(reading,c).filter(f=>(f.harmonicOf!==undefined)===harmonic).map(f=>({f:Math.sqrt(f.frequencies.reduce((s,x)=>s+x*x,0)/f.frequencies.length),familyIndex:f.index,
    ...(harmonic?{parentIndex:f.harmonicOf,harmonicCandidate:true}:{})}));
}
function bandPosition(f,band){
  if(!band?.valid||!Number.isFinite(f)||f<=0)return "inconclusive";
  const e=band.edge;
  if(f<band.low*(1-e)||f>band.high*(1+e))return "anomalous";
  if(f<=band.low*(1+e)||f>=band.high*(1-e))return "inconclusive";
  return "compatible";
}
function recurringPeaks(reading){
  if(!reading?.strikes?.length)return [];
  const strikes=reading.strikes,first=strikes[0],used=strikes.map(()=>new Set()),out=[];
  for(const p of first.peaks.slice().sort((a,b)=>a.f-b.f)){
    // The 1% cap is not permission to switch between resolved neighbors.
    // Bound each match by 45% of the nearest within-tap separation at both ends.
    const referenceGap=Math.min(Infinity,...first.peaks.filter(q=>q!==p).map(q=>Math.abs(q.f-p.f)));
    const picks=strikes.slice(1).map((s,k)=>s.peaks.map((q,i)=>{
      const gap=Math.min(Infinity,...s.peaks.filter(v=>v!==q).map(v=>Math.abs(v.f-q.f)));
      return {i,f:q.f,error:Math.abs(q.f-p.f),limit:Math.min(p.f*.01,referenceGap*.45,gap*.45)};
    }).filter(q=>!used[k+1].has(q.i)&&q.error<=q.limit).sort((a,b)=>a.error-b.error)[0]);
    if(!picks.every(Boolean))continue;
    const observations=[{tap:0,...p},...picks.map((pick,k)=>({tap:k+1,...strikes[k+1].peaks[pick.i]}))].map(o=>({...o,relativeDb:20*Math.log10(((o.mag||0)+1e-30)/(Math.max(...strikes[o.tap].peaks.map(p=>p.mag||0))+1e-30))})),fs=observations.map(p=>p.f),mid=median(fs),spread=(Math.max(...fs)-Math.min(...fs))/mid;if(spread>.01)continue;
    picks.forEach((p,k)=>used[k+1].add(p.i));out.push({f:mid,frequencies:fs,spread,support:observations.length,snrDb:median(observations.map(p=>p.snrDb||0)),relativeDb:median(observations.map(p=>p.relativeDb)),relativeRangeDb:Math.max(...observations.map(p=>p.relativeDb))-Math.min(...observations.map(p=>p.relativeDb)),persistenceDropDb:median(observations.map(p=>p.persistenceDropDb).filter(Number.isFinite)),observations});
  }
  return out;
}
const MODE_SPLIT_CLUSTER_PCT=.03;
// Solid model: the lowest recurring family groups tones up to 6% apart. Relief splits the (2,0) pair by up to
// about 4% on real coins (1-rouble pieces), and the next mode, (0,1), sits at least 1.6× higher, so no other mode
// can fall this close. Upper families keep 3%: (1,1) and (4,0) can lie within a few percent of each other. The rule
// depends on the reading and the model choice only, so the coin, its fakes and other alloys group tones alike and
// share family indices.
const SOLID_LOWEST_SPLIT_PCT=.06;
const MODE_ENVELOPE_GUARD_PCT=.01;
const HARMONIC_TOLERANCE_PCT=.008;
function modalFamilies(reading,c){
  const tracks=recurringPeaks(reading).slice().sort((a,b)=>a.f-b.f),families=[];
  const wide=!!c?.plateModel&&c.plateModel!=="plate";
  for(const track of tracks){
    const last=families.at(-1),centre=last?median(last.tracks.map(t=>t.f)):0;
    const splitPct=wide&&families.length===1?SOLID_LOWEST_SPLIT_PCT:MODE_SPLIT_CLUSTER_PCT;
    if(!last||track.f/centre-1>splitPct)families.push({tracks:[track]});else last.tracks.push(track);
  }
  const result=families.map((family,index)=>{
    const frequencies=family.tracks.map(t=>t.f),centre=median(frequencies),split=(Math.max(...frequencies)-Math.min(...frequencies))/centre;
    return {index,centre,frequencies,tracks:family.tracks,split,kind:family.tracks.length>1?"possible-split-family":"single-track"};
  });
  for(let i=1;i<result.length;i++){
    const matches=[];
    for(let j=0;j<i;j++){
      const ratio=result[i].centre/result[j].centre,order=Math.round(ratio),error=Math.abs(ratio/order-1);
      if(order>=2&&order<=5&&error<=HARMONIC_TOLERANCE_PCT)matches.push({parent:j,order,error});
    }
    matches.sort((a,b)=>a.error-b.error);
    if(matches.length)Object.assign(result[i],{harmonicOf:matches[0].parent,harmonicOrder:matches[0].order,harmonicError:matches[0].error});
  }
  return result;
}
function scoringFamilies(reading,c){return modalFamilies(reading,c).filter(f=>f.harmonicOf===undefined);}
function scoringTracks(reading,c){return scoringFamilies(reading,c).flatMap(f=>f.tracks.map(t=>({...t,familyIndex:f.index})));}
// A plate mode can sit near a whole-number multiple of a lower tone by coincidence;
// (1,1) is about 4.01x (2,0) on a flat silver plate. Such tones stay out of scoring,
// but the joint fit may use one above its parent when no fit exists without it.
function harmonicCandidateTracks(reading,c){return modalFamilies(reading,c).filter(f=>f.harmonicOf!==undefined).flatMap(f=>f.tracks.map(t=>({...t,familyIndex:f.index,parentIndex:f.harmonicOf,harmonicCandidate:true})));}
function inFamily(f,family){return !!family&&Number.isFinite(f)&&f>=Math.min(...family.frequencies)*(1-1e-9)&&f<=Math.max(...family.frequencies)*(1+1e-9);}
function plateRatioEvidence(reading,c){
  const family=geometryFamily(c),families=scoringFamilies(reading,c),pairs=[];
  if(!family.valid)return pairs;
  for(let a=0;a<families.length;a++)for(let b=a+1;b<families.length;b++){
    const observed=families[b].centre/families[a].centre,candidates=[];
    for(const g of family.candidates){
      const modes=g.f.map((f,mode)=>({f,mode})).filter(x=>family.scored[x.mode]&&x.f*family.lowScale<=reading.usableHz).sort((x,y)=>x.f-y.f);
      for(let i=0;i<modes.length;i++)for(let j=i+1;j<modes.length;j++){
        const ratio=modes[j].f/modes[i].f,ratioError=Math.abs(observed/ratio-1),scale=Math.sqrt(families[a].centre*families[b].centre/(modes[i].f*modes[j].f));
        const absoluteErrors=[Math.abs(families[a].centre/(modes[i].f*scale)-1),Math.abs(families[b].centre/(modes[j].f*scale)-1)],tol=fitTolerance(family)+2*g.numericalError;
        candidates.push({modes:[modes[i].mode,modes[j].mode],modelRatio:ratio,ratioError,scale,withinScale:scale>=family.lowScale&&scale<=family.highScale,joint:scale>=family.lowScale&&scale<=family.highScale&&ratioError<=tol&&Math.max(...absoluteErrors)<=tol,geometry:g});
      }
    }
    candidates.sort((x,y)=>Number(y.joint)-Number(x.joint)||x.ratioError-y.ratioError||Math.abs(Math.log(x.scale))-Math.abs(Math.log(y.scale)));
    pairs.push({families:[a,b],frequencies:[families[a].centre,families[b].centre],observed,best:candidates[0]||null,joint:candidates.find(x=>x.joint)||null});
  }
  return pairs;
}
function modeEnvelopes(c){
  const family=geometryFamily(c);
  if(!family.valid)return [];
  // Under a centre support the solid model's (0,s) and (1,s) envelopes extend upward: the support can stiffen them.
  return family.candidates[0].f.map((_,mode)=>({
    mode,
    low:Math.min(...family.candidates.map(g=>g.f[mode]*(1-2*g.numericalError)*family.lowScale)),
    high:Math.max(...family.candidates.map(g=>g.f[mode]*(1+2*g.numericalError)*family.highScale))*(family.scored[mode]?1:1+SOLID_SUPPORT_SHIFT),
    supportAffected:!family.scored[mode]
  }));
}
function modalEnvelopeEvidence(reading,c){
  const envelopes=modeEnvelopes(c),families=modalFamilies(reading,c);
  const assignments=families.map(family=>{
    const possible=envelopes.filter(e=>family.centre>=e.low*(1-MODE_ENVELOPE_GUARD_PCT)&&family.centre<=e.high*(1+MODE_ENVELOPE_GUARD_PCT));
    const nearest=envelopes.map(e=>({mode:e.mode,distance:family.centre<e.low?e.low/family.centre-1:family.centre>e.high?family.centre/e.high-1:0,envelope:e})).sort((a,b)=>a.distance-b.distance)[0]||null;
    return {family,possible,nearest,outside:family.harmonicOf===undefined&&possible.length===0,excludedAsHarmonic:family.harmonicOf!==undefined};
  });
  return {envelopes,assignments,outside:assignments.filter(a=>a.outside),guard:MODE_ENVELOPE_GUARD_PCT};
}
function acousticFingerprint(reading,c){
  const taps=reading?.strikes?.length||0,tracks=recurringPeaks(reading),families=modalFamilies(reading,c),ratios=c?plateRatioEvidence(reading,c):[],envelope=c?modalEnvelopeEvidence(reading,c):null,decay=tracks.filter(t=>Number.isFinite(t.persistenceDropDb)).map(t=>({f:t.f,earlyLateDb:t.persistenceDropDb}));
  return {version:1,taps,tracks,families,ratios,envelope,decay,repeatable:taps>=2&&tracks.length>0&&tracks.every(t=>t.support===taps&&t.spread<=.01)};
}
function primaryResonanceEvidence(fingerprint){
  if(!fingerprint?.families?.length||!fingerprint.envelope)return {family:null,assignment:null,insideLowest:false,secondaryOutside:[]};
  // The field candidate is the lowest retained, non-harmonic family, chosen
  // before consulting the modeled band. The loudest line may be an upper mode.
  const family=fingerprint.families.find(f=>f.harmonicOf===undefined)||null;
  if(!family)return {family:null,assignment:null,insideLowest:false,secondaryOutside:[]};
  const assignment=fingerprint.envelope.assignments[family.index]||null;
  const insideLowest=!!assignment?.possible.some(e=>e.mode===0);
  const secondaryOutside=fingerprint.envelope.assignments.filter((a,i)=>i!==family.index&&a.outside);
  return {family,assignment,insideLowest,secondaryOutside};
}
// Enumerate monotone one-to-one mode assignments. One global scale represents
// the explicitly allowed material/dimension uncertainty; each ratio must fit too.
function fitGeometryFamily(reading,c){
  const cacheKey=JSON.stringify(c),cache=fitCache.get(reading)||new Map();if(cache.has(cacheKey))return cache.get(cacheKey);
  const family=geometryFamily(c),solid=family.source==="solid",results=[];
  const observed=(solid?familyObservations(reading,c):scoringTracks(reading,c)).filter(p=>p.f<=reading.usableHz),harmonics=(solid?familyObservations(reading,c,true):harmonicCandidateTracks(reading,c)).filter(p=>p.f<=reading.usableHz);
  if(observed.length<2||reading.strikes.length<2||!family.valid)return {family,observed,harmonicCount:harmonics.length,results,best:null,supported:[],identityFits:[],matchedModeCount:0,state:"insufficient"};
  const tolerance=fitTolerance(family);
  for(const g of family.candidates){
    const modes=g.f.map((f,i)=>({f,i})).filter(m=>family.scored[m.i]&&m.f*family.lowScale<=reading.usableHz).sort((a,b)=>a.f-b.f);
    // Try every recurring tone as the lowest observed member of a mode pattern.
    // Each path may therefore include frequencies below the loudest resonance.
    for(const anchor of observed){
    const upper=observed.filter(p=>p.f>anchor.f*1.08).slice(0,12).concat(harmonics.filter(p=>p.f>anchor.f*1.08)).sort((a,b)=>a.f-b.f);
    for(let root=0;root<modes.length;root++){
      const base=modes[root],pairs=[{measured:anchor.f,predicted:base.f,mode:base.i,familyIndex:anchor.familyIndex}],paths=[];
      function visit(pi,mi,current){
        paths.push(current);
        for(let p=pi;p<upper.length;p++)for(let m=mi;m<modes.length;m++){
          const u=upper[p];
          if(current.some(v=>v.familyIndex===u.familyIndex)||u.harmonicCandidate&&!current.some(v=>v.familyIndex===u.parentIndex))continue;
          const ratioError=Math.abs((u.f/anchor.f)/(modes[m].f/base.f)-1);
          if(ratioError<=tolerance+2*g.numericalError)visit(p+1,m+1,current.concat({measured:u.f,predicted:modes[m].f,mode:modes[m].i,familyIndex:u.familyIndex,harmonicCandidate:!!u.harmonicCandidate}));
        }
      }
      visit(0,root+1,pairs);
      for(const match of paths){
        if(match.length<2)continue;
        const unconstrained=Math.exp(match.reduce((s,p)=>s+Math.log(p.measured/p.predicted),0)/match.length);
        const scale=Math.max(family.lowScale,Math.min(family.highScale,unconstrained));
        const absErrors=match.map(p=>Math.abs(p.measured/(p.predicted*scale)-1));
        const ratioErrors=match.slice(1).map(p=>Math.abs((p.measured/anchor.f)/(p.predicted/base.f)-1));
        const residual=Math.sqrt(absErrors.reduce((s,v)=>s+v*v,0)/match.length);
        const supported=Math.max(...absErrors,...ratioErrors)<=tolerance+2*g.numericalError;
        results.push({geometry:g,matches:match,scale,freeScale:unconstrained,residual,ratioResidual:Math.max(...ratioErrors),supported,rootMode:base.i,fundamentalObserved:base.i===g.f.indexOf(Math.min(...g.f)),harmonicAssisted:match.some(p=>p.harmonicCandidate)});
      }
    }
    }
  }
  results.sort((a,b)=>Number(b.supported)-Number(a.supported)||b.matches.length-a.matches.length||a.residual-b.residual);
  // Fits that use a harmonic candidate count only when no fit reaching PRO_MIN_MODES exists without one, and a
  // harmonic candidate never counts toward that minimum: a tone and its own overtone cannot confirm each other.
  const independent=r=>r.matches.filter(m=>!m.harmonicCandidate).length;
  const strictFit=results.some(r=>!r.harmonicAssisted&&r.supported&&r.matches.length>=PRO_MIN_MODES);
  const kept=results.filter(r=>!r.harmonicAssisted||!strictFit&&r.supported);
  const best=kept[0]||null,supported=kept.filter(r=>r.supported&&independent(r)>=PRO_MIN_MODES);
  const identityFits=kept.filter(r=>r.supported),matchedModeCount=Math.max(0,...identityFits.map(r=>r.matches.length));
  const result={family,observed,harmonicCount:harmonics.length,results:kept.slice(0,30),identityFits,best,supported,matchedModeCount,harmonicAssisted:supported.length>0&&!strictFit,tolerance,state:supported.length?"compatible":observed.length>=PRO_MIN_MODES?"unresolved":"insufficient"};
  cache.set(cacheKey,result);fitCache.set(reading,cache);return result;
}

function estimateFundamental(r,c){
  const observed=scoringTracks(r,c).filter(p=>p.f<=r.usableHz),fit=fitGeometryFamily(r,c);
  const fits=fit.identityFits||[],maxCount=Math.max(0,...fits.map(f=>f.matches.length));
  // Use all surviving maximal-coverage interpretations, not just the best residual.
  const contenders=(fit.supported.length?fit.supported:fits).filter(f=>f.matches.length===maxCount);
  const roots=contenders.filter(f=>f.fundamentalObserved).map(f=>f.matches[0]),candidates=roots.map(m=>m.measured);
  let f0=null,ambiguous=false,basis="",reason="";
  if(contenders.length){
    const missing=contenders.some(f=>!f.fundamentalObserved),spread=candidates.some(f=>Math.abs(f/candidates[0]-1)>.01);
    // The thin-plate fit anchors on single tracks, so both tones of one split family can root a fit.
    // They are one mode identity, not competing fundamentals; the lower tone is taken as the lowest mode.
    const oneFamily=new Set(roots.map(m=>m.familyIndex)).size===1;
    ambiguous=missing||spread&&!oneFamily;
    if(!ambiguous&&candidates.length){f0=spread?Math.min(...candidates):median(candidates);basis="joint-pattern";reason="Lowest observed mode supported by the recurring peak pattern.";}
    else reason=missing?"The peak pattern permits an unobserved lower fundamental or competing mode identities.":"Several recurring peaks remain plausible fundamentals.";
  }else if(observed.length===1){f0=observed[0].f;basis="single-tone";reason="Only one credible tone; fundamental identity is provisional.";}
  else{ambiguous=true;reason=observed.length?"Recurring peaks do not establish a unique fundamental.":"No common tone was retained across the taps.";}
  // A split family scored at its centroid (solid model) is tracked per tap at that tap's centroid.
  const split=f0===null||fit.family.source!=="solid"?null:modalFamilies(r,c).find(f=>f.tracks.length>1&&inFamily(f0,f)&&!f.frequencies.some(x=>Math.abs(x/f0-1)<=1e-9));
  const taps=f0===null?[]:split?r.strikes.map((s,i)=>{const fs=split.tracks.map(t=>t.observations.find(o=>o.tap===i)?.f);return fs.every(Number.isFinite)?Math.sqrt(fs.reduce((a,x)=>a+x*x,0)/fs.length):undefined;})
    :r.strikes.map(s=>s.peaks.filter(p=>Math.abs(p.f/f0-1)<=.01).sort((a,b)=>Math.abs(a.f-f0)-Math.abs(b.f-f0))[0]?.f);
  const complete=taps.length===r.strikes.length&&taps.every(Number.isFinite);
  const spread=complete?(Math.max(...taps)-Math.min(...taps))/median(taps):null;
  return {f0,ambiguous,basis,reason,taps,spread,repeatable:complete&&taps.length>=2&&spread<=.01,dominantHz:r.f0};
}

// The measured lowest resonance, shared by the headline figure and the spectrum marker.
function lowestRepeatableHz(r,c){
  if(!r)return null;
  const fingerprint=acousticFingerprint(r,c),primary=primaryResonanceEvidence(fingerprint);
  if(fingerprint.repeatable&&primary.family)return primary.family.centre;
  const f0=estimateFundamental(r,c).f0;return Number.isFinite(f0)?f0:null;
}

// Neither edition gives any result until every required tap is recorded.
// Lite then answers PASS or NO PASS; Pro reports the model evidence.
function screenReading(r,c,requirePattern=false,requiredTaps=requirePattern?3:2){
  const estimate=estimateFundamental(r,c),band=geometryFamily(c),fingerprint=acousticFingerprint(r,c),repeatable=estimate.repeatable,fit=fitGeometryFamily(r,c);
  const primary=primaryResonanceEvidence(fingerprint),fieldPosition=bandPosition(primary.family?.centre,band);
  const taps=r.strikes.length,provisional=taps<requiredTaps,matched=fit.matchedModeCount||0;
  const hz=primary.family?Math.round(primary.family.centre):null,range=band.valid?Math.round(band.low)+"–"+Math.round(band.high)+" Hz":"";
  let state="inconclusive",reason="",diagnostic="inconclusive";
  if(!band.valid)reason="No physically admissible shape in the entered family. Review geometry assumptions.";
  else if(r.strikes.some(s=>s.offwindow))reason="The recorded tone’s identity is uncertain. Try another strike with the same support.";
  else if(provisional){diagnostic="incomplete";reason="Tap "+taps+" of "+requiredTaps+" recorded. No result is given until all "+requiredTaps+" taps are recorded with the same grip and strike.";}
  else if(!requirePattern){
    state="no-pass";
    if(!fingerprint.repeatable||!primary.family){diagnostic="not-repeatable";reason="The taps did not produce the same pitch, so this coin cannot pass. Retest with the same grip and strike position.";}
    else if(fieldPosition==="compatible"&&primary.insideLowest){
      state="compatible";diagnostic=primary.secondaryOutside.length?"primary-consistent-secondary-unresolved":"primary-band-incomplete";
      reason="The lowest repeatable pitch ("+hz+" Hz) is inside the expected range for this coin ("+range+"). This is an acoustic screen only: confirm weight and diameter and use an independent metal test, such as a Sigma, before relying on the coin.";
    }else if(fieldPosition==="anomalous"){
      const below=primary.family.centre<band.low;diagnostic=below?"primary-outside-model":"primary-above-band";
      reason="The lowest repeatable pitch ("+hz+" Hz) is "+(below?"below":"above")+" the expected range for this coin ("+range+"). Check the coin type, weight and diameter, and do not rely on this coin without independent testing.";
    }else{diagnostic="primary-band-edge";reason="The lowest repeatable pitch ("+hz+" Hz) is too close to the edge of the expected range ("+range+") to pass. Retest; if it stays there, do not rely on this coin without independent testing.";}
  }else if(!fingerprint.repeatable||!primary.family)reason="No stable resonance was retained across all taps. Repeat with the same support and strike position.";
  else if(fieldPosition==="compatible"&&primary.insideLowest){
    const extra=primary.secondaryOutside.map(a=>Math.round(a.family.centre)+" Hz").join(", ");
    // A joint fit that starts above the lowest resonance leaves that resonance unexplained.
    const fitCoversPrimary=inFamily(estimate.f0,primary.family);
    if(fit.state==="compatible"&&!estimate.ambiguous&&fitCoversPrimary&&!primary.secondaryOutside.length){
      state="compatible";diagnostic="model-consistent";const modes=Math.max(...fit.supported.map(x=>x.matches.length));
      reason="The lowest repeatable resonance ("+hz+" Hz) is in band and "+(modes===2?"two":modes===3?"three":modes)+" distinct modes, including it, fit one shape within "+Math.round(fit.tolerance*100)+"% (two are required). "+(fit.harmonicAssisted?"One fitted tone is also close to a whole-number multiple of a lower tone; it was counted as a plate mode because it fits the pattern. ":"")+"Check mass, diameter and metal independently.";
    }else{
      state="evidence";diagnostic=primary.secondaryOutside.length?"primary-consistent-secondary-unresolved":"primary-band-incomplete";
      const fitNote=fit.state!=="compatible"?(matched>=PRO_MIN_MODES?"The best joint fit relies on a tone near a whole-number multiple of a lower tone; two independent modes are required for a Pro model fit. ":"The best joint fit explains "+matched+" distinct mode(s); two are required for a Pro model fit. "):estimate.ambiguous||estimate.f0===null?"Several modes fit, but which one is the lowest mode remains ambiguous. ":!fitCoversPrimary?"The best joint fit starts at "+Math.round(estimate.f0)+" Hz and does not explain the lowest resonance. ":"";
      reason="The lowest repeatable resonance ("+hz+" Hz) falls within the provisional model band. "+fitNote+(extra?"Higher recurring tones at "+extra+" are not explained by this model. ":"")+"Confirm mass and diameter and use an independent metal test, such as a Sigma, before relying on the coin.";
    }
  }else if(fieldPosition==="anomalous"&&primary.family.centre>band.high){
    // Above the band, a missed lower mode is plausible only if the recurring tones fit as upper modes.
    const missedLower=!primary.assignment?.outside&&(fit.identityFits||[]).some(f=>!f.fundamentalObserved&&f.matches[0].familyIndex===primary.family.index);
    if(missedLower){state="evidence";diagnostic="lower-mode-unconfirmed";reason="The lowest frequency retained across taps ("+hz+" Hz) is above the lowest-mode band ("+range+"), but the recurring tones fit the model as upper modes. The lowest mode may not have been excited. Try another strike position and verify independently.";}
    else{state="anomalous";diagnostic="primary-above-model";reason="The lowest repeatable resonance ("+hz+" Hz) is above the lowest-mode band ("+range+") and the recurring tones do not fit the model as upper modes. Check the coin type, mass, diameter and support, then verify independently. This is a model mismatch, not a counterfeit finding.";}
  }else if(fieldPosition==="anomalous"){state="anomalous";diagnostic="primary-outside-model";reason="The lowest repeatable resonance ("+hz+" Hz) is below the current model band ("+range+"). Check the coin type, mass, diameter and support, then verify independently. This is a model mismatch, not a counterfeit finding.";}
  else{state="evidence";diagnostic="primary-band-edge";reason="The lowest repeatable resonance is near a model-band edge or has no clear lowest-mode assignment. Check dimensions and repeat the strike.";}
  if(requirePattern&&!provisional&&band.source==="solid")reason+=" Experimental 3D solid model, "+band.crossSectionName+" cross-section"+(band.support==="centre"?"; the (0,1) and (1,1) modes, which a centre support damps and stiffens, are not scored":"")+".";
  return {state,reason,diagnostic,primary,fieldPosition,band,repeatable,provisional,estimate,fingerprint,fit};
}

function resultTitle(e,pro){
  if(e.diagnostic==="incomplete")return "Test incomplete";
  if(!pro)return e.state==="compatible"?"PASS":e.state==="no-pass"?"NO PASS":"No result";
  if(e.state==="compatible")return "Model consistent";
  if(e.state==="anomalous")return "Primary frequency outside model";
  if(e.diagnostic==="lower-mode-unconfirmed")return "Lower mode not established";
  if(e.diagnostic==="primary-band-edge")return "Near model band edge";
  if(e.diagnostic==="primary-consistent-secondary-unresolved"||e.diagnostic==="primary-band-incomplete")return "Primary frequency in band";
  if(e.state==="evidence")return "Model fit unresolved";
  return "Inconclusive";
}
