import {defaultInput} from './fixture.js';
import {run,compareTemporal,makeRecord,inputFromRecord,validateInput,ENGINE_VERSION} from './engine.js';
import {splitManureByNP} from './np-interface.js';
import {EVIDENCE,COVERAGE} from './research.js';
import {makeInputSnapshot,restoreInputSnapshot,SNAPSHOT_SCHEMA,IMPORT_LIMIT_BYTES,runConfig} from './recovery.js';
import {hasFullCalendarYear,validateDatedBindings,makeDatedRecord,restoreDatedRecord,makeDatedSnapshot,restoreDatedSnapshot} from './dated-contract.js';
import {datedErrorSource} from './dated-errors.js';
import {attachDatedUI} from './dated-ui.js';
import {BUILD} from './build.generated.js';
import {createLocalizedQuery,initializeLanguage,getLanguage,errorSource,preserveText} from './i18n.js';
const $=createLocalizedQuery(document);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=1)=>Number(n).toLocaleString(getLanguage()==='en'?'en-GB':'zh-CN',{maximumFractionDigits:d});
let input=defaultInput(),result=null,selected=null,versions=[],versionCounter=0,dirty=false;
let stateRevision=0,importRequest=0,snapshotPending=null,datedRecords=[],datedUI=null,lastProgrammaticJSON='',mainJSONDraftActive=false;
const invalidatePendingImport=()=>{stateRevision++;snapshotPending=null;datedUI?.invalidate();$('#export-snapshot').disabled=dirty||!result;$('#snapshot-status').textContent='';};
const hasMainJSONDraft=()=>mainJSONDraftActive||$('#json-input').value!==lastProgrammaticJSON;
function showMainJSONDraft(){mainJSONDraftActive=hasMainJSONDraft();const message=mainJSONDraftActive?'未采用JSON草稿已保留；结果与下载只基于已采用输入':'';$('#json-draft-status').textContent=message;$('#json-draft-notice').textContent=message;}
function syncMainJSON(discardDraft=false){
 if(!discardDraft&&hasMainJSONDraft()){showMainJSONDraft();return;}
 mainJSONDraftActive=false;lastProgrammaticJSON=JSON.stringify(input,null,2);$('#json-input').value=lastProgrammaticJSON;showMainJSONDraft();
}
const effectiveConfig=()=>runConfig({annual:$('#mode').value==='annual'});
// Translate a default label only while its fixture identity and complete label agree.
// User data, including punctuation and strings resembling UI terms, is always opaque.
const defaultLabels=defaultInput();
const defaultStrata=new Map(defaultLabels.strata.map(s=>[s.id,s.label]));
const defaultMenus=new Map(defaultLabels.strata.flatMap(s=>s.menus.map(m=>[m.id,m.label])));
const defaultSources=new Map(defaultLabels.waterSources.map(s=>[s.id,s.label]));
const labelText=(label,original)=>label===original?label:preserveText(label);
const stratumText=(label,id)=>labelText(label,defaultStrata.get(id));
const menuText=(label,id)=>labelText(label,defaultMenus.get(id));
const sourceText=(label,id)=>labelText(label,defaultSources.get(id));
const periodText=label=>labelText(label,defaultLabels.periods[input.periods.indexOf(label)]);
const errorText=(error,candidate=input)=>{if(String(error?.message??error).startsWith('Dated '))return datedErrorSource(error);const list=x=>Array.isArray(x)?x:[];return errorSource(error,[...list(candidate?.strata).flatMap(s=>[s?.id,...list(s?.menus).map(m=>m?.id)]),...list(candidate?.waterSources).map(s=>s?.id)].filter(x=>typeof x==='string'&&x.length));};

