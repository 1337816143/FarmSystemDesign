import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {makeDemo,defaultConfig,baselineAllocation} from '../src/data.js';
import {prepareSpatialRainfall,spatialInputStatus} from '../src/spatial-inputs.js';
import {evaluate,search} from '../src/model.js';
import {captureRunContext,buildFrozenRun,verifyFrozenRun} from '../src/frozen-run.js';
import {ENGINE_IDENTITY} from '../src/engine-identity.generated.js';
const d=makeDemo(),ids=d.farms.map(f=>f.id),allocation=baselineAllocation(d.plots);
const contract=JSON.parse(fs.readFileSync(new URL('../data/derived/spatial-inputs-2025.json',import.meta.url)));
const climate=JSON.parse(fs.readFileSync(new URL('../data/public/climate.json',import.meta.url)));
const cfg={...defaultConfig(),spatialRainfall:contract};
const copy=()=>structuredClone(contract);
test('published bindings preserve all 110 plot identities, 1320 native monthly values and one independent rainfall cell',()=>{
 const status=spatialInputStatus(contract,d.plots);assert.equal(status.ready,true);assert.equal(status.plotCount,110);assert.equal(status.uniqueGridCells,1);
 assert.equal(contract.bindings.length,110);assert.ok(contract.bindings.every(b=>b.rainfall.length===12));
 for(const source of contract.sources){const bytes=fs.readFileSync(new URL(`../${source.path}`,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256,source.path);}
 assert.equal(contract.bindings[0].rainfall[0].units,'mm/month');
});
test('wrong units, periods, values, geometry, area, point, cell, CRS and missing coverage fail closed',()=>{
 for(const mutate of [c=>c.units='mm/day',c=>c.periodYear=2024,c=>c.bindings[0].rainfall[0].period='2025-02',c=>c.bindings[0].rainfall[0].value=null,c=>c.bindings[0].rainfall[0].value=-1,c=>c.bindings[0].rainfall[0].value=NaN,c=>c.bindings[0].rainfall[0].status='source-nodata',c=>c.bindings[0].rainfall[0].row++,c=>c.bindings[0].rainfall[0].cellBounds[0]+=.1,c=>c.bindings[0].rainfall.pop(),c=>c.bindings[0].areaHa++,c=>c.bindings[0].representativePoint[0]+=.01,c=>c.bindings[0].geometryFingerprint='bad',c=>c.bindings.push(c.bindings[0]),c=>c.sources.find(s=>s.role==='model-input'&&s.bounds).crs='EPSG:3857',c=>c.bindings.shift()]){
  const broken=copy();mutate(broken);assert.throws(()=>evaluate(d,ids,allocation,{...cfg,spatialRainfall:broken},climate),/Spatial rainfall unavailable/);
 }
 const shifted=structuredClone(d);shifted.plots[0].geometry.coordinates[0][0][0]+=.001;
 assert.throws(()=>evaluate(shifted,ids,allocation,cfg,climate),/binding mismatch/);
});
test('input conversion changes only supplemental demand and related costs, never crop/yield/capacity calibration',()=>{
 const old=evaluate(d,ids,allocation,defaultConfig(),climate),spatial=evaluate(d,ids,allocation,cfg,climate);
 assert.ok(Math.abs(spatial.totals.water-431385.0247510644)<1e-6);
 assert.ok(Math.abs(spatial.totals.water-old.totals.water-7416.538050568954)<1e-6);
 assert.equal(spatial.totals.revenue,old.totals.revenue);assert.equal(spatial.totals.labour,old.totals.labour);assert.equal(spatial.totals.nSurplus,old.totals.nSurplus);assert.equal(spatial.totals.energy,old.totals.energy);assert.equal(spatial.totals.waterCapacity,old.totals.waterCapacity);
 assert.equal(spatial.rainMonths,null);assert.equal(spatial.plots[0].rainMonths[0],contract.bindings[0].rainfall[0].value);
 const modified=copy();for(const b of modified.bindings){b.context={landCover:{classCode:1},administrative:{matches:[]},temperature:[]};}
 assert.deepEqual(evaluate(d,ids,allocation,{...cfg,spatialRainfall:modified},climate).totals,spatial.totals);
 assert.deepEqual(evaluate(d,ids,allocation,defaultConfig(),climate),old);
});
test('monthly alignment, selected scope, rainfall multiplier and scenario repeatability are retained',()=>{
 for(let quarter=0;quarter<4;quarter++){
  const config={...cfg,quarter},r=evaluate(d,['F01'],allocation,config,climate);
  assert.equal(r.spatialRainfall.plotCount,4);assert.deepEqual(r.plots[0].rainMonths,contract.bindings[0].rainfall.slice(quarter*3,quarter*3+3).map(o=>o.value));
 }
 const noRain={...cfg,rain:0},baselineNoRain={...defaultConfig(),rain:0};assert.deepEqual(evaluate(d,ids,allocation,noRain,climate).totals,evaluate(d,ids,allocation,baselineNoRain,climate).totals);
 const a=search(d,['F01'],cfg,climate),b=search(d,['F01'],cfg,climate);assert.deepEqual(a.candidates,b.candidates);assert.equal(a.exact,true);
 assert.notEqual(a.inputHash,search(d,['F01'],defaultConfig(),climate).inputHash);
});
test('FrozenRun captures the optional contract and detects rainfall tampering without replacing legacy snapshots',async()=>{
 const inputs={dataset:d,farmIds:['F01'],config:cfg,climate},result=search(d,inputs.farmIds,cfg,climate),context=captureRunContext(inputs);
 const release={status:'verified',metadata:{version:ENGINE_IDENTITY.applicationVersion,modelVersion:ENGINE_IDENTITY.modelVersion,dataVersion:ENGINE_IDENTITY.dataVersion,engineDigest:ENGINE_IDENTITY.digest,commit:'a'.repeat(40),name:'Spatial test',releasedOn:'2026-10-04',changes:[]}};
 const frozenRun=await buildFrozenRun(result,context,release,{cryptoProvider:webcrypto}),record={...result,runInputs:context.runInputs,frozenRun};
 assert.equal(frozenRun.captureStatus,'complete-record');assert.equal((await verifyFrozenRun(record,{cryptoProvider:webcrypto})).status,'verified');
 const changed=structuredClone(record);changed.runInputs.config.spatialRainfall.bindings[0].rainfall[0].value++;
 assert.equal((await verifyFrozenRun(changed,{cryptoProvider:webcrypto})).status,'mismatch');
});
test('actual prior 0.3.14 public-code FrozenRun remains verifiable without retroactive spatial parameters',async()=>{
 const historical=JSON.parse(fs.readFileSync(new URL('./fixtures/frozen-run-0.3.14.json',import.meta.url)));
 assert.equal(historical.modelVersion,'screening-0.2.0');assert.equal(historical.runInputs.config.spatialRainfall,undefined);
 assert.equal((await verifyFrozenRun(historical,{cryptoProvider:webcrypto})).status,'verified');
 assert.ok(!historical.frozenRun.engineIdentity.modules.some(m=>m.path==='src/spatial-inputs.js'));
 const altered=structuredClone(historical);altered.baseline.totals.water++;
 assert.equal((await verifyFrozenRun(altered,{cryptoProvider:webcrypto})).status,'mismatch');
 const relabeled=structuredClone(historical);relabeled.frozenRun.engineIdentity.applicationVersion='0.3.15';
 assert.equal((await verifyFrozenRun(relabeled,{cryptoProvider:webcrypto})).status,'unavailable');
});
