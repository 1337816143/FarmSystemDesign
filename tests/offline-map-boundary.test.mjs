import test from 'node:test';
import assert from 'node:assert/strict';
import {createLandcoverLayer} from '../src/landcover-layer.js';
import {classifiedTileText} from '../src/atlas-status.js';

test('offline classification keeps absent local records explicit and never constructs a remote image',async()=>{
 const navigatorDescriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),oldImage=globalThis.Image;let images=0,done=0;
 try{
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
  globalThis.Image=class{constructor(){images++;throw Error('Remote image must not be created offline');}};
  const L={GridLayer:{extend:methods=>{function Layer(){}Object.assign(Layer.prototype,methods);return Layer;}}};
  const layer=createLandcoverLayer(L);layer._classCatalogPromise=Promise.resolve({records:[]});layer.fire=()=>{};
  const tile={_classController:new AbortController(),dataset:{},classList:{add:()=>{throw Error('An unavailable tile must not claim displayed pixels');}}};
  await layer._renderClass({tile,coords:{x:0,y:0,z:0},done:()=>done++});
  assert.equal(images,0);assert.equal(done,1);assert.equal(tile.dataset.mode,'offline-unavailable');assert.equal(tile.dataset.coverageStatus,'offline-unavailable');assert.equal(tile._classCoverage.transport,'online-only');assert.equal(tile._classCoverage.filled,undefined);
 }finally{if(navigatorDescriptor)Object.defineProperty(globalThis,'navigator',navigatorDescriptor);else delete globalThis.navigator;globalThis.Image=oldImage;}
});
test('offline classifications are distinct from both loaded tiles and source no-data',()=>{
 const rows=[{status:'displayed',filled:10},{status:'offline-unavailable',transport:'online-only'}];
 assert.match(classifiedTileText(rows,false,true),/1 classification tiles loaded/);
 assert.match(classifiedTileText(rows,false,true),/1 online-only tiles are unavailable offline/);
 assert.match(classifiedTileText(rows,false,false),/离线不可用/);
});
