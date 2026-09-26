"use strict";
// Counterfeit constructions: how a fake made to this coin's weight and diameter would ring.
// The threat model is the fake that already passes a scale and calipers. Derivation,
// material ranges and limits are in MODEL.md, "Counterfeit constructions".
const CONSTRUCTION_MODEL="construction-screen-v1";
const UNDERFINE_POINTS=.05;
const CONSTRUCTIONS={
  gold:[
    {id:"tungsten",core:"tungsten",n:"Gold-plated tungsten",why:"Tungsten is nearly as dense as gold, so this fake can match weight, diameter and thickness."},
    {id:"tungsten-shell",core:"tungsten",coreName:"tungsten",shell:true,n:"Tungsten core in a gold shell",why:"The gold outside carries much of the bending stiffness, so a thick shell rings close to genuine."},
    {id:"underfine",underfine:UNDERFINE_POINTS,n:"Underfine gold: 5 points less, balance copper",why:"Genuine-looking gold of lower fineness.",caveat:"A few points of fineness barely move the pitch."},
    {id:"brass",core:"brass",n:"Gold-plated brass",why:"A common base-metal fake."},
    {id:"copper",core:"copper",n:"Gold-plated copper",why:"A common base-metal fake."},
  ],
  silver:[
    {id:"molybdenum",core:"molybdenum",n:"Silver-plated molybdenum",why:"Molybdenum is as dense as silver, so this fake can match weight, diameter and thickness."},
    {id:"molybdenum-shell",core:"molybdenum",coreName:"molybdenum",shell:true,n:"Molybdenum core in a silver shell",why:"The silver outside carries much of the bending stiffness, so a thick shell rings close to genuine."},
    {id:"underfine",underfine:UNDERFINE_POINTS,n:"Underfine silver: 5 points less, balance copper",why:"Genuine-looking silver of lower fineness.",caveat:"A few points of fineness barely move the pitch."},
    {id:"brass",core:"brass",n:"Silver-plated brass",why:"A common base-metal fake."},
    {id:"copper",core:"copper",n:"Silver-plated copper",why:"A common base-metal fake."},
    {id:"nickel-silver",core:"nickelSilver",n:"Silver-plated nickel silver",why:"A common base-metal fake."},
    {id:"zinc",core:"zinc",n:"Silver-plated zinc alloy",why:"A cast base-metal fake."},
    {id:"lead-tin",core:"leadTin",n:"Lead–tin casting",why:"A cast base-metal fake with a dull ring.",caveat:"Lead–tin alloys vary widely in stiffness; their dull, short ring is the usual giveaway."},
    {id:"steel",core:"steel",n:"Silver-plated steel",why:"A magnet also catches this."},
  ],
};
const constructionCache=new Map(),constructionReadingCache=new WeakMap();
function constructionsFor(c){const a=ALLOYS[c.key];return a&&!a.layers?CONSTRUCTIONS[a.mt]||[]:[];}
// The genuine metal as entered, with the entered modulus and density uncertainty.
function genuineMaterial(c){return {rho:c.rho,E:c.E,nu:c.nu,ePct:c.family?.ePct??FAMILY_DEFAULTS.ePct,rhoPct:c.family?.rhoPct??FAMILY_DEFAULTS.rhoPct};}
function coreMaterial(k){const a=ALLOYS[k];return {rho:rhoOf(k),E:a.E,nu:a.nu,ePct:a.ePct??FAMILY_DEFAULTS.ePct,rhoPct:a.rhoPct??FAMILY_DEFAULTS.rhoPct};}
// Same mass, diameter and rim constraint as the coin under test; only the material changes.
function asSpec(c,m,key){return {...c,key,rho:m.rho,E:m.E,nu:m.nu,family:{...FAMILY_DEFAULTS,...c.family,ePct:m.ePct,rhoPct:m.rhoPct}};}
// A shell whose faces take fraction x of the thickness. Uncertainty stacks linearly by
// each layer's share of the stiffness and the mass, like the other nuisance terms.
function shellSpec(c,con,x){
  const face=genuineMaterial(c),core=coreMaterial(con.core),eq=laminate(face,core,x),rho=eq.rho;
  // ν is rounded to 0.01 so every shell reuses a few cached eigenvalue sets; a 0.005
  // change in ν moves the band by about 0.1%, against a band roughly ±10% wide.
  return {...asSpec(c,{rho,E:eq.E,nu:Math.round(eq.nu*100)/100,
    ePct:eq.stiffnessShare.face*face.ePct+eq.stiffnessShare.core*core.ePct,
    rhoPct:(x*face.rho*face.rhoPct+(1-x)*core.rho*core.rhoPct)/rho},con.core+"-shell"),shell:x};
}
function underfineSpec(c,con){
  const a=ALLOYS[c.key],metal=a.mt==="gold"?"Au":"Ag",f={...a.f};
  if(!(f[metal]>con.underfine))return null;
  f[metal]-=con.underfine;f.Cu=(f.Cu||0)+con.underfine;
  // Only the density changes; the modulus stays at the entered value with its uncertainty.
  return {...asSpec(c,{...genuineMaterial(c),rho:c.rho*dens(f)/rhoOf(c.key)},c.key+"-underfine"),composition:f};
}
function constructionSpec(c,con,x=0){
  if(con.shell)return shellSpec(c,con,x);
  if(con.underfine)return underfineSpec(c,con);
  return asSpec(c,coreMaterial(con.core),con.core);
}
// Largest x in [lo,hi] where a monotone test still holds, given it holds at lo.
function bisect(test,lo=0,hi=1){for(let i=0;i<16;i++){const mid=(lo+hi)/2;if(test(mid))lo=mid;else hi=mid;}return lo;}
// Two model bands are separable by pitch when they do not overlap: then no frequency
// that passes as genuine can also be in or near the construction's band.
function separation(band,genuine){
  if(!band.valid)return {state:"no-shape"};
  if(band.low>=genuine.high)return {state:"separated",direction:"higher",margin:band.low/genuine.high-1};
  if(band.high<=genuine.low)return {state:"separated",direction:"lower",margin:1-band.high/genuine.low};
  return {state:"overlaps"};
}
function shellFaceMass(c,con,x){const face=genuineMaterial(c),core=coreMaterial(con.core);return x*face.rho/(x*face.rho+(1-x)*core.rho);}
function constructionScreen(c){
  const key=JSON.stringify(c);if(constructionCache.has(key))return constructionCache.get(key);
  const genuine=geometryFamily(c),rows=[];
  for(const con of constructionsFor(c)){
    const spec=constructionSpec(c,con);if(!spec)continue;
    const band=geometryFamily(spec),row={id:con.id,n:con.n,why:con.why,con,core:con.core||null,shell:!!con.shell,spec,band,thickness:c.rho/spec.rho,magnetic:!!ALLOYS[con.core]?.mag};
    if(!genuine.valid)row.separation={state:"unknown"};
    else if(con.shell){
      const separated=x=>separation(geometryFamily(constructionSpec(c,con,x)),genuine).state==="separated";
      if(!separated(0))row.separation={state:"overlaps"};
      else{const x=bisect(separated);row.separation={state:"thin-shells",faceThickness:x,faceMass:shellFaceMass(c,con,x),margin:band.low/genuine.high-1};}
    }else row.separation=separation(band,genuine);
    rows.push(row);
  }
  const result={model:CONSTRUCTION_MODEL,genuine,rows};
  if(constructionCache.size>40)constructionCache.clear();constructionCache.set(key,result);return result;
}
// One construction against a reading, using the same rules as Pro's screen: a construction
// is ruled out when the lowest repeatable resonance is outside its lowest-mode band, unless
// that band is lower and the recurring tones fit it as upper modes with its lowest mode missed.
function constructionMatch(reading,spec,primary){
  const band=geometryFamily(spec),f=primary.family.centre;
  if(!band.valid)return {status:"no-shape"};
  const position=bandPosition(f,band);
  if(position!=="anomalous")return {status:"possible",position};
  if(f<band.low)return {status:"ruled-out",direction:"higher"};
  const assignment=modalEnvelopeEvidence(reading,spec).assignments[primary.family.index];
  const upper=!assignment?.outside&&(fitGeometryFamily(reading,spec).identityFits||[]).some(x=>!x.fundamentalObserved&&x.matches[0].familyIndex===primary.family.index);
  return upper?{status:"possible",position:"upper-modes"}:{status:"ruled-out",direction:"lower"};
}
// Shell bands fall steadily from the bare core to the genuine alloy as the shell thickens,
// so the shells that fit one frequency form one interval of face thickness [from, to].
function shellMatch(c,con,f){
  const band=x=>geometryFamily(constructionSpec(c,con,x));
  if(!band(0).valid||!band(1).valid)return {status:"no-shape"};
  const higher=x=>f<band(x).low*(1-band(x).edge),lower=x=>f>band(x).high*(1+band(x).edge);
  if(higher(1))return {status:"ruled-out",direction:"higher"};
  if(lower(0))return {status:"ruled-out",direction:"lower"};
  const from=higher(0)?bisect(higher):0,to=lower(1)?bisect(x=>!lower(x),from):1;
  return {status:from>0?"thick-shells":"possible",faceThickness:[from,to],faceMass:[shellFaceMass(c,con,from),shellFaceMass(c,con,to)]};
}
function screenConstructions(reading,c,target){
  const base=constructionScreen(c);
  if(!reading||reading.strikes.length<target)return {...base,reading:null};
  const key=JSON.stringify([c,target]),cache=constructionReadingCache.get(reading)||new Map();
  if(cache.has(key))return cache.get(key);
  const fingerprint=acousticFingerprint(reading,c),primary=primaryResonanceEvidence(fingerprint);
  let result;
  if(!fingerprint.repeatable||!primary.family)result={...base,reading:{state:"not-repeatable"},rows:base.rows.map(r=>({...r,match:{status:"unknown"}}))};
  else{
    const f=primary.family.centre;
    result={...base,reading:{state:"repeatable",f},rows:base.rows.map(r=>({...r,match:r.shell?shellMatch(c,r.con,f):constructionMatch(reading,r.spec,primary)}))};
  }
  cache.set(key,result);constructionReadingCache.set(reading,cache);return result;
}
// The lowest frequency worth analysing for this coin. Every hypothesis the app can name,
// the genuine coin and each modelled fake, has its lowest mode at or above `lowestHz`.
// The floor sits a second-mode ratio and the edge guard below that. Anything whose lowest
// mode falls under the floor still shows its next mode below every band, so hiding a tone
// can leave a result at NO PASS but cannot produce a PASS. It is derived per coin, so new
// catalogue entries and new constructions need no hand-set cutoff. MODEL.md, "Analysis floor".
function analysisFloor(c){
  const screen=constructionScreen(c),bands=[screen.genuine,...screen.rows.map(r=>r.band)].filter(b=>b.valid);
  if(!bands.length)return {hz:0,lowestHz:null,secondModeRatio:null};
  const lowestHz=Math.min(...bands.map(b=>b.low)),edge=Math.max(...bands.map(b=>b.edge));
  const secondModeRatio=Math.max(...bands.flatMap(b=>b.candidates.map(g=>{const f=g.f.slice().sort((x,y)=>x-y);return f[1]/f[0]*(1+2*g.numericalError);})));
  return {hz:(1-edge)*lowestHz/secondModeRatio,lowestHz,secondModeRatio};
}
// Plain data for exports: no geometry candidates or cached objects.
function constructionExport(screen){
  return {model:screen.model,threat:"same mass and diameter as the coin under test",lowestRepeatableHz:screen.reading?.f??null,
    rows:screen.rows.map(r=>({id:r.id,name:r.n,material:r.core,band:r.band.valid?[r.band.low,r.band.high]:null,thicknessVsGenuine:r.thickness,separation:r.separation,match:r.match||null}))};
}
