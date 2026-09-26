// Generates pro/solid-tables.js: plate-equivalent λ² from the axisymmetric 3D solid model in pro/solid.js, for
// sampled coin cross-sections on a grid of volume-equivalent thickness/radius, rim/volume-equivalent thickness and ν.
//   node scripts/solid-tables.mjs                      regenerate every family (about an hour on 4 cores)
//   node scripts/solid-tables.mjs --family=<name>      regenerate one family, keeping the others
//   node scripts/solid-tables.mjs --check              recompute sample entries and off-grid points; exit 1 on mismatch
//   node scripts/solid-tables.mjs --measure            re-measure each family's interpolation error in the committed file
import fs from "node:fs";import path from "node:path";import os from "node:os";import vm from "node:vm";
import {Worker,isMainThread,parentPort,workerData} from "node:worker_threads";import {fileURLToPath} from "node:url";
// RINGBENCH_SOLID_OUT and RINGBENCH_SOLID_SAMPLES redirect the output and cap the samples, for quick trial runs.
const here=fileURLToPath(import.meta.url),root=path.resolve(path.dirname(here),".."),out=process.env.RINGBENCH_SOLID_OUT||path.join(root,"pro","solid-tables.js");
const loadSolid=(withTables=false)=>{const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(root,"pro","solid.js"),"utf8"),ctx);if(withTables)vm.runInContext(fs.readFileSync(out,"utf8"),ctx);return ctx;};

// Quadratic interpolation needs only these spacings: ≤0.02% on thickness, ≤0.003% on rim, ≤0.02% on ν (MODEL.md).
const RIM=[0,1,2,3,4,5,6].map(k=>+(1+k/12).toFixed(5)),NU=[.27,.31,.35,.39,.43];
const MESH={perRadius:30,coreLayers:2,topLayers:1};
// Priors are physical ranges, not fitted values; MODEL.md gives the reasoning for each. How a sample becomes
// cross-section parameters is SOLID_FAMILY_PARAMS in pro/solid.js, shared with the app.
const FAMILIES={
  "morgan-solid":{model:"morgan-solid-v2",samples:40,seed:20260926,grid:{hbar:[.08,.11,.14,.17,.20],rim:RIM,nu:NU},
    basin:"mm",radiusMm:19.05,
    priors:{
      s:[0,.16],        // die-basin sagitta per side, mm (0 = flat; ~0.11 mm for a 50 inch die radius)
      wR:[.025,.06],    // outer rim width / radius
      wD:[.03,.07],     // denticle band width / radius
      fD:[.5,.9],phiD:[.4,.6],              // denticle height (fraction of field depth) and areal fill
      fc:[.4,.9],phic:[.3,.5],rc:[.62,.72], // portrait: height fraction (wear lowers it), fill, outer radius
      fL:[.5,.9],phiL:[.2,.4],              // legend and star band, 0.74–0.89 of the radius
      betaFrac:[.05,.6],                    // in-plane stiffness of smeared relief as a fraction of its fill
      g:[.9,1.3],                           // through-thickness shear modulus / isotropic value (rolling texture)
    },
  },
  "generic-solid":{model:"generic-solid-v1",samples:48,seed:20260927,grid:{hbar:[.02,.05,.08,.11,.14,.17,.20,.23],rim:RIM,nu:NU},
    basin:"relative",
    priors:{
      sRel:[0,.07],     // die-basin sagitta per side / volume-equivalent thickness (the Morgan range, scaled)
      wR:[.02,.10],     // outer rim width / radius: narrow raised borders to wide flat bullion rims
      wD:[.03,.07],     // inner border (denticles, beads or a step) width / radius
      fD:[.3,.9],phiD:[.3,.7],
      fc:[.3,.9],phic:[.25,.55],rc:[.50,.75], // central device
      fL:[.4,.9],phiL:[.1,.4],              // legend band, from rc+0.04 to 0.02 inside the border when it fits
      betaFrac:[.05,.6],
      g:[.9,1.3],
    },
  },
};
if(process.env.RINGBENCH_SOLID_SAMPLES)for(const f of Object.values(FAMILIES))f.samples=Math.min(f.samples,+process.env.RINGBENCH_SOLID_SAMPLES);
function mulberry32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function latinHypercube(f){
  const rand=mulberry32(f.seed),keys=Object.keys(f.priors),cols=keys.map(()=>{const p=Array.from({length:f.samples},(_,i)=>i);for(let i=p.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[p[i],p[j]]=[p[j],p[i]];}return p;});
  return Array.from({length:f.samples},(_,i)=>keys.map((k,j)=>{const [lo,hi]=f.priors[k],u=(cols[j][i]+rand())/f.samples;return +(lo+u*(hi-lo)).toFixed(5);}));
}
function compute(ctx,name,x,hbar,rim,nu){
  const keys=Object.keys(FAMILIES[name].priors);ctx.args={name,keys,x,hbar,rim,nu,g:x[keys.indexOf("g")],mesh:MESH};
  return vm.runInContext(`(()=>{const p=solidProfileFor(args.name,args.keys,args.x,args.hbar,args.rim);return p?solidLambda2(p,args.nu,{g:args.g,mesh:args.mesh}):null;})()`,ctx);
}
const cells=f=>{const G=f.grid,list=[];for(let si=0;si<f.samples;si++)G.hbar.forEach((h,ih)=>G.rim.forEach((r,ir)=>G.nu.forEach((v,iv)=>list.push({si,ih,ir,iv,h,r,v}))));return list;};
// Uint16 per value: 0 = no admissible cross-section, otherwise λ² quantised over each mode's range (~1e-5 relative).
function encode(values,count){
  const ranges=[0,1,2,3,4,5].map(m=>{let lo=Infinity,hi=-Infinity;for(let i=0;i<count;i++){const v=values[i*6+m];if(v){lo=Math.min(lo,v);hi=Math.max(hi,v);}}return [lo,hi];});
  const q=new Uint16Array(count*6);
  for(let i=0;i<count;i++)for(let m=0;m<6;m++){const v=values[i*6+m];if(v){const [lo,hi]=ranges[m];q[i*6+m]=1+Math.round((v-lo)/(hi-lo||1)*65534);}}
  return {ranges,data:Buffer.from(q.buffer).toString("base64")};
}
function randomOffGrid(f,n,seed){
  const rand=mulberry32(seed),G=f.grid,span=a=>a[0]+(a.at(-1)-a[0])*rand();
  // The rim range includes the band just above the lowest node, where cross-sections become admissible.
  return Array.from({length:n},()=>({si:Math.floor(rand()*f.samples),h:span(G.hbar),r:span([G.rim[0],G.rim.at(-2)]),v:span(G.nu)}));
}

