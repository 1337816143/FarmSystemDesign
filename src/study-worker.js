/** Run the existing optimizer, with its existing capture contract, in an owned worker. */
export function runStudyJob(message,{signal,onProgress=()=>{}}={}){
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./optimizer.worker.js',import.meta.url),{type:'module'});
  const finish=(fn,value)=>{signal?.removeEventListener('abort',abort);worker.terminate();fn(value);};
  const abort=()=>finish(reject,new DOMException('Scenario batch paused','AbortError'));
  if(signal?.aborted){abort();return;}
  signal?.addEventListener('abort',abort,{once:true});
  worker.onerror=error=>finish(reject,Error(error.message||'BATCH_WORKER_FAILED'));
  worker.onmessage=({data})=>{
   if(data.type==='progress')onProgress(data.progress);
   else if(data.type==='error')finish(reject,Error(data.error));
   else if(data.type==='result')finish(resolve,data.result);
  };
  worker.postMessage(structuredClone(message));
 });
}
