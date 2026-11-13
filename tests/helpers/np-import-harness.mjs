/** Actual app function/event bodies with minimal DOM adapters; not a real-browser test. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fixture} from '../fixtures/manure-np.mjs';
import {evaluate} from '../../src/model.js';
import {NP_INPUT_LIMIT,importManurePhosphorus} from '../../src/manure-np-input.js';
import {npText} from '../../src/manure-np-ui.js';
import {esc,fmt} from '../../src/utils.js';
const source=fs.readFileSync(new URL('../../src/app.js',import.meta.url),'utf8');
const between=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const line=prefix=>source.split('\n').find(s=>s.startsWith(prefix));
export function importHarness(){
 const f=fixture(),state={page:'planner',dataset:f.data,config:{...f.config},npDraft:null,npError:'',plans:[{id:'saved-do-not-change',config:{legacy:true}}]};delete state.config.manurePhosphorus;
 const rows=()=>{const c={...state.config};delete c.manurePhosphorus;return evaluate(state.dataset,f.ids,f.allocation,c,null).farms;};
 const body=between('async function importNpFile(','function plannerPage('),opening=line('function openModal('),invalidate=line('function invalidateNpImport('),navigation=line('function navigate(');
 assert.ok(line('function render(').startsWith('function render(){invalidateNpImport();'));
 const setup=`let npImportGeneration=0,modalGeneration=0;const language='en',map=null,toastTimer=null;
 const messages=[],audits=[],opened=[],rootEvents={},modalEvents={};let renderCount=0;
 const root={addEventListener:(name,fn)=>rootEvents[name]=fn,querySelector:()=>null};
 const modal={open:false,dataset:{},_html:'',form:null,error:{textContent:''},
   set innerHTML(value){this._html=value;this.form={onsubmit:null,values:{'np-confirm':'on'}};},get innerHTML(){return this._html;},
   querySelector(selector){return selector==='form'?this.form:this.error;},
   addEventListener(name,fn){modalEvents[name]=fn;},showModal(){this.open=true;opened.push({title:this._html,form:this.form});},
   close(){this.open=false;modalEvents.close?.();}};
 const FormData=class{constructor(form){this.values=form.values;}get(key){return this.values[key]??null;}};
 const persist=()=>true;const applyLanguage=()=>{},icon=()=>'',toast=m=>messages.push(m),audit=(...a)=>audits.push(a),location={hash:'#planner'},window={scrollTo:()=>{}};
 ${invalidate}
 function render(){invalidateNpImport();renderCount++;}
 ${navigation}
 ${opening}
 ${line("modal.addEventListener('close'")}
 ${line("modal.addEventListener('cancel'")}
 ${line("modal.addEventListener('click'")}
 ${line("root.addEventListener('input'")}
 ${body}
 return {state,modal,messages,audits,opened,importFile:importNpFile,navigate,
   edit:()=>rootEvents.input({target:{id:'water',dataset:{config:'water'},value:'120'}}),
   cancel:()=>modalEvents.click({target:{closest:selector=>selector==='[data-action="close-modal"]'}}),
   escape:()=>{modalEvents.cancel();modal.close();},
   close:()=>modal.close(),foreignModal:()=>openModal('Other dialog','Different content',null),
   confirm:(form=modal.form)=>form.onsubmit({preventDefault(){},currentTarget:form})};`;
 return new Function('state','npUnboundRows','NP_INPUT_LIMIT','importManurePhosphorus','npText','esc','fmt',setup)(state,rows,NP_INPUT_LIMIT,importManurePhosphorus,npText,esc,fmt);
}
export function sourceFile(name='input.json',label='synthetic input',text=null){
 const c=fixture().config.manurePhosphorus;c.bindings[0].source=label;const raw=JSON.stringify(c);
 return {name,size:Buffer.byteLength(raw),text:text||(()=>Promise.resolve(raw)),raw};
}
export function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
