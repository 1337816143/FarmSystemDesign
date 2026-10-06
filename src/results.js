import {hash} from './data.js';
import {esc} from './utils.js';
import {english} from './i18n.js';

// This limit belongs to the view only. Never use the page as a search/export/save source.
export const CANDIDATES_PER_PAGE=36;
export function candidatePage(candidates,index=0){
  const pageCount=Math.max(1,Math.ceil(candidates.length/CANDIDATES_PER_PAGE));
  const page=Math.max(0,Math.min(pageCount-1,Number.isFinite(index)?Math.trunc(index):0));
  const offset=page*CANDIDATES_PER_PAGE;
  return {page,pageCount,offset,total:candidates.length,candidates:candidates.slice(offset,offset+CANDIDATES_PER_PAGE)};
}
export function selectedPage(candidates,id){
  return Math.floor(Math.max(0,candidates.findIndex(c=>c.id===id))/CANDIDATES_PER_PAGE);
}
export function searchIsStale(result,data,farmIds,config,climate){
  // Preserve the original input hash and config. Ranking preference is not a search input.
  return Boolean(result&&result.inputHash!==hash({data,farmIds,config:{...config,objective:result.config.objective},climate}));
}

/** Explain the retained candidate only; never infer a global infeasibility certificate. */
export function infeasibleDetails(result,language='zh'){
  const candidate=result.bestInfeasible;
  const tx=(zh,en)=>esc(language==='en'?en:language==='both'?`${zh} / ${en}`:zh);
  if(!candidate)return `<p class="notice error" data-i18n-skip>${tx('没有保留候选级诊断，请检查输入。','No candidate-level diagnostic was retained. Check the inputs.')}</p>`;
  const violations=candidate.violations||[];
  const reasonEnglish=value=>{
    const resource=value.match(/^(.*) · (\d+)月(水|劳动)超限 (.+)$/);
    if(resource)return `${resource[1]} · month ${resource[2]}: ${resource[3]==='水'?'water':'labour'} capacity exceeded (rounded shortfall ${resource[4]} ${resource[3]==='水'?'m³':'workdays'})`;
    const messages=[['未达到参与收益底线','income below the participation floor'],['固定活动不允许改变','fixed activity cannot be changed'],['当前模型不支持无投资成本地新建固定活动','new fixed activity requires investment accounting, which is not supported']];
    for(const [zh,en]of messages)if(value.endsWith(`：${zh}`))return `${value.slice(0,-zh.length-1)}: ${en}`;
    return english(value);
  };
  // The same tolerance used by evaluate; display already-computed balances without changing them.
  const excess=(candidate.balances||[]).filter(b=>b.demand>b.capacity+1e-6);
  const number=n=>esc(Number.isFinite(n)?n.toLocaleString(language==='en'?'en-US':'zh-CN',{maximumSignificantDigits:8}):'—');
  const boundary=result.config.mode==='independent'?tx('逐户独立','Each selected farm separately'):
    result.config.mode==='cooperative'?tx('仅所选同组成员共享','Only selected members of the same group share resources'):
    tx('合并所选主体','All selected farms pooled');
  return `<div class="infeasible-details" data-i18n-skip>
    <p class="notice error">${tx('代表候选','Representative candidate')} ${esc(candidate.id)} · ${violations.length} ${tx('项约束未通过','failed constraints')}</p>
    <p class="micro">${tx('这是已检验候选中违反项数最少的一个候选。下列原因只解释该候选；违反项数少不等于资源缺口最小，也不是整个问题无解的证明。','This is one of the tested candidates with the fewest failed constraints. These reasons describe this candidate only; fewer failures do not mean the smallest resource shortfall or prove the whole problem infeasible.')}</p>
    <p class="micro">${tx('本次资源边界','Resource boundary for this run')}: ${boundary}. ${tx('未选主体的配额不参与共享。需求、配额和收益底线仍依赖合成、未校准的假设，缺口不构成实际追加资源建议。','Unselected farms do not contribute capacity. Demand, capacity and income floors still depend on synthetic, uncalibrated assumptions; shortfalls are not recommendations to add real resources.')}</p>
    <details><summary>${tx('查看全部约束原因与逐月资源缺口','Inspect all constraint reasons and monthly resource shortfalls')} (${violations.length})</summary>
      <ol class="infeasible-violations">${violations.map(v=>`<li>${tx(v,reasonEnglish(v))}</li>`).join('')}</ol>
      ${excess.length?`<div class="table-wrap"><table class="infeasible-balances"><caption>${tx('该候选的超限资源余额；缺口 = 需求 − 配额','Over-capacity balances for this candidate; shortfall = demand − capacity')}</caption><thead><tr>${[
        tx('资源边界 ID','Resource boundary ID'),tx('月份','Month'),tx('资源 / 单位','Resource / unit'),tx('需求','Demand'),tx('配额','Capacity'),tx('缺口','Shortfall')
      ].map(label=>`<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${excess.map(b=>`<tr><td>${esc(b.group)}</td><td>${number(b.month)}</td><td>${b.resource==='水'?tx('水 / m³','Water / m³'):tx('劳动 / 工日','Labour / workdays')}</td><td>${number(b.demand)}</td><td>${number(b.capacity)}</td><td>${number(b.demand-b.capacity)}</td></tr>`).join('')}</tbody></table></div>`:''}
    </details>
    <p class="micro">${tx('先核查所选主体、月份、固定活动与参与收益底线的假设及现实权限，再调整情景。','Check selected farms, months, fixed activities, income-floor assumptions and actual decision rights before changing the scenario.')}</p>
  </div>`;
}
