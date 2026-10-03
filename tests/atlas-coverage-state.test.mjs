import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HainanAtlas,atlasCoverageSummary} from '../src/hainan-atlas.js';

const environment=JSON.parse(fs.readFileSync(new URL('../data/hainan/regional/environment/environment-manifest.json',import.meta.url)));
const config=key=>({kind:key,records:environment.layers[{dsm:'dsm',soil:'soilPh',soc:'soilSoc',rain:'rain'}[key]].previews.map(r=>({...r,bounds_wsen:r.bbox}))});
const island=[108.5,17.8,111.5,20.5];
const oldCounts=/1,316,924|1,640,250|80\.29/;

test('DSM detail replaces the lower-zoom overview denominator and does not claim whole-island coverage',()=>{
 const base={layer:'dsm',config:config('dsm'),id:'main',bounds:island};
 assert.match(atlasCoverageSummary({...base,zoom:8}),oldCounts);
 for(const id of ['main','county-3','wuzhishan']){
  const detail=atlasCoverageSummary({...base,id,zoom:12});
  assert.match(detail,/地表高程 DSM.*连续约30m分块/);
  assert.match(detail,/不作为当前视窗或全岛覆盖率/);
  assert.doesNotMatch(detail,oldCounts);assert.doesNotMatch(detail,/SCL|COG|无云/);
 }
 assert.doesNotMatch(atlasCoverageSummary({...base,zoom:12,bounds:[117,14,118,16]}),/连续约30m/);
});

test('classification and historical coverage labels replace any stale regional statistics',()=>{
 const stale=config('dsm');
 for(const [layer,label] of [['classes2025',/2025完整土地覆盖/],['crops2025',/2025仅作物类别/],['landcover',/2021 WorldCover/]]){
  const text=atlasCoverageSummary({layer,config:stale,zoom:12,bounds:island});
  assert.match(text,label);assert.doesNotMatch(text,oldCounts);assert.doesNotMatch(text,/DSM|SCL/);
 }
 assert.match(atlasCoverageSummary({layer:'crops2025'}),/其他有效类别也透明/);
 assert.match(atlasCoverageSummary({layer:'landcover'}),/不是当前视窗覆盖率/);
});

test('pending and failed metadata never borrow another layer statistics in either language',()=>{
 for(const en of [false,true]){
  const pending=atlasCoverageSummary({layer:'rain',config:config('dsm'),en});
  const failed=atlasCoverageSummary({layer:'rain',config:config('dsm'),failed:true,en});
  assert.match(pending,en?/Reading the current layer catalog/:/正在读取当前图层目录/);
  assert.match(failed,en?/Layer read failed/:/图层读取失败/);
  assert.doesNotMatch(pending,oldCounts);assert.doesNotMatch(failed,oldCounts);
  assert.doesNotMatch(failed,/DSM|SCL/);
 }
 assert.match(atlasCoverageSummary({layer:'landcover',failed:true}),/2021 WorldCover.*读取失败/);
});

test('environment source notes omit satellite-only cloud-screening claims',()=>{
 for(const layer of ['rain','soil','soc','dsm'])for(const en of [false,true]){
  const text=atlasCoverageSummary({layer,config:config(layer),zoom:8,bounds:island,en});
  assert.doesNotMatch(text,/SCL|cloud-free|无云|COG/);
 }
 const record={id:'main',coverage:{grid_cells:100,valid_cells:90}};
 const monthly=atlasCoverageSummary({layer:'monthlyRain',config:{kind:'monthlyRain',period:'2025-07',records:[record]}});
 assert.match(monthly,/2025逐月降水.*2025-07/);
 assert.match(atlasCoverageSummary({layer:'imagery',config:{kind:'imagery',records:[record]}}),/SCL不保证无云/);
});

test('actual layer-switch entry clears coverage before the asynchronous layer loader and keeps failures current',()=>{
 const elements=new Map(),node=id=>{if(!elements.has(id))elements.set(id,{value:id==='#atlas-region'?'main':'',textContent:'',hidden:false});return elements.get(id);};
 const atlas=Object.create(HainanAtlas.prototype);
 Object.assign(atlas,{layer:'dsm',language:'zh',remoteLayer:{regionalConfig:config('dsm')},map:{getZoom:()=>8,getBounds:()=>({getWest:()=>island[0],getSouth:()=>island[1],getEast:()=>island[2],getNorth:()=>island[3]}),removeLayer(){}},host:{querySelector:node,contains:()=>true,classList:{contains:()=>false}},updateScaleStatus(){},updateDataLinks(){}});
 atlas.updateCoverage();assert.match(node('#atlas-regional-status').textContent,oldCounts);
 let loaderCalled=false;atlas.selectRegional=()=>{loaderCalled=true;assert.match(node('#atlas-regional-status').textContent,/2025 年降水.*正在读取/);assert.doesNotMatch(node('#atlas-regional-status').textContent,oldCounts);};
 const button={dataset:{atlas:'rain'}};
 atlas.handleClick({target:{closest:selector=>selector==='[data-atlas]'?button:null}});
 assert.equal(loaderCalled,true);assert.equal(atlas.remoteLayer,null);
 atlas.coverageFailure=true;atlas.updateCoverage();atlas.updateCoverage();
 assert.match(node('#atlas-regional-status').textContent,/2025 年降水.*读取失败/);assert.doesNotMatch(node('#atlas-regional-status').textContent,oldCounts);
});
