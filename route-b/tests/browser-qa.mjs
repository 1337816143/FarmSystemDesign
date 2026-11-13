/**
 * Real-DOM browser QA for a separately authorized environment.
 * Written but NOT executed for this cloud-only handoff. It never starts an HTTP server.
 * Requires preinstalled Playwright + Chromium and ROUTE_B_QA_URL pointing at a served B index.
 * Example for a permitted runner: ROUTE_B_QA_URL=https://approved-preview/route-b/index.html node tests/browser-qa.mjs
 */
import {BUILD} from '../src/build.generated.js';
import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
const target=process.env.ROUTE_B_QA_URL;
if(!target)throw new Error('Set ROUTE_B_QA_URL to an already served, authorized B page. This script does not start a server.');
const base=new URL(target);assert.ok(['http:','https:'].includes(base.protocol));
const {chromium}=await import('playwright');
const output=process.env.ROUTE_B_QA_OUTPUT_DIR?pathToFileURL(path.resolve(process.env.ROUTE_B_QA_OUTPUT_DIR)+path.sep):new URL('../evidence/browser-qa/',import.meta.url);await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});const outcomes=[];
const record=input=>({schema:'FarmSystemDesign.HainanRun',schemaVersion:1,input,result:{mode:'period-specific',search:{feasible:999}}});
async function check(name,fn){await fn();outcomes.push({name,pass:true});}
try{
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  const context=await browser.newContext({viewport,locale:'en-GB',acceptDownloads:true});
  await context.addInitScript(()=>{
   window.__storageWrites=[];const original=Storage.prototype.setItem;
   Storage.prototype.setItem=function(k,v){window.__storageWrites.push(k);return original.call(this,k,v)};
  });
  const page=await context.newPage(),errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
  const url=new URL(base);url.searchParams.set('lang','en');await page.goto(url.href,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('9 combinations; 5 satisfy'));
  const prefix=`${viewport.width}px`;
  const assertEnglish=async()=>{
   const untranslated=await page.evaluate(()=>{
    const out=[],walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
    while((node=walker.nextNode()))if(!node.parentElement.closest('script,style,textarea,[data-i18n-preserve]')&&/[\u3400-\u9fff]/u.test(node.nodeValue))out.push(node.nodeValue);
    for(const el of document.querySelectorAll('[aria-label],[title]'))for(const name of ['aria-label','title'])if(/[\u3400-\u9fff]/u.test(el.getAttribute(name)||''))out.push(el.getAttribute(name));
    return out;
   });assert.deepEqual(untranslated,[]);
  };
  const snapshot=()=>page.evaluate(()=>({json:document.querySelector('#json-input').value,mode:document.querySelector('#mode').value,selected:document.querySelector('#select-result').value,saveDisabled:document.querySelector('#save-run').disabled,exportDisabled:document.querySelector('#export-run').disabled}));
  const input=async()=>JSON.parse(await page.locator('#json-input').inputValue());
  await check(`${prefix}: English initialization, all research, table/chart/ARIA, no overflow`,async()=>{
   assert.match(await page.locator('#status').innerText(),/9 combinations; 5 satisfy/);assert.equal(await page.locator('#evidence details').count(),15);await assertEnglish();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
   await page.screenshot({path:fileURLToPath(new URL(`en-${viewport.width}.png`,output)),fullPage:true});
  });
  await check(`${prefix}: language switch preserves selected result, live controls and listeners`,async()=>{
   await page.locator('#select-result').selectOption({index:2});const before=await snapshot();
   for(const lang of ['both','zh','en']){await page.locator('#language').selectOption(lang);assert.deepEqual(await snapshot(),before);}
   await page.locator('#select-result').selectOption({index:1});assert.notEqual((await snapshot()).selected,before.selected);await assertEnglish();
  });
  await check(`${prefix}: bilingual scientific boundaries and mobile layout`,async()=>{
   await page.locator('#language').selectOption('both');assert.match(await page.locator('.notice').first().innerText(),/未.*校准.*Not empirically calibrated/s);
   assert.match(await page.locator('#results .gate').innerText(),/关闭.*closed/s);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
   await page.screenshot({path:fileURLToPath(new URL(`both-${viewport.width}.png`,output)),fullPage:true});await page.locator('#language').selectOption('en');
  });
  await check(`${prefix}: dirty input, unapplied JSON and live control nodes survive language change`,async()=>{
   await page.locator('details:has(#json-input) > summary').click();
   const field=page.locator('[data-input="waterSources.0.capacity.0"]');await field.fill('175');await field.evaluate(el=>window.__editedControl=el);await page.locator('#json-input').fill('UNAPPLIED JSON');const before=await snapshot();
   await page.locator('#language').selectOption('both');assert.deepEqual(await snapshot(),before);assert.equal(await field.inputValue(),'175');assert.ok(await field.evaluate(el=>el===window.__editedControl));assert.equal(await page.locator('#export-run').isDisabled(),true);
   await page.locator('#language').selectOption('en');await page.locator('#run').click();assert.equal(await page.locator('#json-input').inputValue(),'UNAPPLIED JSON');await page.locator('#discard-json-draft').click();assert.equal((await input()).waterSources[0].capacity[0],175);await page.locator('#reset').click();
  });
  await check(`${prefix}: annual comparison, versions, reset and restore`,async()=>{
   await page.locator('#mode').selectOption('annual');await page.locator('#run').click();assert.match(await page.locator('#status').innerText(),/8 satisfy/);await page.locator('#save-run').click();await page.locator('#language').selectOption('both');await page.locator('#reset').click();await page.locator('[data-restore="0"]').click();assert.equal(await page.locator('#mode').inputValue(),'annual');await page.locator('#language').selectOption('en');assert.match(await page.locator('#status').innerText(),/8 satisfy/);await page.locator('#reset').click();
  });
  await check(`${prefix}: JSON rejection and N/P error text in English and bilingual`,async()=>{
   await page.locator('#json-input').fill('{broken');await page.locator('#apply-json').click();assert.match(await page.locator('#json-status').innerText(),/JSON parsing failed/);await page.locator('#np-f').fill('0');await page.locator('#run-np').click();assert.match(await page.locator('#np-result').innerText(),/must be in/);await page.locator('#language').selectOption('both');assert.match(await page.locator('#np-result').innerText(),/必须在.*must be in/s);await page.locator('#language').selectOption('en');await page.locator('#np-f').fill('1');await page.locator('#run-np').click();await page.locator('#reset').click();await assertEnglish();
  });
  await check(`${prefix}: no-feasible and signed/zero-margin output`,async()=>{
   const original=await input();let changed=structuredClone(original);changed.waterSources[0].capacity=[0,0];
   await page.locator('#json-input').fill(JSON.stringify(changed));await page.locator('#apply-json').click();assert.match(await page.locator('#results').innerText(),/No feasible solution/);await assertEnglish();
   for(const margin of [-100,0]){changed=structuredClone(original);changed.strata.forEach(s=>s.menus.forEach(m=>m.grossMarginCny=margin));await page.locator('#json-input').fill(JSON.stringify(changed));await page.locator('#apply-json').click();assert.ok((await page.locator('#results').innerText()).includes(`¥${margin*2}`));assert.doesNotMatch(await page.locator('#results').innerText(),/No feasible solution/);await assertEnglish();}await page.locator('#reset').click();
  });
  await check(`${prefix}: actual download/import roundtrip recalculates forged output`,async()=>{
   const downloadEvent=page.waitForEvent('download');await page.locator('#export-run').click();const download=await downloadEvent;const path=await download.path();const saved=JSON.parse(await fs.readFile(path,'utf8'));assert.equal(saved.result.search.feasible,5);assert.equal(saved.build.version,BUILD.version);
   saved.result.search.feasible=999;await page.locator('#import-run').setInputFiles({name:'forged.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('independently recalculated'));assert.match(await page.locator('#status').innerText(),/5 satisfy/);await assertEnglish();
  });
  await check(`${prefix}: language change does not invalidate a pending legitimate import`,async()=>{
   const changed=await input();changed.waterSources[0].capacity=[200,200];
   await page.evaluate(()=>{window.__originalFileText=File.prototype.text;File.prototype.text=function(){return new Promise(resolve=>{window.__releaseFile=()=>window.__originalFileText.call(this).then(resolve)})}});
   await page.locator('#import-run').setInputFiles({name:'delayed.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(record(changed)))});await page.waitForFunction(()=>typeof window.__releaseFile==='function');await page.locator('#language').selectOption('both');await page.evaluate(()=>window.__releaseFile());await page.waitForFunction(()=>JSON.parse(document.querySelector('#json-input').value).waterSources[0].capacity[0]===200);await page.locator('#language').selectOption('en');await page.evaluate(()=>{File.prototype.text=window.__originalFileText});await assertEnglish();
  });
  await check(`${prefix}: stale import remains invalidated after reset plus language switch`,async()=>{
   const changed=await input();changed.waterSources[0].capacity=[0,0];
   await page.evaluate(()=>{window.__releaseFile=null;File.prototype.text=function(){return new Promise(resolve=>{window.__releaseFile=()=>window.__originalFileText.call(this).then(resolve)})}});
   await page.locator('#import-run').setInputFiles({name:'stale.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(record(changed)))});await page.waitForFunction(()=>typeof window.__releaseFile==='function');await page.locator('#reset').click();await page.locator('#language').selectOption('both');const before=await snapshot();await page.evaluate(()=>window.__releaseFile());assert.deepEqual(await snapshot(),before);await page.evaluate(()=>{File.prototype.text=window.__originalFileText});await page.locator('#language').selectOption('en');await assertEnglish();
  });
  await check(`${prefix}: custom identities and marker-like data survive native DOM/option text, toggles and export`,async()=>{
   await page.locator('#reset').click();const x=await input();
   const raw='自定义项目方案组合\uE000B:0\uE001<img src=x onerror="alert(1)">&lt;script&gt;：A，B；C。';
   x.strata[0].label=raw;x.strata[0].id=raw;x.strata[0].menus[0].label=raw;x.strata[0].menus[0].id=raw;x.waterSources[0].label=raw;x.waterSources[0].id=raw;x.strata.forEach(s=>s.waterSourceId=raw);x.periods[0]=raw;x.strata[0].menus[0].landClass=raw;
   await page.locator('#import-run').setInputFiles({name:'custom-identity.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(record(x)))});await page.waitForFunction(expected=>JSON.parse(document.querySelector('#json-input').value).strata[0].id===expected,raw);
   await page.locator('#select-result').selectOption('1-0-0|0-0-1');
   for(const lang of ['zh','both','en']){await page.locator('#language').selectOption(lang);assert.ok((await page.locator('#controls').textContent()).includes(raw));assert.ok((await page.locator('#menus').textContent()).includes(raw));assert.ok((await page.locator('#results').textContent()).includes(raw));assert.equal(await page.locator('[data-input="strata.0.waterSourceId"] option').first().getAttribute('value'),raw);assert.equal(await page.locator('[data-input="strata.0.waterSourceId"] option').first().textContent(),raw);assert.equal(await page.locator('#controls img,#menus img,#results img').count(),0);const ev=page.waitForEvent('download');await page.locator('#export-run').click();const downloaded=await ev;assert.deepEqual(JSON.parse(await fs.readFile(await downloaded.path(),'utf8')).input,x);}
   await page.locator('#reset').click();await assertEnglish();
  });
  await check(`${prefix}: no storage writes, uncaught errors or external runtime requests`,async()=>{
   assert.deepEqual(await page.evaluate(()=>window.__storageWrites),[]);assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(request=>!request.startsWith('blob:')&&new URL(request).origin!==base.origin),[]);
  });
  await context.close();
 }
 await fs.writeFile(new URL('results.json',output),JSON.stringify({passed:outcomes.length,failed:0,outcomes},null,2));
 console.log(`${outcomes.length} real browser checks passed.`);
}finally{await browser.close()}
