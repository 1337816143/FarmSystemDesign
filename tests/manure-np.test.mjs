// Regenerated after environment reset from visible contracts and reviewed-core behavior.
// This is a new test-file identity, not recovered original test bytes.
import {fixture} from './fixtures/manure-np.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeDemo,defaultConfig,baselineAllocation,validateDataset,rng} from '../src/data.js';
import {evaluate,search} from '../src/model.js';
import {evaluate as legacyEvaluate,search as legacySearch} from './fixtures/model-before-np.mjs';
import {splitManureByNP,distributeManureNP} from '../src/manure-np.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const split=overrides=>splitManureByNP({nitrogen:40,phosphorus:20,availableNFraction:.45,availableNCapacity:18,totalPCapacity:10,...overrides});
const row=(id,n,need,village='V')=>({id,villageId:village,manureRecovered:n,nNeed:need,transferCost:0,nTransferIn:0,nTransferOut:0});
const binding=(id,p,cap)=>({farmId:id,recoveredManureP:p,remainingApplicationCapacityP:cap,provenance:'synthetic',source:'explicit synthetic software counterexample, not an observation'});
const contract=bindings=>({schema:'FarmSystemDesign.ManurePhosphorusContract',schemaVersion:1,period:'2025-Q1',unit:'kg elemental P',bindings});
const options={availableNFraction:.45,transferCostPerKgN:2};
test('N40/P20 hand calculation transfers one half under P10 capacity',()=>{const r=split();assert.equal(r.fraction,.5);assert.deepEqual(r.applied,{nitrogen:20,phosphorus:10});assert.deepEqual(r.remaining,{nitrogen:20,phosphorus:10});assert.equal(r.availableN,9);});
test('N/P/supply limits and explicit zero caps remain physical',()=>{assert.equal(split({availableNCapacity:4.5}).fraction,.25);assert.equal(split({totalPCapacity:0}).fraction,0);assert.equal(split({totalPCapacity:100,availableNCapacity:100}).fraction,1);assert.equal(split({phosphorus:0,totalPCapacity:0}).fraction,1);assert.equal(split({nitrogen:0}).fraction,0);});
test('missing, invalid or wrong-unit/quarter inputs fail closed',()=>{
 for(const value of [undefined,null,-1,NaN,Infinity,'20'])assert.throws(()=>split({phosphorus:value}));
 for(const availableNFraction of [0,-.1,1.01,null,NaN])assert.throws(()=>split({availableNFraction}));
 for(const edit of [c=>delete c.bindings[0].recoveredManureP,c=>c.bindings[0].remainingApplicationCapacityP=null,c=>c.unit='kg P2O5',c=>c.period='2025-Q2',c=>c.bindings[0].source='',c=>c.bindings.push({...c.bindings[0]})]){const c=contract([binding('A',20,10)]);edit(c);assert.throws(()=>distributeManureNP([row('A',40,18)],'independent',c,0,options));}
});
test('legacy N-only feasibility does not enforce an explicit P capacity',()=>{const f=fixture();assert.deepEqual(validateDataset(f.data),[]);const old=legacyEvaluate(f.data,f.ids,f.allocation,f.config,null),r=old.farms.find(r=>r.id==='receiver');assert.equal(old.feasible,true);close(r.manureApplied,40);close(r.chemicalN,0);close(r.manureApplied*.5,20);assert.ok(r.manureApplied*.5>10);});
test('integrated core respects P capacity, paired material, mineral N and immutable input',()=>{
 const f=fixture(),before=JSON.stringify(f),r=evaluate(f.data,f.ids,f.allocation,f.config,null),receiver=r.farms.find(r=>r.id==='receiver'),donor=r.farms.find(r=>r.id==='donor');
 assert.equal(r.feasible,true);close(receiver.manureApplied,20);close(receiver.manureAppliedP,10);close(receiver.chemicalN,9);close(donor.manureRemaining,37.2);close(donor.manureRemainingP,18.6);
 for(const el of ['N','P'])close(r.manurePhosphorus[`recovered${el}`],r.manurePhosphorus[`applied${el}`]+r.manurePhosphorus[`remaining${el}`]);close(receiver.pTransferIn,donor.pTransferOut);close(receiver.nTransferIn,donor.nTransferOut);close(r.totals.nInput-r.totals.nOutput,r.totals.nSurplus);assert.equal(JSON.stringify(f),before);
});
test('own use is P limited and donor composition stays attached',()=>{
 const rows=[row('A',20,9),row('B',40,0),row('C',40,18),row('D',0,30)],r=distributeManureNP(rows,'cooperative',contract([binding('A',10,2),binding('B',2,0),binding('C',20,4),binding('D',0,10)]),0,options);
 for(const x of rows){assert.ok(x.manureAppliedP<=x.manureApplicationCapacityP+1e-9);close(x.manureRecovered+x.nTransferIn-x.nTransferOut,x.manureApplied+x.manureRemaining);close(x.manureRecoveredP+x.pTransferIn-x.pTransferOut,x.manureAppliedP+x.manureRemainingP);}
 const flows=r.transfers.filter(t=>t.from==='B');assert.ok(flows.length);for(const t of flows)close(t.phosphorusQuantity/t.quantity,.05);
});
test('sharing modes respect selected and cooperative group boundaries',()=>{
 for(const mode of ['independent','cooperative']){const r=distributeManureNP([row('A',40,0,'V1'),row('B',0,18,'V2')],mode,contract([binding('A',20,0),binding('B',0,10),binding('OUTSIDE',1e6,1e6)]),0,options);assert.equal(r.transfers.length,0);assert.equal(r.budget.recoveredP,20);}
 const r=distributeManureNP([row('A',40,0,'V1'),row('B',0,18,'V2')],'centralized',contract([binding('A',20,0),binding('B',0,10)]),0,options);assert.equal(r.transfers.length,1);assert.equal(r.budget.appliedP,10);
});
test('selected farm P bindings cannot be omitted',()=>{const f=fixture();f.config.manurePhosphorus.bindings.pop();assert.throws(()=>evaluate(f.data,f.ids,f.allocation,f.config,null),/missing P binding/);});
test('500 deterministic synthetic systems conserve both elements and obey caps',()=>{
 const random=rng(20261006);for(let i=0;i<500;i++){
  const rows=Array.from({length:5},(_,j)=>row(`F${j}`,random()*200,random()*100,j<3?'A':'B')),c=contract(rows.map(r=>binding(r.id,random()*80,random()*30))),res=distributeManureNP(rows,['independent','cooperative','centralized'][i%3],c,0,options);
  for(const r of rows){assert.ok(r.manureAppliedP<=r.manureApplicationCapacityP+1e-8);assert.ok(r.manureApplied*.45<=r.nNeed+1e-8);assert.ok(r.manureRemaining>=0&&r.manureRemainingP>=0);close(r.manureRecovered+r.nTransferIn-r.nTransferOut,r.manureApplied+r.manureRemaining);close(r.manureRecoveredP+r.pTransferIn-r.pTransferOut,r.manureAppliedP+r.manureRemainingP);}
  close(res.budget.recoveredP,res.budget.appliedP+res.budget.remainingP);close(res.budget.recoveredN,res.budget.appliedN+res.budget.remainingN);close(rows.reduce((s,r)=>s+r.pTransferIn-r.pTransferOut,0),0);
 }
});
test('all twelve default mode/quarter outputs equal original pre-NP logic',()=>{
 const d=makeDemo(),ids=d.farms.map(f=>f.id),a=baselineAllocation(d.plots),climate=JSON.parse(fs.readFileSync(new URL('../data/public/climate.json',import.meta.url)));
 for(const mode of ['independent','cooperative','centralized'])for(let quarter=0;quarter<4;quarter++){const c={...defaultConfig(),mode,quarter};assert.deepEqual(evaluate(d,ids,a,c,climate),legacyEvaluate(d,ids,a,c,climate));}
});
test('legacy exact search remains equal and opt-in exact search uses P accounting',()=>{const d=makeDemo(),c=defaultConfig(),clean=({createdAt,...r})=>r;assert.deepEqual(clean(search(d,['F01'],c,null)),clean(legacySearch(d,['F01'],c,null)));const f=fixture(),r=search(f.data,f.ids,f.config,null);assert.equal(r.exact,true);assert.equal(r.evaluated,16);for(const x of r.candidates)for(const farm of x.farms)assert.ok(farm.manureAppliedP<=farm.manureApplicationCapacityP+1e-8);});
test('underflowed availability at zero demand yields finite no-op',()=>{assert.equal(Number.MIN_VALUE*.45,0);assert.deepEqual(split({nitrogen:Number.MIN_VALUE,phosphorus:20,availableNCapacity:0}),{fraction:0,applied:{nitrogen:0,phosphorus:0},remaining:{nitrogen:Number.MIN_VALUE,phosphorus:20},availableN:0});});
test('stable N ratio handles underflow and nonlimiting saturation',()=>{const a=split({nitrogen:1e284,phosphorus:0,availableNFraction:1e-300,availableNCapacity:Number.MIN_VALUE,totalPCapacity:0});assert.ok(a.fraction>0&&a.fraction<1);assert.ok(a.applied.nitrogen>4.9e-24&&a.applied.nitrogen<5e-24);assert.equal(a.availableN,Number.MIN_VALUE);const b=split({nitrogen:40,phosphorus:0,availableNFraction:Number.MIN_VALUE,availableNCapacity:1e308,totalPCapacity:0});assert.equal(b.fraction,1);for(const r of [a,b])for(const v of [r.fraction,...Object.values(r.applied),...Object.values(r.remaining),r.availableN])assert.ok(Number.isFinite(v)&&v>=0);});
test('finite unit costs cannot overflow a transfer charge or accumulated cost',()=>{const c=contract([binding('A',0,0),binding('B',0,0)]);assert.throws(()=>distributeManureNP([row('A',40,0),row('B',0,18)],'centralized',c,0,{...options,transferCostPerKgN:1e308}),/transfer charge overflow/);assert.throws(()=>distributeManureNP([row('A',1,0),{...row('B',0,.45),transferCost:1e308}],'centralized',c,0,{...options,transferCostPerKgN:1e308}),/accumulated transfer cost overflow/);});
test('summed recovered N overflow is rejected instead of emitting Infinity',()=>{assert.throws(()=>distributeManureNP([row('A',1e308,0),row('B',1e308,0)],'independent',contract([binding('A',0,0),binding('B',0,0)]),0,options),/recoveredN overflow/);});
