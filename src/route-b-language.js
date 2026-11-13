// Parent-site integration only. The independent B translator and model stay pure.
import {getLanguage,setLanguage,translateText} from '../route-b/src/i18n.js';
import {storedLanguage,saveLanguage,watchLanguage} from './display-language.js';
const pairs={
 '01 / QUESTION & EVIDENCE':['01 / 研究问题与证据','01 / Question and evidence'],
 '02 / COMPUTABLE VERTICAL SLICE':['02 / 可计算方法原型','02 / Computable method prototype'],
 '03 / CROSS-ACTIVITY INTERFACE TEST':['03 / 跨活动接口检验','03 / Cross-activity interface test'],
 '04 / TRACEABLE METHODS':['04 / 可追溯方法','04 / Traceable methods'],
};
const storageNotice='数量是相同资源条件下的假设经营单元个数，不是海南抽样权重；改变数量会重算资源和产出。仅本页内存保存，不读写路线 A 的浏览器空间。';
const storagePair=['数量为同等资源条件下的假设经营单元个数，不是海南抽样权重。经营输入仅保留在本页内存；全局语言偏好在本地保存，不改写路线 A 的研究数据或方案。','Counts describe hypothetical operating units with identical resources, not Hainan sampling weights. Operating inputs stay in this page’s memory. The global language preference is saved locally without changing route A research data or plans.'];
for(const mode of ['zh','en','both'])pairs[translateText(storageNotice,mode)]=storagePair;
const originals=new WeakMap();let current=storedLanguage(getLanguage());
function displayHeadings(){
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 while(walker.nextNode()){
  const node=walker.currentNode;if(node.parentElement.closest('script,style,textarea,pre,code,[data-i18n-preserve]'))continue;
  const value=originals.get(node)||pairs[node.nodeValue.trim()];if(!value)continue;originals.set(node,value);
  const rendered=current==='en'?value[1]:current==='both'?value.join(' / '):value[0];if(node.nodeValue!==rendered)node.nodeValue=rendered;
 }
}
function apply(mode){
 current=mode;setLanguage(mode,document);document.body.dataset.language=mode;displayHeadings();
}
document.querySelector('#language')?.addEventListener('change',event=>{apply(event.target.value);saveLanguage(event.target.value);});
watchLanguage(apply);
apply(storedLanguage(getLanguage()));
new MutationObserver(displayHeadings).observe(document.body,{subtree:true,childList:true,characterData:true});
