/** The live DOM controller. Node tests execute this exact module through app.js. */
import {prepareDatedChange,syntheticTemplate} from './dated-contract.js';
import {canonicalJSON,sha256,IMPORT_LIMIT_BYTES} from './recovery.js';
import {datedErrorSource} from './dated-errors.js';
import {preserveText} from './i18n.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function attachDatedUI({$,getState,invalidate,commit,remove,stratumLabel,menuLabel,periodLabel}){
 let pending=null,preview=null;
 const clear=()=>{pending=null;preview=null;$('#dated-confirm').checked=false;$('#dated-remove-confirm').checked=false;$('#dated-apply').disabled=true;$('#dated-preview').disabled=false;$('#dated-preview-output').innerHTML='';$('#dated-status').textContent='日期合同尚未预览';};
 const selected=()=>({stratumId:$('#dated-stratum').value,menuId:$('#dated-menu').value});
 function refresh(){
  const state=getState(),selection=selected();
  $('#dated-stratum').innerHTML=state.input.strata.map(s=>`<option value="${esc(s.id)}">${esc(preserveText(s.id))} · ${esc(stratumLabel(s.label,s.id))}</option>`).join('');
  $('#dated-stratum').value=state.input.strata.some(s=>s.id===selection.stratumId)?selection.stratumId:state.input.strata[0].id;
  refreshMenus(selection.menuId);loadAttached();$('#dated-count').textContent=`已关联菜单数量：${state.records.length}`;
 }
 function refreshMenus(preferred){const s=getState().input.strata.find(s=>s.id===$('#dated-stratum').value);$('#dated-menu').innerHTML=s.menus.map(m=>`<option value="${esc(m.id)}">${esc(preserveText(m.id))} · ${esc(menuLabel(m.label,m.id))}</option>`).join('');$('#dated-menu').value=s.menus.some(m=>m.id===preferred)?preferred:s.menus[0].id;}
 function loadAttached(){const {stratumId,menuId}=selected(),r=getState().records.find(r=>r.stratumId===stratumId&&r.menuId===menuId);$('#dated-json').value=r?JSON.stringify(r.source,null,2):'';}
 function changed(){invalidate();}
 const current=op=>pending===op&&op.revision===getState().revision&&op.stratumId===$('#dated-stratum').value&&op.menuId===$('#dated-menu').value&&op.text===$('#dated-json').value;
 const fail=e=>{$('#dated-status').textContent=datedErrorSource(e);};
 $('#dated-stratum').addEventListener('change',()=>{changed();refreshMenus();loadAttached();});
 $('#dated-menu').addEventListener('change',()=>{changed();loadAttached();});
 $('#dated-json').addEventListener('input',changed);
 $('#dated-example').addEventListener('click',()=>{changed();try{const {stratumId,menuId}=selected();$('#dated-json').value=JSON.stringify(syntheticTemplate(getState().input,stratumId,menuId,getState().records),null,2);$('#dated-status').textContent='合成样例已生成；日期人为指定，请核对覆盖声明';}catch(e){fail(e);}});
 $('#dated-file').addEventListener('change',async e=>{
  changed();const file=e.target.files[0];e.target.value='';const op={revision:getState().revision,...selected(),text:$('#dated-json').value};pending=op;
  try{if(!file)return;if(file.size>IMPORT_LIMIT_BYTES)throw Error('日期文件超过5 MiB；读取前拒绝');const text=await file.text();if(!current(op))return;$('#dated-json').value=text;$('#dated-status').textContent='已载入原始日期 JSON；请验证并预览';}
  catch(e){if(current(op))fail(e);}finally{if(pending===op)pending=null;}
 });
 $('#dated-preview').addEventListener('click',async()=>{
  if(pending?.kind==='preview'&&current(pending))return;
  changed();const state=getState(),op={kind:'preview',revision:state.revision,...selected(),text:$('#dated-json').value};pending=op;
  try{
   $('#dated-preview').disabled=true;$('#dated-status').textContent='正在验证日期合同与内容摘要';
   const change=prepareDatedChange(state.input,state.records,op.stratumId,op.menuId,JSON.parse(op.text));
   const digest=await sha256(canonicalJSON(change.record.source));if(!current(op))return;
   preview={...op,change,digest};const a=change.record.audit;
   $('#dated-preview-output').innerHTML=`<p>合成标记：${esc(preserveText(a.evidence))} · 数据版本：${esc(preserveText(a.datasetVersion))} · 日期模块版本：${esc(preserveText(a.version))}</p><p>完整覆盖声明：${esc(preserveText(a.coverage))}</p><table><thead><tr><th>半开日期区间</th><th>劳动 h</th><th>水 m3</th></tr></thead><tbody>${a.periodDefinitions.map((p,i)=>`<tr><td>${esc(periodLabel(p.id))}: [${p.start}, ${p.end})</td><td>${a.vectors.laborHours[i]}</td><td>${a.vectors.waterM3[i]}</td></tr>`).join('')}</tbody></table><p>守恒检查通过 · 劳动 h: ${a.totals.laborHours} · 水 m3: ${a.totals.waterM3}</p><p>内容摘要（非可信签名）：${digest}</p><details><summary>原始来源与分配审计</summary><pre>${esc(preserveText(JSON.stringify(a.audit,null,2)))}</pre></details><details><summary>原菜单与数据版本绑定</summary><pre>${esc(preserveText(JSON.stringify(change.record.parentContext,null,2)))}</pre></details>`;
   $('#dated-status').textContent='日期预览已就绪；尚未修改菜单';$('#dated-apply').disabled=false;
  }catch(e){if(current(op))fail(e);}finally{if(pending===op){pending=null;$('#dated-preview').disabled=false;}}
 });
 $('#dated-apply').addEventListener('click',()=>{
  if(!preview||preview.revision!==getState().revision||preview.text!==$('#dated-json').value)return;
  if(!$('#dated-confirm').checked){$('#dated-status').textContent='请先勾选确认，再采用日期向量';return;}
  const ready=preview;try{commit(ready.change);$('#dated-status').textContent='日期事件已采用并按当前模式重算';}catch(e){changed();fail(e);}
 });
 $('#dated-remove').addEventListener('click',()=>{if(!$('#dated-remove-confirm').checked){$('#dated-status').textContent='请先勾选移除确认';return;}const {stratumId,menuId}=selected();if(!getState().records.some(r=>r.stratumId===stratumId&&r.menuId===menuId)){$('#dated-status').textContent='当前菜单没有日期关联';return;}remove(stratumId,menuId);$('#dated-status').textContent='已显式移除日期关联；现有资源向量保留';});
 const cancel=()=>{changed();$('#dated-status').textContent='当前日期操作已取消';};
 $('#dated-cancel').addEventListener('click',cancel);
 $('#dated-file').addEventListener('cancel',()=>{$('#dated-file').value='';cancel();});
 $('#dated-close').addEventListener('click',()=>{$('#dated-panel').open=false;cancel();});
 $('#dated-panel').addEventListener('toggle',()=>{if(!$('#dated-panel').open)cancel();});
 return {invalidate:clear,refresh};
}
