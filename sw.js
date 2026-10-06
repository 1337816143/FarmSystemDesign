/* Only same-origin app assets. Never bulk-download/cache OpenStreetMap raster tiles. */
const VERSION='0.3.17';
const SCOPE=new URL(self.registration.scope),SCOPE_KEY=encodeURIComponent(SCOPE.pathname);
const CACHE=`farmsystem-shell-${SCOPE_KEY}-v${VERSION}`;
const SHELL=['./','./index.html','./styles.css','./studio.css','./research.css','./language.css','./version.json','./vendor/leaflet.js','./vendor/leaflet.css','./src/version.js','./src/research.js','./src/hainan-atlas.js','./src/regional-data.js','./data/hainan/landcover-preview.png','./data/hainan/landcover-main-island-summary.json','./data/hainan/soil-ph-preview.png','./data/hainan/soil-ph-values.png','./data/hainan/soil-soc-preview.png','./data/hainan/soil-soc-values.png','./data/hainan/county-reference-2017.geojson','./src/i18n.js','./src/translations.generated.js','./src/evidence.generated.js','./icon.svg','./manifest.webmanifest','./src/app.js','./src/data.js','./src/model.js','./src/results.js','./src/frozen-run.js','./src/metric-contracts.js','./src/engine-identity.generated.js','./src/release-state.js','./src/provenance-ui.js','./src/map.js','./src/charts.js','./src/utils.js','./src/optimizer.worker.js'];
SHELL.push('./src/spatial-inputs.js','./data/derived/spatial-inputs-2025.json','./src/atlas-status.js','./src/local-classification.js','./src/coverage-panel.js','./src/cover-summary.js','./src/landcover-layer.js','./src/regional-raster.js','./src/regional-atlas-layers.js','./vendor/geotiff.js','./vendor/proj4.js');
SHELL.push('./offline.html','./src/offline-ui.js','./src/offline-bundle.js','./src/offline-downloads.js');
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL.map(url=>new Request(url,{cache:'reload'})))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{
 // Only replace this scope's app shell. Full bundles and user state are preserved.
 for(const key of await caches.keys()){
   if(key===CACHE)continue;
   if(key.startsWith(`farmsystem-shell-${SCOPE_KEY}-`)){await caches.delete(key);continue;}
   if(/^farmsystem-v\d+\.\d+\.\d+-/.test(key)){
     const legacy=await caches.open(key),entries=await legacy.keys();
     if(entries.length && entries.every(r=>{const u=new URL(r.url);return u.origin===SCOPE.origin&&u.pathname.startsWith(SCOPE.pathname);}))await caches.delete(key);
   }
 }
 await self.clients.claim();
})());});
async function completeBundleResponse(request){
 try{
   const meta=await caches.open(`farmsystem-full-meta-v1-${SCOPE_KEY}`);
   const active=await meta.match(new URL(`offline-active-v${encodeURIComponent(VERSION)}.json`,SCOPE));if(!active)return null;
   const identity=await active.json();if(identity.version!==VERSION||!/^[a-f0-9]{64}$/.test(identity.id))return null;
   const full=await caches.open(`farmsystem-full-v1-${SCOPE_KEY}-${identity.id}`);
   const marker=await full.match(new URL('offline-manifest.json',SCOPE));if(!marker)return null;
   const manifest=await marker.json();if(manifest.id!==identity.id)return null;
   const url=new URL(request.url);url.search='';url.hash='';if(url.pathname.endsWith('/'))url.pathname+='index.html';
   const response=await full.match(url);if(!response)return null;
   const range=request.headers.get('Range');if(!range)return response;
   const data=await response.arrayBuffer(),size=data.byteLength,match=/^bytes=(\d*)-(\d*)$/.exec(range);
   if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
   const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
   const end=match[1]?(match[2]?Math.min(Number(match[2]),size-1):size-1):size-1;
   if(start>=size||end<start)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
   const headers=new Headers(response.headers);headers.delete('Content-Encoding');headers.set('Content-Range',`bytes ${start}-${end}/${size}`);headers.set('Content-Length',String(end-start+1));headers.set('Accept-Ranges','bytes');
   return new Response(data.slice(start,end+1),{status:206,headers});
 }catch{return null;}
}

self.addEventListener('message',e=>{if(e.data?.type==='FARM_SHELL_IDENTITY'&&e.ports?.[0])e.ports[0].postMessage({cache:CACHE,shell:SHELL});});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||!u.pathname.startsWith(new URL(self.registration.scope).pathname))return;
 // Metadata already revalidates. Revalidate executable/UI assets too, so a warm HTTP
 // cache cannot keep old modules beside a fresh version.json. Large map data keep
 // their existing request/cache behavior; stored plans are never cleared here.
 const relative=u.pathname.slice(new URL(self.registration.scope).pathname.length);
 const shell=e.request.mode==='navigate'||relative==='version.json'||relative==='offline-manifest.json'||relative==='offline.html'||/^(?:src\/.*\.js|[^/]+\.css|index\.html)$/.test(relative);
 e.respondWith(fetch(e.request,shell?{cache:'no-cache'}:undefined).then(r=>{if(r.ok&&e.request.headers?.get('X-Farm-Offline-Bundle')!=='1'){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{}));}return r;}).catch(async()=>{const full=await completeBundleResponse(e.request);if(full)return full;const cache=await caches.open(CACHE),cached=await cache.match(e.request);if(cached)return cached;if(e.request.mode==='navigate')return cache.match('./index.html');return new Response('Offline: this resource has not been cached.',{status:503,headers:{'Content-Type':'text/plain'}});}));
});
