import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {fixture} from './fixtures/manure-np.mjs';
import {makeDemo,defaultConfig,validateDataset,CROPS} from '../src/data.js';
import {evaluate,search,validateConfig} from '../src/model.js';
import {verifyFrozenRun} from '../src/frozen-run.js';
const cleanFixture=()=>{const f=fixture();delete f.config.manurePhosphorus;return f;};
test('L1 individually finite capacities cannot overflow quarter totals into JSON null',()=>{
 for(const field of ['water','labour']){const f=cleanFixture();for(const farm of f.data.farms)farm[field]=[0,0,0];f.data.farms[0][field]=[7e307,7e307,7e307];assert.deepEqual(validateDataset(f.data),[]);assert.throws(()=>evaluate(f.data,f.ids,f.allocation,f.config,null),/非有限值/);}
});
test('L1 monthly pooled capacity overflow is rejected before feasibility comparison',()=>{
 for(const field of ['water','labour']){const f=cleanFixture();for(const farm of f.data.farms)farm[field]=[1e308,0,0];f.config.mode='centralized';assert.throws(()=>evaluate(f.data,f.ids,f.allocation,f.config,null),/Non-finite monthly resource/);}
});
test('L1 scenario multipliers cannot turn finite capacity into Infinity',()=>{
 for(const field of ['water','labour']){const f=cleanFixture();f.data.farms[0][field]=[1e308,0,0];f.config[field]=2;assert.throws(()=>evaluate(f.data,f.ids,f.allocation,f.config,null),/Non-finite or negative/);}
});
test('L1 unused outside-boundary capacity is also finite in every returned record',()=>{
 const f=cleanFixture();f.data.farms[1].water=[1e308,1e308,1e308];assert.throws(()=>evaluate(f.data,['donor'],{D:'cover'},f.config,null),/Non-finite outside reserved water/);
});
test('L1 large but finite and ordinary zero capacities retain finite JSON accounting',()=>{
 for(const field of ['water','labour'])for(const amount of [0,1e100]){const f=cleanFixture();for(const farm of f.data.farms)farm[field]=[amount,amount,amount];const r=evaluate(f.data,f.ids,f.allocation,f.config,null),encoded=JSON.parse(JSON.stringify(r));assert.equal(encoded.totals[field+'Capacity'],r.totals[field+'Capacity']);assert.ok(Number.isFinite(r.totals[field+'Capacity']));assert.ok(r.balances.every(b=>Number.isFinite(b.capacity)&&Number.isFinite(b.demand)));}
});
test('L2 sample budget requires an integer 100..6000, without clamp, coercion or fallback',()=>{
 for(const samples of [undefined,null,NaN,Infinity,-1,0,99,6001,1.5,'1600',true,Number.MAX_SAFE_INTEGER])assert.throws(()=>validateConfig({...defaultConfig(),samples}),/Invalid samples/);
 for(const samples of [100,1600,6000])assert.doesNotThrow(()=>validateConfig({...defaultConfig(),samples}));
});
test('L2 seed requires an unsigned 32-bit integer without coercion',()=>{
 for(const seed of [undefined,null,NaN,Infinity,-1,2**32,1.5,'123',true,Number.MAX_SAFE_INTEGER])assert.throws(()=>validateConfig({...defaultConfig(),seed}),/Invalid seed/);
 for(const seed of [0,20260929,0xffffffff])assert.doesNotThrow(()=>validateConfig({...defaultConfig(),seed}));
});
test('L2 both direct evaluation and search reject malformed settings before computation',()=>{
 const f=cleanFixture();for(const bad of [{samples:NaN},{samples:-1},{samples:'bad'},{seed:NaN},{seed:Infinity}]){const c={...f.config,...bad};assert.throws(()=>evaluate(f.data,f.ids,f.allocation,c,null),/Invalid (samples|seed)/);assert.throws(()=>search(f.data,f.ids,c,null),/Invalid (samples|seed)/);}
});
test('L2 random-draw budget does not falsely cap baseline, uniform, local and exact candidates',()=>{
 const data=makeDemo(),c={...defaultConfig(),samples:100},r=search(data,data.farms.map(f=>f.id),c,null);assert.ok(r.evaluated>100);assert.equal(r.config.samples,100);
 const f=cleanFixture();assert.equal(search(f.data,f.ids,{...f.config,samples:100},null).evaluated,16);
});
test('pre-revision d097 record keeps old seed/sample parameters and outputs without current validation or recomputation',async()=>{
 const old=JSON.parse(fs.readFileSync(new URL('./fixtures/frozen-run-0.3.20-np-before-revision.json',import.meta.url))),before=JSON.stringify(old);
 assert.equal(old.frozenRun.engineIdentity.digest,'d0974161afa7d5698e7f0ab07eec24658df96ec7c103171f17bf052b73d2a3af');assert.equal(old.config.samples,50);assert.equal(old.config.seed,-1);assert.equal(old.modelVersion,'screening-0.2.2');assert.ok(old.baseline.manurePhosphorus);
 assert.throws(()=>validateConfig(old.config),/Invalid samples/);assert.equal((await verifyFrozenRun(old,{cryptoProvider:webcrypto})).status,'verified');assert.equal(JSON.stringify(old),before);
 const currentRevenue=CROPS.rice.revenue;
 try{CROPS.rice.revenue+=100000;assert.equal((await verifyFrozenRun(old,{cryptoProvider:webcrypto})).status,'verified');assert.equal(JSON.stringify(old),before);}
 finally{CROPS.rice.revenue=currentRevenue;}
 for(const edit of [
  r=>r.frozenRun.engineIdentity.modules[0].sha256='0'.repeat(64),
  r=>r.frozenRun.engineIdentity.digest='0'.repeat(64),
  r=>r.frozenRun.engineIdentity.applicationVersion='0.3.21',
  r=>r.frozenRun.engineIdentity.modelVersion='screening-0.2.3',
  r=>r.modelVersion='screening-0.2.3',
  r=>r.config.samples=100,
  r=>r.runInputs.config.seed=0,
  r=>r.frozenRun.parameters.CROPS.rice.revenue+=1,
  r=>r.baseline.totals.margin+=1,
  r=>r.frozenRun.captureStatus='complete-record'
 ]){const changed=structuredClone(old);edit(changed);assert.notEqual((await verifyFrozenRun(changed,{cryptoProvider:webcrypto})).status,'verified');}
 assert.equal(JSON.stringify(old),before);
});
