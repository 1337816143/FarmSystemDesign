/** Display-only source inventory. A source footprint or sparse sample is never an island census. */
export const COVERAGE_PATH='./data/hainan/regional/coverage/';
export const GROUPS={main:['本岛查询窗','Main-island query'],xisha:['西沙查询窗','Xisha query'],zhongsha:['中沙查询窗','Zhongsha query'],nansha:['南沙查询窗','Nansha query'],'targeted-offshore':['补充离岸查询窗','Supplementary offshore query']};
export function escapeCoverage(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function dateExtent(dates){const valid=[...new Set((dates||[]).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();return valid.length?valid.length===1?valid[0]:`${valid[0]} – ${valid.at(-1)}`:'—';}
export function filterCoverageRows(rows,group='all',term=''){const query=term.trim().toLowerCase();return rows.filter(r=>(group==='all'||r.group===group||r.query_groups?.includes(group))&&(!query||[r.id,r.object_id,r.mgrs,r.name_zh,r.name_en].some(v=>String(v||'').toLowerCase().includes(query))));}
export function coverageStatusText(status,en=false){const labels={
 representative_point_value:['代表点有RGB值且SCL类可接受','Point RGB present; SCL class accepted'],representative_point_quality_rejected:['代表点被质量层排除','Point rejected by SCL'],representative_point_no_value:['代表点无值','Point has no value'],read_failure:['读取失败，未核定','Read failed; unverified'],invalid_geometry:['源几何无效，未取点','Invalid source geometry; no point'],geometry_unavailable:['无有效源几何','No source geometry'],representative_point_unverified:['代表点未核验','Point unverified'],no_indexed_source_at_representative_point:['代表点无已索引源','No indexed source at point'],
 sampled_accepted:['抽样质量类可接受','Sampled SCL accepted'],sampled_quality_rejected:['抽样被云/质量规则排除','Sampled cloud/quality rejection'],sampled_no_source:['抽样无来源值','Sampled no source value'],network_failure:['读取失败，不能判为缺数据','Read failed; availability unknown'],unverified:['未核验','Unverified'],
 sampled_rgb_nonzero_scl_accepted:['RGB小样非零且SCL类可接受','Nonzero RGB sample; SCL class accepted'],sampled_rgb_zero:['RGB小样全零','All-zero RGB sample'],
 sampled_rgb_valid:['RGB抽样非零','Nonzero RGB sample'],sampled_rgb_nodata:['RGB抽样无值','No-value RGB sample'],sampled_rgb_quality_rejected:['RGB有值，质量层排除','RGB present; SCL rejected'],
 available:['有来源值','Source values present'],'coarse-context-only':['仅粗格网背景','Coarse context only'],'unavailable-no-source':['无来源','No source'],'unavailable-no-prediction':['无模型预测','No model prediction'],
 passed:['像元核验通过','Pixels verified'],failed:['核验失败','Verification failed'],
 };if(labels[status])return labels[status][en?1:0];if(String(status).startsWith('unresolved'))return en?'Source-zero surface unresolved':'来源零值未解析';if(String(status).startsWith('unavailable'))return en?'Source/prediction unavailable':'来源/预测无值';return en?'Unverified / see record':'未核 / 见记录';}
export function hasMixedSampleCenter(record){return Boolean(record.sample_evidence?.pixel_centers_inside_object&&Object.values(record.sample_evidence.pixel_centers_inside_object).some(v=>v===false));}
export function hasSaturatedSample(record){return record.sample_evidence?.rgb_saturation_flag===true;}
export function objectEvidenceText(record,en=false){return coverageStatusText(record.status,en)+(hasMixedSampleCenter(record)?en?'; a 10/20 m pixel center lies outside the object; possible coastal mixing':'；10/20m像元中心有面外值，海岸混合风险':'')+(hasSaturatedSample(record)?en?'; display values are saturated or near-saturated; clarity unverified':'；显示值饱和或近饱和，清晰度未核':'');}
export function objectSampleDates(record){return record.successful_sample_dates||record.accepted_sample_dates?.length&&record.accepted_sample_dates||[record.sample_evidence?.date].filter(Boolean);}
export function runtimeCoverageText(rows,en=false,{kind='imagery'}={}){
 if(!rows.length)return en?'Waiting for the current view.':'等待当前视图加载。';
 const n=k=>rows.reduce((sum,r)=>sum+(Number(r[k])||0),0),statuses=new Set(rows.map(r=>r.status));
 const messages=[];const pending=rows.filter(r=>r.pending||r.status==='loading'||r.status==='partial-loading').length;const loaded=rows.filter(r=>Number(r.filled)>0||(!r.pending&&r.status!=='loading')).length;
 if(pending)messages.push(en?`${pending} tiles still loading; accepted pixels appear progressively`:`${pending} 块瓦片仍在读取，已取得的有效像元逐步显示`);
 if(n('filled'))messages.push(en?`${n('filled').toLocaleString('en-US')} displayed pixels in ${loaded} loaded tiles`:`${loaded} 块已读瓦片含 ${n('filled').toLocaleString('zh-CN')} 个显示像元`);
 if(n('qualityRejected'))messages.push(en?`${n('qualityRejected').toLocaleString('en-US')} remaining pixels rejected by SCL/cloud guard`:`${n('qualityRejected').toLocaleString('zh-CN')} 个剩余像元被 SCL/云邻域排除`);
 if(n('unknownTransparent'))messages.push(en?`${n('unknownTransparent')} transparent pixels lack readable quality flags; cause unknown`:`${n('unknownTransparent')} 个透明像元未读到有效质量标志，原因未核`);
 if(n('sourceNoData'))messages.push(en?`${n('sourceNoData').toLocaleString('en-US')} pixels have no accepted source value`:`${n('sourceNoData').toLocaleString('zh-CN')} 个像元无可用来源值`);
 if(n('outsideRead'))messages.push(en?`${n('outsideRead').toLocaleString('en-US')} pixels lie outside the windows read; their cause remains unverified`:`${n('outsideRead').toLocaleString('zh-CN')} 个像元不在已读窗口内，原因仍未核`);
 if(statuses.has('no-overview')){const partial=rows.some(r=>Number(r.filled)>0);messages.push(en?(partial?'Some edge tiles have no local preview; this does not mean the displayed island is missing':'No local overview in these tiles'):(partial?'部分边缘瓦片没有本地预览，不代表已显示的本岛缺失':'这些瓦片没有本地概览'));if(kind==='imagery')messages.push(en?'For native-source imagery, zoom to level 12 or use the detail button':'原始来源影像可放大至12级，或点击查看细节');}
 if(statuses.has('outside-index'))messages.push(en?'No selected source footprint intersects some tiles; outside this catalog':'部分瓦片不与已选源图幅相交，超出当前目录');
 if([...statuses].some(s=>['read-error','incomplete-read','partial-read'].includes(s)))messages.push(en?'Source request or decoder failed; blank areas are not confirmed no-data. Retry':'源请求或解码失败；空白不能认定为源数据缺失，可重试');
 if(statuses.has('outside-read'))messages.push(en?'Read windows do not cover these tiles; source edges or processing limits remain unverified':'已读窗口未覆盖这些瓦片；图幅边缘或处理限制仍未核');
 if(statuses.has('timeout')||rows.some(r=>r.timeout))messages.push(en?'Read reached its 45-second limit; accepted pixels are retained; retry':'读取达到45秒上限，已显示有效像元保留，可重试');
 if(n('sourceTimeouts'))messages.push(en?'Some source requests timed out; accepted pixels are retained':'部分来源请求超时，已显示有效像元保留');
 if(rows.some(r=>r.limited))messages.push(en?'12-source processing limit reached; remaining pixels are not fully checked':'已达12个源的处理上限，剩余像元尚未查全');
 if(!messages.length)messages.push(en?'No accepted pixels in the loaded source windows':'已读来源窗口没有可接受像元');
 messages.push(en?'Tile counts include view edges and sea; not island or provincial coverage.':'瓦片计数含视图边缘和海域，不是岛屿或全省覆盖率。');return messages.join(en?'. ':'；');
}
export function coverageMarkup(en=false){return `<details class="atlas-coverage-panel" id="atlas-coverage-panel"><summary>${en?'View coverage register · samples and source grids':'查看覆盖清单 · 已核样窗与源图幅'}</summary><p>${en?'An indexed image grid is not an island. Sparse samples and rectangular previews do not prove every island is covered. SCL samples can be water and do not apply the map’s 60 m cloud guard.':'影像图幅不是岛屿；稀疏抽样和矩形预览不证明每座岛礁都有有效数据。SCL抽样可能是海水，且未应用地图显示的60 m云邻域规则。'}</p><div id="atlas-coverage-content" role="status">${en?'Open to load the audit.':'展开后加载核验清单。'}</div></details>`;}
export class CoveragePanel{
 constructor(host,getMap,language='zh'){
  this.host=host;this.getMap=getMap;this.en=language==='en';this.root=host.querySelector('#atlas-coverage-panel');this.page=0;this.alive=true;
  this.onToggle=()=>{if(this.root.open&&!this.data&&!this.loading)this.load();};this.onClick=e=>this.click(e);this.onInput=e=>{if(e.target.matches('[data-coverage-filter]')){this.page=0;this.renderRows();}};
  this.root.addEventListener('toggle',this.onToggle);this.root.addEventListener('click',this.onClick);this.root.addEventListener('input',this.onInput);
 }
 async load(){this.loading=true;try{const values=await Promise.all(['coverage-register.json','../environment/environment-manifest.json'].map(async p=>{const r=await fetch(COVERAGE_PATH+p);if(!r.ok)throw new Error('Coverage record unavailable');return r.json();}));if(!this.alive)return;[this.data,this.environment]=values;this.render();}catch{if(this.alive)this.root.querySelector('#atlas-coverage-content').innerHTML=`${this.en?'The register could not be loaded.':'覆盖清单读取失败。'} <button type="button" data-coverage-retry>${this.en?'Retry':'重试'}</button>`;}finally{this.loading=false;}}
 render(){
  const en=this.en,s=this.data.summary,txt=(zh,eng)=>en?eng:zh;
  this.root.querySelector('#atlas-coverage-content').innerHTML=`<div class="coverage-counts"><span><b>${s.mgrs_grid_count}</b>${txt('真实源图幅','source footprints')}</span><span><b>${s.selected_scene_count}</b>${txt('已选日期影像','selected scenes')}</span><span><b>${s.named_preview_count}</b>${txt('具名核验样窗','named audit windows')}</span></div><p>${txt('RGB原生10 m，质量层20 m；2025多日期。概览另有显示分辨率。图幅范围可能含海域和其他地区，不是海南行政或陆地清单。','Native RGB 10 m, SCL 20 m, multiple dates in 2025. Preview display resolution differs. Footprints can include sea and other regions; they are not a Hainan administrative or land inventory.')}</p><div class="coverage-controls"><label>${txt('清单','List')} <select id="coverage-kind" data-coverage-filter><option value="previews">${txt('已核样窗','Verified windows')}</option><option value="grids">${txt('全部源图幅','All source grids')}</option><option value="objects">${txt('具名OSM岛/礁对象','Named OSM island/reef objects')}</option></select></label><label>${txt('区域','Region')} <select id="coverage-group" data-coverage-filter><option value="all">${txt('全部','All')}</option>${Object.entries(GROUPS).map(([id,names])=>`<option value="${id}">${names[en?1:0]}</option>`).join('')}</select></label><label>${txt('名称 / MGRS','Name / MGRS')} <input id="coverage-search" data-coverage-filter type="search" placeholder="${txt('查找样窗或图幅','Find a window or grid')}"></label><label><input id="coverage-footprints" type="checkbox">${txt('显示源图幅轮廓','Show source footprints')}</label><label><input id="coverage-object-points" type="checkbox">${txt('显示已核对象代表点','Show object audit points')}</label></div><p class="coverage-footprint-note">${txt('轮廓是原始栅格图幅边缘，点是OSM对象的抽样位置；均不表示完整岛屿覆盖或行政界。OSM对象可能重叠或表示岛群，不能按条数当作独立岛屿数量。','Outlines mark source raster edges; points mark sampled OSM objects. Neither marks complete island coverage or administrative borders. OSM objects may overlap or denote island groups, and are not a count of independent islands.')}</p><div class="coverage-table-wrap" tabindex="0" aria-label="${txt('覆盖清单，可横向滚动','Coverage register, horizontally scrollable')}"><table class="coverage-table"><thead id="coverage-head"></thead><tbody id="coverage-rows"></tbody></table></div><div class="coverage-pagination"><button type="button" data-coverage-page="-1">${txt('上一页','Previous')}</button><span id="coverage-page-status" aria-live="polite"></span><button type="button" data-coverage-page="1">${txt('下一页','Next')}</button></div><div id="coverage-selection" aria-live="polite"></div><p><a href="${COVERAGE_PATH}grid-audit.csv" download>${txt('全部图幅 CSV','All grids CSV')}</a> · <a href="${COVERAGE_PATH}preview-audit.csv" download>${txt('样窗 CSV','Windows CSV')}</a> · <a href="${COVERAGE_PATH}named-object-audit.csv" download>${txt('具名对象 CSV','Named objects CSV')}</a> · <a href="${COVERAGE_PATH}coverage-audit.json" download>${txt('完整核验 JSON','Full audit JSON')}</a> · <a href="./docs/SPATIAL_COVERAGE_REGISTER.md" target="_blank" rel="noreferrer">${txt('方法与尚缺资料','Methods and remaining gaps')}</a></p>`;this.renderRows();
 }
 rows(){return filterCoverageRows(this.data[this.root.querySelector('#coverage-kind').value],this.root.querySelector('#coverage-group').value,this.root.querySelector('#coverage-search').value);}
 renderRows(){
  const en=this.en,txt=(zh,eng)=>en?eng:zh,kind=this.root.querySelector('#coverage-kind').value,rows=this.rows(),pages=Math.max(1,Math.ceil(rows.length/10));this.page=Math.min(this.page,pages-1);const entries=rows.slice(this.page*10,(this.page+1)*10);
  const heads=kind==='previews'?[txt('样窗 / 定位','Window / locate'),txt('实际贡献日期','Contributing dates'),txt('概览像元','Display pixel'),txt('接受 / 云或质量排除 / 无观测','Accepted / quality rejected / unobserved'),txt('环境数据','Environment')]:[txt('图幅 / 定位','Grid / locate'),txt('日期 / 景数','Dates / scenes'),txt('RGB抽样','RGB sample'),txt('质量层抽样','SCL sample'),txt('已读预览证据','Preview read evidence')];
  if(kind==='objects')heads.splice(0,heads.length,txt('OSM对象 / 定位','OSM object / locate'),txt('源编辑日期','Source edit date'),txt('代表点RGB / SCL','Point RGB / SCL'),txt('抽样影像日期','Sample dates'),txt('相交源图幅','Intersecting grids'));
  this.root.querySelector('#coverage-head').innerHTML='<tr>'+heads.map(v=>`<th scope="col">${v}</th>`).join('')+'</tr>';
  this.root.querySelector('#coverage-rows').innerHTML=entries.map(r=>{
   const id=r.object_id||r.mgrs||r.id,name=kind==='grids'?r.mgrs:en?(r.name_en||r.object_id||r.id):(r.name_zh||r.name||id);let cells;
   if(kind==='previews'){
    const c=r.counts,env=Object.entries({dsm:'DSM',rain:txt('降水','Rain'),soilPh:'pH',soilSoc:'SOC'}).map(([k,label])=>{const record=this.environment.layers[k].previews.find(p=>p.id===r.id);return `${label}: ${coverageStatusText(record?.status||'unverified',en)}`;});
    cells=[dateExtent(r.dates),`${r.display_pixel_m_at_center.map(n=>Number(n).toFixed(1)).join(' × ')} m`,`${c.accepted_pixels.toLocaleString()} / ${c.observed_but_rejected_pixels.toLocaleString()} / ${c.no_source_observation_pixels.toLocaleString()}`,env.join(' · ')];
   }else if(kind==='objects'){cells=[r.osm_timestamp?.slice(0,10)||'—',objectEvidenceText(r,en),dateExtent(objectSampleDates(r)),r.geometry_intersecting_mgrs?.join(', ')||'—'];
   }else{cells=[`${dateExtent(r.dates)} · ${r.selected_scene_count}`,coverageStatusText(r.rgb_sample_status||'unverified',en),coverageStatusText(r.scl_sample_status||r.sample_status,en),r.has_contributing_rgb_preview_evidence?txt('有实际贡献像元','Contributing pixels verified'):r.has_rgb_preview_evidence?txt('已读取，未贡献','Read without contribution'):txt('无预览读取证据','No preview read evidence')];}
   return `<tr><th scope="row"><button type="button" data-coverage-locate="${escapeCoverage(id)}">${escapeCoverage(name||id)}</button></th>${cells.map(v=>`<td>${escapeCoverage(v)}</td>`).join('')}</tr>`;
  }).join('')||`<tr><td colspan="5">${txt('没有匹配记录','No matching records')}</td></tr>`;
  this.root.querySelector('#coverage-page-status').textContent=txt(`共 ${rows.length} 条，第 ${this.page+1}/${pages} 页`,`${rows.length} records · page ${this.page+1}/${pages}`);this.root.querySelector('[data-coverage-page="-1"]').disabled=this.page===0;this.root.querySelector('[data-coverage-page="1"]').disabled=this.page===pages-1;
 }
 click(e){
  const next=e.target.closest('[data-coverage-page]');if(next){this.page+=Number(next.dataset.coveragePage);this.renderRows();return;}
  if(e.target.closest('[data-coverage-retry]')){if(!this.loading)this.load();return;}
  if(e.target.id==='coverage-footprints'){this.toggleFootprints(e.target.checked);return;}
  if(e.target.id==='coverage-object-points'){this.toggleObjectPoints(e.target.checked);return;}
  const locate=e.target.closest('[data-coverage-locate]');if(!locate)return;
  const id=locate.dataset.coverageLocate,r=[...this.data.previews,...this.data.grids,...this.data.objects].find(v=>(v.id||v.mgrs||v.object_id)===id),map=this.getMap();if(!r||!map)return;
  const b=r.bounds_wsen||r.bbox_wgs84;if(b)map.fitBounds([[b[1],b[0]],[b[3],b[2]]],{maxZoom:14});
  const en=this.en,label=en?(r.name_en||r.mgrs||r.object_id):(r.name_zh||r.name||r.mgrs||r.object_id),detail=this.root.querySelector('#coverage-selection');
  const scope=this.host.querySelector('#atlas-region');if(r.id&&[...scope.options].some(o=>o.value===r.id)){scope.value=r.id;scope.dispatchEvent(new Event('input',{bubbles:true}));}
  detail.textContent=`${label} · ${dateExtent(r.dates||objectSampleDates(r))}. `+(en?'Located the source/window. This is not complete island coverage. ':'已定位来源/样窗，不代表整座岛屿完整覆盖。');
  const sourceUrl=r.sample_evidence?.rgb_url||r.source_urls?.visual||r.source_urls?.rgb||r.source_url;if(sourceUrl){const source=document.createElement('a');source.href=sourceUrl;source.target='_blank';source.rel='noreferrer';source.textContent=en?'Source record / RGB COG':'来源记录 / RGB COG';detail.append(source);}
  map.getContainer().scrollIntoView({block:'center',behavior:'smooth'});
 }
 async toggleFootprints(show){
  const map=this.getMap();if(!map)return;
  if(!show){if(this.footprints)map.removeLayer(this.footprints);return;}
  try{
   if(!this.geojson){if(!this.footprintRequest)this.footprintRequest=fetch(COVERAGE_PATH+'grid-footprints.geojson').then(r=>{if(!r.ok)throw new Error('Footprints unavailable');return r.json();}).catch(e=>{this.footprintRequest=null;throw e;});this.geojson=await this.footprintRequest;}
   if(!this.alive||!this.getMap()||!this.root.querySelector('#coverage-footprints').checked)return;
   if(!this.footprints)this.footprints=globalThis.L.geoJSON(this.geojson,{style:{color:'#7463a2',weight:1,fill:false,dashArray:'5 4'},onEachFeature:(feature,layer)=>{const el=document.createElement('div');el.textContent=`${feature.properties.mgrs} · ${this.en?'Source raster footprint, not valid-pixel or island coverage':'原始栅格图幅，非有效像元或岛屿覆盖'}`;layer.bindPopup(el);}});
   this.footprints.addTo(this.getMap());
  }catch{if(this.alive){this.root.querySelector('#coverage-footprints').checked=false;this.root.querySelector('#coverage-selection').textContent=this.en?'Source outlines could not be loaded; select again to retry.':'源图幅轮廓读取失败；可再次勾选重试。';}}
 }
 toggleObjectPoints(show){const map=this.getMap();if(!map)return;
  if(!this.objectPoints){this.objectPoints=globalThis.L.layerGroup();for(const r of this.data.objects){const p=r.representative_point_wgs84;if(!r.geometry_valid||!p||!r.representative_point_inside_geometry)continue;const valid=r.status==='representative_point_value'&&!hasMixedSampleCenter(r)&&!hasSaturatedSample(r);const marker=globalThis.L.circleMarker([p[1],p[0]],{radius:4,color:valid?'#33866a':'#ad7c39',weight:1,fillOpacity:.8});const label=document.createElement('div');label.textContent=`${this.en?(r.name_en||r.object_id):(r.name_zh||r.name||r.object_id)} · ${objectEvidenceText(r,this.en)} · ${this.en?'representative point only':'仅代表点'}`;marker.bindPopup(label);marker.addTo(this.objectPoints);}}
  if(show)this.objectPoints.addTo(map);else map.removeLayer(this.objectPoints);
 }

 destroy(){this.alive=false;this.root.removeEventListener('toggle',this.onToggle);this.root.removeEventListener('click',this.onClick);this.root.removeEventListener('input',this.onInput);const map=this.getMap();if(map&&this.footprints)map.removeLayer(this.footprints);if(map&&this.objectPoints)map.removeLayer(this.objectPoints);}
}
