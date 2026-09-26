const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const ctx=vm.createContext({console});
for(const name of ['coins','model','geometry','constructions','acoustics','references'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../shared/'+name+'.js'),'utf8'),ctx);
const run=s=>vm.runInContext(s,ctx),plain=s=>JSON.parse(run('JSON.stringify('+s+')'));
run(`globalThis.spec=name=>{const coin=flat.find(c=>c.n.startsWith(name)),a=ALLOYS[coin.a];return {name:coin.n,key:coin.a,mass:coin.m,dia:coin.d,rho:rhoOf(coin.a),E:a.E,nu:a.nu,family:{...FAMILY_DEFAULTS}};};
globalThis.makeReading=(frequencies,count=2)=>({f0:frequencies[0],spread:0,usableHz:22000,complete:true,strikes:Array.from({length:count},(_,j)=>({f0:frequencies[0],offwindow:false,when:new Date(1700000000000+j*2000).toISOString(),peaks:frequencies.map(f=>({f,snrDb:30}))}))});
globalThis.row=(screen,id)=>screen.rows.find(r=>r.id===id);
globalThis.centre=band=>Math.sqrt(band.low*band.high);
globalThis.krugerrand=spec('Krugerrand');globalThis.sovereign=spec('Sovereign');globalThis.morgan=spec('Morgan');`);

test('cyclic Jacobi returns exact eigenvalues of known symmetric matrices',()=>{
  assert.deepEqual(plain(`symmetricEigenvalues([[2,1],[1,2]]).map(v=>Math.round(v*1e12)/1e12)`),[1,3]);
  // Tridiagonal (−1, 2, −1): eigenvalues 2 − 2cos(kπ/(n+1)).
  assert.ok(run(`(()=>{const n=8,A=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?2:Math.abs(i-j)===1?-1:0));
    const got=symmetricEigenvalues(A),want=Array.from({length:n},(_,k)=>2-2*Math.cos((k+1)*Math.PI/(n+1))).sort((a,b)=>a-b);
    return got.every((v,i)=>Math.abs(v-want[i])<1e-12);})()`));
});
test('laminate reduces to its layers at the limits and weights faces by bending share',()=>{
  run(`globalThis.face={rho:17.5,E:80,nu:.42};globalThis.core={rho:18.15,E:355,nu:.28};`);
  assert.ok(run(`(()=>{const a=laminate(face,core,0),b=laminate(face,core,1);return Math.abs(a.E-core.E)<1e-9&&Math.abs(a.nu-core.nu)<1e-12&&Math.abs(a.rho-core.rho)<1e-12&&Math.abs(b.E-face.E)<1e-9&&Math.abs(b.nu-face.nu)<1e-12;})()`));
  // Faces of 20% of the thickness carry 1 − 0.8³ = 48.8% of the second moment.
  assert.ok(run(`(()=>{const l=laminate(face,core,.2),s=l.stiffnessShare;return Math.abs(s.face+s.core-1)<1e-12&&l.E<core.E&&l.E>face.E&&Math.abs(l.rho-(.2*face.rho+.8*core.rho))<1e-12;})()`));
  assert.ok(run(`(()=>{const same=laminate(face,face,.37);return Math.abs(same.E-face.E)<1e-9&&Math.abs(same.nu-face.nu)<1e-12;})()`));
});
test('clad presets are layered: stiff faces raise US clad, soft faces lower 40% silver',()=>{
  // Faces carry a third of the mass; with near-equal densities that is about a third of the thickness.
  assert.ok(run(`Math.abs(ALLOYS.usclad.layers.faceThickness-1/3)<.005&&ALLOYS.usclad.E>ALLOYS.copper.E&&ALLOYS.usclad.E<ALLOYS.cuni75.E`));
  // The mass-weighted mix of the layers still reproduces the nominal 40% silver.
  assert.ok(run(`Math.abs(.8*ALLOYS.ag400.layers.faceMass+.209*(1-ALLOYS.ag400.layers.faceMass)-.4)<1e-9&&ALLOYS.ag400.E<ALLOYS.ag800.E+10`));
  assert.ok(run(`ALLOYS.usclad.E>125&&ALLOYS.ag400.E<98`));
});
test('handbook ranges become a midpoint and a ± percentage that span them exactly',()=>{
  for(const [k,lo,hi] of [['tungsten',300,411],['brass',100,117],['leadTin',14,45]]){
    assert.ok(Math.abs(run(`ALLOYS.${k}.E*(1-ALLOYS.${k}.ePct/100)`)-lo)<1e-9);
    assert.ok(Math.abs(run(`ALLOYS.${k}.E*(1+ALLOYS.${k}.ePct/100)`)-hi)<1e-9);
  }
  assert.ok(Math.abs(run(`rhoOf('tungsten')*(1+ALLOYS.tungsten.rhoPct/100)`)-19.3)<1e-9);
});
test('gold: tungsten rings about twice as high, underfine overlaps, full-weight brass Krugerrand is too thick',()=>{
  run(`globalThis.k=constructionScreen(krugerrand)`);
  assert.equal(run(`k.rows.length`),5);
  assert.equal(run(`row(k,'tungsten').separation.state`),'separated');
  assert.ok(run(`row(k,'tungsten').separation.margin>.3&&centre(row(k,'tungsten').band)/centre(k.genuine)>1.8`));
  assert.equal(run(`row(k,'underfine').separation.state`),'overlaps');
  assert.equal(run(`row(k,'brass').separation.state`),'no-shape');
  assert.ok(run(`row(k,'brass').thickness>1.9`));
  // The smaller Sovereign stays inside the thin-plate model even as a brass copy.
  assert.equal(run(`row(constructionScreen(sovereign),'brass').separation.state`),'separated');
});
test('shell limit is the thickest gold shell whose band still clears the genuine band',()=>{
  run(`globalThis.s=row(constructionScreen(krugerrand),'tungsten-shell');globalThis.g=geometryFamily(krugerrand);globalThis.con=s.con;`);
  assert.equal(run(`s.separation.state`),'thin-shells');
  const x=run(`s.separation.faceThickness`);assert.ok(x>.2&&x<.7,String(x));
  assert.ok(run(`geometryFamily(constructionSpec(krugerrand,con,${x}-.002)).low>=g.high`));
  assert.ok(run(`geometryFamily(constructionSpec(krugerrand,con,${x}+.002)).low<g.high`));
  // A full shell is the genuine alloy again.
  assert.ok(run(`Math.abs(geometryFamily(constructionSpec(krugerrand,con,1)).low/g.low-1)<.01`));
});
test('silver: density-matched molybdenum and base metals separate; fineness does not',()=>{
  run(`globalThis.m=constructionScreen(morgan)`);
  for(const id of ['molybdenum','brass','copper','nickel-silver','zinc','steel'])assert.equal(run(`row(m,'${id}').separation.state`),'separated',id);
  assert.equal(run(`row(m,'underfine').separation.state`),'overlaps');
  assert.equal(run(`row(m,'steel').magnetic`),true);
  assert.ok(run(`row(m,'brass').thickness>1.1`));
});
test('base-metal and clad coins list no constructions',()=>{
  assert.equal(run(`constructionScreen(spec('Crown · cupronickel')).rows.length`),0);
  assert.equal(run(`constructionScreen(spec('Half Dollar 40% clad')).rows.length`),0);
});
test('a genuine-centred reading rules out plated tungsten and brass but not underfine gold or a thick shell',()=>{
  run(`globalThis.rs=screenConstructions(makeReading([centre(geometryFamily(sovereign))]),sovereign,2)`);
  assert.equal(run(`rs.reading.state`),'repeatable');
  assert.equal(run(`row(rs,'tungsten').match.status`),'ruled-out');
  assert.equal(run(`row(rs,'tungsten').match.direction`),'higher');
  assert.equal(run(`row(rs,'brass').match.status`),'ruled-out');
  assert.equal(run(`row(rs,'underfine').match.status`),'possible');
  assert.equal(run(`row(rs,'tungsten-shell').match.status`),'thick-shells');
  assert.ok(run(`row(rs,'tungsten-shell').match.faceThickness[0]>row(rs,'tungsten-shell').separation.faceThickness`));
  assert.equal(run(`row(rs,'tungsten-shell').match.faceThickness[1]`),1);
});
test('a reading in the tungsten band fits plated tungsten and thin shells, not genuine or underfine gold',()=>{
  run(`globalThis.f=centre(row(constructionScreen(sovereign),'tungsten').band);globalThis.rt=screenConstructions(makeReading([f]),sovereign,2)`);
  assert.equal(run(`bandPosition(f,geometryFamily(sovereign))`),'anomalous');
  assert.equal(run(`row(rt,'tungsten').match.status`),'possible');
  assert.equal(run(`row(rt,'underfine').match.status`),'ruled-out');
  assert.equal(run(`row(rt,'tungsten-shell').match.status`),'possible');
  assert.ok(run(`row(rt,'tungsten-shell').match.faceThickness[1]<row(constructionScreen(sovereign),'tungsten-shell').separation.faceThickness`));
});
test('no reading-level result before the required taps or without a repeatable lowest tone',()=>{
  assert.equal(run(`screenConstructions(makeReading([5000],1),sovereign,2).reading`),null);
  run(`globalThis.odd=makeReading([5000]);odd.strikes[1].peaks=[{f:5200,snrDb:30}];odd.strikes[1].f0=5200;`);
  assert.equal(run(`screenConstructions(odd,sovereign,2).reading.state`),'not-repeatable');
  assert.ok(run(`screenConstructions(odd,sovereign,2).rows.every(r=>r.match.status==='unknown')`));
});
test('a construction that rings lower stays possible only when the tones fit it as upper modes',()=>{
  // A soft hypothetical material: its lowest mode sits well below the reading.
  run(`globalThis.soft={...morgan,key:'soft',E:morgan.E*.3};globalThis.sb=geometryFamily(soft);globalThis.cand=sb.candidates[0];
    globalThis.upper=cand.f.slice().sort((a,b)=>a-b).slice(1,4);`);
  assert.ok(run(`upper[0]>sb.high*(1+sb.edge)`),'precondition: the upper-mode tones are above the soft band');
  run(`globalThis.rd=makeReading(upper,3);globalThis.pr=primaryResonanceEvidence(acousticFingerprint(rd,morgan));`);
  assert.deepEqual(plain(`constructionMatch(rd,soft,pr)`),{status:'possible',position:'upper-modes'});
  run(`globalThis.lone=makeReading([upper[0]],3);globalThis.pl=primaryResonanceEvidence(acousticFingerprint(lone,morgan));`);
  assert.deepEqual(plain(`constructionMatch(lone,soft,pl)`),{status:'ruled-out',direction:'lower'});
});
test('exports carry plain construction results',()=>{
  const out=JSON.parse(run(`JSON.stringify(constructionExport(screenConstructions(makeReading([centre(geometryFamily(sovereign))]),sovereign,2)))`));
  assert.equal(out.model,'construction-screen-v1');
  assert.equal(out.rows.length,5);
  assert.ok(out.rows.every(r=>!('spec' in r)&&!('candidates' in r)));
  assert.equal(out.rows.find(r=>r.id==='tungsten').match.status,'ruled-out');
  assert.equal(out.rows.find(r=>r.id==='tungsten').band.length,2);
});
