"use strict";
const RULES=Object.freeze({repeatability:.01,modeTolerance:.05,referencePitch:.015,minSnrDb:10,minDecayR2:.90,minDecaySpanDb:8});
const PRE=.06,CAP=.60;
const DETECTOR_VERSION="resolved-peaks-v3";
// The detector never looks below this. A coin-specific analysis floor (settings.analysisFloorHz,
// from analysisFloor) raises it so strike and support sounds cannot pose as the coin's lowest tone.
const PEAK_SEARCH_MIN_HZ=220;
const CAPTURE_RULES=Object.freeze({calibrationSeconds:.6,impactGraceMs:20,minimumRiseDb:10,persistenceSnrDb:8});
const P=c=>predict(c.mass,c.dia,c.rho,c.E,c.nu,c.qmat,c.sup,c.hmm);
function median(xs){const a=xs.slice().sort((a,b)=>a-b);return a.length%2?a[a.length>>1]:(a[a.length/2-1]+a[a.length/2])/2;}

// Short frames find an impact without diluting it into a whole audio callback.
// Compare against both the calibrated room and recent sound: a continuing ring
// or a steady fan must not become a fresh strike after the cooldown expires.
function createStrikeGate(sr,triggerDb){
  const frame=Math.max(1,Math.round(sr*.002)),history=[],calibration=[];
  let total=0,energy=0,count=0,noise=1e-5,ready=false,refractoryUntil=0;
  return {get ready(){return ready;},process(x,enabled=true){
    let hit=null;
    for(let i=0;i<x.length;i++){
      energy+=x[i]*x[i];count++;total++;
      if(count<frame)continue;
      const rms=Math.sqrt(energy/count);energy=0;count=0;
      if(!ready){
        calibration.push(rms);
        if(total>=sr*CAPTURE_RULES.calibrationSeconds){noise=Math.max(1e-5,median(calibration));ready=true;}
      }else{
        const recent=history.length?Math.sqrt(history.reduce((s,v)=>s+v*v,0)/history.length):noise;
        const threshold=Math.max(2e-4,noise*Math.pow(10,triggerDb/20),recent*Math.pow(10,CAPTURE_RULES.minimumRiseDb/20));
        if(enabled&&!hit&&total>=refractoryUntil&&rms>threshold){hit={index:Math.max(0,i-frame+1),threshold};refractoryUntil=total+Math.ceil(.25*sr);}
        if(!hit&&enabled)noise=rms<noise?noise*.95+rms*.05:noise*.998+rms*.002;
      }
      history.push(rms);if(history.length>20)history.shift();
    }
    return hit;
  }};
}

function rmsOf(x){let s=0;for(const v of x)s+=v*v;return Math.sqrt(s/Math.max(1,x.length));}

function captureBody(x,sr,onset,skipMs){
  if(!Number.isFinite(onset)||onset<Math.floor(PRE*sr)||onset>=x.length||!Number.isFinite(skipMs)||skipMs<0||skipMs>50)throw Error("Invalid strike timing.");
  for(const v of x)if(!Number.isFinite(v))throw Error("Recording contains invalid samples.");
  const impactEnd=onset+Math.ceil(CAPTURE_RULES.impactGraceMs*sr/1000);
  let impactClipped=0,lastImpactClip=-1,tailClipped=0;
  for(let i=0;i<x.length;i++)if(Math.abs(x[i])>=.995){
    if(i>=onset&&i<impactEnd){impactClipped++;lastImpactClip=i;}
    else tailClipped++;
  }
  if(tailClipped>=3)throw Error("Ringing tail is clipped. Tap more gently or move the microphone farther away.");
  const skip=Math.max(onset+Math.floor(skipMs*sr/1000),lastImpactClip<0?0:lastImpactClip+Math.ceil(.004*sr));
  const body=x.slice(skip);
  if(body.length<Math.max(2048,.45*sr))throw Error("Capture too short: keep 60 ms before and at least half a second after the strike.");
  const pre=x.slice(Math.max(0,onset-Math.ceil(.04*sr)),onset);
  let attack=0;
  const frame=Math.max(1,Math.round(.002*sr));
  for(let i=onset;i<Math.min(x.length,onset+Math.ceil(.025*sr));i+=frame)attack=Math.max(attack,rmsOf(x.subarray(i,i+frame)));
  const riseDb=20*Math.log10((attack+1e-12)/(rmsOf(pre)+1e-12));
  if(riseDb<CAPTURE_RULES.minimumRiseDb)throw Error("No distinct strike above the background. Wait for quiet, then tap once.");
  let impactPeak=0;for(let i=onset;i<impactEnd;i++)impactPeak=Math.max(impactPeak,Math.abs(x[i]||0));
  const afterImpact=rmsOf(x.slice(impactEnd,impactEnd+Math.ceil(.04*sr)));
  return {body,skip,impactClipped,tailClipped,riseDb,impulsive:impactPeak>3*Math.max(1e-9,afterImpact)};
}

