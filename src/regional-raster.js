/** Bounded, cancellable COG reads with explicit reprojection. No data enters the farm model. */
const EARTH=6378137, HALF=Math.PI*EARTH;
export const CLEAR_SCL=new Set([2,4,5,6]);
export function intersects(a,b){return a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];}
export function tileLonLat(x,y,z){const n=2**z;return [x/n*360-180,Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI];}
export function tileBounds(c){const a=tileLonLat(c.x,c.y,c.z),b=tileLonLat(c.x+1,c.y+1,c.z);return [a[0],b[1],b[0],a[1]];}
export function pixelIndex(lon,lat,b,w,h){if(lon<b[0]||lon>=b[2]||lat<=b[1]||lat>b[3])return -1;return Math.min(h-1,Math.floor((b[3]-lat)/(b[3]-b[1])*h))*w+Math.min(w-1,Math.floor((lon-b[0])/(b[2]-b[0])*w));}
export function rasterPriority(a,b){const pixelArea=r=>{const p=r.pixel_size_degrees;return p?.length>=2&&p.every(n=>Number.isFinite(n)&&n>0)?p[0]*p[1]:1;};const pa=pixelArea(a),pb=pixelArea(b),difference=pa-pb;if(Math.abs(difference)>Math.max(pa,pb)*1e-12)return difference;const area=x=>(x.bounds_wsen[2]-x.bounds_wsen[0])*(x.bounds_wsen[3]-x.bounds_wsen[1]);return area(a)-area(b);}
export function localRasterRecords(records,coords){const bounds=tileBounds(coords);return records.filter(r=>(!Number.isFinite(r.min_zoom)||coords.z>=r.min_zoom)&&(!Number.isFinite(r.max_zoom)||coords.z<=r.max_zoom)&&intersects(bounds,r.bounds_wsen)).sort(rasterPriority);}
export function sourceProjection(epsg){epsg=Number(epsg);if(epsg===4326)return 'EPSG:4326';if(epsg>=32601&&epsg<=32660)return `+proj=utm +zone=${epsg-32600} +datum=WGS84 +units=m +no_defs`;if(epsg>=32701&&epsg<=32760)return `+proj=utm +zone=${epsg-32700} +south +datum=WGS84 +units=m +no_defs`;throw new Error(`Unsupported source CRS: ${epsg}`);}
export function waitForRaster(promise,signal){return new Promise((resolve,reject)=>{const abort=()=>{cleanup();reject(new DOMException('Aborted','AbortError'));};const cleanup=()=>signal.removeEventListener('abort',abort);Promise.resolve(promise).then(value=>{cleanup();resolve(value);},error=>{cleanup();reject(error);});if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});});}
const images=new Map(),pendingImages=new Map(),tiffs=new Map();let libraries,imageBytes=0;
function loadScript(src,test){if(test())return Promise.resolve();return new Promise((yes,no)=>{const s=document.createElement('script');s.src=src;s.onload=yes;s.onerror=()=>no(new Error('Raster decoder unavailable'));document.head.append(s);});}
async function libs(){if(!libraries)libraries=Promise.all([loadScript('./vendor/geotiff.js',()=>globalThis.GeoTIFF),loadScript('./vendor/proj4.js',()=>globalThis.proj4)]).catch(e=>{libraries=null;throw e;});await libraries;}
export async function loadRasterImage(url){
 if(images.has(url)){const value=images.get(url);images.delete(url);images.set(url,value);return value;}
 if(!pendingImages.has(url)){
  const pending=new Promise((yes,no)=>{
   const im=new Image(),timeout=setTimeout(()=>{im.onload=null;im.onerror=null;im.removeAttribute('src');no(new Error('Raster image timed out'));},20000);
   im.onload=()=>{clearTimeout(timeout);try{const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);yes({width:c.width,height:c.height,data:ctx.getImageData(0,0,c.width,c.height).data});}catch(error){no(error);}};
   im.onerror=()=>{clearTimeout(timeout);no(new Error(`Raster unavailable: ${url}`));};im.src=url;
  }).then(value=>{
   images.set(url,value);imageBytes+=value.data.byteLength;
   // Evict only decoded entries. In-flight reads stay shared until they settle.
   while(images.size>8||imageBytes>32*1024*1024){const oldest=images.keys().next().value;imageBytes-=images.get(oldest).data.byteLength;images.delete(oldest);}
   return value;
  }).finally(()=>pendingImages.delete(url));
  pendingImages.set(url,pending);
 }
 return pendingImages.get(url);
}
async function openCog(url,signal){
 await waitForRaster(libs(),signal);if(signal.aborted)throw new DOMException('Aborted','AbortError');
 if(!tiffs.has(url)){
  const metadataController=new AbortController(),timeout=setTimeout(()=>metadataController.abort(),20000);
  const pending=GeoTIFF.fromUrl(url,{allowFullFile:false,blockSize:65536,cacheSize:48},metadataController.signal).finally(()=>clearTimeout(timeout));
  tiffs.set(url,pending);pending.catch(()=>{if(tiffs.get(url)===pending)tiffs.delete(url);});
  while(tiffs.size>24)tiffs.delete(tiffs.keys().next().value);
 }
 return waitForRaster(tiffs.get(url),signal);
}

