/** Static/source or existing built-byte checks; never launches a browser or creates _site. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const sourceRoot=fileURLToPath(new URL('../',import.meta.url)),i=process.argv.indexOf('--site'),site=i>=0?path.resolve(process.argv[i+1]||''):null,root=site||sourceRoot;
const required=['src/manure-np.js','src/manure-np-input.js','src/manure-np-ui.js','src/model.js','src/app.js','src/frozen-run.js','src/engine-identity.generated.js','docs/ROUTE_A_NP_CONTRACT.md'];
const hash=b=>createHash('sha256').update(b).digest('hex'),checks=[];
function check(name,passed){checks.push({name,passed:!!passed});if(!passed)throw Error(name);}
try{
 const version=JSON.parse(fs.readFileSync(path.join(root,'version.json'))),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');check('identity',version.version==='0.3.22'&&version.modelVersion==='screening-0.2.3');
 for(const p of required){check('readable '+p,fs.statSync(path.join(root,p)).isFile());if(p.includes('manure-np')||p.startsWith('docs/'))check('shell '+p,sw.includes(`'./${p}'`));}
 check('unchanged reviewed core',hash(fs.readFileSync(path.join(root,'src/manure-np.js')))==='69d8ac11e60c8497e96b517a8b85bdd814c6c0dc0bfc93745076e45153ee03d5');
 if(site){const m=JSON.parse(fs.readFileSync(path.join(root,'offline-manifest.json')));check('manifest version',m.version===version.version);check('manifest identity',m.id===hash(JSON.stringify(m.entries)));for(const p of required)check('manifest includes '+p,m.entries.some(e=>e.path===p));for(const e of m.entries){check('safe manifest path '+e.path,!path.isAbsolute(e.path)&&!e.path.split('/').includes('..'));const b=fs.readFileSync(path.join(root,e.path));check('bytes '+e.path,b.length===e.bytes&&hash(b)===e.sha256);}check('manifest count',m.totalFiles===m.entries.length);check('manifest total',m.totalBytes===m.entries.reduce((n,e)=>n+e.bytes,0));}
 const disk=fs.statfsSync(root);console.log(JSON.stringify({status:site?'PASS_BUILT_BYTES':'PASS_SOURCE_CHECKS',checks:checks.length,freeBytes:disk.bavail*disk.bsize,productionBuild:site?'external build inspected':'NOT_RUN',browserUI:'NOT_RUN',serviceWorkerOffline:'NOT_RUN'},null,2));
}catch(e){console.error(JSON.stringify({status:'FAIL',error:e.message,checks},null,2));process.exitCode=1;}
