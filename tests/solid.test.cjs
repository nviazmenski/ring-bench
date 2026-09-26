// Experimental 3D solid model (Pro): solver physics, Morgan cross-section, tables, family rules and a real recording.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const ctx=vm.createContext({console});
for(const f of ['shared/coins','shared/model','pro/solid','pro/solid-tables','shared/geometry','shared/constructions','shared/acoustics','shared/references'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f+'.js'),'utf8'),ctx);
const run=s=>vm.runInContext(s,ctx);
run(`globalThis.morgan=flat.find(c=>c.n.startsWith('Morgan'));
globalThis.spec=(extra={})=>({name:morgan.n,key:morgan.a,mass:morgan.m,dia:morgan.d,rho:rhoOf(morgan.a),E:ALLOYS[morgan.a].E,nu:ALLOYS[morgan.a].nu,qmat:2000,sup:'tongs-rubber',hmm:0,rimThickness:0,plateModel:morgan.solid,support:'centre',family:{...FAMILY_DEFAULTS},...extra});
globalThis.readingOf=(frequencies,count=3)=>({f0:frequencies[0],spread:0,usableHz:21600,complete:true,settings:{},strikes:Array.from({length:count},(_,j)=>({f0:frequencies[0],offwindow:false,when:new Date(1700000000000+j*2000).toISOString(),peaks:frequencies.map(f=>({f:f*(1+.0005*(j-1)),snrDb:30,mag:1}))}))});`);

