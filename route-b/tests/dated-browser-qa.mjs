/** NOT_RUN. Author-written browser/disk/offline plan, not execution evidence.
 * Requires a separately authorized browser environment, preinstalled Playwright,
 * and an already served URL for this exact candidate. Starts no server; installs nothing.
 * ROUTE_B_DATED_QA_AUTHORIZED=yes ROUTE_B_QA_URL=http://approved-local-host/route-b/index.html node tests/dated-browser-qa.mjs
 */
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {BUILD} from '../src/build.generated.js';import {defaultInput} from '../src/fixture.js';import {run} from '../src/engine.js';import {syntheticTemplate,restoreDatedSnapshot} from '../src/dated-contract.js';import {stressInput} from './recovery-fixture.mjs';
if(process.env.ROUTE_B_DATED_QA_AUTHORIZED!=='yes'||!process.env.ROUTE_B_QA_URL)throw Error('NOT_RUN: explicit browser authorization and an already served exact-candidate URL are required. No server/browser was started.');
const target=new URL(process.env.ROUTE_B_QA_URL);assert.ok(['http:','https:'].includes(target.protocol));
const {chromium}=await import('playwright');
const out=process.env.ROUTE_B_QA_OUTPUT_DIR?pathToFileURL(path.resolve(process.env.ROUTE_B_QA_OUTPUT_DIR)+path.sep):new URL('../evidence/dated-browser-qa/',import.meta.url);await fs.mkdir(out,{recursive:true});
const report={status:'RUNNING',nativeFileChooserCancellation:'NOT_RUN; dispatched cancel-event checks are not OS file-picker cancellation tests',build:BUILD.version,buildIdentity:BUILD,checks:[],downloads:[],externalRequests:[],pageErrors:[],fatal:null};
let browser;const record=(name,detail)=>report.checks.push({name,status:'PASS',detail});
async function saveDownload(page,selector,tag){
 const event=page.waitForEvent('download',{timeout:60000});await page.locator(selector).click();const d=await event;const suggested=d.suggestedFilename();assert.match(suggested,/^hainan-route-b-(?:input-snapshot|audit-archive)-[0-9TZ-]+\.json$/);
 const item={tag,suggested,failure:await d.failure(),nativePath:await d.path()};report.downloads.push(item);assert.equal(item.failure,null,'native download.failure must be null');assert.ok(item.nativePath,'native browser temp file must exist');
 const file=new URL(`${tag}.json`,out);await d.saveAs(fileURLToPath(file));const bytes=await fs.readFile(file);item.bytes=bytes.length;item.sha256=createHash('sha256').update(bytes).digest('hex');item.savedPath=fileURLToPath(file);assert.ok(bytes.length>0);return {json:JSON.parse(bytes),file};
}
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
 for(const lang of ['zh','en','both'])for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true});
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==target.origin){report.externalRequests.push(route.request().url());return route.abort();}return route.continue();});
  const page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(String(e)));
  const url=new URL(target);url.searchParams.set('lang',lang);await page.goto(url.href);await page.locator('#run').waitFor();assert.match(await page.locator('#build-line').textContent(),new RegExp(BUILD.version.replaceAll('.','\\.')));
  await page.locator('#dated-panel > summary').click();const x=defaultInput(),s=x.strata[0],m=s.menus[1];await page.selectOption('#dated-stratum',s.id);await page.selectOption('#dated-menu',m.id);await page.click('#dated-example');await page.click('#dated-preview');await page.waitForFunction(()=>!document.querySelector('#dated-apply').disabled);
  await page.screenshot({path:fileURLToPath(new URL(`preview-${lang}-${width}.png`,out)),fullPage:true});
  assert.ok(await page.locator('#dated-confirm').isVisible());await page.click('#dated-apply');assert.equal((await page.inputValue('#json-input')),JSON.stringify(x,null,2));
  await page.check('#dated-confirm');await page.click('#dated-apply');const base=await saveDownload(page,'#export-run',`baseline-${lang}-${width}`);assert.deepEqual(base.json.input,x);assert.equal(base.json.result.search.feasible,5);assert.equal(base.json.datedRecords.length,1);
  const source=JSON.parse(await page.inputValue('#dated-json'));source.events[0].value=140;source.events[1].value=0;await page.fill('#dated-json',JSON.stringify(source));await page.click('#dated-preview');await page.waitForFunction(()=>!document.querySelector('#dated-apply').disabled);await page.check('#dated-confirm');await page.click('#dated-apply');
  const shifted=await saveDownload(page,'#export-run',`peak-${lang}-${width}`);assert.equal(shifted.json.result.search.feasible,3);assert.deepEqual(shifted.json.datedRecords[0].source,source);
  await page.selectOption('#mode','annual');await page.click('#run');const annual=await saveDownload(page,'#export-run',`annual-${lang}-${width}`);assert.equal(annual.json.result.search.feasible,8);
  const small=await saveDownload(page,'#export-snapshot',`snapshot-${lang}-${width}`);const expected=await restoreDatedSnapshot(small.json);assert.equal(small.json.schemaVersion,2);
  await page.click('#reset');await page.setInputFiles('#import-run',fileURLToPath(small.file));await page.waitForFunction(()=>document.querySelector('#mode').value==='annual');const round=await saveDownload(page,'#export-run',`roundtrip-${lang}-${width}`);assert.deepEqual(round.json.input,expected.input);assert.deepEqual(round.json.datedRecords,expected.records);assert.deepEqual(round.json.result,expected.result);
  // Actual page remains usable without network once its local modules are loaded.
  await context.setOffline(true);await page.click('#run');const offline=await saveDownload(page,'#export-snapshot',`offline-${lang}-${width}`);assert.deepEqual(offline.json.input,expected.input);await context.setOffline(false);
  // Delay WebCrypto in the page to verify real-DOM Cancel prevents a late preview.
  await page.evaluate(()=>{window.__nativeDigest=crypto.subtle.digest.bind(crypto.subtle);window.__gates=[];crypto.subtle.digest=(...args)=>new Promise((resolve,reject)=>window.__gates.push({resolve:async()=>resolve(await window.__nativeDigest(...args)),reject:()=>reject(Error('intentional stale browser digest failure'))}));});
  await page.click('#dated-example');await page.click('#dated-preview');await page.waitForFunction(()=>window.__gates.length>0);await page.click('#dated-cancel');const cancel=await page.locator('#dated-status').textContent();await page.evaluate(()=>{window.__gates.forEach(g=>g.reject());crypto.subtle.digest=window.__nativeDigest});await page.waitForTimeout(50);assert.equal(await page.locator('#dated-status').textContent(),cancel);assert.equal(await page.locator('#dated-apply').isDisabled(),true);
  const originalDraft=await page.inputValue('#json-input');await page.dispatchEvent('#dated-file','cancel');await page.dispatchEvent('#import-run','cancel');assert.equal(await page.inputValue('#json-input'),originalDraft);record(`Dispatched cancel events ${lang} ${width}`,{nativeFileChooserCancelled:false,events:'synthetic DOM cancel dispatch only'});
  await page.screenshot({path:fileURLToPath(new URL(`final-${lang}-${width}.png`,out)),fullPage:true});record(`UI/download/restore/offline/cancel ${lang} ${width}`,{inputExact:true,resultRecomputed:true,diskFilesVerified:true});
  if(lang==='en'&&width===1440){
   // Stress uses the full legal fixture, never a reduced demonstration.
   const pressure=stressInput();await page.locator('details').filter({has:page.locator('#json-input')}).locator('summary').click();await page.fill('#json-input',JSON.stringify(pressure));await page.check('#dated-remove-confirm');await page.click('#dated-remove');await page.fill('#json-input',JSON.stringify(pressure));await page.click('#apply-json');
   for(const s of pressure.strata)for(const m of s.menus){await page.selectOption('#dated-stratum',s.id);await page.selectOption('#dated-menu',m.id);await page.click('#dated-example');await page.click('#dated-preview');await page.waitForFunction(()=>!document.querySelector('#dated-apply').disabled);await page.check('#dated-confirm');await page.click('#dated-apply');}
   await page.selectOption('#mode','period');await page.click('#run');const archive=await saveDownload(page,'#export-run','pressure-full');assert.ok(archive.json.result.results.length===729&&archive.json.datedRecords.length===18);assert.ok(report.downloads.at(-1).bytes>5*1024*1024);const recovery=await saveDownload(page,'#export-snapshot','pressure-small');assert.ok(report.downloads.at(-1).bytes<5*1024*1024);assert.deepEqual((await restoreDatedSnapshot(recovery.json)).result,run(pressure));record('Full-pressure browser disk recovery',{combinations:729,dateRecords:18});
  }
  await context.close();
 }
 assert.deepEqual(report.externalRequests,[]);assert.deepEqual(report.pageErrors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.fatal={message:String(e),stack:e.stack};process.exitCode=1;}finally{await browser?.close();await fs.writeFile(new URL('report.json',out),JSON.stringify(report,null,2)+'\n');}
