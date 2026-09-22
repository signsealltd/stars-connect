const CACHE="stars-staff-public-v1";
const ASSETS=["/staff/offline.html","/staff/icon-192.png","/staff/icon-512.png","/branding/stars-logo.svg"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("stars-staff-public-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
 const u=new URL(e.request.url);if(e.request.method!=="GET"||u.origin!==location.origin)return;
 // Never cache API data, authenticated HTML, medical evidence or user-entered requests.
 if(u.pathname.startsWith("/api/"))return;
 e.respondWith(fetch(e.request).catch(async()=>{
  if(e.request.mode==="navigate")return (await caches.match("/staff/offline.html"))||Response.error();
  return (await caches.match(e.request))||Response.error();
 }));
});
