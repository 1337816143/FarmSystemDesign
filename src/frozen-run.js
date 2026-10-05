/** Bounded, local record integrity. Declared source identity is not executed-byte attestation. */
import {CROPS,ANNUALS,hash as legacyHash} from './data.js';
import {ENGINE_IDENTITY} from './engine-identity.generated.js';
import {METRIC_CONTRACTS,EVIDENCE_REFS} from './metric-contracts.js';

const SCHEMA='FarmSystemDesign.FrozenRun';
const HASH_DOMAIN='FarmSystemDesign/FrozenRun/v1';
const ENGINE_DOMAIN='FarmSystemDesign/engine-source/v1';
const SHA256=/^[a-f0-9]{64}$/;
const HASH_FORMAT=Object.freeze({algorithm:'SHA-256',canonicalization:'sorted-json-v1',domain:HASH_DOMAIN});
const ASSURANCE='local-record-integrity-only; not scientific validation or executed-byte attestation';
const PARENT_CLAIM='provenance-reference-not-membership-proof';
export const ENGINE_MODULE_PATHS=Object.freeze([
  'src/data.js','src/evidence.generated.js','src/frozen-run.js','src/model.js',
  'src/optimizer.worker.js','src/release-state.js','src/spatial-inputs.js','src/version.js'
]);