// A long FFT can turn a brief noise burst into apparently narrow peaks. Require
// the same tone in two separate post-impact windows, above the pre-strike sound.
function persistentTones(pk,body,sr,preSpec,preLength,impulsive=false){
  const short=[body.slice(0,Math.floor(.08*sr)),body.slice(Math.floor(.08*sr),Math.floor(.20*sr))];
  const long=[body.slice(0,Math.floor(.24*sr)),body.slice(Math.floor(.24*sr),Math.floor(.52*sr))];
  const spectraFor=ws=>ws.map(w=>spectrum(w,sr,32768,"blackman-harris"));
  const shortSpectra=spectraFor(short),longSpectra=spectraFor(long);
  return pk.filter(p=>{
    const gap=Math.min(Infinity,...pk.filter(q=>q!==p).map(q=>Math.abs(q.f-p.f)));
    // Closely spaced lines need longer independent windows. Never borrow the
    // neighboring line's amplitude to establish persistence of this line.
    const close=gap<Math.max(100,p.f*.012),windows=close?long:short,spectra=close?longSpectra:shortSpectra;
    const amplitudes=[];
    const stable=spectra.every((s,k)=>{
    const bin=Math.round(p.f/s.binHz),radius=Math.max(1,Math.floor(Math.min(Math.max(2*s.binHz,p.f*.006),gap*.25)/s.binHz));
    let value=0,at=bin,ambient=0;
    for(let d=-radius;d<=radius;d++)if((s.mag[bin+d]||0)>value){value=s.mag[bin+d];at=bin+d;}
    for(let d=-radius;d<=radius;d++)ambient=Math.max(ambient,preSpec.mag[bin+d]||0);
    const neighbors=[],span=Math.ceil(Math.max(300,p.f*.05)/s.binHz),exclude=Math.ceil(4*sr/windows[k].length/s.binHz);
    for(let d=-span;d<=span;d++)if(Math.abs(d)>exclude&&at+d>1&&at+d<s.mag.length)neighbors.push(s.mag[at+d]);
    const local=median(neighbors),noise=Math.max(local,ambient*windows[k].length/preLength);
    amplitudes.push(value/windows[k].length);
    return value>0&&20*Math.log10((value+1e-30)/(noise+1e-30))>=CAPTURE_RULES.persistenceSnrDb;
    });
    const persistenceDropDb=amplitudes.length===2?20*Math.log10((amplitudes[0]+1e-30)/(amplitudes[1]+1e-30)):NaN;
    if(stable){p.persistenceDropDb=persistenceDropDb;p.persistenceWindows=close?"0–240 / 240–520 ms":"0–80 / 80–200 ms";}
    // A flat switched-on tone has neither a distinct impact nor a falling ring.
    // This modest change check is not a Q fit; an impulsive strike can keep a
    // very long-lived tone without meeting it.
    return stable&&(impulsive||persistenceDropDb>=.75);
  });
}