function targetCoordinates(coords){const p=new Float64Array(256*256*2);for(let y=0;y<256;y++){const lat=tileLonLat(0,coords.y+(y+.5)/256,coords.z)[1];for(let x=0;x<256;x++){const i=(y*256+x)*2;p[i]=tileLonLat(coords.x+(x+.5)/256,0,coords.z)[0];p[i+1]=lat;}}return p;}
async function readCog(asset,epsg,xy,signal,samples,{native=false,halo=0}={}){const tiff=await openCog(asset.href,signal), image=await waitForRaster(tiff.getImage(),signal);if(signal.aborted)throw new DOMException('Aborted','AbortError');const project=proj4('EPSG:4326',sourceProjection(epsg));const p=new Float64Array(xy.length);let west=Infinity,south=Infinity,east=-Infinity,north=-Infinity;for(let i=0;i<xy.length;i+=2){const q=project.forward([xy[i],xy[i+1]]);p[i]=q[0];p[i+1]=q[1];west=Math.min(west,q[0]);east=Math.max(east,q[0]);south=Math.min(south,q[1]);north=Math.max(north,q[1]);}
 const extent=image.getBoundingBox();west-=halo;east+=halo;south-=halo;north+=halo;west=Math.max(west,extent[0]);east=Math.min(east,extent[2]);south=Math.max(south,extent[1]);north=Math.min(north,extent[3]);if(west>=east||south>=north)return null;
 const rx=(extent[2]-extent[0])/image.getWidth(),ry=(extent[3]-extent[1])/image.getHeight();west=extent[0]+Math.floor((west-extent[0])/rx)*rx;east=Math.min(extent[2],extent[0]+Math.ceil((east-extent[0])/rx)*rx);south=extent[1]+Math.floor((south-extent[1])/ry)*ry;north=Math.min(extent[3],extent[1]+Math.ceil((north-extent[1])/ry)*ry);
 const limit=native?1024:384;const width=Math.min(limit,Math.max(1,Math.round((east-west)/rx))),height=Math.min(limit,Math.max(1,Math.round((north-south)/ry)));if(native&&((east-west)/rx>1024||(north-south)/ry>1024))throw new Error('Native quality window exceeds bounded memory budget');
 const data=await waitForRaster(tiff.readRasters({bbox:[west,south,east,north],width,height,samples,interleave:true,resampleMethod:'nearest',fillValue:0,signal}),signal);return {data,p,width,height,bounds:[west,south,east,north],bands:samples?.length||image.getSamplesPerPixel()};}
