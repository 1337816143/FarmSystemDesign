import {captureWorkingContext,restoreWorkingContext} from '../src/working-context.js';
import {restorePlanMetadata} from '../src/study-records.js';
// Reconstructed integration checks; historical fixture timestamps were newly generated during recovery.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {fixture} from './fixtures/manure-np.mjs';
import {evaluate,search} from '../src/model.js';
import {defaultConfig,baselineAllocation,validateDataset} from '../src/data.js';
import {NP_INPUT_LIMIT,importManurePhosphorus,restoreManurePhosphorusDraft,manurePhosphorusTemplate} from '../src/manure-np-input.js';
import {manurePhosphorusPanel,manurePhosphorusResult} from '../src/manure-np-ui.js';
import {ENGINE_IDENTITY} from '../src/engine-identity.generated.js';
import {captureRunContext,buildFrozenRun,createSelectedFrozenRun,verifyFrozenRun,ENGINE_MODULE_PATHS} from '../src/frozen-run.js';
import {buildEngineIdentity} from '../tools/generate-engine-identity.mjs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'),clone=x=>structuredClone(x),cryptoOptions={cryptoProvider:webcrypto};
const app=read('src/app.js');
function prepared(){const f=fixture(),config={...f.config};delete config.manurePhosphorus;const rows=evaluate(f.data,f.ids,f.allocation,config,null).farms;
 const rawJSON=JSON.stringify({...f.config.manurePhosphorus,researchMetadata:{originalCitation:'Local synthetic mechanism check',reviewed:false}},null,2)+'\n';
 const contract=importManurePhosphorus(rawJSON,{filename:'synthetic-source.json',rows,quarter:0,confirmed:true});
 return {...f,rows,rawJSON,contract,config:{...f.config,manurePhosphorus:contract}};
}
const p=prepared(),inputs={dataset:p.data,farmIds:p.ids,config:p.config,climate:null},context=captureRunContext(inputs),result=search(p.data,p.ids,p.config,null);
const localRelease={status:'verified',metadata:JSON.parse(read('version.json')),reason:null};
const frozenRun=await buildFrozenRun(result,context,localRelease,cryptoOptions),full={...result,runInputs:context.runInputs,frozenRun};
const newPlan={id:'new-np-plan',name:'N/P source fixture',createdAt:result.createdAt,status:'draft',dataset:clone(inputs.dataset),farmIds:clone(inputs.farmIds),config:clone(inputs.config),climate:null,candidate:clone(result.candidates[0]),baseline:clone(result.baseline),ranking:clone(result.ranking),applicationVersion:ENGINE_IDENTITY.applicationVersion,modelVersion:result.modelVersion,dataVersion:result.dataVersion,inputHash:result.inputHash,buildCommit:'local-preview'};
newPlan.frozenRun=await createSelectedFrozenRun(full,newPlan,cryptoOptions);