// Experimental, used only with Pro's 3D solid model. Upper plate modes decay far faster than the lowest one:
// over the full ring they can sit 50–75 dB below it, under the 42 dB peak threshold, though they are only
// 10–40 dB down in the first 100 ms. This second search looks there. Each tone must still clear the pre-strike
// noise and persist into the later window, and the fit still needs it in every tap within 1%. Its level is
// reported from the full-ring spectrum so relative levels stay comparable with the other peaks.
const EARLY_SCAN_VERSION="early-window-v1";
// It searches only above 1.4× the lowest tone the standard detector kept: strike and holder sounds are loudest in
// this window, and every modelled second mode is at least 1.5× the lowest, so it cannot change the lowest tone.
const EARLY_SCAN_MIN_RATIO=1.4;
function earlyWindowPeaks(body,sr,preRoll,S,floorHz,usableHz,impulsive,known){
  const n=Math.min(body.length,Math.floor(.1*sr)),E=spectrum(body.slice(0,n),sr,32768,"blackman-harris"),Sn=spectrum(preRoll,sr,32768,"blackman-harris");
  const from=Math.max(floorHz,EARLY_SCAN_MIN_RATIO*Math.min(...known.map(k=>k.f)));
  if(!(from<usableHz))return [];
  let pk=peaks(E.mag,E.binHz,from,usableHz,14,E.resolutionHz).filter(p=>known.every(k=>Math.abs(k.f-p.f)>4*E.resolutionHz));
  pk=rejectAmbient(pk,E,Sn,Math.min(n,32768),Math.min(preRoll.length,32768));
  pk=persistentTones(pk,body,sr,Sn,preRoll.length,impulsive);
  return pk.map(p=>{const bin=Math.round(p.f/S.binHz);let mag=0;for(let d=-2;d<=2;d++)mag=Math.max(mag,S.mag[bin+d]||0);return {...p,mag,earlyMag:p.mag,early:true};});
}
function rejectAmbient(pk,bodySpec,preSpec,bodyLength,preLength){
  const scale=bodyLength/Math.max(1,preLength);
  return pk.filter(p=>{
    const bin=Math.round(p.f/bodySpec.binHz);let n=0;
    for(let d=-1;d<=1;d++)n=Math.max(n,preSpec.mag[bin+d]||0);
    p.snrDb=20*Math.log10((p.mag+1e-30)/(n*scale+1e-30));
    return p.snrDb>=RULES.minSnrDb;
  });
}

function fft(re,im){
  const n=re.length;
  for(let i=1,j=0;i<n;i++){let bit=n>>1;
    for(;j&bit;bit>>=1)j^=bit; j^=bit;
    if(i<j){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t;}}
  for(let len=2;len<=n;len<<=1){
    const ang=-2*Math.PI/len, wr=Math.cos(ang), wi=Math.sin(ang);
    for(let i=0;i<n;i+=len){
      let cr=1,ci=0;
      for(let k=0;k<len/2;k++){
        const ur=re[i+k],ui=im[i+k];
        const vr=re[i+k+len/2]*cr-im[i+k+len/2]*ci;
        const vi=re[i+k+len/2]*ci+im[i+k+len/2]*cr;
        re[i+k]=ur+vr;im[i+k]=ui+vi;
        re[i+k+len/2]=ur-vr;im[i+k+len/2]=ui-vi;
        const ncr=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=ncr;
      }}}
}

function spectrum(x,sr,N,windowName="hann"){
  const re=new Float64Array(N), im=new Float64Array(N);
  const L=Math.min(x.length,N);
  for(let i=0;i<L;i++){const a=2*Math.PI*i/(L-1);const w=windowName==="blackman-harris"?.35875-.48829*Math.cos(a)+.14128*Math.cos(2*a)-.01168*Math.cos(3*a):.5-.5*Math.cos(a);re[i]=x[i]*w;}
  fft(re,im);
  const half=N>>1, mag=new Float64Array(half);
  for(let i=0;i<half;i++) mag[i]=Math.sqrt(re[i]*re[i]+im[i]*im[i]);
  return {mag,binHz:sr/N,resolutionHz:sr/L,windowName};
}

