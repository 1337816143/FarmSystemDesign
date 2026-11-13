import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {BUILD} from '../route-b/src/build.generated.js';
import {CROPS} from '../src/data.js';
import {ENGINE_IDENTITY} from '../src/engine-identity.generated.js';
import {captureRunContext,buildFrozenRun,verifyFrozenRun,sha256JSON} from '../src/frozen-run.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const cryptoOptions={cryptoProvider:webcrypto};

test('minimal integration retains the exact reviewed A scientific bytes and B BUILD17',()=>{
 const expected={'src/model.js':'6eb8584feb77607cf2a23738ff73b3bde56a0be9fa903ff3be4f67dd645e7070','src/data.js':'bb486d4f70346b92ba02adec8e5df7c1be63ff674ff69148e9cbaad55d0e5922','src/manure-np.js':'69d8ac11e60c8497e96b517a8b85bdd814c6c0dc0bfc93745076e45153ee03d5'};
 for(const [p,sha]of Object.entries(expected))assert.equal(createHash('sha256').update(read(p)).digest('hex'),sha,p);
 assert.equal(ENGINE_IDENTITY.applicationVersion,'0.3.26');assert.equal(ENGINE_IDENTITY.modelVersion,'screening-0.2.3');
 assert.equal(BUILD.version,'0.1.6-dated-ui-r2');assert.equal(Object.keys(BUILD.sourceHashes).length,17);
 for(const [p,sha]of Object.entries(BUILD.sourceHashes))assert.equal(createHash('sha256').update(read('route-b/'+p)).digest('hex'),sha,p);
});

test('0.3.14, local 0.3.19, retained pre-revision 0.3.20 NP and local R1 0.3.21 records retain their bytes without current coefficient recalculation',async()=>{
 const names=['frozen-run-0.3.14.json','frozen-run-0.3.19-local.json','selected-plan-0.3.19-local.json','frozen-run-0.3.20-np-before-revision.json','frozen-run-0.3.21-r1-local.json'];
 const prior=CROPS.rice.revenue;try{CROPS.rice.revenue=NaN;
  for(const name of names){const raw=read('tests/fixtures/'+name),record=JSON.parse(raw),before=JSON.stringify(record);assert.equal((await verifyFrozenRun(record,cryptoOptions)).status,'verified',name);assert.equal(JSON.stringify(record),before,name);assert.equal(read('tests/fixtures/'+name),raw,name);}
 }finally{CROPS.rice.revenue=prior;}
});

test('version-pinned 0.3.15–0.3.18 compatibility accepts retained eight-module records without NP backfill',async()=>{
 // New version-dispatch probes based on a local 0.3.19 fixture. They are explicitly
 // synthetic compatibility cases, NOT recovered records from those releases.
 for(const version of ['0.3.15','0.3.16','0.3.17','0.3.18']){
  const record=JSON.parse(read('tests/fixtures/frozen-run-0.3.19-local.json'));
  const side=record.frozenRun,identity=structuredClone(side.engineIdentity);identity.applicationVersion=version;
  const {digest,...payload}=identity;identity.digest=await sha256JSON('FarmSystemDesign/engine-source/v1',payload,webcrypto);
  const context=captureRunContext(record.runInputs,{parameters:side.parameters,engineIdentity:identity,contracts:side.contracts,evidenceRefs:side.evidenceRefs});
  const release=structuredClone(side.releaseState);release.metadata.version=version;release.metadata.engineDigest=identity.digest;
  record.frozenRun=await buildFrozenRun(record,context,release,cryptoOptions);const before=JSON.stringify(record);
  assert.equal((await verifyFrozenRun(record,cryptoOptions)).status,'verified',version);assert.equal(JSON.stringify(record),before);
  assert.equal(record.frozenRun.engineIdentity.modules.length,8);assert.ok(record.frozenRun.engineIdentity.modules.every(m=>!m.path.includes('manure-np')));
 }
});

test('minimal parent wiring excludes later regional background and retains dated browser authorization gates',()=>{
 const app=read('src/app.js'),atlas=read('src/hainan-atlas.js'),css=read('research.css'),offline=read('tests/offline_browser.py');
 assert.doesNotMatch(atlas+css+offline,/atlas-context-status|historical-context|regional-context\.js/);
 assert.match(app,/route-b\/index\.html\?lang=\$\{language\}/);
 assert.match(offline,/exercise_route_b\(page/);assert.match(offline,/for lang in \['zh', 'en', 'both'\]/);
 const build=read('tools/build.mjs');assert.match(build,/\['index.html','styles.css','src','docs'\]/);assert.doesNotMatch(build,/fs\.cpSync\(['"]route-b['"]/);
 for(const workflow of ['verify-regional-candidate.yml']){
  const source=read('.github/workflows/'+workflow);for(const gate of ['python tests/browser.py','python tests/spatial.py','python tests/spatial_inputs.py','FARM_ALLOW_BROWSER=1 python tests/route_a_np_browser.py','ROUTE_B_RECOVERY_QA_AUTHORIZED=yes','ROUTE_B_DATED_QA_AUTHORIZED=yes','route-b/tests/dated-browser-qa.mjs'])assert.ok(source.includes(gate),workflow+': '+gate);
 }
 assert.match(read('route-b/tests/dated-browser-qa.mjs'),/ROUTE_B_DATED_QA_AUTHORIZED!==?'yes'/);
 assert.match(read('route-b/tests/browser-qa.mjs'),/assert\.equal\(await page\.locator\('#json-input'\)\.inputValue\(\),'UNAPPLIED JSON'\);await page\.locator\('#discard-json-draft'\)\.click\(\);assert\.equal\(\(await input\(\)\)\.waterSources\[0\]\.capacity\[0\],175\)/);
});