test('solid solver reaches the thin-plate limit for every tracked mode',()=>{
  // h/a = 0.005: the 3D solution must converge to the free Kirchhoff plate (lam2, a separately validated Bessel fit).
  for(const nu of [.3,.37]){
    const lam=run(`solidLambda2({rb:[0,1],tc:[.0015,.0015],tt:[.0025,.0025],mats:[[1,1,1]]},${nu},{mesh:{perRadius:40}})`);
    lam.forEach((v,i)=>assert.ok(Math.abs(v/run(`lam2(${i},${nu})`)-1)<5e-4,'mode '+i+' at nu '+nu+': '+v));
  }
});
test('solid solver matches an independent spectral 3D solution for thick discs',()=>{
  // Reference: Legendre-in-r² Ritz solution of 3D elasticity with exact axis regularity (research/solid/ritz3d.py),
  // sharing no code with the finite-element solver. Modes (2,0) (0,1) (3,0) (1,1) (4,0) (2,1), ν = 0.37.
  const ritz={.12:[5.021391,8.953428,11.468869,19.491423,19.709393,32.184201],.24:[4.808983,8.440286,10.519132,17.224837,17.272173,26.788969]};
  for(const [h,ref] of Object.entries(ritz)){
    const lam=run(`solidLambda2({rb:[0,1],tc:[${h/3},${h/3}],tt:[${h/2},${h/2}],mats:[[1,1,1]]},.37)`);
    lam.forEach((v,i)=>assert.ok(Math.abs(v/ref[i]-1)<5e-5,'h/a '+h+' mode '+i+': '+v+' vs '+ref[i]));
  }
  // Thin-plate theory overpredicts a Morgan-thickness disc, more for higher modes: the bias this model removes.
  const bias=run(`solidLambda2({rb:[0,1],tc:[.04,.04],tt:[.06,.06],mats:[[1,1,1]]},.37).map((v,i)=>lam2(i,.37)/v-1)`);
  assert.ok(bias[0]>.018&&bias[0]<.024&&bias[2]>.038&&bias[2]<.046&&bias[4]>.06&&bias[4]<.07,JSON.stringify(bias));
});
test('Morgan cross-section conserves mass, keeps the measured rim and refuses a rim too thin for the mass',()=>{
  run(`globalThis.p=morganProfile(.119,.126)`);
  assert.ok(Math.abs(run('p.hbar')-.119)<1e-9);
  assert.ok(Math.abs(run('Math.max(...p.tt)')-.063)<1e-12);
  assert.ok(run('p.fieldCentre<p.fieldEdge&&p.fieldEdge<.126'));
  assert.equal(run('morganProfile(.119,.110)'),null);
});
test('committed solid tables match the solver',()=>{
  // Two entries recomputed from scratch; scripts/solid-tables.mjs --check does the same outside the test suite.
  for(const [si,ih,ir,iv] of [[0,1,1,1],[39,2,3,0]]){
    const at=run(`(()=>{const T=MORGAN_SOLID_TABLE,G=T.grid,x=T.samples[${si}],v=Object.fromEntries(T.keys.map((k,i)=>[k,x[i]]));
      const params={s:v.s/T.radiusMm,wR:v.wR,wD:v.wD,fD:v.fD,phiD:v.phiD,fc:v.fc,phic:v.phic,rc:v.rc,fL:v.fL,phiL:v.phiL,beta:v.betaFrac*Math.min(v.phic,v.phiL,v.phiD)};
      const p=morganProfile(G.hbar[${ih}],G.rim[${ir}]*G.hbar[${ih}],params),lam=p&&solidLambda2(p,G.nu[${iv}],{g:v.g,mesh:T.mesh});
      const k=((((${si}*G.hbar.length+${ih})*G.rim.length+${ir})*G.nu.length+${iv})*6);return {lam,stored:T.data.slice(k,k+6).map(x=>x/T.scale)};})()`);
    assert.ok(at.lam,'entry must be admissible');
    at.lam.forEach((v,i)=>assert.ok(Math.abs(at.stored[i]/v-1)<2e-5,si+' mode '+i));
  }
});
test('solid family: band, scored modes by support, and fakes stay on the thin plate',()=>{
  assert.ok(run(`geometryFamily(spec()).valid&&geometryFamily(spec()).source==='solid'`));
  assert.equal(run(`JSON.stringify(geometryFamily(spec()).scored)`),'[true,false,true,false,true,true]');
  assert.equal(run(`JSON.stringify(geometryFamily(spec({support:'other'})).scored)`),'[true,true,true,true,true,true]');
  assert.ok(run(`modeEnvelopes(spec())[1].supportAffected&&!modeEnvelopes(spec())[0].supportAffected`));
  // A measured rim narrows the band; the catalogue prior spans 2.35–2.85 mm.
  const measured=run(`geometryFamily(spec({rimThickness:2.4}))`),prior=run(`geometryFamily(spec())`);
  assert.ok(measured.high-measured.low<prior.high-prior.low);
  assert.ok(measured.candidates.every(g=>g.rim>=2.37-1e-9&&g.rim<=2.43+1e-9));
  assert.ok(run(`constructionScreen(spec()).rows.every(r=>r.band.source==='model')`));
  // Outside the tables the family is invalid with a reason, never extrapolated.
  const outside=run(`geometryFamily(spec({nu:.30}))`);assert.equal(outside.valid,false);assert.match(outside.reason,/outside the solid model/);
  // The thin-plate family is unchanged when the solid model is not selected.
  assert.equal(run(`geometryFamily(spec({plateModel:'plate'})).source`),'model');
  assert.equal(run(`geometryFamily(spec({plateModel:'plate'})).candidates.length`),21);
});
test('a sampled cross-section with a split lowest mode is model consistent; shifted upper modes are not',()=>{
  run(`globalThis.g=geometryFamily(spec()).candidates[40];globalThis.split=(f,x)=>[f*Math.sqrt(1-x),f*Math.sqrt(1+x)];`);
  // (2,0) split 2.8% in ω² around the model value, as rolling texture or relief splits it; (3,0) and (4,0) exact.
  const good=run(`screenReading(readingOf([...split(g.f[0],.028),g.f[2],g.f[4]]),spec(),true,3)`);
  assert.equal(good.diagnostic,'model-consistent',good.reason);
  assert.ok(Math.abs(good.fit.best.matches[0].measured/(good.fit.best.matches[0].predicted*good.fit.best.scale)-1)<.002);
  // The family spans (3,0)/(2,0) 2.29–2.42 under the catalogue rim prior, and the fit adds its 3% tolerance.
  const bad=run(`screenReading(readingOf([...split(g.f[0],.028),g.f[2]*1.12,g.f[4]*1.15]),spec(),true,3)`);
  assert.notEqual(bad.diagnostic,'model-consistent');
  // Under a centre support a (0,1) tone is explained by its widened envelope but never counted as a fitted mode.
  const withAxisymmetric=run(`screenReading(readingOf([...split(g.f[0],.028),g.f[1]*1.03,g.f[2],g.f[4]]),spec(),true,3)`);
  assert.equal(withAxisymmetric.diagnostic,'model-consistent');
  assert.ok(withAxisymmetric.fit.best.matches.every(m=>m.mode!==1&&m.mode!==3));
});

