/* Retire only the old app's scoped code caches; never touch reference storage. */
"use strict";
const ROOT=new URL(self.registration.scope);
const PREFIX="ringbench:"+encodeURIComponent(ROOT.pathname)+":";
const CACHE=PREFIX+"retired-2026-09-11";
const HOME=new URL("index.html",ROOT).href;
self.addEventListener("install",event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.add(new Request(HOME,{cache:"reload"}));
  await self.skipWaiting();
})()));
self.addEventListener("activate",event=>event.waitUntil((async()=>{
  await Promise.all((await caches.keys()).filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
  for(const client of await self.clients.matchAll({type:"window"})){
    const url=new URL(client.url);
    if(url.origin===ROOT.origin&&[ROOT.pathname,ROOT.pathname+"index.html",ROOT.pathname+"ring-bench.html"].includes(url.pathname))await client.navigate(HOME);
  }
})()));
self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=="GET"||url.origin!==ROOT.origin||![ROOT.pathname,ROOT.pathname+"index.html",ROOT.pathname+"ring-bench.html"].includes(url.pathname))return;
  event.respondWith((async()=>{
    try{const response=await fetch(new Request(HOME,{cache:"no-store"}));if(response.ok)return response;}catch{}
    return (await caches.open(CACHE)).match(HOME);
  })());
});
