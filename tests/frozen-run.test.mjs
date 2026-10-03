import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {makeDemo,defaultConfig,CROPS,ANNUALS} from '../src/data.js';
import {search,rankResults} from '../src/model.js';
import {ENGINE_IDENTITY} from '../src/engine-identity.generated.js';
import {METRIC_CONTRACTS,EVIDENCE_REFS} from '../src/metric-contracts.js';
import {canonicalJSON,captureRunContext,buildFrozenRun,createSelectedFrozenRun,verifyFrozenRun,ENGINE_MODULE_PATHS} from '../src/frozen-run.js';
import {buildEngineIdentity,ENGINE_MODULE_PATHS as GENERATOR_PATHS} from '../tools/generate-engine-identity.mjs';

const cryptoOptions={cryptoProvider:webcrypto};
const climate=JSON.parse(fs.readFileSync(new URL('../data/public/climate.json',import.meta.url)));
const inputs={dataset:makeDemo(),farmIds:['F01'],config:defaultConfig(),climate};
const result=search(inputs.dataset,inputs.farmIds,inputs.config,inputs.climate);
const context=captureRunContext(inputs);
const published={status:'verified',metadata:{version:ENGINE_IDENTITY.applicationVersion,modelVersion:ENGINE_IDENTITY.modelVersion,
  dataVersion:ENGINE_IDENTITY.dataVersion,engineDigest:ENGINE_IDENTITY.digest,commit:'a'.repeat(40),
  name:'test build',releasedOn:'2026-10-03',changes:[]},reason:null};
const complete=await buildFrozenRun(result,context,published,cryptoOptions);
const full={...result,runInputs:context.runInputs,frozenRun:complete};
const clone=value=>structuredClone(value);
const planFrom=(candidate=result.candidates[0])=>({dataset:clone(inputs.dataset),farmIds:clone(inputs.farmIds),config:clone(inputs.config),
  climate:clone(inputs.climate),candidate:clone(candidate),baseline:clone(result.baseline),ranking:clone(result.ranking),
  applicationVersion:ENGINE_IDENTITY.applicationVersion,modelVersion:result.modelVersion,dataVersion:result.dataVersion,
  inputHash:result.inputHash,buildCommit:published.metadata.commit});

test('manifest hashes the fixed calculation/provenance module bytes and excludes explanatory content',async()=>{
  assert.deepEqual(ENGINE_MODULE_PATHS,GENERATOR_PATHS);
  assert.deepEqual(ENGINE_IDENTITY,await buildEngineIdentity());
  assert.ok(!GENERATOR_PATHS.includes('src/metric-contracts.js'));
  assert.ok(!GENERATOR_PATHS.includes('src/engine-identity.generated.js'));
  const metadata=JSON.parse(fs.readFileSync(new URL('../version.json',import.meta.url)));
  assert.equal(metadata.engineDigest,ENGINE_IDENTITY.digest);
});

test('canonical JSON preserves array order and rejects silently lossy values',()=>{
  assert.equal(canonicalJSON({z:3,a:[2,1]}),' {"a":[2,1],"z":3}'.trim());
  assert.notEqual(canonicalJSON([1,2]),canonicalJSON([2,1]));
  for(const value of [undefined,NaN,Infinity,{v:undefined},[undefined],BigInt(1),new Date(),new Map(),new Set(),Array(1)])
    assert.throws(()=>canonicalJSON(value));
  const cycle={};cycle.self=cycle;assert.throws(()=>canonicalJSON(cycle));
});

test('complete capture has one parameter/explanation/source record and retains original output exactly',async()=>{
  assert.equal(complete.captureStatus,'complete-record');assert.deepEqual(complete.captureIssues,[]);
  assert.equal(complete.runId,`sha256:${complete.digests.computational}`);
  assert.deepEqual(complete.parameters,{CROPS,ANNUALS});
  assert.deepEqual(complete.contracts,METRIC_CONTRACTS);assert.deepEqual(complete.evidenceRefs,EVIDENCE_REFS);
  assert.deepEqual(context.runInputs,inputs);
  assert.equal(context.runInputs.config.objective,'balanced');assert.equal(context.runInputs.config.seed,20260929);
  assert.equal(complete.output.candidateDigests.length,result.candidates.length);
  assert.deepEqual(complete.output.candidateDigests.map(x=>x.id),result.candidates.map(c=>c.id).sort());
  assert.equal(result.candidates.some(c=>Object.hasOwn(c,'frozenRun')),false);
  assert.equal(Object.hasOwn(complete,'runInputs'),false);assert.equal(Object.hasOwn(complete,'candidates'),false);
  assert.equal(JSON.stringify(full).split('"contracts":').length-1,1);
  const {runInputs,frozenRun,...numeric}=full;assert.deepEqual(numeric,result);
  assert.equal((await verifyFrozenRun(full,cryptoOptions)).status,'verified');
});

