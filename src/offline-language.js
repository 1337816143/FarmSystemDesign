import {storedLanguage,saveLanguage,watchLanguage} from './display-language.js';
const han=/[\u3400-\u9fff]/u;
const originals=new WeakMap(),attributes=new WeakMap();
let mode=storedLanguage();
const rows=[];
function splitPair(value){
 const source=String(value),matches=[...source.matchAll(/ \/ | · /g)];
 for(const match of matches){const zh=source.slice(0,match.index),en=source.slice(match.index+match[0].length);if(han.test(zh)&&!han.test(en)&&/[a-z]{2}/i.test(en))return [zh,en];}
 return null;
}
function display(pair){return mode==='en'?pair[1]:mode==='both'?pair.join(' / '):pair[0];}
function refresh(){
 for(const row of rows){row.primary.hidden=mode==='en';row.secondary.hidden=mode==='zh';}
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 while(walker.nextNode()){
  const node=walker.currentNode,parent=node.parentElement;
  if(parent.closest('script,style,textarea,pre,code,button[data-language],[data-offline-language-pair],[data-i18n-preserve]'))continue;
  const prior=originals.get(node),actual=node.nodeValue,source=prior?.rendered===actual?prior.source:actual;
  const pair=splitPair(source)||(parent.closest('#errors')&&/Manifest HTTP/.test(source)?[source.replace('Manifest HTTP','发布清单请求返回 HTTP'),source]:null);
  if(!pair)continue;
  const rendered=display(pair);originals.set(node,{source,rendered});if(actual!==rendered)node.nodeValue=rendered;
 }
 for(const element of document.querySelectorAll('[aria-label],[title],[placeholder]'))for(const key of ['aria-label','title','placeholder']){
  if(!element.hasAttribute(key))continue;const actual=element.getAttribute(key),record=attributes.get(element)||{},prior=record[key];
  const source=prior?.rendered===actual?prior.source:actual,pair=splitPair(source);if(!pair)continue;
  const rendered=display(pair);record[key]={source,rendered};attributes.set(element,record);if(actual!==rendered)element.setAttribute(key,rendered);
 }
}
for(const english of document.querySelectorAll('main>p.sub')){
 const chinese=english.previousElementSibling;
 if(chinese&&han.test(chinese.textContent)&&!han.test(english.textContent)){
  rows.push({primary:chinese,secondary:english});chinese.dataset.offlineLanguagePair='';english.dataset.offlineLanguagePair='';
 }
}
for(const english of document.querySelectorAll('li>small,p>small')){
 const parent=english.parentElement;
 if(han.test(parent.textContent)&&!han.test(english.textContent)){
  const primary=document.createElement('span');
  for(const node of [...parent.childNodes])if(node!==english&&node.nodeName!=='BR')primary.append(node);
  parent.prepend(primary);primary.dataset.offlineLanguagePair='';english.dataset.offlineLanguagePair='';
  rows.push({primary,secondary:english});
 }
}
const controls=document.createElement('div');controls.id='offline-languages';controls.className='actions';
controls.innerHTML='<button data-language="zh" class="secondary">中文</button><button data-language="en" class="secondary">EN</button><button data-language="both" class="secondary">中/EN</button>';
document.querySelector('header').append(controls);
function apply(value,persist=false){
 mode=value;document.documentElement.lang=mode==='en'?'en':'zh-CN';document.body.dataset.language=mode;
 document.title=mode==='zh'?'完整离线包 · FarmSystem Design':mode==='en'?'Complete offline bundle · FarmSystem Design':'完整离线包 / Complete offline bundle · FarmSystem Design';
 for(const button of controls.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.language===mode));
 refresh();if(persist)saveLanguage(mode);
}
controls.addEventListener('click',event=>{const button=event.target.closest('[data-language]');if(button)apply(button.dataset.language,true);});
watchLanguage(value=>{if(value!==mode)apply(value);});
new MutationObserver(refresh).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','placeholder']});
apply(mode);
