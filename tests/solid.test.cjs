// Experimental 3D solid model (Pro): solver physics, cross-sections, tables, family rules, the catalogue and a real recording.
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
test('cross-sections conserve mass, keep the measured rim and refuse a rim too thin for the mass',()=>{
  run(`globalThis.p=morganProfile(.119,.126)`);
  assert.ok(Math.abs(run('p.hbar')-.119)<1e-9);
  assert.ok(Math.abs(run('Math.max(...p.tt)')-.063)<1e-12);
  assert.ok(run('p.fieldCentre<p.fieldEdge&&p.fieldEdge<.126'));
  assert.equal(run('morganProfile(.119,.110)'),null);
  // Generic family: legend band placed between the device and the border, basin relative to the thickness.
  run(`globalThis.q=coinProfile(.06,.08,{s:.003,wR:.08,wD:.04,rc:.55,rL0:.59,rL1:.86,fc:.6,phic:.4})`);
  assert.ok(Math.abs(run('q.hbar')-.06)<1e-9&&Math.abs(run('Math.max(...q.tt)')-.04)<1e-12);
});
test('solid tables decode, and a lookup at a grid node returns the stored entry',()=>{
  // scripts/solid-tables.mjs --check (run in CI) recomputes entries and off-grid points from the solver.
  for(const name of ['morgan-solid','generic-solid']){
    const t=run(`(()=>{const t=solidTable('${name}'),G=t.grid,si=t.samples.length-1;let found=null;
      for(let ih=0;ih<G.hbar.length&&!found;ih++)for(let ir=0;ir<G.rim.length&&!found;ir++){const e=solidTableEntry(t,si,ih,ir,2);if(e)found={e,got:solidLookup(t,si,G.hbar[ih],G.rim[ir],G.nu[2])};}
      return {found,interpolationError:t.interpolationError,count:t.values.length,expected:t.samples.length*G.hbar.length*G.rim.length*G.nu.length*6,ranges:t.ranges};})()`);
    assert.equal(t.count,t.expected);
    assert.ok(t.found,name+' has admissible entries');
    t.found.e.forEach((v,i)=>{assert.ok(Math.abs(t.found.got[i]/v-1)<1e-9);assert.ok(v>=t.ranges[i][0]-1e-9&&v<=t.ranges[i][1]+1e-9);});
    assert.ok(t.interpolationError>0&&t.interpolationError<2e-3,name+' interpolation error '+t.interpolationError);
  }
});
test('solid family: band, scored modes by support, rim prior, and fakes on the same model',()=>{
  assert.ok(run(`geometryFamily(spec()).valid&&geometryFamily(spec()).source==='solid'&&geometryFamily(spec()).crossSection==='morgan-solid'`));
  assert.equal(run(`JSON.stringify(geometryFamily(spec()).scored)`),'[true,false,true,false,true,true]');
  assert.equal(run(`JSON.stringify(geometryFamily(spec({support:'other'})).scored)`),'[true,true,true,true,true,true]');
  assert.ok(run(`modeEnvelopes(spec())[1].supportAffected&&!modeEnvelopes(spec())[0].supportAffected`));
  // A measured rim narrows the band; unmeasured, the prior is a ratio of the hypothesis's own thickness.
  const measured=run(`geometryFamily(spec({rimThickness:2.4}))`),prior=run(`geometryFamily(spec())`);
  assert.ok(measured.high-measured.low<prior.high-prior.low);
  assert.ok(measured.candidates.every(g=>g.rim>=2.37-1e-9&&g.rim<=2.43+1e-9));
  assert.ok(Math.abs(prior.rims[0]/prior.h-1.034)<1e-9&&Math.abs(prior.rims[1]/prior.h-1.254)<1e-9);
  // Fakes use the coin's model; with a measured rim a thicker fake has no cross-section, so calipers catch it.
  assert.ok(run(`constructionScreen(spec()).rows.every(r=>r.band.source==='solid')`));
  assert.ok(run(`constructionScreen(spec({rimThickness:2.4})).rows.filter(r=>r.core==='brass').every(r=>!r.band.valid)`));
  // Outside the tables the family is invalid with a reason, never extrapolated.
  const outside=run(`geometryFamily(spec({nu:.25}))`);assert.equal(outside.valid,false);assert.match(outside.reason,/outside the solid model/);
  const thick=run(`geometryFamily(spec({rho:4}))`);assert.equal(thick.valid,false);assert.match(thick.reason,/thicker than the solid model/);
  // The thin-plate family is unchanged when the solid model is not selected.
  assert.equal(run(`geometryFamily(spec({plateModel:'plate'})).source`),'model');
  assert.equal(run(`geometryFamily(spec({plateModel:'plate'})).candidates.length`),21);
});
test('every catalogue coin has a solid band, a construction screen and a sound analysis floor',()=>{
  const rows=run(`flat.map(c=>{const a=ALLOYS[c.a],s={name:c.n,key:c.a,mass:c.m,dia:c.d,rho:rhoOf(c.a),E:a.E,nu:a.nu,support:'centre',rimThickness:0,plateModel:c.solid||'generic-solid',family:{...FAMILY_DEFAULTS}};
    const f=geometryFamily(s),scr=constructionScreen(s),floor=analysisFloor(s),bands=[scr.genuine,...scr.rows.map(r=>r.band)].filter(b=>b.valid);
    return {n:c.n,valid:f.valid,cross:f.crossSection,floor:floor.hz,lowest:Math.min(...bands.map(b=>b.low)),ratio:floor.secondModeRatio,rows:scr.rows.length};})`);
  assert.equal(rows.length,105);
  for(const r of rows){
    assert.ok(r.valid,r.n);
    assert.equal(r.cross,/^Morgan/.test(r.n)?'morgan-solid':'generic-solid');
    // Every modelled lowest mode is at least a second-mode ratio above the floor (MODEL.md, "Analysis floor").
    assert.ok(r.floor>0&&r.floor*r.ratio<=r.lowest*(1+1e-9),r.n);
  }
});
test('sampled cross-sections of very different coins fit as model consistent under the solid model',()=>{
  for(const name of ['Krugerrand','Dime 90%','4 Ducat','Crown · sterling']){
    const res=run(`(()=>{const c=flat.find(x=>x.n.startsWith(${JSON.stringify(name)})),a=ALLOYS[c.a],s={name:c.n,key:c.a,mass:c.m,dia:c.d,rho:rhoOf(c.a),E:a.E,nu:a.nu,support:'centre',rimThickness:0,plateModel:c.solid||'generic-solid',family:{...FAMILY_DEFAULTS}};
      const f=geometryFamily(s),g=f.candidates[Math.floor(f.candidates.length/2)],x=.02,modes=[0,2,4].map(i=>g.f[i]).filter(v=>v<20000);
      const e=screenReading(readingOf([g.f[0]*Math.sqrt(1-x),g.f[0]*Math.sqrt(1+x),...modes.slice(1)]),s,true,3);return {d:e.diagnostic,reason:e.reason,n:modes.length};})()`);
    if(res.n>=2)assert.equal(res.d,'model-consistent',name+': '+res.reason);
  }
});
test('a sampled cross-section with a split lowest mode is model consistent; shifted upper modes are not',()=>{
  run(`globalThis.g=(f=>f.candidates[Math.floor(f.candidates.length/2)])(geometryFamily(spec()));globalThis.split=(f,x)=>[f*Math.sqrt(1-x),f*Math.sqrt(1+x)];`);
  // (2,0) split 2.8% in ω² around the model value, as rolling texture or relief splits it; (3,0) and (4,0) exact.
  const good=run(`screenReading(readingOf([...split(g.f[0],.028),g.f[2],g.f[4]]),spec(),true,3)`);
  assert.equal(good.diagnostic,'model-consistent',good.reason);
  assert.ok(Math.abs(good.fit.best.matches[0].measured/(good.fit.best.matches[0].predicted*good.fit.best.scale)-1)<.002);
  // The family's (3,0)/(2,0) spread under the rim prior, plus the 3% tolerance, still excludes shifts this large.
  const bad=run(`screenReading(readingOf([...split(g.f[0],.028),g.f[2]*1.12,g.f[4]*1.15]),spec(),true,3)`);
  assert.notEqual(bad.diagnostic,'model-consistent');
  // Under a centre support a (0,1) tone is explained by its widened envelope but never counted as a fitted mode.
  const withAxisymmetric=run(`screenReading(readingOf([...split(g.f[0],.028),g.f[1]*1.03,g.f[2],g.f[4]]),spec(),true,3)`);
  assert.equal(withAxisymmetric.diagnostic,'model-consistent');
  assert.ok(withAxisymmetric.fit.best.matches.every(m=>m.mode!==1&&m.mode!==3));
});

