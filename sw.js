const CACHE_NAME="fightfind-v5";
const STATIC_ASSETS=["/manifest.webmanifest"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(STATIC_ASSETS)));self.skipWaiting()});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",event=>{const req=event.request;if(req.method!=="GET")return;const url=new URL(req.url);if(url.pathname==="/"||url.pathname.endsWith(".html")||url.pathname.startsWith("/api/")){event.respondWith(fetch(req).catch(()=>caches.match(req)));return}event.respondWith(fetch(req).then(resp=>{const copy=resp.clone();caches.open(CACHE_NAME).then(c=>c.put(req,copy));return resp}).catch(()=>caches.match(req)))});
