import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export function makeOfflineManifest(root, version) {
  const entries=[];
  function walk(dir) {
    for(const item of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))) {
      const filename=path.join(dir,item.name),relative=path.relative(root,filename).split(path.sep).join('/');
      if(item.isSymbolicLink())throw Error(`Published symlinks are not supported: ${relative}`);
      if(item.isDirectory())walk(filename);
      else if(relative!=='offline-manifest.json') {
        const buffer=fs.readFileSync(filename);
        entries.push({path:relative,bytes:buffer.length,sha256:createHash('sha256').update(buffer).digest('hex')});
      }
    }
  }
  walk(root);entries.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  return {schema:1,id:createHash('sha256').update(JSON.stringify(entries)).digest('hex'),version,
    totalFiles:entries.length,totalBytes:entries.reduce((sum,row)=>sum+row.bytes,0),
    scope:'All published same-origin files; external live services and linked external websites are excluded.',
    entries};
}
