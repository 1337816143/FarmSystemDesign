import test from 'node:test';
import assert from 'node:assert/strict';
import {createRegionalRasterLayer, tileBounds} from '../src/regional-raster.js';

const nextTurn = () => new Promise(resolve => setImmediate(resolve));

test('cancelling one tile preserves shared COG metadata for surviving and later tiles', {timeout:3000}, async () => {
  class GridLayer {
    constructor(options) { this.events=[]; this._tiles={}; this.initialize(options); }
    initialize(options) { this.options=options; }
    fire(name, detail) { this.events.push({name, detail}); }
    onRemove() {}
    _removeTile() {}
    static extend(methods) { class Layer extends this {} Object.assign(Layer.prototype, methods); return Layer; }
  }
  const original = Object.fromEntries(['document','ImageData','GeoTIFF','proj4'].map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const coords={x:3303,y:1815,z:12}, bounds=tileBounds(coords);
  // A small padded synthetic source is sufficient to exercise the complete RGB/SCL render.
  const extent=[bounds[0]-.01,bounds[1]-.01,bounds[2]+.01,bounds[3]+.01].map(n=>n*100000);
  const visual='https://example.invalid/shared-cancel-regression-rgb.tif';
  const quality='https://example.invalid/shared-cancel-regression-scl.tif';
  const opens=new Map(), requestSignals=new Map(), readSignals=[];
  let releaseMetadata, metadataSettled=false, firstCallbacks=0, layer;
  const makeTiff = isQuality => {
    const cell=isQuality?20:10;
    const image={
      getBoundingBox:()=>extent,
      getWidth:()=>Math.round((extent[2]-extent[0])/cell),
      getHeight:()=>Math.round((extent[3]-extent[1])/cell),
      getSamplesPerPixel:()=>isQuality?1:3,
    };
    return {
      getImage:async()=>image,
      readRasters:async({width,height,samples,signal})=>{
        assert.equal(signal.aborted,false,'a surviving tile must own its un-aborted raster read');
        readSignals.push(signal);
        return new Uint8Array(width*height*samples.length).fill(isQuality?4:111);
      },
    };
  };
  globalThis.document={createElement:()=>({dataset:{},setAttribute(){},getContext:()=>({putImageData(){}})})};
  globalThis.ImageData=class { constructor(data,width,height) { Object.assign(this,{data,width,height}); } };
  globalThis.proj4=()=>({forward:p=>p.map(n=>n*100000)});
  globalThis.GeoTIFF={fromUrl:(url,_options,signal)=>{
    opens.set(url,(opens.get(url)||0)+1); requestSignals.set(url,signal);
    if(url===quality)return Promise.resolve(makeTiff(true));
    assert.equal(url,visual);
    return new Promise((resolve,reject)=>{
      const aborted=()=>{metadataSettled=true;reject(new DOMException('Shared metadata request aborted','AbortError'));};
      signal.addEventListener('abort',aborted,{once:true});
      releaseMetadata=()=>{signal.removeEventListener('abort',aborted);metadataSettled=true;resolve(makeTiff(false));};
    });
  }};
  try {
    const scene={id:'shared-cancel-regression',bbox_wgs84:bounds,epsg:32649,assets:{visual:{href:visual},scl:{href:quality}}};
    layer=createRegionalRasterLayer({GridLayer},{kind:'imagery',records:[],catalog:Promise.resolve({scenes:[scene]})});
    const cancelled=layer.createTile(coords,()=>{firstCallbacks++;});
    let survivor;
    const survivorDone=new Promise(resolve=>{survivor=layer.createTile(coords,(error,tile)=>resolve({error,tile}));});
    await nextTurn();
    assert.equal(opens.get(visual),1,'the two initial tiles must share one metadata request');
    assert.notEqual(requestSignals.get(visual),cancelled._abort.signal,'shared metadata must not use the first consumer signal');
    cancelled._abort.abort();
    await nextTurn();
    assert.equal(survivor._abort.signal.aborted,false);
    assert.equal(requestSignals.get(visual).aborted,false,'consumer cancellation must not abort shared metadata');
    assert.equal(metadataSettled,false,'shared metadata remains pending for the surviving tile');
    assert.equal(layer.active,1,'the cancelled render slot must be released promptly');

    let later;
    const laterDone=new Promise(resolve=>{later=layer.createTile(coords,(error,tile)=>resolve({error,tile}));});
    await nextTurn();
    assert.equal(opens.get(visual),1,'consumer cancellation must not evict the shared pending promise');
    releaseMetadata();
    for(const {error,tile} of await Promise.all([survivorDone,laterDone])) {
      assert.equal(error,null);
      assert.equal(tile._coverage.status,'displayed');
      assert.equal(tile._coverage.filled,256*256);
      assert.equal(tile._coverage.failures,0);
      assert.equal(tile._abort.signal.aborted,false);
    }
    await nextTurn();
    assert.equal(firstCallbacks,0,'an unloaded tile must not receive a late completion callback');
    assert.equal(opens.get(visual),1);
    assert.equal(opens.get(quality),1,'SCL metadata must also remain shared');
    assert.equal(readSignals.length,4,'only the two surviving tiles read RGB and SCL windows');
    assert.equal(new Set(readSignals).size,2,'each surviving scene uses its own bounded read signal');
    assert.ok(readSignals.every(signal=>!signal.aborted));
    assert.ok(readSignals.every(signal=>signal!==requestSignals.get(visual)),'window reads cannot cancel shared metadata');
    assert.equal(layer.active,0);
    assert.equal(layer.controllers.size,0);
    assert.equal(layer.events.filter(event=>event.name==='coverage'&&!event.detail.pending).length,2);
  } finally {
    layer?.onRemove();
    // Settle a still-pending mock request so a failed assertion does not leave its timeout alive.
    if(!metadataSettled)releaseMetadata?.();
    await nextTurn();
    for(const [key,descriptor] of Object.entries(original)) {
      if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
    }
  }
});
