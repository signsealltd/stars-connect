const CACHE = "stars-connect-shell-v7";
const SHELL = ["/VehicleCheck", "/VehicleCheck/manifest.webmanifest", "/VehicleCheck/icon-192.png", "/VehicleCheck/icon-512.png","/", "/clock", "/register", "/visitors", "/emergency", "/live", "/offline", "/setup", "/manifest.webmanifest", "/icon.svg", "/branding/stars-logo.svg"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/branding/"))) {
        const cacheCopy = response.clone();
        event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, cacheCopy)).catch(() => undefined));
      }
      return response;
    } catch {
      const cached = await caches.match(event.request) || await caches.match(url.pathname);
      if (cached) return cached;
      if (event.request.mode === "navigate") {
        return await caches.match("/offline") || new Response("Offline", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
      }
      return new Response("", { status: 503 });
    }
  })());
});

// Cache the already-rendered vehicle shell's code after first installation too.
// Only same-origin immutable application assets are eligible; never API/private data.
self.addEventListener("message",event=>{
 if(event.data?.type!=="CACHE_VEHICLE_ASSETS"||!Array.isArray(event.data.urls))return;
 event.waitUntil((async()=>{
  try{
   const urls=[...new Set(event.data.urls)].slice(0,100).map(value=>new URL(value,self.location.origin)).filter(url=>url.origin===self.location.origin&&url.pathname.startsWith("/_next/static/"));
   const cache=await caches.open(CACHE);
   await Promise.all(urls.map(async url=>{const response=await fetch(url.href);if(!response.ok)throw Error("Asset unavailable");await cache.put(url.href,response)}));
   event.ports[0]?.postMessage({ready:urls.length>0});
  }catch{event.ports[0]?.postMessage({ready:false})}
 })());
});
