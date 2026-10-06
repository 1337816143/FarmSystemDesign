import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

const source=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
function runtime({offline=false,installFails=false}={}){
  const listeners={},requests=[],writes=[],deleted=[],waits=[],matches=[];
  const cache={addAll:async entries=>{requests.push(...entries);if(installFails)throw new Error('missing shell');},put:async(...args)=>writes.push(args),match:async key=>{matches.push(key);return {cached:true};}};
  const state={listeners,requests,writes,deleted,waits,matches,skip:0,claim:0};
  const self={location:{origin:'https://example.test'},registration:{scope:'https://example.test/Farm/'},
    addEventListener:(type,fn)=>listeners[type]=fn,skipWaiting:async()=>state.skip++,clients:{claim:async()=>state.claim++}};
  vm.runInNewContext(source,{self,URL,Response,Request:class{constructor(url,options){this.url=url;Object.assign(this,options);}},
    caches:{open:async key=>{state.cacheKey=key;return cache;},keys:async()=>['farmsystem-shell-%2FFarm%2F-v0.3.16','farmsystem-shell-%2FPaper%2F-v0.3.17','farmsystem-full-v1-%2FFarm%2F-test','unrelated-cache'],delete:async key=>deleted.push(key)},
    fetch:async(request,options)=>{requests.push({request,options});if(offline)throw new Error('offline');return {ok:true,clone:()=>({copy:true})};}});
  state.event=(path,mode='cors',method='GET')=>{let response;listeners.fetch({request:{url:new URL(path,self.registration.scope).href,mode,method},respondWith:value=>response=value,waitUntil:value=>waits.push(value)});return response;};
  return state;
}
test('new shell installation revalidates every asset and only succeeds as a complete install',async()=>{
  const r=runtime();let install;r.listeners.install({waitUntil:p=>install=p});await install;
  assert.ok(r.requests.length>40);assert.ok(r.requests.every(x=>x.cache==='reload'));assert.equal(r.skip,1);
  assert.match(r.cacheKey,/v0\.3\.17/);
  const failure=runtime({installFails:true});failure.listeners.install({waitUntil:p=>install=p});await assert.rejects(install,/missing shell/);assert.equal(failure.skip,0);assert.deepEqual(failure.deleted,[]);
});
test('only application shell fetches force revalidation, with durable cache writes',async()=>{
  for(const [path,mode,expected]of [['src/app.js','cors',true],['src/results.js','cors',true],['version.json','cors',true],['studio.css','cors',true],['','navigate',true],['data/hainan/example.tif','cors',false],['vendor/leaflet.js','cors',false]]){
    const r=runtime();await r.event(path,mode);await Promise.all(r.waits);
    assert.equal(r.requests[0].options?.cache,expected?'no-cache':undefined,path);assert.equal(r.waits.length,1);assert.equal(r.writes.length,1);
  }
});
test('offline fallback is scoped to the current cache, not arbitrary historical app caches',async()=>{
  const r=runtime({offline:true});const result=await r.event('src/app.js');assert.equal(result.cached,true);assert.match(r.cacheKey,/v0\.3\.17/);assert.equal(r.matches.length,2);assert.match(String(r.matches[0]),/offline-active-v0\.3\.17\.json/);
  assert.doesNotMatch(source,/await caches\.match/);
});
test('activation removes only old app caches and does not reload pages or touch plans',async()=>{
  const r=runtime();let activation;r.listeners.activate({waitUntil:p=>activation=p});await activation;
  assert.deepEqual(r.deleted,['farmsystem-shell-%2FFarm%2F-v0.3.16']);assert.equal(r.claim,1);assert.doesNotMatch(source,/localStorage|\.navigate\(|\.reload\(/);
  const external=runtime();assert.equal(external.event('https://other.test/src/app.js'),undefined);assert.equal(external.requests.length,0);
});
test('upgrade fixture retains exact original legacy bytes rather than a rewritten old-page mock',()=>{
  const f=JSON.parse(fs.readFileSync(new URL('./fixtures/upgrade-shell-0.3.15.json',import.meta.url)));
  assert.equal(f.sourceCommit,'03890e2e00044c4197745bbe91154cfedc88439f');
  for(const [path,text]of Object.entries(f.files)){const b=Buffer.from(text);assert.equal(createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'),f.gitBlobShas[path],path);}
  assert.match(f.files['src/app.js'],/violations\?\.slice\(0,8\)/);assert.match(f.files['sw.js'],/v0\.3\.15/);
});
