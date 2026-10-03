/** Release metadata consistency, not a signature or proof of executing module bytes. */
import {VERSION,MODEL_VERSION,DATA_VERSION} from './version.js';
import {ENGINE_IDENTITY} from './engine-identity.generated.js';

export function validateReleaseMetadata(metadata){
  if(!metadata||typeof metadata!=='object')return 'invalid-metadata';
  if(metadata.version!==VERSION||metadata.modelVersion!==MODEL_VERSION||metadata.dataVersion!==DATA_VERSION)return 'version-mismatch';
  if(metadata.engineDigest!==ENGINE_IDENTITY.digest)return 'engine-mismatch';
  if(!/^[a-f0-9]{40}$/.test(metadata.commit||'')&&metadata.commit!=='local-preview')return 'missing-source-identity';
  if(typeof metadata.name!=='string'||metadata.name.length>160||!/^\d{4}-\d{2}-\d{2}$/.test(metadata.releasedOn||''))return 'invalid-metadata';
  if(!Array.isArray(metadata.changes)||metadata.changes.length>30||metadata.changes.some(x=>typeof x!=='string'||x.length>1000))return 'invalid-metadata';
  return null;
}

export async function loadReleaseMetadata({fetcher=globalThis.fetch,timeoutMs=8000}={}){
  const controller=new AbortController();let timer;
  try{
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('metadata-timeout'));},timeoutMs);});
    const metadata=await Promise.race([(async()=>{
      const response=await fetcher(new URL('../version.json',import.meta.url),{signal:controller.signal,cache:'no-cache'});
      if(!response.ok)throw new Error('metadata-unavailable');
      return response.json();
    })(),timeout]);
    const reason=validateReleaseMetadata(metadata);
    return reason?{status:'unavailable',metadata:null,reason}:{status:'verified',metadata:structuredClone(metadata),reason:null};
  }catch(error){
    return {status:'unavailable',metadata:null,reason:error?.message==='metadata-timeout'?'metadata-timeout':'metadata-unavailable'};
  }finally{clearTimeout(timer);}
}
