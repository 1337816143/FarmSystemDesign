import {METRIC_CONTRACTS,EVIDENCE_REFS} from './metric-contracts.js';
import {esc} from './utils.js';

const text=(language,zh,en)=>language==='en'?en:language==='both'?`${zh} / ${en}`:zh;
const localized=(value,language)=>typeof value==='string'?value:text(language,value?.zh||'',value?.en||'');
const digest=value=>/^[a-f0-9]{64}$/.test(value||'')?value:'—';

function evidenceMarkup(ref,language){
  const kinds={'executed-code':text(language,'当前执行代码','Current executed code'),definition:text(language,'当前定义','Current definition'),background:text(language,'论文背景 · 未采用','Paper background · not adopted')};
  const link=ref.url&&/^https:\/\/(1337816143\.github\.io|github\.com)\//.test(ref.url)?`<a href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer">${esc(text(language,'查看依据','Open evidence'))} ↗</a>`:'';
  return `<p><strong>${esc(localized(ref.title,language))}</strong><br>${esc(kinds[ref.kind]||ref.kind)} · ${link}<br><small>${esc(localized(ref.summary,language))}</small><br><small>${esc(language==='en'?(ref.locatorEn||ref.locator||''):language==='both'&&ref.locatorEn?`${ref.locator} / ${ref.locatorEn}`:ref.locator||'')}</small></p>`;
}

export function metricContractsMarkup(language){
  return `<div class="metric-contracts" data-i18n-skip><p class="note-block">${esc(text(language,'五项指标均为 D 级：已实现的简化筛选，系数是假设值，尚未校准。论文证据用于解释差异，没有把论文参数接入计算。','All five metrics are grade D: implemented simplified screening with synthetic, uncalibrated coefficients. Paper evidence explains differences; its parameters are not used by the calculation.'))}</p>${METRIC_CONTRACTS.map(contract=>`<article class="metric-contract" data-metric="${esc(contract.field)}"><h3>${esc(localized(contract.label,language))} <small>${esc(contract.unit.symbol)}</small></h3><p>${esc(localized(contract.definition,language))}</p><p><strong>${esc(text(language,'统计边界','Accounting boundary'))}</strong> · ${esc(localized(contract.boundary,language))}</p><p>${esc(text(language,'所选主体合计 · 三个月独立窗口 · 系数直接用于窗口，不按年度除以四','Total for selected actors · independent three-month window · coefficients apply directly to the window, without annual division by four'))}</p><p>${esc(localized(contract.ranking.summary,language))}</p><ul>${[...contract.exclusions,...contract.missingHandling].map(row=>`<li>${esc(localized(row,language))}</li>`).join('')}</ul><details><summary>${esc(text(language,'定义、执行与背景证据','Definition, execution and background evidence'))}</summary>${contract.evidenceRefs.map(id=>EVIDENCE_REFS.find(row=>row.id===id)).filter(Boolean).map(ref=>evidenceMarkup(ref,language)).join('')}</details></article>`).join('')}<p class="micro">${esc(text(language,'工日没有已核定的小时换算；每公顷、每年与窗口总量不能直接混用。地理位置和季度标签不代表已实现空间或跨期状态模型。','No verified hours-per-workday conversion is defined. Per-hectare, annual and window totals are not interchangeable. Locations and quarter labels do not imply a spatial or dynamic multi-period model.'))}</p></div>`;
}

export function frozenRecordSummary(record,language,{saved=false}={}){
  const frozen=record?.frozenRun;
  if(!frozen)return text(language,'历史快照：参数来源链未完整记录','Historical snapshot: parameter provenance was not fully recorded');
  if(saved)return text(language,'已保存来源记录 · 可检查内容摘要','Saved provenance record · content digests can be checked');
  return frozen.captureStatus==='complete-record'
    ?text(language,'运行记录完整 · 声明的构建身份一致','Run record complete · declared build identity is consistent')
    :text(language,'运行记录不完整 · 计算结果仍可查看和导出','Run record incomplete · numerical results remain available to view and export');
}

export function frozenRecordMarkup(record,language,{saved=false}={}){
  const frozen=record?.frozenRun;
  const head=`<p class="note-block">${esc(frozenRecordSummary(record,language,{saved}))}</p>`;
  if(!frozen)return `<div data-i18n-skip>${head}<p>${esc(text(language,'保持历史记录原样，没有补入当前系数或版本。','The historical record is preserved without adding current coefficients or version information.'))}</p></div>`;
  const metadata=frozen.releaseState?.metadata,commit=metadata?.commit;
  const commitLink=/^[a-f0-9]{40}$/.test(commit||'')?`<a href="https://github.com/1337816143/FarmSystemDesign/tree/${commit}" target="_blank" rel="noopener noreferrer">${commit}</a>`:esc(commit==='local-preview'?text(language,'本地预览','Local preview'):text(language,'未取得一致的发布身份','Consistent release identity unavailable'));
  return `<div class="frozen-record" data-i18n-skip>${head}<p>${esc(text(language,'摘要核对内容是否相同；它不是签名、执行字节认证或科学有效性证明。模型仍为未校准的简化筛选。','Digests compare content identity. They are not signatures, executing-byte attestations or proof of scientific validity. The model remains uncalibrated simplified screening.'))}</p><dl class="evidence-dl spacious"><div><dt>${esc(text(language,'记录范围','Record scope'))}</dt><dd>${esc(frozen.scope||'—')}</dd></div><div><dt>${esc(text(language,'构建来源','Build source'))}</dt><dd class="mono hash-cell">${commitLink}</dd></div>${Object.entries(frozen.digests||{}).map(([key,value])=>`<div><dt>${esc(key)} SHA256</dt><dd class="mono hash-cell">${digest(value)}</dd></div>`).join('')}</dl>${Array.isArray(frozen.captureIssues)&&frozen.captureIssues.length?`<p>${esc(text(language,'未完成项','Incomplete items'))}: ${esc(frozen.captureIssues.join(', '))}</p>`:''}<p>${esc(text(language,'旧 inputHash / fingerprint 仅为输入变更标记。排序视图独立于计算摘要；解释材料另存摘要。','Legacy inputHash / fingerprint values remain input-change markers. Ranking views are separate from the computational digest; explanatory material has its own digest.'))}</p>${saved?`<p>${esc(text(language,'本快照只保留所选方案和基准。父运行摘要只是来源引用，不证明已重新核验完整前沿。','This snapshot retains only the selected candidate and baseline. The parent-run digest is a provenance reference, not proof of rechecking the complete frontier.'))}</p>`:''}<details><summary>${esc(text(language,'本次实际参数快照','Actual parameter snapshot for this run'))}</summary><pre>${esc(JSON.stringify(frozen.parameters||null,null,2))}</pre></details><details><summary>${esc(text(language,'声明的引擎源文件哈希','Declared engine-source file hashes'))}</summary><pre>${esc(JSON.stringify(frozen.engineIdentity||null,null,2))}</pre></details>${saved?`<p id="frozen-verification" role="status">${esc(text(language,'正在核对保留内容的摘要…','Checking digests of retained content…'))}</p>`:''}</div>`;
}
