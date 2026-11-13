import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {makeOfflineManifest} from '../tools/offline-manifest.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('offline manifest enumerates exact final published bytes, including discussion and downloads',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'farm-offline-build-'));
 try {
  const files={'index.html':'<html>App</html>','discussion/index.html':'<html>15 bilingual slides</html>','data/map.tif':Buffer.from([0,1,2,255]),'docs/repro.zip':Buffer.from([50,70,0,255]),'.nojekyll':''};
  for(const [name,value]of Object.entries(files)){fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true});fs.writeFileSync(path.join(root,name),value);}
  fs.writeFileSync(path.join(root,'offline-manifest.json'),'Previous output does not include itself');
  const m=makeOfflineManifest(root,'0.3.17');assert.equal(m.totalFiles,Object.keys(files).length-1);assert.equal(m.totalBytes,Object.values(files).reduce((s,v)=>s+Buffer.byteLength(v),0));
  assert.deepEqual(m.entries.map(x=>x.path),Object.keys(files).filter(x=>x!=='.nojekyll').sort());
  for(const row of m.entries){assert.equal(row.sha256,hash(files[row.path]));assert.equal(row.bytes,Buffer.byteLength(files[row.path]));}
  assert.deepEqual(m.excludedControlFiles,['.nojekyll']);assert.equal(m.id,hash(JSON.stringify(m.entries)));assert.equal(makeOfflineManifest(root,'0.3.17').id,m.id);
  fs.appendFileSync(path.join(root,'discussion/index.html'),'changed');assert.notEqual(makeOfflineManifest(root,'0.3.17').id,m.id);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test('symlinks cannot silently publish files outside the generated site',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'farm-offline-link-'));
 const outside=fs.mkdtempSync(path.join(os.tmpdir(),'farm-offline-external-'));
 try{
  fs.writeFileSync(path.join(outside,'private.txt'),'Must not be published');
  // Windows directory junctions exercise the same rejection without changing
  // system symlink permissions; other systems use a directory symlink.
  fs.symlinkSync(outside,path.join(root,'outside'),process.platform==='win32'?'junction':'dir');
  assert.throws(()=>makeOfflineManifest(root,'0.3.17'),/symlinks/);
  assert.equal(fs.readFileSync(path.join(outside,'private.txt'),'utf8'),'Must not be published');
 }
 finally{fs.rmSync(root,{recursive:true,force:true});fs.rmSync(outside,{recursive:true,force:true});}
});