test('snapshots detach actual inputs, coefficients, contracts and evidence before subsequent drift',async()=>{
  const source=clone(inputs),parameters={CROPS:clone(CROPS),ANNUALS:clone(ANNUALS)},contracts=clone(METRIC_CONTRACTS),evidenceRefs=clone(EVIDENCE_REFS);
  const captured=captureRunContext(source,{parameters,contracts,evidenceRefs});
  source.config.seed=999;source.dataset.farms[0].poultry+=500;source.farmIds.reverse();
  parameters.CROPS.rice.revenue+=100;parameters.ANNUALS.reverse();
  if(Array.isArray(contracts))contracts.push({changed:true});else contracts.extra={changed:true};
  if(Array.isArray(evidenceRefs))evidenceRefs.push({changed:true});else evidenceRefs.extra={changed:true};
  assert.deepEqual(captured.runInputs,context.runInputs);assert.deepEqual(captured.parameters,context.parameters);
  assert.deepEqual(captured.contracts,context.contracts);assert.deepEqual(captured.evidenceRefs,context.evidenceRefs);
  const frozen=await buildFrozenRun(result,captured,published,cryptoOptions);
  assert.deepEqual(frozen.digests,complete.digests);
});

test('a coefficient mutation changes computational digest even when legacy input/fingerprint does not',async()=>{
  const original=CROPS.rice.revenue;
  try{
    CROPS.rice.revenue+=17;
    const changedContext=captureRunContext(inputs);
    const changed=search(inputs.dataset,inputs.farmIds,inputs.config,inputs.climate);
    const frozen=await buildFrozenRun(changed,changedContext,published,cryptoOptions);
    assert.equal(changed.inputHash,result.inputHash);assert.equal(changed.baseline.fingerprint,result.baseline.fingerprint);
    assert.notEqual(changed.baseline.totals.margin,result.baseline.totals.margin);
    assert.equal(frozen.digests.inputs,complete.digests.inputs);
    assert.notEqual(frozen.digests.parameters,complete.digests.parameters);
    assert.notEqual(frozen.digests.computational,complete.digests.computational);
    assert.equal(frozen.digests.explanatory,complete.digests.explanatory);
  }finally{CROPS.rice.revenue=original;}
});

test('explanation-only edits change explanatory digest without changing computation or engine identity',async()=>{
  const changed=captureRunContext(inputs,{contracts:{original:METRIC_CONTRACTS,annotation:'new explanatory wording'},evidenceRefs:EVIDENCE_REFS});
  const frozen=await buildFrozenRun(result,changed,published,cryptoOptions);
  assert.notEqual(frozen.digests.explanatory,complete.digests.explanatory);
  for(const key of ['inputs','parameters','engineSource','output','computational'])assert.equal(frozen.digests[key],complete.digests[key]);
});

test('missing explanation makes capture incomplete without hiding the computational digest',async()=>{
  const frozen=await buildFrozenRun(result,{...context,contracts:null,evidenceRefs:null},published,cryptoOptions);
  assert.equal(frozen.captureStatus,'incomplete-record');assert.equal(frozen.digests.explanatory,null);
  assert.equal(frozen.digests.computational,complete.digests.computational);
});

test('candidate order, score, current preference and timestamp are outside computational digest',async()=>{
  const ranked=rankResults(result,'water');ranked.candidates.reverse();ranked.createdAt='changed-view-time';
  for(const c of ranked.candidates)c.score=-100;
  const frozen=await buildFrozenRun(ranked,context,published,cryptoOptions);
  assert.deepEqual(frozen.digests,complete.digests);
  assert.equal(result.config.objective,'balanced');
  assert.equal((await verifyFrozenRun({...ranked,runInputs:context.runInputs,frozenRun:complete},cryptoOptions)).status,'verified');
});

