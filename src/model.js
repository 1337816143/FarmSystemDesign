/** Auditable screening model. All production coefficients are synthetic and uncalibrated. */
import {CROPS,ANNUALS,MODEL_VERSION,baselineAllocation,climateForQuarter,rng,hash} from './data.js';
const sum=a=>a.reduce((s,n)=>s+n,0);
const eps=1e-6;
export function validateConfig(c){
  const checks=[['water',0,2],['labour',0,2],['rain',0,2],['price',0,2],['shock',0,1],['minIncomeRatio',0,1]];
  if(!['independent','cooperative','centralized'].includes(c.mode))throw new Error('Invalid decision mode');
  if(!Number.isInteger(c.quarter)||c.quarter<0||c.quarter>3)throw new Error('Invalid quarter');
  for(const [k,a,b] of checks)if(!Number.isFinite(c[k])||c[k]<a||c[k]>b)throw new Error(`Invalid ${k}`);
}
function distributeManure(rows, mode){
  const groups={};
  for(const r of rows){const key=mode==='independent'?r.id:mode==='cooperative'?r.villageId:'region';(groups[key]??=[]).push(r);}
  const transfers=[];
  for(const group of Object.values(groups)){
    // Each farm first retains its own recoverable manure. Cross-boundary transfers are explicit.
    for(const r of group){r.manureApplied=Math.min(r.manureRecovered,r.nNeed/.45);r.manureRemaining=r.manureRecovered-r.manureApplied;}
    for(const receiver of group){
      let need=Math.max(0,receiver.nNeed/.45-receiver.manureApplied);
      for(const donor of group){if(donor.id===receiver.id||need<=eps)continue;const n=Math.min(need,donor.manureRemaining);if(n<=eps)continue;
        donor.manureRemaining-=n;receiver.manureApplied+=n;need-=n;
        receiver.transferCost+=n*2;
        transfers.push({from:donor.id,to:receiver.id,resource:'回收粪肥氮',quantity:n,unit:'kg N'});
      }
    }
  }
  return transfers;
}
export function evaluate(data, farmIds, allocation, config, climate, participationBase=null){
  validateConfig(config);
  const selected=new Set(farmIds),farms=data.farms.filter(f=>selected.has(f.id));
  if(!farms.length)throw new Error('请选择至少一个经营主体');
  const plots=data.plots.filter(p=>selected.has(p.farmId)),rain=climateForQuarter(climate,config.quarter);
  const warnings=[];if(rain.some(x=>x===null))warnings.push('部分公开气候缺失：缺失月份按0 mm降雨进行保守需求核算，不代表真实天气。');
  const rows=farms.map(f=>({id:f.id,name:f.name,villageId:f.villageId,area:0,revenue:f.poultry*28,cost:f.poultry*16,waterMonths:[0,0,0],labourMonths:[0,0,0],waterCapacity:f.water.map(v=>v*config.water),labourCapacity:f.labour.map(v=>v*config.labour),nNeed:0,nFix:0,nHarvest:f.poultry*.12,nFeed:f.poultry*.4,manureProduced:f.poultry*.22,manureRecovered:f.poultry*.22*.65,manureApplied:0,transferCost:0,energy:f.poultry*.008,production:[],crops:new Set()}));
  const byId=Object.fromEntries(rows.map(r=>[r.id,r])),plotResults=[];
  const violations=[];
  for(const p of plots){
    const activity=allocation[p.id];if(!CROPS[activity])throw new Error(`地块 ${p.id} 的方案缺失或无效`);
    if((p.locked||!CROPS[p.crop].annual)&&activity!==p.crop)violations.push(`${p.id}：固定活动不允许改变`);
    const c=CROPS[activity],r=byId[p.farmId],a=p.areaHa,s=p.soilFactor,stress=Math.max(.35,1-config.shock*c.risk*2);
    const yieldFactor=s*stress,priceFactor=activity==='vegetable'?config.price:1;
    const waterMonths=c.waterCurve.map((w,m)=>Math.max(0,c.water*w-(rain[m]??0)*config.rain*10*(activity==='pond'?.15:.35))*a);
    const labourMonths=c.labourCurve.map(w=>c.labour*w*a);
    const revenue=c.revenue*a*yieldFactor*priceFactor,cost=c.cost*a;
    r.area+=a;r.revenue+=revenue;r.cost+=cost;r.nNeed+=c.nNeed*a;r.nFix+=c.nFix*a;r.nHarvest+=c.nHarvest*a*yieldFactor;r.nFeed+=(c.feedN||0)*a;r.energy+=c.energy*a*yieldFactor;r.crops.add(activity);
    for(let m=0;m<3;m++){r.waterMonths[m]+=waterMonths[m];r.labourMonths[m]+=labourMonths[m];}
    plotResults.push({id:p.id,farmId:p.farmId,activity,area:a,revenue,baseCost:cost,water:sum(waterMonths),labour:sum(labourMonths),yieldTonnes:c.yield*a*yieldFactor,energy:c.energy*a*yieldFactor});
  }
  const transfers=distributeManure(rows,config.mode);
  for(const f of farms){const r=byId[f.id];for(let m=0;m<3;m++){r.waterMonths[m]+=f.poultry*.07/3;r.labourMonths[m]+=f.poultry*.04/3;}
    r.chemicalN=Math.max(0,r.nNeed-r.manureApplied*.45);
    r.water=sum(r.waterMonths);r.labour=sum(r.labourMonths);
    r.cost+=r.chemicalN*8+r.water*.35+r.labour*100+r.transferCost;
    r.margin=r.revenue-r.cost;
    r.nInput=r.chemicalN+r.nFeed+r.nFix;r.nOutput=r.nHarvest;r.nSurplus=r.nInput-r.nOutput;
    r.crops=[...r.crops];
    if(r.nSurplus<0)warnings.push(`${r.id} 氮收支为负，可能涉及土壤存量消耗或参数不一致，不解释为零环境负担。`);
    if(participationBase&&config.minIncomeRatio>0){const b=participationBase.find(x=>x.id===r.id)?.margin;
      // Negative baseline cannot be multiplied directly: use maximum allowed deterioration.
      const floor=b-(1-config.minIncomeRatio)*Math.abs(b||0);
      if(Number.isFinite(b)&&r.margin<floor-eps)violations.push(`${r.id}：未达到参与收益底线`);
    }
  }
  const groups={};for(const r of rows){const key=config.mode==='independent'?r.id:config.mode==='cooperative'?r.villageId:'region';(groups[key]??=[]).push(r);}
  const balances=[];
  for(const [key,group]of Object.entries(groups))for(let m=0;m<3;m++)for(const [resource,need,cap]of [['水','waterMonths','waterCapacity'],['劳动','labourMonths','labourCapacity']]){
    const demand=sum(group.map(r=>r[need][m])),supply=sum(group.map(r=>r[cap][m]));
    balances.push({group:key,month:config.quarter*3+m+1,resource,demand,capacity:supply});
    if(demand>supply+eps)violations.push(`${key} · ${config.quarter*3+m+1}月${resource}超限 ${Math.round(demand-supply)}`);
  }
  const totals={};for(const k of ['area','revenue','cost','margin','water','labour','chemicalN','nInput','nOutput','nSurplus','manureProduced','manureRecovered','manureApplied','energy'])totals[k]=sum(rows.map(r=>r[k]));
  totals.waterCapacity=sum(rows.map(r=>sum(r.waterCapacity)));totals.labourCapacity=sum(rows.map(r=>sum(r.labourCapacity)));
  const allCrops=new Set(plotResults.map(p=>p.activity));totals.diversity=allCrops.size;
  const outsideFarms=data.farms.filter(f=>!selected.has(f.id));
  return {modelVersion:MODEL_VERSION,allocation:{...allocation},totals,farms:rows,plots:plotResults,transfers,balances,feasible:violations.length===0,violations,warnings:[...new Set(warnings)],rainMonths:rain,
    boundary:{farmIds:[...selected],outsideReservedWater:sum(outsideFarms.map(f=>sum(f.water)))*config.water,note:'仅合并所选主体的配额；未选主体的水、劳动和粪肥不参与共享。'},
    sensitivity:{lowMargin:totals.revenue*.8-totals.cost,highMargin:totals.revenue*1.2-totals.cost,label:'仅收入±20%的确定性敏感性区间，不是置信区间'},
    fingerprint:hash({data,config,climate,allocation,farmIds})};
}
export function dominates(a,b){
  const x=a.totals,y=b.totals;
  return x.margin>=y.margin-eps&&x.water<=y.water+eps&&Math.abs(x.nSurplus)<=Math.abs(y.nSurplus)+eps&&x.energy>=y.energy-eps&&x.labour<=y.labour+eps&&
    (x.margin>y.margin+eps||x.water<y.water-eps||Math.abs(x.nSurplus)<Math.abs(y.nSurplus)-eps||x.energy>y.energy+eps||x.labour<y.labour-eps);
}
export function search(data,farmIds,config,climate,onProgress=()=>{}){
  validateConfig(config);const selected=new Set(farmIds),plots=data.plots.filter(p=>selected.has(p.farmId)),variable=plots.filter(p=>!p.locked&&CROPS[p.crop].annual);
  const baseAllocation=baselineAllocation(plots),baseline=evaluate(data,farmIds,baseAllocation,config,climate),rand=rng(config.seed),seen=new Set(),candidates=[];
  let bestInfeasible=null;const add=allocation=>{
    const key=plots.map(p=>allocation[p.id]).join('|');if(seen.has(key))return;seen.add(key);
    const result=evaluate(data,farmIds,allocation,config,climate,baseline.farms);result.id=`candidate-${seen.size}`;
    if(result.feasible)candidates.push(result);else if(!bestInfeasible||result.violations.length<bestInfeasible.violations.length)bestInfeasible=result;
  };
  add(baseAllocation);for(const activity of ANNUALS)add({...baseAllocation,...Object.fromEntries(variable.map(p=>[p.id,activity]))});
  let exact=variable.length<=5;
  if(exact){const a={...baseAllocation};function visit(i){if(i===variable.length){add({...a});return;}for(const c of ANNUALS){a[variable[i].id]=c;visit(i+1);}}visit(0);}
  else{
    for(const p of variable)for(const c of ANNUALS)add({...baseAllocation,[p.id]:c});
    const limit=Math.max(100,Math.min(6000,config.samples||1600));
    for(let i=0;i<limit;i++){
      const weights=ANNUALS.map(()=>rand()**2+.03),ws=sum(weights),a={...baseAllocation};
      for(const p of variable){let n=rand()*ws;for(let j=0;j<ANNUALS.length;j++){n-=weights[j];if(n<=0||j===ANNUALS.length-1){a[p.id]=ANNUALS[j];break;}}}
      add(a);if(i%200===0)onProgress(Math.round(i/limit*75));
    }
    // Local neighbourhood improvement of feasible starts (still no global-optimum claim).
    const starts=candidates.slice().sort((a,b)=>b.totals.margin-a.totals.margin).slice(0,3);
    for(const start of starts){let current=start;for(let pass=0;pass<2;pass++)for(const p of variable)for(const c of ANNUALS){const a={...current.allocation,[p.id]:c},before=candidates.length;add(a);const next=candidates.length>before?candidates.at(-1):null;if(next&&next.totals.margin>current.totals.margin)current=next;}}
  }
  onProgress(85);
  const fronts=[];for(const a of candidates){if(fronts.some(b=>dominates(b,a)))continue;for(let i=fronts.length-1;i>=0;i--)if(dominates(a,fronts[i]))fronts.splice(i,1);fronts.push(a);}
  const range={};for(const key of ['margin','water','nSurplus','energy']){const vs=candidates.map(c=>key==='nSurplus'?Math.abs(c.totals[key]):c.totals[key]);range[key]=[Math.min(...vs),Math.max(...vs)];}
  const norm=(c,k,lower=false)=>{const [lo,hi]=range[k],v=k==='nSurplus'?Math.abs(c.totals[k]):c.totals[k];const n=hi-lo>eps?(v-lo)/(hi-lo):.5;return lower?1-n:n;};
  for(const c of fronts){const m=norm(c,'margin'),w=norm(c,'water',true),n=norm(c,'nSurplus',true),e=norm(c,'energy');c.score=config.objective==='income'?m:config.objective==='water'?w:config.objective==='environment'?n:config.objective==='food'?e:.45*m+.2*w+.15*n+.2*e;}
  fronts.sort((a,b)=>b.score-a.score);
  onProgress(100);
  return {modelVersion:MODEL_VERSION,createdAt:new Date().toISOString(),config:{...config},farmIds:[...farmIds],baseline,candidates:fronts.slice(0,36),frontierCount:fronts.length,evaluated:seen.size,feasibleCount:candidates.length,exact,bestInfeasible:!candidates.length?bestInfeasible:null,
    method:exact?'小问题完整枚举（仅限当前离散候选集）':'固定种子随机候选 + 局部邻域搜索；非全局最优',
    inputHash:hash({data,farmIds,config,climate}),dataVersion:data.version,climateRetrievedAt:climate?.retrievedAt||null};
}
