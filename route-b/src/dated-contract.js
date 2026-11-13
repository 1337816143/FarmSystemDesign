/** Date attachments are separate from opaque original menu input. Content consistency, not trust. */
import {allocateEvents,applyDatedResources,VERSION} from './dated-events.mjs';
import {validateInput,run,makeRecord,inputFromRecord,ENGINE_VERSION} from './engine.js';
import {canonicalJSON,sha256,runConfig,resultSummary,makeInputSnapshot,restoreInputSnapshot,SNAPSHOT_SCHEMA,INPUT_CONTRACT,IMPORT_LIMIT_BYTES} from './recovery.js';
export const DATED_CONTRACT=Object.freeze({schema:'FarmSystemDesign.DatedMenuAttachments',schemaVersion:2,moduleVersion:VERSION});
const fail=message=>{throw new Error(`Dated attachment contract: ${message}`)};
const equal=(a,b)=>canonicalJSON(a)===canonicalJSON(b);
const clone=x=>{canonicalJSON(x);return JSON.parse(JSON.stringify(x));};
const own=(o,k)=>Object.hasOwn(o,k);
function target(input,stratumId,menuId){const s=input.strata.find(s=>s.id===stratumId),m=s?.menus.find(m=>m.id===menuId);if(!s||!m)fail('stratum/menu binding does not exist');return {s,m};}
/** Version/source and area-based resource meaning are immutable while attached.
 * Labels, capacities, non-resource economics/nutrients and unknown metadata remain editable.
 * Optional declared provenance fields distinguish absence from an explicit JSON value. */
