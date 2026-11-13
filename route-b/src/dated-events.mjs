/** Private synthetic prototype. Date allocation is not a crop response model. */
export const VERSION = 'dated-menu-events-0.1.0';
const DAY = 86400000;
const fail = msg => { throw new Error(`Dated event contract: ${msg}`); };
const text = (v, k) => { if (typeof v !== 'string' || !v.trim()) fail(`${k} required`); };
const dense = (a, k, max) => {
  if (!Array.isArray(a) || a.length === 0 || a.length > max) fail(`${k} length`);
  for (let i=0;i<a.length;i++) if (!Object.hasOwn(a,i)) fail(`${k} sparse entry`);
};
const date = v => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) fail('ISO calendar date required');
  const n=Date.parse(`${v}T00:00:00Z`);
  if (!Number.isFinite(n) || new Date(n).toISOString().slice(0,10)!==v) fail('invalid calendar date');
  return n / DAY;
};
const amount = (v,k) => { if (typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e12) fail(`${k}: explicit finite nonnegative amount required; missing is not zero`); };
const UNITS = Object.freeze({laborHours:'h',waterM3:'m3'});
/** All intervals are half-open [start,end); daily granularity; no automatic period inference. */
export function allocateEvents(input) {
  if(input?.schema!=='HainanDatedResourceEvents'||input.schemaVersion!==1)fail('schema/version');
  if(input.evidence!=='synthetic'||input.inferenceScope!=='hypothetical-systems')fail('synthetic-only prototype');
  if(input.coverage!=='complete-within-declared-horizon')fail('complete event coverage declaration required; absent dates are not automatically zero');
  text(input.datasetVersion,'datasetVersion');text(input.menuId,'menuId');text(input.operatorId,'operatorId');text(input.unitId,'unitId');
  if(input.calendar!=='local-date-no-timezone-conversion')fail('calendar convention');
  dense(input.periods,'periods',24);dense(input.events,'events',10000);
  const ids=new Set();
  const periods=input.periods.map((p,i)=>{
    text(p.id,'period.id');if(ids.has(p.id))fail('duplicate period');ids.add(p.id);
    const start=date(p.start),end=date(p.end);if(start>=end)fail('nonpositive period');
    return {...p,startDay:start,endDay:end};
  });
  for(let i=1;i<periods.length;i++)if(periods[i-1].endDay!==periods[i].startDay)fail('periods must be ordered, contiguous and nonoverlapping');
  const vectors={laborHours:periods.map(()=>0),waterM3:periods.map(()=>0)};
  const totals={laborHours:0,waterM3:0},seen=new Set(),coverage=new Set(),audit=[];
  for(const e of input.events){
    text(e.id,'event.id');if(seen.has(e.id))fail('duplicate event');seen.add(e.id);
    if(e.menuId!==input.menuId||e.operatorId!==input.operatorId||e.unitId!==input.unitId)fail('event scope mismatch');
    if(!Object.hasOwn(UNITS,e.metric)||e.unit!==UNITS[e.metric])fail('unsupported metric/unit');
    if(e.evidence!=='synthetic')fail('event evidence');text(e.source,'event.source');text(e.parameterVersion,'event.parameterVersion');text(e.allocationReason,'allocationReason');
    amount(e.value,'event.value');coverage.add(e.metric);const parts=periods.map(()=>0);
    if(e.allocation==='event-date'){
      const d=date(e.date);const i=periods.findIndex(p=>d>=p.startDay&&d<p.endDay);
      if(i<0)fail('event outside horizon');parts[i]=e.value;
      if(e.start!==undefined||e.end!==undefined)fail('event-date has interval fields');
    }else if(e.allocation==='uniform-duration'){
      if(e.date!==undefined)fail('duration has event date');const start=date(e.start),end=date(e.end);
      if(start>=end||start<periods[0].startDay||end>periods.at(-1).endDay)fail('interval invalid or outside horizon');
      const indices=[];
      periods.forEach((p,i)=>{const overlap=Math.max(0,Math.min(end,p.endDay)-Math.max(start,p.startDay));if(overlap){parts[i]=e.value*overlap/(end-start);indices.push(i);}});
      // Preserve the declared total, assigning only floating point residue to the final overlap.
      const last=indices.at(-1);parts[last]=e.value-parts.reduce((a,b,i)=>a+(i===last?0:b),0);
    }else fail('allocation policy must be explicit');
    for(const v of parts)if(!Number.isFinite(v)||v<0)fail('invalid allocated amount');
    const allocated=parts.reduce((a,b)=>a+b,0);
    if(Math.abs(allocated-e.value)>1e-10*Math.max(1,e.value))fail('event conservation');
    parts.forEach((v,i)=>vectors[e.metric][i]+=v);totals[e.metric]+=e.value;
    if(!Number.isFinite(totals[e.metric])||totals[e.metric]>1e12)fail('aggregate exceeds prototype limit');
    audit.push({id:e.id,metric:e.metric,unit:e.unit,declared:e.value,allocated,byPeriod:parts,source:e.source,parameterVersion:e.parameterVersion,allocation:e.allocation,allocationReason:e.allocationReason,...(e.allocation==='event-date'?{date:e.date}:{start:e.start,end:e.end})});
  }
  // An explicit zero event is required when a supported resource is known to be zero.
  for(const k of Object.keys(UNITS))if(!coverage.has(k))fail(`${k} absent; explicit zero required if truly zero`);
  return {schema:'HainanDatedResourceResult',schemaVersion:1,version:VERSION,evidence:'synthetic',inferenceScope:'hypothetical-systems',datasetVersion:input.datasetVersion,menuId:input.menuId,operatorId:input.operatorId,unitId:input.unitId,periods:periods.map(p=>p.id),periodDefinitions:periods.map(({id,start,end})=>({id,start,end})),coverage:input.coverage,calendar:input.calendar,vectors,totals,audit,limits:'Resource timing only; no calibrated crop response, crop-history feasibility, adoption, adaptation, N/P flow or provincial inference'};
}
/** Produces a copy; only resource arrays change. Caller must validate/re-run the B engine. */
export function applyDatedResources(menu,periodLabels,input){
  if(menu?.origin!=='synthetic'||menu.id!==input?.menuId)fail('menu identity/evidence mismatch');
  const result=allocateEvents(input);
  if(JSON.stringify(periodLabels)!==JSON.stringify(result.periods))fail('period alignment');
  return {menu:{...structuredClone(menu),laborHours:[...result.vectors.laborHours],waterM3:[...result.vectors.waterM3]},resourceAudit:result};
}
