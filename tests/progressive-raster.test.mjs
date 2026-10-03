import test from 'node:test';
import assert from 'node:assert/strict';
import {createRegionalRasterLayer,loadRasterImage,tileBounds} from '../src/regional-raster.js';

const turn=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
let sequence=0;
function runtime(specs,options={}){
 class GridLayer{
  constructor(options){this.events=[];this.listeners=[];this._tiles={};this.initialize(options);}
  initialize(options){this.options=options;}
  fire(name,detail){this.events.push({name,detail});for(const listener of [...this.listeners])listener(name,detail);}
  _removeTile(key){delete this._tiles[key];}
  onRemove(){}
  static extend(methods){class Layer extends this{}Object.assign(Layer.prototype,methods);return Layer;}
 }
 const original=Object.fromEntries(['document','ImageData','GeoTIFF','proj4'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const coords={x:3303,y:1815,z:12},bounds=tileBounds(coords),prefix=`https://example.invalid/progressive-${++sequence}`;
 const extent=[bounds[0]-.01,bounds[1]-.01,bounds[2]+.01,bounds[3]+.01].map(n=>n*100000);
 const opens=[],reads=[],painted=[];
 globalThis.document={createElement:()=>{const canvas={dataset:{},setAttribute(){}};canvas.getContext=()=>({putImageData(image){canvas.pixels=new Uint8ClampedArray(image.data);painted.push({canvas,pixels:canvas.pixels});}});return canvas;}};
 globalThis.ImageData=class{constructor(data,width,height){Object.assign(this,{data,width,height});}};
 globalThis.proj4=()=>({forward:p=>p.map(n=>n*100000)});
 globalThis.GeoTIFF={fromUrl:async(url,_options,signal)=>{
  opens.push({url,signal});const index=Number(url.split('/').at(-2)),spec=specs[index],quality=url.endsWith('scl');
  if(spec.metadata&&!quality)await spec.metadata.promise;
  const cell=quality?20:10;
  return {getImage:async()=>({getBoundingBox:()=>extent,getWidth:()=>Math.round((extent[2]-extent[0])/cell),getHeight:()=>Math.round((extent[3]-extent[1])/cell),getSamplesPerPixel:()=>quality?1:3}),
   readRasters:async request=>{
    const record={...request,index,quality};reads.push(record);spec.started?.resolve(record);
    if(spec.fail===true||spec.fail===(quality?'scl':'rgb'))throw new Error('simulated source outage');
    if(spec.hang&&!quality)await spec.hang.promise;
    const {width,height,samples}=request,data=new Uint8Array(width*height*samples.length).fill(quality?4:spec.color||101);
    if(quality&&spec.half)for(let y=0;y<height;y++)for(let x=Math.floor(width/2);x<width;x++)data[y*width+x]=9;
    return data;
   }};
 }};
 const scenes=specs.map((_,index)=>({id:`scene-${index}`,bbox_wgs84:bounds,epsg:32649,cloud_cover:index,assets:{visual:{href:`${prefix}/${index}/rgb`},scl:{href:`${prefix}/${index}/scl`}}}));
 const layer=createRegionalRasterLayer({GridLayer},{kind:'imagery',records:[],catalog:Promise.resolve({scenes}),sourceTimeoutMs:100,tileTimeoutMs:2000,...options});
 function start(key='tile'){
  const ready=deferred(),final=deferred();let callbacks=0,tile;
  layer.listeners.push((name,detail)=>{if(name==='coverage'&&detail.tile===tile&&!detail.pending)final.resolve(detail);});
  tile=layer.createTile(coords,(error,canvas)=>{callbacks++;ready.resolve({error,tile:canvas});});
  layer._tiles[key]={el:tile,current:true};return {tile,ready:ready.promise,final:final.promise,get callbacks(){return callbacks;}};
 }
 return {layer,start,opens,reads,painted,async restore(){layer.onRemove();await turn();for(const [key,descriptor] of Object.entries(original)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}};
}

test('accepted pixels become Leaflet-ready before a slow source ends and survive its timeout', {timeout:4000},async()=>{
 const hanging=deferred(),started=deferred(),r=runtime([{half:true,color:81},{hang:hanging,started}],{sourceTimeoutMs:120});
 try{
  const tile=r.start(),first=await tile.ready;assert.equal(first.error,null);await started.promise;
  assert.equal(tile.tile._coverage.status,'partial-loading');assert.equal(tile.tile.dataset.coveragePending,'true');
  const before=tile.tile.pixels.slice(),accepted=tile.tile._coverage.filled;
  assert.ok(accepted>0&&accepted<65536);assert.equal(r.layer.active,1);
  const final=await tile.final;
  assert.equal(final.status,'partial-read');assert.equal(final.pending,false);assert.equal(final.sourceTimeouts,1);
  assert.equal(final.failures,1);assert.equal(final.qualityRejected,65536-accepted);assert.equal(final.filled,accepted);
  assert.deepEqual(final.sourceIds,['scene-0']);assert.deepEqual(final.failureSourceIds,['scene-1']);
  assert.deepEqual(tile.tile.pixels,before);assert.equal(tile.callbacks,1);
  const count=r.painted.length;hanging.resolve();await turn();
  assert.equal(r.painted.length,count,'an expired read cannot paint stale late pixels');
  assert.ok(r.reads.find(x=>x.index===1).signal.aborted);
 }finally{hanging.resolve();await r.restore();}
});

test('a source deadline skips an unresponsive first scene and displays a later valid scene', {timeout:4000},async()=>{
 const hanging=deferred(),r=runtime([{hang:hanging},{color:144}],{sourceTimeoutMs:35});
 try{
  const tile=r.start(),final=await tile.final;
  assert.equal((await tile.ready).error,null);assert.equal(final.filled,65536);assert.equal(final.attempts,2);
  assert.equal(final.sourceTimeouts,1);assert.equal(final.status,'partial-read');assert.deepEqual(final.sourceIds,['scene-1']);
  assert.equal(tile.tile.pixels[0],144);
 }finally{hanging.resolve();await r.restore();}
});

test('failed SCL never exposes RGB and all failed sources finish with a truthful error', {timeout:4000},async()=>{
 const r=runtime([{fail:'rgb'},{fail:'scl'}]);
 try{
  const tile=r.start(),final=await tile.final,result=await tile.ready;
  assert.match(result.error.message,/All raster sources unavailable/);assert.equal(final.status,'read-error');
  assert.equal(final.filled,0);assert.equal(final.failures,2);assert.equal(final.qualityFailures,1);
  assert.equal(final.sourceNoData,0);assert.equal(final.qualityRejected,0);assert.equal(final.outsideRead,65536);
  assert.deepEqual(final.sourceFailures.map(x=>x.stage),['rgb','scl']);assert.equal(r.painted.length,0);
 }finally{await r.restore();}
});

test('native SCL stays a bounded nearest-neighbor window with a 60 m halo', {timeout:4000},async()=>{
 const r=runtime([{}]);
 try{
  const tile=r.start();await tile.final;const rgb=r.reads.find(x=>!x.quality),scl=r.reads.find(x=>x.quality);
  assert.ok(rgb.width<=384&&rgb.height<=384);assert.ok(scl.width<=1024&&scl.height<=1024);
  assert.equal(scl.resampleMethod,'nearest');assert.deepEqual(scl.samples,[0]);
  assert.ok(scl.bbox[0]<rgb.bbox[0]-40&&scl.bbox[2]>rgb.bbox[2]+40,'the SCL window contains the native 60 m guard around RGB');
  assert.ok(Math.abs((scl.bbox[2]-scl.bbox[0])/scl.width-20)<.1,'quality is read at its native cell size, not a downsampled mask');
 }finally{await r.restore();}
});

test('the total tile deadline retains already displayed pixels and their source provenance', {timeout:4000},async()=>{
 const hanging=deferred(),r=runtime([{half:true},{hang:hanging}],{tileTimeoutMs:110,sourceTimeoutMs:1000});
 try{
  const tile=r.start();await tile.ready;const before=tile.tile.pixels.slice(),final=await tile.final;
  assert.equal(final.timeout,true);assert.equal(final.status,'partial-read');assert.ok(final.filled>0);
  assert.deepEqual(final.sourceIds,['scene-0']);assert.deepEqual(tile.tile.pixels,before);assert.equal(tile.callbacks,1);
  assert.equal(tile.tile._abort.signal.aborted,false,'deadline is distinct from tile removal, so retry is allowed');
  assert.ok(r.reads.find(x=>x.index===1).signal.aborted);await turn();assert.equal(r.layer.active,0);
 }finally{hanging.resolve();await r.restore();}
});

test('retry fills only gaps, keeps the visible canvas and records retained contributors', {timeout:4000},async()=>{
 const specs=[{half:true,color:71},{fail:true,color:191}],r=runtime(specs);
 try{
  const tile=r.start();await tile.final;const first=tile.tile.pixels.slice(),firstFilled=tile.tile._coverage.filled;
  specs[0].fail=true;specs[1].fail=false;const final=deferred();
  r.layer.listeners.push((name,detail)=>{if(name==='coverage'&&detail.tile===tile.tile&&!detail.pending)final.resolve(detail);});
  assert.equal(r.layer.retryFailedTiles(),1);assert.deepEqual(tile.tile.pixels,first,'retry never clears the loaded canvas');
  assert.equal(r.layer.retryFailedTiles(),0,'repeated clicks cannot duplicate a pending retry');
  const retried=await final.promise;assert.equal(retried.filled,65536);assert.equal(retried.retainedPixels,firstFilled);
  assert.deepEqual(retried.sourceIds,['scene-0','scene-1']);assert.equal(tile.callbacks,1);
  for(let i=0;i<65536;i++)if(first[i*4+3])assert.equal(tile.tile.pixels[i*4],71,'prior accepted RGB is retained');
  assert.equal(tile.tile.pixels.at(-4),191);
 }finally{await r.restore();}
});

test('removing a partially loaded tile aborts its window and prevents late painting or events', {timeout:4000},async()=>{
 const hanging=deferred(),started=deferred(),r=runtime([{half:true},{hang:hanging,started}]);
 try{
  const tile=r.start();await tile.ready;await started.promise;
  const events=r.layer.events.length,paints=r.painted.length;r.layer._removeTile('tile');await turn();
  assert.equal(r.layer.active,0);assert.equal(r.layer.controllers.size,0);assert.ok(r.reads.find(x=>x.index===1).signal.aborted);
  hanging.resolve();await turn();assert.equal(r.painted.length,paints);assert.equal(r.layer.events.length,events);assert.equal(tile.callbacks,1);
 }finally{hanging.resolve();await r.restore();}
});

test('a scene deadline leaves shared metadata available for a successful in-place retry', {timeout:4000},async()=>{
 const metadata=deferred(),r=runtime([{metadata}],{sourceTimeoutMs:35});
 try{
  const tile=r.start();await tile.final;assert.equal((await tile.ready).error instanceof Error,true);
  const request=r.opens[0];assert.equal(request.signal.aborted,false);assert.equal(r.opens.length,1);
  metadata.resolve();await turn();const final=deferred();r.layer.listeners.push((name,detail)=>{if(name==='coverage'&&!detail.pending)final.resolve(detail);});
  assert.equal(r.layer.retryFailedTiles(),1);const retried=await final.promise;
  assert.equal(retried.filled,65536);assert.equal(retried.status,'displayed');assert.equal(tile.callbacks,1);
  assert.equal(r.opens.filter(x=>x.url===request.url).length,1,'retry reuses independently cached metadata');
 }finally{metadata.resolve();await r.restore();}
});

test('removing a layer cancels active and queued tiles without leaving queued controllers', {timeout:4000},async()=>{
 const hanging=deferred(),r=runtime([{hang:hanging}]);
 try{
  const tiles=[r.start('a'),r.start('b'),r.start('c')];await turn();assert.equal(r.layer.active,2);assert.equal(r.layer.queue.length,1);
  r.layer.onRemove();await turn();assert.equal(r.layer.active,0);assert.equal(r.layer.queue.length,0);assert.equal(r.layer.controllers.size,0);
  assert.ok(tiles.every(x=>x.tile._abort.signal.aborted));assert.ok(tiles.every(x=>x.callbacks===0));
  hanging.resolve();await turn();assert.equal(r.painted.length,0);
 }finally{hanging.resolve();await r.restore();}
});

test('zoom-eligible local source tiles bypass COG and keep their QA gaps transparent', {timeout:4000},async()=>{
 const coords={x:3303,y:1815,z:12},bounds=tileBounds(coords),prefix=`local-native-${++sequence}-`,loads=[];
 const originalImage=Object.getOwnPropertyDescriptor(globalThis,'Image');let catalogs=0;
 const records=[
  {id:'detail',bounds_wsen:bounds,preview:prefix+'rgb',status_preview:prefix+'qa',pixel_size_degrees:[.0001,.0001],min_zoom:12,max_zoom:14,local_native:true},
  {id:'coarse',bounds_wsen:bounds,preview:prefix+'coarse',pixel_size_degrees:[.01,.01]},
 ];
 const r=runtime([],{records,base:'',preferLocalRecords:true,catalog:()=>{catalogs++;throw new Error('must not load remote catalog');}});
 globalThis.Image=class{naturalWidth=2;naturalHeight=1;set src(url){loads.push(url);this.data=url.endsWith('qa')?Uint8ClampedArray.of(2,0,0,255,1,0,0,255):Uint8ClampedArray.of(23,45,67,255,0,0,0,0);queueMicrotask(()=>this.onload());}removeAttribute(){}};
 globalThis.document={createElement:()=>{let source;const canvas={dataset:{},setAttribute(){}};canvas.getContext=()=>({drawImage(im){source=im;},getImageData:()=>({data:source.data}),putImageData(image){canvas.pixels=image.data.slice();}});return canvas;}};
 try{
  const tile=r.start(),final=await tile.final;assert.equal((await tile.ready).error,null);
  assert.equal(catalogs,0);assert.equal(r.opens.length,0);assert.deepEqual(loads,[prefix+'rgb',prefix+'qa']);
  assert.equal(final.localNative,true);assert.equal(final.native,false);assert.equal(tile.tile.dataset.mode,'local-source-tiles');
  assert.equal(final.filled,32768);assert.equal(final.qualityRejected,32768);assert.equal(tile.tile.pixels.at(-1),0);
 }finally{await r.restore();if(originalImage)Object.defineProperty(globalThis,'Image',originalImage);else delete globalThis.Image;}
});

test('native COG remains active outside marked local footprints and outside their zoom band', {timeout:4000},async()=>{
 for(const extra of [{bounds_wsen:[0,0,1,1],min_zoom:12},{bounds_wsen:tileBounds({x:3303,y:1815,z:12}),min_zoom:13}]){
  const r=runtime([{}],{preferLocalRecords:true,records:[{preview:'must-not-load',local_native:true,...extra}]});
  try{const final=await r.start().final;assert.equal(final.filled,65536);assert.equal(final.native,true);assert.equal(final.localNative,false);assert.equal(r.opens.length,2);}
  finally{await r.restore();}
 }
});

test('decoded local image cache is bounded and LRU while in-flight image loads remain shared', {timeout:4000},async()=>{
 const originals=Object.fromEntries(['document','Image'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)])),loads=new Map(),pending=new Map();
 const prefix=`cache-${++sequence}-`;
 globalThis.Image=class{naturalWidth=1;naturalHeight=1;set src(value){loads.set(value,(loads.get(value)||0)+1);if(value.endsWith('pending'))pending.set(value,()=>this.onload());else queueMicrotask(()=>this.onload());}removeAttribute(){}};
 globalThis.document={createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(4)})})})};
 try{
  const stillLoading=loadRasterImage(prefix+'pending');for(let i=0;i<8;i++)await loadRasterImage(prefix+i);
  await loadRasterImage(prefix+'0');await loadRasterImage(prefix+'8');await loadRasterImage(prefix+'0');
  assert.equal(loads.get(prefix+'0'),1,'a recently used decoded image remains cached');
  await loadRasterImage(prefix+'1');assert.equal(loads.get(prefix+'1'),2,'the least recent completed image is evicted');
  const shared=loadRasterImage(prefix+'pending');assert.equal(loads.get(prefix+'pending'),1,'pending entries cannot be evicted by decoded images');
  pending.get(prefix+'pending')();assert.equal(await stillLoading,await shared);
 }finally{for(const [key,descriptor] of Object.entries(originals)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
