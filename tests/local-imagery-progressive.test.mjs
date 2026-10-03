import test from 'node:test';
import assert from 'node:assert/strict';
import {createRegionalRasterLayer,loadRasterImage,tileBounds} from '../src/regional-raster.js';

const turn=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(yes=>{resolve=yes;});return {promise,resolve};};
const coords={x:3303,y:1815,z:12},bounds=tileBounds(coords);
const rgb=(alpha,color=71)=>Uint8ClampedArray.from(alpha.flatMap(a=>[color,88,99,a?255:0]));
const qa=codes=>Uint8ClampedArray.from(codes.flatMap(code=>[code,code,code,255]));
let sequence=0;

function runtime(options={}){
 class GridLayer{
  constructor(opts){this.events=[];this.listeners=[];this._tiles={};this.initialize(opts);}
  initialize(opts){this.options=opts;}
  fire(name,detail){this.events.push({name,detail});for(const listener of [...this.listeners])listener(name,detail);}
  _removeTile(key){delete this._tiles[key];}
  onRemove(){}
  static extend(methods){class Layer extends this{}Object.assign(Layer.prototype,methods);return Layer;}
 }
 const originals=Object.fromEntries(['document','Image','ImageData'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const prefix=`local-progress-${++sequence}-`,loads=[],paints=[],waiting=[],renderCoords=options.coords||coords;
 const assets={rgb:{data:options.rgb||rgb([1,1,0,0]),hold:options.holdRGB},qa:{data:options.qa||qa([2,2,1,3]),hold:options.holdQA,fail:options.failQA}};
 globalThis.Image=class{
  naturalWidth=4;naturalHeight=1;
  set src(url){
   loads.push(url);const kind=url.slice(prefix.length),asset=assets[kind]||{data:rgb([1,1,1,1])};this.data=new Uint8ClampedArray(asset.data);
   const finish=()=>asset.fail?this.onerror?.():this.onload?.();
   if(asset.hold)waiting.push({kind,finish});else queueMicrotask(finish);
  }
  removeAttribute(){}
 };
 globalThis.ImageData=class{constructor(data,width,height){Object.assign(this,{data,width,height});}};
 globalThis.document={createElement:()=>{
  let drawn;const tile={dataset:{},style:{},classList:{add(){}},setAttribute(){}};
  tile.getContext=()=>({drawImage(image){drawn=image;},getImageData:()=>({data:drawn.data}),putImageData(image){tile.pixels=new Uint8ClampedArray(image.data);paints.push({tile,pixels:tile.pixels});}});return tile;
 }};
 let catalogCalls=0;
 const layer=createRegionalRasterLayer({GridLayer},{kind:'imagery',base:'',preferLocalRecords:true,tileTimeoutMs:options.tileTimeoutMs||2000,
  records:options.records?options.records(prefix):[{id:'local-main',preview:prefix+'rgb',status_preview:prefix+'qa',bounds_wsen:options.bounds||bounds,width:4,height:1,pixel_size_degrees:[.0001,.0001],min_zoom:12,max_zoom:14,local_native:true}],
  catalog:()=>{catalogCalls++;throw new Error('Local imagery must not fall back to COG');}});
 function start(){
  const ready=deferred(),final=deferred();let callbacks=0,tile;
  layer.listeners.push((name,detail)=>{if(name==='coverage'&&detail.tile===tile&&!detail.pending)final.resolve(detail);});
  tile=layer.createTile(renderCoords,(error,canvas)=>{callbacks++;ready.resolve({error,tile:canvas});});layer._tiles.tile={el:tile,current:true};
  return {tile,ready:ready.promise,final:final.promise,get callbacks(){return callbacks;}};
 }
 function release(kind){for(let i=waiting.length-1;i>=0;i--)if(!kind||waiting[i].kind===kind)waiting.splice(i,1)[0].finish();}
 return {layer,start,assets,loads,paints,prefix,release,get catalogCalls(){return catalogCalls;},async restore(){layer.onRemove();release();await turn();for(const [key,descriptor] of Object.entries(originals)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}};
}

function assertPartition(detail){assert.equal(['filled','qualityRejected','sourceNoData','unknownTransparent','outsideRead'].reduce((sum,key)=>sum+(detail[key]||0),0),65536,'each viewport pixel belongs to exactly one reported category');}

test('an opaque viewport skips QA even when the rest of the source image is transparent',{timeout:3000},async()=>{
 const r=runtime({rgb:rgb([1,1,0,0]),bounds:[bounds[0],bounds[1],2*bounds[2]-bounds[0],bounds[3]]});
 try{
  const tile=r.start(),final=await tile.final;
  assert.equal((await tile.ready).error,null);assert.deepEqual(r.loads,[r.prefix+'rgb']);
  assert.equal(final.filled,65536);assert.equal(final.unknownTransparent,0);assert.equal(final.qualityFailures,0);
  assert.equal(final.localNative,true);assert.equal(r.catalogCalls,0);assertPartition(final);
 }finally{await r.restore();}
});

test('local QA 0/1/2/3 separates source gaps, rejection, accepted RGB and RGB-zero gaps',{timeout:3000},async()=>{
 const r=runtime({rgb:rgb([0,0,1,0]),qa:qa([0,1,2,3])});
 try{
  const final=await r.start().final;
  assert.equal(final.filled,16384);assert.equal(final.qualityRejected,16384);assert.equal(final.sourceNoData,32768);
  assert.equal(final.unknownTransparent,0);assert.equal(final.outsideRead,0);assert.equal(final.qualityFailures,0);
  assert.equal(r.catalogCalls,0);assertPartition(final);
 }finally{await r.restore();}
});

test('slow QA does not delay first accepted RGB or repeat the Leaflet-ready callback',{timeout:3000},async()=>{
 const r=runtime({holdQA:true});
 try{
  const tile=r.start();assert.equal((await tile.ready).error,null);await turn();
  assert.deepEqual(r.loads,[r.prefix+'rgb',r.prefix+'qa']);assert.equal(tile.tile._coverage.status,'partial-loading');
  assert.equal(tile.tile._coverage.filled,32768);assert.equal(tile.tile._coverage.unknownTransparent,32768);
  assert.equal(tile.tile._coverage.pending,true);assert.ok(r.paints.length>0);assert.equal(r.layer.active,1);assertPartition(tile.tile._coverage);
  const firstPixels=tile.tile.pixels.slice();r.release('qa');const final=await tile.final;
  assert.deepEqual(tile.tile.pixels,firstPixels);assert.equal(final.qualityRejected,16384);assert.equal(final.sourceNoData,16384);
  assert.equal(final.unknownTransparent,0);assert.equal(final.pending,false);assert.equal(tile.callbacks,1);assertPartition(final);
 }finally{await r.restore();}
});

test('a tile deadline preserves first local RGB and ignores QA that finishes afterward',{timeout:3000},async()=>{
 const r=runtime({holdQA:true,tileTimeoutMs:45});
 try{
  const tile=r.start();await tile.ready;const firstPixels=tile.tile.pixels.slice(),final=await tile.final;
  assert.equal(final.timeout,true);assert.equal(final.status,'partial-read');assert.equal(final.filled,32768);assertPartition(final);
  assert.deepEqual(tile.tile.pixels,firstPixels);await turn();assert.equal(r.layer.active,0);
  const paints=r.paints.length,events=r.layer.events.length;r.release('qa');await turn();
  assert.equal(r.paints.length,paints);assert.equal(r.layer.events.length,events);assert.equal(tile.callbacks,1);
 }finally{await r.restore();}
});

test('failed QA keeps RGB and a retry repairs only the gap reasons while retaining accepted colors',{timeout:3000},async()=>{
 const r=runtime({failQA:true});
 try{
  const tile=r.start(),first=await tile.final;
  assert.equal(first.status,'partial-read');assert.equal(first.filled,32768);assert.equal(first.unknownTransparent,32768);assert.equal(first.qualityFailures,1);assertPartition(first);
  const firstPixels=tile.tile.pixels.slice();r.assets.rgb.data=rgb([1,1,0,0],219);r.assets.qa.fail=false;
  // Evict the first RGB so the retry really sees different source colors.
  for(let i=0;i<9;i++)await loadRasterImage(r.prefix+`filler-${i}`);
  const retried=deferred();r.layer.listeners.push((name,detail)=>{if(name==='coverage'&&detail.tile===tile.tile&&!detail.pending)retried.resolve(detail);});
  assert.equal(r.layer.retryFailedTiles(),1);assert.deepEqual(tile.tile.pixels,firstPixels);assert.equal(r.layer.retryFailedTiles(),0);
  const final=await retried.promise;
  assert.equal(final.qualityFailures,0);assert.equal(final.unknownTransparent,0);assert.equal(final.qualityRejected,16384);assert.equal(final.sourceNoData,16384);
  assert.equal(final.filled,32768);assert.deepEqual(tile.tile.pixels,firstPixels,'retained accepted RGB cannot be overwritten on retry');
  assert.equal(tile.callbacks,1);assert.equal(r.loads.filter(url=>url===r.prefix+'rgb').length,2);assert.equal(r.catalogCalls,0);assertPartition(final);
 }finally{await r.restore();}
});

test('removing a tile during local QA prevents late paint, events and callbacks',{timeout:3000},async()=>{
 const r=runtime({holdQA:true});
 try{
  const tile=r.start();await tile.ready;await turn();const paints=r.paints.length,events=r.layer.events.length;
  r.layer._removeTile('tile');await turn();assert.equal(r.layer.active,0);assert.equal(r.layer.controllers.size,0);
  r.release('qa');await turn();assert.equal(r.paints.length,paints);assert.equal(r.layer.events.length,events);assert.equal(tile.callbacks,1);
 }finally{await r.restore();}
});

test('removing a tile during RGB decoding prevents even a later QA request',{timeout:3000},async()=>{
 const r=runtime({holdRGB:true});
 try{
  const tile=r.start();await turn();r.layer._removeTile('tile');await turn();assert.equal(r.layer.active,0);
  r.release('rgb');await turn();assert.deepEqual(r.loads,[r.prefix+'rgb']);assert.equal(r.paints.length,0);assert.equal(r.layer.events.length,0);assert.equal(tile.callbacks,0);
 }finally{await r.restore();}
});

test('synchronous removal from first coverage publication cannot start a new QA request',{timeout:3000},async()=>{
 const r=runtime();
 try{
  r.layer.listeners.push((name,detail)=>{if(name==='coverage'&&detail.pending&&detail.filled)r.layer._removeTile('tile');});
  const tile=r.start();await turn();await turn();
  assert.deepEqual(r.loads,[r.prefix+'rgb'],'recheck cancellation after progress before starting optional QA');
  assert.equal(r.layer.active,0);assert.equal(tile.callbacks,0);
  assert.equal(r.layer.events.filter(event=>event.name==='coverage').length,1);
 }finally{await r.restore();}
});

test('low-zoom tiles retain offshore overview records outside the local main-island footprint',{timeout:3000},async()=>{
 const overviewCoords={x:51,y:28,z:6},[west,south,east,north]=tileBounds(overviewCoords),middle=(north+south)/2;
 const r=runtime({coords:overviewCoords,rgb:rgb([1,0,1,0]),qa:qa([2,1,2,3]),records:prefix=>[
  {id:'mainland',preview:prefix+'rgb',status_preview:prefix+'qa',bounds_wsen:[west,middle,east,north],pixel_size_degrees:[.01,.01],min_zoom:0,max_zoom:10,local_native:true},
  {id:'offshore',preview:prefix+'island',bounds_wsen:[west,south,east,south+(middle-south)/2],pixel_size_degrees:[.005,.005],min_zoom:0,max_zoom:10},
 ]});
 try{
  const tile=r.start(),final=await tile.final;
  assert.ok(r.loads.includes(r.prefix+'island'),'a local mainland record cannot discard disjoint offshore pixels in the same map tile');
  assert.equal(tile.tile.pixels[(255*256)*4+3],255,'the lower offshore strip remains visible');
  assert.equal(tile.tile.pixels[100*4+3],0,'the mainland quality gap remains transparent');
  assert.ok(final.qualityRejected>0);assert.ok(final.sourceNoData>0);assert.equal(r.catalogCalls,0);assertPartition(final);
 }finally{await r.restore();}
});
