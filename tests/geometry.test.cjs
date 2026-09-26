const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const ctx=vm.createContext({console});
for(const name of ['coins','model','geometry','acoustics','references'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../shared/'+name+'.js'),'utf8'),ctx);
const run=s=>vm.runInContext(s,ctx);
run(`globalThis.coin=flat.find(c=>c.n.startsWith('2 Dinara'));globalThis.c={name:coin.n,key:coin.a,mass:coin.m,dia:coin.d,rho:rhoOf(coin.a),E:ALLOYS[coin.a].E,nu:ALLOYS[coin.a].nu,qmat:2000,sup:'finger'};
globalThis.makeReading=(frequencies,count=3)=>({f0:frequencies[0],spread:0,usableHz:22000,complete:true,settings:{coin:c.name,alloy:c.key,mass:c.mass,diameter:c.dia},strikes:Array.from({length:count},(_,j)=>({f0:frequencies[0],offwindow:false,when:new Date(1700000000000+j*2000).toISOString(),peaks:frequencies.map(f=>({f,snrDb:30}))})),peaks:frequencies.map(f=>({f,snrDb:30}))});`);
test('Ritz uniform limit agrees with prior Bessel solution across all six modes and nu range',()=>{
  assert.ok(run(`Array.from({length:7},(_,k)=>.2+.05*k).every(nu=>rimEigenvalues(nu,.1,1,8).every((v,i)=>Math.abs(v/lam2(i,nu)-1)<.00005))`));
});
test('geometry profiles conserve mass; narrowing a measured rim does not make it uniform thickness',()=>{
  assert.ok(run(`geometryFamily(c).candidates.every(g=>Math.abs(g.centre*(1-g.width)**2+g.rim*(1-(1-g.width)**2)-geometryFamily(c).h)<1e-10)`));
  assert.ok(run(`geometryFamily({...c,rimThickness:2}).candidates.every(g=>Math.abs(g.rim-2)<1e-12&&g.centre<2)`));
  assert.equal(run(`geometryFamily({...c,rimThickness:.3}).valid`),false);
});
test('six/eight term convergence indicator remains small across the default family',()=>{
  assert.ok(run(`Math.max(...geometryFamily(c).candidates.map(g=>g.numericalError))<.005`));
});
test('frequency uncertainty propagation obeys mass, diameter and modulus scaling',()=>{
  for(const [change,ratio] of [["mass:c.mass*1.5",1.5],["dia:c.dia*2",1/16],["E:c.E*1.21",1.1]]){
    assert.ok(Math.abs(run(`geometryFamily({...c,${change}}).candidates[0].f[0]/geometryFamily(c).candidates[0].f[0]`)-ratio)<1e-8);
  }
});
test('band has interior compatibility, inconclusive edge guards and distant anomaly',()=>{
  assert.equal(run(`bandPosition(6400,geometryFamily(c))`),'compatible');
  assert.equal(run(`bandPosition(geometryFamily(c).low,geometryFamily(c))`),'inconclusive');
  assert.equal(run(`bandPosition(geometryFamily(c).low*.8,geometryFamily(c))`),'anomalous');
  assert.equal(run(`screenReading(makeReading([1000],1),c).state`),'inconclusive');
  assert.equal(run(`screenReading(makeReading([1000]),c).state`),'no-pass');
  assert.equal(run(`screenReading(makeReading([1000]),c,true).state`),'anomalous');
});
test('no result of any kind before the required tap count',()=>{
  const e=`screenReading(makeReading(geometryFamily(c).candidates[4].f.slice(0,3),2),c,true)`;
  assert.equal(run(e+'.diagnostic'),'incomplete');assert.equal(run('resultTitle('+e+',true)'),'Test incomplete');
  assert.equal(run('resultTitle(screenReading(makeReading([6400],1),c),false)'),'Test incomplete');
  assert.equal(run('resultTitle(screenReading(makeReading([6400],2),c),false)'),'PASS');
});
test('joint fit recovers a sampled geometry from three peaks and their ratios',()=>{
  run(`globalThis.g=geometryFamily(c).candidates.find(g=>Math.abs(g.width-.09)<1e-9&&g.ratio>1.3);globalThis.r=makeReading(g.f.slice(0,3));globalThis.fit=fitGeometryFamily(r,c);`);
  assert.equal(run('fit.state'),'compatible');
  assert.equal(run('fit.best.matches.length'),3);
  assert.ok(run('fit.best.residual')<1e-8);
  assert.ok(run('fit.best.ratioResidual')<1e-8);
});
test('one or two tones cannot establish material compatibility; altered ratios lose joint support',()=>{
  assert.equal(run('fitGeometryFamily(makeReading([6400]),c).state'),'insufficient');
  assert.equal(run('fitGeometryFamily(makeReading(g.f.slice(0,2)),c).state'),'insufficient');
  assert.notEqual(run('fitGeometryFamily(makeReading([6400,7100,7900]),c).state'),'compatible');
});
test('one observed peak cannot count as two model modes and out-of-bandwidth modes are not evidence',()=>{
  assert.ok(run(`fit.supported.every(s=>new Set(s.matches.map(m=>m.mode)).size===s.matches.length&&new Set(s.matches.map(m=>m.measured)).size===s.matches.length)`));
  assert.equal(run(`fitGeometryFamily({...r,usableHz:8000},c).state`),'insufficient');
});
test('the family fit can identify a dominant upper mode without fabricating a lower measured peak',()=>{
  run(`globalThis.lower={...c,mass:5};globalThis.upper=makeReading([g.f[1]/2,g.f[2]/2,g.f[3]/2]);upper.f0=g.f[1]/2;`);
  assert.equal(run('fitGeometryFamily(upper,lower).state'),'compatible');
  assert.ok(run('fitGeometryFamily(upper,lower).supported.some(s=>s.rootMode===1)'));
});
test('verified specimen collection counts physical IDs and rejects duplicate recordings',()=>{
  run(`globalThis.record={...referenceFromReading(r,'Independent documented test'),collectionVersion:1,specimenId:'Ruble-A',verificationMethod:VERIFICATION_METHODS[0]};globalThis.collection=mergeSpecimens({},[record]);`);
  assert.equal(run('validSpecimen(record)'),true);
  assert.equal(run('Object.keys(mergeSpecimens(collection,[{...record,specimenId:"Ruble-B"}])).length'),1);
  assert.equal(run('Object.keys(mergeSpecimens(collection,[{...record,specimenId:"ruble-a"}])).length'),1);
  assert.equal(run('specimenStats(collection,c.name,c.key).count'),1);
  assert.equal(run('validSpecimen({...record,verificationMethod:"The app says compatible"})'),false);
  assert.equal(run('validSpecimen({...record,trusted:false})'),false);
  assert.equal(run('validSpecimen({...record,specimenId:""})'),false);
});
test('a loud upper resonance does not displace the observed fundamental',()=>{
  run(`globalThis.loud=makeReading(g.f.slice(0,3));loud.f0=g.f[2];loud.strikes.forEach(s=>s.f0=g.f[2]);`);
  assert.equal(run('fitGeometryFamily(loud,c).best.matches.length'),3);
  assert.equal(run('estimateFundamental(loud,c).f0'),run('g.f[0]'));
  assert.equal(run('estimateFundamental(loud,c).repeatable'),true);
});
test('an unrelated lower peak is not automatically selected as fundamental',()=>{
  run(`globalThis.noisy=makeReading([500,...g.f.slice(0,3)]);noisy.f0=g.f[2];`);
  assert.equal(run('estimateFundamental(noisy,c).f0'),run('g.f[0]'));
});
test('mode tracking survives switching loudest resonances across strikes',()=>{
  run(`globalThis.switched=makeReading(g.f.slice(0,3));switched.strikes.forEach((s,i)=>s.f0=g.f[i]);switched.spread=.9;`);
  assert.equal(run('estimateFundamental(switched,c).repeatable'),true);
  assert.equal(run('fitGeometryFamily(switched,c).state'),'compatible');
});
test('missing lower mode stays unresolved instead of inventing a measured fundamental',()=>{
  assert.equal(run('estimateFundamental(upper,lower).f0'),null);
  assert.equal(run('estimateFundamental(upper,lower).ambiguous'),true);
});
test('persistent tracks preserve every tap frequency and only close tracks form split families',()=>{
  run(`globalThis.ruble=makeReading([4800,5430]);globalThis.closePair=makeReading([4800,4900,9000]);`);
  assert.equal(run('recurringPeaks(ruble)[0].frequencies.length'),3);
  assert.equal(run('modalFamilies(ruble).length'),2);
  assert.equal(run('modalFamilies(closePair).length'),2);
  assert.equal(run('modalFamilies(closePair)[0].kind'),'possible-split-family');
});
test('worn rouble pair is repeatable evidence, not claimed splitting or compatibility',()=>{
  run(`globalThis.roubleCoin=flat.find(x=>x.n.startsWith('1 Rouble 1886'));globalThis.ra=ALLOYS[roubleCoin.a];globalThis.rc={name:roubleCoin.n,key:roubleCoin.a,mass:19.67,dia:33.7,rho:rhoOf(roubleCoin.a),E:ra.E,nu:ra.nu,family:FAMILY_DEFAULTS};globalThis.rf=acousticFingerprint(ruble,rc);`);
  assert.ok(Math.abs(run('rf.ratios[0].observed')-5430/4800)<1e-12);
  assert.equal(run('rf.families.length'),2);
  assert.equal(run('rf.ratios[0].joint'),null);
  assert.equal(run('screenReading(ruble,rc,true).state'),'evidence');
});
test('a repeatable cluster stranded between modeled modes is outside the model',()=>{
  run(`globalThis.half=flat.find(x=>x.n==='Half Dollar 90% · 1873–1964');globalThis.ha=ALLOYS[half.a];globalThis.hc={name:half.n,key:half.a,mass:half.m,dia:half.d,rho:rhoOf(half.a),E:ha.E,nu:ha.nu,family:FAMILY_DEFAULTS};globalThis.badHalf=makeReading([6812,6928]);globalThis.he=modalEnvelopeEvidence(badHalf,hc);`);
  assert.equal(run('he.assignments.length'),1);
  assert.equal(run('he.outside.length'),1);
  assert.equal(run('screenReading(badHalf,hc,true).state'),'anomalous');
  assert.equal(run('screenReading(badHalf,hc,true).diagnostic'),'primary-above-model');
  assert.equal(run('resultTitle(screenReading(badHalf,hc,false),false)'),'NO PASS');
});
test('above the band, only a pattern that fits as upper modes keeps a missed lower mode open',()=>{
  // Upper modes of the lighter coin: the pattern fits with the lowest mode missing.
  assert.equal(run('screenReading(upper,lower,true).diagnostic'),'lower-mode-unconfirmed');
  assert.equal(run('resultTitle(screenReading(upper,lower,false),false)'),'NO PASS');
  // A lone high tone has no pattern to support that reading.
  run(`globalThis.lone=screenReading(makeReading([geometryFamily(c).high*1.6]),c,true);`);
  assert.equal(run('lone.state'),'anomalous');assert.equal(run('resultTitle(lone,true)'),'Primary frequency outside model');
});
test('a real plate mode near a whole-number multiple still counts when the fit needs it',()=>{
  run(`globalThis.mc={mass:26.7296,dia:38.1,rho:rhoOf('ag900'),E:82,nu:.37};globalThis.u=geometryFamily(mc).candidates.find(g=>g.ratio===1);globalThis.hme=screenReading(makeReading([u.f[0],u.f[1],u.f[3]]),mc,true);`);
  // On a flat silver plate (1,1) sits about 4.01x above (2,0), inside the harmonic tolerance.
  assert.equal(run('hme.fingerprint.families[2].harmonicOrder'),4);
  assert.equal(run('hme.fit.harmonicAssisted'),true);
  assert.equal(run('resultTitle(hme,true)'),'Model consistent');
  assert.match(run('hme.reason'),/whole-number multiple/);
  // A fit that works without the candidate is never replaced by one that uses it.
  run(`globalThis.strict=fitGeometryFamily(makeReading([...g.f.slice(0,3),g.f[0]*2]),c);`);
  assert.equal(run('strict.state'),'compatible');assert.equal(run('strict.harmonicAssisted'),false);
  assert.ok(run('strict.results.every(r=>!r.harmonicAssisted)'));
});
test('Model consistent requires the three-mode fit to include the lowest repeatable resonance',()=>{
  run(`globalThis.mc={mass:26.7296,dia:38.1,rho:rhoOf('ag900'),E:82,nu:.37};globalThis.g4=geometryFamily(mc).candidates[4];globalThis.lowX=screenReading(makeReading([g4.f[0]*.955,g4.f[0],g4.f[1],g4.f[2]]),mc,true);`);
  assert.equal(run('lowX.fieldPosition'),'compatible');
  assert.equal(run('lowX.fit.state'),'compatible');
  assert.equal(run('resultTitle(lowX,true)'),'Primary frequency in band');
  assert.match(run('lowX.reason'),/does not explain the lowest resonance/);
});
test('an exact strike harmonic is displayed but excluded from modal scoring',()=>{
  run(`globalThis.sov=flat.find(x=>x.n==='Sovereign');globalThis.sa=ALLOYS[sov.a];globalThis.sc={name:sov.n,key:sov.a,mass:8,dia:22,rho:rhoOf(sov.a),E:sa.E,nu:sa.nu,family:FAMILY_DEFAULTS};globalThis.sovReading=makeReading([5409,5577,10817,12522]);globalThis.sf=acousticFingerprint(sovReading,sc);`);
  assert.equal(run('sf.families.find(f=>Math.abs(f.centre-10817)<1).harmonicOrder'),2);
  assert.equal(run('sf.envelope.assignments.find(a=>Math.abs(a.family.centre-10817)<1).excludedAsHarmonic'),true);
  assert.notEqual(run('screenReading(sovReading,sc,true).state'),'anomalous');
});
test('Pro strict screening needs a coherent three-mode fit for positive compatibility',()=>{
  assert.equal(run('screenReading(makeReading([g.f[0]]),c,true).state'),'evidence');
  assert.equal(run('screenReading(makeReading(g.f.slice(0,3)),c,true).state'),'compatible');
  assert.equal(run('screenReading(makeReading([1000]),c,true).state'),'anomalous');
});
test('an independently verified unresolved pattern can be stored as a modal fingerprint',()=>{
  run(`globalThis.unresolvedReference=referenceFromReading({...ruble,f0:null,spread:null,pitchRole:'modal-fingerprint',fingerprint:acousticFingerprint(ruble,rc)},'Independent instrument test');`);
  assert.equal(run('unresolvedReference.version'),3);
  assert.equal(run('unresolvedReference.f0'),null);
  assert.equal(run('validReference(unresolvedReference)'),true);
  assert.equal(run('unresolvedReference.fingerprint.tracks.length'),2);
});

test('resolved neighbors keep separate identities and a missing neighbor cannot substitute',()=>{
  run(`globalThis.neighbors=makeReading([5210,12130,12165]);
    neighbors.strikes[1].peaks=neighbors.strikes[1].peaks.filter(p=>p.f!==12130);
    globalThis.nt=recurringPeaks(neighbors);`);
  assert.deepEqual(JSON.parse(run('JSON.stringify(nt.map(t=>t.f))')),[5210,12165]);
  run(`neighbors.strikes[1].peaks.push({f:12131,snrDb:30});globalThis.nt2=recurringPeaks(neighbors);`);
  assert.equal(run('nt2.length'),3);
  assert.ok(run('nt2.every(t=>Math.max(...t.frequencies)-Math.min(...t.frequencies)<=1)'));
});

test('a close-frequency group never supplies two independent joint assignments',()=>{
  run(`globalThis.closeReading=makeReading([...g.f,g.f[2]*1.002]);globalThis.closeFit=fitGeometryFamily(closeReading,c);`);
  assert.ok(run('closeFit.results.every(f=>new Set(f.matches.map(m=>m.familyIndex)).size===f.matches.length)'));
});

test('evidence labels distinguish missing modes, unresolved identity and an outside-model result',()=>{
  run(`globalThis.coinR=flat.find(x=>x.n.startsWith('1 Rouble 1886'));globalThis.coinRC={name:coinR.n,key:coinR.a,mass:coinR.m,dia:coinR.d,rho:rhoOf(coinR.a),E:ALLOYS[coinR.a].E,nu:ALLOYS[coinR.a].nu};globalThis.r4=makeReading([5210,5428,12130,12165]);globalThis.e4=screenReading(r4,coinRC,true);`);
  assert.equal(run('e4.fit.matchedModeCount'),2);
  assert.equal(run('resultTitle(e4,true)'),'Primary frequency in band');
  assert.equal(run('resultTitle(screenReading(makeReading([1000]),coinRC,true),true)'),'Primary frequency outside model');
  assert.equal(run('resultTitle({state:"evidence",diagnostic:"model-unresolved"},true)'),'Model fit unresolved');
  assert.equal(run('resultTitle({state:"inconclusive"},true)'),'Inconclusive');
  assert.equal(run('resultTitle(screenReading(makeReading(g.f.slice(0,3)),c,true),true)'),'Model consistent');
});

test('verified-dinar pattern keeps an in-band primary family despite an unexplained upper resonance',()=>{
  run(`globalThis.dinar=flat.find(x=>x.n.startsWith('1 Dinar 1875'));globalThis.da=ALLOYS[dinar.a];globalThis.dc={name:dinar.n,key:dinar.a,mass:dinar.m,dia:dinar.d,rho:rhoOf(dinar.a),E:da.E,nu:da.nu};globalThis.dr=makeReading([6468.8,6521.9,14669.5]);globalThis.de=screenReading(dr,dc,true);globalThis.dl=screenReading(dr,dc,false);`);
  assert.equal(run('de.primary.insideLowest'),true);
  assert.deepEqual(JSON.parse(run('JSON.stringify(de.primary.family.frequencies)')),[6468.8,6521.9]);
  assert.deepEqual(JSON.parse(run('JSON.stringify(de.primary.secondaryOutside.map(a=>a.family.centre))')),[14669.5]);
  assert.equal(run('de.diagnostic'),'primary-consistent-secondary-unresolved');
  assert.equal(run('resultTitle(de,true)'),'Primary frequency in band');
  assert.match(run('de.reason'),/lowest repeatable resonance/i);
  assert.equal(run('dl.state'),'compatible');
  assert.equal(run('dl.diagnostic'),'primary-consistent-secondary-unresolved');
  assert.match(run('dl.reason'),/independent metal test/i);
  assert.equal(run('resultTitle(dl,false)'),'PASS');
});

test('a loud upper tone cannot hide a lower repeatable in-band resonance',()=>{
  run(`globalThis.loudDinar=makeReading([6468.8,14669.5]);loudDinar.strikes.forEach(s=>{s.f0=14669.5;s.peaks.forEach(p=>p.mag=p.f>10000?1:.1)});loudDinar.f0=14669.5;globalThis.loudLite=screenReading(loudDinar,dc,false);globalThis.loudPro=screenReading(loudDinar,dc,true);`);
  assert.equal(run('loudLite.primary.family.centre'),6468.8);
  assert.equal(run('resultTitle(loudLite,false)'),'PASS');
  assert.equal(run('resultTitle(loudPro,true)'),'Primary frequency in band');
  assert.equal(run('loudPro.fit.matchedModeCount')<3,true);
});
