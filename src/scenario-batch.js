import {SCENARIOS,validateDataset,MODEL_VERSION} from './data.js';
import {validateConfig,evaluate} from './model.js';
import {baselineAllocation} from './data.js';
import {canonicalJSON,sha256JSON,captureRunContext} from './frozen-run.js';

export const BATCH_SCHEMA='FarmSystemDesign.ScenarioBatch';
export const BATCH_KEY='farmsystem-scenario-batch-v1';
const clone=value=>structuredClone(value);
const sourceContext=()=>{const {runInputs,...source}=captureRunContext({});return source;};
const digest=(domain,value)=>sha256JSON('FarmSystemDesign/study/'+domain,value);
function assertContext(context){
 const issues=validateDataset(context?.dataset);if(issues.length)throw Error('BATCH_DATASET_INVALID: '+issues.slice(0,4).join('; '));
 if(!Array.isArray(context.farmIds)||!context.farmIds.length||new Set(context.farmIds).size!==context.farmIds.length||context.farmIds.some(id=>!context.dataset.farms.some(f=>f.id===id)))throw Error('BATCH_SCOPE_INVALID');
 validateConfig(context.config);
}
function checkedSelection(values,allowed){
 if(!Array.isArray(values)||!values.length||new Set(values).size!==values.length||values.some(value=>!allowed.includes(value)))throw Error('BATCH_SELECTION_INVALID');
 return values;
}
export async function createBatch(context,selection,{id=crypto.randomUUID(),at=new Date().toISOString()}={}){
 const inputs=clone(context);assertContext(inputs);
 const scenarios=checkedSelection(selection.scenarios,['current',...Object.keys(SCENARIOS)]);
 const modes=checkedSelection(selection.modes,['independent','cooperative','centralized']);
 const quarters=checkedSelection(selection.quarters,[0,1,2,3]);
 if(scenarios.length*modes.length*quarters.length>60)throw Error('BATCH_LIMIT');
 const jobs=[];const plots=inputs.dataset.plots.filter(p=>inputs.farmIds.includes(p.farmId));
 for(const quarter of quarters)for(const mode of modes)for(const scenario of scenarios){
  const config={...clone(inputs.config),...(scenario==='current'?{}:SCENARIOS[scenario]),scenario,quarter,mode,
   samples:selection.samples,seed:selection.seed,objective:selection.objective};
  validateConfig(config);
  if(!['balanced','income','water','environment','food'].includes(config.objective))throw Error('BATCH_OBJECTIVE_INVALID');
  // Native contracts are checked as supplied. Do not silently remove P or rainfall bindings.
  try{evaluate(inputs.dataset,inputs.farmIds,baselineAllocation(plots),config,inputs.climate??null);}catch(error){throw Error(`BATCH_CONTRACT_INVALID: Q${quarter+1} / ${scenario} / ${mode}: ${error.message}`);}
  jobs.push({id:`job-${jobs.length+1}`,scenario,quarter,mode,config,status:'pending',progress:0,result:null,error:null});
 }
 const batch={schema:BATCH_SCHEMA,schemaVersion:1,id,createdAt:at,updatedAt:at,status:'ready',inputs,source:clone(sourceContext()),jobs};
 batch.inputDigest=await digest('batch-input/v1',{inputs:batch.inputs,source:batch.source,jobs:batch.jobs.map(({id,config,scenario,mode,quarter})=>({id,config,scenario,mode,quarter}))});
 return batch;
}
async function compactResult(result,job,batch){
 if(result.modelVersion!==MODEL_VERSION||canonicalJSON(result.config)!==canonicalJSON(job.config)||canonicalJSON(result.farmIds)!==canonicalJSON(batch.inputs.farmIds))throw Error('BATCH_RESULT_CONTEXT_MISMATCH');
 const selected=result.candidates?.[0]||null;
 if(selected&&!selected.feasible)throw Error('BATCH_RESULT_NOT_FEASIBLE');
 const compact={modelVersion:result.modelVersion,createdAt:result.createdAt,inputHash:result.inputHash,dataVersion:result.dataVersion,
  evaluated:result.evaluated,feasibleCount:result.feasibleCount,frontierCount:result.frontierCount,exact:result.exact,method:result.method,
  baseline:clone(result.baseline),selected:clone(selected),bestInfeasible:selected?null:clone(result.bestInfeasible||null),
  retention:'selected-candidate-and-baseline; full frontier not retained',
  source:{captureStatus:result.frozenRun?.captureStatus||'not-captured',parentDigests:clone(result.frozenRun?.digests||{}),
   release:clone(result.frozenRun?.releaseState||null)},ranking:clone(result.ranking)};
 compact.contentDigest=await digest('batch-result/v1',{inputDigest:batch.inputDigest,jobId:job.id,config:job.config,result:compact});
 return compact;
}
export async function validateBatch(raw,{forResume=false}={}){
 const batch=clone(raw);
 if(batch?.schema!==BATCH_SCHEMA||batch.schemaVersion!==1||!Array.isArray(batch.jobs)||!batch.jobs.length||batch.jobs.length>60)throw Error('BATCH_FILE_INVALID');
 assertContext(batch.inputs);
 const identifiers=new Set();
 for(const job of batch.jobs){
  if(typeof job.id!=='string'||identifiers.has(job.id)||!['pending','running','completed','failed'].includes(job.status)||!['current',...Object.keys(SCENARIOS)].includes(job.scenario)||job.mode!==job.config?.mode||job.quarter!==job.config?.quarter)throw Error('BATCH_JOB_INVALID');
  identifiers.add(job.id);validateConfig(job.config);
  if(job.status==='completed'){
   const {contentDigest,...result}=job.result||{};
   if(!contentDigest||contentDigest!==await digest('batch-result/v1',{inputDigest:batch.inputDigest,jobId:job.id,config:job.config,result}))throw Error('BATCH_RESULT_DIGEST_MISMATCH');
  }
 }
 const expected=await digest('batch-input/v1',{inputs:batch.inputs,source:batch.source,jobs:batch.jobs.map(({id,config,scenario,mode,quarter})=>({id,config,scenario,mode,quarter}))});
 if(batch.inputDigest!==expected)throw Error('BATCH_INPUT_DIGEST_MISMATCH');
 if(forResume){const current=sourceContext();if(canonicalJSON(batch.source.parameters)!==canonicalJSON(current.parameters)||canonicalJSON(batch.source.engineIdentity)!==canonicalJSON(current.engineIdentity))throw Error('BATCH_ENGINE_CHANGED');}
 return batch;
}
export function batchRows(batch){
 return batch.jobs.map(job=>({id:job.id,status:job.status,quarter:job.quarter,mode:job.mode,scenario:job.scenario,
  config:job.config,error:job.error,selected:job.result?.selected||null,baseline:job.result?.baseline||null,
  evaluated:job.result?.evaluated??null,feasibleCount:job.result?.feasibleCount??null,exact:job.result?.exact??null,
  digest:job.result?.contentDigest||null}));
}
export class ScenarioBatch {
 constructor({runJob,save,onChange=()=>{},clock=()=>new Date().toISOString()}){
  this.runJob=runJob;this.save=save;this.onChange=onChange;this.clock=clock;this.batch=null;this.running=false;this.preparing=false;this.abort=null;this.saveError=null;
 }
 notify(){this.onChange(this.batch,this);}
 checkpoint(){
  if(!this.batch)return true;
  this.batch.updatedAt=this.clock();
  try{this.save(clone(this.batch));this.saveError=null;return true;}catch(error){this.saveError=error.message;return false;}
 }
 async load(raw){
  if(this.running||this.preparing)throw Error('BATCH_BUSY');
  const batch=await validateBatch(raw);
  for(const job of batch.jobs)if(job.status==='running'){job.status='pending';job.progress=0;}
  if(batch.status==='running')batch.status='paused';
  this.batch=batch;this.notify();return batch;
 }
 async create(context,selection){
  if(this.running||this.preparing)throw Error('BATCH_BUSY');
  this.preparing=true;this.notify();
  try{const next=await createBatch(context,selection);this.batch=next;this.checkpoint();return next;}
  finally{this.preparing=false;this.notify();}
 }
 async start({retryFailed=false}={}){
  if(this.running||this.preparing)throw Error('BATCH_BUSY');if(!this.batch)throw Error('BATCH_MISSING');
  this.preparing=true;this.notify();
  try{await validateBatch(this.batch,{forResume:true});}finally{this.preparing=false;this.notify();}
  if(retryFailed)for(const job of this.batch.jobs)if(job.status==='failed'){job.status='pending';job.error=null;job.progress=0;}
  this.batch.status='running';if(!this.checkpoint()){this.batch.status='paused';this.notify();return;}
  this.running=true;this.abort=new AbortController();this.notify();
  try{
   for(const job of this.batch.jobs){
    if(job.status!=='pending')continue;if(this.abort.signal.aborted)break;
    job.status='running';job.progress=0;
    if(!this.checkpoint()){job.status='pending';break;}this.notify();
    try{
     const result=await this.runJob({...clone(this.batch.inputs),config:clone(job.config)},{signal:this.abort.signal,onProgress:value=>{job.progress=Math.max(0,Math.min(100,Number(value)||0));this.notify();}});
     if(this.abort.signal.aborted){job.status='pending';job.progress=0;break;}
     job.result=await compactResult(result,job,this.batch);job.status='completed';job.progress=100;
    }catch(error){
     if(this.abort.signal.aborted||error.name==='AbortError'){job.status='pending';job.progress=0;break;}
     job.status='failed';job.error=error.message;job.progress=0;
    }
    if(!this.checkpoint())break;this.notify();
   }
  }finally{
   this.running=false;this.abort=null;
   this.batch.status=this.batch.jobs.some(job=>job.status==='pending')||this.saveError?'paused':'completed';
   this.checkpoint();this.notify();
  }
 }
 pause(){this.abort?.abort();}
 clear(){if(this.running||this.preparing)throw Error('BATCH_BUSY');this.save(null);this.batch=null;this.saveError=null;this.notify();}
}
