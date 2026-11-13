/** Lossless editable tables, with the original FarmDESIGN identifiers and units. */
export const DOCUMENT_SCHEMA='FarmSystemDesign.FarmDESIGN.NativeTables';
export const TABLES={FRM:['农场与模型设置','Farm and model settings'],ENV:['环境与土壤','Environment and soil'],ECN:['经营与劳动','Economics and labour'],ROT:['轮作','Rotations'],RCR:['轮作面积','Rotation crop areas'],CRP:['作物活动','Crop activities'],PRD:['作物产品与用途','Crop products and destinations'],ANM:['畜群','Animal herds'],APR:['畜产品','Animal products'],ARR:['畜群替代关系','Herd replacement'],MAN:['粪肥管理','Manure management'],FRT:['肥料','Fertilizers'],CFR:['作物施肥','Crop fertilizer application'],CMR:['作物粪肥施用','Crop manure application'],PST:['农药','Pesticides'],CPR:['作物农药施用','Crop pesticide application'],GRP:['作物组','Crop groups'],GCR:['作物组成员','Crop group members'],MCH:['机械资产','Machinery'],BLD:['建筑资产','Buildings'],HHD:['家庭预算','Household budget'],HMR:['家庭成员','Household members'],DRI:['营养需求参考','Dietary reference intakes'],DRF:['食品保留因子','Food retention factors']};
export const clone=v=>structuredClone(v);
export function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
export async function digest(value){const bytes=new TextEncoder().encode(canonical(value));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');}
export function validateDocument(d){
 const issues=[];
 if(!d||d.schema!==DOCUMENT_SCHEMA||d.schemaVersion!==1)return ['需要 FarmDESIGN NativeTables v1 项目 / Expected FarmDESIGN NativeTables v1'];
 if(!Number.isInteger(d.farmId)||d.farmId<=0)issues.push('farmId must be a positive integer');
 if(!d.tables||typeof d.tables!=='object'||Array.isArray(d.tables))return [...issues,'tables is required'];
 const keys={FRM:'FrmID',ENV:'EnvID',ECN:'EcnID',ROT:'RotID',RCR:'RcrID',CRP:'CrpID',PRD:'PrdID',ANM:'AnmID',APR:'AprID',ARR:'ArrID',MAN:'ManID',FRT:'FrtID',CFR:'CfrID',CMR:'CmrID',PST:'PstID',CPR:'CprID',GRP:'GrpID',GCR:'GcrID',MCH:'MchID',BLD:'BldID',HHD:'HhdID',HMR:'HmrID',DRI:'DriID',DRF:'DrfID'};
 for(const [table,rows] of Object.entries(d.tables)){
  if(!Object.hasOwn(TABLES,table)){issues.push(`Unsupported table: ${table}`);continue;}
  if(!Array.isArray(rows)||rows.length>5000){issues.push(`${table}: expected at most 5000 rows`);continue;}
  const seen=new Set();for(const [i,row] of rows.entries()){
   if(!row||typeof row!=='object'||Array.isArray(row)){issues.push(`${table}[${i}]: expected row`);continue;}
   const id=row[keys[table]];if(!Number.isInteger(id)||seen.has(id))issues.push(`${table}[${i}]: missing or duplicate ${keys[table]}`);seen.add(id);
   for(const [key,v] of Object.entries(row))if(['__proto__','constructor','prototype'].includes(key)||v!==null&&!['string','number','boolean'].includes(typeof v)||typeof v==='number'&&!Number.isFinite(v)||typeof v==='string'&&v.length>20000)issues.push(`${table}[${i}].${key}: invalid scalar`);
   if(Object.hasOwn(row,'FrmID')&&row.FrmID!==d.farmId)issues.push(`${table}[${i}]: farm identity mismatch`);
  }
 }
 if(d.tables.FRM?.length!==1||d.tables.FRM[0]?.FrmID!==d.farmId)issues.push('Exactly one matching FRM row is required');
 for(const t of ['ENV','ECN'])if(d.tables[t]?.length!==1)issues.push(`Exactly one ${t} row is required`);
 const refs=[['RCR','RotID','ROT','RotID'],['RCR','CrpID','CRP','CrpID'],['PRD','CrpID','CRP','CrpID'],['APR','AnmID','ANM','AnmID'],['ARR','AnmID','ANM','AnmID'],['ARR','RepID','ANM','AnmID'],['CFR','CrpID','CRP','CrpID'],['CFR','FrtID','FRT','FrtID'],['CMR','CrpID','CRP','CrpID'],['CMR','ManID','MAN','ManID'],['CPR','CrpID','CRP','CrpID'],['CPR','PstID','PST','PstID'],['GCR','GrpID','GRP','GrpID'],['GCR','CrpID','CRP','CrpID'],['HMR','HhdID','HHD','HhdID']];
 for(const [t,k,target,pk] of refs){const ids=new Set((d.tables[target]||[]).map(x=>x[pk]));for(const row of d.tables[t]||[])if(!ids.has(row[k]))issues.push(`${t} ${row[k]} references missing ${target}.${pk}`);}
 for(const t of ['PRD','APR','FRT'])for(const r of d.tables[t]||[])for(const k of ['DMContent','NContent','PContent','KContent','AshContent','OMContent'])if(r[k]!==null&&r[k]!==undefined&&(typeof r[k]!=='number'||r[k]<0||r[k]>100))issues.push(`${t}.${r.Name}.${k} must be in 0..100 percent`);
 for(const [t,k] of [['RCR','Area'],['ANM','AnmNumber'],['FRT','Amount'],['PST','Amount']])for(const r of d.tables[t]||[])if(typeof r[k]!=='number'||r[k]<0)issues.push(`${t}.${k} must be nonnegative`);
 return issues;
}
export function parseDocument(text){if(new TextEncoder().encode(text).byteLength>8*1024*1024)throw Error('项目超过 8 MB / Project exceeds 8 MB');const doc=JSON.parse(text);const issues=validateDocument(doc);if(issues.length)throw Error(issues.slice(0,12).join('\n'));return doc;}
export function describeFarm(d){return {name:d.tables.FRM[0].Name,currency:d.tables.ECN[0].Currenc,area:(d.tables.RCR||[]).reduce((s,r)=>s+r.Area,0),crops:d.tables.CRP?.length||0,animals:(d.tables.ANM||[]).reduce((s,r)=>s+r.AnmNumber,0),householdMembers:(d.tables.HMR||[]).reduce((s,r)=>s+(r._Number??1),0)};}
export function variableKey(v){return `${v.EntityType}:${v.ObjID}:${v.Variable}`;}
export function reportKey(v){return `${v.EntityType}:${v.ObjName}:${v.Variable}`;}
export function withNativeIds(rows,key,reserved=[]){
 const used=new Set(),taken=new Set(reserved.map(row=>row[key]).filter(Number.isInteger));
 for(const row of rows)if(Number.isInteger(row[key])){if(used.has(row[key]))throw Error('Duplicate native '+key);used.add(row[key]);taken.add(row[key]);}
 let next=Math.max(0,...taken);
 return rows.map(row=>{if(Number.isInteger(row[key]))return {...row};if(next>=2147483647)throw Error('Native identifier range exhausted');return {...row,[key]:++next};});
}
export function nativeWorkbench(document){
 const native=document.optimization||{},settings=native.settings||{};
 if(document.workbench)return clone(document.workbench);
 return {variables:clone(native.variables||[]),
  objectives:(native.indicators||[]).filter(row=>row.Objective).map(row=>({key:reportKey(row),direction:row.Direction===1?'max':'min'})),
  constraints:(native.indicators||[]).filter(row=>row.Constrain).map(row=>({key:reportKey(row),min:row.Minimum,max:row.Maximum})),
  settings:{F:settings.Amplitude??.15,CR:settings.Probability??.85,population:settings.MultiFactor??36,generations:settings.Generations??24}};
}
export function number(value){return typeof value==='number'&&Number.isFinite(value)?value:null;}