function peaks(mag,binHz,fmin,fmax,maxN,resolutionHz=binHz){
  const i0=Math.max(2,Math.floor(fmin/binHz)), i1=Math.min(mag.length-3,Math.ceil(fmax/binHz));
  let peak=0; for(let i=i0;i<=i1;i++) if(mag[i]>peak) peak=mag[i];
  if(peak<=0) return [];
  const floorDb=20*Math.log10(peak)-42;
  const out=[];
  for(let i=i0;i<=i1;i++){
    const db=20*Math.log10(mag[i]+1e-30);
    if(db<floorDb) continue;
    if(mag[i]<=mag[i-1]||mag[i]<mag[i+1]) continue;
    const lo=Math.max(i0,i-40),hi=Math.min(i1,i+40),acc=[];
    for(let k=lo;k<=hi;k++)acc.push(mag[k]);
    acc.sort((a,b)=>a-b);
    if(db-20*Math.log10(acc[acc.length>>1]+1e-30)<8) continue;
    const a=20*Math.log10(mag[i-1]+1e-30),b=db,c=20*Math.log10(mag[i+1]+1e-30);
    const d=0.5*(a-c)/(a-2*b+c||1e-9);
    out.push({f:(i+d)*binHz,db:b-floorDb,mag:mag[i],bin:i,resolutionHz});
  }
  out.sort((p,q)=>q.mag-p.mag);
  const keep=[];
  for(const p of out){
    const unresolved=keep.some(k=>{
      if(Math.abs(k.f-p.f)<4*resolutionHz)return true;
      let valley=Infinity;for(let i=Math.min(k.bin,p.bin);i<=Math.max(k.bin,p.bin);i++)valley=Math.min(valley,mag[i]);
      return valley>Math.min(k.mag,p.mag)*Math.pow(10,-6/20);
    });
    if(!unresolved)keep.push(p);if(keep.length>=maxN)break;
  }
  return keep.sort((p,q)=>p.f-q.f);
}

function decay(y,sr,noiseRms){
  const hop=Math.max(1,Math.floor(sr*.004)),env=[];
  for(let i=0;i+hop<=y.length;i+=hop){let s=0;for(let k=0;k<hop;k++)s+=y[i+k]**2;env.push(Math.sqrt(s/hop));}
  if(!env.length)return {valid:false,reason:"Too short"};
  let pi=0;for(let i=1;i<env.length;i++)if(env[i]>env[pi])pi=i;
  const top=env[pi],cut=Math.max(-25,20*Math.log10((noiseRms+1e-30)/(top+1e-30))+6),pts=[];
  for(let i=pi+2;i<env.length;i++){
    const db=20*Math.log10((env[i]+1e-30)/(top+1e-30));if(db<cut)break;
    pts.push([(i-pi)*hop/sr,db]);
  }
  if(pts.length<8)return {valid:false,reason:"Too little decay above noise"};
  const mx=pts.reduce((s,p)=>s+p[0],0)/pts.length,my=pts.reduce((s,p)=>s+p[1],0)/pts.length;
  let xx=0,xy=0,yy=0;for(const [x,y]of pts){xx+=(x-mx)**2;xy+=(x-mx)*(y-my);yy+=(y-my)**2;}
  const slope=xy/xx,r2=yy>0?xy*xy/(xx*yy):0,span=pts[0][1]-pts.at(-1)[1];
  const valid=Number.isFinite(slope)&&slope<0&&r2>=RULES.minDecayR2&&span>=RULES.minDecaySpanDb;
  return {valid,tau:valid?-8.685889638/slope:NaN,r2,spanDb:span,reason:valid?"":"Decay is too short, irregular or noise-limited"};
}

