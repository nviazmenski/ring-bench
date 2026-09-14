
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
function app(edition="lite",legacy=false){
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
  const document={getElementById:id=>elements[id]||null,createElement:tag=>new Element(tag),querySelector:s=>s==='.foot'?foot:new Element(),querySelectorAll:()=>[],addEventListener(){},body};
  const storage=new Map();
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
async function tap(a,f){
  a.context.x=synthetic(a,f);
  return a.run("ringBench.accept(x,48000,ringBench.getState().session.id,{kind:'file'},2880)");
}
test("both editions boot with all 94 catalogue entries and identical theoretical predictions",()=>{
  const lite=app(),pro=app("pro");
  assert.equal(lite.run("flat.length"),94);assert.equal(pro.run("flat.length"),94);
  const previous=app("lite",true);assert.equal(lite.run("JSON.stringify(COINS)"),previous.run("JSON.stringify(COINS)"));
  assert.equal(lite.run("JSON.stringify(COINS)"),pro.run("JSON.stringify(COINS)"));
  assert.equal(lite.run("JSON.stringify(P(ringBench.current()))"),pro.run("JSON.stringify(P(ringBench.current()))"));
  for(const a of [lite,pro])a.run("flat.forEach((c,i)=>{ringBench.chooseCoin(i);if(!Number.isFinite(P(ringBench.current()).f[0]))throw Error(c.n)})");
});
test("clean ringing retains the old Lite peak and pitch estimates",async()=>{
  const old=app("lite",true),a=app(),f=a.run("P(ringBench.current()).f[0]");
  a.context.x=synthetic(a,f);old.context.x=a.context.x;
  const before=await old.run("analyseInner(x,48000,current(),settingsSnapshot(),{kind:'file'},2880)");
  const after=await a.run("analyseInner(x,48000,ringBench.current(),ringBench.snapshot(),{kind:'file'},2880)");
  assert.equal(before.f0,after.f0);assert.deepEqual(JSON.parse(JSON.stringify(before.peaks.map(p=>p.f))),JSON.parse(JSON.stringify(after.peaks.map(p=>p.f))));
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
test("one pitch-only tap is useful; Lite completes on two and Pro completes on three",async()=>{
  for(const edition of ["lite","pro"]){
    const a=app(edition),f=a.run("P(ringBench.current()).f[0]");a.run("ringBench.newSession({kind:'file'})");
    assert.equal(await tap(a,f),true);assert.equal(a.run("ringBench.getState().reading.complete"),false);
    assert.equal(a.e.result.hidden,false);assert.equal(a.e.resultTitle.textContent,edition==="lite"?"Compatible · provisional":"Inconsistent");
    await tap(a,f);assert.equal(a.run("ringBench.getState().reading.complete"),edition==="lite");
    if(edition==="pro"){await tap(a,f);assert.equal(a.run("ringBench.getState().reading.complete"),true);}
    assert.equal(a.run("ringBench.getState().reading.commonModes.length"),0);
  }
});
test("keeping one tap never claims repeatability; bad second tap retains good first",async()=>{
  const a=app(),f=a.run("P(ringBench.current()).f[0]");a.run("ringBench.newSession({kind:'file'})");await tap(a,f);
  a.context.x=new Float32Array(31680).fill(1);
  assert.equal(await a.run("ringBench.accept(x,48000,ringBench.getState().session.id,{kind:'file'},2880)"),false);
  assert.equal(a.run("ringBench.getState().reading.strikes.length"),1);assert.match(a.e.status.textContent,/retained/);
  a.run("ringBench.finish()");assert.equal(a.run("evaluateReading(ringBench.getState().reading,ringBench.current(),null).repeatable"),false);
});
test("reference formats travel between Lite and Pro, including previous Lite references",async()=>{
  const a=app(),b=app("pro"),f=a.run("P(ringBench.current()).f[0]");a.run("ringBench.newSession({kind:'file'})");await tap(a,f);await tap(a,f);
  const ref=a.run("referenceFromReading(ringBench.getState().reading,'Independently checked')");
  b.context.ref=JSON.parse(JSON.stringify(ref));assert.equal(b.run("validReference(ref)"),true);
  b.run("ref.format='ringbench-lite-reference';ref.version=1");assert.equal(b.run("validReference(ref)"),true);
  b.run("ref.strikes[0].peaks=[null]");assert.equal(b.run("validReference(ref)"),false);
});
test("Pro three-tap references are valid for Lite; matching does not need ideal mode labels",async()=>{
  const a=app("pro"),f=a.run("P(ringBench.current()).f[0]");a.run("ringBench.newSession({kind:'file'})");await tap(a,f);await tap(a,f);await tap(a,f);
  const ref=a.run("referenceFromReading(ringBench.getState().reading,'Independent provenance')");
  const b=app();b.context.ref=JSON.parse(JSON.stringify(ref));assert.equal(b.run("validReference(ref)"),true);
  assert.equal(b.run("empiricalMatches({f0:1000,peaks:[{f:2710}]},[2.7,2.72]).length"),1);
});
test("large deviation from theory is not declared counterfeit and taps that disagree are limited",async()=>{
  const a=app(),f=a.run("P(ringBench.current()).f[0]");a.run("ringBench.newSession({kind:'file'})");await tap(a,f*.9);await tap(a,f*.9);
  assert.equal(a.run("evaluateReading(ringBench.getState().reading,ringBench.current(),null).state"),"theory");
  a.run("ringBench.newSession({kind:'file'})");await tap(a,f);await tap(a,f*1.03);
  assert.equal(a.run("evaluateReading(ringBench.getState().reading,ringBench.current(),null).state"),"unstable");
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
    assert.equal(a.e.frequencyLabel.textContent,"Estimated fundamental");
    assert.ok(Math.abs(a.run("ringBench.getState().reading.f0")-fs[2])<3);
    assert.match(a.e.dominantFrequency.textContent,/Loudest resonance:/);
    a.e.reftrusted.checked=true;a.e.refnote.value="Independent instrument verification";a.run("ringBench.render()");
    assert.equal(a.e.saveref.disabled,false);a.e.saveref.click();
    const saved=a.run("Object.values(JSON.parse(localStorage.getItem(REFERENCE_KEY)))[0]");
    assert.equal(saved.pitchRole,"estimated-fundamental");
    assert.ok(Math.abs(saved.f0-fs[0])<3);
  }
});
