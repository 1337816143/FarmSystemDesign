import {canonicalJSON} from './frozen-run.js';

export const FEEDBACK_METRICS=Object.freeze({
 water:{zh:'窗口灌溉 / 补水量',en:'Window irrigation / supplemental water',unit:'m³',nonnegative:true},
 revenue:{zh:'窗口销售收入',en:'Window sales revenue',unit:'CNY',nonnegative:true},
 margin:{zh:'窗口已计变动成本后的核算收益',en:'Window margin after included variable costs',unit:'CNY',nonnegative:false},
 labour:{zh:'窗口劳动需求',en:'Window labour requirement',unit:'workdays',nonnegative:true},
 nSurplus:{zh:'窗口氮收支余量',en:'Window nitrogen balance',unit:'kg N',nonnegative:false},
 energy:{zh:'窗口可食能量代理',en:'Window edible-energy proxy',unit:'GJ',nonnegative:true},
});
const clone=value=>structuredClone(value);
export function localDate(date=new Date()){
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function validDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const [year,month,day]=value.split('-').map(Number),leap=year%4===0&&(year%100!==0||year%400===0);
 return year>=1&&month>=1&&month<=12&&day>=1&&day<=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
}
export function planName(plan,metadata={}){return metadata[plan?.id]?.label||plan?.name||plan?.id||'—';}
export function restorePlanMetadata(value,plans){
 if(value==null)return {};
 if(typeof value!=='object'||Array.isArray(value))throw Error('PLAN_METADATA_INVALID');
 const result={};for(const plan of plans){const row=value[plan.id];if(row===undefined)continue;
  if(!row||typeof row.label!=='string'||row.label.length>100||typeof row.note!=='string'||row.note.length>1000)throw Error('PLAN_METADATA_INVALID');
  result[plan.id]={label:row.label,note:row.note,updatedAt:typeof row.updatedAt==='string'?row.updatedAt:null};
 }return result;
}
export function planAnnotation(plan,patch,metadata={},at=new Date().toISOString()){
 if(!plan?.id)throw Error('PLAN_MISSING');
 const label=String(patch.label??'').trim(),note=String(patch.note??'').trim();
 if(label.length>100||note.length>1000)throw Error('ANNOTATION_TOO_LONG');
 return {...metadata,[plan.id]:{label,note,updatedAt:at}};
}
const eq=(a,b)=>{try{return canonicalJSON(a)===canonicalJSON(b);}catch{return false;}};
const inputs=plan=>plan?.dataset?{dataset:plan.dataset,climate:plan.climate??null}:plan?.frozenRun?.runInputs||null;
const ids=plan=>Array.isArray(plan?.farmIds)?[...plan.farmIds].sort():null;
export function comparePlans(left,right){
 const a=inputs(left),b=inputs(right),known=Boolean(a?.dataset&&b?.dataset);
 const context=[
  {key:'scope',same:!!ids(left)&&!!ids(right)&&eq(ids(left),ids(right)),left:ids(left),right:ids(right)},
  {key:'quarter',same:Number.isInteger(left?.config?.quarter)&&left.config.quarter===right?.config?.quarter,left:left?.config?.quarter,right:right?.config?.quarter},
  {key:'model',same:!!left?.modelVersion&&left.modelVersion===right?.modelVersion,left:left?.modelVersion,right:right?.modelVersion},
  {key:'dataset',same:known&&eq(a.dataset,b.dataset),left:a?.dataset?.version,right:b?.dataset?.version},
  {key:'climate',same:known&&eq(a.climate??null,b.climate??null),left:a?.climate?.retrievedAt||null,right:b?.climate?.retrievedAt||null},
 ];
 const conditions=['mode','water','labour','rain','price','shock','minIncomeRatio','manurePhosphorus','spatialRainfall'].map(key=>({key,same:eq(left?.config?.[key]??null,right?.config?.[key]??null),left:left?.config?.[key],right:right?.config?.[key]}));
 const search=['objective','seed','samples'].map(key=>({key,same:eq(left?.config?.[key],right?.config?.[key]),left:left?.config?.[key],right:right?.config?.[key]}));
 const canSubtract=context.every(row=>row.same),sameConditions=conditions.every(row=>row.same);
 const metrics=['margin','water','labour','nSurplus','energy'].map(key=>{
  const x=left?.candidate?.totals?.[key],y=right?.candidate?.totals?.[key],finite=Number.isFinite(x)&&Number.isFinite(y);
  const difference=finite&&canSubtract?y-x:null,delta=Number.isFinite(difference)?difference:null;
  return {key,left:Number.isFinite(x)?x:null,right:Number.isFinite(y)?y:null,delta,
   percent:delta!==null&&x>0&&Number.isFinite(delta/x*100)?delta/x*100:null};
 });
 return {context,conditions,search,canSubtract,sameConditions,metrics,
  interpretation:!canSubtract?'different-accounting':sameConditions?'same-conditions':'descriptive-scenario-difference'};
}
function priorVersion(record){const {history,...snapshot}=record;return clone(snapshot);}
export function saveFeedback(records,plans,draft,{id,at=new Date().toISOString()}={}){
 const plan=plans.find(p=>p.id===draft.planId),metric=FEEDBACK_METRICS[draft.metric],raw=draft.value;
 if(!plan)throw Error('PLAN_MISSING');
 if(!metric)throw Error('METRIC_INVALID');
 if(draft.sameScope!==true)throw Error('SCOPE_CONFIRM_REQUIRED');
 if(!['number','string'].includes(typeof raw)||typeof raw==='string'&&!raw.trim()||!Number.isFinite(Number(raw))||metric.nonnegative&&Number(raw)<0)throw Error('VALUE_INVALID');
 if(!validDate(draft.date))throw Error('DATE_INVALID');
 if(!['synthetic','user-unverified'].includes(draft.provenance))throw Error('PROVENANCE_INVALID');
 const note=String(draft.note??'').trim();if(!note||note.length>700)throw Error('NOTE_REQUIRED');
 const old=records.find(r=>r.id===draft.id);
 if(draft.id&&!old)throw Error('RECORD_MISSING');
 if(old?.history?.length>=20)throw Error('HISTORY_LIMIT');
 const quarter=plan.config?.quarter;
 if(!Number.isInteger(quarter)||quarter<0||quarter>3||!Array.isArray(plan.farmIds)||!plan.farmIds.length)throw Error('PLAN_SCOPE_UNKNOWN');
 const predicted=plan.candidate?.totals?.[draft.metric];
 const record={...(old||{}),id:old?.id||id||crypto.randomUUID(),planId:plan.id,planName:plan.name,
  period:`2025 Q${quarter+1} / ${plan.farmIds.length}个主体`,metric:draft.metric,value:Number(raw),
  predicted:Number.isFinite(predicted)?predicted:null,date:draft.date,note,provenance:draft.provenance,
  recordedAt:old?.recordedAt||at,editedAt:old?at:null,archived:old?.archived||false,
  reference:{modelVersion:plan.modelVersion,inputHash:plan.inputHash,quarter,year:2025,farmIds:clone(plan.farmIds),unit:metric.unit,
   comparability:'user-declared-same-boundary; not independently verified'},
  history:old?[...(old.history||[]),{action:'edit',at,previous:priorVersion(old)}]:[]};
 return old?records.map(r=>r.id===old.id?record:r):[record,...records];
}
export function archiveFeedback(records,id,archived,at=new Date().toISOString()){
 const old=records.find(row=>row.id===id);if(!old)throw Error('RECORD_MISSING');
 if(old.history?.length>=20)throw Error('HISTORY_LIMIT');
 const next={...old,archived:Boolean(archived),archivedAt:archived?at:null,
  history:[...(old.history||[]),{action:archived?'archive':'restore',at,previous:priorVersion(old)}]};
 return records.map(row=>row.id===id?next:row);
}
export function feedbackDeviation(record){
 if(!Number.isFinite(record?.value)||!Number.isFinite(record?.predicted))return {delta:null,percent:null};
 const delta=record.value-record.predicted;
 return {delta:Number.isFinite(delta)?delta:null,percent:record.predicted>0&&Number.isFinite(delta/record.predicted*100)?delta/record.predicted*100:null};
}