function readWav(file){
  const b=fs.readFileSync(file);let o=12,fmt,data;
  while(o<b.length){const id=b.toString('ascii',o,o+4),n=b.readUInt32LE(o+4);if(id==='fmt ')fmt={ch:b.readUInt16LE(o+10),sr:b.readUInt32LE(o+12)};if(id==='data')data=b.subarray(o+8,o+8+n);o+=8+n+(n&1);}
  const x=new Float32Array(data.length/2/fmt.ch);for(let i=0;i<x.length;i++)x[i]=data.readInt16LE(i*2*fmt.ch)/32768;return {x,sr:fmt.sr};
}
// The app's upload path: find the strike, keep 60 ms before it and 0.6 s after.
async function analyseFile(file,c){
  const {x,sr}=readWav(file),W=Math.floor(.002*sr);let max=0,at=0;
  for(let i=0;i+W<=x.length;i+=W){let s=0;for(let k=0;k<W;k++)s+=x[i+k]**2;if(s>max){max=s;at=i;}}
  while(at>=W){let s=0;for(let k=0;k<W;k++)s+=x[at-W+k]**2;if(s<max*.01)break;at-=W;}
  const pre=Math.ceil(.06*sr);ctx.args={seg:x.slice(at-pre,at+Math.ceil(.6*sr)),sr,pre,c};
  return run(`analyseInner(args.seg,args.sr,args.c,{triggerDb:18,skipMs:8,crestDb:26,analysisFloorHz:analysisFloor(args.c).hz,upperScan:args.c.plateModel!=='plate'},{kind:'file',contextRate:args.sr,trackRate:null},args.pre)`);
}
test('real Morgan (M06, 25.81 g, 37.7 mm, rim 2.40 mm, Pocket Pinger): thin plate needs a third mode, the solid model fits three',async()=>{
  const dir=path.join(__dirname,'fixtures/morgan-m06'),files=[1,2,3].map(t=>path.join(dir,'tap-'+t+'.wav'));
  const evaluate=async c=>{const strikes=[];for(const f of files)strikes.push(await analyseFile(f,c));ctx.strikes=strikes;ctx.c=c;return run(`(()=>{const r=summarizeStrikes(strikes,3),e=screenReading(r,c,true,3);return {r,e,title:resultTitle(e,true)};})()`);};
  const plate=await evaluate(run(`spec({mass:25.81,dia:37.7,rimThickness:2.4,plateModel:'plate'})`));
  assert.equal(plate.title,'Primary frequency in band');
  assert.equal(plate.e.fit.matchedModeCount,2);
  assert.ok(plate.r.strikes.every(s=>!s.peaks.some(p=>p.f>15000)),'the standard detector is unchanged');
  const solid=await evaluate(run(`spec({mass:25.81,dia:37.7,rimThickness:2.4})`));
  assert.equal(solid.title,'Model consistent',solid.e.reason);
  // The (4,0) mode near 17.3 kHz decays in ~0.1 s and is found by the early-window scan in every tap.
  assert.ok(solid.r.strikes.every(s=>s.peaks.some(p=>p.early&&Math.abs(p.f/17310-1)<.005)));
  assert.equal(JSON.stringify(solid.e.fit.best.matches.map(m=>m.mode)),'[0,2,4]');
  assert.ok(solid.e.fit.best.matches.every(m=>Math.abs(m.measured/(m.predicted*solid.e.fit.best.scale)-1)<.005));
  assert.ok(Math.abs(solid.e.primary.family.centre-4307.6)<1);
});
test('the early-window scan finds fast upper modes but never adds a tone below 1.4× the lowest kept tone',async()=>{
  const sr=48000,pre=Math.ceil(.06*sr),n=pre+Math.ceil(.6*sr),x=new Float32Array(n);let seed=7;
  const noise=()=>{seed=(seed*16807)%2147483647;return seed/2147483647-.5;};
  for(let i=0;i<n;i++){x[i]=2e-5*noise();if(i<pre)continue;const t=(i-pre)/sr;
    x[i]+=.3*Math.exp(-t/1)*Math.sin(2*Math.PI*4300*t)+.02*Math.exp(-t/.07)*Math.sin(2*Math.PI*17300*t)+.2*Math.exp(-t/.05)*Math.sin(2*Math.PI*2100*t)+(t<.001?.5*noise():0);}
  const analyse=upperScan=>{ctx.args={x,sr,pre,upperScan};return run(`analyseInner(args.x,args.sr,spec(),{triggerDb:18,skipMs:8,crestDb:26,analysisFloorHz:800,upperScan:args.upperScan},{kind:'file'},args.pre)`);};
  const plain=await analyse(false),scanned=await analyse(true);
  assert.ok(!plain.peaks.some(p=>Math.abs(p.f-17300)<50),'below the 42 dB threshold over the full ring');
  assert.ok(scanned.peaks.some(p=>p.early&&Math.abs(p.f-17300)<20));
  assert.ok(!scanned.peaks.some(p=>p.early&&p.f<1.4*4300));
  assert.equal(scanned.f0,plain.f0);
});
