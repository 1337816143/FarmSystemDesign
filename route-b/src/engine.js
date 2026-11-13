export const ENGINE_VERSION='hainan-menu-engine-0.1.3';
export const MAX_COMBINATIONS=2000;
const EPS=1e-8;
const sum=a=>a.reduce((s,x)=>s+x,0);
const fail=m=>{throw new Error(`B输入合同：${m}`);};
const num=(x,p)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<0||x>1e12)fail(`${p}必须是有限非负数且不超过合成演示上限1e12；缺失不能填0`);};
const amount=(x,p)=>{if(typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>1e12)fail(`${p}必须是有符号有限金额且绝对值不超过合成演示上限1e12；允许亏损和零毛利`);};
const ident=(x,p)=>{if(typeof x!=='string'||!x.trim()||x.length>200)fail(`${p}必须是1–200字符的字符串`);};
const dense=(x,p)=>{for(let i=0;i<x.length;i++)if(!Object.prototype.hasOwnProperty.call(x,i))fail(`${p}[${i}]缺少明确值；不接受稀疏数组或原型继承的数组项`);};
const list=(x,p,max)=>{if(!Array.isArray(x)||!x.length||x.length>max)fail(`${p}条目数必须在1–${max}`);dense(x,p);};
const unique=(a,p)=>{if(new Set(a).size!==a.length)fail(`${p}存在重复ID`);};
const vector=(a,n,p)=>{if(!Array.isArray(a)||a.length!==n)fail(`${p}与时间窗不匹配`);dense(a,p);for(let i=0;i<n;i++)num(a[i],`${p}[${i}]`);};
export function validateInput(input){
 if(!input||input.schema!=='FarmSystemDesign.HainanMenus'||input.schemaVersion!==1)fail('不支持的schema或版本');
 if(input.evidence!=='synthetic'||input.inferenceScope!=='hypothetical-systems')fail('当前引擎仅接受显式合成的机制检验；没有海南总体推断通道');
 if(input.representativeness?.status!=='absent')fail('本版本未实现代表性权重验证，不接受声称已获代表性的输入');
 if(input.accounting?.nutrients!=='kg elemental N / kg elemental P'||input.accounting?.currency!=='CNY synthetic price-year 2026')fail('养分必须使用元素N/P的kg，货币必须为明示2026合成CNY口径');
 if(input.social?.status!=='not-measured')fail('本版本未测接受度，不能标为已获社会接受');
 ident(input.datasetVersion,'datasetVersion');list(input.periods,'periods',24);input.periods.forEach(x=>ident(x,'period'));unique(input.periods,'periods');
 const T=input.periods.length;list(input.strata,'strata',6);list(input.waterSources,'waterSources',6);unique(input.strata.map(x=>x.id),'strata');unique(input.waterSources.map(x=>x.id),'waterSources');
 input.waterSources.forEach(s=>{ident(s.id,'waterSource.id');ident(s.label,'waterSource.label');if(s.origin!=='synthetic')fail('waterSource缺少synthetic来源');vector(s.capacity,T,`${s.id}.capacity`);});
 const sourceIds=new Set(input.waterSources.map(x=>x.id));const allMenus=[];
 for(const s of input.strata){
  for(const k of ['id','label','landClass','waterSourceId'])ident(s[k],`strata.${k}`);
  if(s.origin!=='synthetic')fail(`${s.id}来源必须为synthetic`);
  if(!Number.isInteger(s.count)||s.count<1||s.count>8)fail(`${s.id}.count必须是1–8个假设经营单元，不能填面积权重`);
  num(s.areaHa,`${s.id}.areaHa`);if(!s.areaHa)fail('经营面积必须大于0');
  if(!sourceIds.has(s.waterSourceId))fail(`${s.id}水源不存在`);
  vector(s.laborCapacity,T,`${s.id}.laborCapacity`);vector(s.waterAccess,T,`${s.id}.waterAccess`);list(s.menus,`${s.id}.menus`,8);
  for(const m of s.menus){
   for(const k of ['id','label','landClass','source'])ident(m[k],`menu.${k}`);
   if(m.origin!=='synthetic'||m.agronomicStatus!=='synthetic-prescreened'||m.phd1CandidateId!==null||m.commitment!=='uncommitted')fail(`${m.id}必须保留合成、未接PhD1、未承诺的状态；本版本不排程真实作物`);
   for(const k of ['areaHa','externalN','externalP','harvestN','harvestP'])num(m[k],`${m.id}.${k}`);
   amount(m.grossMarginCny,`${m.id}.grossMarginCny`);
   if(!m.areaHa)fail(`${m.id}.areaHa须大于0`);
   vector(m.laborHours,T,`${m.id}.laborHours`);vector(m.waterM3,T,`${m.id}.waterM3`);
   for(const p of ['grain','vegetable'])num(m.productsKg?.[p],`${m.id}.productsKg.${p}`);
   allMenus.push(m.id);
  }
 }
 unique(allMenus,'menus全局');
 for(const p of ['grain','vegetable'])num(input.constraints?.minProductsKg?.[p],`minProductsKg.${p}`);
 for(const p of ['maxExternalN','maxExternalP'])num(input.constraints?.[p],p);
 list(input.objectives,'objectives',3);
 const expected=[{key:'grossMarginCny',direction:'max'},{key:'externalN',direction:'min'},{key:'waterTotal',direction:'min'}];
 if(JSON.stringify(input.objectives)!==JSON.stringify(expected))fail('本版本三项显式前沿目标为毛利↑、外部N↓、用水↓；五评价领域并不等于五个优化目标');
 return true;
}
function upper(issues,level,key,used,limit,unit,period=null){if(used>limit+EPS)issues.push({level,key,period,used,limit,excess:used-limit,unit});}
function lower(issues,key,used,limit,unit){if(used+EPS<limit)issues.push({level:'regional',key,period:null,used,limit,excess:limit-used,unit,direction:'minimum'});}
export function evaluateMenu(stratum,menu,periods,{annual=false}={}){
 list(periods,'periods',24);periods.forEach(p=>ident(p,'period'));
 for(const [a,p]of [[stratum.laborCapacity,'laborCapacity'],[stratum.waterAccess,'waterAccess'],[menu.laborHours,'laborHours'],[menu.waterM3,'waterM3']])vector(a,periods.length,p);
 const issues=[];if(menu.landClass!==stratum.landClass)issues.push({level:'local',key:'land-class',used:menu.landClass,limit:stratum.landClass});
 upper(issues,'local','area',menu.areaHa,stratum.areaHa,'ha');
 if(annual){upper(issues,'local','labor',sum(menu.laborHours),sum(stratum.laborCapacity),'h');upper(issues,'local','water-access',sum(menu.waterM3),sum(stratum.waterAccess),'m³');}
 else periods.forEach((p,i)=>{upper(issues,'local','labor',menu.laborHours[i],stratum.laborCapacity[i],'h',p);upper(issues,'local','water-access',menu.waterM3[i],stratum.waterAccess[i],'m³',p);});
 return {stratumId:stratum.id,menuId:menu.id,label:menu.label,feasible:issues.length===0,issues,
   metrics:{grossMarginCny:menu.grossMarginCny,productsKg:{...menu.productsKg},externalN:menu.externalN,externalP:menu.externalP,nBalance:menu.externalN-menu.harvestN,pBalance:menu.externalP-menu.harvestP,waterTotal:sum(menu.waterM3),laborTotal:sum(menu.laborHours)},
   warning:'N/P为已声明简化作物边界的输入减收获移出；遗漏沉降/固氮/损失/土壤存量等，不是完整平衡或环境损失'};
}
/** Composition enumeration avoids treating exchangeable hypothetical units as distinct decision makers. */
export function compositions(total,parts){
 if(!Number.isSafeInteger(total)||total<0||total>8)fail('compositions.total必须是0–8的有限整数');
 if(!Number.isSafeInteger(parts)||parts<1||parts>8)fail('compositions.parts必须是1–8的有限整数');
 // Compute C(total+parts-1, parts-1) before any allocation or recursion.
 let count=1;for(let k=1;k<parts;k++)count=count*(total+k)/k;
 if(Math.round(count)>MAX_COMBINATIONS)fail(`单层组合数${Math.round(count)}超过固定安全上限${MAX_COMBINATIONS}`);
 const out=[];const walk=(left,n,prefix)=>{if(n===1){out.push([...prefix,left]);return;}for(let i=0;i<=left;i++)walk(left-i,n-1,[...prefix,i]);};walk(total,parts,[]);return out;}
