import test from 'node:test';
import assert from 'node:assert/strict';
import {importHarness,sourceFile,deferred} from './helpers/np-import-harness.mjs';

test('A1 delayed old A cannot reopen a modal after newer B is confirmed',async()=>{
 const h=importHarness(),wait=deferred(),a=sourceFile('older-A.json','older A',()=>wait.promise),b=sourceFile('newer-B.json','newer B'),plans=JSON.stringify(h.state.plans);
 const slow=h.importFile(a);await h.importFile(b);assert.match(h.modal.innerHTML,/newer-B\.json/);h.confirm();const accepted=JSON.stringify(h.state.npDraft);
 wait.resolve(a.raw);await slow;assert.equal(h.opened.length,1);assert.equal(h.state.npDraft.inputArchive.filename,'newer-B.json');assert.equal(JSON.stringify(h.state.npDraft),accepted);assert.equal(JSON.stringify(h.state.plans),plans);assert.equal(h.state.config.manurePhosphorus,undefined);
});
test('A1 a superseded already-open A confirmation cannot overwrite B',async()=>{
 const h=importHarness();await h.importFile(sourceFile('A.json','A'));const a=h.modal.form;await h.importFile(sourceFile('B.json','B'));h.confirm();const accepted=JSON.stringify(h.state.npDraft);h.confirm(a);assert.equal(JSON.stringify(h.state.npDraft),accepted);assert.equal(h.audits.length,1);assert.match(h.modal.error.textContent,/expired/);
});
test('A1 navigation away and back invalidates a pending read even on the same eventual page',async()=>{
 const h=importHarness(),wait=deferred(),f=sourceFile('A.json','A',()=>wait.promise),run=h.importFile(f);h.navigate('data');h.navigate('planner');wait.resolve(f.raw);await run;assert.equal(h.opened.length,0);assert.equal(h.state.npDraft,null);
});
test('A1 editing current controls invalidates a pending read even if paired N and quarter are unchanged',async()=>{
 const h=importHarness(),wait=deferred(),f=sourceFile('A.json','A',()=>wait.promise),run=h.importFile(f);h.edit();assert.equal(h.state.config.water,1.2);wait.resolve(f.raw);await run;assert.equal(h.opened.length,0);assert.equal(h.state.npDraft,null);
});
test('A1 another modal opened and closed invalidates an older pending import',async()=>{
 const h=importHarness(),wait=deferred(),f=sourceFile('A.json','A',()=>wait.promise),run=h.importFile(f);h.foreignModal();h.close();wait.resolve(f.raw);await run;assert.equal(h.opened.length,1);assert.equal(h.state.npDraft,null);
});
test('A1 cancel, Escape and direct close all expire their stored submit callbacks',async()=>{
 for(const close of ['cancel','escape','close']){const h=importHarness();await h.importFile(sourceFile());const old=h.modal.form;h[close]();h.confirm(old);assert.equal(h.state.npDraft,null);assert.equal(h.audits.length,0);}
});
test('A1 reopening the same filename binds only the latest file content and confirmation',async()=>{
 const h=importHarness();await h.importFile(sourceFile('same.json','old'));const old=h.modal.form;h.cancel();await h.importFile(sourceFile('same.json','new'));h.confirm(old);assert.equal(h.state.npDraft,null);h.confirm();assert.equal(h.state.npDraft.bindings[0].source,'new');assert.equal(h.audits.length,1);
});
test('A1 an edit expires an already-open confirmation, without mutating previous draft',async()=>{
 const h=importHarness();await h.importFile(sourceFile('accepted.json','previous'));h.confirm();const previous=JSON.stringify(h.state.npDraft);await h.importFile(sourceFile('new.json','new'));const pending=h.modal.form;h.edit();h.confirm(pending);assert.equal(JSON.stringify(h.state.npDraft),previous);assert.match(h.modal.error.textContent,/expired/);
});
test('A1 successful import confirmation is single-use and stays explicitly disabled',async()=>{
 const h=importHarness();await h.importFile(sourceFile());const form=h.modal.form;h.confirm(form);const before=JSON.stringify(h.state.npDraft);h.confirm(form);assert.equal(h.audits.length,1);assert.equal(JSON.stringify(h.state.npDraft),before);assert.equal(h.state.config.manurePhosphorus,undefined);
});
test('A1 obsolete read rejection does not display a stale error over a later success',async()=>{
 const h=importHarness(),wait=deferred(),slow=h.importFile(sourceFile('old.json','old',()=>wait.promise));await h.importFile(sourceFile('new.json','new'));h.confirm();const count=h.messages.length;wait.reject(Error('obsolete read failure'));await slow;assert.equal(h.messages.length,count);assert.equal(h.state.npDraft.inputArchive.filename,'new.json');
});
test('A1 dialog identifies escaped captured filename and byte length',async()=>{
 const h=importHarness(),f=sourceFile('input-<b>&.json');await h.importFile(f);assert.match(h.modal.innerHTML,/input-&lt;b&gt;&amp;\.json/);assert.doesNotMatch(h.modal.innerHTML,/<b>&/);assert.match(h.modal.innerHTML,/bytes/);h.confirm();assert.equal(h.state.npDraft.inputArchive.filename,f.name);
});
test('A1 cancelling a replacement file selection invalidates its previous pending request',async()=>{
 const h=importHarness(),wait=deferred(),f=sourceFile('old.json','old',()=>wait.promise),slow=h.importFile(f);await h.importFile(null);wait.resolve(f.raw);await slow;assert.equal(h.opened.length,0);assert.equal(h.state.npDraft,null);
});
test('A1 programmatic paired-N changes during a read fail context binding without opening a dialog',async()=>{
 const h=importHarness(),wait=deferred(),f=sourceFile('old.json','old',()=>wait.promise),slow=h.importFile(f);h.state.dataset.farms[0].poultry++;wait.resolve(f.raw);await slow;assert.equal(h.opened.length,0);assert.equal(h.state.npDraft,null);
});
