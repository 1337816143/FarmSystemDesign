/** Deterministic controller stub, native crypto/Blob. Not real DOM or native disk/browser QA. */
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {defaultInput} from '../src/fixture.js';import {run,makeRecord} from '../src/engine.js';
import {makeInputSnapshot,restoreInputSnapshot,IMPORT_LIMIT_BYTES} from '../src/recovery.js';
import {stressInput,independentStressInput} from './recovery-fixture.mjs';
class Element{
 constructor(){this.value='';this._html='';this._text='';this.className='';this.disabled=false;this.hidden=false;this.dataset={};this.files=[];this.listeners={};this.classList={add:()=>{},remove:()=>{}}}
 get innerHTML(){return this._html}set innerHTML(v){this._html=v;this._text=''}get textContent(){return this._text}set textContent(v){this._text=v;this._html=''}
 addEventListener(type,fn){this.listeners[type]=fn}click(){if(this.href)downloads.push({href:this.href,name:this.download});return this.listeners.click?.({target:this})}
}
const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)},blobs=new Map(),downloads=[];
globalThis.document={querySelector:el,createElement:()=>new Element()};globalThis.location={pathname:'/route-b/index.html',search:'?lang=en'};
for(const[id,value]of Object.entries({'#mode':'period','#np-n':'40','#np-p':'20','#np-f':'1','#np-n-cap':'40','#np-p-cap':'10'}))el(id).value=value;
URL.createObjectURL=blob=>{const url=`blob:test-${blobs.size}`;blobs.set(url,blob);return url};URL.revokeObjectURL=()=>{};
await import('../src/app.js');
const language=value=>el('#language').listeners.change({target:{value}});
const reset=()=>{language('en');el('#reset').click()};
const input=()=>JSON.parse(el('#json-input').value);
const view=()=>({json:el('#json-input').value,status:el('#status').textContent,snapshotStatus:el('#snapshot-status').textContent,mode:el('#mode').value,saveDisabled:el('#save-run').disabled,exportDisabled:el('#export-run').disabled,snapshotDisabled:el('#export-snapshot').disabled});
const apply=x=>{el('#json-input').value=JSON.stringify(x);el('#apply-json').click()};
const importFile=file=>{el('#import-run').files=[file];return el('#import-run').listeners.change({target:el('#import-run')})};
const importJSON=record=>{const text=JSON.stringify(record);return importFile({size:Buffer.byteLength(text),text:async()=>text})};
const lastJSON=async()=>JSON.parse(await blobs.get(downloads.at(-1).href).text());
const originalDigest=crypto.subtle.digest.bind(crypto.subtle);
let queue=null,digestCalls=0;
crypto.subtle.digest=(...args)=>{digestCalls++;if(!queue)return originalDigest(...args);return new Promise((resolve,reject)=>queue.push({finish:async()=>resolve(await originalDigest(...args)),fail:()=>reject(new Error('injected SHA failure'))}))};
const hold=()=>{assert.equal(queue,null);queue=[]};
const release=async(fail=false)=>{const held=queue;queue=null;for(const item of held)if(fail)item.fail();else await item.finish()};
async function untilDigest(){for(let n=0;n<20&&queue.length===0;n++)await new Promise(resolve=>setImmediate(resolve));assert.ok(queue.length>0,'operation reached held SHA')}
function change(action){
 if(action==='reset')el('#reset').click();
 if(action==='edit'){el('#controls').listeners.input({target:{dataset:{input:'waterSources.0.capacity.0'},tagName:'INPUT',value:'177'}});el('#run').click()}
 if(action==='mode'){el('#mode').value='annual';el('#mode').listeners.change({target:el('#mode')});el('#run').click()}
 if(action==='apply'){const x=defaultInput();x.waterSources[0].capacity=[180,180];apply(x)}
 if(action==='restore')el('#versions').listeners.click({target:{dataset:{restore:'0'}}});
 if(action==='draft'){el('#json-input').value='NEW UNAPPLIED JSON';el('#json-input').listeners.input({target:el('#json-input')})}
 if(action==='run')el('#run').click();
}
const actions=['reset','edit','mode','apply','restore','draft','run'];
el('#save-run').click();
test('Recovery export dispatches a small separate named Blob, then independently restores exact input and mode',async()=>{
 reset();el('#mode').value='annual';el('#mode').listeners.change({target:el('#mode')});el('#run').click();const before=input();await el('#export-snapshot').click();const saved=await lastJSON();assert.match(downloads.at(-1).name,/input-snapshot/);assert.equal(saved.schema,'FarmSystemDesign.HainanInputSnapshot');assert.ok(!saved.result);assert.deepEqual(saved.input,before);assert.equal(saved.runConfig.annual,true);
 reset();await importJSON(saved);assert.deepEqual(input(),before);assert.equal(el('#mode').value,'annual');assert.match(el('#status').textContent,/8 satisfy.*original full audit results were not loaded/s);
});
test('Only the actual fixed UI cap 2000 is supported; hidden alternative cap is rejected',async()=>{
 reset();await el('#export-snapshot').click();const saved=await lastJSON();assert.equal(saved.runConfig.maxCombinations,2000);saved.runConfig.maxCombinations=9;const before=input();await importJSON(saved);assert.match(el('#status').textContent,/Invalid recovery snapshot run configuration/);assert.deepEqual(input(),before);reset();await el('#export-snapshot').click();assert.equal((await lastJSON()).runConfig.maxCombinations,2000);
});
test('Repeated preparation clicks deduplicate; failure leaves retry available without invalidating current result',async()=>{
 reset();const start=downloads.length,calls=digestCalls;hold();const first=el('#export-snapshot').click(),second=el('#export-snapshot').click();assert.equal(queue.length,1);await release();await Promise.all([first,second]);assert.equal(digestCalls,calls+1);assert.equal(downloads.length,start+1);assert.equal(el('#export-snapshot').disabled,false);
 hold();const bad=el('#export-snapshot').click();await release(true);await bad;assert.match(el('#snapshot-status').textContent,/injected SHA failure/);assert.equal(el('#export-snapshot').disabled,false);assert.equal(el('#export-run').disabled,false);await el('#export-snapshot').click();assert.equal(downloads.length,start+2);
});
for(const failure of [false,true])test(`Export SHA ${failure?'failure':'success'} from old generation cannot download or overwrite after all model actions`,async()=>{
 for(const action of actions){reset();hold();const pending=el('#export-snapshot').click();change(action);const before=view(),count=downloads.length;await release(failure);await pending;assert.deepEqual(view(),before,action);assert.equal(downloads.length,count,action)}
});
for(const failure of [false,true])test(`Snapshot-import SHA ${failure?'failure':'success'} from old generation cannot apply or overwrite after all model actions`,async()=>{
 reset();const x=defaultInput();x.waterSources[0].capacity=[0,0];const saved=await makeInputSnapshot(x,run(x));
 for(const action of actions){reset();hold();const pending=importJSON(saved);await untilDigest();change(action);const before=view();await release(failure);await pending;assert.deepEqual(view(),before,action)}
});
test('A newer import cancels pending snapshot export and supersedes older snapshot verification',async()=>{
 reset();const x=defaultInput();x.waterSources[0].capacity=[199,199];const legacy=makeRecord(x,run(x));hold();const exporting=el('#export-snapshot').click();await importJSON(legacy);const before=view(),count=downloads.length;await release();await exporting;assert.deepEqual(view(),before);assert.equal(downloads.length,count);
 const saved=await makeInputSnapshot(defaultInput(),run(defaultInput()));hold();const importing=importJSON(saved);await untilDigest();await importJSON(legacy);const after=view();await release(true);await importing;assert.deepEqual(view(),after);assert.deepEqual(input(),x);
});
test('Snapshot SHA import-to-import order resolves to the newest request, including stale failures',async()=>{
 reset();const older=await makeInputSnapshot(defaultInput(),run(defaultInput())),x=defaultInput();x.waterSources[0].capacity=[188,188];const newer=await makeInputSnapshot(x,run(x));
 hold();const first=importJSON(older);await untilDigest();const second=importJSON(newer);while(queue.length<2)await new Promise(resolve=>setImmediate(resolve));const held=queue;queue=null;await held[1].finish();await second;const before=view();held[0].fail();await first;assert.deepEqual(view(),before);assert.deepEqual(input(),x);
});
test('Language changes retain pending SHA operations and preserve raw input/source/token-like data',async()=>{
 reset();const x=defaultInput(),raw='自定义项目方案\uE000B:0\uE001<img src=x>&lt;script&gt;：A，B；C。';x.strata[0].label=raw;x.strata[0].id=raw;x.strata[0].menus[0].id=raw;x.strata[0].menus[0].label=raw;x.extra={source:raw,assumption:'synthetic'};apply(x);
 hold();const pending=el('#export-snapshot').click();const json=el('#json-input').value;for(const mode of ['both','zh','en']){language(mode);assert.equal(el('#json-input').value,json)}await release();await pending;const saved=await lastJSON();assert.deepEqual(saved.input,x);assert.match(el('#snapshot-status').textContent,/handed to the browser/);
 reset();hold();const importing=importJSON(saved);await untilDigest();language('both');await release();await importing;assert.deepEqual(input(),x);assert.match(el('#status').textContent,/原完整审计结果未载入.*original full audit results were not loaded/s);language('en');assert.doesNotMatch(el('#status').textContent,/[\u3400-\u9fff]/u);
});
test('Oversized file rejects before File.text; exactly bounded file is read; malformed import remains recoverable',async()=>{
 reset();let read=false;await importFile({size:IMPORT_LIMIT_BYTES+1,text:async()=>{read=true;throw Error('must not read')}});assert.equal(read,false);assert.match(el('#status').textContent,/exceeds 5 MB/);reset();const s=await makeInputSnapshot(defaultInput(),run(defaultInput()));await importFile({size:IMPORT_LIMIT_BYTES,text:async()=>{read=true;return JSON.stringify(s)}});assert.equal(read,true);assert.match(el('#status').textContent,/original full audit results were not loaded/);
 s.integrity.digest='0'.repeat(64);const before=input();await importJSON(s);assert.deepEqual(input(),before);assert.match(el('#status').textContent,/integrity mismatch/);el('#run').click();assert.equal(el('#export-snapshot').disabled,false);await el('#export-snapshot').click();
});
test('Legacy complete archive remains intact and forged saved results are never adopted',async()=>{
 reset();el('#export-run').click();const saved=await lastJSON();assert.match(downloads.at(-1).name,/audit-archive/);assert.equal(saved.result.results.length,9);saved.result.search.feasible=999;saved.result.results=[];await importJSON(saved);assert.match(el('#status').textContent,/5 satisfy.*independently recalculated/s);assert.doesNotMatch(el('#status').textContent,/999/);el('#export-run').click();assert.equal((await lastJSON()).result.results.length,9);
});
test('Exact 13,921-byte stress input retains every archive result while small recovery round-trip deeply reproduces input/config/results',async()=>{
 reset();const x=stressInput(),expected=run(x),baseline=JSON.stringify(makeRecord(x,expected),null,2);
 assert.equal(Buffer.byteLength(JSON.stringify(x)),13921);assert.equal(Buffer.byteLength(baseline),36420987);assert.equal(expected.results.length,729);assert.equal(expected.search.feasible,0);assert.ok(expected.results.every(r=>r.issues.length===144));
 apply(x);assert.match(el('#status').textContent,/729 combinations; 0 satisfy/);el('#export-run').click();const archive=blobs.get(downloads.at(-1).href);assert.ok(archive.size>IMPORT_LIMIT_BYTES);const archiveSaved=await lastJSON();assert.deepEqual(archiveSaved.result,expected);
 let read=false;await importFile({size:archive.size,text:async()=>{read=true;return archive.text()}});assert.equal(read,false);el('#run').click();await el('#export-snapshot').click();const snapshotBlob=blobs.get(downloads.at(-1).href),saved=JSON.parse(await snapshotBlob.text());assert.ok(snapshotBlob.size<IMPORT_LIMIT_BYTES);assert.deepEqual(saved.input,x);const restored=await restoreInputSnapshot(saved);assert.deepEqual(restored.result,expected);assert.deepEqual(restored.config,{annual:false,maxCombinations:2000,mode:'period-specific'});
 reset();await importJSON(saved);assert.deepEqual(input(),x);assert.match(el('#status').textContent,/729 combinations; 0 satisfy.*original full audit results were not loaded/s);
 fs.writeFileSync(new URL('../evidence/recovery-stress.json',import.meta.url),JSON.stringify({inputBytes:Buffer.byteLength(JSON.stringify(x)),baselineArchiveBytes:Buffer.byteLength(baseline),actualControllerArchiveBytes:archive.size,actualControllerSnapshotBytes:snapshotBlob.size,limitBytes:IMPORT_LIMIT_BYTES,combinations:729,issuesPerCombination:144,totalIssues:729*144,originalInputDeepEqual:true,effectiveConfigDeepEqual:true,allRecalculatedResultsDeepEqual:true,archiveRejectedBeforeRead:true,controllerImportRecomputed:true,browserOrNativeDiskExecuted:false},null,2)+'\n');
});
test('Independent shorter-label pressure recipe also round-trips without shrinking scientific content',async()=>{
 const x=independentStressInput(),expected=run(x),s=await makeInputSnapshot(x,expected),r=await restoreInputSnapshot(JSON.parse(JSON.stringify(s)));assert.deepEqual(r.input,x);assert.deepEqual(r.result,expected);assert.equal(r.result.results.length,729);assert.equal(r.result.results[0].issues.length,144);
});
test('Oversized valid original-input metadata cannot dispatch a recovery file; current model survives and ordinary retry succeeds',async()=>{
 reset();const x=defaultInput();x.originalNotes='x'.repeat(IMPORT_LIMIT_BYTES);apply(x);
 const beforeInput=input(),beforeResults=el('#results').innerHTML,beforeStatus=el('#status').textContent,count=downloads.length,blobCount=blobs.size;
 await el('#export-snapshot').click();assert.equal(downloads.length,count);assert.equal(blobs.size,blobCount);assert.deepEqual(input(),beforeInput);assert.equal(el('#results').innerHTML,beforeResults);assert.equal(el('#status').textContent,beforeStatus);assert.match(el('#snapshot-status').textContent,/exceeds 5 MiB.*no download was dispatched/i);assert.equal(el('#export-snapshot').disabled,false);assert.equal(el('#export-run').disabled,false);assert.equal(el('#save-run').disabled,false);
 const small=defaultInput();apply(small);await el('#export-snapshot').click();assert.equal(downloads.length,count+1);const saved=await lastJSON();assert.deepEqual(saved.input,small);await importJSON(saved);assert.deepEqual(input(),small);assert.match(el('#status').textContent,/original full audit results were not loaded/);
 fs.writeFileSync(new URL('../evidence/oversized-input-snapshot.json',import.meta.url),JSON.stringify({inputIsValidUnderUnchangedEngine:true,inputBytes:Buffer.byteLength(JSON.stringify(x)),extraOriginalNotesBytes:IMPORT_LIMIT_BYTES,limitBytes:IMPORT_LIMIT_BYTES,downloadDispatched:false,blobCreated:false,inputUnchanged:true,resultDisplayUnchanged:true,mainStatusUnchanged:true,retryButtonEnabled:true,originalMetadataNotSilentlyRemoved:true,followingSmallSnapshotRoundTripPassed:true,browserOrNativeDiskExecuted:false},null,2)+'\n');
});