test('reviewed core remains exact and revised engine identity matches its source',async()=>{
 assert.equal(createHash('sha256').update(read('src/manure-np.js')).digest('hex'),'69d8ac11e60c8497e96b517a8b85bdd814c6c0dc0bfc93745076e45153ee03d5');
 assert.notEqual(ENGINE_IDENTITY.digest,'d0974161afa7d5698e7f0ab07eec24658df96ec7c103171f17bf052b73d2a3af');
 assert.equal(ENGINE_IDENTITY.applicationVersion,'0.3.26');assert.equal(ENGINE_IDENTITY.modelVersion,'screening-0.2.3');
 assert.ok(ENGINE_MODULE_PATHS.includes('src/manure-np.js'));assert.ok(ENGINE_MODULE_PATHS.includes('src/manure-np-input.js'));assert.deepEqual(ENGINE_IDENTITY,await buildEngineIdentity());
});
test('raw JSON whitespace, extra metadata and recovered-N binding survive exact serialization',()=>{
 assert.equal(p.contract.inputArchive.rawJSON,p.rawJSON);assert.deepEqual(JSON.parse(p.rawJSON).researchMetadata,p.contract.researchMetadata);
 assert.deepEqual(p.contract.inputArchive.selectedRecoveredN,p.rows.map(r=>({farmId:r.id,recoveredN:r.manureRecovered})));
 assert.equal(JSON.parse(p.rawJSON).inputArchive,undefined);const restored=restoreManurePhosphorusDraft(JSON.parse(JSON.stringify(p.contract)));assert.deepEqual(restored,p.contract);assert.notStrictEqual(restored,p.contract);
});
test('templates keep unknown values null and default config contains no active P',()=>{
 const c=manurePhosphorusTemplate(p.ids,0);assert.ok(c.bindings.every(b=>b.recoveredManureP===null&&b.remainingApplicationCapacityP===null));assert.throws(()=>importManurePhosphorus(JSON.stringify(c),{rows:p.rows,quarter:0,confirmed:true}),/nonnegative/);assert.equal(Object.hasOwn(defaultConfig(),'manurePhosphorus'),false);
});
test('missing confirmations, nulls, strings, overflow, mismatched units/quarter and sources are rejected',()=>{
 const options={rows:p.rows,quarter:0,confirmed:true};assert.throws(()=>importManurePhosphorus(p.rawJSON,{...options,confirmed:false}),/confirm/);
 for(const value of [null,'','0',-1]){const c=JSON.parse(p.rawJSON);c.bindings[0].recoveredManureP=value;assert.throws(()=>importManurePhosphorus(JSON.stringify(c),options));}
 for(const edit of [c=>c.unit='kg P2O5',c=>c.period='2025-Q2',c=>c.bindings[0].source=' ',c=>c.bindings.pop(),c=>c.bindings.push(clone(c.bindings[0]))]){const c=JSON.parse(p.rawJSON);edit(c);assert.throws(()=>importManurePhosphorus(JSON.stringify(c),options));}
 assert.throws(()=>importManurePhosphorus(p.rawJSON.replace('28.6','1e400'),options));assert.throws(()=>importManurePhosphorus(' '.repeat(NP_INPUT_LIMIT+1),options),/512 KiB/);
});
test('source declarations remain declarations, with no promotion to verified observations',()=>{
 for(const provenance of ['observed','literature-transfer','user-unverified','synthetic']){const c=JSON.parse(p.rawJSON);c.bindings[0].provenance=provenance;
  const draft=importManurePhosphorus(JSON.stringify(c),{rows:p.rows,quarter:0,confirmed:true}),out=evaluate(p.data,p.ids,p.allocation,{...p.config,manurePhosphorus:draft},null);
  assert.equal(out.manurePhosphorus.provenance[0].provenance,provenance);assert.equal(out.manurePhosphorus.provenance[0].source,c.bindings[0].source);}
});
test('quarter, scope and paired inventory changes reject stale bindings',()=>{
 assert.throws(()=>evaluate(p.data,p.ids,p.allocation,{...p.config,quarter:1},null),/quarter changed/);assert.throws(()=>evaluate(p.data,['donor'],{D:'cover'},p.config,null),/boundary changed/);
 const data=clone(p.data);data.farms[0].poultry++;assert.throws(()=>evaluate(data,p.ids,p.allocation,p.config,null),/inventory changed/);
 const reverse=clone(p.data);reverse.farms.reverse();assert.doesNotThrow(()=>evaluate(reverse,[...p.ids].reverse(),p.allocation,p.config,null));
});
test('tampered source archives and explicit null active contracts fail closed',()=>{
 for(const edit of [c=>c.bindings[0].source='changed',c=>c.inputArchive.rawJSON='{}',c=>c.inputArchive.capacityBasis='unadjusted',c=>c.inputArchive.selectedRecoveredN[0].recoveredN=null]){const c=clone(p.contract);edit(c);assert.throws(()=>restoreManurePhosphorusDraft(c));}
 assert.throws(()=>evaluate(p.data,p.ids,p.allocation,{...p.config,manurePhosphorus:null},null));
});
test('actual app toggle restores legacy numerical output while retaining disabled draft',()=>{
 const state={dataset:p.data,climate:null,config:{...p.config},npDraft:clone(p.contract),npError:''},text=app.slice(app.indexOf('function setNpMode('),app.indexOf('async function importNpFile('));
 const fn=new Function('state','evaluate','ids','plots','baselineAllocation','render',text+';return setNpMode;')(state,evaluate,()=>p.ids,()=>p.data.plots,baselineAllocation,()=>{});
 fn('off');assert.equal(Object.hasOwn(state.config,'manurePhosphorus'),false);assert.deepEqual(state.npDraft,p.contract);const old={...p.config};delete old.manurePhosphorus;assert.deepEqual(evaluate(p.data,p.ids,p.allocation,state.config,null),evaluate(p.data,p.ids,p.allocation,old,null));
 fn('on');assert.deepEqual(state.config.manurePhosphorus,p.contract);state.config.quarter=1;fn('on');assert.match(state.npError,/quarter changed/);assert.throws(()=>evaluate(p.data,p.ids,p.allocation,state.config,null));fn('off');assert.doesNotThrow(()=>evaluate(p.data,p.ids,p.allocation,state.config,null));
});
test('new full and selected snapshots retain raw source, P output and honest local-preview status',async()=>{
 for(const record of [full,newPlan]){const raw=JSON.stringify(record),copy=JSON.parse(raw);assert.equal((await verifyFrozenRun(copy,cryptoOptions)).status,'verified');assert.equal(copy.frozenRun.captureStatus,'incomplete-record');assert.ok(copy.frozenRun.captureIssues.some(x=>x.includes('local-preview')));
  assert.equal(copy.config.manurePhosphorus.inputArchive.rawJSON,p.rawJSON);assert.deepEqual(copy.frozenRun.parameters,context.parameters);const leaf=copy.candidate||copy.baseline;assert.equal(leaf.manurePhosphorus.unit,'kg elemental P');assert.deepEqual(leaf.manurePhosphorus.provenance,p.contract.bindings.map(({farmId,provenance,source})=>({farmId,provenance,source})));assert.equal(JSON.stringify(copy),raw);}
 const c=clone(full);c.runInputs.config.manurePhosphorus.inputArchive.rawJSON+=' ';assert.equal((await verifyFrozenRun(c,cryptoOptions)).status,'mismatch');const out=clone(full);out.baseline.manurePhosphorus.appliedP++;assert.equal((await verifyFrozenRun(out,cryptoOptions)).status,'mismatch');
});
test('public 0.3.14 and freshly generated old-engine 0.3.19 fixtures keep historical module lists and no P backfill',async()=>{
 for(const name of ['frozen-run-0.3.14.json','frozen-run-0.3.19-local.json','selected-plan-0.3.19-local.json']){const old=JSON.parse(read('tests/fixtures/'+name)),before=JSON.stringify(old),v=await verifyFrozenRun(old,cryptoOptions);assert.equal(v.status,'verified',JSON.stringify(v));assert.equal(JSON.stringify(old),before);assert.equal(old.config.manurePhosphorus,undefined);assert.ok(old.frozenRun.engineIdentity.modules.every(m=>!m.path.includes('manure-np')));assert.equal(old.frozenRun.engineIdentity.modules.length,name.includes('0.3.14')?7:8);}
});
async function projectRoundtrip(bundle,startingState={}){
 const state={config:defaultConfig(),plans:[],observations:[],audit:[],...startingState},messages=[];
 const source=app.slice(app.indexOf('async function importFile('),app.indexOf('async function refreshWeather('));
 const importer=new Function('state','validateDataset','restoreManurePhosphorusDraft','validateClimate','toast','openModal','now','audit','render','icon','npText','language','restoreWorkingContext','restorePlanMetadata',source+';return importFile;')
 (state,validateDataset,restoreManurePhosphorusDraft,c=>c===null||!!c?.records,m=>messages.push(m),(_t,_b,submit)=>submit(),()=>new Date().toISOString(),()=>{},()=>{},()=>'',(_l,_zh,en)=>en,'en',restoreWorkingContext,restorePlanMetadata);
 const raw=JSON.stringify(bundle);await importer({size:Buffer.byteLength(raw),name:'roundtrip.json',text:async()=>raw});assert.ok(!messages.some(m=>m.includes('导入失败')),messages.join('\n'));
 const exportSource=app.slice(app.indexOf('function projectBundle('),app.indexOf('function validateClimate('));const exporter=new Function('state','now','VERSION','MODEL_VERSION','REGIONAL_EVIDENCE_VERSION','captureWorkingContext',exportSource+';return projectBundle;')(state,()=>new Date().toISOString(),'0.3.22','screening-0.2.3','test',captureWorkingContext);return {state,exported:JSON.parse(JSON.stringify(exporter()))};
}
test('actual project import/export retains an old-engine snapshot byte-for-byte',async()=>{
 const old=JSON.parse(read('tests/fixtures/selected-plan-0.3.19-local.json')),bundle={application:'FarmSystemDesign',schemaVersion:1,dataset:old.dataset,climate:null,plans:[old],observations:[],audit:[]};const {state,exported}=await projectRoundtrip(bundle);assert.deepEqual(exported.plans,bundle.plans);assert.equal(state.config.manurePhosphorus,undefined);assert.equal(state.npDraft,null);assert.equal((await verifyFrozenRun(exported.plans[0],cryptoOptions)).status,'verified');
});
test('actual new project import preserves source and snapshots while leaving NP disabled',async()=>{
 const bundle={application:'FarmSystemDesign',schemaVersion:1,dataset:p.data,climate:null,plans:[newPlan],observations:[],audit:[],manurePhosphorusDraft:p.contract};const {state,exported}=await projectRoundtrip(bundle);assert.deepEqual(exported.plans,bundle.plans);assert.deepEqual(exported.manurePhosphorusDraft,p.contract);assert.equal(Object.hasOwn(state.config,'manurePhosphorus'),false);assert.equal(exported.manurePhosphorusDraft.inputArchive.rawJSON,p.rawJSON);assert.equal((await verifyFrozenRun(exported.plans[0],cryptoOptions)).status,'verified');
});
test('three language modes carry all objectives, units, boundaries and source-status caveats',()=>{
 for(const language of ['zh','en','both']){const panel=manurePhosphorusPanel({draft:p.contract,active:true,quarter:0,language}),ledger=manurePhosphorusResult(result.baseline,language);assert.match(panel,/kg elemental P/);assert.match(panel,/2025-Q1/);assert.match(panel,/PhD1/);assert.match(panel,/Scores/);if(language==='en'){assert.doesNotMatch(panel+ledger,/[\u3400-\u9fff]/);assert.match(panel,/None of these three objectives is completed/);}if(language==='both'){assert.match(panel,/空间异质/);assert.match(panel,/spatial heterogeneity/);}}
 const c=clone(p.contract);c.bindings[0].source='<script>alert(1)</script>';assert.doesNotMatch(manurePhosphorusPanel({draft:c}),/<script>/);c.bindings[0].provenance='observed';assert.match(manurePhosphorusPanel({draft:c,language:'en'}),/not independently verified/);
});
test('NP runtime and method document are included in service-worker shell and build source set',()=>{
 const sw=read('sw.js');for(const path of ['src/manure-np.js','src/manure-np-input.js','src/manure-np-ui.js','docs/ROUTE_A_NP_CONTRACT.md']){assert.ok(sw.includes(`'./${path}'`));assert.ok(read(path).length);}assert.match(read('tools/build.mjs'),/'src','data','docs'/);assert.equal(manurePhosphorusResult({totals:{}}),'');
});
test('actual worker archives successful NP output and rejects stale-quarter input',async()=>{
 const previous={self:globalThis.self,postMessage:globalThis.postMessage,fetch:globalThis.fetch},posts=[];
 try{globalThis.self={};globalThis.postMessage=m=>posts.push(m);globalThis.fetch=async()=>({ok:true,json:async()=>clone(localRelease.metadata)});await import('../src/optimizer.worker.js?route-a-np-recovery');await globalThis.self.onmessage({data:clone(inputs)});const response=posts.find(m=>m.type==='result');assert.ok(response,JSON.stringify(posts));assert.equal(response.result.runInputs.config.manurePhosphorus.inputArchive.rawJSON,p.rawJSON);assert.equal((await verifyFrozenRun(response.result,cryptoOptions)).status,'verified');assert.equal(response.result.frozenRun.engineIdentity.digest,ENGINE_IDENTITY.digest);posts.length=0;const stale=clone(inputs);stale.config.quarter=1;await globalThis.self.onmessage({data:stale});assert.ok(posts.some(m=>m.type==='error'&&m.error.includes('quarter changed')));assert.ok(posts.every(m=>m.type!=='result'));}
 finally{for(const [k,v] of Object.entries(previous)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
test('ordinary resource imports keep active NP and old snapshots, forcing stale inventory rejection',async()=>{
 const data=clone(p.data);data.farms[0].poultry++;const {state,exported}=await projectRoundtrip(data,{config:clone(p.config),npDraft:clone(p.contract),plans:[clone(newPlan)]});assert.deepEqual(state.config.manurePhosphorus,p.contract);assert.deepEqual(state.npDraft,p.contract);assert.deepEqual(exported.plans,[newPlan]);assert.throws(()=>evaluate(state.dataset,p.ids,p.allocation,state.config,null),/inventory changed/);
});
