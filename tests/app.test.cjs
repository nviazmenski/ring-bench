
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path"),assert=require("node:assert/strict"),{test}=require("node:test");
class Element{
  constructor(tag='div',value=''){this.tagName=tag.toUpperCase();this._value=value;this.children=[];this.style={};this.dataset={};this.events={};this.classList={toggle(){},add(){},remove(){}};this.parentNode={style:{}};this.checked=false;this.disabled=false;this.clientWidth=0;this.textContent='';}
  set value(v){this._value=String(v);} get value(){return this._value||((this.tagName==='SELECT'&&this.options[0]?.value)||'');}
  set innerHTML(v){this._html=v;this.children=[];}get innerHTML(){return this._html||'';}
  get options(){return this.children.flatMap(x=>x.tagName==='OPTGROUP'?x.children:[x]);}
  appendChild(e){e.parentNode=this;this.children.push(e);return e;}
  append(e){return this.appendChild(e);} replaceChildren(...children){this.children=children;}
  addEventListener(name,fn){(this.events[name]??=[]).push(fn);}
  dispatch(name){for(const f of this.events[name]||[])f({target:this});}
  click(){return this.onclick?.({target:this});}
  remove(){}
  querySelectorAll(){return [];}
}
function app(edition="lite",legacy=false,seed={}){
  const html=fs.readFileSync(legacy?path.join(__dirname,"fixtures/previous-lite.html"):path.join(__dirname,"../"+edition+"/index.html"),"utf8");
  const code=legacy?html.match(/<script>([\s\S]*?)<\/script>/)[1]:[...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>fs.readFileSync(path.resolve(__dirname,"../"+edition,m[1]),"utf8")).join("\n");
  const elements={};
  for(const m of html.matchAll(/<(\w+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){
    const value=m[2].match(/\bvalue="([^"]*)"/)?.[1]||'';
    const el=elements[m[3]]=new Element(m[1],value);
    if(m[1]==='select'){
      const tail=html.slice(m.index+m[0].length).split('</select>')[0];
      for(const o of tail.matchAll(/<option\b[^>]*value="([^"]*)"[^>]*>([^<]*)/g)){const opt=new Element('option',o[1]);opt.textContent=o[2];el.appendChild(opt);}
    }
  }
  const foot=new Element(),body=new Element();body.dataset={};
  // Enough DOM for pro.js: inserted markup registers its ids so the Pro-only panels are testable.
  const register=markup=>{for(const m of markup.matchAll(/<(\w+)\b([^>]*\bid="([^"]+)"[^>]*)>/g))elements[m[3]]??=new Element(m[1]);};
  const node=()=>Object.assign(new Element(),{querySelector:()=>node(),insertAdjacentHTML:(where,markup)=>register(markup),insertBefore(){}});
  const document={getElementById:id=>elements[id]||null,createElement:tag=>new Element(tag),querySelector:s=>s==='.foot'?foot:node(),querySelectorAll:()=>[],addEventListener(){},body};
  const storage=new Map(Object.entries(seed));
  const context=vm.createContext({document,window:{addEventListener(){},confirm(){return true;}},navigator:{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    getComputedStyle:()=>({getPropertyValue:()=>''}),requestAnimationFrame:()=>{},setTimeout,clearTimeout,console,Blob,URL,crypto:require('node:crypto').webcrypto,crypto:require('node:crypto').webcrypto});
  vm.runInContext(code,context);
  return {context,e:elements,run:s=>vm.runInContext(s,context)};
}
function synth(a,{freqs,amps,tau=.12,sr=48000,ambient=0}={}){
  a.context.fixture={freqs,amps,tau,sr,ambient};
  return a.run(`(()=>{const {freqs,amps,tau,sr,ambient}=fixture;
    const x=new Float32Array(Math.ceil((PRE+CAP)*sr)),onset=Math.ceil(PRE*sr);
    for(let i=0;i<x.length;i++){
      let y=ambient*Math.sin(2*Math.PI*freqs[0]*i/sr);
      if(i>=onset){const t=(i-onset)/sr;for(let k=0;k<freqs.length;k++)y+=(amps?.[k]??.08)*Math.sin(2*Math.PI*freqs[k]*t)*Math.exp(-t/tau);}
      x[i]=y;
    }return x;})()`);
}

function synthetic(a,f){return synth(a,{freqs:[f],amps:[.1]});}

test('resolved upper doublets survive at multiple sample rates without promoting sidelobes',async()=>{
  const a=app('pro');
  for(const sr of [44100,48000,96000]){
    a.context.x=synth(a,{freqs:[5210,5428,12130,12165],amps:[.07,.09,.02,.025],tau:.25,sr});a.context.sr=sr;
    const r=await a.run('analyseInner(x,sr,ringBench.current(),ringBench.snapshot(),{kind:"file"},Math.ceil(.06*sr))');
    assert.equal(r.peaks.length,4);
    assert.ok(r.peaks.every((p,i)=>Math.abs(p.f-[5210,5428,12130,12165][i])<1));
    a.context.x=synth(a,{freqs:[12130],amps:[.3],tau:.2,sr});
    const solo=await a.run('analyseInner(x,sr,ringBench.current(),ringBench.snapshot(),{kind:"file"},Math.ceil(.06*sr))');
    assert.equal(solo.peaks.length,1,'a single tone must not create extra independent evidence');
  }
});

test('separation uses captured duration, not a percentage or zero-padding bin spacing',()=>{
  const a=app();
  a.context.x=synth(a,{freqs:[12130,12133],amps:[.1,.1],tau:1});
  const count=a.run('(()=>{const s=spectrum(x.slice(2880),48000,131072,"blackman-harris");return peaks(s.mag,s.binHz,12000,12300,14,s.resolutionHz).length})()');
  assert.equal(count,1);
});

test('unverified user WAV regression: preserve four tones without manufacturing a three-mode pass',{
  skip:!process.env.RINGBENCH_SAMPLE_DIR&&'Set RINGBENCH_SAMPLE_DIR to the local user recordings; audio is not shipped with the app.'
},async()=>{
  const files=fs.readdirSync(process.env.RINGBENCH_SAMPLE_DIR).filter(n=>/ringbench-tap-[123]-.*\.wav$/.test(n)).sort();
  assert.equal(files.length,3);
  const samples=files.map(n=>{const b=fs.readFileSync(path.join(process.env.RINGBENCH_SAMPLE_DIR,n));assert.equal(b.readUInt32LE(24),48000);assert.equal(b.readUInt16LE(34),16);return Float32Array.from({length:(b.length-44)/2},(_,i)=>b.readInt16LE(44+2*i)/32768);});
  for(const edition of ['pro','lite']){
    const a=app(edition);a.run('ringBench.chooseCoin(flat.findIndex(x=>x.n.startsWith("1 Rouble 1886")));ringBench.newSession({kind:"file"});');
    for(const x of samples.slice(0,edition==='pro'?3:2)){a.context.x=x;assert.equal(await a.run('ringBench.accept(x,48000,ringBench.getState().session.id,{kind:"file"},2880)'),true);}
    const e=a.run('screenReading(ringBench.getState().reading,ringBench.current(),'+(edition==='pro')+')');
    assert.equal(e.fingerprint.tracks.length,4);
    assert.ok(e.fingerprint.tracks.every((t,i)=>Math.abs(t.f-[5210,5428,12130,12165][i])<3));
    assert.equal(e.fit.matchedModeCount,2);
    assert.equal(a.e.resultTitle.textContent,edition==='pro'?'Primary frequency in band':'PASS');
    assert.equal(e.fingerprint.envelope.outside.length,0);
  }
});
async function tap(a,f){
  a.context.x=synthetic(a,f);
  return a.run("ringBench.accept(x,48000,ringBench.getState().session.id,{kind:'file'},2880)");
}
test("both editions boot with all 105 catalogue entries and identical theoretical predictions",()=>{
  const lite=app(),pro=app("pro");
  assert.equal(lite.run("flat.length"),105);assert.equal(pro.run("flat.length"),105);
  assert.equal(lite.run("JSON.stringify(COINS)"),pro.run("JSON.stringify(COINS)"));
  // Every earlier entry is either unchanged, relabelled to a corrected preset, or has named successors.
  const previous=JSON.parse(app("lite",true).run("JSON.stringify(COINS.flatMap(g=>g.items))"));
  const now=new Map(JSON.parse(lite.run("JSON.stringify(flat)")).map(c=>[c.n,c]));
  const successors=JSON.parse(lite.run("JSON.stringify(CATALOGUE_SUCCESSORS)")),alloys=JSON.parse(lite.run("JSON.stringify(ALLOY_SUCCESSORS)"));
  for(const old of previous){
    if(successors[old.n]){assert.ok(successors[old.n].every(n=>now.has(n)),old.n);assert.ok(!now.has(old.n),old.n);continue;}
    const c=now.get(old.n);assert.ok(c,old.n);assert.equal(c.m,old.m,old.n);assert.equal(c.d,old.d,old.n);assert.equal(c.a,alloys[old.n+"|"+old.a]||old.a,old.n);
  }
  assert.equal(lite.run("Object.hasOwn(ALLOYS,'au9661')"),false);
  assert.equal(lite.run("JSON.stringify(P(ringBench.current()))"),pro.run("JSON.stringify(P(ringBench.current()))"));
  for(const a of [lite,pro])a.run("flat.forEach((c,i)=>{ringBench.chooseCoin(i);if(!Number.isFinite(P(ringBench.current()).f[0]))throw Error(c.n)})");
});
test("clean ringing retains the old Lite peak and pitch estimates",async()=>{
  const old=app("lite",true),a=app(),f=a.run("P(ringBench.current()).f[0]");
  a.context.x=synthetic(a,f);old.context.x=a.context.x;
  const before=await old.run("analyseInner(x,48000,current(),settingsSnapshot(),{kind:'file'},2880)");
  const after=await a.run("analyseInner(x,48000,ringBench.current(),ringBench.snapshot(),{kind:'file'},2880)");
  // The low-sidelobe window changes interpolation slightly, not the pitch.
  assert.ok(Math.abs(before.f0-after.f0)<.01);assert.equal(after.peaks.length,before.peaks.length);
  assert.ok(after.peaks.every((p,i)=>Math.abs(p.f-before.peaks[i].f)<.01));
  assert.ok(after.peaks.every(p=>Number.isFinite(p.persistenceDropDb)));
});
test("brief impact clipping is accepted but clipping in the ringing tail is rejected",async()=>{
  for(const edition of ["lite","pro"]){
    const a=app(edition),f=a.run("P(ringBench.current()).f[0]");
    a.context.x=synthetic(a,f);
    a.run("x.fill(1,2880,2880+480)");
    const r=await a.run("analyseInner(x,48000,ringBench.current(),ringBench.snapshot(),{kind:'file'},2880)");
    assert.ok(Math.abs(r.f0/f-1)<.001);assert.equal(r.captureQuality.impactClippedSamples,480);
    assert.ok(r.captureQuality.analysisSkipMs>13);
    a.run("x.fill(1,2880+2400,2880+2500)");
    await assert.rejects(a.run("analyseInner(x,48000,ringBench.current(),ringBench.snapshot(),{kind:'file'},2880)"),/tail is clipped/);
  }
});
test("stationary background and a newly switched-on flat tone are not accepted as rings",async()=>{
  const a=app(),f=a.run("P(ringBench.current()).f[0]");
  for(const fixture of [{freqs:[f],amps:[0],ambient:.03},{freqs:[f],amps:[.1],tau:1e9}]){
    a.context.x=synth(a,fixture);
    await assert.rejects(a.run("analyseInner(x,48000,ringBench.current(),ringBench.snapshot(),{kind:'file'},2880)"),/distinct strike|stable ringing/);
  }
});
test("brief tonal bursts and speech-like changing frequencies fail persistence",async()=>{
  const a=app(),f=a.run("P(ringBench.current()).f[0]");
  a.context.f=f;
  for(const chirp of [false,true]){
    a.context.chirp=chirp;
    a.run("globalThis.x=new Float32Array(31680);for(let i=2880;i<x.length;i++){const t=(i-2880)/48000;if(chirp)x[i]=.1*Math.sin(2*Math.PI*(f*t+1500*t*t))*Math.exp(-t/.12);else if(t<.035)x[i]=.1*Math.sin(2*Math.PI*f*t);}");
    await assert.rejects(a.run("analyseInner(x,48000,ringBench.current(),ringBench.snapshot(),{kind:'file'},2880)"),/tonal|stable ringing/);
  }
});
test("a weak ring above room noise and a long ring with a sharp impact remain usable",async()=>{
  const a=app(),f=a.run("P(ringBench.current()).f[0]");
  a.context.x=synth(a,{freqs:[f],amps:[.012],ambient:.0001,tau:.12});
  let r=await a.run("analyseInner(x,48000,ringBench.current(),ringBench.snapshot(),{kind:'file'},2880)");
  assert.ok(Math.abs(r.f0/f-1)<.001);
  a.context.x=synth(a,{freqs:[f],amps:[.08],tau:3});a.run("x[2880]=.9");
  r=await a.run("analyseInner(x,48000,ringBench.current(),ringBench.snapshot(),{kind:'file'},2880)");
  assert.ok(Math.abs(r.f0/f-1)<.001);
});
test("live gate calibrates, ignores steady sound and triggers once for a new impact",()=>{
  const a=app();
  const result=a.run(`(()=>{
    const gate=createStrikeGate(48000,18),hits=[];let earlyReady=false;
    for(let offset=0;offset<48000*3;offset+=1024){
      const block=new Float32Array(1024);
      for(let i=0;i<block.length;i++){const t=(offset+i)/48000;block[i]=.008*Math.sin(2*Math.PI*1300*t);if(t>=1)block[i]+=.25*Math.sin(2*Math.PI*5000*(t-1))*Math.exp(-(t-1)/.8);}
      const hit=gate.process(block);if(hit)hits.push(offset+hit.index);
      if(offset<20000&&gate.ready)earlyReady=true;
    }
    return {ready:gate.ready,earlyReady,hits};
  })()`);
  assert.equal(result.ready,true);assert.equal(result.earlyReady,false);assert.equal(result.hits.length,1);
  assert.ok(Math.abs(result.hits[0]-48000)<1024);
});
test("a broadband noise knock does not become a coin tone",async()=>{
  const a=app();
  a.run("globalThis.x=new Float32Array(31680);let seed=12345;for(let i=0;i<x.length;i++){seed=(1664525*seed+1013904223)>>>0;const noise=seed/4294967296*2-1;x[i]=noise*(i<2880?.0001:.3*Math.exp(-(i-2880)/4800));}");
  await assert.rejects(a.run("analyseInner(x,48000,ringBench.current(),ringBench.snapshot(),{kind:'file'},2880)"),/tonal|stable ringing/);
});
test("no result before the last tap; Lite completes on two and Pro completes on three",async()=>{
  for(const edition of ["lite","pro"]){
    const a=app(edition),f=a.run("P(ringBench.current()).f[0]"),target=edition==="lite"?2:3;a.run("ringBench.newSession({kind:'file'})");
    for(let i=1;i<target;i++){
      assert.equal(await tap(a,f),true);assert.equal(a.run("ringBench.getState().reading.complete"),false);
      assert.equal(a.e.result.hidden,false);assert.equal(a.e.resultTitle.textContent,"Test incomplete");
      assert.match(a.e.resultSummary.textContent,new RegExp("Tap "+i+" of "+target));
    }
    await tap(a,f);assert.equal(a.run("ringBench.getState().reading.complete"),true);
    assert.equal(a.e.resultTitle.textContent,edition==="lite"?"PASS":"Primary frequency in band");
  }
});
test("keeping one tap never claims repeatability; bad second tap retains good first",async()=>{
  const a=app(),f=a.run("P(ringBench.current()).f[0]");a.run("ringBench.newSession({kind:'file'})");await tap(a,f);
  a.context.x=new Float32Array(31680).fill(1);
  assert.equal(await a.run("ringBench.accept(x,48000,ringBench.getState().session.id,{kind:'file'},2880)"),false);
  assert.equal(a.run("ringBench.getState().reading.strikes.length"),1);assert.match(a.e.status.textContent,/retained/);
  a.run("ringBench.finish()");assert.equal(a.e.resultTitle.textContent,"Test incomplete");
  assert.equal(a.run("screenReading(ringBench.getState().reading,ringBench.current()).fingerprint.repeatable"),false);
});
test("reference formats travel between Lite and Pro, including previous Lite references",async()=>{
  const a=app(),b=app("pro"),f=a.run("P(ringBench.current()).f[0]");a.run("ringBench.newSession({kind:'file'})");await tap(a,f);await tap(a,f);
  const ref=a.run("referenceFromReading(ringBench.getState().reading,'Independently checked')");
  b.context.ref=JSON.parse(JSON.stringify(ref));assert.equal(b.run("validReference(ref)"),true);
  b.run("ref.format='ringbench-lite-reference';ref.version=1");assert.equal(b.run("validReference(ref)"),true);
  b.run("ref.strikes[0].peaks=[null]");assert.equal(b.run("validReference(ref)"),false);
});
test("Pro three-tap references are valid for Lite",async()=>{
  const a=app("pro"),f=a.run("P(ringBench.current()).f[0]");a.run("ringBench.newSession({kind:'file'})");await tap(a,f);await tap(a,f);await tap(a,f);
  const ref=a.run("referenceFromReading(ringBench.getState().reading,'Independent provenance')");
  const b=app();b.context.ref=JSON.parse(JSON.stringify(ref));assert.equal(b.run("validReference(ref)"),true);
});
test("Lite gives a firm NO PASS below or above the expected range and when taps disagree",async()=>{
  const a=app(),f=a.run("P(ringBench.current()).f[0]");
  for(const [taps,why] of [[[f*.8,f*.8],/below the expected range/],[[f*1.35,f*1.35],/above the expected range/],[[f,f*1.03],/did not produce the same pitch/]]){
    a.run("ringBench.newSession({kind:'file'})");for(const t of taps)await tap(a,t);
    assert.equal(a.e.resultTitle.textContent,"NO PASS");assert.match(a.e.resultSummary.textContent,why);
  }
});
test("stale analysis cannot replace the reading after a coin change",async()=>{
  const a=app();a.run("ringBench.newSession({kind:'file'});globalThis.release=null;analyseInner=()=>new Promise(r=>release=r)");
  a.context.x=new Float32Array(31680);const p=a.run("ringBench.accept(x,48000,ringBench.getState().session.id,{kind:'file'},2880)");
  a.run("ringBench.chooseCoin(2);release({f0:5000})");assert.equal(await p,false);assert.equal(a.run("ringBench.getState().reading"),null);
});
test("WAV has correct length, rate and signed amplitude",()=>{const a=app(),v=new DataView(a.run("wavBuffer(new Float32Array([-1,0,1]),48000)"));assert.equal(v.getUint32(24,true),48000);assert.equal(v.getUint32(40,true),6);assert.equal(v.getInt16(44,true),-32768);});
test("Pro records multiple modes and renders a joint material fit through the shared controller",async()=>{
  const a=app("pro");a.run("ringBench.newSession({kind:'file'})");
  const frequencies=a.run("geometryFamily(ringBench.current()).candidates[4].f.slice(0,3)");
  for(let i=0;i<3;i++){
    a.context.x=synth(a,{freqs:frequencies,amps:[.12,.08,.06]});
    assert.equal(await a.run("ringBench.accept(x,48000,ringBench.getState().session.id,{kind:'file'},2880)"),true);
  }
  assert.match(a.e.materialFit.textContent,/compatible with 3 of 3/);
  assert.equal(a.e.fitRows.children.length,3);
  assert.match(a.e.geometryUncertainty.textContent,/sampled shapes/);
  assert.equal(a.e.resultTitle.textContent,"Model consistent");assert.equal(a.e.resultTitleDesktop.textContent,"Model consistent");
});
test("Pro gives no indication of direction until all three taps are recorded, even when a reading is kept early",async()=>{
  const a=app("pro");a.run("ringBench.newSession({kind:'file'})");
  const frequencies=a.run("geometryFamily(ringBench.current()).candidates[4].f.slice(0,3)");
  for(let i=0;i<2;i++){a.context.x=synth(a,{freqs:frequencies,amps:[.12,.08,.06]});assert.equal(await a.run("ringBench.accept(x,48000,ringBench.getState().session.id,{kind:'file'},2880)"),true);}
  const cell=(table,label)=>a.e[table].children.find(r=>r.children[0].textContent===label).children[1].textContent;
  for(const when of ["after two taps","after keeping two taps"]){
    assert.equal(a.e.resultTitle.textContent,"Test incomplete",when);assert.equal(a.e.resultTitleDesktop.textContent,"Test incomplete",when);
    assert.doesNotMatch(a.e.resultSummary.textContent,/band|consistent|fit|pass/i,when);
    assert.match(a.e.materialFit.textContent,/Record all 3 taps/,when);
    assert.equal(cell("evidenceRows","Lowest recurring family"),"Shown when all 3 taps are recorded",when);
    assert.equal(cell("ringEvidenceRows","Theory"),"Shown when all 3 taps are recorded",when);
    a.run("ringBench.finish()");
  }
});
test("the spectrum marker and the headline report the same lowest resonance",async()=>{
  const a=app("pro");a.run("ringBench.newSession({kind:'file'})");
  const band=a.run("(({low,high})=>({low,high}))(geometryFamily(ringBench.current()))"),low=(band.low+band.high)/2;
  // A quiet in-band tone under a loud unexplained upper tone.
  for(let i=0;i<3;i++){a.context.x=synth(a,{freqs:[low,low*1.41],amps:[.03,.15]});await a.run("ringBench.accept(x,48000,ringBench.getState().session.id,{kind:'file'},2880)");}
  const labels=[];a.e.spectrum.clientWidth=600;
  a.e.spectrum.getContext=()=>new Proxy({measureText:()=>({width:60}),fillText:text=>labels.push(text)},{get:(o,k)=>k in o?o[k]:()=>{},set:()=>true});
  a.context.requestAnimationFrame=f=>f();a.run("ringBench.render()");
  const marker=labels.find(t=>/^Measured · /.test(t));
  assert.ok(marker,"measured marker drawn");assert.equal(Number(marker.replace(/\D/g,"")),Number(a.e.frequency.textContent));
  assert.ok(Math.abs(Number(a.e.frequency.textContent)-low)<3);
});
test("saved references survive catalogue changes: split entries are kept, a corrected preset migrates",async()=>{
  const a=app(),f=a.run("P(ringBench.current()).f[0]");a.run("ringBench.newSession({kind:'file'})");await tap(a,f);await tap(a,f);
  const base=a.run("JSON.stringify(referenceFromReading(ringBench.getState().reading,'Independent instrument test'))");
  const ref=(coin,alloy)=>{const r=JSON.parse(base);r.settings.coin=coin;r.settings.alloy=alloy;return r;};
  const saved={"2 Dinara 1875–1915 · KM#26|ag835":ref("2 Dinara 1875–1915 · KM#26","ag835"),"Krugerrand 1 oz|au9167":ref("Krugerrand 1 oz","au9167"),"1 Dukat 1931–34 · KM#12|au9661":ref("1 Dukat 1931–34 · KM#12","au9661")};
  const b=app("lite",false,{"ringbench.references.v2":JSON.stringify(saved)}),stored=JSON.parse(b.run("localStorage.getItem(REFERENCE_KEY)"));
  assert.deepEqual(stored["2 Dinara 1875–1915 · KM#26|ag835"],saved["2 Dinara 1875–1915 · KM#26|ag835"]);
  assert.deepEqual(stored["1 Dukat 1931–34 · KM#12|au9661"],saved["1 Dukat 1931–34 · KM#12|au9661"]);
  assert.equal(stored["Krugerrand 1 oz|au917cu"].settings.alloy,"au917cu");assert.equal(stored["Krugerrand 1 oz|au917cu"].migratedFrom.alloy,"au9167");
  assert.match(b.e.storageStatus.textContent,/2 saved record\(s\) belong to catalogue entries that were split or changed/);
});
test("verified specimen controls preserve distinct coins and refuse to count a recording twice",async()=>{
  const a=app(),f=a.run("P(ringBench.current()).f[0]");a.run("ringBench.newSession({kind:'file'})");await tap(a,f);await tap(a,f);
  a.e.reftrusted.checked=true;a.e.refnote.value="Independent instrument result, recorded separately";a.e.specimenId.value="coin-A";a.run("ringBench.render()");
  a.e.addSpecimen.click();assert.match(a.e.specimenStats.textContent,/1 independently/);
  a.e.specimenId.value="coin-B";a.e.addSpecimen.click();assert.match(a.e.notice.textContent,/not counted again/);
  assert.equal(a.run("Object.keys(JSON.parse(localStorage.getItem(SPECIMEN_KEY))).length"),1);
});
test("both editions display and save a weaker fundamental beneath the loudest upper mode",async()=>{
  for(const edition of ["lite","pro"]){
    const a=app(edition);a.run("ringBench.newSession({kind:'file'})");
    const fs=a.run("geometryFamily(ringBench.current()).candidates[4].f.slice(0,3)");
    for(let i=0;i<(edition==="lite"?2:3);i++){
      a.context.x=synth(a,{freqs:fs,amps:[.045,.07,.15]});
      assert.equal(await a.run("ringBench.accept(x,48000,ringBench.getState().session.id,{kind:'file'},2880)"),true);
    }
    assert.ok(Math.abs(Number(a.e.frequency.textContent)-fs[0])<3);
    assert.equal(a.e.frequencyLabel.textContent,"Lowest repeatable resonance · mode provisional");
    assert.ok(Math.abs(a.run("ringBench.getState().reading.f0")-fs[2])<3);
    assert.match(a.e.dominantFrequency.textContent,/Loudest resonance:/);
    a.e.reftrusted.checked=true;a.e.refnote.value="Independent instrument verification";a.run("ringBench.render()");
    assert.equal(a.e.saveref.disabled,false);a.e.saveref.click();
    const saved=a.run("Object.values(JSON.parse(localStorage.getItem(REFERENCE_KEY)))[0]");
    assert.equal(saved.pitchRole,"estimated-fundamental");
    assert.ok(Math.abs(saved.f0-fs[0])<3);
  }
});
test("fake check shows what the pitch can separate, then what the coin rules out",async()=>{
  for(const edition of ["lite","pro"]){
    const a=app(edition),target=edition==="lite"?2:3,chips=()=>Object.fromEntries(a.e.constructionRows.children.map(x=>[x.children[0].children[0].textContent,x.children[0].children[1].textContent]));
    a.run('ringBench.chooseCoin(flat.findIndex(x=>x.n==="Sovereign"))');
    assert.equal(a.e.constructions.hidden,false);assert.equal(a.e.constructionRows.children.length,5);
    assert.match(a.e.constructionSummary.textContent,/pitch alone separates 3 of 5 listed fakes.*tungsten core while its gold shell is thin/);
    assert.equal(chips()["Gold-plated tungsten"],"Pitch catches it");assert.equal(chips()["Underfine gold: 5 points less, balance copper"],"Pitch can’t tell");
    assert.match(a.e.constructionNote.textContent,edition==="lite"?/the catalogue weight/:/the entered weight/);
    const f=a.run("(b=>Math.sqrt(b.low*b.high))(geometryFamily(ringBench.current()))");a.run("ringBench.newSession({kind:'file'})");
    for(let i=1;i<target;i++){await tap(a,f);assert.match(a.e.constructionSummary.textContent,/Complete the test/);assert.equal(chips()["Gold-plated tungsten"],"Pitch catches it");}
    await tap(a,f);
    assert.match(a.e.constructionSummary.textContent,/rules out 3 of 5 listed fakes/);
    assert.equal(chips()["Gold-plated tungsten"],"Ruled out");assert.equal(chips()["Gold-plated brass"],"Ruled out");
    assert.equal(chips()["Underfine gold: 5 points less, balance copper"],"Not ruled out");assert.equal(chips()["Tungsten core in a gold shell"],"Thick shell not ruled out");
    a.run('ringBench.chooseCoin(flat.findIndex(x=>x.n.startsWith("Crown · cupronickel")))');assert.equal(a.e.constructions.hidden,true);
  }
});

// A coin ring plus the striking stick's own resonance, over light room noise. The stick must
// ring for about 100 ms (Q near 100) to survive the windowed spectrum and both persistence windows.
function stickTap(a,{coinHz,stickHz,coinAmp=.05,coinTau=.5,stickAmp=.3,stickTau=.1,seed=2024}){
  a.context.fixture={coinHz,stickHz,coinAmp,coinTau,stickAmp,stickTau,seed};
  return a.run(`(()=>{const {coinHz,stickHz,coinAmp,coinTau,stickAmp,stickTau}=fixture;let seed=fixture.seed;
    const sr=48000,x=new Float32Array(Math.ceil((PRE+CAP)*sr)),onset=Math.ceil(PRE*sr);
    for(let i=0;i<x.length;i++){seed=(1664525*seed+1013904223)>>>0;let y=(seed/4294967296*2-1)*2e-4;
      if(i>=onset){const t=(i-onset)/sr;y+=coinAmp*Math.sin(2*Math.PI*coinHz*t)*Math.exp(-t/coinTau)+stickAmp*Math.sin(2*Math.PI*stickHz*t)*Math.exp(-t/stickTau);}
      x[i]=y;}return x;})()`);
}
async function stickSession(a,coinHz,stickHz,floorOff=false){
  a.run("ringBench.newSession({kind:'file'})");if(floorOff)a.run("ringBench.getState().session.settings.analysisFloorHz=0");
  for(let i=0;i<2;i++){a.context.x=stickTap(a,{coinHz:coinHz*(1+i*.001),stickHz,seed:2024+i});assert.equal(await a.run("ringBench.accept(x,48000,ringBench.getState().session.id,{kind:'file'},2880)"),true);}
  return a.run("ringBench.getState().reading");
}
test("a ringing stick below the coin's analysis floor cannot pose as its lowest tone; the 4 Ducat ring survives",async()=>{
  for(const [coin,coinHz,stickHz] of [["Morgan Dollar",4335,300],["4 Ducat",765,300],["4 Dukata",730,250]]){
    const a=app();a.run(`ringBench.chooseCoin(flat.findIndex(c=>c.n.startsWith(${JSON.stringify(coin)})))`);
    // Without the floor the stick repeats across taps, becomes the lowest tone and fails a genuine coin.
    await stickSession(a,coinHz,stickHz,true);
    assert.equal(a.e.resultTitle.textContent,"NO PASS",coin+" without the floor");assert.match(a.e.resultSummary.textContent,new RegExp("\\("+stickHz+" Hz\\) is below"));
    const r=await stickSession(a,coinHz,stickHz);
    assert.equal(a.e.resultTitle.textContent,"PASS",coin);
    assert.ok(r.strikes.every(s=>s.analysisFloorHz>stickHz&&s.analysisFloorHz<coinHz/1.8),coin+" floor "+r.strikes[0].analysisFloorHz);
    assert.ok(r.strikes.every(s=>s.peaks.every(p=>p.f>=s.analysisFloorHz)&&s.peaks.some(p=>Math.abs(p.f/coinHz-1)<.005)),coin+": the ring is kept");
    assert.ok(r.strikes.every(s=>s.belowFloor.some(p=>Math.abs(p.f-stickHz)<2)),coin+": the stick stays visible");
    const rows=Object.fromEntries(a.e.evidenceRows.children.map(tr=>[tr.children[0].textContent,tr.children[1].textContent]));
    assert.match(rows["Below analysis floor"],new RegExp("Tap 1: "+stickHz+" Hz .*not scored"));
    assert.equal(a.run("ringBench.getState().reading.strikes[0].settings.analysisFloorHz"),r.strikes[0].analysisFloorHz,"exports record the floor");
  }
});
test("the analysis floor never hides a modelled lowest mode, and a quiet capture reports no sub-floor tone",async()=>{
  const a=app();a.run(`ringBench.chooseCoin(flat.findIndex(c=>c.n.startsWith("4 Dukata")))`);
  // The genuine band's own lower edge, well inside the capture range, is still analysed.
  const low=a.run("geometryFamily(ringBench.current()).low");a.run("ringBench.newSession({kind:'file'})");
  assert.equal(await tap(a,low*1.03),true);const s=a.run("ringBench.getState().reading.strikes[0]");
  assert.ok(Math.abs(s.peaks[0].f/(low*1.03)-1)<.002);assert.deepEqual(Array.from(s.belowFloor),[]);
  const rows=Object.fromEntries(a.e.evidenceRows.children.map(tr=>[tr.children[0].textContent,tr.children[1].textContent]));
  assert.match(rows["Below analysis floor"],/^No strike-related tone below 347 Hz$/);
});
