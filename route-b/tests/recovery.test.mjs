/** Pure module tests; no browser, server, external request or saved-result trust. */
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {defaultInput} from '../src/fixture.js';import {run,makeRecord} from '../src/engine.js';
import {makeInputSnapshot,restoreInputSnapshot,canonicalJSON,sha256,runConfig,resultSummary,IMPORT_LIMIT_BYTES} from '../src/recovery.js';
import {translateText} from '../src/i18n.js';
const clone=x=>structuredClone(x);
async function snapshot(input=defaultInput(),config={}){return makeInputSnapshot(input,run(input,config),config)}
async function rehash(s){const {integrity,...payload}=s;s.integrity.digest=await sha256(canonicalJSON(payload));return s}
test('Snapshot serializes complete input/config and restores exact independent period and annual results',async()=>{
 for(const config of [{annual:false,maxCombinations:2000},{annual:true,maxCombinations:2000}]){
  const input=defaultInput();input.extraMetadata={source:'原文：A，B；C。',assumption:['scenario',false,null],nested:{a:1,z:2}};
  const expected=run(input,config),s=JSON.parse(JSON.stringify(await snapshot(input,config))),restored=await restoreInputSnapshot(s);
  assert.deepEqual(restored.input,input);assert.deepEqual(restored.config,runConfig(config));assert.deepEqual(restored.result,expected);assert.deepEqual(s.summary,resultSummary(expected));assert.ok(!('result' in s)&&!('results' in s));assert.ok(JSON.stringify(s).length<IMPORT_LIMIT_BYTES);
 }
});
test('Digest matches independent Node SHA-256 over documented sorted JSON, including Unicode/negative/zero',async()=>{
 const s=await snapshot(),{integrity,...payload}=s;
 assert.equal(integrity.digest,createHash('sha256').update(canonicalJSON(payload),'utf8').digest('hex'));
 assert.equal(canonicalJSON({b:[0,-0,-2,'汉\uE000B:0\uE001'],a:{z:1,a:2}}),'{"a":{"a":2,"z":1},"b":[0,0,-2,"汉\uE000B:0\uE001"]}');
 assert.equal(await sha256('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('Snapshot preparation never reads or serializes large full-result trees',async()=>{
 const input=defaultInput(),result=run(input);for(const key of ['results','frontier','menuChecks','issueCounts'])Object.defineProperty(result,key,{get(){throw new Error(`unexpected full result traversal: ${key}`)}});
 const s=await makeInputSnapshot(input,result);assert.equal(s.summary.feasible,5);assert.ok(JSON.stringify(s).length<10000);
});
test('Reordered envelope/input object keys retain digest consistency without losing objective field order',async()=>{
 const s=await snapshot();const reverse=o=>Object.fromEntries(Object.entries(o).reverse());const reordered=reverse(s);reordered.input=reverse(s.input);
 const got=await restoreInputSnapshot(reordered);assert.deepEqual(got.result,run(defaultInput()));assert.deepEqual(got.input,defaultInput());
});
test('Tampered digest, input and summary reject without changing caller record',async()=>{
 const base=await snapshot();for(const mutate of [s=>s.integrity.digest='0'.repeat(64),s=>s.input.strata[0].count=2,s=>s.summary.feasible=999]){const s=clone(base);mutate(s);const before=clone(s);await assert.rejects(restoreInputSnapshot(s),/校验不一致/);assert.deepEqual(s,before)}
});
test('Even a rehashed forged summary is independently rejected; digest is not a trusted signature',async()=>{
 const s=await snapshot();s.summary.feasible=999;await rehash(s);await assert.rejects(restoreInputSnapshot(s),/摘要与独立重算不一致/);
});
test('Unknown snapshot/engine/input-contract versions and absent input reject',async()=>{
 const base=await snapshot();for(const mutate of [s=>s.schema+='x',s=>s.schemaVersion=2,s=>s.engineVersion+='x',s=>s.inputContract.schemaVersion=2,s=>delete s.inputContract,s=>delete s.input]){const s=clone(base);mutate(s);await assert.rejects(restoreInputSnapshot(s))}
});
test('Missing or rewritten source and synthetic/assumption markers reject even with a new digest',async()=>{
 const base=await snapshot();for(const mutate of [s=>delete s.input.strata[0].menus[0].source,s=>delete s.input.strata[0].origin,s=>delete s.input.waterSources[0].origin,s=>s.input.evidence='empirical',s=>s.input.strata[0].menus[0].commitment='committed',s=>delete s.input.strata[0].menus[0].phd1CandidateId,s=>delete s.input.representativeness.status,s=>delete s.input.social.status]){const s=clone(base);mutate(s);await rehash(s);await assert.rejects(restoreInputSnapshot(s),/B输入合同/)}
});
test('Invalid/mismatched/extra/unsafe run configuration rejects',async()=>{
 const base=await snapshot();for(const mutate of [s=>s.runConfig.annual='false',s=>s.runConfig.maxCombinations=2001,s=>s.runConfig.maxCombinations=9,s=>s.runConfig.maxCombinations=0,s=>s.runConfig.mode='annual-diagnostic',s=>delete s.runConfig.annual,s=>s.runConfig.extra=1]){const s=clone(base);mutate(s);await rehash(s);await assert.rejects(restoreInputSnapshot(s),/运行配置无效/)}
});
test('Recovery schema explicitly rejects saved results, extra envelope fields, and bad integrity metadata',async()=>{
 const base=await snapshot();for(const mutate of [s=>s.result={search:{feasible:999}},s=>s.results=[],s=>s.build={},s=>s.integrity.algorithm='MD5',s=>s.integrity.canonicalization='RFC8785',s=>s.integrity.extra=true,s=>s.integrity.digest='A'.repeat(64)]){const s=clone(base);mutate(s);await assert.rejects(restoreInputSnapshot(s))}
});
test('Finite dense JSON-only guard avoids silent dropping of undefined, holes, NaN and function metadata',()=>{
 for(const value of [undefined,NaN,Infinity,()=>{},new Date(),[1,,3],{a:undefined}])assert.throws(()=>canonicalJSON(value),/有限JSON/);
 assert.equal(canonicalJSON(JSON.parse('{"__proto__":{"secret":1},"constructor":"data"}')),'{"__proto__":{"secret":1},"constructor":"data"}');assert.equal({}.secret,undefined);
});
test('Canceled verification does not rerun or return a result after digest resolution',async()=>{
 const s=await snapshot();assert.equal(await restoreInputSnapshot(s,{isCurrent:()=>false}),null);
});
test('Snapshot input is captured before async digest; live caller edits cannot change emitted payload',async()=>{
 const x=defaultInput(),before=clone(x),pending=makeInputSnapshot(x,run(x));x.waterSources[0].capacity[0]=777;const s=await pending;assert.deepEqual(s.input,before);assert.deepEqual((await restoreInputSnapshot(s)).input,before);
});
test('Even oversized metadata never produces an unimportable recovery download payload',async()=>{
 const x=defaultInput();x.extra='x'.repeat(IMPORT_LIMIT_BYTES);await assert.rejects(snapshot(x),/超过5 MiB/);
});
test('All new snapshot errors and notices translate in zh/en/both without changing model data',async()=>{
 const fs=await import('node:fs');for(const file of ['src/recovery.js']){const source=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');for(const m of source.matchAll(/(?:fail|Error)\('([^']*[\u3400-\u9fff][^']*)'\)/gu)){assert.equal(translateText(m[1],'zh'),m[1]);assert.doesNotMatch(translateText(m[1],'en'),/[\u3400-\u9fff]/u);assert.match(translateText(m[1],'both'),/ \/ /)}}
 const input=defaultInput(),before=clone(input);const s=await snapshot(input);for(const mode of ['en','both','zh'])translateText('正在准备可恢复输入快照',mode);assert.deepEqual(input,before);assert.deepEqual((await restoreInputSnapshot(s)).input,before);
});