function summarizeStrikes(strikes,target=2){
  const f0=median(strikes.map(s=>s.f0));
  const spread=(Math.max(...strikes.map(s=>s.f0))-Math.min(...strikes.map(s=>s.f0)))/f0;
  const representative=strikes.reduce((a,b)=>Math.abs(a.f0-f0)<Math.abs(b.f0-f0)?a:b);
  const commonModes=representative.matches.filter(m=>{
    const observations=strikes.map(s=>s.matches.find(x=>x.mode===m.mode));
    if(observations.some(x=>!x))return false;
    const frequencies=observations.map(x=>x.f);
    return (Math.max(...frequencies)-Math.min(...frequencies))/median(frequencies)<=RULES.repeatability;
  }).map(m=>m.mode);
  return {...representative,f0,spread,commonModes,strikes:strikes.slice(),complete:strikes.length===target};
}

async function analyseInner(x,sr,c,settings,source,onset){
  if(!Number.isFinite(sr)||sr<8000)throw new Error("Unsupported audio sample rate.");
  const quality=captureBody(x,sr,onset,settings.skipMs),body=quality.body;
  const usableHz=Math.min(22000,.45*sr,source?.trackRate ? .45*source.trackRate : Infinity);
  const S=spectrum(body,sr,32768,"blackman-harris"),preRoll=x.slice(0,onset),Sn=spectrum(preRoll,sr,32768,"blackman-harris");
  // Searching from the floor also keeps a loud thud from setting the peak and prominence references.
  const floorHz=Math.min(Math.max(PEAK_SEARCH_MIN_HZ,settings.analysisFloorHz||0),usableHz/2);
  let pk=peaks(S.mag,S.binHz,floorHz,usableHz,14,S.resolutionHz);
  if(!pk.length)throw new Error("No usable tonal peaks. No acoustic result for this capture.");
  const i0=Math.max(2,Math.floor(floorHz/S.binHz)),i1=Math.min(S.mag.length-3,Math.ceil(usableHz/S.binHz));
  let peak=0,sum=0;for(let i=i0;i<=i1;i++){peak=Math.max(peak,S.mag[i]);sum+=S.mag[i];}
  const crestDb=20*Math.log10((peak+1e-30)/(sum/Math.max(1,i1-i0+1)+1e-30));
  if(crestDb<settings.crestDb)throw new Error("Insufficient tonal prominence above the background.");
  pk=rejectAmbient(pk,S,Sn,Math.min(body.length,32768),Math.min(preRoll.length,32768));
  if(!pk.length)throw new Error("Every peak failed the pre-strike noise check. No result.");
  pk=persistentTones(pk,body,sr,Sn,preRoll.length,quality.impulsive);
  if(!pk.length)throw new Error("No stable ringing tone after the impact. Background or brief noise was rejected.");
  // Capture independently of theory. Pro later considers alternative mode identities.
  const tone=pk.reduce((a,b)=>a.mag>=b.mag?a:b),f0=tone.f;
  if(settings.upperScan)pk=pk.concat(earlyWindowPeaks(body,sr,preRoll,S,floorHz,usableHz,quality.impulsive,pk)).sort((a,b)=>a.f-b.f);
  // Tones that arrived with the strike but sit below the floor stay visible, never scored.
  const belowFloor=floorHz>PEAK_SEARCH_MIN_HZ?rejectAmbient(peaks(S.mag,S.binHz,PEAK_SEARCH_MIN_HZ,floorHz,3,S.resolutionHz).filter(p=>p.f<floorHz),S,Sn,Math.min(body.length,32768),Math.min(preRoll.length,32768))
    .map(p=>({f:p.f,snrDb:p.snrDb,relativeDb:20*Math.log10((p.mag+1e-30)/(tone.mag+1e-30))})):[];
  const selected={offwindow:false,matches:[]}; // Mode identities belong to the later joint fit.
  let q=NaN,tau=NaN,decayFit={valid:false,reason:"Decay could not be measured"};
  try{
    const bandpassRender=async seg=>{
      const oc=new (window.OfflineAudioContext||window.webkitOfflineAudioContext)(1,seg.length,sr);
      const b=oc.createBuffer(1,seg.length,sr);b.copyToChannel(seg,0);
      const s=oc.createBufferSource();s.buffer=b;
      const bp=oc.createBiquadFilter();bp.type="bandpass";bp.frequency.value=f0;bp.Q.value=18;
      s.connect(bp);bp.connect(oc.destination);s.start();return(await oc.startRendering()).getChannelData(0);
    };
    const noise=await bandpassRender(preRoll);let ns=0;for(const v of noise)ns+=v*v;
    decayFit=decay(await bandpassRender(body),sr,Math.sqrt(ns/noise.length));
    if(decayFit.valid){tau=decayFit.tau;q=Math.PI*f0*tau;}
  }catch(e){}
  return {sr,f0,pitchRole:"dominant-tone",detectorVersion:DETECTOR_VERSION,upperScan:settings.upperScan?EARLY_SCAN_VERSION:null,pcm:x.slice(),onset,peaks:pk,analysisFloorHz:floorHz,belowFloor,q,tau,decayFit,mag:S.mag,binHz:S.binHz,nyq:sr/2,usableHz,
    offwindow:selected.offwindow,matches:selected.matches,crestDb,captureQuality:{impactClippedSamples:quality.impactClipped,tailClippedSamples:quality.tailClipped,riseDb:quality.riseDb,analysisSkipMs:(quality.skip-onset)*1000/sr},settings:{...settings},source:{...source},when:new Date().toISOString()};
}

