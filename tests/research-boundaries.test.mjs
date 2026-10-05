import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {makeDemo,defaultConfig,baselineAllocation} from '../src/data.js';
import {evaluate,search} from '../src/model.js';

const data=makeDemo(),config=defaultConfig(),ids=data.farms.map(f=>f.id);
const climate=JSON.parse(fs.readFileSync(new URL('../data/public/climate.json',import.meta.url)));
test('all default accounting outputs match the independently captured 0.3.13 release',()=>{
  const result=search(data,ids,config,climate),digest=createHash('sha256');
  for(const candidate of [...result.candidates].sort((a,b)=>a.id.localeCompare(b.id))){
    const {score,...accounting}=candidate;
    // Numerical/structural compatibility with captured legacy outputs; the optional-input engine has a new declared version.
    accounting.modelVersion='screening-0.2.0';digest.update(JSON.stringify(accounting));
  }
  assert.equal(result.evaluated,3897);assert.equal(result.feasibleCount,2008);assert.equal(result.frontierCount,1414);
  assert.equal(result.inputHash,'b8d1c685');
  assert.equal(digest.digest('hex'),'e7e7a40a26cf3c5697118d643720a24c4da8f56340268d6cc843487491847017');
});
test('coordinates alone are not a spatial interaction model and independent windows carry no state',()=>{
  const allocation=baselineAllocation(data.plots),shifted=structuredClone(data);
  for(const plot of shifted.plots)for(const ring of plot.geometry.coordinates)for(const point of ring)point[0]+=.001;
  assert.deepEqual(evaluate(data,ids,allocation,config,climate).totals,evaluate(shifted,ids,allocation,config,climate).totals);
  const noRain=structuredClone(climate);for(const row of noRain.records)row.precipitationMmMonth=0;
  const q1=evaluate(data,ids,allocation,config,noRain),q2=evaluate(data,ids,allocation,{...config,quarter:1},noRain);
  assert.deepEqual(q1.totals,q2.totals);
  assert.deepEqual(q1.balances.map(row=>row.capacity),q2.balances.map(row=>row.capacity));
});
test('paper fields in imported inputs cannot replace executable coefficients or formulas',()=>{
  const injected=structuredClone(data);injected.paper={alpha:1e9,formula:'return 0',bodyVerified:true,CROPS:{rice:{revenue:1e9}}};
  const allocation=baselineAllocation(data.plots);
  const original=evaluate(data,ids,allocation,config,climate),result=evaluate(injected,ids,allocation,config,climate);
  assert.deepEqual(result.totals,original.totals);assert.deepEqual(result.plots,original.plots);
});