function measureInterpolation(name,entry,count=24){
  const f=FAMILIES[name],ctx=loadSolid();vm.runInContext("var SOLID_TABLE_DATA="+JSON.stringify({[name]:entry}),ctx);let worst=0,n=0;
  for(const p of randomOffGrid(f,count,f.seed+1)){
    const lam=compute(ctx,name,entry.samples[p.si],p.h,p.r,p.v);ctx.q=p;ctx.name=name;
    const got=vm.runInContext("solidLookup(solidTable(name),q.si,q.h,q.r,q.v)",ctx);
    if(!lam!==!got)throw Error(name+": lookup and solver disagree on admissibility at "+JSON.stringify(p));
    if(lam){n++;worst=Math.max(worst,...lam.map((v,i)=>Math.abs(got[i]/v-1)));}
  }
  return {worst,n};
}
if(!isMainThread){
  const ctx=loadSolid();
  for(const j of workerData)parentPort.postMessage({...j,lam:compute(ctx,j.name,j.x,j.h,j.r,j.v)});
  parentPort.close();
}else if(process.argv.includes("--measure")){
  const data=vm.runInContext(fs.readFileSync(out,"utf8")+";SOLID_TABLE_DATA",vm.createContext({}));
  for(const name of Object.keys(data)){const {worst,n}=measureInterpolation(name,data[name]);data[name].interpolationError=+worst.toPrecision(3);console.log(name+": interpolation error "+worst.toExponential(2)+" over "+n+" admissible points");}
  const text=fs.readFileSync(out,"utf8").replace(/const SOLID_TABLE_DATA=.*;\n$/s,"const SOLID_TABLE_DATA="+JSON.stringify(data)+";\n");
  fs.writeFileSync(out,text);
}else if(process.argv.includes("--check")){
  const ctx=loadSolid(true);let worstGrid=0,worstOff=0,fail=false;
  for(const name of Object.keys(FAMILIES)){
    const f=FAMILIES[name],stored=vm.runInContext(`SOLID_TABLE_DATA[${JSON.stringify(name)}]`,ctx);
    if(!stored||stored.model!==f.model||JSON.stringify(stored.grid)!==JSON.stringify(f.grid))throw Error(name+": committed table does not match the generator; regenerate it.");
    const samples=stored.samples,all=cells(f),pick=[.1,.45,.8].map(t=>all[Math.floor(t*all.length)]);
    for(const j of pick){
      const lam=compute(ctx,name,samples[j.si],j.h,j.r,j.v);ctx.q=j;ctx.name=name;
      const got=vm.runInContext(`solidTableEntry(solidTable(name),q.si,q.ih,q.ir,q.iv)`,ctx);
      if(!lam!==!got){console.error(name+": admissibility differs at grid entry");fail=true;continue;}
      if(lam)worstGrid=Math.max(worstGrid,...lam.map((v,i)=>Math.abs(got[i]/v-1)));
    }
    for(const p of randomOffGrid(f,3,7)){
      const lam=compute(ctx,name,samples[p.si],p.h,p.r,p.v);ctx.q=p;ctx.name=name;
      const got=vm.runInContext(`solidLookup(solidTable(name),q.si,q.h,q.r,q.v)`,ctx);
      if(!lam!==!got){console.error(name+": admissibility differs off-grid");fail=true;continue;}
      if(lam&&got){const e=Math.max(...lam.map((v,i)=>Math.abs(got[i]/v-1)));worstOff=Math.max(worstOff,e);if(e>stored.interpolationError*1.5+2e-5){console.error(name+": off-grid error "+e.toExponential(2)+" exceeds the recorded "+stored.interpolationError.toExponential(2));fail=true;}}
    }
  }
  console.log("solid table check: grid entries within "+worstGrid.toExponential(2)+", off-grid interpolation within "+worstOff.toExponential(2));
  if(fail||worstGrid>3e-5)process.exit(1);
}else{
  const only=process.argv.find(a=>a.startsWith("--family="))?.slice(9),names=only?[only]:Object.keys(FAMILIES);
  if(only&&!FAMILIES[only])throw Error("Unknown family "+only);
  const previous=only&&fs.existsSync(out)?vm.runInContext(fs.readFileSync(out,"utf8")+";SOLID_TABLE_DATA",vm.createContext({})):{};
  const result={...previous},t0=Date.now(),threads=Math.max(1,Math.min(os.cpus().length,8));
  for(const name of names){
    const f=FAMILIES[name],samples=latinHypercube(f),list=cells(f).map(c=>({...c,name,x:samples[c.si]})),values=new Float64Array(list.length*6);let done=0;
    const index=c=>(((c.si*f.grid.hbar.length+c.ih)*f.grid.rim.length+c.ir)*f.grid.nu.length+c.iv);
    await Promise.all(Array.from({length:threads},(_,w)=>new Promise((resolve,reject)=>{
      const worker=new Worker(here,{workerData:list.filter((_,i)=>i%threads===w)});
      worker.on("message",m=>{if(m.lam)values.set(m.lam,index(m)*6);if(++done%500===0)console.log(name+": "+done+"/"+list.length+" cross-sections, "+((Date.now()-t0)/1000).toFixed(0)+" s");});
      worker.on("error",reject);worker.on("exit",resolve);
    })));
    const {ranges,data}=encode(values,list.length);
    const entry={model:f.model,solver:"axisym-solid-fe-v1",mesh:MESH,seed:f.seed,basin:f.basin,...f.radiusMm?{radiusMm:f.radiusMm}:{},priors:f.priors,keys:Object.keys(f.priors),grid:f.grid,samples,ranges,interpolationError:0,data};
    // Measure the interpolation error at random off-grid points against direct solves; the family's numerical margin uses it.
    const {worst}=measureInterpolation(name,entry);entry.interpolationError=+worst.toPrecision(3);result[name]=entry;
    console.log(name+": "+list.length+" cross-sections, "+(values.filter((v,i)=>i%6===0&&v).length)+" admissible, interpolation error "+worst.toExponential(2));
  }
  const text='"use strict";\n// Generated by scripts/solid-tables.mjs from pro/solid.js; do not edit by hand.\n'+
    "// Plate-equivalent λ² for sampled coin cross-sections on a grid of volume-equivalent thickness/radius, rim/volume-equivalent\n"+
    "// thickness and ν. Modes (2,0) (0,1) (3,0) (1,1) (4,0) (2,1); data are base64 Uint16 per value, 0 = no admissible cross-section.\n"+
    "const SOLID_TABLE_DATA="+JSON.stringify(result)+";\n";
  fs.writeFileSync(out,text);
  console.log("wrote "+path.relative(root,out)+" ("+(text.length/1024).toFixed(0)+" KB, "+((Date.now()-t0)/1000).toFixed(0)+" s)");
}
