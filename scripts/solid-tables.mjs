// Generates pro/solid-tables.js: plate-equivalent λ² for sampled Morgan dollar cross-sections from the
// axisymmetric 3D solid model in pro/solid.js. Run: node scripts/solid-tables.mjs [--check]
// --check recomputes a few entries and compares them with the committed table instead of writing it.
import fs from "node:fs";import path from "node:path";import os from "node:os";import vm from "node:vm";
import {Worker,isMainThread,parentPort,workerData} from "node:worker_threads";import {fileURLToPath} from "node:url";
const here=fileURLToPath(import.meta.url),root=path.resolve(path.dirname(here),".."),out=path.join(root,"pro","solid-tables.js");
const loadSolid=()=>{const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(root,"pro","solid.js"),"utf8"),ctx);return ctx;};

// Priors are physical ranges, not fitted values; MODEL.md gives the reasoning for each.
// Lengths in mm are divided by the catalogue radius (19.05 mm) to become dimensionless.
const PRIORS={
  s:[0,.16],        // die-basin sagitta per side, mm (0 = flat field; ~0.11 mm for a 50 inch die radius)
  wR:[.025,.06],    // outer rim width / radius
  wD:[.03,.07],     // denticle band width / radius
  fD:[.5,.9],phiD:[.4,.6],     // denticle height (fraction of field depth) and areal fill
  fc:[.4,.9],phic:[.3,.5],rc:[.62,.72], // central device: height fraction (wear lowers it), fill, outer radius
  fL:[.5,.9],phiL:[.2,.4],     // legend and star band 0.74–0.89 of the radius
  betaFrac:[.05,.6],           // in-plane stiffness of smeared relief as a fraction of its fill
  g:[.9,1.3],                  // through-thickness shear modulus / isotropic value (rolling texture)
};
const GRID={hbar:[.10,.115,.13,.145],rim:[1.00,1.05,1.10,1.15,1.20,1.25,1.30],nu:[.34,.37,.40]};
const SAMPLES=40,SEED=20260926,RADIUS_MM=19.05,MESH={perRadius:30,coreLayers:2,topLayers:1},SCALE=1e4;
function mulberry32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function latinHypercube(){
  const rand=mulberry32(SEED),keys=Object.keys(PRIORS),cols=keys.map(()=>{const p=Array.from({length:SAMPLES},(_,i)=>i);for(let i=p.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[p[i],p[j]]=[p[j],p[i]];}return p;});
  return Array.from({length:SAMPLES},(_,i)=>keys.map((k,j)=>{const [lo,hi]=PRIORS[k],u=(cols[j][i]+rand())/SAMPLES;return +(lo+u*(hi-lo)).toFixed(5);}));
}
const keys=Object.keys(PRIORS);
function profileParams(x){
  const v=Object.fromEntries(keys.map((k,i)=>[k,x[i]]));
  return {params:{s:v.s/RADIUS_MM,wR:v.wR,wD:v.wD,fD:v.fD,phiD:v.phiD,fc:v.fc,phic:v.phic,rc:v.rc,fL:v.fL,phiL:v.phiL,beta:v.betaFrac*Math.min(v.phic,v.phiL,v.phiD)},g:v.g};
}
function compute(ctx,x,hbar,rim,nu){
  const {params,g}=profileParams(x);ctx.args={hbar,hR:rim*hbar,params,nu,g,mesh:MESH};
  return vm.runInContext(`(()=>{const p=morganProfile(args.hbar,args.hR,args.params);return p?solidLambda2(p,args.nu,{g:args.g,mesh:args.mesh}):null;})()`,ctx);
}
const jobs=samples=>{const list=[];samples.forEach((x,si)=>GRID.hbar.forEach((h,ih)=>GRID.rim.forEach((r,ir)=>GRID.nu.forEach((v,iv)=>list.push({si,ih,ir,iv,x,h,r,v})))));return list;};

if(!isMainThread){
  const ctx=loadSolid();
  for(const j of workerData)parentPort.postMessage({...j,x:undefined,lam:compute(ctx,j.x,j.h,j.r,j.v)});
  parentPort.close();
}else if(process.argv.includes("--check")){
  const ctx=loadSolid(),table=vm.runInContext(fs.readFileSync(out,"utf8")+";MORGAN_SOLID_TABLE",vm.createContext({}));
  const all=jobs(table.samples),pick=[0,Math.floor(all.length/3),Math.floor(2*all.length/3),all.length-1].map(i=>all[i]);let worst=0;
  for(const j of pick){
    const lam=compute(ctx,j.x,j.h,j.r,j.v),at=((((j.si*GRID.hbar.length+j.ih)*GRID.rim.length+j.ir)*GRID.nu.length+j.iv)*6);
    const stored=table.data.slice(at,at+6).map(v=>v/table.scale);
    if(lam===null){if(stored.some(Boolean))throw Error("Table has values where the model has no admissible shape.");continue;}
    worst=Math.max(worst,...lam.map((v,i)=>Math.abs(stored[i]/v-1)));
  }
  console.log("solid table check: worst relative difference "+worst.toExponential(2));
  if(worst>2e-5)process.exit(1);
}else{
  const samples=latinHypercube(),list=jobs(samples),threads=Math.max(1,Math.min(os.cpus().length,8)),results=new Map();let done=0;const t0=Date.now();
  await Promise.all(Array.from({length:threads},(_,w)=>new Promise((resolve,reject)=>{
    const worker=new Worker(here,{workerData:list.filter((_,i)=>i%threads===w)});
    worker.on("message",m=>{results.set(m.si+","+m.ih+","+m.ir+","+m.iv,m.lam);if(++done%200===0)console.log(done+"/"+list.length+" profiles, "+((Date.now()-t0)/1000).toFixed(0)+" s");});
    worker.on("error",reject);worker.on("exit",resolve);
  })));
  const data=[];
  samples.forEach((_,si)=>GRID.hbar.forEach((_,ih)=>GRID.rim.forEach((_,ir)=>GRID.nu.forEach((_,iv)=>{const lam=results.get(si+","+ih+","+ir+","+iv);for(let m=0;m<6;m++)data.push(lam?Math.round(lam[m]*SCALE):0);}))));
  const text='"use strict";\n// Generated by scripts/solid-tables.mjs from pro/solid.js; do not edit by hand.\n'+
    "// Plate-equivalent λ² for "+SAMPLES+" sampled Morgan dollar cross-sections on a grid of volume-equivalent thickness/radius,\n"+
    "// rim thickness/volume-equivalent thickness and Poisson ratio. Modes: (2,0) (0,1) (3,0) (1,1) (4,0) (2,1). 0 = no admissible shape.\n"+
    "const MORGAN_SOLID_TABLE="+JSON.stringify({model:"morgan-solid-v1",solver:"axisym-solid-fe-v1",mesh:MESH,seed:SEED,radiusMm:RADIUS_MM,priors:PRIORS,keys,grid:GRID,scale:SCALE,samples})
      .replace(/}$/,',data:['+data.join(",")+"]}")+";\n";
  fs.writeFileSync(out,text);
  console.log("wrote "+path.relative(root,out)+" ("+(text.length/1024).toFixed(0)+" KB, "+list.length+" profiles, "+((Date.now()-t0)/1000).toFixed(0)+" s)");
}