function wavBuffer(pcm,sr){
  const buffer=new ArrayBuffer(44+pcm.length*2),v=new DataView(buffer);
  const word=(offset,text)=>{for(let i=0;i<text.length;i++)v.setUint8(offset+i,text.charCodeAt(i));};
  word(0,"RIFF");v.setUint32(4,36+pcm.length*2,true);word(8,"WAVE");word(12,"fmt ");
  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
  v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);
  word(36,"data");v.setUint32(40,pcm.length*2,true);
  for(let i=0;i<pcm.length;i++){const x=Math.max(-1,Math.min(1,pcm[i]));v.setInt16(44+i*2,Math.round(x*(x<0?32768:32767)),true);}
  return buffer;
}

function ringBuffer(f,tau,amp,sr,semis){
  const r=Math.pow(2,semis/12);
  const F=f.map(x=>x*r), T=tau.map(x=>x/r);      /* scaling both holds Q constant */
  let tmax=0; F.forEach((x,i)=>{ if(x<sr*0.45&&T[i]>tmax) tmax=T[i]; });
  const dur=Math.min(5,Math.max(1.0,6*tmax));
  const n=Math.ceil(dur*sr), y=new Float32Array(n);
  const tn=Math.ceil(0.004*sr), td=0.0012*sr;    /* the strike itself */
  for(let i=0;i<tn;i++) y[i]+=(Math.random()*2-1)*0.5*Math.exp(-i/td);
  for(let k=0;k<F.length;k++){
    if(!isFinite(F[k])||F[k]>=sr*0.47||!(amp[k]>0)||!(T[k]>0)) continue;
    const w=2*Math.PI*F[k]/sr, ph=Math.random()*6.283, d=Math.exp(-1/(T[k]*sr));
    let a=amp[k];
    for(let i=0;i<n;i++){ y[i]+=a*Math.sin(w*i+ph); a*=d; if(a<2e-5) break; }
  }
  let m=0;for(let i=0;i<n;i++){const v=Math.abs(y[i]);if(v>m)m=v;}
  if(m>0)for(let i=0;i<n;i++)y[i]*=0.82/m;
  const fo=Math.ceil(0.012*sr);
  for(let i=0;i<fo;i++) y[n-1-i]*=i/fo;
  return y;
}