/** JSON values only: no silent omissions, nonfinite numbers, sparse arrays, or toJSON coercions. */
export function canonicalJSON(value){
  const ancestors=new Set();
  function visit(v){
    if(v===null||typeof v==='string'||typeof v==='boolean')return JSON.stringify(v);
    if(typeof v==='number'){if(!Number.isFinite(v))throw new Error('nonfinite-json-number');return JSON.stringify(v);}
    if(typeof v!=='object')throw new Error('unsupported-json-value');
    if(ancestors.has(v))throw new Error('cyclic-json-value');
    if(Object.getOwnPropertySymbols(v).length)throw new Error('symbol-json-key');
    ancestors.add(v);
    let text;
    if(Array.isArray(v)){
      if(Object.keys(v).length!==v.length)throw new Error('noncanonical-json-array');
      const values=[];for(let i=0;i<v.length;i++){if(!Object.hasOwn(v,i))throw new Error('sparse-json-array');values.push(visit(v[i]));}
      text=`[${values.join(',')}]`;
    }else{
      const proto=Object.getPrototypeOf(v);
      if(proto!==Object.prototype&&proto!==null)throw new Error('nonplain-json-object');
      text=`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${visit(v[k])}`).join(',')}}`;
    }
    ancestors.delete(v);return text;
  }
  return visit(value);
}

export async function sha256JSON(domain,value,cryptoProvider=globalThis.crypto){
  if(!cryptoProvider?.subtle?.digest)throw new Error('sha256-unavailable');
  const bytes=new TextEncoder().encode(`${domain}\n${canonicalJSON(value)}`);
  const buffer=await cryptoProvider.subtle.digest('SHA-256',bytes);
  const digest=Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
  if(!SHA256.test(digest))throw new Error('invalid-sha256-result');
  return digest;
}

function deepFreeze(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);
  }
  return value;
}
function snapshot(value){return deepFreeze(structuredClone(value));}
function issueMessage(error){return error instanceof Error?error.message:'capture-failed';}

/** Call synchronously before search, while the imported coefficients are those used by the engine. */
export function captureRunContext(workerMessage,options={}){
  const context={captureIssues:[]};
  const sources={runInputs:workerMessage,parameters:options.parameters??{CROPS,ANNUALS},
    engineIdentity:options.engineIdentity??ENGINE_IDENTITY,contracts:options.contracts??METRIC_CONTRACTS,
    evidenceRefs:options.evidenceRefs??EVIDENCE_REFS};
  for(const [key,value] of Object.entries(sources)){
    try{context[key]=snapshot(value);}catch(error){context[key]=null;context.captureIssues.push(`${key}: ${issueMessage(error)}`);}
  }
  return deepFreeze(context);
}

function enginePayload(identity){
  return {format:identity.format,algorithm:identity.algorithm,applicationVersion:identity.applicationVersion,
    modelVersion:identity.modelVersion,dataVersion:identity.dataVersion,modules:identity.modules};
}
async function verifyEngineIdentity(identity,cryptoProvider){
  if(!identity||identity.format!=='FarmSystemDesign.EngineSource.v1'||identity.algorithm!=='SHA-256'
    ||!SHA256.test(identity.digest||'')||!Array.isArray(identity.modules))throw new Error('invalid-engine-identity');
  for(const field of ['applicationVersion','modelVersion','dataVersion'])if(typeof identity[field]!=='string'||!identity[field])throw new Error('invalid-engine-version');
  // Preserve verification of original 0.3.14 records without adding today's module or parameters.
  const paths=identity.applicationVersion==='0.3.14'&&identity.modelVersion==='screening-0.2.0'&&identity.dataVersion==='evidence-2025-r1+assumptions-r2'
    ?ENGINE_MODULE_PATHS.filter(path=>path!=='src/spatial-inputs.js'):ENGINE_MODULE_PATHS;
  if(canonicalJSON(identity.modules.map(m=>m.path))!==canonicalJSON(paths))throw new Error('engine-dependency-list-mismatch');
  for(const m of identity.modules)if(!Number.isSafeInteger(m.bytes)||m.bytes<0||!SHA256.test(m.sha256||''))throw new Error('invalid-engine-module');
  const digest=await sha256JSON(ENGINE_DOMAIN,enginePayload(identity),cryptoProvider);
  if(digest!==identity.digest)throw new Error('engine-manifest-digest-mismatch');
  return digest;
}
function releaseIssue(releaseState,identity){
  if(releaseState?.status!=='verified')return `release-metadata: ${releaseState?.reason||'unavailable'}`;
  const m=releaseState.metadata;
  if(!m||m.version!==identity?.applicationVersion||m.modelVersion!==identity?.modelVersion
    ||m.dataVersion!==identity?.dataVersion||m.engineDigest!==identity?.digest)return 'release-metadata: identity-mismatch';
  if(typeof m.name!=='string'||m.name.length>160||!/^\d{4}-\d{2}-\d{2}$/.test(m.releasedOn||'')
    ||!Array.isArray(m.changes)||m.changes.length>30||m.changes.some(x=>typeof x!=='string'||x.length>1000))return 'release-metadata: invalid-metadata';
  if(m.commit==='local-preview')return 'release-metadata: local-preview-without-published-commit';
  if(!/^[a-f0-9]{40}$/.test(m.commit||''))return 'release-metadata: missing-published-commit';
  return null;
}
function accounting(candidate){
  if(!candidate||typeof candidate!=='object')throw new Error('missing-accounting-output');
  const {score,...fields}=candidate;return fields;
}
function candidateId(candidate){
  if(typeof candidate?.id!=='string'||!candidate.id)throw new Error('missing-candidate-id');
  return candidate.id;
}
function searchSummary(result){
  return {frontierCount:result.frontierCount,evaluated:result.evaluated,feasibleCount:result.feasibleCount,
    exact:result.exact,method:result.method,rankingRange:result.ranking.range};
}
function buildIdentityPayload(sidecar){
  return {engineIdentity:sidecar.engineIdentity,releaseState:sidecar.releaseState,parentReference:sidecar.parentReference??null};
}
function consistencyIssues(record,inputs,sidecar){
  const issues=[];
  if(!inputs)return ['missing-captured-inputs'];
  for(const key of ['config','farmIds'])if(canonicalJSON(record[key])!==canonicalJSON(inputs[key]))issues.push(`root-${key}-does-not-match-inputs`);
  // This checks an existing legacy label, never substitutes FNV for a SHA-256 integrity digest.
  if(record.inputHash!==legacyHash({data:inputs.dataset,farmIds:inputs.farmIds,config:inputs.config,climate:inputs.climate}))issues.push('root-inputHash-does-not-match-inputs');
  if(record.modelVersion!==sidecar.engineIdentity?.modelVersion)issues.push('root-modelVersion-does-not-match-engine');
  if(record.dataVersion!==inputs.dataset?.version)issues.push('root-dataVersion-does-not-match-inputs');
  if(sidecar.scope==='full-search'){
    if(record.climateRetrievedAt!==(inputs.climate?.retrievedAt||null))issues.push('root-climateRetrievedAt-does-not-match-inputs');
  }else{
    if(record.applicationVersion!==sidecar.engineIdentity?.applicationVersion)issues.push('root-applicationVersion-does-not-match-engine');
    if(record.buildCommit!==(sidecar.releaseState?.metadata?.commit||null))issues.push('root-buildCommit-does-not-match-release');
  }
  return issues;
}
async function outputRecord(record,scope,cryptoProvider){
  const leaf=candidate=>sha256JSON(`${HASH_DOMAIN}/accounting`,accounting(candidate),cryptoProvider);
  const baselineDigest=await leaf(record.baseline);
  if(scope==='selected-candidate')return {selectedCandidate:{id:candidateId(record.candidate),digest:await leaf(record.candidate)},baselineDigest};
  if(!Array.isArray(record.candidates))throw new Error('missing-candidate-array');
  const candidateDigests=[],seen=new Set();
  // Sequential leaves bound temporary memory to one accounting object, never a cloned frontier.
  for(const candidate of record.candidates){
    const id=candidateId(candidate);if(seen.has(id))throw new Error('duplicate-candidate-id');seen.add(id);
    candidateDigests.push({id,digest:await leaf(candidate)});
  }
  candidateDigests.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  if(record.frontierCount!==candidateDigests.length)throw new Error('frontier-count-mismatch');
  return {candidateDigests,baselineDigest,bestInfeasibleDigest:record.bestInfeasible===null?null:await leaf(record.bestInfeasible),search:snapshot(searchSummary(record))};
}
function blankSidecar(context,releaseState,scope){
  const captureIssues=[...(context.captureIssues||[])];
  let release;
  try{release=structuredClone(releaseState??{status:'unavailable',metadata:null,reason:'not-captured'});}
  catch(error){release={status:'unavailable',metadata:null,reason:'capture-failed'};captureIssues.push(`release-metadata: ${issueMessage(error)}`);}
  return {schema:SCHEMA,schemaVersion:1,scope,runId:null,captureStatus:'incomplete-record',captureIssues,
    hashFormat:{...HASH_FORMAT},assurance:ASSURANCE,
    inputsRef:scope==='full-search'?'runInputs':{dataset:'dataset',farmIds:'farmIds',config:'config',climate:'climate'},
    parameters:context.parameters,engineIdentity:context.engineIdentity,releaseState:release,
    contracts:context.contracts,evidenceRefs:context.evidenceRefs,output:null,
    digests:{inputs:null,parameters:null,engineSource:null,output:null,computational:null,explanatory:null,buildIdentity:null}};
}
async function fillDigests(sidecar,record,runInputs,cryptoProvider){
  const digest=(kind,value)=>sha256JSON(`${HASH_DOMAIN}/${kind}`,value,cryptoProvider);
  // Explanation failures do not invalidate an otherwise available computational digest.
  try{
    if(!sidecar.contracts||!sidecar.evidenceRefs)throw new Error('missing-explanation-record');
    sidecar.digests.explanatory=await digest('explanation',{contracts:sidecar.contracts,evidenceRefs:sidecar.evidenceRefs});
  }
  catch(error){sidecar.captureIssues.push(`explanation: ${issueMessage(error)}`);}
  // Capture provenance is protected separately; it never changes the computational root.
  try{sidecar.digests.buildIdentity=await digest('build-identity',buildIdentityPayload(sidecar));}
  catch(error){sidecar.captureIssues.push(`build-identity: ${issueMessage(error)}`);}
  try{
    if(!runInputs||!sidecar.parameters)throw new Error('missing-captured-record');
    sidecar.digests.inputs=await digest('inputs',runInputs);
    sidecar.digests.parameters=await digest('parameters',sidecar.parameters);
    sidecar.digests.engineSource=await verifyEngineIdentity(sidecar.engineIdentity,cryptoProvider);
    sidecar.output=await outputRecord(record,sidecar.scope,cryptoProvider);
    sidecar.digests.output=await digest(`output/${sidecar.scope}`,sidecar.output);
    sidecar.digests.computational=await digest('computational',{scope:sidecar.scope,inputDigest:sidecar.digests.inputs,
      parameterDigest:sidecar.digests.parameters,engineSourceDigest:sidecar.digests.engineSource,outputDigest:sidecar.digests.output});
  }catch(error){sidecar.captureIssues.push(`computation: ${issueMessage(error)}`);}
  try{sidecar.captureIssues.push(...consistencyIssues(record,runInputs,sidecar));}
  catch(error){sidecar.captureIssues.push(`root-consistency: ${issueMessage(error)}`);}
  const issue=releaseIssue(sidecar.releaseState,sidecar.engineIdentity);if(issue)sidecar.captureIssues.push(issue);
  sidecar.captureIssues=[...new Set(sidecar.captureIssues)];
  sidecar.runId=sidecar.digests.computational?`sha256:${sidecar.digests.computational}`:null;
  if(!sidecar.captureIssues.length&&Object.values(sidecar.digests).every(d=>SHA256.test(d||'')))sidecar.captureStatus='complete-record';
  return sidecar;
}

/** Adds no fields to candidates or model outputs. Failure produces an explicitly incomplete sidecar. */
export async function buildFrozenRun(result,context,releaseState,options={}){
  const sidecar=blankSidecar(context,releaseState,'full-search');
  return fillDigests(sidecar,result,context.runInputs,options.cryptoProvider===undefined?globalThis.crypto:options.cryptoProvider);
}

/** Last-resort capture boundary: a numerical result must survive unexpected recording failures. */
export function incompleteFrozenRun(context,error,releaseState=null){
  const sidecar=blankSidecar(context,releaseState,'full-search');
  sidecar.captureIssues.push(`capture-failed: ${issueMessage(error)}`);
  return sidecar;
}

/** Reuses saved plan inputs/output. Parent digest is a reference, never a frontier membership proof. */
export async function createSelectedFrozenRun(parentResult,plan,options={}){
  const original=parentResult?.frozenRun;
  if(!original)return null; // Historical snapshots must not be backfilled with today's coefficients.
  const context={captureIssues:[],parameters:structuredClone(original.parameters),engineIdentity:structuredClone(original.engineIdentity),
    contracts:structuredClone(original.contracts),evidenceRefs:structuredClone(original.evidenceRefs)};
  const sidecar=blankSidecar(context,original.releaseState,'selected-candidate');
  sidecar.parentReference={computationalDigest:original.digests?.computational??null,claim:PARENT_CLAIM};
  if(original.captureStatus!=='complete-record')sidecar.captureIssues.push('parent-record-incomplete');
  const runInputs={dataset:plan.dataset,farmIds:plan.farmIds,config:plan.config,climate:plan.climate};
  const provider=options.cryptoProvider===undefined?globalThis.crypto:options.cryptoProvider;
  await fillDigests(sidecar,plan,runInputs,provider);
  try{
    const parentBuildDigest=await sha256JSON(`${HASH_DOMAIN}/build-identity`,buildIdentityPayload(original),provider);
    if(parentBuildDigest!==original.digests?.buildIdentity)throw new Error('digest-mismatch');
  }catch(error){sidecar.captureIssues.push(`parent-build-identity: ${issueMessage(error)}`);sidecar.captureStatus='incomplete-record';}
  for(const key of ['inputs','parameters','engineSource','explanatory']){
    if(!sidecar.digests[key]||sidecar.digests[key]!==original.digests?.[key]){
      sidecar.captureIssues.push(`selected-${key}-do-not-match-parent`);sidecar.captureStatus='incomplete-record';
    }
  }
  return sidecar;
}

/** Re-hash retained inputs, coefficients, output and explanation; never upgrades an imported claim. */
export async function verifyFrozenRun(record,options={}){
  const frozen=record?.frozenRun,issues=[],matches={};
  if(frozen?.schema!==SCHEMA||frozen.schemaVersion!==1||!['full-search','selected-candidate'].includes(frozen.scope))
    return {status:'unavailable',matches,issues:['unsupported-or-missing-frozen-record']};
  const scope=frozen.scope;
  try{
    const context={captureIssues:[],parameters:frozen.parameters,engineIdentity:frozen.engineIdentity,contracts:frozen.contracts,evidenceRefs:frozen.evidenceRefs};
    const rebuilt=blankSidecar(context,frozen.releaseState,scope);
    if(scope==='selected-candidate')rebuilt.parentReference=frozen.parentReference??null;
    const inputs=scope==='full-search'?record.runInputs:{dataset:record.dataset,farmIds:record.farmIds,config:record.config,climate:record.climate};
    await fillDigests(rebuilt,record,inputs,options.cryptoProvider===undefined?globalThis.crypto:options.cryptoProvider);
    for(const key of Object.keys(rebuilt.digests)){
      matches[key]=SHA256.test(frozen.digests?.[key]||'')&&rebuilt.digests[key]===frozen.digests[key];
      if(!matches[key])issues.push(`${key}-digest-mismatch-or-unavailable`);
    }
    matches.outputRecord=canonicalJSON(rebuilt.output)===canonicalJSON(frozen.output);
    if(!matches.outputRecord)issues.push('output-leaf-record-mismatch');
    matches.runId=frozen.runId===rebuilt.runId;
    if(!matches.runId)issues.push('run-id-mismatch');
    for(const key of ['hashFormat','assurance','inputsRef']){
      matches[key]=canonicalJSON(frozen[key])===canonicalJSON(rebuilt[key]);
      if(!matches[key])issues.push(`${key}-declaration-mismatch`);
    }
    if(scope==='selected-candidate'&&(frozen.parentReference?.claim!==PARENT_CLAIM
      ||(frozen.parentReference.computationalDigest!==null&&!SHA256.test(frozen.parentReference.computationalDigest||''))))issues.push('invalid-parent-reference-claim');
    if(!['complete-record','incomplete-record'].includes(frozen.captureStatus))issues.push('invalid-capture-status');
    issues.push(...consistencyIssues(record,inputs,rebuilt));
    if(frozen.captureStatus==='complete-record'&&rebuilt.captureStatus!=='complete-record')issues.push('unsupported-complete-record-claim');
    const unavailable=Object.values(rebuilt.digests).some(d=>!d);
    return {status:unavailable?'unavailable':issues.length?'mismatch':'verified',matches,issues,
      declaredCaptureStatus:frozen.captureStatus,assurance:'retained-record-integrity-only; no source authenticity, scientific validation, or parent membership proof'};
  }catch(error){return {status:'unavailable',matches,issues:[...issues,issueMessage(error)]};}
}
