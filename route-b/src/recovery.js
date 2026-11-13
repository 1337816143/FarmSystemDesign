/** Small, local recovery envelope. Integrity is content consistency, never trust/signature. */
import {ENGINE_VERSION,MAX_COMBINATIONS,validateInput,run} from './engine.js';
export const SNAPSHOT_SCHEMA='FarmSystemDesign.HainanInputSnapshot';
export const INPUT_CONTRACT=Object.freeze({schema:'FarmSystemDesign.HainanMenus',schemaVersion:1});
export const IMPORT_LIMIT_BYTES=5*1024*1024;
const fail=message=>{throw new Error(message)};
const equal=(a,b)=>canonicalJSON(a)===canonicalJSON(b);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
/** JSON numbers/strings, array order and sorted UTF-16 object keys; no Unicode normalization.
 * Not RFC 8785: this project's versioned sorted-json-v1 contract, finite JSON data only.
 * Serializes the ENTIRE input, including unknown metadata; never projects away provenance.
 */
export function canonicalJSON(value){
 if(value===null)return 'null';
 if(typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 if(Array.isArray(value)){
  const parts=[];for(let i=0;i<value.length;i++){if(!own(value,i))fail('恢复快照只接受完整的有限JSON数据');parts.push(canonicalJSON(value[i]))}return '['+parts.join(',')+']';
 }
 if(value&&typeof value==='object'&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null))return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJSON(value[k])).join(',')+'}';
 fail('恢复快照只接受完整的有限JSON数据');
}
export async function sha256(text){
 if(!globalThis.crypto?.subtle)fail('当前环境不支持SHA-256；请使用支持Web Crypto的本地浏览器环境');
 const bytes=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function runConfig({annual=false,maxCombinations=MAX_COMBINATIONS}={}){
 if(typeof annual!=='boolean'||maxCombinations!==MAX_COMBINATIONS)fail('恢复快照运行配置无效');
 return {annual,maxCombinations,mode:annual?'annual-diagnostic':'period-specific'};
}
/** Fixed-size recomputable counts, not a copy/serialization/hash of the full result tree. */
export function resultSummary(result){
 return {mode:result.mode,total:result.search.total,evaluated:result.search.evaluated,feasible:result.search.feasible,frontier:result.search.frontier,complete:result.search.complete};
}
function checkedConfig(config){
 if(!config||typeof config!=='object'||!own(config,'annual')||!own(config,'maxCombinations')||!own(config,'mode'))fail('恢复快照运行配置无效');
 const expected=runConfig(config);if(!equal(config,expected))fail('恢复快照运行配置无效');return expected;
}
function checkEnvelope(snapshot){
 if(!snapshot||snapshot.schema!==SNAPSHOT_SCHEMA||snapshot.schemaVersion!==1)fail('不支持的恢复快照格式或版本');
 if(snapshot.engineVersion!==ENGINE_VERSION)fail('恢复快照引擎版本不匹配');
 if(!equal(snapshot.inputContract,INPUT_CONTRACT))fail('恢复快照输入合同版本不匹配');
 if(!own(snapshot,'input'))fail('恢复快照缺少完整输入');
 validateInput(snapshot.input);
 return checkedConfig(snapshot.runConfig);
}
export async function makeInputSnapshot(input,result,options={}){
 validateInput(input);canonicalJSON(input);const config=runConfig(options);
 if(!result||result.engineVersion!==ENGINE_VERSION||result.mode!==config.mode)fail('恢复快照结果与运行配置不匹配');
 // Capture before the first await; never retain a mutable live input or traverse full results.
 const snapshot={schema:SNAPSHOT_SCHEMA,schemaVersion:1,engineVersion:ENGINE_VERSION,inputContract:{...INPUT_CONTRACT},input:JSON.parse(JSON.stringify(input)),runConfig:config,summary:resultSummary(result)};
 const digest=await sha256(canonicalJSON(snapshot));
 snapshot.integrity={algorithm:'SHA-256',canonicalization:'sorted-json-v1',scope:'snapshot-without-integrity',digest};
 // Guarantee that every emitted recovery snapshot passes the same read-before-size guard.
 if(new TextEncoder().encode(JSON.stringify(snapshot)).byteLength>IMPORT_LIMIT_BYTES)fail('恢复快照超过5 MiB；未下载，请精简非必要输入元数据后重试');
 return snapshot;
}
export async function restoreInputSnapshot(record,{isCurrent=()=>true}={}){
 // Clone JSON data now: callers cannot mutate a record while its asynchronous hash is pending.
 canonicalJSON(record);const snapshot=JSON.parse(JSON.stringify(record));
 const config=checkEnvelope(snapshot),integrity=snapshot.integrity;
 if(!integrity||integrity.algorithm!=='SHA-256'||integrity.canonicalization!=='sorted-json-v1'||integrity.scope!=='snapshot-without-integrity'||typeof integrity.digest!=='string'||!/^[a-f0-9]{64}$/.test(integrity.digest)||Object.keys(integrity).length!==4)fail('恢复快照内容校验无效');
 // A recovery snapshot carries no saved results. Reject unknown top-level payloads explicitly.
 const expected=['schema','schemaVersion','engineVersion','inputContract','input','runConfig','summary','integrity'].sort();
 if(!equal(Object.keys(snapshot).sort(),expected))fail('恢复快照包含未支持的字段或保存结果');
 const {integrity:unused,...payload}=snapshot;
 if(await sha256(canonicalJSON(payload))!==integrity.digest)fail('恢复快照内容校验不一致');
 if(!isCurrent())return null;
 const result=run(snapshot.input,config);
 if(!equal(resultSummary(result),snapshot.summary))fail('恢复快照摘要与独立重算不一致');
 return {input:snapshot.input,config,result};
}
