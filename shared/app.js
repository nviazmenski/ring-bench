"use strict";
// Both editions use this controller and the same detector. Edition entrypoints only select the workflow.
function startRingBench({edition,target,build}){
  const pro=edition==="pro", $=id=>document.getElementById(id);
  let coinIndex=0,reading=null,session=null,generation=0,busy=false,armed=false,requesting=false;
  let ac=null,stream=null,node=null,sourceNode=null,mute=null,playing=[];
  let refs={},storageOK=true,ring=null,ringW=0,filled=0,strikeGate=null,capture=null,captureN=0,onset=0,coolUntil=0;
  let captures=[],database=null,specimens={},specimenStorageOK=true;
  // Saved records this catalogue cannot use (e.g. a split coin entry) are kept and exported, never deleted.
  let retainedRefs={},retainedSpecimens={};
  const put=(id,text)=>{if($(id))$(id).textContent=text;};
  const notify=text=>{put("notice",text);$("notice").hidden=!text;};
  const percent=n=>(n>=0?"+":"")+(n*100).toFixed(2)+"%";
  const finite=(id,fallback)=>$(id)?Number($(id).value):fallback;
  const key=()=>flat[coinIndex].n+"|"+current().key;
  const options=(el,entries)=>{if(!el)return;el.replaceChildren();entries.forEach(([v,n])=>{const o=document.createElement("option");o.value=v;o.textContent=n;el.appendChild(o);});};
  const current=()=>{
    const coin=flat[coinIndex],k=$("alloy")?.value||coin.a,a=ALLOYS[k];
    return {name:coin.n,key:k,mass:finite("mass",coin.m),dia:finite("dia",coin.d),rho:rhoOf(k),E:finite("emod",a.E),nu:finite("nu",a.nu),
      qmat:finite("qmat",2000),sup:$("grip")?.value||"tongs-rubber",hmm:0,
      rimThickness:$("tsrc")?.value==="caliper"?finite("trim",0):0,plateModel:coin.solid&&$("plateModel")?.value==="solid"?coin.solid:"plate",support:$("support")?.value||"centre",
      family:{...FAMILY_DEFAULTS,widthMax:finite("widthMax",16)/100,ratioMax:finite("ratioMax",1.75),ePct:finite("ePct",5),rhoPct:finite("rhoPct",1),massPct:finite("massPct",1),diaPct:finite("diaPct",.5)}};
  };
  const snapshot=()=>{const c=current();return {coin:c.name,alloy:c.key,mass:c.mass,diameter:c.dia,E:c.E,nu:c.nu,materialQ:c.qmat,support:c.sup,
    thicknessSource:$("tsrc")?.value||"mass",rimThickness:c.rimThickness||null,geometryModel:c.plateModel!=="plate"?geometryFamily(c).model:GEOMETRY_MODEL,plateModel:c.plateModel,support:c.support,upperScan:c.plateModel!=="plate",family:c.family,
    massMeasured:$("massMeasured")?.checked||false,diameterMeasured:$("diaMeasured")?.checked||false,thicknessMeasured:$("thicknessMeasured")?.checked||false,
    triggerDb:finite("thresh",18),skipMs:finite("skip",8),crestDb:finite("crest",26),cooldownMs:finite("cooldown",1500),wear:0};};
  function inputError(){
    const ranges={mass:[.01,1000],dia:[2,200],emod:[1,500],nu:[.2,.5],qmat:[1,100000],thresh:[3,60],skip:[0,50],crest:[5,80],cooldown:[500,10000],trans:[-24,24]};
    Object.assign(ranges,{widthMax:[3,25],ratioMax:[1,2.5],ePct:[0,20],rhoPct:[0,10],massPct:[0,10],diaPct:[0,5]});
    if($("tsrc")?.value==="caliper")Object.assign(ranges,{trim:[.01,20]});
    for(const [id,[lo,hi]] of Object.entries(ranges)){const el=$(id);if(el&&(!el.value.trim()||!Number.isFinite(+el.value)||+el.value<lo||+el.value>hi))return (el.labels?.[0]?.textContent||id)+" must be between "+lo+" and "+hi+".";}
    return "";
  }
  function saveRefs(){try{localStorage.setItem(REFERENCE_KEY,JSON.stringify({...retainedRefs,...refs}));storageOK=true;return true;}catch{storageOK=false;return false;}}
  function saveSpecimens(){try{localStorage.setItem(SPECIMEN_KEY,JSON.stringify({...retainedSpecimens,...specimens}));specimenStorageOK=true;return true;}catch{specimenStorageOK=false;return false;}}
  function loadRefs(){
    try{
      const saved=JSON.parse(localStorage.getItem(REFERENCE_KEY)||"{}");refs={};retainedRefs={};
      for(const [k,raw] of Object.entries(saved)){const r=migrateSaved(raw),rk=validReference(r)?r.settings.coin+"|"+r.settings.alloy:null;if(rk&&!refs[rk])refs[rk]=r;else retainedRefs[k]=raw;}
      // Keep the installed Lite user's existing references, without changing or deleting the old key.
      const legacy=JSON.parse(localStorage.getItem("ringbench.lite.refs.v1")||"{}");
      for(const raw of Object.values(legacy)){const r=migrateSaved(raw);if(validReference(r)){const k=r.settings.coin+"|"+r.settings.alloy;if(!refs[k])refs[k]=r;}}
      saveRefs();
    }catch{storageOK=false;}
    try{
      const saved=JSON.parse(localStorage.getItem(SPECIMEN_KEY)||"{}"),migrated=Object.fromEntries(Object.entries(saved).map(([k,r])=>[k,migrateSaved(r)]));
      specimens=mergeSpecimens({},Object.values(migrated));
      retainedSpecimens=Object.fromEntries(Object.entries(saved).filter(([k])=>!(validSpecimen(migrated[k])&&specimens[specimenKey(migrated[k])]===migrated[k])));
    }catch{specimenStorageOK=false;}
  }
  function stopPlayback(){playing.forEach(s=>{try{s.stop();}catch{}});playing=[];}
  function stopMic(){
    armed=false;requesting=false;capture=null;
    if(node){node.onaudioprocess=null;try{node.disconnect();sourceNode.disconnect();mute.disconnect();}catch{}}
    if(stream)stream.getTracks().forEach(t=>{t.onended=null;t.stop();});
    node=null;stream=null;sourceNode=null;mute=null;put("arm","Start "+(pro?"three-tap test":"ping check"));$("arm").classList.remove("armed");$("level").style.width="0%";
  }
  function invalidate(message="Settings changed. Start a new check."){
    generation++;stopMic();busy=false;session=null;reading=null;stopPlayback();put("status",message);$("result").hidden=true;$("finish").hidden=true;
  }
  function chooseCoin(i){
    invalidate("Tap gently about 15 cm from the microphone.");coinIndex=i;
    const coin=flat[i],a=ALLOYS[coin.a];
    const group=COINS.find(g=>g.items.includes(coin));$("region").value=group.region;populateCoins(group.region);$("coin").value=String(i);
    for(const [id,v] of Object.entries({mass:coin.m,dia:coin.d,alloy:coin.a,emod:a.E,nu:a.nu,qmat:2000,grip:"tongs-rubber",tsrc:"mass",trim:"",trans:0,widthMax:16,ratioMax:1.75,ePct:5,rhoPct:1,massPct:1,diaPct:.5,specimenId:"",plateModel:"plate",support:"centre"}))if($(id))$(id).value=v;
    if($("solidControls"))$("solidControls").hidden=!coin.solid;
    for(const id of ["massMeasured","diaMeasured","thicknessMeasured","reftrusted"])if($(id))$(id).checked=false;
    put("refnote","");if($("refnote"))$("refnote").value="";
    try{localStorage.setItem("ringbench."+edition+".coin",coin.n);}catch{}
    render();
  }
  function populateCoins(region){options($("coin"),flat.map((c,i)=>[i,c]).filter(([,c])=>COINS.some(g=>g.region===region&&g.items.includes(c))).map(([i,c])=>[i,c.n]));}
  function showTab(name){
    document.querySelectorAll("[data-tab]").forEach(b=>{b.classList.toggle("on",b.dataset.tab===name);b.setAttribute("aria-selected",String(b.dataset.tab===name));});
    document.querySelectorAll("[data-pane]").forEach(p=>p.hidden=p.dataset.pane!==name);
    if(name==="evidence"||name==="measure")requestAnimationFrame(drawSpectrum);
  }
  function referenceForReading(){return reading?.referenceUsed||null;}
  function render(){
    const error=inputError(),c=current(),ref=refs[key()],usable=referenceState(ref,snapshot()).usable;
    document.body.dataset.metal=ALLOYS[c.key].mt||"gold";
    put("inputerror",error);$("inputerror").hidden=!error;$("arm").disabled=!!error;$("upload").disabled=!!error||busy||requesting;
    put("coinLabel",flat[coinIndex].n);
    put("referenceStatus","Geometry-family band · provisional"+(usable?" · specimen comparison available":""));
    put("referenceDetail",usable?ref.note+" · "+ref.strikes.length+" taps. Comparison windows are provisional; one specimen does not establish a genuine-coin range.":"No verified recording supplied for this coin. Save a reference from an independently checked specimen.");
    const kept=Object.keys(retainedRefs).length+Object.keys(retainedSpecimens).length;
    put("storageStatus",(storageOK?"References are saved on this device. Export to transfer between Lite and Pro.":"Device storage is unavailable. Export your reference before closing.")+(kept?" "+kept+" saved record(s) belong to catalogue entries that were split or changed; they are kept and included in exports but not used.":""));
    if(error){put("frequency","—");put("comparisonText","");if($("constructions"))$("constructions").hidden=true;return;}
    const band=geometryFamily(c),analysisCoin=session?.spec||c,estimate=reading?estimateFundamental(reading,analysisCoin):null,fingerprint=reading?acousticFingerprint(reading,analysisCoin):null,primary=fingerprint?primaryResonanceEvidence(fingerprint):null;
    const lowest=reading?lowestRepeatableHz(reading,analysisCoin):null,decided=!!reading&&reading.strikes.length>=target;
    put("frequency",lowest!==null?String(Math.round(lowest)):fingerprint?.tracks.length?fingerprint.tracks.map(t=>Math.round(t.f)).join(" · "):"—");
    put("frequencyLabel",!reading?"Lowest repeatable resonance · waiting for tap":fingerprint.repeatable&&primary?.family?"Lowest repeatable resonance · mode provisional":estimate.f0===null&&fingerprint.tracks.length?"Persistent resonances · identity unresolved":estimate.f0===null?"Lowest resonance unresolved":"Resonance candidate · one tap");
    put("dominantFrequency",reading?"Loudest resonance: "+Math.round(reading.f0)+" Hz":"");
    put("comparisonText",band.valid?"Lowest-mode model band "+Math.round(band.low)+"–"+Math.round(band.high)+" Hz":"No admissible geometry · review Model inputs");
    put("bandBasis","Model-based, not an empirical genuine-coin range. Near either edge: "+(pro?"inconclusive.":"NO PASS."));
    if(band.source==="solid")put("bandAssumptions",solidAssumptions(band));else put("bandAssumptions","Rim width 3–"+(band.options.widthMax*100).toFixed(0)+"% of radius; rim/centre thickness 1–"+band.options.ratioMax+". Assumed uncertainty: modulus ±"+band.options.ePct+"%, density ±"+band.options.rhoPct+"%, mass ±"+band.options.massPct+"%, diameter ±"+band.options.diaPct+"%. Edge guard ±2%. Relief is not modelled; clad coins use an equivalent layered plate. Tones below "+Math.round(Math.max(PEAK_SEARCH_MIN_HZ,floorFor(c)))+" Hz are treated as strike or support sound, never as the coin.");
    $("result").hidden=!reading;$("finish").hidden=!reading||reading.complete;$("finish").disabled=busy;
    const fingerprintSavable=pro&&fingerprint?.repeatable&&fingerprint.tracks.length>0;
    $("saveref").disabled=!reading||!reading.complete||!(estimate?.repeatable&&!estimate.ambiguous||fingerprintSavable)||reading.strikes.some(s=>s.offwindow)||!$("reftrusted").checked;
    if($("addSpecimen"))$("addSpecimen").disabled=$("saveref").disabled;
    renderSpecimens(c);
    for(const id of ["playRecorded","saveaudio","exporttest","saveSession"])if($(id))$(id).disabled=!reading||armed||busy||requesting;
    if(reading){
      const e=screenReading(reading,analysisCoin,pro,target);
      const summary=e.reason;
      const verdict=resultTitle(e,pro);
      put("resultTitle",verdict);put("resultSummary",summary);$("result").dataset.state=e.state;
      if(pro&&$("resultDesktop")){put("resultTitleDesktop",verdict);put("resultSummaryDesktop",summary);$("resultDesktop").hidden=false;$("resultDesktop").dataset.state=e.state;}
      const evidence=[
        ["Persistent resonance tracks",fingerprint.tracks.length?fingerprint.tracks.map(t=>t.f.toFixed(1)+" Hz ["+t.frequencies.map(f=>f.toFixed(1)).join(" / ")+"]").join("; "):"None retained across every tap"],
        ["Pattern repeatability",fingerprint.repeatable?fingerprint.tracks.length+" track(s), each within 1% across all taps":"Not established"],
        ["Lowest recurring family",e.primary.family?e.primary.family.frequencies.map(x=>x.toFixed(1)).join(" / ")+" Hz · "+(e.fieldPosition==="compatible"&&e.primary.insideLowest?"within expected lowest-mode band":e.fieldPosition==="anomalous"?"outside expected lowest-mode band":"near band edge or mode identity unresolved"):"Unavailable"],
        ["Secondary model coverage",e.primary.secondaryOutside.length?e.primary.secondaryOutside.map(a=>a.family.frequencies.map(x=>x.toFixed(1)).join(" / ")+" Hz · not represented by current model").join("; "):"No repeatable secondary family outside the current envelopes"],
        ["Peak tracking","Resolved neighbors are tracked separately; matching is limited by their spacing as well as the 1% cap."],
        ["Detector",reading.strikes.every(s=>s.detectorVersion===DETECTOR_VERSION)?"Resolution-aware detection · neighboring peaks retained when resolved · analysis floor "+Math.round(reading.strikes[0].analysisFloorHz)+" Hz"+(reading.strikes.some(s=>s.upperScan)?" · experimental early-window scan for fast-decaying upper modes"+(reading.strikes.some(s=>s.peaks.some(p=>p.early))?": "+reading.strikes.map((s,i)=>{const e=s.peaks.filter(p=>p.early);return e.length?"tap "+(i+1)+" "+e.map(p=>p.f.toFixed(1)).join(", ")+" Hz":null;}).filter(Boolean).join("; "):", none found"):""):"Earlier detector. Record again or reload exported WAVs to apply the current detector; the saved capture is unchanged."],
        ["Independent model assignments",(e.fit.matchedModeCount||0)+" supported jointly · three required only for Pro's full model fit. Nearby components of one possible split family cannot count twice."],
        ["Other observed peaks",reading.strikes.map((s,i)=>{const others=s.peaks.filter(p=>!fingerprint.tracks.some(t=>t.observations.some(o=>o.tap===i&&o.f===p.f)));return others.length?"Tap "+(i+1)+": "+others.map(p=>p.f.toFixed(1)+" Hz").join(", "):null;}).filter(Boolean).join("; ")||"None beyond the recurring tracks"],
        ["Modal-family structure",fingerprint.families.length?fingerprint.families.map(f=>f.harmonicOf!==undefined?f.centre.toFixed(1)+" Hz · possible "+f.harmonicOrder+"× harmonic of "+fingerprint.families[f.harmonicOf].centre.toFixed(1)+" Hz":f.tracks.length>1?f.frequencies.map(x=>x.toFixed(1)).join(" / ")+" Hz · possible split "+(f.split*100).toFixed(2)+"%":f.centre.toFixed(1)+" Hz · separate track").join("; "):"Unavailable"],
        ["Recurring ratios",fingerprint.ratios.length?fingerprint.ratios.map(x=>x.observed.toFixed(4)+(x.joint?" · joint model support":" · no joint absolute assignment")).join("; "):"Need at least two separate modal families"],
        ["Mode-envelope check",fingerprint.envelope?.assignments.length?fingerprint.envelope.assignments.map(a=>a.family.centre.toFixed(1)+" Hz: "+(a.excludedAsHarmonic?"possible harmonic · excluded from scoring":a.outside?"outside every modeled mode":"possible mode "+a.possible.map(x=>x.mode+1).join(" / "))).join("; "):"Unavailable"],
        ["Shared mode envelopes",fingerprint.envelope?.assignments.flatMap((a,i,all)=>all.slice(i+1).filter(b=>!a.excludedAsHarmonic&&!b.excludedAsHarmonic&&a.possible.some(m=>b.possible.some(n=>n.mode===m.mode))).map(b=>a.family.centre.toFixed(1)+" / "+b.family.centre.toFixed(1)+" Hz share a modeled mode range; this does not establish separate modes or prove splitting.")).join("; ")||"None among the recurring families"],
        ["Loudest resonances",reading.strikes.map(s=>s.f0.toFixed(1)).join(" / ")+" Hz"],
        ["Mode identity",estimate.reason],
        ["Early/late persistence",fingerprint.decay.length?fingerprint.decay.map(x=>x.f.toFixed(0)+" Hz: "+x.earlyLateDb.toFixed(1)+" dB change").join("; ")+" · descriptive only":"Unavailable; excluded from compatibility"],
        ["Relative peak levels",fingerprint.tracks.length?fingerprint.tracks.map(x=>x.f.toFixed(0)+" Hz: "+x.relativeDb.toFixed(1)+" dB").join("; ")+" · normalized within each tap, descriptive only":"Unavailable"],
        ["Below analysis floor",reading.strikes.some(s=>s.belowFloor?.length)?reading.strikes.map((s,i)=>s.belowFloor?.length?"Tap "+(i+1)+": "+s.belowFloor.map(p=>p.f.toFixed(0)+" Hz ("+(p.relativeDb>=0?"+":"")+p.relativeDb.toFixed(0)+" dB vs loudest ring tone)").join(", "):null).filter(Boolean).join("; ")+" · strike or support sound under "+Math.round(reading.strikes[0].analysisFloorHz)+" Hz, not scored":"No strike-related tone below "+Math.round(reading.strikes[0].analysisFloorHz||220)+" Hz"],
        ["Capture",reading.strikes.some(s=>s.captureQuality?.impactClippedSamples)?"Brief impact clipping excluded; ringing tail usable":"Strike and sustained-tone checks passed"],
        ["Model band",e.band.valid?Math.round(e.band.low)+"–"+Math.round(e.band.high)+" Hz · assumption-dependent":"No admissible geometry"],
        ["Recurring peaks",recurringPeaks(reading).length+" distinct observed tones"],
        ["Single-specimen comparison",referenceState(referenceForReading(),reading.settings).usable?(referenceForReading().pitchRole==="estimated-fundamental"&&estimate.f0!==null?percent(estimate.f0/referenceForReading().f0-1)+" from saved fundamental":referenceForReading().pitchRole==="modal-fingerprint"?"Saved modal fingerprint available; population scoring awaits more specimens":"Legacy reference pitch; mode identity must be reviewed"):"No specimen comparison"]
      ];
      // Until every tap is in, show measurements only: no row may hint at the outcome.
      const pending="Shown when all "+target+" taps are recorded";
      const interpretive=new Set(["Lowest recurring family","Secondary model coverage","Independent model assignments","Recurring ratios","Mode-envelope check","Shared mode envelopes","Mode identity","Single-specimen comparison"]);
      if(!decided)evidence.forEach(row=>{if(interpretive.has(row[0]))row[1]=pending;});
      if(pro&&$("ringEvidenceEmpty")){
        $("ringEvidenceEmpty").hidden=true;
        table("ringEvidenceRows",[
          ["Taps",reading.strikes.length+" of "+target],
          ["Repeatability",fingerprint.repeatable?fingerprint.tracks.length+" persistent track(s)":"Not established"],
          ["Modal families",fingerprint.families.length+" · "+fingerprint.tracks.length+" tracks"],
          ["Harmonics",fingerprint.families.filter(f=>f.harmonicOf!==undefined).length?fingerprint.families.filter(f=>f.harmonicOf!==undefined).map(f=>Math.round(f.centre)+" Hz ≈ "+f.harmonicOrder+"×").join(" / "):"None identified"],
          ["Ratios",fingerprint.ratios.length?fingerprint.ratios.map(x=>x.observed.toFixed(3)).join(" / "):"Need another family"],
          ["Loudest",reading.strikes.map(s=>Math.round(s.f0)+" Hz").join(" / ")],
          ["Theory",!decided?pending:e.diagnostic==="model-consistent"?"Lowest frequency in band · three-mode fit":e.diagnostic==="primary-consistent-secondary-unresolved"?"Lowest frequency in band · upper pattern unresolved":e.diagnostic==="primary-band-incomplete"?"Lowest frequency in band · full fit pending":e.diagnostic==="lower-mode-unconfirmed"?"Lower resonance not established":e.diagnostic==="primary-above-model"?"Lowest frequency above model band":e.state==="anomalous"?"Lowest frequency below model band":"Provisional"]
        ]);
      }
      if(pro)evidence.push(["Q · loudest resonance",reading.strikes.map(s=>Number.isFinite(s.q)?Math.round(s.q):"Unavailable").join(" / ")],["Input limit",Math.round(reading.usableHz)+" Hz · actual bandwidth unverified"]);
      table("evidenceRows",evidence);
      if(pro){table("peakRows",reading.strikes.flatMap((s,i)=>s.peaks.map(p=>["Tap "+(i+1)+" · "+p.f.toFixed(1)+" Hz",decided&&estimate.f0!==null?(p.f/estimate.f0).toFixed(4):"—",p.snrDb.toFixed(1)+" dB"])));table("strikeRows",reading.strikes.map((s,i)=>["Tap "+(i+1)+" · loudest",s.f0.toFixed(1)+" Hz",s.decayFit.valid?"Q "+Math.round(s.q):"Q unavailable"]));}
    }else{table("evidenceRows",[]);if(pro){table("peakRows",[]);table("strikeRows",[]);table("ringEvidenceRows",[]);if($("ringEvidenceEmpty"))$("ringEvidenceEmpty").hidden=false;if($("resultDesktop")){put("resultTitleDesktop","Evidence");put("resultSummaryDesktop","Record a tap to assess compatibility and repeatability.");$("resultDesktop").hidden=false;delete $("resultDesktop").dataset.state;}}}
    if(pro)renderModel(c);
    renderConstructions(analysisCoin,decided);
    requestAnimationFrame(drawSpectrum);
  }
  function table(id,rows){const body=$(id);if(!body)return;body.replaceChildren();rows.forEach(row=>{const tr=document.createElement("tr");row.forEach(text=>{const td=document.createElement("td");td.textContent=text;tr.appendChild(td);});body.appendChild(tr);});}
  // Which fakes, made to this weight and diameter, the pitch can rule out. Before a complete
  // reading this shows what the screen can separate; afterwards, what this coin's tone excludes.
  function constructionText(r,screen,metal){
    const hz=f=>String(Math.round(f)),pct=x=>Math.round(100*x)+"%",range=r.band.valid?hz(r.band.low)+"–"+hz(r.band.high)+" Hz":"";
    const thick=r.band.valid&&Math.abs(r.thickness-1)>=.03?" At this weight it would be "+r.thickness.toFixed(2)+"× as thick as a genuine coin.":"";
    const extra=(r.magnetic?" A magnet also catches it.":"")+thick;
    if(r.separation.state==="no-shape"||r.match?.status==="no-shape")return {verdict:"thick",chip:"Calipers catch it",detail:"At this weight it would be "+r.thickness.toFixed(2)+"× as thick as a genuine coin, which is beyond the plate model."};
    const m=r.match,f=screen.reading?.f;
    if(!m){
      const s=r.separation;
      if(s.state==="separated")return {verdict:"clear",chip:"Pitch catches it",detail:"Would ring at "+range+", at least "+pct(s.margin)+" "+(s.direction==="higher"?"above":"below")+" the genuine range."+extra};
      if(s.state==="thin-shells")return {verdict:"caution",chip:"Thin shells only",detail:"Pitch catches it while the "+metal+" shell is under "+pct(s.faceThickness)+" of the thickness ("+pct(s.faceMass)+" of the weight). Plated "+r.con.coreName+" rings at "+range+"; thicker shells overlap the genuine range."};
      if(s.state==="overlaps")return {verdict:"caution",chip:"Pitch can’t tell",detail:(r.shell?"Even a thin "+metal+" shell overlaps the genuine range.":"Its range ("+range+") overlaps the genuine range.")+(r.con.caveat?" "+r.con.caveat:"")};
      return {verdict:"pending",chip:"—",detail:"No admissible genuine geometry; review the model inputs."};
    }
    if(m.status==="unknown")return {verdict:"pending",chip:"Not assessed",detail:"No repeatable lowest tone, so this reading cannot rule it out."};
    if(m.status==="ruled-out")return {verdict:"clear",chip:"Ruled out",detail:r.shell?"No "+metal+" shell over "+r.con.coreName+" rings at "+hz(f)+" Hz.":"It would ring at "+range+"; this coin’s lowest repeatable tone is "+hz(f)+" Hz."+extra};
    if(r.shell){
      const [from,to]=m.faceThickness,[mFrom,mTo]=m.faceMass;
      if(m.status==="thick-shells")return {verdict:"caution",chip:"Thick shell not ruled out",detail:to<1?"Only a "+metal+" shell of "+pct(from)+"–"+pct(to)+" of the thickness ("+pct(mFrom)+"–"+pct(mTo)+" of the weight) rings at "+hz(f)+" Hz.":"Ruled out unless the "+metal+" shell is at least "+pct(from)+" of the thickness ("+pct(mFrom)+" of the weight)."};
      return {verdict:"caution",chip:"Not ruled out",detail:"Plated "+r.con.coreName+(to>0?", or a "+metal+" shell up to "+pct(to)+" of the thickness ("+pct(mTo)+" of the weight),":"")+" rings at "+hz(f)+" Hz."};
    }
    const where=m.position==="upper-modes"?"The recurring tones fit it as upper modes with its lowest mode missed.":hz(f)+" Hz is "+(m.position==="compatible"?"inside":"near the edge of")+" its range ("+range+").";
    return {verdict:"caution",chip:"Not ruled out",detail:where+(r.con.caveat?" "+r.con.caveat:"")+extra};
  }
  function renderConstructions(c,decided){
    const section=$("constructions");if(!section)return;
    const screen=screenConstructions(decided?reading:null,c,target),metal=ALLOYS[c.key]?.mt==="gold"?"gold":"silver";
    section.hidden=!screen.rows.length;if(!screen.rows.length)return;
    const list=$("constructionRows");list.replaceChildren();
    const texts=screen.rows.map(r=>({r,...constructionText(r,screen,metal)}));
    for(const {r,verdict,chip,detail} of texts){
      const item=document.createElement("div"),head=document.createElement("div"),name=document.createElement("span"),tag=document.createElement("span"),note=document.createElement("p");
      item.className="construction";item.dataset.verdict=verdict;head.className="construction-head";name.className="construction-name";tag.className="chip";
      name.textContent=r.n;tag.textContent=chip;note.textContent=detail;
      head.appendChild(name);head.appendChild(tag);item.appendChild(head);item.appendChild(note);list.appendChild(item);
    }
    const n=screen.rows.length,count=state=>screen.rows.filter(r=>r.separation.state===state).length;
    let summary;
    if(!screen.reading){
      const sep=count("separated"),thin=screen.rows.filter(r=>r.separation.state==="thin-shells"),thick=count("no-shape");
      summary="At this weight and diameter, pitch alone separates "+sep+" of "+n+" listed fakes from a genuine coin"+(thin.length?", plus a "+thin.map(r=>r.con.coreName).join(" or ")+" core while its "+metal+" shell is thin":"")+"."+(thick?" Calipers catch "+thick+" more: at this weight "+(thick>1?"they":"it")+" would be much thicker than a genuine coin.":"")+(decided?"":" Complete the test to see what this coin rules out.");
    }else if(screen.reading.state!=="repeatable")summary="No repeatable lowest tone, so no fake is ruled out yet.";
    else{
      const out=screen.rows.filter(r=>r.match.status==="ruled-out"||r.match.status==="no-shape").length,open=texts.filter(x=>x.verdict==="caution").map(x=>x.r.n);
      summary="This coin’s lowest repeatable tone ("+Math.round(screen.reading.f)+" Hz) rules out "+out+" of "+n+" listed fakes."+(open.length?" Not fully ruled out: "+open.join("; ")+".":"");
    }
    put("constructionSummary",summary);
    put("constructionNote","Assumes a fake made to "+(pro?"the entered":"the catalogue")+" weight and diameter: the kind that passes a scale and calipers. Each fake’s band uses handbook material ranges in the same plate model as the genuine band. A copy struck in the correct metal rings like a genuine coin, and no pitch or metal test catches it. Confirm with an electromagnetic tester, such as a Sigma.");
  }
  function referenceReading(){
    const e=estimateFundamental(reading,session.spec),fingerprint=acousticFingerprint(reading,session.spec);
    if(e.f0===null)return {...reading,f0:null,spread:null,pitchRole:"modal-fingerprint",fingerprint};
    return {...reading,f0:e.f0,spread:e.spread,pitchRole:e.basis==="joint-pattern"?"estimated-fundamental":"provisional-tone",fingerprint,strikes:reading.strikes.map((s,i)=>({...s,f0:e.taps[i]}))};
  }
  function renderSpecimens(c){
    const stats=specimenStats(specimens,c.name,c.key),prior=$("specimenSelect")?.value;
    options($("specimenSelect"),stats.samples.map(r=>[specimenKey(r),r.specimenId+(Number.isFinite(r.f0)?" · "+Math.round(r.f0)+" Hz":" · modal fingerprint")]));
    if(prior&&stats.samples.some(r=>specimenKey(r)===prior))$("specimenSelect").value=prior;
    put("specimenStats",stats.count?(Number.isFinite(stats.median)?stats.count+" independently labelled specimen(s). Labelled-fundamental median "+Math.round(stats.median)+" Hz; range "+Math.round(stats.min)+"–"+Math.round(stats.max)+" Hz. ":stats.count+" independently labelled specimen(s); no unique fundamentals assigned. ")+stats.fingerprintCount+" modal fingerprint(s) available.":"No independently verified specimens collected for this coin yet.");
    put("specimenCaution","Observed sample ranges are descriptive, not calibrated acceptance limits. Reuse the same specimen ID when recording the same physical coin again."+(specimenStorageOK?"":" Storage unavailable: export before closing."));
  }
  function modelExample(c){
    const family=geometryFamily(c),base=P(c);
    if(!family.valid)return null;
    const sorted=family.candidates.slice().sort((a,b)=>Math.min(...a.f)-Math.min(...b.f)),g=sorted[Math.floor(sorted.length/2)];
    const f=g.f.slice(),tau=f.map((v,i)=>base.Q[i]/(Math.PI*v));
    return {...base,f,tau,h:family.h,geometry:g,solid:family.source==="solid",scored:family.scored};
  }
  function renderModel(c){
    const decided=!!reading&&reading.strikes.length>=target,family=geometryFamily(c),nom=flat[coinIndex],fit=decided?fitGeometryFamily(reading,c):null,fingerprint=reading?acousticFingerprint(reading,c):null;
    put("catalogue",nom.m+" g · "+nom.d+" mm · "+ALLOYS[nom.a].n);put("catalogueNote",nom.note||"");
    put("modelFrequency",family.valid?Math.round(family.low)+"–"+Math.round(family.high)+" Hz":"No admissible geometry");
    put("modelThickness","Volume-equivalent thickness "+family.h.toFixed(3)+" mm");
    put("geometrySource",family.source==="solid"?family.candidates.length+" cross-sections ("+new Set(family.candidates.map(g=>g.sample)).size+" sampled Morgan profiles) · rim "+family.rims[0].toFixed(2)+"–"+family.rims[1].toFixed(2)+" mm "+(family.rimMeasured?"from your caliper reading":"catalogue prior")+(family.valid?"":" · "+family.reason):family.candidates.length+" sampled shapes · "+(c.rimThickness?"rim thickness constrained by your entry":"mass conserved across centre/rim shapes"));
    if($("modelNote"))put("modelNote",family.source==="solid"?"Experimental 3D elastic solid: shear, rotary inertia, die basin, smeared relief, denticles and rim are modelled; the cross-section is averaged around the coin, so split pairs are not predicted. Mode ranges below use nominal material values; the main band also propagates the stated uncertainties.":"Experimental concentric centre/rim model. Relief, support-induced pitch shifts and layered construction are not represented. Mode ranges below use nominal material values; the main band also propagates the stated uncertainties.");
    if($("familyBounds"))$("familyBounds").hidden=family.source==="solid";
    put("solidNote",!flat[coinIndex].solid?"":c.plateModel==="plate"?"The experimental 3D model includes shear, rotary inertia, the die basin, relief and denticles. It changes Pro's band and fit for this coin only.":"Experimental: a 3D elastic solid with the Morgan cross-section. Split tones are scored at their centroid"+(c.support==="centre"?"; the (0,1) and (1,1) modes, which a centre support damps and stiffens, are shown but not scored":"")+". Fakes in the construction screen still use the thin-plate model.");
    table("modeRows",family.valid?MODES.map((m,i)=>{
      const fs=family.candidates.map(g=>g.f[i]),rs=family.candidates.map(g=>g.f[i]/Math.min(...g.f));
      return [m.id,Math.round(Math.min(...fs))+"–"+Math.round(Math.max(...fs))+" Hz",Math.min(...rs).toFixed(3)+"–"+Math.max(...rs).toFixed(3)];
    }):[]);
    put("materialFit",!fit?"Record all "+target+" taps to fit their recurring peaks.":fit.state==="compatible"?"The selected material is theoretically compatible with "+fit.best.matches.length+" of "+(fit.observed.length+(fit.harmonicCount||0))+" recurring "+(fit.family.source==="solid"?"families":"peaks")+". Unassigned peaks remain unexplained.":fit.state==="insufficient"&&fingerprint?.ratios.length?fingerprint.tracks.length+" repeatable tracks retained; ratio "+fingerprint.ratios.map(x=>x.observed.toFixed(4)).join(" / ")+". At least three jointly fitted modal families are required for positive theoretical compatibility.":fit.state==="insufficient"?"Insufficient evidence: at least three distinct recurring modal families are needed.":"No joint match within the selected material and geometry assumptions.");
    const shapes=fit?.supported||[],unique=new Map(shapes.map(x=>[x.geometry.width+"|"+x.geometry.ratio,x.geometry]));
    if(unique.size&&family.source==="solid"){
      const gs=[...unique.values()],range=(f,d=2)=>{const v=gs.map(f);return Math.min(...v).toFixed(d)+"–"+Math.max(...v).toFixed(d);};
      // Cross-sections whose three or more fitted modes all agree within 0.5%: their ratios pin the shape, and the
      // lowest mode then implies an effective modulus at the assumed density (f scales with √E).
      const close=(fit.supported||[]).filter(x=>x.matches.length>=3&&x.matches.every(m=>Math.abs(m.measured/(m.predicted*x.freeScale)-1)<=.005));
      const E=close.map(x=>c.E*x.freeScale**2),closeText=close.length?" Closest fits (every fitted mode within 0.5%): die basin "+Math.min(...close.map(x=>x.geometry.params.s)).toFixed(2)+"–"+Math.max(...close.map(x=>x.geometry.params.s)).toFixed(2)+" mm per side; the lowest mode then implies an effective modulus of "+Math.min(...E).toFixed(0)+"–"+Math.max(...E).toFixed(0)+" GPa at the assumed density (entered "+c.E+" GPa). Descriptive only; not scored.":"";
      put("geometryUncertainty",new Set(gs.map(g=>g.sample)).size+" of "+new Set(family.candidates.map(g=>g.sample)).size+" sampled Morgan cross-sections remain possible: die basin "+range(g=>g.params.s)+" mm per side, rim "+range(g=>g.rim)+" mm, through-thickness shear "+range(g=>g.params.g)+"× isotropic. This does not resolve cross-sections outside the sampled priors."+closeText);
    }else if(unique.size){
      const gs=[...unique.values()];
      put("geometryUncertainty",unique.size+" sampled shapes remain possible; rim width "+(100*Math.min(...gs.map(g=>g.width))).toFixed(1)+"–"+(100*Math.max(...gs.map(g=>g.width))).toFixed(1)+"% of radius, rim/centre ratio "+Math.min(...gs.map(g=>g.ratio)).toFixed(2)+"–"+Math.max(...gs.map(g=>g.ratio)).toFixed(2)+". This does not resolve geometry outside the sampled family.");
    }else put("geometryUncertainty",fit?"Geometry remains unresolved. A missing joint fit can reflect the model, material, or mode assignment.":"Geometry uncertainty will be shown separately from material compatibility.");
    if(fit&&fit.state!=="compatible"&&(fit.matchedModeCount||0)>0)put("materialFit",(fit.observed.length+(fit.harmonicCount||0))+" recurring tone(s); the best supported assignment contains "+fit.matchedModeCount+" distinct modeled modes. Three are required. This is insufficient model evidence, not a failed coin test.");
    const best=fit?.best;
    put("fitResidual",best?"Best candidate: "+best.matches.length+" peaks; frequency RMS residual "+(best.residual*100).toFixed(2)+"%, largest ratio residual "+(best.ratioResidual*100).toFixed(2)+"%. Common scale "+best.scale.toFixed(4)+".":"No joint peak assignment yet.");
    table("fitRows",best?best.matches.map(p=>[p.measured.toFixed(1),MODES[p.mode].id,(p.predicted*best.scale).toFixed(1),(p.measured/best.matches[0].measured).toFixed(4),(p.predicted/best.matches[0].predicted).toFixed(4)]):[]);
    const b=comparison(c),bf=geometryFamily(b);
    put("comparisonModel",bf.valid?Math.round(bf.low)+"–"+Math.round(bf.high)+" Hz · comparison family; modelled mass "+b.mass.toFixed(4)+" g":"No admissible comparison geometry");
    const hypotheses=Object.entries(ALLOYS).map(([k,a])=>{
      const other={...c,key:k,rho:rhoOf(k),E:a.E,nu:a.nu},f=geometryFamily(other),joint=decided?fitGeometryFamily(reading,other):null;
      return {name:a.n,joint,row:[a.n,f.valid?Math.round(f.low)+"–"+Math.round(f.high)+" Hz":"No shape",joint?.state==="compatible"?"Joint fit · "+joint.best.matches.length+" peaks":joint?.state==="insufficient"?"Insufficient peaks":joint?"No joint fit":"No recording"]};
    });
    table("hypothesisRows",hypotheses.map(h=>h.row));
    const surviving=hypotheses.filter(h=>h.joint?.state==="compatible");
    put("materialAmbiguity",decided?(surviving.length>1?surviving.length+" listed material hypotheses fit. Composition is not identified.":surviving.length===1?"One listed material hypothesis fits; unlisted materials and geometries remain possible.":"No material identification from the current evidence."):"Material compatibility will be assessed across the listed hypotheses.");
    put("hypothesisGeometry","Same mass and diameter for each hypothesis; each assumed density changes the mass-conserving geometry family. A fit needs at least three recurring peaks and their ratios.");
    const au=finite("spotAu",0),ag=finite("spotAg",0),fractions=ALLOYS[c.key].f||{};
    put("meltValue",((fractions.Au&&au<=0)||(fractions.Ag&&ag<=0))?"Enter a spot price for each precious metal.":"$"+(c.mass/31.1034768*((fractions.Au||0)*au+(fractions.Ag||0)*ag)).toFixed(2)+" · entered prices");
    put("catalogueCount",flat.length+" catalogue entries · specifications, not verified recordings");
    put("transposeNotice",finite("trans",0)?"Playback transposed "+finite("trans",0)+" semitones":"Playback of an illustrative family member");
  }
  function comparison(c){
    const index=finite("cmpCoin",coinIndex),nom=flat[index],same=index===coinIndex,k=$("cmpAlloy").value,a=ALLOYS[k],rho=rhoOf(k);
    const mass=same?(c.hmm>0?Math.PI*(c.dia/20)**2*c.hmm/10*rho:c.mass*rho/c.rho):nom.m*rho/rhoOf(nom.a);
    // Another coin keeps neither this coin's rim reading nor a cross-section model it does not have.
    return {...c,key:k,mass,dia:same?c.dia:nom.d,rho,E:a.E,nu:a.nu,hmm:same?c.hmm:0,rimThickness:same?c.rimThickness:0,plateModel:same||nom.solid===c.plateModel?c.plateModel:"plate"};
  }
  function audio(){if(!ac)ac=new(window.AudioContext||window.webkitAudioContext)();ac.resume();return ac;}
  function playPCM(y,sr,at=0){const ctx=audio(),b=ctx.createBuffer(1,y.length,sr);b.copyToChannel(y,0);const s=ctx.createBufferSource();s.buffer=b;s.connect(ctx.destination);s.start(at||ctx.currentTime);playing.push(s);return y.length/sr;}
  // A model failure must not block capture: the detector then keeps its own minimum.
  function floorFor(spec){try{return analysisFloor(spec).hz;}catch{return 0;}}
  function solidAssumptions(band){
    const o=band.options,n=new Set(band.candidates.map(g=>g.sample)).size;
    return "Experimental 3D elastic solid: "+n+" sampled Morgan cross-sections with a die basin of 0–0.16 mm per side, smeared relief and denticles, and a solid rim of "+band.rims[0].toFixed(2)+"–"+band.rims[1].toFixed(2)+" mm. Assumed uncertainty: modulus ±"+o.ePct+"%, density ±"+o.rhoPct+"%, mass ±"+o.massPct+"%, diameter ±"+o.diaPct+"%. Edge guard ±2%. "+(band.valid?"":band.reason+" ")+"Tones below "+Math.round(Math.max(PEAK_SEARCH_MIN_HZ,floorFor(current())))+" Hz are treated as strike or support sound, never as the coin.";
  }
  function newSession(source){invalidate();const spec=current();session={id:generation,spec,settings:{...snapshot(),analysisFloorHz:floorFor(spec)},reference:refs[key()]||null,source,strikes:[],files:new Set()};$("reftrusted").checked=false;$("refnote").value="";render();return generation;}
  const active=id=>session?.id===id&&generation===id;
  async function arm(){
    if(armed||requesting){finish();return;}const error=inputError();if(error){notify(error);return;}
    notify("");const id=newSession(null);requesting=true;put("arm","Cancel microphone request");put("status","Allow microphone access when prompted.");
    let requested=null;
    try{
      const ctx=audio();await ctx.resume();if(!active(id))return;
      if(!navigator.mediaDevices?.getUserMedia)throw Error("Open this app in Safari over HTTPS to use the microphone.");
      requested=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:1}});
      if(!active(id)){requested.getTracks().forEach(t=>t.stop());return;}
      stream=requested;const track=stream.getAudioTracks()[0],s=track.getSettings?.()||{};
      if(s.echoCancellation||s.noiseSuppression||s.autoGainControl)throw Error("Microphone voice processing is enabled. Choose a standard microphone input.");
      session.source={kind:"microphone",contextRate:ctx.sampleRate,trackRate:s.sampleRate||null,device:track.label||"unreported",echoCancellation:s.echoCancellation??null,noiseSuppression:s.noiseSuppression??null,autoGainControl:s.autoGainControl??null};
      track.onended=()=>{if(active(id)){finish();put("status","Microphone disconnected. Any accepted tap is retained.");}};
      ring=new Float32Array(Math.ceil(PRE*ctx.sampleRate));ringW=0;filled=0;strikeGate=createStrikeGate(ctx.sampleRate,session.settings.triggerDb);
      sourceNode=ctx.createMediaStreamSource(stream);node=ctx.createScriptProcessor(1024,1,1);mute=ctx.createGain();mute.gain.value=0;
      node.onaudioprocess=onBlock;sourceNode.connect(node);node.connect(mute);mute.connect(ctx.destination);
      armed=true;requesting=false;coolUntil=0;put("arm","Stop listening");$("arm").classList.add("armed");put("status","Measuring background… wait for Ready before tapping.");render();
    }catch(e){if(requested)requested.getTracks().forEach(t=>t.stop());if(active(id)){stopMic();put("status",e.name==="NotAllowedError"?"Microphone permission was denied. Allow it in Safari’s website settings, then start again.":e.message);render();}}
  }
  function onBlock(event){
    if(!armed||!session)return;const x=event.inputBuffer.getChannelData(0),sr=ac.sampleRate;
    let sum=0;for(const v of x)sum+=v*v;const rms=Math.sqrt(sum/x.length);
    $("level").style.width=Math.min(100,Math.max(0,(20*Math.log10(rms+1e-9)+70)*1.6))+"%";
    const wasReady=strikeGate.ready,hit=strikeGate.process(x,!capture&&!busy&&Date.now()>=coolUntil&&filled===ring.length);
    if(!wasReady&&strikeGate.ready)put("status","Ready. Tap once and let it ring.");
    if(capture){const n=Math.min(x.length,capture.length-captureN);capture.set(x.subarray(0,n),captureN);captureN+=n;if(captureN>=capture.length){const done=capture;capture=null;accept(done,sr,session.id,session.source,onset);}}
    else if(hit&&!busy&&Date.now()>=coolUntil&&filled===ring.length){
      capture=new Float32Array(Math.ceil((PRE+CAP)*sr));for(let i=0;i<ring.length;i++)capture[i]=ring[(ringW+i)%ring.length];
      const first=x.findIndex((v,i)=>i>=hit.index&&Math.abs(v)>=hit.threshold);onset=ring.length+(first>=0?first:hit.index);
      capture.set(x,ring.length);captureN=ring.length+x.length;put("status","Tap captured. Listening to the ring…");
    }
    for(const v of x){ring[ringW]=v;ringW=(ringW+1)%ring.length;}filled=Math.min(ring.length,filled+x.length);
  }
  function reject(message){
    const advice=/clipp/i.test(message)?"The ringing tail is distorted. Tap more gently or move the microphone farther away.":message;
    put("status",(reading?"Previous tap retained. ":"Capture failed. ")+advice);render();
  }
  async function accept(x,sr,id,source,onset){
    if(!active(id)||busy||session.strikes.length>=target)return false;busy=true;render();
    try{
      const result=await analyseInner(x,sr,session.spec,session.settings,source,onset);if(!active(id))return false;
      session.strikes.push(result);session.source=source;reading={...summarizeStrikes(session.strikes,target),referenceUsed:session.reference};
      options($("audioStrike"),reading.strikes.map((s,i)=>[i,"Tap "+(i+1)]));
      if(reading.complete){stopMic();put("status",target+" taps recorded. Result held for review.");}
      else put("status",armed?"Tap "+session.strikes.length+" ready. Let the ring fade, then tap again or keep this reading.":"Tap ready. Load a different recording to check repeatability, or keep this reading.");
      return true;
    }catch(e){if(active(id))reject(e.message);return false;}
    finally{if(active(id)){busy=false;coolUntil=Date.now()+session.settings.cooldownMs;render();}}
  }
  function finish(){
    generation++;if(session)session.id=generation;busy=false;stopMic();
    if(reading){reading.complete=true;put("status","Reading kept. "+(reading.strikes.length===1?"Repeatability was not checked.":reading.strikes.length+" accepted taps."));}
    else put("status","Listening stopped. No tap recorded.");render();
  }
  async function upload(file){
    if(!file||busy||requesting)return;if(file.size>25*1024*1024){notify("Use audio smaller than 25 MB.");return;}
    if(inputError()){notify(inputError());return;}
    if(!session||session.source?.kind!=="file"||reading?.complete)newSession({kind:"file"});
    stopMic();const id=session.id;busy=true;render();
    try{
      const ctx=audio(),bytes=await file.arrayBuffer();if(!active(id))return;
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(v=>v.toString(16).padStart(2,"0")).join("");if(!active(id))return;
      if(session.files.has(hash))throw Error("This recording already counts as a tap. Load a different recording.");
      const b=await ctx.decodeAudioData(bytes);if(!active(id))return;if(b.duration>30)throw Error("Use a recording under 30 seconds with one tap.");
      const x=b.getChannelData(0),sr=b.sampleRate,W=Math.max(1,Math.floor(.002*sr));let max=0,at=0;
      for(let i=0;i+W<=x.length;i+=W){let s=0;for(let k=0;k<W;k++)s+=x[i+k]**2;if(s>max){max=s;at=i;}}
      while(at>=W){let s=0;for(let k=0;k<W;k++)s+=x[at-W+k]**2;if(s<max*.01)break;at-=W;}
      const pre=Math.ceil(PRE*sr);if(at<pre)throw Error("Leave at least 60 ms of quiet before the tap.");
      busy=false;const ok=await accept(x.slice(at-pre,at+Math.ceil(CAP*sr)),sr,id,{kind:"file",contextRate:sr,trackRate:null,device:"Decoded file; original bandwidth unknown"},pre);
      if(ok&&active(id))session.files.add(hash);
    }catch(e){if(active(id))reject(e.message);}finally{if(active(id)){busy=false;render();}}
  }
  function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  const json=(data,name)=>download(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),name);
  const stamp=()=>new Date().toISOString().replace(/[:.]/g,"-");
  function exportTest(){
    if(!reading)return;const r=reading;
    json({format:"ringbench-test",version:5,edition,build,detector:DETECTOR_VERSION,model:GEOMETRY_MODEL,settings:r.settings,source:r.source,reference:r.referenceUsed,
      medianHz:r.f0,spread:r.spread,complete:r.complete,rules:RULES,captureRules:CAPTURE_RULES,evaluation:screenReading(r,session.spec,pro,target),acousticFingerprint:acousticFingerprint(r,session.spec),geometryFit:pro&&r.strikes.length>=target?fitGeometryFamily(r,session.spec):null,constructionScreen:constructionExport(screenConstructions(r.strikes.length>=target?r:null,session.spec,target)),
      strikes:r.strikes.map(({pcm,mag,...s},i)=>({...s,tap:i+1,audioSamples:pcm.length,mag:Array.from(mag)})),audioNote:"Export WAV separately for each tap; timestamps identify matching audio."},"ringbench-test-"+stamp()+".json");
  }
  function drawSpectrum(){
    const cv=$("spectrum");if(!cv||!cv.clientWidth)return;const g=cv.getContext("2d"),W=cv.clientWidth,H=cv.clientHeight||260,dpr=window.devicePixelRatio||1;cv.width=W*dpr;cv.height=H*dpr;g.scale(dpr,dpr);g.clearRect(0,0,W,H);
    const colors=getComputedStyle(document.body),color=colors.getPropertyValue("--goldhi");g.fillStyle=colors.getPropertyValue("--dim");g.font="12px system-ui";
    // Guides: the first three thin-plate slots, or in the solid model the three lowest scored modes, named by mode.
    const example=pro?modelExample(session?.spec||current()):null,guides=!example?null:example.solid?example.f.map((f,i)=>({f,label:MODES[i].id})).filter((x,i)=>example.scored[i]).sort((a,b)=>a.f-b.f).slice(0,3):example.f.slice(0,3).map((f,i)=>({f,label:["Primary","Secondary","Tertiary"][i]}));
    const predicted=guides?.map(x=>x.f)||null;
    if(!reading&&!pro){put("spectrumScale","The chart will scale to the measured signal while retaining useful headroom.");g.fillText("Record a tap to see its measured spectrum.",14,30);return;}
    const max=reading?Math.max(...reading.mag):0,common=reading?recurringPeaks(reading):[],peakMax=reading?Math.max(reading.f0||0,...common.map(p=>p.f)):0;
    const visibleFloor=max*Math.pow(10,-50/20);let lastVisible=0;if(reading)for(let i=0;i<reading.mag.length;i++)if(reading.mag[i]>=visibleFloor)lastVisible=i;
    const signalMax=reading?lastVisible*reading.binHz:0,rawLimit=Math.max(8000,peakMax*1.35,signalMax*1.08,predicted?.[2]*1.08||0),step=rawLimit<=16000?2000:4000;
    const limit=Math.min(reading?.usableHz||24000,Math.ceil(rawLimit/step)*step);const floorHz=reading?.strikes?.[0]?.analysisFloorHz;put("spectrumScale","Display 0–"+(limit/1000).toFixed(limit%1000?1:0)+" kHz · "+(reading?"scaled to the measured signal and recurring tones."+(floorHz?" Shaded: below the "+Math.round(floorHz)+" Hz analysis floor, not scored.":""):"model guides shown before recording."));
    if(floorHz){g.save();g.globalAlpha=.12;g.fillStyle=color;g.fillRect(35,12,Math.min(floorHz,limit)/limit*(W-45),H-40);g.restore();}
    if(reading){g.strokeStyle=color;g.lineWidth=1;g.beginPath();
    for(let px=0;px<W-45;px++){let peak=0;const from=Math.floor(px/(W-45)*limit/reading.binHz),to=Math.max(from+1,Math.ceil((px+1)/(W-45)*limit/reading.binHz));for(let j=from;j<to;j++)peak=Math.max(peak,reading.mag[j]||0);const db=Math.max(-70,20*Math.log10((peak+1e-30)/(max+1e-30))),y=18-db/70*(H-48);if(px)g.lineTo(35+px,y);else g.moveTo(35+px,y);}g.stroke();}
    for(let f=0;f<=limit;f+=step)g.fillText((f/1000)+"k",35+f/limit*(W-45),H-6);
    if(pro){
      const labels=guides?.map(x=>x.label)||[];
      put("spectrumGuides",predicted?predicted.map((f,i)=>labels[i]+" model "+Math.round(f).toLocaleString()+" Hz"+(f>limit?" (above display range)":"")).join(" · ")+" · representative "+(example.solid?"cross-section":"geometry")+"; model ranges are in Model.":"No model guides available for these inputs.");
      if(predicted)predicted.forEach((f,i)=>{if(f>limit)return;const x=35+f/limit*(W-45),label=labels[i]+" · "+Math.round(f).toLocaleString()+" Hz";
        g.strokeStyle="#8FD9A8";g.lineWidth=1.5;g.setLineDash([5,4]);g.beginPath();g.moveTo(x,12);g.lineTo(x,H-28);g.stroke();g.setLineDash([]);
        g.font="12px system-ui";const labelX=Math.max(38,Math.min(x+5,W-g.measureText(label).width-10));g.fillStyle="#8FD9A8";g.fillText(label,labelX,24+i*19);
      });
    }
    // Mark the same lowest repeatable resonance as the headline; fall back to the loudest tone.
    if(reading){const lowest=lowestRepeatableHz(reading,session?.spec||current()),estimated=lowest??reading.f0;if(Number.isFinite(estimated)&&estimated<=limit){g.strokeStyle=pro?"#91CFFF":"#8FD9A8";const x=35+estimated/limit*(W-45);g.beginPath();g.moveTo(x,12);g.lineTo(x,H-28);g.stroke();if(pro){const label=(lowest!==null?"Measured · ":"Loudest · ")+Math.round(estimated).toLocaleString()+" Hz";g.fillStyle="#91CFFF";g.fillText(label,Math.max(38,Math.min(x+5,W-g.measureText(label).width-10)),H-36);}}}
    g.fillStyle=colors.getPropertyValue("--dim");g.fillText("Hz",W-24,H-6);
  }
  async function openDB(){
    if(database)return database;
    database=await new Promise((resolve,reject)=>{if(!window.indexedDB){reject(Error("Recording storage unavailable; export WAV and measurements instead."));return;}const r=indexedDB.open("ringbench-recordings",1);r.onupgradeneeded=()=>r.result.createObjectStore("sessions",{keyPath:"id"});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return database;
  }
  async function dbRequest(mode,action){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction("sessions",mode),r=action(tx.objectStore("sessions"));let result;r.onsuccess=()=>result=r.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  async function listCaptures(){
    if(!pro)return;
    try{captures=await dbRequest("readonly",s=>s.getAll());captures.sort((a,b)=>b.when.localeCompare(a.when));options($("savedRecording"),captures.map((r,i)=>[i,r.spec.name+" · "+r.when.slice(0,16).replace("T"," ")]));put("recordingCount",captures.length+" saved tests on this device");}
    catch(e){put("recordingCount",e.message);}
  }
  $("arm").onclick=arm;$("finish").onclick=finish;
  $("upload").onclick=()=>{$("audioFile").value="";$("audioFile").click();};$("audioFile").onchange=e=>upload(e.target.files[0]);
  $("coin").onchange=e=>chooseCoin(+e.target.value);$("region").onchange=e=>{populateCoins(e.target.value);chooseCoin(+$("coin").value);};
  $("clear").onclick=()=>{invalidate("Ready for another check.");render();};
  $("playRecorded").onclick=()=>{if(reading&&!armed&&!busy){stopPlayback();const s=reading.strikes[+$('audioStrike').value||0];playPCM(s.pcm,s.sr);}};
  $("stopPlayback").onclick=stopPlayback;
  $("saveaudio").onclick=()=>{if(!reading)return;const i=+$("audioStrike").value||0,s=reading.strikes[i];download(new Blob([wavBuffer(s.pcm,s.sr)],{type:"audio/wav"}),"ringbench-tap-"+(i+1)+"-"+s.when.replace(/[:.]/g,"-")+".wav");};
  $("exporttest").onclick=exportTest;
  $("reftrusted").onchange=render;
  $("saveref").onclick=()=>{
    if(!reading||$("saveref").disabled)return;const note=$("refnote").value.trim();if(!note){notify("Describe the independent check that makes you trust this specimen.");return;}
    const r=referenceFromReading(referenceReading(),note);if(!validReference(r)){notify("Reference requires at least two taps with a repeatable resonance pattern.");return;}
    if(refs[key()]&&!window.confirm("Replace this coin’s reference? Export it first to keep both."))return;
    refs[key()]=r;const saved=saveRefs();reading.referenceUsed=r;render();notify(saved?"Reference saved on this device.":"Reference held in memory only. Export it before closing.");
  };
  $("exportref").onclick=()=>{if(validReference(refs[key()]))json(refs[key()],"ringbench-reference-"+stamp()+".json");else notify("No reference saved for this coin.");};
  $("exportAllRefs").onclick=()=>json({format:"ringbench-reference-library",version:3,references:refs,specimens:Object.values(specimens),retained:{references:retainedRefs,specimens:retainedSpecimens}},"ringbench-references-"+stamp()+".json");
  $("clearref").onclick=()=>{if(refs[key()]&&window.confirm("Remove this coin’s reference from this device?")){delete refs[key()];saveRefs();render();notify("Reference removed from this device. Exported backups remain usable.");}};
  $("importref").onclick=()=>{$("refFile").value="";$("refFile").click();};
  $("refFile").onchange=async e=>{
    const file=e.target.files[0];if(!file)return;const id=generation;
    try{if(file.size>2*1024*1024)throw Error("Use a reference file smaller than 2 MB.");const data=JSON.parse(await file.text());if(id!==generation)throw Error("Selection changed. Import the file again.");const items=importReferences(data),incoming=(Array.isArray(data.specimens)?data.specimens:[]).map(migrateSaved).filter(validSpecimen);if(!items.length&&!incoming.length)throw Error("No usable references or specimens found in this file.");
      if(!window.confirm("Import "+items.length+" reference(s) and "+incoming.length+" specimen record(s)? Matching IDs will be updated. Confirm you independently trust their provenance."))return;
      invalidate("References imported. Start a new check.");items.forEach(r=>refs[r.settings.coin+"|"+r.settings.alloy]=r);specimens=mergeSpecimens(specimens,incoming);
      if(data.retained&&typeof data.retained==="object"){Object.assign(retainedRefs,data.retained.references||{});Object.assign(retainedSpecimens,data.retained.specimens||{});}const saved=saveRefs(),savedSet=saveSpecimens();render();notify(saved&&savedSet?"References and specimen collection imported; duplicate captures were not counted twice.":"Imported into memory only. Export a backup before closing.");
    }catch(err){notify(err.message);}
  };
  options($("verificationMethod"),VERIFICATION_METHODS.map(v=>[v,v]));
  $("addSpecimen").onclick=()=>{
    if(!reading||$("addSpecimen").disabled)return;
    const specimenId=$("specimenId").value.trim(),note=$("refnote").value.trim();
    if(!specimenId||!note){notify("Enter a stable specimen ID and describe its independent verification.");return;}
    const r={...referenceFromReading(referenceReading(),note),collectionVersion:1,specimenId,verificationMethod:$("verificationMethod").value};
    if(!validSpecimen(r)){notify("This recording cannot be added as a verified specimen.");return;}
    const k=specimenKey(r);if(specimens[k]&&!window.confirm("Update this physical specimen’s record? It will still count as one specimen."))return;
    const merged=mergeSpecimens(specimens,[r]);if(merged[k]!==r){notify("These tap timestamps already belong to another specimen. The recording was not counted again.");return;}
    specimens=merged;const saved=saveSpecimens();render();notify(saved?"Specimen added. Export all references to keep or transfer the collection.":"Specimen held in memory only. Export before closing.");
  };
  $("removeSpecimen").onclick=()=>{
    const k=$("specimenSelect").value;if(!specimens[k]||!window.confirm("Remove this specimen record from this device?"))return;
    delete specimens[k];saveSpecimens();render();notify("Specimen removed from this device. Exported backups are unaffected.");
  };
  document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
  document.querySelectorAll("[data-setting]").forEach(el=>el.onchange=()=>{
    if(el.id==="alloy"){$("emod").value=ALLOYS[el.value].E;$("nu").value=ALLOYS[el.value].nu;}
    invalidate();render();
  });
  if(pro){
    options($("alloy"),Object.entries(ALLOYS).map(([k,a])=>[k,a.n]));options($("cmpAlloy"),Object.entries(ALLOYS).map(([k,a])=>[k,a.n]));
    options($("cmpCoin"),flat.map((c,i)=>[i,c.n]));options($("grip"),Object.entries(SUPPORTS).map(([k,s])=>[k,s.n]));$("cmpAlloy").value="brass";
    for(const id of ["cmpCoin","cmpAlloy","spotAu","spotAg","trans"])$(id).onchange=render;
    for(const [id,kind] of [["playTheory","a"],["playComparison","b"],["playAB","ab"]])$(id).onclick=()=>{
      if(armed||requesting||busy){notify("Stop recording before playing a modelled ring.");return;}const err=inputError();if(err){notify(err);return;}stopPlayback();const ctx=audio(),a=current(),b=comparison(a),ringOf=c=>{const p=modelExample(c);return ringBuffer(p.f,p.tau,p.amp,ctx.sampleRate,finite("trans",0));};
      if(!modelExample(a)||!modelExample(b)){notify("Review the geometry inputs before playback.");return;}
      if(kind==="a")playPCM(ringOf(a),ctx.sampleRate);else if(kind==="b")playPCM(ringOf(b),ctx.sampleRate);else{const at=ctx.currentTime+.05,d=playPCM(ringOf(a),ctx.sampleRate,at);playPCM(ringOf(b),ctx.sampleRate,at+d+.25);}
    };
    $("saveSession").onclick=async()=>{if(!reading)return;try{await dbRequest("readwrite",s=>s.put({id:crypto.randomUUID(),when:new Date().toISOString(),spec:session.spec,reading}));await listCaptures();notify("Recording and measurements saved in this device’s Library.");}catch(e){notify(e.message);}};
    $("loadSession").onclick=()=>{const saved=captures[+$("savedRecording").value];if(!saved)return;const idx=flat.findIndex(c=>c.n===saved.spec.name);if(idx<0)return;chooseCoin(idx);
      const c=saved.spec,s=saved.reading.settings;for(const [id,v] of Object.entries({mass:c.mass,dia:c.dia,alloy:c.key,emod:c.E,nu:c.nu,qmat:c.qmat,grip:c.sup,tsrc:s.thicknessSource,trim:s.rimThickness||"",plateModel:s.plateModel&&s.plateModel!=="plate"?"solid":"plate",support:s.support||"centre",widthMax:(s.family?.widthMax??.16)*100,ratioMax:s.family?.ratioMax??1.75,ePct:s.family?.ePct??5,rhoPct:s.family?.rhoPct??1,massPct:s.family?.massPct??1,diaPct:s.family?.diaPct??.5}))if($(id))$(id).value=v;
      reading=saved.reading;reading.complete=true;session={id:generation,spec:current(),settings:s,reference:reading.referenceUsed,source:reading.source,strikes:reading.strikes,files:new Set()};options($("audioStrike"),reading.strikes.map((s,i)=>[i,"Tap "+(i+1)]));render();showTab("evidence");notify("Saved test loaded for review.");};
    $("deleteSession").onclick=async()=>{const saved=captures[+$("savedRecording").value];if(!saved||!window.confirm("Delete this saved recording from this device?"))return;try{await dbRequest("readwrite",s=>s.delete(saved.id));await listCaptures();notify("Saved test deleted. Exported copies are unaffected.");}catch(e){notify(e.message);}};
  }
  options($("region"),[...new Set(COINS.map(g=>g.region))].map(r=>[r,r]));loadRefs();
  let initial=flat.findIndex(c=>c.n.startsWith("20 Dinara 1882"));try{const name=localStorage.getItem("ringbench."+edition+".coin");const i=flat.findIndex(c=>c.n===name);if(i>=0)initial=i;}catch{}
  chooseCoin(Math.max(0,initial));if(pro){$("cmpCoin").value=String(coinIndex);render();listCaptures();}
  window.addEventListener("resize",drawSpectrum);document.addEventListener("visibilitychange",()=>{if(document.hidden&&(armed||requesting)){finish();put("status","Listening paused while the app was in the background.");}});
  window.addEventListener("pagehide",()=>{generation++;stopMic();stopPlayback();});
  if("serviceWorker" in navigator)window.addEventListener("load",()=>{
    navigator.serviceWorker.register("sw.js").catch(()=>{});
    navigator.serviceWorker.addEventListener("message",e=>{if(e.data?.type==="update"||e.data?.type==="ready"&&e.data.version!==build){$("update").hidden=false;}});
  });
  $("update").onclick=()=>{if((armed||requesting||busy)&&!window.confirm("Reload and stop this check?"))return;location.reload();};
  // Expose a small read-only diagnostic snapshot for regression tests and support.
  return {getState:()=>({edition,target,coinIndex,reading,session,armed,busy}),chooseCoin,current,snapshot,accept,newSession,finish,render};
}
