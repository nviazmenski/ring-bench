/* Ring Bench: scoped, versioned offline cache. Bump VERSION with each release. */
const VERSION="2026-09-10.reliability-1";
const ROOT=new URL(self.registration.scope);
const PREFIX="ringbench:"+encodeURIComponent(ROOT.pathname)+":";
const CACHE=PREFIX+VERSION;
const FILES=["index.html","ring-bench.html","manifest.json","icon.svg"];
const ALLOWED=new Set(FILES.map(name=>new URL(name,ROOT).href));
function canonical(request){
  const url=new URL(request.url);
  if(url.origin!==ROOT.origin)return null;
  url.search="";url.hash="";
  if(url.href===ROOT.href)url.pathname+="index.html";
  return ALLOWED.has(url.href)?url.href:null;
}
self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(FILES.map(name=>new Request(new URL(name,ROOT).href,{cache:"reload"})));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
    const clients=await self.clients.matchAll({type:"window"});
    for(const client of clients)client.postMessage({type:"ready",version:VERSION});
  })());
});
async function refresh(key){
  const response=await fetch(new Request(key,{cache:"no-store"}));
  if(!response.ok||response.type!=="basic")throw new Error("Update unavailable");
  const cache=await caches.open(CACHE),old=await cache.match(key);
  const changed=old && (await old.text())!==(await response.clone().text());
  await cache.put(key,response.clone());
  if(changed){
    const clients=await self.clients.matchAll({type:"window"});
    for(const client of clients)client.postMessage({type:"update"});
  }
  return response;
}
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const key=canonical(event.request);if(!key)return;
  // Register lifetime extension synchronously, even when the cached response wins.
  const network=refresh(key);
  event.waitUntil(network.then(()=>{},()=>{}));
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE),cached=await cache.match(key);
    if(cached)return cached;
    try{return await network;}
    catch(e){return new Response("Ring Bench is not cached yet. Connect once, then reopen.",{status:503,headers:{"Content-Type":"text/plain"}});}
  })());
});
