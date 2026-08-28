/* Ring Bench — offline cache with self-updating.
 *
 * Strategy: stale-while-revalidate. Every request is answered instantly from
 * cache (so the app opens with no signal), while the network copy is fetched in
 * the background and written back. If the new copy differs from the cached one,
 * the page is told, and it offers a reload.
 *
 * The point of this over plain cache-first: you never have to bump a version
 * string by hand. Push to GitHub, open the app twice, you are on the new build.
 */
const CACHE = "ringbench";
const FILES = ["./", "./index.html", "./manifest.json", "./icon.svg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function announceUpdate() {
  self.clients.matchAll({ type: "window" })
    .then(cs => cs.forEach(c => c.postMessage({ type: "update" })));
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    /* start reading the cached copy now, before the response body is handed
       to the page and consumed */
    const cachedText = cached ? cached.clone().text() : null;

    const network = fetch(new Request(url.href, { cache: "no-store" }))
      .then(async res => {
        if (!res || !res.ok || res.type !== "basic") return res;
        const forCache = res.clone();
        const forCompare = res.clone();
        let changed = false;
        if (cachedText) {
          try {
            const [oldT, newT] = await Promise.all([cachedText, forCompare.text()]);
            changed = oldT !== newT;
          } catch (err) { /* binary or unreadable — treat as unchanged */ }
        }
        await cache.put(req, forCache);
        if (changed) announceUpdate();
        return res;
      })
      .catch(() => cached);          /* offline: the cache is the answer */

    return cached || network;
  })());
});
