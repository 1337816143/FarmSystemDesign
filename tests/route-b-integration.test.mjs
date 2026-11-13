import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {english} from '../src/i18n.js';
import {ROUTES,AUDIT,NUTRIENT_BOUNDARY_STUDY,REGIONAL_EVIDENCE_VERSION} from '../src/research.js';
import {BUILD} from '../route-b/src/build.generated.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url));

test('integrated B runtime matches the frozen UI build and keeps its independently reviewed B engine',()=>{
 for(const [path,hash] of Object.entries(BUILD.sourceHashes))assert.equal(createHash('sha256').update(read('route-b/'+path)).digest('hex'),hash,path);
 assert.equal(BUILD.version,'0.1.6-dated-ui-r2');assert.equal(BUILD.engineSha256,'a23a7363e759dad4c97ad639f205685bb5c75942b93b5929efb10bde4837e8b0');
 assert.equal(createHash('sha256').update(read('src/model.js')).digest('hex'),'6eb8584feb77607cf2a23738ff73b3bde56a0be9fa903ff3be4f67dd645e7070');
 assert.equal(createHash('sha256').update(read('src/data.js')).digest('hex'),'bb486d4f70346b92ba02adec8e5df7c1be63ff674ff69148e9cbaad55d0e5922');
});
test('B has a distinct new-tab entry and does not access route A persistent state or register another worker',()=>{
 const main=read('src/app.js').toString(),b=read('route-b/src/app.js').toString();
 assert.match(main,/href="\.\/route-b\/index\.html\?lang=\$\{language\}" target="_blank" rel="noopener"/);
 assert.doesNotMatch(b,/localStorage|indexedDB|serviceWorker\.register|farmsystem-workspace/);
 assert.doesNotMatch(b,/from ['"]\.\.\/\.\.\/src\/(?:model|data)\.js/);
 assert.match(read('route-b/index.html').toString(),/href="\.\.\/index\.html"/);
});
test('revised A/B and article evidence labels have complete main-site English translations',()=>{
 const strings=x=>typeof x==='string'?[x]:x&&typeof x==='object'?Object.values(x).flatMap(strings):[];
 const changed=[...strings(ROUTES),NUTRIENT_BOUNDARY_STUDY.boundary,AUDIT.find(x=>x.id==='dong-nutrient-boundaries').gap];
 for(const value of changed)if(/[\u3400-\u9fff]/.test(value))assert.doesNotMatch(english(value),/[\u3400-\u9fff]/,value);
 assert.equal(REGIONAL_EVIDENCE_VERSION,'hainan-regional-2026-10-06-task6-r5');
});