test('all accounting fields and immutable search metadata are covered',async()=>{
  const mutations=[
    r=>r.candidates[0].farms[0].manureApplied+=1,
    r=>r.candidates[0].plots[0].baseCost+=1,
    r=>r.candidates[0].balances[0].capacity+=1,
    r=>r.candidates[0].boundary.outsideReservedWater+=1,
    r=>r.candidates[0].sensitivity.lowMargin+=1,
    r=>r.candidates[0].warnings.push('changed'),
    r=>r.baseline.totals.margin+=1,
    r=>r.ranking.range.margin[0]+=1,
    r=>r.evaluated+=1,
    r=>r.feasibleCount+=1,
    r=>r.exact=!r.exact,
    r=>r.method+='changed'
  ];
  for(const mutate of mutations){
    const changed=clone(result);mutate(changed);
    const frozen=await buildFrozenRun(changed,context,published,cryptoOptions);
    assert.notEqual(frozen.digests.output,complete.digests.output);
    assert.notEqual(frozen.digests.computational,complete.digests.computational);
  }
});

test('empty-frontier best infeasible and baseline accounting remain covered',async()=>{
  const emptyInputs={...inputs,config:{...inputs.config,water:0,labour:0}},emptyContext=captureRunContext(emptyInputs);
  const empty=search(emptyInputs.dataset,emptyInputs.farmIds,emptyInputs.config,emptyInputs.climate);
  assert.equal(empty.candidates.length,0);assert.ok(empty.bestInfeasible);
  const before=await buildFrozenRun(empty,emptyContext,published,cryptoOptions);
  empty.bestInfeasible.violations.push('changed');
  const after=await buildFrozenRun(empty,emptyContext,published,cryptoOptions);
  assert.notEqual(before.output.bestInfeasibleDigest,after.output.bestInfeasibleDigest);
  assert.notEqual(before.digests.computational,after.digests.computational);
});

test('retained-record verification detects leaf, root, input, coefficient and explanation corruption',async()=>{
  for(const mutate of [
    r=>r.frozenRun.output.candidateDigests[0].digest='0'.repeat(64),
    r=>r.frozenRun.digests.computational='0'.repeat(64),
    r=>r.candidates[0].totals.water+=1,
    r=>r.runInputs.config.seed+=1,
    r=>r.frozenRun.parameters.CROPS.rice.water+=1,
    r=>r.frozenRun.contracts={changed:true},
    r=>r.frozenRun.engineIdentity.modules[0].sha256='0'.repeat(64)
  ]){
    const changed=clone(full);mutate(changed);
    assert.notEqual((await verifyFrozenRun(changed,cryptoOptions)).status,'verified');
  }
});

test('captured release claims have separate integrity without changing the computational root',async()=>{
  const otherRelease={...published,metadata:{...published.metadata,commit:'b'.repeat(40)}};
  const other=await buildFrozenRun(result,context,otherRelease,cryptoOptions);
  assert.equal(other.captureStatus,'complete-record');
  assert.equal(other.digests.computational,complete.digests.computational);
  assert.notEqual(other.digests.buildIdentity,complete.digests.buildIdentity);
  const corrupt=clone(full);corrupt.frozenRun.releaseState.metadata.commit='b'.repeat(40);
  const verification=await verifyFrozenRun(corrupt,cryptoOptions);
  assert.equal(verification.status,'mismatch');assert.equal(verification.matches.buildIdentity,false);
  const plan=planFrom();plan.buildCommit='b'.repeat(40);
  const selected=await createSelectedFrozenRun(corrupt,plan,cryptoOptions);
  assert.equal(selected.captureStatus,'incomplete-record');assert.ok(selected.captureIssues.some(x=>x.startsWith('parent-build-identity:')));
});

test('independent root provenance and fixed hash declarations cannot be silently altered',async()=>{
  const mutations=[
    r=>r.config.quarter=1,
    r=>r.farmIds=['F02'],
    r=>r.inputHash='00000000',
    r=>r.modelVersion='different-model',
    r=>r.dataVersion='different-data',
    r=>r.climateRetrievedAt='changed',
    r=>r.frozenRun.runId='sha256:'+'0'.repeat(64),
    r=>r.frozenRun.hashFormat.algorithm='FNV',
    r=>r.frozenRun.hashFormat.canonicalization='unknown',
    r=>r.frozenRun.hashFormat.domain='other-domain',
    r=>r.frozenRun.inputsRef='current-ui-inputs',
    r=>r.frozenRun.assurance='scientifically-validated',
    r=>r.frozenRun.captureStatus='trusted',
    r=>r.frozenRun.releaseState.reason='edited-reason',
    r=>r.frozenRun.releaseState.metadata.changes.push('edited-release-note')
  ];
  for(const mutate of mutations){const corrupt=clone(full);mutate(corrupt);assert.notEqual((await verifyFrozenRun(corrupt,cryptoOptions)).status,'verified');}
  const corruptRoot=clone(result);corruptRoot.config.quarter=1;
  assert.equal((await buildFrozenRun(corruptRoot,context,published,cryptoOptions)).captureStatus,'incomplete-record');
});

