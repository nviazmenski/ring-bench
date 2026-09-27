const VERSION="2026-09-27.pro-4.13";
const ROOT=new URL(self.registration.scope),PREFIX="ringbench-pro:"+encodeURIComponent(ROOT.pathname)+":",CACHE=PREFIX+VERSION;
const FILES=["index.html","pro.js","solid.js","solid-tables.js","manifest.json","icon.svg","apple-touch-icon.png","icon-512.png",...["coins.js","model.js","geometry.js","constructions.js","acoustics.js","references.js","app.js","styles.css"].map(n=>"../shared/"+n)];
const ALLOWED=new Set(FILES.map(n=>new URL(n,ROOT).href));
function canonical(request){const u=new URL(request.url);if(u.origin!==ROOT.origin)return null;u.search="";u.hash="";if(u.href===ROOT.href)u.pathname+="index.html";return ALLOWED.has(u.href)?u.href:null;}
self.addEventListener("install",e=>e.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(FILES.map(n=>new Request(new URL(n,ROOT),{cache:"reload"})));await self.skipWaiting();})()));
self.addEventListener("activate",e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith(PREFIX)&&k!==CACHE)await caches.delete(k);await self.clients.claim();for(const c of await self.clients.matchAll({type:"window"}))c.postMessage({type:"ready",version:VERSION});})()));
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;const key=canonical(e.request);if(!key)return;
  // Every release is an atomic precached set. Never mix changed modules from another build.
  e.respondWith((async()=>{const cache=await caches.open(CACHE),hit=await cache.match(key);if(hit)return hit;try{return await fetch(e.request);}catch{return new Response("Connect once to install this RingBench version.",{status:503});}})());
});
