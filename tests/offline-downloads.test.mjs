import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedCachedFile,saveBlobFile,safeDownloadName,downloadMime} from '../src/offline-downloads.js';
import {sha256,names,activePath} from '../src/offline-bundle.js';
const scope='https://example.test/Farm/',version='0.3.17';
function storage(){const sets=new Map();return{open:async name=>{if(!sets.has(name)){const rows=new Map();sets.set(name,{match:async key=>rows.get(String(key))?.clone(),put:async(key,value)=>rows.set(String(key),value.clone())});}return sets.get(name);}};}
async function fixture(path='downloads/source.zip',bytes=new Uint8Array([80,75,3,4,0,255])){
 const caches=storage(),entries=[{path,bytes:bytes.length,sha256:await sha256(bytes)}],id=await sha256(new TextEncoder().encode(JSON.stringify(entries)));
 const manifest={schema:1,version,entries,id,totalFiles:1,totalBytes:bytes.length};
 const cache=await caches.open(names(scope,id).bundle),meta=await caches.open(names(scope,'').meta);
 await cache.put(new URL('offline-manifest.json',scope),Response.json(manifest));await cache.put(new URL(path,scope),new Response(bytes,{headers:{'Content-Type':'application/octet-stream'}}));
 await meta.put(new URL(activePath(version),scope),Response.json({version,id}));
 return{caches,cache,meta,bytes,path,manifest,options:{scope,cacheStorage:caches,version}};
}
test('retained ZIP and TIFF downloads match exact verified bytes and stable MIME',async()=>{
 for(const [path,type]of[['downloads/source.zip','application/zip'],['data/source.tif','image/tiff']]){
  const f=await fixture(path),file=await verifiedCachedFile(path,f.options);assert.equal(file.blob.type,type);assert.equal(file.filename,path.split('/').pop());assert.deepEqual(new Uint8Array(await file.blob.arrayBuffer()),f.bytes);assert.equal(file.sha256,f.manifest.entries[0].sha256);
 }
});
test('download helper refuses external origins, other site scopes, missing and corrupted records',async()=>{
 const f=await fixture();assert.equal(await verifiedCachedFile('https://other.test/Farm/source.zip',f.options),null);assert.equal(await verifiedCachedFile('../Other/source.zip',f.options),null);assert.equal(await verifiedCachedFile('unknown.zip',f.options),null);
 await f.cache.put(new URL(f.path,scope),new Response('corrupt'));await assert.rejects(verifiedCachedFile(f.path,f.options),/integrity mismatch/);
 await f.meta.put(new URL(activePath(version),scope),Response.json({id:f.manifest.id,version:'old'}));assert.equal(await verifiedCachedFile(f.path,f.options),null);
});
test('filenames and MIME headers cannot contain path or control syntax',()=>{
 assert.equal(safeDownloadName('../unsafe\\file.zip'), '.._unsafe_file.zip');assert.equal(safeDownloadName('CON.txt'),'download_CON.txt');assert.equal(safeDownloadName('..'),'download');assert.equal(safeDownloadName('a\u202eb.zip'),'a_b.zip');assert.equal(downloadMime('a.txt','text/plain\r\nInjected: yes'),'application/octet-stream');assert.equal(downloadMime('a.txt','text/plain; charset=utf-8'),'text/plain; charset=utf-8');
});
test('Blob saving clicks once, removes its element and defers URL revocation through the download window',()=>{
 const original={document:globalThis.document,setTimeout:globalThis.setTimeout,create:URL.createObjectURL,revoke:URL.revokeObjectURL};let clicked=0,removed=0,appended=0,revoked=[],timer;
 const link={click:()=>clicked++,remove:()=>removed++};
 try{
  globalThis.document={createElement:tag=>{assert.equal(tag,'a');return link;},body:{append:()=>appended++}};
  URL.createObjectURL=blob=>{assert.equal(blob.type,'application/zip');return 'blob:test';};URL.revokeObjectURL=url=>revoked.push(url);globalThis.setTimeout=(fn,delay)=>{timer={fn,delay};return 1;};
  saveBlobFile({blob:new Blob(['test'],{type:'application/zip'}),filename:'source.zip'});
  assert.equal(link.href,'blob:test');assert.equal(link.download,'source.zip');assert.equal(clicked,1);assert.equal(removed,1);assert.equal(appended,1);assert.deepEqual(revoked,[]);assert.equal(timer.delay,60000);timer.fn();assert.deepEqual(revoked,['blob:test']);
 }finally{globalThis.document=original.document;globalThis.setTimeout=original.setTimeout;URL.createObjectURL=original.create;URL.revokeObjectURL=original.revoke;}
});
