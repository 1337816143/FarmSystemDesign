/** Local source archive and binding checks for the optional, single-quarter manure N/P input. */
import {distributeManureNP} from './manure-np.js';
export const NP_INPUT_LIMIT=512*1024;
const fail=message=>{throw new Error(`Manure N/P input: ${message}`);};
const clone=value=>structuredClone(value);
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`:JSON.stringify(value);
const periodQuarter=contract=>{const m=/^2025-Q([1-4])$/.exec(contract?.period||'');if(!m)fail('period must be an explicit 2025 quarter');return Number(m[1])-1;};
function parseRaw(rawJSON){
  if(typeof rawJSON!=='string'||new TextEncoder().encode(rawJSON).length>NP_INPUT_LIMIT)fail('source JSON must be text no larger than 512 KiB');
  let contract;try{contract=JSON.parse(rawJSON);}catch{fail('source JSON is invalid');}
  if(!contract||typeof contract!=='object'||Array.isArray(contract)||Object.hasOwn(contract,'inputArchive'))fail('import the original contract, without an inputArchive wrapper');
  return contract;
}
/** Reuses the reviewed core validator, with ephemeral rows; never fills a missing value. */
export function checkManurePhosphorusContract(contract,farmIds,quarter){
  const rows=farmIds.map(id=>({id,villageId:id,manureRecovered:0,nNeed:0,transferCost:0,nTransferIn:0,nTransferOut:0}));
  distributeManureNP(rows,'independent',contract,quarter,{availableNFraction:.45,transferCostPerKgN:2});
  return true;
}
export function importManurePhosphorus(rawJSON,{filename='local-input.json',rows,quarter,confirmed=false}={}){
  if(confirmed!==true)fail('confirm the same recovered material and fixed remaining capacity basis');
  if(!Array.isArray(rows)||!rows.length)fail('selected accounting rows are required');
  const contract=parseRaw(rawJSON);checkManurePhosphorusContract(contract,rows.map(r=>r.id),quarter);
  if(typeof filename!=='string'||filename.length>250)fail('invalid source filename');
  const inputArchive={schema:'FarmSystemDesign.ManurePhosphorusInputArchive',schemaVersion:1,filename,rawJSON,
    sameRecoveredMaterialConfirmed:true,capacityBasis:'fixed-remaining-total-P-after-other-occupancy',
    selectedRecoveredN:rows.map(r=>({farmId:r.id,recoveredN:r.manureRecovered}))};
  const result={...clone(contract),inputArchive};validateManurePhosphorusArchive(result,rows,quarter);return result;
}
/** No archive is added to a historical/raw API contract. This only validates an archive if present. */
export function validateManurePhosphorusArchive(contract,rows=null,quarter=null){
  if(!contract||!Object.hasOwn(contract,'inputArchive'))return true;
  const a=contract.inputArchive;
  if(!a||a.schema!=='FarmSystemDesign.ManurePhosphorusInputArchive'||a.schemaVersion!==1||typeof a.filename!=='string'||a.filename.length>250
    ||a.sameRecoveredMaterialConfirmed!==true||a.capacityBasis!=='fixed-remaining-total-P-after-other-occupancy'||!Array.isArray(a.selectedRecoveredN)||!a.selectedRecoveredN.length)fail('invalid retained source archive');
  const raw=parseRaw(a.rawJSON),{inputArchive,...retained}=contract;
  if(canonical(raw)!==canonical(retained))fail('raw source JSON does not match the retained contract');
  const bindings=a.selectedRecoveredN,seen=new Set();
  for(const b of bindings){if(!b||typeof b.farmId!=='string'||!b.farmId||seen.has(b.farmId)||!Number.isFinite(b.recoveredN)||b.recoveredN<0)fail('invalid recovered-N binding');seen.add(b.farmId);}
  checkManurePhosphorusContract(raw,bindings.map(b=>b.farmId),periodQuarter(raw));
  if(quarter!==null&&raw.period!==`2025-Q${quarter+1}`)fail('quarter changed; re-import and bind a matching original contract, or switch N/P off');
  if(rows){
    if(canonical(rows.map(r=>r.id).sort())!==canonical(bindings.map(b=>b.farmId).sort()))fail('selected boundary changed; re-import and bind for this scope, or switch N/P off');
    const byId=new Map(bindings.map(b=>[b.farmId,b.recoveredN]));
    if(rows.some(r=>r.manureRecovered!==byId.get(r.id)))fail('recovered-N inventory changed; re-import and confirm the paired P material, or switch N/P off');
  }
  return true;
}
/** Draft restore is detached and remains disabled. No saved plan is recalculated or backfilled. */
export function restoreManurePhosphorusDraft(draft){
  if(draft===undefined||draft===null)return null;
  if(!draft.inputArchive)fail('draft must retain its original source archive');
  validateManurePhosphorusArchive(draft);return clone(draft);
}
export function manurePhosphorusTemplate(farmIds,quarter){
  return {schema:'FarmSystemDesign.ManurePhosphorusContract',schemaVersion:1,period:`2025-Q${quarter+1}`,unit:'kg elemental P',
    bindings:farmIds.map(farmId=>({farmId,recoveredManureP:null,remainingApplicationCapacityP:null,provenance:'user-unverified',source:''}))};
}
