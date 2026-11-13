/** Full controller import/display/switch/export identity tests. DOM stub, not browser QA. */
import test from 'node:test';import assert from 'node:assert/strict';
class Element{
 constructor(){this.value='';this._html='';this._text='';this.disabled=false;this.hidden=false;this.dataset={};this.files=[];this.listeners={};this.classList={add(){},remove(){}}}
 set innerHTML(v){this._html=String(v);this._text=''}get innerHTML(){return this._html}
 set textContent(v){this._text=String(v);this._html=''}get textContent(){return this._text}
 addEventListener(t,f){this.listeners[t]=f}click(){return this.listeners.click?.({target:this})}
}
const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
globalThis.document={querySelector:el,createElement:()=>new Element()};globalThis.location={pathname:'/route-b/index.html',search:'?lang=en'};
for(const[id,value]of Object.entries({'#mode':'period','#np-n':'40','#np-p':'20','#np-f':'1','#np-n-cap':'40','#np-p-cap':'10'}))el(id).value=value;
let exported;URL.createObjectURL=blob=>{exported=blob;return 'blob:test'};URL.revokeObjectURL=()=>{};
await import('../src/app.js');
const {preserveText,translateText,translateHTML}=await import('../src/i18n.js');
const {defaultInput}=await import('../src/fixture.js');const {run}=await import('../src/engine.js');
const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const language=value=>el('#language').listeners.change({target:{value}});
async function importInput(input,label='untrusted record label'){el('#import-run').files=[{size:1000,text:async()=>JSON.stringify({schema:'FarmSystemDesign.HainanRun',schemaVersion:1,label,input,result:{mode:'period-specific',search:{feasible:999}}})}];await el('#import-run').listeners.change({target:el('#import-run')});assert.deepEqual(JSON.parse(el('#json-input').value),input)}
async function exportRecord(){exported=null;el('#export-run').click();assert.ok(exported);return JSON.parse(await exported.text())}
const ordinary='自定义项目<&>"\'：A，B；C。',marker=preserveText('prior-field-must-not-leak');
const hostile=`方案组合项目${marker}\uE000B:999999\uE001<img src=x onerror="alert(1)">&lt;script&gt;'\\.*+?^$()[]{}|：A，B；C。`;
for(const[field,container]of [['stratum-label','#controls'],['stratum-id','#menus'],['menu-label','#menus'],['menu-id','#results'],['water-label','#controls'],['water-id','#results'],['period','#controls'],['land-class','#menus']])test(`${field}: original data survives punctuation, forged tokens, HTML, switches and export`,async()=>{
 for(const raw of [ordinary,hostile,'组合','项']){
  language('en');el('#reset').click();const x=defaultInput();
  if(field==='stratum-label')x.strata[0].label=raw;
  if(field==='stratum-id')x.strata[0].id=raw;
  if(field==='menu-label')x.strata[0].menus[0].label=raw;
  if(field==='menu-id')x.strata[0].menus[0].id=raw;
  if(field==='water-label')x.waterSources[0].label=raw;
  if(field==='water-id'){x.waterSources[0].id=raw;x.strata.forEach(s=>s.waterSourceId=raw)}
  if(field==='period')x.periods[0]=raw;
  if(field==='land-class')x.strata[0].menus[0].landClass=raw;
  await importInput(x);
  if(field==='menu-id')el('#select-result').listeners.change({target:{value:'1-0-0|0-0-1'}});
  for(const mode of ['zh','both','en','both','en']){
   language(mode);const html=el(container).innerHTML;assert.ok(html.includes(esc(raw)),`${field}/${mode}: original value missing`);assert.doesNotMatch(html,/<img src=x/);assert.ok(!html.includes('prior-field-must-not-leak'));assert.deepEqual((await exportRecord()).input,x);assert.deepEqual((await exportRecord()).result,run(x));
   if(field==='water-id')assert.ok(el('#controls').innerHTML.includes(`value="${esc(raw)}"`),'option values retain raw source ID');
   if(field==='water-label')assert.ok(el('#controls').innerHTML.includes(`>${esc(raw)}</option>`),'option text retains raw source label');
  }
 }
});
test('Only unchanged default identity-label pairs translate; a renamed identity with a default-looking label stays raw',async()=>{
 el('#reset').click();const x=defaultInput();x.strata[0].id='custom-stratum';x.strata[0].label='合成层 α · 第一季劳力紧';x.strata[0].menus[0].id='custom-menu';x.strata[0].menus[0].label='低投入';await importInput(x);language('en');assert.ok(el('#controls').innerHTML.includes(esc(x.strata[0].label)));assert.ok(el('#menus').innerHTML.includes('低投入'));assert.match(el('#controls').innerHTML,/Synthetic stratum β/);
});
test('Pending custom-label import survives language changes and cannot revive after reset',async()=>{
 el('#reset').click();const x=defaultInput();x.strata[0].label=hostile;let resolve;el('#import-run').files=[{size:1000,text:()=>new Promise(r=>resolve=r)}];let pending=el('#import-run').listeners.change({target:el('#import-run')});language('both');resolve(JSON.stringify({schema:'FarmSystemDesign.HainanRun',schemaVersion:1,input:x}));await pending;assert.ok(el('#controls').innerHTML.includes(esc(hostile)));assert.deepEqual((await exportRecord()).input,x);
 el('#import-run').files=[{size:1000,text:()=>new Promise(r=>resolve=r)}];pending=el('#import-run').listeners.change({target:el('#import-run')});el('#reset').click();language('en');resolve(JSON.stringify({schema:'FarmSystemDesign.HainanRun',schemaVersion:1,input:x}));await pending;assert.deepEqual((await exportRecord()).input,defaultInput());
});
test('Record label remains controller-generated rather than adopting a forged imported label',async()=>{
 el('#reset').click();await importInput(defaultInput(),hostile);el('#save-run').click();language('en');assert.doesNotMatch(el('#versions').innerHTML,/prior-field-must-not-leak|方案组合项目/);assert.equal((await exportRecord()).label,'逐期菜单组合');
});
test('Display protection restores exactly once, including marker collisions and literal entities',()=>{
 const a=preserveText('secret-marker-value'),b=preserveText(a),c=preserveText(hostile);for(const lang of ['zh','en','both']){assert.equal(translateText(b,lang),a);assert.equal(translateText(c,lang),hostile);assert.equal(translateHTML(`<option value="unchanged">${c}</option>`,lang),`<option value="unchanged">${esc(hostile)}</option>`)}
 for(const source of ['自定义项目甲','方案组合A','自定义项目：A，B；C。'])assert.equal(translateText(source,'en'),source);
});
test('Rejected custom IDs retain original identity while error suffix translates',()=>{
 el('#reset').click();const x=defaultInput();x.strata[0].id=hostile;x.strata[0].count=0;el('#json-input').value=JSON.stringify(x);el('#apply-json').click();language('en');assert.ok(el('#json-status').textContent.includes(hostile));assert.match(el('#json-status').textContent,/must be 1–8 hypothetical operating units/);
});
