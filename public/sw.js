const CACHE = "stars-connect-shell-v5";
const SHELL = ["/", "/clock", "/register", "/visitors", "/emergency", "/live", "/offline", "/setup", "/manifest.webmanifest", "/icon.svg", "/branding/stars-logo.svg"];
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
