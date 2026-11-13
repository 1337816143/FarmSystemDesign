/** Permanent native-download preparation and integrity regressions. */
import test from 'node:test';
import {after} from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
const project=fileURLToPath(new URL('../',import.meta.url));
const original={caches:globalThis.caches,document:globalThis.document,fetch:globalThis.fetch,create:URL.createObjectURL,revoke:URL.revokeObjectURL};
const {installOfflineDownloads}=await import(pathToFileURL(path.join(project,'src/offline-downloads.js')));
const {sha256,names,activePath}=await import(pathToFileURL(path.join(project,'src/offline-bundle.js')));
const {VERSION}=await import(pathToFileURL(path.join(project,'src/version.js')));
const scope='https://example.test/Farm/',payload=new Uint8Array([80,75,3,4,6,7]),filePath='downloads/archive.zip';
const entries=[{path:filePath,bytes:payload.length,sha256:await sha256(payload)}];
const manifest={schema:1,version:VERSION,entries,id:await sha256(new TextEncoder().encode(JSON.stringify(entries))),totalFiles:1,totalBytes:payload.length};
const nativeTimer=globalThis.setTimeout;
function storage(){const sets=new Map();return{open:async name=>{if(!sets.has(name)){const rows=new Map();sets.set(name,{match:async key=>rows.get(String(key))?.clone(),put:async(key,r)=>rows.set(String(key),r.clone())});}return sets.get(name);}};}
async function run({status=200,body=payload,twice=false,type='application/octet-stream',corruptCache=false}={}){
 let listener,released;const gate=new Promise(resolve=>released=resolve),calls=[],saved=[],errors=[],states=[];
 const cacheStorage=storage();
 if(corruptCache){const meta=await cacheStorage.open(names(scope,'').meta),cache=await cacheStorage.open(names(scope,manifest.id).bundle);await meta.put(new URL(activePath(VERSION),scope),Response.json({id:manifest.id,version:VERSION}));await cache.put(new URL('offline-manifest.json',scope),Response.json(manifest));await cache.put(new URL(filePath,scope),new Response(new Uint8Array(payload.length)));}
 globalThis.caches=cacheStorage;
 globalThis.document={addEventListener:(_,fn)=>listener=fn,removeEventListener:()=>{},body:{append:()=>{}},createElement:()=>({click(){},remove(){}})};
 URL.createObjectURL=blob=>{saved.push({size:blob.size,type:blob.type});return 'blob:review-'+saved.length};URL.revokeObjectURL=()=>{};
 globalThis.setTimeout=(fn,delay)=>delay===60000?0:nativeTimer(fn,delay);
 globalThis.fetch=async input=>{const url=String(input);calls.push(url);await gate;return url.endsWith('offline-manifest.json')?Response.json(manifest):new Response(body,{status,headers:{'Content-Type':type}});};
 const uninstall=installOfflineDownloads({scope,onError:error=>errors.push(String(error.message)),onState:state=>states.push(state)});
 const a={href:scope+filePath,hasAttribute:()=>true,getAttribute:()=>''};let prevented=0;
 const click=()=>listener({target:{closest:()=>a},button:0,preventDefault(){prevented++}});
 click();if(twice)click();await new Promise(resolve=>setImmediate(resolve));released();
 const until=Date.now()+2000;
 while(!saved.length&&!errors.length&&Date.now()<until)await new Promise(resolve=>nativeTimer(resolve,5));
 await new Promise(resolve=>nativeTimer(resolve,50));uninstall();
 return {calls,saved,errors,states,prevented};
}
const tests=[
 ['rapid duplicate preparation dispatches one download',async()=>{const x=await run({twice:true});assert.equal(x.saved.length,1,JSON.stringify(x));assert.equal(x.errors.length,0);} ],
 ['HTTP 200 HTML error body cannot become an archive',async()=>{const x=await run({body:'unexpected HTML error',type:'text/html'});assert.equal(x.saved.length,0,JSON.stringify(x));assert.equal(x.errors.length,1);} ],
 ['HTTP 206 is rejected even with apparently complete bytes',async()=>{const x=await run({status:206});assert.equal(x.saved.length,0,JSON.stringify(x));assert.equal(x.errors.length,1);} ],
 ['same-size wrong bytes cannot become an archive',async()=>{const x=await run({body:new Uint8Array(payload.length)});assert.equal(x.saved.length,0,JSON.stringify(x));assert.equal(x.errors.length,1);} ],
 ['matching ZIP bytes retain deterministic ZIP MIME despite response header',async()=>{const x=await run({type:'text/html'});assert.equal(x.saved.length,1,JSON.stringify(x));assert.equal(x.saved[0].type,'application/zip',JSON.stringify(x));} ],
 ['corrupt retained bytes fail closed without a network fallback',async()=>{const x=await run({corruptCache:true});assert.equal(x.saved.length,0,JSON.stringify(x));assert.equal(x.calls.length,0);assert.equal(x.errors.length,1);} ],
 ['a failed preparation releases the shared lock for a successful retry',async()=>{const bad=await run({body:'bad'}),good=await run();assert.equal(bad.saved.length,0,JSON.stringify(bad));assert.equal(good.saved.length,1,JSON.stringify(good));} ],
];
for(const [name,fn]of tests)test(name,fn);
after(()=>{globalThis.setTimeout=nativeTimer;globalThis.caches=original.caches;globalThis.document=original.document;globalThis.fetch=original.fetch;URL.createObjectURL=original.create;URL.revokeObjectURL=original.revoke;});
