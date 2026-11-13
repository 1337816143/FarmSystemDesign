import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {applyDatedResources} from '../src/dated-events.mjs';
const source=resolve(process.env.B_SOURCE_ROOT||fileURLToPath(new URL('..',import.meta.url)));
const {defaultInput}=await import(pathToFileURL(resolve(source,'src/fixture.js')));
const {compareTemporal}=await import(pathToFileURL(resolve(source,'src/engine.js')));
const sourceHashes=()=>Object.fromEntries(['src/engine.js','src/fixture.js'].map(f=>[f,createHash('sha256').update(readFileSync(resolve(source,f))).digest('hex')]));
const beforeHashes=sourceHashes();
const input=defaultInput(), untouched=structuredClone(input), audits=[],datedInputs=[];
const periods=input.periods.map((id,i)=>({id,start:i===0?'2026-01-01':'2026-07-01',end:i===0?'2026-07-01':'2027-01-01'}));
for(const s of input.strata)for(let j=0;j<s.menus.length;j++){
 const m=s.menus[j],base={menuId:m.id,operatorId:`synthetic-${s.id}`,unitId:`synthetic-unit-${s.id}`,evidence:'synthetic',source:'Synthetic event expansion of existing B fixture, not recovered observations',parameterVersion:'synthetic-two-strata-v1'};
 const events=['laborHours','waterM3'].flatMap(metric=>m[metric].map((value,t)=>({...base,id:`${m.id}-${metric}-${t}`,metric,unit:metric==='laborHours'?'h':'m3',value,allocation:'event-date',date:periods[t].start,allocationReason:'Synthetic software test assigns fixture amount to one explicit date'})));
 const dated={schema:'HainanDatedResourceEvents',schemaVersion:1,coverage:'complete-within-declared-horizon',datasetVersion:'dated-synthetic-replay-v1',evidence:'synthetic',inferenceScope:'hypothetical-systems',calendar:'local-date-no-timezone-conversion',...base,periods,events};
 const r=applyDatedResources(m,input.periods,dated);s.menus[j]=r.menu;audits.push(r.resourceAudit);datedInputs.push(dated);
}
assert.deepEqual(input,untouched);
const result=compareTemporal(input);
assert.equal(result.annual.search.total,9);assert.equal(result.annual.search.feasible,8);assert.equal(result.period.search.feasible,5);assert.equal(result.annualFalseFeasible.length,3);
// Move alpha's same 140 h total into period 1. No new water, money or menu is introduced.
const altered=structuredClone(input);const peak=structuredClone(datedInputs.find(d=>d.menuId==='a-balanced'));peak.events.find(e=>e.id==='a-balanced-laborHours-0').value=140;peak.events.find(e=>e.id==='a-balanced-laborHours-1').value=0;altered.strata[0].menus[1]=applyDatedResources(altered.strata[0].menus[1],altered.periods,peak).menu;const after=compareTemporal(altered);
assert.deepEqual(after.annual.search,result.annual.search);assert.equal(after.period.search.feasible,3);
for(const r of result.annual.results){const paired=after.annual.results.find(x=>x.id===r.id);assert.deepEqual(paired.totals,r.totals);assert.equal(paired.feasible,r.feasible);}
assert.deepEqual(sourceHashes(),beforeHashes);
const report={datedInputs,peakInput:peak,evidence:'synthetic',modelScope:'dated resource events into unchanged existing menu engine',sourceFiles:beforeHashes,baseline:{annual:result.annual.search,period:result.period.search,falseFeasible:result.annualFalseFeasible},sameTotalPeakTiming:{annual:after.annual.search,period:after.period.search},checks:{menuRoundTrip:true,totalCombinations:9,annualFeasible:8,periodFeasible:5,annualMisses:3,peakTimingChangesFeasibility:true,sourceModified:false},scientificValidation:'not calibrated; no empirical validation; dates are invented test data',audits};
const reportPath=process.env.ROUTE_B_INTEGRATION_OUTPUT||new URL('../evidence/integration-result.json',import.meta.url);
writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({baseline:report.baseline,sameTotalPeakTiming:report.sameTotalPeakTiming,checks:report.checks},null,2));