const keyLabels={'labor':'个体劳动','water-access':'个体可达水量','area':'土地容量','land-class':'土地类别','external-N-scenario-cap':'外部N输入情景上限','external-P-scenario-cap':'外部P输入情景上限','product:grain':'粮食产出底线','product:vegetable':'蔬菜产出底线'};
const keyName=k=>keyLabels[k]||(k.startsWith('shared-water:')?'共享水源 '+preserveText(k.slice(13)):preserveText(k));
const inputNumber=(label,value,key,attrs='')=>`<label>${esc(label)}<input type="number" min="0" value="${value}" data-input="${esc(key)}" ${attrs}></label>`;
function renderControls(){
 $('#controls').innerHTML=input.strata.map((s,i)=>`<fieldset><legend>${esc(stratumText(s.label,s.id))}</legend>${inputNumber('假设经营单元数量',s.count,`strata.${i}.count`,'max="8" step="1"')}<div class="input-grid">${s.laborCapacity.map((n,t)=>inputNumber(`${periodText(input.periods[t])}劳动 / 单元（h）`,n,`strata.${i}.laborCapacity.${t}`)).join('')}</div><label>可达水源<select data-input="strata.${i}.waterSourceId">${input.waterSources.map(w=>`<option value="${esc(w.id)}" ${s.waterSourceId===w.id?'selected':''}>${esc(sourceText(w.label,w.id))}</option>`).join('')}</select></label></fieldset>`).join('')+
 input.waterSources.map((s,i)=>`<fieldset><legend>${esc(sourceText(s.label,s.id))} · 总容量</legend><div class="input-grid">${s.capacity.map((n,t)=>inputNumber(`${periodText(input.periods[t])}（m³）`,n,`waterSources.${i}.capacity.${t}`)).join('')}</div></fieldset>`).join('')+
 `<fieldset><legend>显式情景底线 / 上限</legend><div class="input-grid">${inputNumber('粮食底线（kg）',input.constraints.minProductsKg.grain,'constraints.minProductsKg.grain')}${inputNumber('蔬菜底线（kg）',input.constraints.minProductsKg.vegetable,'constraints.minProductsKg.vegetable')}${inputNumber('外部N上限（kg）',input.constraints.maxExternalN,'constraints.maxExternalN')}${inputNumber('外部P上限（kg 元素P）',input.constraints.maxExternalP,'constraints.maxExternalP')}</div></fieldset>`;
 syncMainJSON();datedUI?.refresh();
}
function setPath(object,path,value){let at=object;const keys=path.split('.');for(const key of keys.slice(0,-1))at=at[key];at[keys.at(-1)]=value;}
function markDirty(){invalidatePendingImport();dirty=true;$('#status').textContent='输入已修改，下面结果尚未重算。请运行全部组合';$('#results').classList.add('stale');$('#save-run').disabled=true;$('#export-run').disabled=true;$('#export-snapshot').disabled=true;}
$('#controls').addEventListener('input',e=>{if(!e.target.dataset.input)return;const value=e.target.tagName==='SELECT'?e.target.value:(e.target.value.trim()===''?null:Number(e.target.value));setPath(input,e.target.dataset.input,value);syncMainJSON();markDirty();});
$('#mode').addEventListener('change',markDirty);
function error(message){invalidatePendingImport();$('#status').textContent=message;$('#status').className='error';$('#results').classList.add('stale');dirty=true;$('#save-run').disabled=true;$('#export-run').disabled=true;$('#export-snapshot').disabled=true;}
function execute(){invalidatePendingImport();try{validateDatedBindings(input,datedRecords);result=run(input,effectiveConfig());selected=result.frontier[0]?.id||result.results[0]?.id;dirty=false;$('#status').className='';$('#results').classList.remove('stale');$('#save-run').disabled=false;$('#export-run').disabled=false;$('#export-snapshot').disabled=false;$('#status').textContent=`已完整核算 ${result.search.evaluated} 个组合；${result.search.feasible} 个满足本模式约束。全部数值仍为合成`;renderResults();renderMenus();syncMainJSON();}catch(e){error(errorText(e));}}
const issueText=v=>`${v.stratumId?`${preserveText(v.stratumId)} / ${preserveText(v.menuId)} · `:''}${keyName(v.key)}${v.period?` · ${periodText(v.period)}`:''}：${typeof v.used==='number'?fmt(v.used):preserveText(v.used)} ${v.unit||''}，${v.direction==='minimum'?'最低':'上限'} ${typeof v.limit==='number'?fmt(v.limit):preserveText(v.limit)}${typeof v.excess==='number'?`，${v.direction==='minimum'?'缺口':'超出'} ${fmt(v.excess)} ${v.unit||''}`:''}`;
function renderResults(){
 $('#dated-horizon').hidden=!datedRecords.length;
 if(datedRecords.length){const p=datedRecords[0].audit.periodDefinitions;$('#dated-horizon').textContent=`日期覆盖区间：${p[0].start} → ${p.at(-1).end}；“年度”引擎模式只汇总所列时段，不推算实际年用量。仍为合成日期资源诊断。`;}

 const comp=compareTemporal(input);const current=selected&&result.results.find(x=>x.id===selected);const feasible=result.results.filter(x=>x.feasible);const best=feasible.length?Math.max(...feasible.map(x=>x.totals.grossMarginCny)):null;
 $('#results').innerHTML=`<div class="stats"><div><span>有限组合 / 已核算</span><b>${result.search.total} / ${result.search.evaluated}</b></div><div><span>本模式可行 / 前沿</span><b>${result.search.feasible} / ${result.search.frontier}</b></div><div><span>可行最高合成毛利</span><b>${best===null?'无可行解':'¥'+fmt(best)}</b></div></div>
 <div class="notice mini"><strong>${hasFullCalendarYear(datedRecords)?'年度总量通过':'所列时段汇总通过'} ${comp.annual.search.feasible} 个；逐期通过 ${comp.period.search.feasible} 个</strong><p>${hasFullCalendarYear(datedRecords)?`其中 ${comp.annualFalseFeasible.length} 个组合被年度平均误判为可行。此为约束分辨率诊断，不是自适应策略效果。`:`其中 ${comp.annualFalseFeasible.length} 个组合被所列时段汇总误判为可行。此为约束分辨率诊断，不是自适应策略效果。`}</p>${$('#mode').value==='annual'?`<b class="warning-text">${hasFullCalendarYear(datedRecords)?'当前显示年度简化结果：允许时期之间虚拟抵消，不能视为逐期可实施。':'当前显示所列时段汇总结果：允许时期之间虚拟抵消，不能视为逐期可实施。'}</b>`:''}</div>
 <div class="card"><h3>可行前沿 <span class="small">毛利 ↑ · 外部N ↓ · 用水 ↓</span></h3><p class="small">只比较同一组完整菜单的实际计算值，不拼接各指标最优。P和产品底线另作约束，社会接受仍未测。</p>${result.frontier.length?scatter(result.frontier):'<p>当前条件下无可行组合。查看拒绝原因，修改明确的情景输入后重算。</p>'}
 <div class="table-wrap"><table><caption>非支配组合；点击查看完整约束</caption><thead><tr><th>组合</th><th>毛利 ¥</th><th>外部 N / P kg</th><th>水 m³</th><th>粮食 / 蔬菜 kg</th></tr></thead><tbody>${result.frontier.map(r=>`<tr class="${r.id===selected?'selected':''}"><td><button class="link" data-result="${esc(r.id)}">${esc(r.id)}</button></td><td>${fmt(r.totals.grossMarginCny)}</td><td>${fmt(r.totals.externalN)} / ${fmt(r.totals.externalP)}</td><td>${fmt(r.totals.waterTotal)}</td><td>${fmt(r.totals.productsKg.grain)} / ${fmt(r.totals.productsKg.vegetable)}</td></tr>`).join('')}</tbody></table></div></div>
 <div class="card"><h3>约束解释与完整组合检查</h3><label>查看一个组合<select id="select-result">${result.results.map(r=>`<option value="${esc(r.id)}" ${r.id===selected?'selected':''}>${esc(r.id)} · ${r.feasible?'本模式可行':'违例 '+r.issues.length+'项'} · 毛利 ${fmt(r.totals.grossMarginCny)}</option>`).join('')}</select></label><div id="selection-detail">${current?selectionHtml(current):''}</div></div>
 <details><summary>为什么其他组合被拒绝</summary><ul>${Object.entries(result.issueCounts).map(([k,n])=>`<li>${esc(preserveText(k))}：${n} 个组合包含此类违例</li>`).join('')||'<li>无拒绝组合</li>'}</ul><p class="small">同一组合可同时违反多个约束，原因计数不可相加当组合数。</p></details>
 <div class="gate"><b>海南总体推断关口：关闭</b><p>${esc(result.inferenceGate.reason)}</p></div>`;
 $('#select-result').addEventListener('change',e=>{selected=e.target.value;renderResults();});
}
function scatter(front){const width=580,height=240,pad=44;const minN=Math.min(...front.map(x=>x.totals.externalN)),maxN=Math.max(...front.map(x=>x.totals.externalN)),minM=Math.min(...front.map(x=>x.totals.grossMarginCny)),maxM=Math.max(...front.map(x=>x.totals.grossMarginCny));const x=n=>pad+(n-minN)/(maxN-minN||1)*(width-pad*2),y=m=>height-pad-(m-minM)/(maxM-minM||1)*(height-pad*2);return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="可行前沿：横轴外部N，纵轴合成毛利；具体值见下表"><path d="M ${pad} 15 V ${height-pad} H ${width-15}" fill="none" stroke="#83998e"/><text x="5" y="18">毛利 ¥</text><text x="${width-pad}" y="${height-10}" text-anchor="end">外部N kg →</text><text x="${pad}" y="${height-25}">${fmt(minN)}</text><text x="${width-pad-30}" y="${height-25}">${fmt(maxN)}</text>${front.map(r=>`<circle cx="${x(r.totals.externalN)}" cy="${y(r.totals.grossMarginCny)}" r="${r.id===selected?8:6}" fill="${r.id===selected?'#bf642b':'#247a60'}"><title>${esc(r.id)}；N${fmt(r.totals.externalN)}；毛利${fmt(r.totals.grossMarginCny)}；水${fmt(r.totals.waterTotal)}</title></circle>`).join('')}</svg>`;}
function selectionHtml(r){return `<div class="menu-grid">${r.byStratum.map(s=>`<div><b>${esc(stratumText(s.label,s.stratumId))}</b><p>${s.choices.map(c=>`${esc(menuText(c.label,c.menuId))} × ${c.count}`).join('<br>')}</p><span class="small">水源 ${esc(preserveText(s.waterSourceId))}</span></div>`).join('')}</div><h4>逐期共享水源</h4>${input.waterSources.map(s=>`<div class="water-row"><b>${esc(sourceText(s.label,s.id))}</b>${input.periods.map((p,t)=>{const used=r.waterBySource[s.id][t],cap=s.capacity[t];return `<div><span>${esc(periodText(p))}：${fmt(used)} / ${fmt(cap)} m³</span><div class="bar"><i class="${used>cap?'over':''}" style="width:${cap>0?Math.min(100,used/cap*100):used?100:0}%"></i></div></div>`;}).join('')}</div>`).join('')}<p><strong>${r.feasible?'本模式下可行':'本模式下不可行'}</strong> · 简化作物输入减收获移出：N ${fmt(r.totals.nBalance)} kg，P ${fmt(r.totals.pBalance)} kg。不是损失或完整土壤平衡。</p><ul class="issues">${r.issues.map(v=>`<li>${esc(issueText(v))}</li>`).join('')||'<li>该模式下所实现的约束均通过。未实现的农学、现金、市场、政策与接受度约束不在此结论中。</li>'}</ul><p class="small">食物供给为产品代理；劳动 ${fmt(r.totals.laborTotal)} h；家庭工与雇工尚未细分。社会接受：未测。固定菜单、无状态更新，未计算适应效益。</p>`;}
$('#results').addEventListener('click',e=>{const button=e.target.closest('[data-result]');if(button){selected=button.dataset.result;renderResults();}});
function renderMenus(){$('#menus').innerHTML=`<table><caption>菜单是按经营单元给定的完整合成方案；并未从真实作物序列生成</caption><thead><tr><th>层 / 菜单</th><th>劳动 h</th><th>水 m³</th><th>毛利 ¥</th><th>N / P 输入 kg</th><th>个体约束</th></tr></thead><tbody>${input.strata.flatMap((s,si)=>s.menus.map((m,mi)=>{const c=result.menuChecks[si][mi];return `<tr><td>${esc(preserveText(s.id))} / ${esc(menuText(m.label,m.id))}</td><td>${m.laborHours.map(v=>fmt(v)).join(' / ')}</td><td>${m.waterM3.map(v=>fmt(v)).join(' / ')}</td><td>${fmt(m.grossMarginCny)}</td><td>${fmt(m.externalN)} / ${fmt(m.externalP)}</td><td>${c.feasible?'本模式通过':c.issues.map(v=>esc(issueText(v))).join('<br>')}</td></tr>`;})).join('')}</tbody></table>`;}
$('#run').addEventListener('click',execute);
$('#reset').addEventListener('click',()=>{invalidatePendingImport();input=defaultInput();datedRecords=[];syncMainJSON(true);$('#mode').value='period';$('#json-status').textContent='';renderControls();execute();});
$('#json-input').addEventListener('input',()=>{invalidatePendingImport();showMainJSONDraft();});
$('#discard-json-draft').addEventListener('click',()=>{invalidatePendingImport();syncMainJSON(true);$('#json-status').textContent='已明确丢弃未采用草稿并显示已采用输入';});
$('#apply-json').addEventListener('click',()=>{invalidatePendingImport();let candidate;try{candidate=JSON.parse($('#json-input').value);validateDatedBindings(candidate,datedRecords);run(candidate,effectiveConfig());input=candidate;syncMainJSON(true);renderControls();execute();$('#json-status').textContent='合同已通过并重新计算（仍仅为合成研究机制例）';}catch(e){$('#json-status').textContent=errorText(e,candidate);showMainJSONDraft();}});
function renderVersions(){$('#versions').innerHTML=versions.map((v,i)=>`<div class="version"><span>v${v.number} · ${esc(v.record.label)} · ${v.record.result.search.feasible}个可行 · ${esc(v.record.createdAt)}</span><button data-restore="${i}">恢复并重算</button></div>`).join('')||'<p class="small">尚无会话版本</p>';}
function currentRecord(){if(dirty||!result)throw new Error('请先重算当前输入');return makeDatedRecord(input,result,datedRecords,{label:$('#mode').value==='annual'?'年度简化诊断':'逐期菜单组合',build:BUILD});}
$('#save-run').addEventListener('click',()=>{try{if(versions.length>=10){error('本会话已保存10个版本。请先下载需要保留的运行记录；不会自动覆盖旧版本');return;}versions.push({number:++versionCounter,record:currentRecord()});renderVersions();}catch(e){error(errorText(e));}});
$('#versions').addEventListener('click',e=>{if(e.target.dataset.restore===undefined)return;const v=versions[Number(e.target.dataset.restore)];invalidatePendingImport();const recovered=restoreDatedRecord(v.record);input=recovered.input;datedRecords=recovered.records;$('#mode').value=recovered.config.annual?'annual':'period';renderControls();execute();});
function downloadRecord(record,kind='audit-archive',pretty=true){const blob=new Blob([JSON.stringify(record,null,pretty?2:undefined)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`hainan-route-b-${kind}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;try{a.click();const timer=setTimeout(()=>URL.revokeObjectURL(url),60000);timer?.unref?.();}catch(e){URL.revokeObjectURL(url);throw new Error('浏览器未能接收下载；请重试并检查下载权限',{cause:e});}}
$('#export-run').addEventListener('click',()=>{try{downloadRecord(currentRecord());$('#snapshot-status').textContent='已准备完整结果归档并交给浏览器下载；请确认本地文件已保存';}catch(e){error(errorText(e));}});
$('#export-snapshot').addEventListener('click',async()=>{
 // Repeated clicks share one preparation per model generation. No stale download is dispatched.
 if(snapshotPending?.revision===stateRevision)return;
 const operation={revision:stateRevision};snapshotPending=operation;
 const isCurrent=()=>snapshotPending===operation&&operation.revision===stateRevision;
 try{
  if(dirty||!result)throw new Error('请先重算当前输入');
  $('#export-snapshot').disabled=true;$('#snapshot-status').textContent='正在准备可恢复输入快照';
  const snapshot=await makeDatedSnapshot(input,result,datedRecords,effectiveConfig(),BUILD);
  if(!isCurrent())return;
  downloadRecord(snapshot,'input-snapshot',false);
  $('#snapshot-status').textContent='可恢复输入快照已准备并交给浏览器下载；请确认本地文件已保存。SHA-256仅核对内容一致性，不是可信签名';
 }catch(err){if(isCurrent())$('#snapshot-status').textContent=errorText(err);}
 finally{if(isCurrent()){snapshotPending=null;$('#export-snapshot').disabled=dirty||!result;}}
});
$('#import-run').addEventListener('cancel',()=>{invalidatePendingImport();importRequest++;$('#import-run').value='';$('#snapshot-status').textContent='已取消文件选择；已采用输入与未采用草稿保留';});
$('#import-run').addEventListener('change',async e=>{
 invalidatePendingImport();const request=++importRequest,revision=stateRevision;
 const isCurrent=()=>request===importRequest&&revision===stateRevision;
 // Capture before clearing the picker. The 5 MiB guard always runs BEFORE File.text().
 const file=e.target.files[0];e.target.value='';let importedInput;
 try{
  if(!file)return;if(file.size>IMPORT_LIMIT_BYTES)throw new Error('运行记录超过5 MB；拒绝导入');
  const text=await file.text();if(!isCurrent())return;
  const record=JSON.parse(text);importedInput=record?.input;
  let candidate,config,recovered,records=[];
  if(record?.schema===SNAPSHOT_SCHEMA){
   recovered=await restoreDatedSnapshot(record,{isCurrent});if(!isCurrent()||!recovered)return;
   candidate=recovered.input;config=recovered.config;records=recovered.records;
  }else{const restored=restoreDatedRecord(record);candidate=restored.input;config=restored.config;records=restored.records;run(candidate,config);}
  if(!isCurrent())return;
  invalidatePendingImport();input=candidate;datedRecords=records;$('#mode').value=config.annual?'annual':'period';renderControls();execute();
  $('#status').textContent+=recovered? '；恢复快照校验通过并已独立重算；原完整审计结果未载入，未采用文件结果值':'；导入输入后已独立重算，未采用文件里保存的结果值';
 }catch(err){if(isCurrent())error(errorText(err,importedInput));}
});
function runNP(){try{const get=id=>{const el=$(id);if(el.value.trim()==='')throw new Error('N/P输入不得为空');return Number(el.value);};const data={nitrogen:get('#np-n'),phosphorus:get('#np-p'),availableNFraction:get('#np-f'),availableNCapacity:get('#np-n-cap'),totalPCapacity:get('#np-p-cap')};const x=splitManureByNP(data);$('#np-result').innerHTML=`<h3>允许接收 ${fmt(x.fraction*100)}% 同一份物料</h3><div class="stats"><div><span>接收</span><b>N ${fmt(x.applied.nitrogen)} / P ${fmt(x.applied.phosphorus)} kg</b></div><div><span>源端保留</span><b>N ${fmt(x.remaining.nitrogen)} / P ${fmt(x.remaining.phosphorus)} kg</b></div></div><p>可利用 N 为 ${fmt(x.availableN)} kg；总 N/P 成分比在两份中保持。剩余物料仍在来源端，未默认为无害处置或污染消失。</p><p class="small">合成手算基准：N40/P20，接收可用N40/P10，最大份额 min(1, 1, 0.5)=0.5，接收N20/P10，保留N20/P10。N可利用比例当前为${fmt(data.availableNFraction,2)}。</p>`;}catch(e){$('#np-result').textContent=errorText(e);}}
$('#run-np').addEventListener('click',runNP);
$('#coverage').textContent=`${COVERAGE.boundary} 当前15组接口证据支持方法设计，所有数值系数独立标作合成。`;
$('#evidence').innerHTML=EVIDENCE.map(r=>`<details><summary>${esc(r.author)} · ${esc(r.title)}</summary><p><a href="${esc(r.url)}" target="_blank" rel="noreferrer noopener">原文来源</a> · ${esc(r.locator)}</p><div class="two"><div><h4>作者的方法</h4><p>输入：${esc(r.inputs)}</p><p>输出：${esc(r.outputs)}</p><p>借鉴：${esc(r.borrow)}</p></div><div><h4>B 的迁移与待检验问题</h4><p>${esc(r.hainan_transformation)}</p><p>待检验：${esc(r.new_test)}</p><p class="warning-text">边界：${esc(r.do_not_copy)}</p></div></div></details>`).join('');
$('#build-line').textContent=`B ${BUILD.version} · ${ENGINE_VERSION} · engine SHA-256 ${BUILD.engineSha256.slice(0,16)}… · 无账号、无远端写入、无外部资源请求`;
if(location.pathname.includes('/route-b/'))$('#existing-a').hidden=false;
datedUI=attachDatedUI({$,getState:()=>({input,records:datedRecords,revision:stateRevision}),invalidate:invalidatePendingImport,
 stratumLabel:stratumText,menuLabel:menuText,periodLabel:periodText,
 commit:change=>{validateDatedBindings(change.input,change.records);run(change.input,effectiveConfig());invalidatePendingImport();input=change.input;datedRecords=change.records;renderControls();execute();},
 remove:(stratumId,menuId)=>{invalidatePendingImport();datedRecords=datedRecords.filter(r=>r.stratumId!==stratumId||r.menuId!==menuId);renderControls();execute();}
});
initializeLanguage(document);
renderControls();renderVersions();execute();runNP();