test('selected saved provenance and parent-reference edits fail retained-record verification',async()=>{
  const plan=planFrom();plan.frozenRun=await createSelectedFrozenRun(full,plan,cryptoOptions);
  for(const mutate of [
    p=>p.applicationVersion='different-app',
    p=>p.modelVersion='different-model',
    p=>p.dataVersion='different-data',
    p=>p.inputHash='00000000',
    p=>p.buildCommit='b'.repeat(40),
    p=>p.frozenRun.parentReference.computationalDigest='0'.repeat(64),
    p=>p.frozenRun.parentReference.claim='membership-proof'
  ]){
    const corrupt=clone(plan);mutate(corrupt);assert.notEqual((await verifyFrozenRun(corrupt,cryptoOptions)).status,'verified');
  }
});

test('missing crypto and digest rejection preserve numerical results and original captured inputs',async()=>{
  for(const cryptoProvider of [null,{subtle:{digest:async()=>{throw new Error('digest-rejected');}}}]){
    const before=JSON.stringify(result),frozen=await buildFrozenRun(result,context,published,{cryptoProvider});
    assert.equal(frozen.captureStatus,'incomplete-record');assert.ok(frozen.captureIssues.length);
    assert.equal(frozen.digests.computational,null);assert.equal(frozen.digests.inputs,null);
    assert.equal(JSON.stringify(result),before);assert.deepEqual(context.runInputs,inputs);
    assert.equal((await verifyFrozenRun({...full,frozenRun:frozen},{cryptoProvider})).status,'unavailable');
  }
});

test('unavailable, mismatched, pending or local metadata cannot make a complete published record',async()=>{
  for(const release of [null,{status:'pending'},
    {status:'unavailable',metadata:null,reason:'offline'},
    {...published,metadata:{...published.metadata,commit:'local-preview'}},
    {...published,metadata:{...published.metadata,commit:null}},
    {...published,metadata:{...published.metadata,engineDigest:'0'.repeat(64)}},
    {...published,metadata:{...published.metadata,version:'wrong'}}]){
    const frozen=await buildFrozenRun(result,context,release,cryptoOptions);
    assert.equal(frozen.captureStatus,'incomplete-record');
    assert.equal(frozen.digests.computational,complete.digests.computational);
    assert.equal(frozen.digests.explanatory,complete.digests.explanatory);
  }
});

test('selected sidecars are bounded, have separate scope, reuse inputs/output and never mutate parent',async()=>{
  const before=JSON.stringify(full),plan=planFrom(result.candidates.at(-1));
  plan.frozenRun=await createSelectedFrozenRun(full,plan,cryptoOptions);
  const sidecar=plan.frozenRun;
  assert.equal(sidecar.captureStatus,'complete-record');assert.equal(sidecar.scope,'selected-candidate');
  assert.equal(sidecar.digests.inputs,complete.digests.inputs);
  assert.equal(sidecar.digests.parameters,complete.digests.parameters);
  assert.equal(sidecar.digests.explanatory,complete.digests.explanatory);
  assert.notEqual(sidecar.digests.output,complete.digests.output);
  assert.notEqual(sidecar.digests.computational,complete.digests.computational);
  assert.deepEqual(Object.keys(sidecar.output).sort(),['baselineDigest','selectedCandidate']);
  assert.equal(sidecar.output.selectedCandidate.id,plan.candidate.id);
  assert.equal(sidecar.parentReference.computationalDigest,complete.digests.computational);
  assert.equal(sidecar.parentReference.claim,'provenance-reference-not-membership-proof');
  assert.equal(Object.hasOwn(sidecar.output,'candidateDigests'),false);
  assert.equal(Object.hasOwn(sidecar,'runInputs'),false);assert.equal(Object.hasOwn(sidecar,'candidates'),false);
  assert.equal(JSON.stringify(full),before);
  assert.equal((await verifyFrozenRun(plan,cryptoOptions)).status,'verified');
  plan.candidate.totals.water+=1;assert.equal((await verifyFrozenRun(plan,cryptoOptions)).status,'mismatch');
});