test('two-mode fits: the solid model tests the (3,0)/(2,0) ratio at 1%; an overtone cannot stand in for a mode',()=>{
  run(`globalThis.byRatio=geometryFamily(spec()).candidates.slice().sort((a,b)=>a.f[2]/a.f[0]-b.f[2]/b.f[0]);`);
  const verdict=f=>run(`screenReading(readingOf(${JSON.stringify(f)}),spec(),true,3)`);
  const lo=run('byRatio[0].f'),hi=run('byRatio.at(-1).f');
  for(const g of [lo,hi])assert.equal(verdict([g[0],g[2]]).diagnostic,'model-consistent');
  const fit=verdict([hi[0],hi[2]*1.005]);
  assert.equal(fit.diagnostic,'model-consistent');assert.equal(fit.fit.tolerance,.01);
  // 2% outside the family's ratio range: consistent under the old 3% tolerance, not under 1%.
  for(const f of [[hi[0],hi[2]*1.02],[lo[0],lo[2]*.98]])assert.notEqual(verdict(f).diagnostic,'model-consistent',JSON.stringify(f));
  assert.equal(run(`screenReading(readingOf(${JSON.stringify([hi[0],hi[2]*1.02])}),spec({family:{...FAMILY_DEFAULTS,solidFitPct:3}}),true,3).diagnostic`),'model-consistent');
  // A lone (2,0) with a tone at exactly 4× it: that could be the strike's overtone rather than the (4,0).
  assert.notEqual(verdict([lo[0],lo[0]*4]).diagnostic,'model-consistent');
});
test('solid model: the lowest pair groups up to 6% apart, identically for the coin and its fakes; upper tones keep 3%',()=>{
  run(`globalThis.rouble=flat.find(c=>c.n.startsWith('1 Rouble 1886'));globalThis.rspec=(extra={})=>spec({name:rouble.n,key:rouble.a,mass:rouble.m,dia:rouble.d,rho:rhoOf(rouble.a),E:ALLOYS[rouble.a].E,nu:ALLOYS[rouble.a].nu,plateModel:'generic-solid',...extra});`);
  // Rouble A of the first battery: (2,0) pair 3.9% apart, (3,0) at 12.15 kHz.
  const r='readingOf([5213,5420,12150])';
  assert.equal(run(`modalFamilies(${r},rspec()).length`),2);
  assert.ok(Math.abs(run(`familyObservations(${r},rspec())[0].f`)-Math.sqrt((5213**2+5420**2)/2))<5);
  // The thin-plate model and Lite keep the 3% grouping.
  assert.equal(run(`modalFamilies(${r},rspec({plateModel:'plate'})).length`),3);
  assert.equal(run(`modalFamilies(${r}).length`),3);
  // Above the lowest family two tones 4% apart stay separate.
  assert.equal(run(`modalFamilies(readingOf([5238,12090,12090*1.04]),rspec()).length`),3);
  // Fakes and other alloys share the coin's family indices, which the construction screen relies on.
  assert.ok(run(`constructionScreen(rspec()).rows.every(row=>JSON.stringify(modalFamilies(${r},row.spec).map(f=>f.frequencies))===JSON.stringify(modalFamilies(${r},rspec()).map(f=>f.frequencies)))`));
});
test('first battery (screenshot readings, about ±15 Hz): seven genuine coins are model consistent in the solid model',()=>{
  // Pocket Pinger, centre grip. Extra peaks as read from the spectra, including sum tones of the split pair.
  const coins=[['Morgan A','Morgan',[4369,4480,10132,17550],3],['Morgan B (M06)','Morgan',[4252,4376,9961,17330],2],['Morgan C','Morgan',[4343,4389,10047,17420],2],
    ['Rouble A','1 Rouble 1886',[5213,5420,12150],2],['Rouble B','1 Rouble 1886',[5190,5285,10470,12090,12800,15650,17920],2],
    ['Rouble C','1 Rouble 1886',[5136,5345,9380,10480,10720,12030,12800,15870,16940],2],['50 kopek','50 Kopeks 1896',[6380,6560,11600,12950,13140,14890],2]];
  for(const [label,name,f,modes] of coins){
    const e=run(`(()=>{const c=flat.find(x=>x.n.startsWith(${JSON.stringify(name)})),a=ALLOYS[c.a],s=spec({name:c.n,key:c.a,mass:c.m,dia:c.d,rho:rhoOf(c.a),E:a.E,nu:a.nu,plateModel:c.solid||'generic-solid'}),e=screenReading(readingOf(${JSON.stringify(f)}),s,true,3);return {title:resultTitle(e,true),modes:e.fit.best.matches.length,reason:e.reason};})()`);
    assert.equal(e.title,'Model consistent',label+': '+e.reason);
    // Morgans B and C: the (4,0) sits within 0.8% of 4× the (2,0), so it is not counted.
    assert.equal(e.modes,modes,label);
  }
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
test('real Morgan (M06, 25.81 g, 37.7 mm, rim 2.40 mm, Pocket Pinger): both models fit two modes; the solid model also places the (4,0)',async()=>{
  const dir=path.join(__dirname,'fixtures/morgan-m06'),files=[1,2,3].map(t=>path.join(dir,'tap-'+t+'.wav'));
  const evaluate=async c=>{const strikes=[];for(const f of files)strikes.push(await analyseFile(f,c));ctx.strikes=strikes;ctx.c=c;return run(`(()=>{const r=summarizeStrikes(strikes,3),e=screenReading(r,c,true,3);return {r,e,title:resultTitle(e,true)};})()`);};
  const plate=await evaluate(run(`spec({mass:25.81,dia:37.7,rimThickness:2.4,plateModel:'plate'})`));
  assert.equal(plate.title,'Model consistent',plate.e.reason);
  assert.equal(plate.e.fit.matchedModeCount,2);
  assert.match(plate.e.reason,/two distinct modes, including it, fit one shape within 3%/);
  assert.ok(plate.r.strikes.every(s=>!s.peaks.some(p=>p.f>15000)),'the standard detector is unchanged');
  const solid=await evaluate(run(`spec({mass:25.81,dia:37.7,rimThickness:2.4})`));
  assert.equal(solid.title,'Model consistent',solid.e.reason);
  // The (4,0) mode near 17.3 kHz decays in ~0.1 s and is found by the early-window scan in every tap.
  assert.ok(solid.r.strikes.every(s=>s.peaks.some(p=>p.early&&Math.abs(p.f/17310-1)<.005)));
  assert.match(solid.e.reason,/two distinct modes, including it, fit one shape within 1%/);
  assert.equal(JSON.stringify(solid.e.fit.best.matches.map(m=>m.mode)),'[0,2]');
  assert.ok(solid.e.fit.best.matches.every(m=>Math.abs(m.measured/(m.predicted*solid.e.fit.best.scale)-1)<.005));
  // At 4.02× the (2,0) that tone is also within 0.8% of its 4th harmonic, so it is shown but never counted;
  // several of the fitted shapes still predict it within 0.5%.
  const h4=solid.e.fingerprint.families.find(f=>Math.abs(f.centre/17310-1)<.005);
  assert.equal(h4.harmonicOrder,4);
  assert.ok(solid.e.fit.supported.some(x=>Math.abs(h4.centre/(x.geometry.f[4]*x.scale)-1)<.005));
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