export function dominates(a,b){const keys=[['grossMarginCny',1],['externalN',-1],['waterTotal',-1]];return keys.every(([k,d])=>d*(a[k]-b[k])>=-EPS)&&keys.some(([k,d])=>d*(a[k]-b[k])>EPS);}
function aggregate(input,allocations,menuChecks,annual){
 const T=input.periods.length;const issues=[];const totals={areaHa:0,grossMarginCny:0,externalN:0,externalP:0,nBalance:0,pBalance:0,waterTotal:0,laborTotal:0,productsKg:{grain:0,vegetable:0}};
 const waterBySource=Object.fromEntries(input.waterSources.map(s=>[s.id,Array(T).fill(0)]));const byStratum=[];
 input.strata.forEach((s,si)=>{
  const choices=[];
  allocations[si].forEach((count,mi)=>{if(!count)return;const m=s.menus[mi],check=menuChecks[si][mi];
   choices.push({menuId:m.id,label:m.label,count});
   for(const v of check.issues)issues.push({...v,stratumId:s.id,menuId:m.id,count});
   for(const k of ['grossMarginCny','externalN','externalP','nBalance','pBalance','waterTotal','laborTotal'])totals[k]+=count*check.metrics[k];
   totals.areaHa+=count*m.areaHa;
   for(const p of ['grain','vegetable'])totals.productsKg[p]+=count*m.productsKg[p];
   m.waterM3.forEach((v,t)=>waterBySource[s.waterSourceId][t]+=count*v);
  });byStratum.push({stratumId:s.id,label:s.label,waterSourceId:s.waterSourceId,choices});
 });
 for(const source of input.waterSources){const amounts=waterBySource[source.id];if(annual)upper(issues,'regional',`shared-water:${source.id}`,sum(amounts),sum(source.capacity),'m³');else input.periods.forEach((p,t)=>upper(issues,'regional',`shared-water:${source.id}`,amounts[t],source.capacity[t],'m³',p));}
 upper(issues,'regional','external-N-scenario-cap',totals.externalN,input.constraints.maxExternalN,'kg N');upper(issues,'regional','external-P-scenario-cap',totals.externalP,input.constraints.maxExternalP,'kg P');
 for(const p of ['grain','vegetable'])lower(issues,`product:${p}`,totals.productsKg[p],input.constraints.minProductsKg[p],'kg');
 return {id:allocations.map(a=>a.join('-')).join('|'),allocations,byStratum,totals,waterBySource,feasible:issues.length===0,issues};
}
export function run(input,options={}){
 if(!options||typeof options!=='object'||Array.isArray(options))fail('run options必须是对象');
 const {annual=false,maxCombinations=MAX_COMBINATIONS}=options;
 if(typeof annual!=='boolean')fail('annual必须是布尔值');
 if(!Number.isSafeInteger(maxCombinations)||maxCombinations<1||maxCombinations>MAX_COMBINATIONS)fail(`maxCombinations必须是1–${MAX_COMBINATIONS}的有限正整数，不能扩大固定安全上限`);
 validateInput(input);
 const choices=input.strata.map(s=>compositions(s.count,s.menus.length));
 const total=choices.reduce((n,c)=>n*c.length,1);if(total>maxCombinations)fail(`组合数${total}超过小案例上限${maxCombinations}；不能将此全枚举扩成海南地块优化`);
 const menuChecks=input.strata.map(s=>s.menus.map(m=>evaluateMenu(s,m,input.periods,{annual})));
 const results=[];const walk=(i,a)=>{if(i===choices.length){results.push(aggregate(input,a,menuChecks,annual));return;}for(const c of choices[i])walk(i+1,[...a,c]);};walk(0,[]);
 const feasible=results.filter(x=>x.feasible);const frontier=feasible.filter(a=>!feasible.some(b=>dominates(b.totals,a.totals))).sort((a,b)=>b.totals.grossMarginCny-a.totals.grossMarginCny||a.id.localeCompare(b.id));
 const issueCounts={};results.filter(x=>!x.feasible).forEach(x=>{for(const key of new Set(x.issues.map(v=>`${v.level}:${v.key}`)))issueCounts[key]=(issueCounts[key]||0)+1;});
 return {engineVersion:ENGINE_VERSION,evidence:'synthetic',scope:'假设经营单元组合；不是海南总体预测',mode:annual?'annual-diagnostic':'period-specific',menuChecks,
  search:{method:'complete enumeration of finite menu-count compositions',complete:true,total,evaluated:results.length,feasible:feasible.length,frontier:frontier.length},
  results,frontier,issueCounts,inferenceGate:{allowed:false,reason:'无海南经营记录、地理绑定、覆盖权重和独立验证；即使数值放大也不能省域推断'},
  scientificValidation:{software:'requires test record for exact release',empirical:'not calibrated or independently validated',social:'not measured',adaptation:'not implemented; fixed menu combinations only'}};
}
export function compareTemporal(input){const annual=run(input,{annual:true}),period=run(input);const periodById=new Map(period.results.map(x=>[x.id,x]));return {annual,period,annualFalseFeasible:annual.results.filter(x=>x.feasible&&!periodById.get(x.id).feasible).map(x=>({id:x.id,issues:periodById.get(x.id).issues}))};}
export function makeRecord(input,result,{label='',build=null}={}){return {schema:'FarmSystemDesign.HainanRun',schemaVersion:1,createdAt:new Date().toISOString(),label,engineVersion:ENGINE_VERSION,build,input:structuredClone(input),result:structuredClone(result),boundary:'Synthetic mechanism test; no empirical provincial inference. Complete enumeration checks search only.'};}
export function inputFromRecord(record){if(record?.schema!=='FarmSystemDesign.HainanRun'||record.schemaVersion!==1)fail('非本版本运行记录');validateInput(record.input);return structuredClone(record.input);}
