import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {defaultInput} from '../src/fixture.js';
import {BUILD} from '../src/build.generated.js';
import {validateInput,run,evaluateMenu,compareTemporal,compositions,dominates,makeRecord,inputFromRecord} from '../src/engine.js';
import {splitManureByNP} from '../src/np-interface.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const clone=x=>structuredClone(x);
test('Default synthetic input is explicit, complete and leaves original A untouched',()=>{
 const input=defaultInput();assert.equal(validateInput(input),true);const before=JSON.stringify(input);run(input);assert.equal(JSON.stringify(input),before);assert.equal(input.representativeness.status,'absent');assert.equal(input.social.status,'not-measured');
});
test('Hand enumeration: 9 combinations, 5 period feasible, 8 annual feasible; all 5 are nondominated',()=>{
 const r=compareTemporal(defaultInput());assert.equal(r.period.search.total,9);assert.equal(r.period.search.evaluated,9);assert.equal(r.period.search.feasible,5);assert.equal(r.period.search.frontier,5);assert.equal(r.annual.search.feasible,8);assert.equal(r.annualFalseFeasible.length,3);
 const high=r.period.frontier[0];assert.equal(high.id,'0-1-0|0-1-0');assert.deepEqual(high.totals,{areaHa:2,grossMarginCny:3900,externalN:100,externalP:24,nBalance:28,pBalance:8,waterTotal:240,laborTotal:265,productsKg:{grain:1500,vegetable:1200}});
});
test('Annual labor masks a 40 h first-window shortfall, not true total shortage',()=>{const i=defaultInput(),s=i.strata[0],m=s.menus[0];assert.equal(evaluateMenu(s,m,i.periods,{annual:true}).feasible,true);const x=evaluateMenu(s,m,i.periods);assert.equal(x.feasible,false);assert.equal(x.issues[0].key,'labor');assert.equal(x.issues[0].excess,40);assert.equal(x.issues[0].period,'模拟期1');});
test('Individually feasible menus can exceed a shared source; different verified source link changes spatial resource outcome',()=>{
 const input=defaultInput();assert.equal(evaluateMenu(input.strata[0],input.strata[0].menus[1],input.periods).feasible,true);assert.equal(evaluateMenu(input.strata[1],input.strata[1].menus[0],input.periods).feasible,true);
 const id='0-1-0|1-0-0',a=run(input).results.find(x=>x.id===id);assert.equal(a.feasible,false);assert.equal(a.issues[0].excess,15);
 const changed=clone(input);changed.strata[1].waterSourceId='independent';const b=run(changed).results.find(x=>x.id===id);assert.equal(b.feasible,true);assert.deepEqual(b.totals,a.totals);assert.notDeepEqual(b.waterBySource,a.waterBySource);
});
test('Local labor cannot be pooled among hypothetical units or periods',()=>{const i=defaultInput();i.strata[0].count=2;i.constraints.maxExternalN=1000;i.constraints.maxExternalP=1000;i.waterSources[0].capacity=[1000,1000];const r=run(i);assert.ok(r.results.filter(x=>x.allocations[0][0]>0).every(x=>!x.feasible&&x.issues.some(v=>v.key==='labor')));});
test('Product floors remain separate; more vegetables cannot replace grain',()=>{const i=defaultInput();i.constraints.minProductsKg.grain=10000;i.strata.forEach(s=>s.menus.forEach(m=>m.productsKg.vegetable=1e6));const r=run(i);assert.equal(r.search.feasible,0);assert.ok(r.results.every(x=>x.issues.some(v=>v.key==='product:grain')));});
test('P cap is independent from N; tightening P never creates new feasible results',()=>{const i=defaultInput();i.constraints.maxExternalP=18;const r=run(i);assert.equal(r.search.feasible,1);assert.equal(r.frontier[0].id,'0-0-1|0-0-1');assert.ok(r.results.find(x=>x.id==='0-1-0|0-1-0').issues.some(v=>v.key==='external-P-scenario-cap'));});
test('No fake geography, PhD1 readiness, evidence, units, weighting or social status can pass validation',()=>{
 for(const mutate of [x=>x.evidence='observed',x=>x.inferenceScope='hainan-province',x=>x.representativeness.status='verified',x=>x.social.status='accepted',x=>x.strata[0].menus[0].phd1CandidateId='trial-1',x=>x.accounting.nutrients='kg P2O5',x=>x.strata[0].waterSourceId='missing',x=>x.strata[1].id='alpha',x=>x.strata[0].menus[0].externalP=null,x=>x.strata[0].menus[0].laborHours=[10],x=>x.strata[0].count=0,x=>x.strata[0].count=1.5,x=>x.strata[0].laborCapacity[0]=NaN,x=>x.constraints.maxExternalN=1e308]){const i=defaultInput();mutate(i);assert.throws(()=>validateInput(i));}
});
test('A different land class is infeasible even if aggregate capacities are sufficient',()=>{const i=defaultInput();i.strata[0].menus[1].landClass='somewhere-else';const r=run(i);assert.ok(r.results.filter(x=>x.allocations[0][1]).every(x=>x.issues.some(v=>v.key==='land-class')));});
test('Exact count composition enumeration and area accounting avoid duplication of exchangeable units',()=>{
 assert.equal(compositions(2,3).length,6);assert.equal(new Set(compositions(2,3).map(JSON.stringify)).size,6);
 const i=defaultInput();i.strata.forEach(s=>s.count=2);i.waterSources.forEach(s=>s.capacity=[1000,1000]);i.constraints.maxExternalN=1000;i.constraints.maxExternalP=1000;const r=run(i);assert.equal(r.search.total,36);r.results.forEach(x=>{assert.equal(x.totals.areaHa,4);x.allocations.forEach(a=>assert.equal(a.reduce((x,y)=>x+y,0),2));});
});
test('Complete search claims are refused over the bounded demonstration space',()=>{const i=defaultInput();i.strata.forEach(s=>s.count=8);assert.throws(()=>run(i),/上限/);assert.throws(()=>run(defaultInput(),{maxCombinations:8}),/上限/);});
test('Frontier dominance permits equal outcomes and preserves genuine tradeoffs',()=>{const a={grossMarginCny:10,externalN:5,waterTotal:8},b={grossMarginCny:9,externalN:6,waterTotal:9};assert.equal(dominates(a,b),true);assert.equal(dominates(a,a),false);assert.equal(dominates(a,{...a,waterTotal:7,grossMarginCny:9}),false);});
test('Output is deterministic and records include full input/result; imported result values are not trusted',()=>{const i=defaultInput(),r=run(i);assert.deepEqual(r,run(i));const record=makeRecord(i,r,{label:'test'});const restored=inputFromRecord(record);record.result.frontier[0].totals.grossMarginCny=999999;assert.deepEqual(run(restored),r);restored.strata[0].count=2;assert.equal(i.strata[0].count,1);assert.equal(record.input.strata[0].count,1);});
test('Hand N40/P20 double gate keeps element composition and remainders',()=>{const r=splitManureByNP({nitrogen:40,phosphorus:20,availableNFraction:1,availableNCapacity:40,totalPCapacity:10});assert.equal(r.fraction,.5);assert.deepEqual(r.applied,{nitrogen:20,phosphorus:10});assert.deepEqual(r.remaining,{nitrogen:20,phosphorus:10});});
test('N/P interface mass conservation and capacity checks in 1000 deterministic synthetic cases',()=>{let seed=42;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32;};for(let i=0;i<1000;i++){const x={nitrogen:rand()*100,phosphorus:rand()*30,availableNFraction:.1+rand()*.9,availableNCapacity:rand()*70,totalPCapacity:rand()*20};const r=splitManureByNP(x);near(r.applied.nitrogen+r.remaining.nitrogen,x.nitrogen);near(r.applied.phosphorus+r.remaining.phosphorus,x.phosphorus);assert.ok(r.availableN<=x.availableNCapacity+1e-8);assert.ok(r.applied.phosphorus<=x.totalPCapacity+1e-8);near(r.applied.nitrogen*x.phosphorus,r.applied.phosphorus*x.nitrogen);}});
test('N/P zero capacities retain material; bad units require main contract and negative inputs reject',()=>{const x={nitrogen:40,phosphorus:20,availableNFraction:1,availableNCapacity:40,totalPCapacity:0};assert.equal(splitManureByNP(x).fraction,0);assert.throws(()=>splitManureByNP({...x,availableNFraction:0}));assert.throws(()=>splitManureByNP({...x,phosphorus:-1}));});
test('Independent naive labelled-unit enumeration agrees with grouped engine across 50 resource scenarios',()=>{
 for(let k=0;k<50;k++){const i=defaultInput();i.waterSources[0].capacity=[70+k*3,90+k*2];i.strata[0].laborCapacity=[60+k,80];i.constraints.maxExternalN=75+k;i.constraints.maxExternalP=19+k/4;
 const actual=run(i).results;const expected=[];
 for(let a=0;a<3;a++)for(let b=0;b<3;b++){const am=i.strata[0].menus[a],bm=i.strata[1].menus[b];const menus=[am,bm];let ok=true;
  for(let s=0;s<2;s++)for(let t=0;t<2;t++)if(menus[s].laborHours[t]>i.strata[s].laborCapacity[t]||menus[s].waterM3[t]>i.strata[s].waterAccess[t])ok=false;
  for(let t=0;t<2;t++)if(am.waterM3[t]+bm.waterM3[t]>i.waterSources[0].capacity[t])ok=false;
  if(am.externalN+bm.externalN>i.constraints.maxExternalN||am.externalP+bm.externalP>i.constraints.maxExternalP||am.productsKg.grain+bm.productsKg.grain<1000)ok=false;
  const aid=[0,0,0],bid=[0,0,0];aid[a]=1;bid[b]=1;expected.push({id:aid.join('-')+'|'+bid.join('-'),feasible:ok});
 }
 for(const x of expected)assert.equal(actual.find(y=>y.id===x.id).feasible,x.feasible,`scenario ${k}, ${x.id}`);
 }
});
test('Source has no network calls, storage writes, A model imports or analytics',()=>{assert.equal(BUILD.engineSha256,crypto.createHash('sha256').update(fs.readFileSync(new URL('../src/engine.js',import.meta.url))).digest('hex'));const source=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');for(const pattern of [/\bfetch\s*\(/,/localStorage/,/indexedDB/,/XMLHttpRequest/,/navigator\.sendBeacon/,/\.\.\/.*model\.js/])assert.doesNotMatch(source,pattern);const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.doesNotMatch(html,/<script[^>]+src=["']https?:/);});
test('Full proposal domains, original A and unimplemented adaptation boundaries are visible in HTML',()=>{const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');for(const term of ['A · 原proposal','B1','B2','B3','食物安全','资源利用效率','盈利能力','社会接受','环境影响','PhD1','尚未计算策略收益','198','代表性权重'])assert.ok(html.includes(term),term);});
test('All feasible plans may lose money: negative gross margin is not a physical infeasibility',()=>{const i=defaultInput();i.strata.forEach(s=>s.menus.forEach(m=>m.grossMarginCny=-100));const r=run(i);assert.equal(r.search.feasible,5);assert.ok(r.results.every(x=>x.totals.grossMarginCny===-200));assert.equal(r.frontier.length,1);assert.equal(r.frontier[0].id,'0-0-1|0-0-1');assert.equal(r.frontier[0].totals.grossMarginCny,-200);});
test('Zero gross margin is a valid exact hand-calculated outcome',()=>{const i=defaultInput();i.strata.forEach(s=>s.menus.forEach(m=>m.grossMarginCny=0));const r=run(i);assert.equal(r.search.feasible,5);assert.equal(r.frontier[0].totals.grossMarginCny,0);assert.equal(r.frontier.length,1);});
test('All-negative frontier is sorted by larger signed margin and retains resource tradeoffs',()=>{
 const i=defaultInput();i.strata.forEach(s=>s.menus.forEach(m=>m.grossMarginCny-=3000));const r=run(i);
 assert.equal(r.search.feasible,5);assert.equal(r.frontier.length,5);
 assert.deepEqual(r.frontier.map(x=>x.totals.grossMarginCny),[-2100,-2200,-2500,-2700,-3100]);
 assert.deepEqual(r.frontier.map(x=>x.id),['0-1-0|0-1-0','0-0-1|1-0-0','0-1-0|0-0-1','0-0-1|0-1-0','0-0-1|0-0-1']);
 assert.equal(dominates({grossMarginCny:-100,externalN:5,waterTotal:5},{grossMarginCny:-200,externalN:5,waterTotal:5}),true);
});
test('Signed amounts reject missing, nonfinite and out-of-bound values; negative physical quantities still reject',()=>{
 for(const value of [null,undefined,'-1',NaN,Infinity,-Infinity,1e12+1,-1e12-1]){const i=defaultInput();i.strata[0].menus[0].grossMarginCny=value;assert.throws(()=>run(i),/有符号有限金额/);}
 for(const value of [-1e12,1e12,-100,0]){const i=defaultInput();i.strata[0].menus[0].grossMarginCny=value;assert.doesNotThrow(()=>run(i));}
 for(const key of ['externalN','externalP','harvestN','harvestP','areaHa']){const i=defaultInput();i.strata[0].menus[0][key]=-1;assert.throws(()=>run(i),/非负/);}
});
test('Public run limits cannot be disabled with NaN, Infinity, strings, fractions or larger limits',()=>{for(const value of [NaN,Infinity,-Infinity,0,-1,1.5,'2000',2001,Number.MAX_SAFE_INTEGER,null])assert.throws(()=>run(defaultInput(),{maxCombinations:value}),/maxCombinations/);assert.equal(run(defaultInput(),{maxCombinations:9}).search.total,9);assert.equal(run(defaultInput(),{maxCombinations:2000}).search.total,9);assert.throws(()=>run(defaultInput(),{maxCombinations:8}),/上限/);assert.throws(()=>run(defaultInput(),{annual:'false'}),/布尔/);assert.throws(()=>run(defaultInput(),null),/options/);});
test('Public compositions validate bounded integer inputs before recursion; zero total is well-defined',()=>{for(const value of [NaN,Infinity,-Infinity,-1,1.5,'2',9,null,undefined])assert.throws(()=>compositions(value,3),/total/);for(const value of [NaN,Infinity,-Infinity,-1,0,1.5,'3',9,null,undefined])assert.throws(()=>compositions(2,value),/parts/);assert.deepEqual(compositions(0,3),[[0,0,0]]);assert.deepEqual(compositions(8,1),[[8]]);assert.throws(()=>compositions(8,8),/安全上限/);});
test('Sparse periods and every capacity/demand vector fail closed rather than deleting constraints',()=>{
 const cases=[x=>x.periods,x=>x.strata[0].laborCapacity,x=>x.strata[0].waterAccess,x=>x.waterSources[0].capacity,x=>x.strata[0].menus[0].laborHours,x=>x.strata[0].menus[0].waterM3];
 for(const choose of cases)for(const index of [0,1]){const i=defaultInput();delete choose(i)[index];assert.throws(()=>validateInput(i),/缺少明确值/);assert.throws(()=>run(i),/缺少明确值/);assert.throws(()=>run(i,{annual:true}),/缺少明确值/);}
 const i=defaultInput();delete i.strata[0].menus[0].laborHours[0];assert.throws(()=>evaluateMenu(i.strata[0],i.strata[0].menus[0],i.periods),/缺少明确值/);
});
test('Sparse container arrays and inherited array values cannot enter the input contract',()=>{
 for(const choose of [x=>x.strata,x=>x.waterSources,x=>x.strata[0].menus]){const i=defaultInput();delete choose(i)[0];assert.throws(()=>run(i),/缺少明确值/);}
 const i=defaultInput();const arr=i.strata[0].laborCapacity;delete arr[0];Object.setPrototypeOf(arr,Object.assign(Object.create(Array.prototype),{0:100}));assert.throws(()=>run(i),/缺少明确值/);
});
test('NP zero demand with subnormal N never yields NaN and preserves both elements',()=>{
 const r=splitManureByNP({nitrogen:Number.MIN_VALUE,phosphorus:20,availableNFraction:.1,availableNCapacity:0,totalPCapacity:10});assert.equal(r.fraction,0);assert.deepEqual(r.applied,{nitrogen:0,phosphorus:0});assert.deepEqual(r.remaining,{nitrogen:Number.MIN_VALUE,phosphorus:20});assert.equal(r.availableN,0);
});
test('NP finite extreme inputs preserve finite nonnegative outputs or explicitly reject invalid values',()=>{
 for(const nitrogen of [0,Number.MIN_VALUE,1e-300,40,1e308])for(const availableNFraction of [Number.MIN_VALUE,.1,1])for(const availableNCapacity of [0,Number.MIN_VALUE,40,1e308]){
  const r=splitManureByNP({nitrogen,phosphorus:20,availableNFraction,availableNCapacity,totalPCapacity:10});for(const value of [r.fraction,r.applied.nitrogen,r.applied.phosphorus,r.remaining.nitrogen,r.remaining.phosphorus,r.availableN])assert.ok(Number.isFinite(value)&&value>=0);assert.ok(r.fraction<=1);assert.ok(r.applied.phosphorus<=10);assert.ok(r.availableN<=availableNCapacity+Math.max(Number.MIN_VALUE,availableNCapacity*1e-14));
 }
});
test('Objective array must own every slot so accepted input survives record structuredClone and re-import',()=>{
 const inherited=defaultInput(),value=inherited.objectives[0];delete inherited.objectives[0];const proto=Object.create(Array.prototype);proto[0]=value;Object.setPrototypeOf(inherited.objectives,proto);
 assert.throws(()=>validateInput(inherited),/objectives\[0\].*缺少明确值/);assert.throws(()=>run(inherited),/缺少明确值/);
 const sparse=defaultInput();delete sparse.objectives[1];assert.throws(()=>run(sparse),/objectives\[1\].*缺少明确值/);
 const accepted=defaultInput(),r=run(accepted),record=makeRecord(accepted,r);assert.deepEqual(inputFromRecord(record),accepted);assert.deepEqual(run(inputFromRecord(record)),r);
});