export function acceptedSclPixel(scl,index){if(index<0||!CLEAR_SCL.has(scl.data[index]))return false;const col=index%scl.width,row=Math.floor(index/scl.width);for(let y=Math.max(0,row-3);y<=Math.min(scl.height-1,row+3);y++)for(let x=Math.max(0,col-3);x<=Math.min(scl.width-1,col+3);x++){const v=scl.data[y*scl.width+x];if(v===3||v===8||v===9||v===10)return false;}return true;}
function sourceIndex(r,i){return pixelIndex(r.p[i*2],r.p[i*2+1],r.bounds,r.width,r.height);}
export function elevationColor(value){const t=Math.max(0,Math.min(1,value/1900));const stops=[[226,238,218],[159,189,133],[119,142,95],[143,116,81],[228,222,206]];const n=t*4,k=Math.min(3,Math.floor(n)),f=n-k;return stops[k].map((v,j)=>Math.round(v*(1-f)+stops[k+1][j]*f));}
export function summarizeRasterPixels(out,observed,qualityRejected,noData){
 const counts={filled:0,qualityRejected:0,sourceNoData:0,outsideRead:0};
 for(let i=0;i<out.length/4;i++){if(out[i*4+3])counts.filled++;else if(qualityRejected?.[i])counts.qualityRejected++;else if(noData?.[i]||observed?.[i])counts.sourceNoData++;else counts.outsideRead++;}
 return counts;
}
export function rasterOutcome(detail,native){
 if(detail.pending)return detail.filled>0?'partial-loading':'loading';
 if(detail.filled>0)return detail.timeout||detail.error||detail.failures>0||detail.qualityFailures>0||detail.limited?'partial-read':'displayed';
 if(detail.timeout)return 'timeout';
 if(detail.error)return 'read-error';
 if(detail.unknownTransparent>0)return 'quality-unavailable';
 if(detail.attempts>0&&detail.failures===detail.attempts)return 'read-error';
 if(detail.failures>0)return 'incomplete-read';
 if(!detail.attempts)return native?'outside-index':'no-overview';
 if(detail.qualityRejected>0)return 'quality-masked';
 return detail.sourceNoData>0?'source-nodata':'outside-read';
}
export function hasTargetedScenePriority(scene,bounds){
 return Array.isArray(scene.verified_target_bounds)&&scene.verified_target_bounds.some(r=>r.status==='rgb-and-scl-guard-accepted'&&r.quality_guard_m===60&&Array.isArray(r.bbox_wgs84)&&r.bbox_wgs84.length===4&&r.bbox_wgs84.every(Number.isFinite)&&r.bbox_wgs84[0]<r.bbox_wgs84[2]&&r.bbox_wgs84[1]<r.bbox_wgs84[3]&&intersects(bounds,r.bbox_wgs84));
}
export function compareCogScenes(a,b,bounds){
 const target=Number(hasTargetedScenePriority(b,bounds))-Number(hasTargetedScenePriority(a,bounds));
 return target||((a.cloud_cover??0)+.35*(a.nodata_percent??0))-((b.cloud_cover??0)+.35*(b.nodata_percent??0))||String(b.datetime||'').localeCompare(String(a.datetime||''));
}
// A scene owns its read signal; shared COG metadata deliberately does not. A slow
// scene can be skipped without aborting another tile's cached metadata request.
function boundedRead(parent,milliseconds){
 const controller=new AbortController();let timedOut=false;
 const abort=()=>controller.abort();
 if(parent.aborted)abort();else parent.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},milliseconds);
 return {signal:controller.signal,get timedOut(){return timedOut;},close(){clearTimeout(timer);parent.removeEventListener('abort',abort);}};
}
function readBudget(value,fallback,maximum){return Number.isFinite(value)&&value>0?Math.min(value,maximum):fallback;}
async function drawCogTile(config,coords,xy,out,signal,progress,previous={}){
 const bbox=tileBounds(coords),catalog=await waitForRaster(typeof config.catalog==='function'?config.catalog():config.catalog,signal);
 const records=config.kind==='imagery'?catalog.scenes:catalog.assets;
 const candidates=records.filter(s=>intersects(bbox,s.bbox_wgs84)).sort((a,b)=>compareCogScenes(a,b,bbox));
 let filled=summarizeRasterPixels(out).filled,attempts=0,completed=0,failures=0,qualityFailures=0,sourceTimeouts=0;
 const retainedPixels=filled,sourceIds=[...new Set(previous.sourceIds||[])],readSourceIds=[],failureSourceIds=[],sourceFailures=[];
 const observed=new Uint8Array(65536),qualityRejected=new Uint8Array(65536),noData=new Uint8Array(65536);
 const detail=pending=>({...summarizeRasterPixels(out,observed,qualityRejected,noData),attempts,completed,failures,qualityFailures,sourceTimeouts,sourceIds:[...sourceIds],readSourceIds:[...readSourceIds],failureSourceIds:[...failureSourceIds],sourceFailures:sourceFailures.map(s=>({...s})),candidates:candidates.length,unattemptedSources:Math.max(0,candidates.length-attempts),limited:filled<65536&&attempts>=12&&attempts<candidates.length,pending,retainedPixels});
 for(const s of candidates){
  if(signal.aborted)throw new DOMException('Aborted','AbortError');if(attempts>=12||filled===65536)break;attempts++;
  const attempt=boundedRead(signal,readBudget(config.sourceTimeoutMs,8000,12000)),id=s.id||s.href;let stage=config.kind==='imagery'?'rgb':'source';
  progress({...detail(true),activeSourceId:id});
  try{const before=filled;
   if(config.kind==='imagery'){
    if(!s.assets?.visual?.href||!s.assets?.scl?.href){stage=!s.assets?.scl?.href?'scl':'rgb';throw new Error('Required raster asset missing');}
    const rgb=await readCog(s.assets.visual,s.epsg,xy,attempt.signal,[0,1,2]);if(!rgb)continue;
    stage='scl';const scl=await readCog(s.assets.scl,s.epsg,xy,attempt.signal,[0],{native:true,halo:60});if(!scl)continue;
    if(attempt.signal.aborted)throw new DOMException('Aborted','AbortError');
    for(let i=0;i<65536;i++){
     if(out[i*4+3])continue;const j=sourceIndex(rgb,i),k=sourceIndex(scl,i);if(j<0||k<0)continue;observed[i]=1;
     if(scl.data[k]===0){noData[i]=1;continue;}
     if(!acceptedSclPixel(scl,k)){qualityRejected[i]=1;continue;}
     const q=j*3;if(rgb.data[q]===0&&rgb.data[q+1]===0&&rgb.data[q+2]===0){noData[i]=1;continue;}
     out.set([rgb.data[q],rgb.data[q+1],rgb.data[q+2],255],i*4);filled++;
    }
   }else{
    const r=await readCog(s,s.epsg||4326,xy,attempt.signal,[0]);if(!r)continue;
    if(attempt.signal.aborted)throw new DOMException('Aborted','AbortError');
    for(let i=0;i<65536;i++){if(out[i*4+3])continue;const j=sourceIndex(r,i);if(j<0)continue;observed[i]=1;const v=r.data[j];if(!Number.isFinite(v)||v===s.nodata){noData[i]=1;continue;}out.set([...elevationColor(v),255],i*4);filled++;}
   }
   readSourceIds.push(id);if(filled>before&&!sourceIds.includes(id))sourceIds.push(id);
  }catch(e){
   if(signal.aborted)throw e;
   failures++;if(stage==='scl')qualityFailures++;if(attempt.timedOut)sourceTimeouts++;
   failureSourceIds.push(id);sourceFailures.push({id,stage,reason:attempt.timedOut?'timeout':'read-error'});
  }finally{attempt.close();completed++;}
  if(signal.aborted)throw new DOMException('Aborted','AbortError');
  // The last result is painted by render. Intermediate updates also make the
  // tile ready in Leaflet, whose loading tiles would otherwise remain hidden.
  if(filled>0&&filled<65536&&attempts<Math.min(candidates.length,12))progress(detail(true));
 }
 return detail(false);
}
async function drawLocalTile(config,coords,xy,out,signal){
 const records=localRasterRecords(config.records,coords);
 let failures=0,qualityFailures=0,unknownTransparent=0,ownedCount=0,attempts=0;const recordStatuses=[],owned=new Uint8Array(65536),observed=new Uint8Array(65536),qualityRejected=new Uint8Array(65536),noData=new Uint8Array(65536);
 for(let i=0;i<65536;i++)if(out[i*4+3]){owned[i]=1;ownedCount++;}
 for(const rec of records){
  if(ownedCount===65536)break;if(signal.aborted)throw new DOMException('Aborted','AbortError');attempts++;if(rec.status)recordStatuses.push(rec.status);
  try{
   const im=await loadRasterImage(config.base+rec.preview);if(signal.aborted)throw new DOMException('Aborted','AbortError');
   let qa=null;if(config.kind==='imagery'&&rec.status_preview){try{qa=await loadRasterImage(config.base+rec.status_preview);if(qa.width!==im.width||qa.height!==im.height)throw new Error('Quality dimensions mismatch');}catch(e){qa=null;qualityFailures++;}}
   if(signal.aborted)throw new DOMException('Aborted','AbortError');
   for(let i=0;i<65536;i++){
    if(owned[i])continue;const j=pixelIndex(xy[i*2],xy[i*2+1],rec.bounds_wsen,im.width,im.height);if(j<0)continue;owned[i]=1;ownedCount++;
    if(rec.status?.startsWith('unresolved')||!im.data[j*4+3]){
     if(config.kind==='imagery'){if(qa?.data[j*4]===1){observed[i]=1;qualityRejected[i]=1;}else if(qa?.data[j*4]===0){observed[i]=1;noData[i]=1;}else unknownTransparent++;}
     else{observed[i]=1;noData[i]=1;}continue;
    }
    observed[i]=1;out.set(im.data.subarray(j*4,j*4+4),i*4);
   }
  }catch(e){if(e.name==='AbortError')throw e;failures++;}
 }
 const counts=summarizeRasterPixels(out,observed,qualityRejected,noData);counts.outsideRead-=unknownTransparent;
 return {...counts,unknownTransparent,qualityFailures,failures,attempts,completed:attempts,recordStatuses};
}

