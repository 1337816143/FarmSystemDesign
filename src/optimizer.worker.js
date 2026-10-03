import {search} from './model.js';
import {captureRunContext,buildFrozenRun,incompleteFrozenRun} from './frozen-run.js';
import {loadReleaseMetadata} from './release-state.js';

self.onmessage=async({data})=>{
  let context={runInputs:null,parameters:null,engineIdentity:null,contracts:null,evidenceRefs:null,captureIssues:[]};
  // Snapshots precede both search and asynchronous metadata/hash work.
  try{context=captureRunContext(data);}catch(error){
    context.captureIssues.push(`dispatch-capture-failed: ${error.message}`);
    try{context.runInputs=structuredClone(data);}catch{/* Keep an explicit missing-input record. */}
  }
  const releasePromise=Promise.resolve().then(()=>loadReleaseMetadata()).catch(()=>({status:'unavailable',metadata:null,reason:'metadata-capture-failed'}));
  let result;
  try{
    result=search(data.dataset,data.farmIds,data.config,data.climate,progress=>postMessage({type:'progress',progress}));
  }catch(error){postMessage({type:'error',error:error.message});return;}
  let frozenRun,releaseState;
  try{releaseState=await releasePromise;frozenRun=await buildFrozenRun(result,context,releaseState);}
  catch(error){frozenRun=incompleteFrozenRun(context,error,releaseState);}
  postMessage({type:'result',result:{...result,runInputs:context.runInputs,frozenRun}});
};