test('selected capture detects input drift, retains incomplete parent and does not backfill history',async()=>{
  const drift=planFrom();drift.config.seed+=1;
  const changed=await createSelectedFrozenRun(full,drift,cryptoOptions);
  assert.equal(changed.captureStatus,'incomplete-record');assert.ok(changed.captureIssues.includes('selected-inputs-do-not-match-parent'));
  const incomplete=await buildFrozenRun(result,context,null,cryptoOptions);
  const selected=await createSelectedFrozenRun({...full,frozenRun:incomplete},planFrom(),cryptoOptions);
  assert.equal(selected.captureStatus,'incomplete-record');assert.ok(selected.captureIssues.includes('parent-record-incomplete'));
  const wrongParameters=clone(full);wrongParameters.frozenRun.parameters.CROPS.rice.water+=1;
  const wrong=await createSelectedFrozenRun(wrongParameters,planFrom(),cryptoOptions);
  assert.equal(wrong.captureStatus,'incomplete-record');assert.ok(wrong.captureIssues.includes('selected-parameters-do-not-match-parent'));
  assert.equal(await createSelectedFrozenRun(result,planFrom(),cryptoOptions),null);
});

test('candidate SHA requests remain sequential, without cloning or duplicating candidate output',async()=>{
  let active=0,maxActive=0;
  const cryptoProvider={subtle:{digest:async(...args)=>{
    active++;maxActive=Math.max(maxActive,active);
    try{return await webcrypto.subtle.digest(...args);}finally{active--;}
  }}};
  const frozen=await buildFrozenRun(result,context,published,{cryptoProvider});
  assert.equal(maxActive,1);assert.deepEqual(frozen.digests,complete.digests);
});

test('worker returns the unchanged default 3897/2008/1414 numerical result plus one sidecar',async()=>{
  const allInputs={...inputs,farmIds:inputs.dataset.farms.map(f=>f.id)};
  const expected=search(allInputs.dataset,allInputs.farmIds,allInputs.config,allInputs.climate);
  const posts=[],old={self:globalThis.self,postMessage:globalThis.postMessage,fetch:globalThis.fetch};
  try{
    globalThis.self={};globalThis.postMessage=message=>posts.push(message);
    globalThis.fetch=async()=>({ok:true,json:async()=>clone(published.metadata)});
    await import('../src/optimizer.worker.js');
    await globalThis.self.onmessage({data:clone(allInputs)});
    const response=posts.find(m=>m.type==='result');assert.ok(response,JSON.stringify(posts.filter(m=>m.type==='error')));
    const {frozenRun,runInputs,...numeric}=response.result;
    assert.equal(numeric.evaluated,3897);assert.equal(numeric.feasibleCount,2008);assert.equal(numeric.frontierCount,1414);
    numeric.createdAt=expected.createdAt;assert.deepEqual(numeric,expected);assert.deepEqual(runInputs,allInputs);
    assert.equal(frozenRun.captureStatus,'complete-record');assert.equal(frozenRun.output.candidateDigests.length,1414);
    assert.equal(JSON.stringify(response.result).split('"frozenRun":').length-1,1);
    assert.ok(posts.some(m=>m.type==='progress'&&m.progress===100));
  }finally{for(const [key,value] of Object.entries(old)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test('worker preserves numerical result even when recording throws outside normal digest handling',async()=>{
  const posts=[],old={self:globalThis.self,postMessage:globalThis.postMessage,fetch:globalThis.fetch};
  const cryptoDescriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
  try{
    globalThis.self={};globalThis.postMessage=message=>posts.push(message);
    globalThis.fetch=async()=>({ok:true,json:async()=>clone(published.metadata)});
    Object.defineProperty(globalThis,'crypto',{configurable:true,get(){throw new Error('unexpected-crypto-provider-error');}});
    await import('../src/optimizer.worker.js?capture-boundary');
    await globalThis.self.onmessage({data:clone(inputs)});
    const response=posts.find(m=>m.type==='result');assert.ok(response);
    const {frozenRun,runInputs,...numeric}=response.result;numeric.createdAt=result.createdAt;
    assert.deepEqual(numeric,result);assert.deepEqual(runInputs,inputs);
    assert.equal(frozenRun.captureStatus,'incomplete-record');assert.equal(frozenRun.runId,null);
    assert.ok(frozenRun.captureIssues.some(issue=>issue.includes('unexpected-crypto-provider-error')));
    assert.equal(posts.some(m=>m.type==='error'),false);
  }finally{
    if(cryptoDescriptor)Object.defineProperty(globalThis,'crypto',cryptoDescriptor);else delete globalThis.crypto;
    for(const [key,value] of Object.entries(old)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
  }
});
