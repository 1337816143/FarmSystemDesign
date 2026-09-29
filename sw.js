/* Only same-origin app assets. Never bulk-download/cache OpenStreetMap raster tiles. */
const CACHE='farmsystem-v0.1.0-20260929b';
const SHELL=['./','./index.html','./styles.css','./icon.svg','./manifest.webmanifest','./src/app.js','./src/data.js','./src/model.js','./src/map.js','./src/charts.js','./src/utils.js','./src/optimizer.worker.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('farmsystem-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||!u.pathname.startsWith(new URL(self.registration.scope).pathname))return;
 e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return r;}).catch(async()=>{const cached=await caches.match(e.request);if(cached)return cached;if(e.request.mode==='navigate')return caches.match('./index.html');return new Response('Offline: this resource has not been cached.',{status:503,headers:{'Content-Type':'text/plain'}});}));
});
