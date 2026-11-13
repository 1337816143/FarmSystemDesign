/** B-only, presentation-layer localization. No storage, model mutation or remote access. */
import {DATED_EN,DATE_ERROR_EN} from './dated-ui.en.js';
import {STATIC_EN} from './ui-static.en.js';
import {DYNAMIC_EN} from './ui-dynamic.en.js';
import {EVIDENCE,COVERAGE} from './research.js';
import {EVIDENCE_EN,COVERAGE_EN} from './research.en.js';
export const LANGUAGES=Object.freeze(['zh','en','both']);
export function languageFromSearch(search=''){
 const requested=new URLSearchParams(search).get('lang');
 return LANGUAGES.includes(requested)?requested:'zh';
}
let language=languageFromSearch(globalThis.location?.search);
export const getLanguage=()=>language;
// Opaque presentation tokens separate imported data from translatable UI text.
// Tokens are restored in ONE non-recursive pass after translation and punctuation handling.
const preservedValues=new Map(),valueTokens=new Map();
export function preserveText(value){
 const source=String(value??'');
 if(!valueTokens.has(source)){
  const token=`\uE000B:${valueTokens.size}\uE001`;
  valueTokens.set(source,token);preservedValues.set(token,source);
 }
 return valueTokens.get(source);
}
const restorePreserved=source=>source.replace(/\uE000B:\d+\uE001/gu,token=>preservedValues.get(token)??token);
export function errorSource(error,identifiers=[]){
 let message=String(error?.message??error);
 const prefix='B输入合同：';
 if(message.startsWith(prefix)){
  const body=message.slice(prefix.length);
  const id=identifiers.map(String).sort((a,b)=>b.length-a.length).find(id=>body.startsWith(id)&&/^(?:\.|来源必须|水源不存在|必须保留)/u.test(body.slice(id.length)));
  if(id)message=prefix+preserveText(id)+body.slice(id.length);
 }
 if(error instanceof SyntaxError)return `JSON解析失败：${preserveText(message)}`;
 return /[\u3400-\u9fff]/u.test(message)||message.startsWith('Manure N/P contract: ')?message:`操作未完成：${preserveText(message)}`;
}
const researchPairs=EVIDENCE.flatMap(row=>{
 const en=EVIDENCE_EN.find(x=>x.id===row.id);
 if(!en)throw new Error(`Missing research translation: ${row.id}`);
 return Object.entries(row).filter(([key])=>!['id','url'].includes(key)).map(([key,value])=>[value,en[key]]);
});
export const TRANSLATIONS=Object.freeze({...STATIC_EN,...DYNAMIC_EN,...DATED_EN,...DATE_ERROR_EN,...Object.fromEntries(researchPairs),[COVERAGE.boundary]:COVERAGE_EN.boundary});
const escaped=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const keys=Object.keys(TRANSLATIONS).filter(k=>k&&k!==TRANSLATIONS[k]).sort((a,b)=>b.length-a.length);
const dictionaryPattern=new RegExp(keys.map(escaped).join('|'),'g');
const templates=[
 [/其中 (\d+) 个组合被所列时段汇总误判为可行。此为约束分辨率诊断，不是自适应策略效果。/g,(_,n)=>`${n} combinations are falsely classified as feasible by declared-horizon aggregation. This diagnoses constraint resolution, not the effect of an adaptive strategy.`],
 [/所列时段汇总通过 (\d+) 个；逐期通过 (\d+) 个/g,(_,a,b)=>`Declared horizon totals: ${a} pass; period-specific: ${b} pass`],
 [/违例 (\d+)项/g,(_,n)=>`Violations: ${n}`],
 [/已完整核算 (\d+) 个组合；(\d+) 个满足本模式约束。全部数值仍为合成/g,(_,a,b)=>`Fully evaluated ${a} combinations; ${b} satisfy this mode's constraints. All values remain synthetic`],
 [/年度总量通过 (\d+) 个；逐期通过 (\d+) 个/g,(_,a,b)=>`Annual totals: ${a} pass; period-specific: ${b} pass`],
 [/其中 (\d+) 个组合被年度平均误判为可行。此为约束分辨率诊断，不是自适应策略效果。/g,(_,n)=>`${n} combinations are falsely classified as feasible by annual averaging. This diagnoses constraint resolution, not the effect of an adaptive strategy.`],
 [/允许接收 ([\d,.]+)% 同一份物料/g,(_,n)=>`May receive ${n}% of the same material`],
 [/可利用 N 为 ([\d,.]+) kg；总 N\/P 成分比在两份中保持。剩余物料仍在来源端，未默认为无害处置或污染消失。/g,(_,n)=>`Available N is ${n} kg; both portions retain the total N/P composition ratio. Remaining material stays at the source; harmless disposal or disappearance of pollution is not assumed.`],
 [/合成手算基准：N40\/P20，接收可用N40\/P10，最大份额 min\(1, 1, 0.5\)=0.5，接收N20\/P10，保留N20\/P10。N可利用比例当前为([\d,.]+)。/g,(_,n)=>`Synthetic hand-calculation benchmark: N40/P20, receiving available-N capacity 40 / P capacity 10; maximum fraction min(1, 1, 0.5)=0.5, receiving N20/P10 and retaining N20/P10. The current available-N fraction is ${n}.`],
 [/：([\d,]+) 个组合包含此类违例/g,(_,n)=>`: ${n} combinations contain this violation type`],
];
// The unchanged N/P interface emits English validation errors. Supply a Chinese side too.
function chineseError(source){
 if(!source.startsWith('Manure N/P contract: '))return source;
 return source.replace('Manure N/P contract: ','粪肥 N/P 输入合同：')
 .replace(' must be finite and nonnegative','必须是有限非负数')
 .replace('availableNFraction must be in (0,1]','availableNFraction 必须在 (0,1] 内')
 .replace('split result ','分份结果 ');
}
export function translateText(value,mode=language){
 const source=String(value??'');
 if(!LANGUAGES.includes(mode))throw new Error('Unsupported display language');
 const zh=chineseError(source);
 if(mode==='zh')return restorePreserved(zh);
 let en=source;
 for(const [pattern,replacement] of templates)en=en.replace(pattern,replacement);
 en=en.replace(dictionaryPattern,key=>TRANSLATIONS[key]);
 // Unknown Chinese text is data, not a license for destructive partial translation.
 if(/[\u3400-\u9fff]/u.test(en))return restorePreserved(source);
 // Chinese punctuation is presentation, never part of any numerical model value.
 en=en.replace(/：/g,': ').replace(/；/g,'; ').replace(/，/g,', ').replace(/。/g,'.');
 return restorePreserved(mode==='both'&&zh!==en?`${zh} / ${en}`:en);
}
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const decodeHTML=s=>s.replace(/&(amp|lt|gt|quot|#39);/g,(_,x)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[x]));
/** Deterministic HTML-text fallback for Node controller stubs. Never edits markup or input values. */
export function translateHTML(html,mode=language){
 return String(html).split(/(<[^>]*>)/g).map(part=>part.startsWith('<')
  ?part.replace(/\b(aria-label|title)="([^"]*)"/g,(_,attr,value)=>`${attr}="${escapeHTML(translateText(decodeHTML(value),mode))}"`)
  :escapeHTML(translateText(decodeHTML(part),mode))).join('');
}
const sourceText=new WeakMap(),sourceAttributes=new WeakMap();
const skipped=node=>['SCRIPT','STYLE','TEXTAREA'].includes(node?.tagName)||node?.closest?.('[data-i18n-preserve]');
function translateSubtree(root){
 const document=root.ownerDocument||(root.nodeType===9?root:null);
 if(!document?.createTreeWalker)return false;
 const walker=document.createTreeWalker(root,4); // SHOW_TEXT; retain the actual DOM nodes/listeners.
 let node;
 while((node=walker.nextNode())){
  if(skipped(node.parentElement))continue;
  if(!sourceText.has(node))sourceText.set(node,node.nodeValue);
  node.nodeValue=translateText(sourceText.get(node));
 }
 const nodes=[...(root.matches?.('[aria-label],[title]')?[root]:[]),...root.querySelectorAll('[aria-label],[title]')];
 for(const el of nodes){
  if(skipped(el))continue;
  const originals=sourceAttributes.get(el)||{};
  for(const attr of ['aria-label','title'])if(el.hasAttribute(attr)){
   if(!(attr in originals))originals[attr]=el.getAttribute(attr);
   el.setAttribute(attr,translateText(originals[attr]));
  }
  sourceAttributes.set(el,originals);
 }
 return true;
}
const assignments=new Map(),proxies=new WeakMap();
/** Intercept only display writes; all form state, handlers and controller decisions are unchanged. */
export function createLocalizedQuery(document){
 return selector=>{
  const element=document.querySelector(selector);if(!element)return null;
  if(proxies.has(element))return proxies.get(element);
  const proxy=new Proxy(element,{
   get(target,property){
    if(property==='textContent'&&assignments.get(target)?.property==='textContent')return assignments.get(target).source;
    const value=Reflect.get(target,property,target);return typeof value==='function'?value.bind(target):value;
   },
   set(target,property,value){
    if(property==='innerHTML'||property==='textContent'){
     const source=String(value??'');assignments.set(target,{property,source});
     Reflect.set(target,property,source,target);
     if(!translateSubtree(target))Reflect.set(target,property,property==='innerHTML'?translateHTML(source):translateText(source),target);
     return true;
    }
    return Reflect.set(target,property,value,target);
   }
  });proxies.set(element,proxy);return proxy;
 };
}
export function setLanguage(value,document=globalThis.document){
 if(!LANGUAGES.includes(value))return false;
 language=value;
 if(document?.documentElement){document.documentElement.lang=value==='en'?'en':'zh-CN';document.documentElement.dataset.displayLanguage=value;}
 if(!translateSubtree(document))for(const [element,{property,source}] of assignments)element[property]=property==='innerHTML'?translateHTML(source):translateText(source);
 const picker=document?.querySelector('#language');if(picker)picker.value=value;
 return true;
}
export function initializeLanguage(document=globalThis.document){
 const picker=document.querySelector('#language');
 if(picker)picker.addEventListener('change',event=>setLanguage(event.target.value,document));
 setLanguage(language,document);
}