export function datedParentContext(input,stratumId,menuId){
 const {s,m}=target(input,stratumId,menuId);
 const optional=(o,key)=>own(o,key)?{present:true,value:clone(o[key])}:{present:false};
 const selected=(o,keys)=>Object.fromEntries(keys.map(k=>[k,clone(o[k])]));
 return {schema:'FarmSystemDesign.DatedParentContext',schemaVersion:1,
  dataset:{datasetVersion:input.datasetVersion,evidence:input.evidence,inferenceScope:input.inferenceScope,parameterVersion:optional(input,'parameterVersion'),source:optional(input,'source')},
  stratum:{...selected(s,['id','origin','areaHa','landClass']),parameterVersion:optional(s,'parameterVersion'),source:optional(s,'source')},
  menu:{...selected(m,['id','source','origin','areaHa','landClass','agronomicStatus','phd1CandidateId','commitment']),parameterVersion:optional(m,'parameterVersion')},
  resourceUnits:{laborHours:'h per declared operating menu',waterM3:'m3 per declared operating menu'}};
}
export function validateDatedBindings(input,records=[]){
 validateInput(input);canonicalJSON(records);if(!Array.isArray(records)||records.length>48)fail('records must be a bounded array');
 const seen=new Set();let calendar=null;for(const record of records){
  if(!equal(Object.keys(record).sort(),['audit','menuId','parentContext','source','stratumId']))fail('record fields');
  const key=canonicalJSON([record.stratumId,record.menuId]);if(seen.has(key))fail('duplicate stratum/menu binding');seen.add(key);
  const {m}=target(input,record.stratumId,record.menuId);
  if(!equal(record.parentContext,datedParentContext(input,record.stratumId,record.menuId)))fail('parent menu/dataset version, provenance or resource-unit context mismatch; remove date attachment explicitly before replacing parent parameters');
  if(record.source?.stratumId!==record.stratumId||record.source?.menuId!==record.menuId)fail('source stratum/menu binding mismatch');
  const computed=applyDatedResources(m,input.periods,record.source);
  if(calendar&&!equal(calendar,computed.resourceAudit.periodDefinitions))fail('attached menus must share identical period calendar definitions');calendar=computed.resourceAudit.periodDefinitions;
  if(!equal(computed.resourceAudit,record.audit))fail('source/audit mismatch');
  if(!equal(m.laborHours,computed.menu.laborHours)||!equal(m.waterM3,computed.menu.waterM3))fail('source/menu vectors mismatch; remove date attachment explicitly before editing resource arrays');
 }
 return true;
}
export function prepareDatedChange(input,records,stratumId,menuId,source){
 validateDatedBindings(input,records);canonicalJSON(source);const captured=clone(source);
 if(captured.stratumId!==stratumId||captured.menuId!==menuId)fail('source stratum/menu binding mismatch');
 const candidate=structuredClone(input),{s,m}=target(candidate,stratumId,menuId),computed=applyDatedResources(m,candidate.periods,captured);
 s.menus[s.menus.findIndex(m=>m.id===menuId)]=computed.menu;
 const record={stratumId,menuId,parentContext:datedParentContext(candidate,stratumId,menuId),source:captured,audit:computed.resourceAudit};
 const attachments=[...clone(records).filter(r=>r.stratumId!==stratumId||r.menuId!==menuId),record];
 validateDatedBindings(candidate,attachments);
 return {input:candidate,records:attachments,record};
}
/** Invented dates matching current period amounts. Never infers a real crop calendar. */
export function syntheticTemplate(input,stratumId,menuId,records=[]){
 const {m}=target(input,stratumId,menuId);
 const start=new Date('2026-01-01T00:00:00Z');
 const boundary=i=>new Date(input.periods.length<=12?Date.UTC(start.getUTCFullYear(),Math.floor(12*i/input.periods.length),1):start.getTime()+Math.floor(365*i/input.periods.length)*86400000).toISOString().slice(0,10);
 const periods=records.length?clone(records[0].source.periods):input.periods.map((id,i)=>({id,start:boundary(i),end:boundary(i+1)}));
 const base={menuId,operatorId:`synthetic-operator:${stratumId}`,unitId:`synthetic-unit:${stratumId}`,evidence:'synthetic'};
 return {schema:'HainanDatedResourceEvents',schemaVersion:1,stratumId,...base,coverage:'complete-within-declared-horizon',calendar:'local-date-no-timezone-conversion',datasetVersion:'synthetic-ui-expansion-1',inferenceScope:'hypothetical-systems',periods,events:['laborHours','waterM3'].flatMap(metric=>m[metric].map((value,i)=>({...base,id:`${metric}:${i}`,metric,unit:metric==='laborHours'?'h':'m3',value,allocation:'event-date',date:periods[i].start,source:'Invented software example expanded from the selected menu; not observations',parameterVersion:'synthetic-ui-expansion-1',allocationReason:'Assign the existing period amount to the invented start date of the declared period'})))};
}
function checkContract(record){if(!equal(record.datedContract,DATED_CONTRACT))fail('date contract or module version mismatch');if(!Array.isArray(record.datedRecords))fail('missing or invalid date records');validateDatedBindings(record.input,record.datedRecords);if(!record.datedRecords.length)fail('schema 2 requires date attachments');}
export function makeDatedRecord(input,result,records=[],options={}){
 validateDatedBindings(input,records);const record=makeRecord(input,result,options);
 if(records.length){record.schemaVersion=2;record.datedContract={...DATED_CONTRACT};record.datedRecords=clone(records);record.runConfig=runConfig({annual:result.mode==='annual-diagnostic'});}
 return record;
}
export function restoreDatedRecord(record){
 canonicalJSON(record);
 if(record?.schemaVersion===1){if(own(record,'datedRecords')||own(record,'datedContract'))fail('date attachments require schema 2');return {input:inputFromRecord(record),records:[],config:runConfig({annual:record.result?.mode==='annual-diagnostic'})};}
 if(record?.schema!=='FarmSystemDesign.HainanRun'||record.schemaVersion!==2||record.engineVersion!==ENGINE_VERSION)fail('archive schema or engine version mismatch');
 checkContract(record);const config=runConfig(record.runConfig);if(!equal(config,record.runConfig))fail('run configuration mismatch');
 // result is audit evidence only; every caller must run the current engine from this input.
 return {input:clone(record.input),records:clone(record.datedRecords),config};
}
export async function makeDatedSnapshot(input,result,records=[],options={},build=null){
 validateDatedBindings(input,records);if(!records.length)return makeInputSnapshot(input,result,options);
 const config=runConfig(options);if(result?.engineVersion!==ENGINE_VERSION||result.mode!==config.mode)fail('result/config mismatch');
 const snapshot={schema:SNAPSHOT_SCHEMA,schemaVersion:2,engineVersion:ENGINE_VERSION,inputContract:{...INPUT_CONTRACT},datedContract:{...DATED_CONTRACT},datedRecords:clone(records),input:clone(input),runConfig:config,summary:resultSummary(result),build:clone(build)};
 snapshot.integrity={algorithm:'SHA-256',canonicalization:'sorted-json-v1',scope:'snapshot-without-integrity',digest:await sha256(canonicalJSON(snapshot))};
 if(new TextEncoder().encode(JSON.stringify(snapshot)).byteLength>IMPORT_LIMIT_BYTES)fail('recovery snapshot exceeds 5 MiB; no download was dispatched');return snapshot;
}
export async function restoreDatedSnapshot(record,{isCurrent=()=>true}={}){
 if(record?.schemaVersion===1){const restored=await restoreInputSnapshot(record,{isCurrent});return restored?{...restored,records:[]}:null;}
 canonicalJSON(record);const snapshot=clone(record);
 if(snapshot.schema!==SNAPSHOT_SCHEMA||snapshot.schemaVersion!==2||snapshot.engineVersion!==ENGINE_VERSION||!equal(snapshot.inputContract,INPUT_CONTRACT))fail('snapshot schema or engine version mismatch');
 if(!equal(Object.keys(snapshot).sort(),['schema','schemaVersion','engineVersion','inputContract','datedContract','datedRecords','input','runConfig','summary','build','integrity'].sort()))fail('unsupported snapshot fields or saved result');
 checkContract(snapshot);const config=runConfig(snapshot.runConfig);if(!equal(config,snapshot.runConfig))fail('run configuration mismatch');
 const {integrity,...payload}=snapshot;
 if(!integrity||!equal(Object.keys(integrity).sort(),['algorithm','canonicalization','scope','digest'].sort())||integrity.algorithm!=='SHA-256'||integrity.canonicalization!=='sorted-json-v1'||integrity.scope!=='snapshot-without-integrity'||!(/^[a-f0-9]{64}$/).test(integrity.digest))fail('invalid integrity metadata');
 if(await sha256(canonicalJSON(payload))!==integrity.digest)fail('integrity mismatch');if(!isCurrent())return null;
 const result=run(snapshot.input,config);if(!equal(resultSummary(result),snapshot.summary))fail('summary/recomputed result mismatch');
 return {input:snapshot.input,records:snapshot.datedRecords,config,result};
}

export function hasFullCalendarYear(records){if(!records.length)return true;const p=records[0].audit.periodDefinitions;return p[0].start.endsWith('-01-01')&&p.at(-1).end===`${Number(p[0].start.slice(0,4))+1}-01-01`;}
