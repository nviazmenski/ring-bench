"use strict";
// Experimental Kirchhoff–Love Rayleigh–Ritz model; derivation and limits in MODEL.md.
const GEOMETRY_MODEL="stepped-rim-ritz-v1";
const FAMILY_DEFAULTS=Object.freeze({widthMax:.16,ratioMax:1.75,ePct:5,rhoPct:1,massPct:1,diaPct:.5,edgePct:2,fitPct:3});
const rimEigenCache=new Map(),familyCache=new Map(),fitCache=new WeakMap();
function symmetricEigenvalues(input){
  const a=input.map(r=>r.slice()),n=a.length;
  for(let iter=0;iter<80*n*n;iter++){
    let p=0,q=1,big=0,diag=0;
    for(let i=0;i<n;i++){diag=Math.max(diag,Math.abs(a[i][i]));for(let j=i+1;j<n;j++)if(Math.abs(a[i][j])>big){big=Math.abs(a[i][j]);p=i;q=j;}}
    if(big<1e-13*Math.max(1,diag))return a.map((r,i)=>r[i]).sort((a,b)=>a-b);
    const theta=.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]),c=Math.cos(theta),s=Math.sin(theta),pp=a[p][p],qq=a[q][q],pq=a[p][q];
    for(let k=0;k<n;k++)if(k!==p&&k!==q){const x=a[k][p],y=a[k][q];a[k][p]=a[p][k]=c*x-s*y;a[k][q]=a[q][k]=s*x+c*y;}
    a[p][p]=c*c*pp-2*s*c*pq+s*s*qq;a[q][q]=s*s*pp+2*s*c*pq+c*c*qq;a[p][q]=a[q][p]=0;
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
  rimEigenCache.set(key,result);return result;
}
function familyOptions(c){return {...FAMILY_DEFAULTS,...c.family};}
function geometryFamily(c){
  const o=familyOptions(c),key=JSON.stringify([c.mass,c.dia,c.rho,c.E,c.nu,c.rimThickness||0,o]);
  if(familyCache.has(key))return familyCache.get(key);
  const h=c.mass/(c.rho*Math.PI*(c.dia/20)**2)*10,a=c.dia/2000;
  const scale=h/1000/(2*Math.PI*a*a)*Math.sqrt(c.E*1e9/(12*(1-c.nu*c.nu)*c.rho*1000));
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
  const result={model:GEOMETRY_MODEL,options:o,candidates,h,low,high,lowScale,highScale,source:"model",valid:candidates.length>0&&low>0,edge:o.edgePct/100};
  if(familyCache.size>150)familyCache.clear();familyCache.set(key,result);return result;
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
    const picks=strikes.slice(1).map((s,k)=>s.peaks.map((q,i)=>({i,f:q.f,error:Math.abs(q.f/p.f-1)})).filter(q=>!used[k+1].has(q.i)&&q.error<=.01).sort((a,b)=>a.error-b.error)[0]);
    if(!picks.every(Boolean))continue;
    const observations=[{tap:0,...p},...picks.map((pick,k)=>({tap:k+1,...strikes[k+1].peaks[pick.i]}))].map(o=>({...o,relativeDb:20*Math.log10(((o.mag||0)+1e-30)/(Math.max(...strikes[o.tap].peaks.map(p=>p.mag||0))+1e-30))})),fs=observations.map(p=>p.f),mid=median(fs),spread=(Math.max(...fs)-Math.min(...fs))/mid;if(spread>.01)continue;
    picks.forEach((p,k)=>used[k+1].add(p.i));out.push({f:mid,frequencies:fs,spread,support:observations.length,snrDb:median(observations.map(p=>p.snrDb||0)),relativeDb:median(observations.map(p=>p.relativeDb)),relativeRangeDb:Math.max(...observations.map(p=>p.relativeDb))-Math.min(...observations.map(p=>p.relativeDb)),persistenceDropDb:median(observations.map(p=>p.persistenceDropDb).filter(Number.isFinite)),observations});
  }
  return out;
}
const MODE_SPLIT_CLUSTER_PCT=.03;
const MODE_ENVELOPE_GUARD_PCT=.01;
const HARMONIC_TOLERANCE_PCT=.008;
function modalFamilies(reading,splitPct=MODE_SPLIT_CLUSTER_PCT){
  const tracks=recurringPeaks(reading).slice().sort((a,b)=>a.f-b.f),families=[];
  for(const track of tracks){
    const last=families.at(-1),centre=last?median(last.tracks.map(t=>t.f)):0;
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
function scoringFamilies(reading){return modalFamilies(reading).filter(f=>f.harmonicOf===undefined);}
function scoringTracks(reading){return scoringFamilies(reading).flatMap(f=>f.tracks);}
function plateRatioEvidence(reading,c){
  const family=geometryFamily(c),families=scoringFamilies(reading),pairs=[];
  if(!family.valid)return pairs;
  for(let a=0;a<families.length;a++)for(let b=a+1;b<families.length;b++){
    const observed=families[b].centre/families[a].centre,candidates=[];
    for(const g of family.candidates){
      const modes=g.f.map((f,mode)=>({f,mode})).filter(x=>x.f*family.lowScale<=reading.usableHz).sort((x,y)=>x.f-y.f);
      for(let i=0;i<modes.length;i++)for(let j=i+1;j<modes.length;j++){
        const ratio=modes[j].f/modes[i].f,ratioError=Math.abs(observed/ratio-1),scale=Math.sqrt(families[a].centre*families[b].centre/(modes[i].f*modes[j].f));
        const absoluteErrors=[Math.abs(families[a].centre/(modes[i].f*scale)-1),Math.abs(families[b].centre/(modes[j].f*scale)-1)],tol=family.options.fitPct/100+2*g.numericalError;
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
  return family.candidates[0].f.map((_,mode)=>({
    mode,
    low:Math.min(...family.candidates.map(g=>g.f[mode]*(1-2*g.numericalError)*family.lowScale)),
    high:Math.max(...family.candidates.map(g=>g.f[mode]*(1+2*g.numericalError)*family.highScale))
  }));
}
function modalEnvelopeEvidence(reading,c){
  const envelopes=modeEnvelopes(c),families=modalFamilies(reading);
  const assignments=families.map(family=>{
    const possible=envelopes.filter(e=>family.centre>=e.low*(1-MODE_ENVELOPE_GUARD_PCT)&&family.centre<=e.high*(1+MODE_ENVELOPE_GUARD_PCT));
    const nearest=envelopes.map(e=>({mode:e.mode,distance:family.centre<e.low?e.low/family.centre-1:family.centre>e.high?family.centre/e.high-1:0,envelope:e})).sort((a,b)=>a.distance-b.distance)[0]||null;
    return {family,possible,nearest,outside:family.harmonicOf===undefined&&possible.length===0,excludedAsHarmonic:family.harmonicOf!==undefined};
  });
  return {envelopes,assignments,outside:assignments.filter(a=>a.outside),guard:MODE_ENVELOPE_GUARD_PCT};
}
function acousticFingerprint(reading,c){
  const taps=reading?.strikes?.length||0,tracks=recurringPeaks(reading),families=modalFamilies(reading),ratios=c?plateRatioEvidence(reading,c):[],envelope=c?modalEnvelopeEvidence(reading,c):null,decay=tracks.filter(t=>Number.isFinite(t.persistenceDropDb)).map(t=>({f:t.f,earlyLateDb:t.persistenceDropDb}));
  return {version:1,taps,tracks,families,ratios,envelope,decay,repeatable:taps>=2&&tracks.length>0&&tracks.every(t=>t.support===taps&&t.spread<=.01)};
}
// Enumerate monotone one-to-one mode assignments. One global scale represents
// the explicitly allowed material/dimension uncertainty; each ratio must fit too.
function fitGeometryFamily(reading,c){
  const cacheKey=JSON.stringify(c),cache=fitCache.get(reading)||new Map();if(cache.has(cacheKey))return cache.get(cacheKey);
  const family=geometryFamily(c),observed=scoringTracks(reading).filter(p=>p.f<=reading.usableHz),results=[];
  if(observed.length<2||reading.strikes.length<2||!family.valid)return {family,observed,results,best:null,supported:[],state:"insufficient"};
  const tolerance=family.options.fitPct/100;
  for(const g of family.candidates){
    const modes=g.f.map((f,i)=>({f,i})).filter(m=>m.f*family.lowScale<=reading.usableHz).sort((a,b)=>a.f-b.f);
    // Try every recurring tone as the lowest observed member of a mode pattern.
    // Each path may therefore include frequencies below the loudest resonance.
    for(const anchor of observed){
    const upper=observed.filter(p=>p.f>anchor.f*1.08).slice(0,12);
    for(let root=0;root<modes.length;root++){
      const base=modes[root],pairs=[{measured:anchor.f,predicted:base.f,mode:base.i}],paths=[];
      function visit(pi,mi,current){
        paths.push(current);
        for(let p=pi;p<upper.length;p++)for(let m=mi;m<modes.length;m++){
          const ratioError=Math.abs((upper[p].f/anchor.f)/(modes[m].f/base.f)-1);
          if(ratioError<=tolerance+2*g.numericalError)visit(p+1,m+1,current.concat({measured:upper[p].f,predicted:modes[m].f,mode:modes[m].i}));
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
        results.push({geometry:g,matches:match,scale,residual,ratioResidual:Math.max(...ratioErrors),supported,rootMode:base.i,fundamentalObserved:base.i===g.f.indexOf(Math.min(...g.f))});
      }
    }
    }
  }
  results.sort((a,b)=>Number(b.supported)-Number(a.supported)||b.matches.length-a.matches.length||a.residual-b.residual);
  const best=results[0]||null,supported=results.filter(r=>r.supported&&r.matches.length>=3);
  const result={family,observed,results:results.slice(0,30),identityFits:results.filter(r=>r.supported),best,supported,state:supported.length?"compatible":observed.length>=3?"unresolved":"insufficient"};
  cache.set(cacheKey,result);fitCache.set(reading,cache);return result;
}

function estimateFundamental(r,c){
  const observed=scoringTracks(r).filter(p=>p.f<=r.usableHz),fit=fitGeometryFamily(r,c);
  const fits=fit.identityFits||[],maxCount=Math.max(0,...fits.map(f=>f.matches.length));
  // Use all surviving maximal-coverage interpretations, not just the best residual.
  const contenders=(fit.supported.length?fit.supported:fits).filter(f=>f.matches.length===maxCount);
  const candidates=contenders.filter(f=>f.fundamentalObserved).map(f=>f.matches[0].measured);
  let f0=null,ambiguous=false,basis="",reason="";
  if(contenders.length){
    const missing=contenders.some(f=>!f.fundamentalObserved);
    ambiguous=missing||candidates.some(f=>Math.abs(f/candidates[0]-1)>.01);
    if(!ambiguous&&candidates.length){f0=median(candidates);basis="joint-pattern";reason="Lowest observed mode supported by the recurring peak pattern.";}
    else reason=missing?"The peak pattern permits an unobserved lower fundamental or competing mode identities.":"Several recurring peaks remain plausible fundamentals.";
  }else if(observed.length===1){f0=observed[0].f;basis="single-tone";reason="Only one credible tone; fundamental identity is provisional.";}
  else{ambiguous=true;reason=observed.length?"Recurring peaks do not establish a unique fundamental.":"No common tone was retained across the taps.";}
  const taps=f0===null?[]:r.strikes.map(s=>s.peaks.filter(p=>Math.abs(p.f/f0-1)<=.01).sort((a,b)=>Math.abs(a.f-f0)-Math.abs(b.f-f0))[0]?.f);
  const complete=taps.length===r.strikes.length&&taps.every(Number.isFinite);
  const spread=complete?(Math.max(...taps)-Math.min(...taps))/median(taps):null;
  return {f0,ambiguous,basis,reason,taps,spread,repeatable:complete&&taps.length>=2&&spread<=.01,dominantHz:r.f0};
}

function screenReading(r,c,requirePattern=false){
  const estimate=estimateFundamental(r,c),band=geometryFamily(c),fingerprint=acousticFingerprint(r,c),position=bandPosition(estimate.f0,band),repeatable=estimate.repeatable,fit=fitGeometryFamily(r,c);
  let state=position,reason="",provisional=r.strikes.length<2;
  if(!band.valid){state="inconclusive";reason="No physically admissible shape in the entered family. Review geometry assumptions.";}
  else if(r.strikes.some(s=>s.offwindow)){state="inconclusive";reason="The recorded tone’s identity is uncertain.";}
  else if(fingerprint.repeatable&&fingerprint.envelope.outside.length){
    const ranges=fingerprint.envelope.outside.map(a=>a.family.frequencies.map(f=>Math.round(f)).join("–")+" Hz").join(", ");
    state="anomalous";reason="The repeatable "+ranges+" modal "+(fingerprint.envelope.outside.length===1?"family falls":"families fall")+" outside every plausible mode-frequency envelope in the entered geometry and material model. This is exclusionary acoustic evidence, not proof of composition.";
  }
  else if(estimate.ambiguous||estimate.f0===null){
    if(fingerprint.repeatable&&fingerprint.tracks.length>=2){state="evidence";reason=fingerprint.families.length===1?"Repeatable close-frequency components form a possible split modal family. The individual peaks are retained, but the present model cannot label the parent mode.":fit.state==="compatible"?"Several repeatable resonances form a plausible plate-mode pattern, but their absolute mode identities remain ambiguous.":"A repeatable multi-tone acoustic pattern was retained, but it has no unique joint assignment within the current geometry and material assumptions.";}
    else{state="inconclusive";reason=estimate.reason;}
  }
  else if(!provisional&&!repeatable){state="inconclusive";reason="The taps disagree. Repeat with the same support position.";}
  else if(position==="anomalous"&&provisional){state="inconclusive";reason="Outside the model band on one tap. Repeat before interpreting it.";}
  else if(requirePattern&&provisional){state="inconclusive";reason="One tap was retained. Pro needs repeated modal evidence before interpreting compatibility.";}
  else if(requirePattern&&position!=="anomalous"&&fit.state!=="compatible"){state="evidence";reason=fingerprint.tracks.length===1?"One repeatable resonance is consistent with the provisional band, but Pro requires a coherent multi-mode pattern for positive theoretical compatibility.":"Repeatable resonances were retained, but fewer than three jointly fitted modes cannot establish theoretical material compatibility.";}
  else reason=position==="compatible"?"The measured modal pattern and absolute frequencies fit the provisional geometry and material family.":position==="anomalous"?"The repeated tone lies well outside this model family. Fundamental identity may still be uncertain; investigate further.":"The fundamental candidate is near a band edge. Geometry or material assumptions could change the result.";
  return {state,reason,band,repeatable,provisional,estimate,fingerprint,fit};
}