export function createRegionalRasterLayer(L,config,options={}){
 const Layer=L.GridLayer.extend({
  initialize(opts){L.GridLayer.prototype.initialize.call(this,opts);this.queue=[];this.active=0;this.controllers=new Set();},
  createTile(coords,done){const tile=document.createElement('canvas');tile.width=tile.height=256;tile.setAttribute('role','presentation');tile._regionalCoords=coords;const controller=new AbortController();tile._abort=controller;this.controllers.add(controller);this.queue.push({coords,tile,done,controller});this.pump();return tile;},
  pump(){while(this.active<2&&this.queue.length){const task=this.queue.shift();if(task.controller.signal.aborted){this.controllers.delete(task.controller);continue;}this.active++;this.render(task).finally(()=>{this.active--;this.controllers.delete(task.controller);this.pump();});}},
  coverageForBounds(bounds){return Object.values(this._tiles||{}).filter(r=>r.current!==false&&r.el?._regionalCoords&&intersects(bounds,tileBounds(r.el._regionalCoords))).map(r=>r.el._coverage||{status:'loading',filled:0});},
  recordCoverage(tile,detail,native,coords){const status=rasterOutcome(detail,native);tile._coverage={...detail,native,coords,status};tile.dataset.coverageStatus=status;tile.dataset.coveragePending=String(Boolean(detail.pending));tile.dataset.validPixels=String(detail.filled||0);tile.dataset.sourceTimeouts=String(detail.sourceTimeouts||0);tile.dataset.mode=detail.localNative?'local-source-tiles':native?'native-cog-window':'local-overview';this.fire('coverage',{...tile._coverage,tile});},
  retryFailedTiles(){
   let count=0;
   for(const r of Object.values(this._tiles||{})){
    const tile=r.el,previous=tile?._coverage;
    if(r.current===false||!tile?._regionalCoords||tile._abort?.signal.aborted||previous?.pending||!['read-error','incomplete-read','partial-read','timeout','quality-unavailable'].includes(previous?.status))continue;
    const controller=new AbortController(),coords=tile._regionalCoords;tile._abort=controller;this.controllers.add(controller);
    this.queue.push({coords,tile,controller,done:()=>{},previous});count++;
    this.recordCoverage(tile,{...previous,pending:true,timeout:false,error:false},previous.native,coords);
   }
   this.pump();return count;
  },
  async render({coords,tile,done,controller,previous}){
   const nativeRequested=Boolean(config.catalog&&coords.z>=(config.nativeZoom||12));
   const localRecords=nativeRequested&&config.preferLocalRecords?localRasterRecords(config.records||[],coords).filter(r=>r.local_native===true):[];
   // A local source tile owns its transparent QA gaps. Never fill those gaps
   // with a coarser preview or a remote scene simply because it is available.
   const localNative=localRecords.length>0,native=nativeRequested&&!localNative,localConfig=localNative?{...config,records:localRecords}:config;
   const read=boundedRead(controller.signal,readBudget(config.tileTimeoutMs,45000,45000));
   const signal=read.signal,out=tile._rasterPixels||new Uint8ClampedArray(65536*4);let latest={...(previous||{...summarizeRasterPixels(out),attempts:0,completed:0,failures:0}),localNative};
   const alive=()=>!controller.signal.aborted&&tile._abort===controller;
   const ready=error=>{if(!alive()||tile._rasterReady)return;tile._rasterReady=true;done(error,tile);};
   const publish=detail=>{
    if(!alive()||signal.aborted)return;detail={...detail,localNative};latest=detail;
    if(detail.filled>0){tile.getContext('2d').putImageData(new ImageData(out,256,256),0,0);tile._rasterPixels=out;tile.classList?.add('leaflet-tile-loaded');if(tile.style)tile.style.opacity='1';}
    this.recordCoverage(tile,detail,native,coords);
    if(detail.filled>0)ready(null);
   };
   try{
    const xy=targetCoordinates(coords),detail=await waitForRaster(native?drawCogTile(config,coords,xy,out,signal,publish,previous):drawLocalTile(localConfig,coords,xy,out,signal),signal);
    if(!alive()||signal.aborted)return;
    publish({...detail,pending:false});
    ready(detail.attempts&&detail.failures===detail.attempts&&!detail.filled?new Error('All raster sources unavailable'):null);
   }catch(e){
    if(!alive())return;
    const detail={...latest,filled:summarizeRasterPixels(out).filled,pending:false,timeout:read.timedOut,error:!read.timedOut};
    detail.outsideRead=Math.max(0,65536-detail.filled-(detail.qualityRejected||0)-(detail.sourceNoData||0)-(detail.unknownTransparent||0));
    if(detail.filled>0){tile.getContext('2d').putImageData(new ImageData(out,256,256),0,0);tile._rasterPixels=out;tile.classList?.add('leaflet-tile-loaded');if(tile.style)tile.style.opacity='1';}
    this.recordCoverage(tile,detail,native,coords);
    ready(detail.filled?null:read.timedOut?new Error('Raster read timed out; retry this layer'):e);
   }finally{read.close();}
  },
  _removeTile(key){const controller=this._tiles[key]?.el?._abort;controller?.abort();this.queue=this.queue.filter(task=>task.controller!==controller);this.controllers.delete(controller);L.GridLayer.prototype._removeTile.call(this,key);},
  onRemove(map){for(const c of this.controllers)c.abort();this.queue=[];this.controllers.clear();L.GridLayer.prototype.onRemove.call(this,map);}
 });
 return new Layer({tileSize:256,keepBuffer:0,updateWhenIdle:true,updateWhenZooming:false,maxNativeZoom:config.kind==='imagery'?14:13,maxZoom:18,...options});
}
