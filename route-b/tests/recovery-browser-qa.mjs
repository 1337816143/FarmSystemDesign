/**
 * PENDING REAL-BROWSER QA: authored, NOT RUN in the cloud-only implementation pass.
 * This script does not start a server, install software, publish, deploy, or invoke CI.
 * Run only in a separately authorized browser environment with Playwright/Chromium
 * already installed and an already served, authorized URL for this exact candidate.
 * See docs/RECOVERY_BROWSER_PLAN.md for prerequisites and evidence limitations.
 *
 * ROUTE_B_RECOVERY_QA_AUTHORIZED=yes ROUTE_B_QA_URL=https://approved-host/route-b/index.html \
 *   node tests/recovery-browser-qa.mjs
 */
import {BUILD} from '../src/build.generated.js';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {defaultInput} from '../src/fixture.js';
import {run, ENGINE_VERSION} from '../src/engine.js';
import {stressInput} from './recovery-fixture.mjs';

const target = process.env.ROUTE_B_QA_URL;
if (process.env.ROUTE_B_RECOVERY_QA_AUTHORIZED !== 'yes' || !target) {
  throw new Error('Pending QA only. Set ROUTE_B_RECOVERY_QA_AUTHORIZED=yes and ROUTE_B_QA_URL only after browser execution is authorized. No server is started by this script.');
}
const base = new URL(target);
assert.ok(['https:', 'http:'].includes(base.protocol), 'Use the already served authorized HTTP(S) page');
const VERSION = BUILD.version;
const LIMIT = 5 * 1024 * 1024;
const output = process.env.ROUTE_B_QA_OUTPUT_DIR ? path.resolve(process.env.ROUTE_B_QA_OUTPUT_DIR) : fileURLToPath(new URL('../evidence/recovery-browser-qa/', import.meta.url));
const languages = ['zh', 'en', 'both'];
const viewports = [{width: 1440, height: 1000}, {width: 390, height: 844}];
const outcomes = [];
const environments = [];
const downloads = [];
let artifactSequence = 0;
let fatal = null;
await fs.mkdir(output, {recursive: true});

// An independent Node oracle: deliberately do not import recovery.js's hash or
// canonicalizer. Input is ordinary JSON without prototypes or non-JSON values.
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
function digestWithoutIntegrity(record) {
  const unsigned = structuredClone(record);
  delete unsigned.integrity;
  return createHash('sha256').update(canonical(unsigned), 'utf8').digest('hex');
}
function resign(record) {
  record.integrity.digest = digestWithoutIntegrity(record);
  return record;
}
function fullRecord(input, annual = false) {
  return {schema: 'FarmSystemDesign.HainanRun', schemaVersion: 1, input,
    engineVersion: ENGINE_VERSION, result: run(input, {annual})};
}
function assertSnapshot(record, expectedInput, annual = false, maxCombinations = 2000) {
  assert.equal(record.schema, 'FarmSystemDesign.HainanInputSnapshot');
  assert.equal(record.schemaVersion, 1);
  assert.equal(record.engineVersion, ENGINE_VERSION);
  assert.deepEqual(record.inputContract, {schema: 'FarmSystemDesign.HainanMenus', schemaVersion: 1});
  assert.deepEqual(record.input, expectedInput, 'Complete raw original input survives byte-level JSON decoding');
  assert.deepEqual(record.runConfig, {annual, maxCombinations, mode: annual ? 'annual-diagnostic' : 'period-specific'});
  assert.equal(record.integrity.algorithm, 'SHA-256');
  assert.equal(record.integrity.canonicalization, 'sorted-json-v1');
  assert.equal(record.integrity.scope, 'snapshot-without-integrity');
  assert.match(record.integrity.digest, /^[0-9a-f]{64}$/u);
  assert.equal(record.integrity.digest, digestWithoutIntegrity(record), 'Independent Node SHA-256 agrees');
  assert.equal(Object.hasOwn(record, 'result'), false, 'Snapshot cannot embed full audit results');
  assert.equal(Object.hasOwn(record, 'results'), false);
  assert.equal(Object.hasOwn(record, 'frontier'), false);
  assert.equal(Object.hasOwn(record, 'menuChecks'), false);
  const expected = run(expectedInput, {annual, maxCombinations});
  assert.deepEqual(record.summary, {
    mode: expected.mode, total: expected.search.total, evaluated: expected.search.evaluated,
    feasible: expected.search.feasible, frontier: expected.search.frontier, complete: expected.search.complete,
  }, 'Summary is fixed search metadata, never per-combination output');
  assert.ok(Buffer.byteLength(JSON.stringify(record), 'utf8') <= LIMIT);
}
async function check(name, fn) {
  const started = Date.now();
  try {
    await fn();
    outcomes.push({name, status: 'passed', durationMs: Date.now() - started});
  } catch (error) {
    outcomes.push({name, status: 'failed', durationMs: Date.now() - started, error: error.stack || String(error)});
    throw error;
  }
}
async function settle(page) {
  // Flush completion handlers and a browser paint. Stale-work assertions are made
  // after releasing the actual promise, not after an arbitrary short sleep.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function rawInput(page) { return JSON.parse(await page.locator('#json-input').inputValue()); }
async function rawState(page) {
  return page.evaluate(() => ({
    input: document.querySelector('#json-input').value,
    mode: document.querySelector('#mode').value,
    selected: document.querySelector('#select-result')?.value,
    buttons: ['#save-run', '#export-run', '#export-snapshot'].map(selector => document.querySelector(selector).disabled),
    controls: [...document.querySelectorAll('#controls input,#controls select')].map(el => [el.dataset.input, el.value]),
  }));
}
async function rememberControlNodes(page) {
  await page.evaluate(() => { window.__recoveryControlNodes = [...document.querySelectorAll('#controls input,#controls select')]; });
}
async function assertControlNodesRetained(page) {
  assert.ok(await page.evaluate(() => {
    const current = [...document.querySelectorAll('#controls input,#controls select')];
    return current.length === window.__recoveryControlNodes.length
      && current.every((node, index) => node === window.__recoveryControlNodes[index]);
  }), 'Language changes retain the live native control nodes');
}
async function visibleState(page) {
  return {...await rawState(page), ...await page.evaluate(() => ({
    status: document.querySelector('#status').textContent,
    statusClass: document.querySelector('#status').className,
    snapshotStatus: document.querySelector('#snapshot-status').textContent,
    jsonStatus: document.querySelector('#json-status').textContent,
    result: document.querySelector('#results').textContent,
    resultClass: document.querySelector('#results').className,
    versions: document.querySelector('#versions').textContent,
  }))};
}
async function inputFile(page, record, name = 'input.json') {
  await page.locator('#import-run').setInputFiles({name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(record))});
}
async function applyInput(page, input) {
  await page.locator('details:has(#json-input)').evaluate(el => { el.open = true; });
  await page.locator('#json-input').fill(JSON.stringify(input));
  await page.locator('#apply-json').click();
  assert.deepEqual(await rawInput(page), input);
  assert.equal(await page.locator('#export-snapshot').isDisabled(), false);
}
async function waitForImported(page, expectedInput) {
  await page.waitForFunction(expected => {
    // Compare parsed JSON values without imposing an object-property order. The
    // imported input retains its original ordering; only the hash is canonical.
    const ordered = value => value && typeof value === 'object'
      ? Array.isArray(value) ? value.map(ordered) : Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]))
      : value;
    let actual;
    try { actual = JSON.parse(document.querySelector('#json-input').value); }
    catch { return false; }
    const status = document.querySelector('#status');
    return JSON.stringify(ordered(actual)) === JSON.stringify(ordered(expected))
      && /独立重算|independently (?:recalculated|recomputed)/u.test(status.textContent);
  }, expectedInput);
}
async function assertRecoveryStatus(page, language) {
  const message = await page.locator('#status').innerText();
  if (language !== 'en') {
    assert.match(message, /独立重算/u);
    assert.match(message, /原(?:始)?.*完整.*(?:审计|结果)|原始全量/u);
    assert.match(message, /未(?:载入|加载|导入)/u);
  }
  if (language !== 'zh') {
    assert.match(message, /independently (?:recalculated|recomputed)/iu);
    assert.match(message, /original full audit results/iu);
    assert.match(message, /not (?:loaded|imported)/iu);
  }
}
async function snapshotDownload(page, stem) {
  const event = page.waitForEvent('download');
  await page.locator('#export-snapshot').click();
  const download = await event;
  return persistDownload(download, stem);
}
async function persistDownload(download, stem) {
  const destination = path.join(output, `${String(++artifactSequence).padStart(3, '0')}-${stem}.json`);
  await download.saveAs(destination);
  assert.equal(await download.failure(), null);
  const bytes = await fs.readFile(destination);
  const record = JSON.parse(bytes.toString('utf8'));
  const item = {path: destination, suggestedFilename: download.suggestedFilename(), byteLength: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex')};
  downloads.push(item);
  return {...item, record};
}
async function archiveDownload(page, stem) {
  const event = page.waitForEvent('download');
  await page.locator('#export-run').click();
  return persistDownload(await event, stem);
}
async function assertComputed(page, input, annual = false, maxCombinations = 2000) {
  const expected = run(input, {annual, maxCombinations});
  const archive = await archiveDownload(page, 'recomputed-full-archive');
  assert.equal(archive.record.schema, 'FarmSystemDesign.HainanRun');
  assert.equal(archive.record.build.version, VERSION);
  assert.deepEqual(archive.record.input, input);
  assert.deepEqual(archive.record.result, expected, 'Downloaded full result equals a fresh local engine run');
  assert.equal(await page.locator('#select-result option').count(), expected.search.evaluated);
  return archive;
}
async function installDigestGate(page) {
  await page.evaluate(() => {
    if (!globalThis.crypto?.subtle) throw new Error('This browser URL lacks WebCrypto; use an authorized secure context');
    const prototype = Object.getPrototypeOf(crypto.subtle);
    const original = prototype.digest;
    const gate = {entries: [], prototype, original};
    prototype.digest = function (...args) {
      // Attach rejection handling immediately to avoid artificial pageerror events.
      const actual = original.apply(this, args).then(value => ({value}), error => ({error}));
      return new Promise((resolve, reject) => gate.entries.push({actual, resolve, reject, released: false}));
    };
    window.__recoveryDigestGate = gate;
  });
}
async function waitForDigests(page, count = 1) {
  await page.waitForFunction(expected => window.__recoveryDigestGate.entries.length >= expected, count);
}
async function releaseDigest(page, index = 0, reject = false) {
  await page.evaluate(async ({index, reject}) => {
    const entry = window.__recoveryDigestGate.entries[index];
    if (!entry || entry.released) throw new Error('Missing or already released digest');
    entry.released = true;
    const actual = await entry.actual;
    if (reject) entry.reject(new DOMException('QA simulated SHA-256 failure', 'OperationError'));
    else if (actual.error) entry.reject(actual.error);
    else entry.resolve(actual.value);
  }, {index, reject});
  await settle(page);
}
async function removeDigestGate(page) {
  await page.evaluate(() => {
    const gate = window.__recoveryDigestGate;
    if (!gate) return;
    if (gate.entries.some(entry => !entry.released)) throw new Error('Do not discard an unresolved digest test');
    gate.prototype.digest = gate.original;
    delete window.__recoveryDigestGate;
  });
}
async function freshContext(browser, viewport, language) {
  const context = await browser.newContext({viewport, locale: 'en-GB', acceptDownloads: true});
  await context.addInitScript(() => {
    window.__recoveryReads = [];
    window.__recoveryStorageWrites = [];
    const read = File.prototype.text;
    File.prototype.text = function (...args) {
      window.__recoveryReads.push({name: this.name, size: this.size});
      return read.apply(this, args);
    };
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      window.__recoveryStorageWrites.push(key);
      return write.call(this, key, value);
    };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  const errors = [], requests = [], pageDownloads = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  page.on('download', download => pageDownloads.push(download));
  const url = new URL(base);
  url.searchParams.set('lang', language);
  await page.goto(url.href, {waitUntil: 'networkidle'});
  await page.locator('#export-snapshot').waitFor();
  const build = await page.locator('#build-line').innerText();
  assert.ok(build.includes(VERSION), `Wrong candidate at ${url.href}: ${build}`);
  environments.push({viewport, language, build, url: url.href, browser: await browser.version()});
  return {context, page, errors, requests, pageDownloads};
}
async function assertNoRuntimeLeak(session) {
  assert.deepEqual(session.errors, []);
  assert.deepEqual(await session.page.evaluate(() => window.__recoveryStorageWrites), []);
  assert.deepEqual(session.requests.filter(url => !url.startsWith('blob:') && new URL(url).origin !== base.origin), []);
}

const {chromium} = await import('playwright');
const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try {
  // Native input controls, native download events, saveAs, reload and on-disk file
  // selections are exercised in every language at desktop and narrow widths.
  for (const viewport of viewports) for (const language of languages) {
    const session = await freshContext(browser, viewport, language);
    const {page, context} = session;
    const prefix = `${viewport.width}px/${language}`;
    try {
      let saved;
      const input = defaultInput();
      input.strata[0].label = '自定义项目方案组合\uE000B:0\uE001<img src=x onerror="alert(1)">&lt;script&gt;：A，B；C。';
      input.strata[0].id = '项目\uE000B:1\uE001';
      input.strata[0].menus[0].label = input.strata[0].label;
      input.strata[0].menus[0].id = '组合\uE000B:2\uE001';
      input.periods[0] = '模拟期1\uE000B:3\uE001';
      input.waterSources[0].label = input.strata[0].label;
      input.waterSources[0].id = '水源\uE000B:4\uE001';
      input.strata.forEach(stratum => { stratum.waterSourceId = input.waterSources[0].id; });
      await check(`${prefix}: native snapshot download preserves custom data and contract`, async () => {
        await applyInput(page, input);
        saved = await snapshotDownload(page, `${viewport.width}-${language}-custom-snapshot`);
        assertSnapshot(saved.record, input);
        assert.ok((await page.locator('#controls').textContent()).includes(input.strata[0].label));
        assert.equal(await page.locator('#controls img,#menus img,#results img').count(), 0);
        await rememberControlNodes(page);
        for (const next of languages) {
          const before = await rawState(page);
          await page.locator('#language').selectOption(next);
          assert.deepEqual(await rawState(page), before, 'Language changes never translate or replace raw state');
          await assertControlNodesRetained(page);
        }
        await page.locator('#language').selectOption(language);
      });
      await check(`${prefix}: saved disk file → reload → native file input restores and independently recomputes`, async () => {
        await page.reload({waitUntil: 'networkidle'});
        assert.deepEqual(await rawInput(page), defaultInput(), 'Reload loses in-memory data before restoration');
        await page.locator('#import-run').setInputFiles(saved.path);
        await waitForImported(page, input);
        await assertRecoveryStatus(page, language);
        await assertComputed(page, input);
        assert.equal(await page.locator('#import-run').inputValue(), '', 'Same-file selection is available again');
        await page.locator('#reset').click();
        await page.locator('#import-run').setInputFiles(saved.path);
        await waitForImported(page, input);
        assert.deepEqual(await rawInput(page), input);
      });
      await check(`${prefix}: annual mode survives native disk snapshot restoration`, async () => {
        await page.locator('#mode').selectOption('annual');
        assert.equal(await page.locator('#export-snapshot').isDisabled(), true);
        await page.locator('#run').click();
        const annual = await snapshotDownload(page, `${viewport.width}-${language}-annual-snapshot`);
        assertSnapshot(annual.record, input, true);
        await page.locator('#reset').click();
        await page.locator('#import-run').setInputFiles(annual.path);
        await waitForImported(page, input);
        assert.equal(await page.locator('#mode').inputValue(), 'annual');
        await assertRecoveryStatus(page, language);
        await assertComputed(page, input, true);
      });
      await check(`${prefix}: recovery actions/status layout and escaped labels`, async () => {
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal page overflow');
        assert.equal(await page.locator('#controls img,#menus img,#results img').count(), 0);
        await page.screenshot({path: path.join(output, `${viewport.width}-${language}-restored.png`), fullPage: true});
        const labels = await page.locator('#export-run,#export-snapshot,label:has(#import-run)').allTextContents();
        for (const text of labels) {
          if (language !== 'en') assert.match(text, /[\u3400-\u9fff]/u);
          if (language !== 'zh') assert.match(text, /[A-Za-z]{3}/u);
          if (language === 'en') assert.doesNotMatch(text, /[\u3400-\u9fff]/u);
        }
        await assertNoRuntimeLeak(session);
      });
    } finally { await context.close(); }
  }

  const session = await freshContext(browser, viewports[0], 'en');
  const {page, context, pageDownloads} = session;
  try {
    const initial = defaultInput();
    let valid;
    await check('default: archive output is retained separately from compact recovery', async () => {
      const full = await assertComputed(page, initial);
      assert.equal(full.record.result.results.length, 9);
      assert.equal(full.record.result.search.feasible, 5);
      valid = await snapshotDownload(page, 'default-snapshot');
      assertSnapshot(valid.record, initial);
      const forged = structuredClone(full.record);
      forged.result.search.feasible = 999;
      await inputFile(page, forged, 'forged-full-results.json');
      await waitForImported(page, initial);
      await assertComputed(page, initial);
    });
    await check('file size: >5 MiB rejected before File.text; no input or result adopted', async () => {
      await page.locator('#reset').click();
      const before = await rawState(page);
      const reads = await page.evaluate(() => window.__recoveryReads.length);
      const oversized = path.join(output, 'oversized-5mib-plus-one.json');
      await fs.writeFile(oversized, Buffer.alloc(LIMIT + 1, 0x20));
      await page.locator('#import-run').setInputFiles(oversized);
      await page.waitForFunction(() => /5\s*M(?:i)?B|5\s*MB/iu.test(document.querySelector('#status').textContent));
      assert.equal(await page.evaluate(() => window.__recoveryReads.length), reads);
      assert.equal((await rawState(page)).input, before.input);
      assert.equal((await rawState(page)).mode, before.mode);
      assert.equal((await rawState(page)).selected, before.selected);
    });
    for (const [name, mutate] of [
      ['changed raw input', r => { r.input.strata[0].label += ' tampered'; }],
      ['changed mode', r => { r.runConfig.annual = true; r.runConfig.mode = 'annual-diagnostic'; }],
      ['changed summary', r => { r.summary.feasible = 999; }],
      ['re-signed forged summary', r => { r.summary.feasible = 999; resign(r); }],
      ['re-signed embedded results', r => { r.results = []; resign(r); }],
      ['changed digest', r => { r.integrity.digest = '0'.repeat(64); }],
      ['unsupported algorithm', r => { r.integrity.algorithm = 'SHA-1'; }],
      ['unsupported canonicalization', r => { r.integrity.canonicalization = 'JSON.stringify'; }],
      ['unsupported scope', r => { r.integrity.scope = 'input-only'; }],
      ['missing integrity', r => { delete r.integrity; }],
    ]) {
      await check(`integrity: ${name} is rejected and existing data stays intact`, async () => {
        await page.locator('#reset').click();
        const before = await rawState(page);
        const changed = structuredClone(valid.record);
        mutate(changed);
        await inputFile(page, changed, `${name.replaceAll(' ', '-')}.json`);
        await page.waitForFunction(() => document.querySelector('#status').classList.contains('error'));
        assert.equal((await rawState(page)).input, before.input);
        assert.equal((await rawState(page)).mode, before.mode);
        assert.equal((await rawState(page)).selected, before.selected);
        assert.equal(await page.locator('#export-snapshot').isDisabled(), true);
      });
    }
    await check('canonicalization: reordered envelope/input top-level keys keep the digest and original input order', async () => {
      // The unchanged engine validates objective records with JSON.stringify and
      // therefore requires their existing {key,direction} field order. Do not
      // recursively reorder nested records or imply a broader engine contract.
      const reordered = Object.fromEntries(Object.entries(structuredClone(valid.record)).reverse());
      reordered.input = Object.fromEntries(Object.entries(reordered.input).reverse());
      assert.equal(reordered.integrity.digest, digestWithoutIntegrity(reordered));
      await inputFile(page, reordered, 'reordered-keys.json');
      await waitForImported(page, initial);
      assert.deepEqual(Object.keys(await rawInput(page)), Object.keys(reordered.input), 'Import preserves original input field order');
      assert.deepEqual(Object.keys((await rawInput(page)).objectives[0]), ['key', 'direction']);
      await assertComputed(page, initial);
    });
    await check('fixed configuration: a re-signed cap of 9 is rejected; normal 2000 roundtrip still works', async () => {
      await page.locator('#reset').click();
      const before = await rawState(page);
      const changed = structuredClone(valid.record);
      changed.runConfig.maxCombinations = 9;
      resign(changed);
      await inputFile(page, changed, 'unsupported-lower-cap.json');
      await page.waitForFunction(() => document.querySelector('#status').classList.contains('error'));
      assert.equal((await rawState(page)).input, before.input);
      assert.equal((await rawState(page)).mode, before.mode);
      assert.match(await page.locator('#status').innerText(), /configuration.*invalid|invalid.*configuration/iu);
      await page.locator('#import-run').setInputFiles(valid.path);
      await waitForImported(page, initial);
      assertSnapshot((await snapshotDownload(page, 'fixed-2000-roundtrip')).record, initial);
    });
    await check('SHA failure: rejected digest reports error without a download or false success', async () => {
      await page.locator('#reset').click();
      await installDigestGate(page);
      const count = pageDownloads.length;
      await page.locator('#export-snapshot').click();
      await waitForDigests(page);
      await releaseDigest(page, 0, true);
      assert.equal(pageDownloads.length, count);
      assert.match(await page.locator('#snapshot-status').innerText(), /failed|failure|error|unavailable/iu);
      assert.equal(await page.locator('#export-snapshot').isDisabled(), false, 'User can retry after a digest failure');
      await removeDigestGate(page);
      assertSnapshot((await snapshotDownload(page, 'after-sha-error-retry')).record, initial);
    });
    await check('SHA missing: unavailable WebCrypto produces an explicit error and no download', async () => {
      await page.locator('#reset').click();
      await page.evaluate(() => {
        window.__recoverySubtleDescriptor = Object.getOwnPropertyDescriptor(crypto, 'subtle');
        Object.defineProperty(crypto, 'subtle', {value: undefined, configurable: true});
      });
      const count = pageDownloads.length;
      try {
        await page.locator('#export-snapshot').click();
        await page.waitForFunction(() => /SHA|crypto|digest/iu.test(document.querySelector('#snapshot-status').textContent)
          && /failed|failure|error|unavailable|requires|not available/iu.test(document.querySelector('#snapshot-status').textContent));
        assert.equal(pageDownloads.length, count);
      } finally {
        await page.evaluate(() => {
          const descriptor = window.__recoverySubtleDescriptor;
          if (descriptor) Object.defineProperty(crypto, 'subtle', descriptor);
          else delete crypto.subtle;
          delete window.__recoverySubtleDescriptor;
        });
      }
    });
    await check('duplicate preparation: repeated activation creates one hash and one native download', async () => {
      await page.locator('#reset').click();
      await installDigestGate(page);
      const count = pageDownloads.length;
      await page.locator('#export-snapshot').click();
      await waitForDigests(page);
      assert.equal(await page.locator('#export-snapshot').isDisabled(), true);
      assert.match(await page.locator('#snapshot-status').innerText(), /prepar|generat|hash/iu);
      await page.locator('#export-snapshot').evaluate(button => { button.click(); button.click(); });
      assert.equal(await page.evaluate(() => window.__recoveryDigestGate.entries.length), 1);
      const event = page.waitForEvent('download');
      await releaseDigest(page);
      assertSnapshot((await persistDownload(await event, 'duplicate-click-single-snapshot')).record, initial);
      assert.equal(pageDownloads.length, count + 1);
      assert.match(await page.locator('#snapshot-status').innerText(), /download|saved|ready|success/iu);
      await removeDigestGate(page);
    });

    const stateChanges = [
      ['reset', async () => page.locator('#reset').click()],
      ['edit control', async () => page.locator('[data-input="waterSources.0.capacity.0"]').fill('175')],
      ['edit unapplied JSON', async () => {
        await page.locator('details:has(#json-input)').evaluate(el => { el.open = true; });
        await page.locator('#json-input').fill('{"unapplied":true}');
      }],
      ['change mode', async () => page.locator('#mode').selectOption('annual')],
      ['apply JSON', async () => {
        const changed = defaultInput(); changed.waterSources[0].capacity = [200, 200];
        await applyInput(page, changed);
      }],
      ['restore session version', async () => page.locator('[data-restore="0"]').click()],
      ['new full-archive import', async () => {
        const changed = defaultInput(); changed.waterSources[0].capacity = [201, 201];
        await inputFile(page, fullRecord(changed), 'newer-full-run.json');
        await waitForImported(page, changed);
      }],
    ];
    await page.locator('#reset').click();
    await page.locator('#save-run').click();
    for (const [name, action] of stateChanges) for (const reject of [false, true]) {
      await check(`stale snapshot: ${name} suppresses late ${reject ? 'failure' : 'success'} and download`, async () => {
        await page.locator('#reset').click();
        await installDigestGate(page);
        const count = pageDownloads.length;
        await page.locator('#export-snapshot').click();
        await waitForDigests(page);
        await action();
        const afterAction = await visibleState(page);
        await releaseDigest(page, 0, reject);
        assert.equal(pageDownloads.length, count);
        assert.deepEqual(await visibleState(page), afterAction, 'Stale completion cannot write controls, results, buttons or statuses');
        await removeDigestGate(page);
      });
    }
    await check('new snapshot import wins over an older in-flight snapshot download', async () => {
      await page.locator('#reset').click();
      await installDigestGate(page);
      const count = pageDownloads.length;
      await page.locator('#export-snapshot').click();
      await waitForDigests(page);
      const changed = structuredClone(valid.record);
      changed.input.strata[0].label = 'newer recovered input';
      resign(changed);
      await inputFile(page, changed, 'newer-recovery.json');
      await waitForDigests(page, 2);
      await releaseDigest(page, 1);
      await waitForImported(page, changed.input);
      const afterImport = await visibleState(page);
      await releaseDigest(page, 0);
      assert.equal(pageDownloads.length, count);
      assert.deepEqual(await visibleState(page), afterImport);
      await removeDigestGate(page);
    });
    for (const [name, action] of stateChanges) for (const reject of [false, true]) {
      await check(`stale snapshot import: ${name} suppresses late verification ${reject ? 'failure' : 'success'}`, async () => {
        await page.locator('#reset').click();
        await installDigestGate(page);
        const changed = structuredClone(valid.record);
        changed.input.strata[0].label = 'stale recovered input';
        resign(changed);
        const count = pageDownloads.length;
        await inputFile(page, changed, 'stale-recovery.json');
        await waitForDigests(page);
        await action();
        const afterAction = await visibleState(page);
        await releaseDigest(page, 0, reject);
        assert.equal(pageDownloads.length, count);
        assert.deepEqual(await visibleState(page), afterAction);
        await removeDigestGate(page);
      });
    }
    await check('language switches retain pending download, raw JSON and custom labels', async () => {
      await page.locator('#reset').click();
      const changed = defaultInput();
      changed.strata[0].label = '自定义\uE000B:0\uE001 project 组合';
      await applyInput(page, changed);
      await installDigestGate(page);
      await page.locator('#export-snapshot').click();
      await waitForDigests(page);
      const before = await rawState(page);
      await rememberControlNodes(page);
      for (const language of languages) {
        await page.locator('#language').selectOption(language);
        assert.deepEqual(await rawState(page), before);
        await assertControlNodesRetained(page);
        const text = await page.locator('#snapshot-status').innerText();
        if (language !== 'en') assert.match(text, /[\u3400-\u9fff]/u);
        if (language !== 'zh') assert.match(text, /prepar|generat|hash/iu);
      }
      const event = page.waitForEvent('download');
      await releaseDigest(page);
      assertSnapshot((await persistDownload(await event, 'language-pending-snapshot')).record, changed);
      await removeDigestGate(page);
    });
    await check('language switches retain pending import and localized recovery disclosure', async () => {
      await page.locator('#reset').click();
      await installDigestGate(page);
      await inputFile(page, valid.record, 'language-pending-import.json');
      await waitForDigests(page);
      const before = await rawState(page);
      await rememberControlNodes(page);
      for (const language of languages) {
        await page.locator('#language').selectOption(language);
        assert.deepEqual(await rawState(page), before);
        await assertControlNodesRetained(page);
      }
      await releaseDigest(page);
      await waitForImported(page, initial);
      await removeDigestGate(page);
      for (const language of languages) {
        await page.locator('#language').selectOption(language);
        await assertRecoveryStatus(page, language);
      }
      await page.locator('#language').selectOption('en');
    });
    await check('pressure: oversized full archive remains exportable; compact disk snapshot restores 729 combinations', async () => {
      const pressure = stressInput();
      assert.equal(pressure.strata.length, 6);
      assert.ok(pressure.strata.every(stratum => stratum.menus.length === 3));
      assert.equal(pressure.periods.length, 24);
      await applyInput(page, pressure);
      const full = await archiveDownload(page, 'pressure-full-archive');
      assert.ok(full.byteLength > LIMIT, 'Fixture must reproduce the oversized full-record problem');
      assert.equal(full.record.result.search.evaluated, 729);
      assert.equal(full.record.result.search.feasible, 0);
      const compact = await snapshotDownload(page, 'pressure-recovery-snapshot');
      assertSnapshot(compact.record, pressure);
      assert.ok(compact.byteLength < LIMIT);
      assert.ok(compact.byteLength < full.byteLength / 10, 'Recovery avoids bulky audit output');
      await page.reload({waitUntil: 'networkidle'});
      assert.deepEqual(await rawInput(page), defaultInput());
      const reads = await page.evaluate(() => window.__recoveryReads.length);
      await page.locator('#import-run').setInputFiles(full.path);
      await page.waitForFunction(() => /5\s*M(?:i)?B/iu.test(document.querySelector('#status').textContent));
      assert.equal(await page.evaluate(() => window.__recoveryReads.length), reads, 'Actual oversized archive rejected before reading bytes');
      await page.locator('#import-run').setInputFiles(compact.path);
      await waitForImported(page, pressure);
      await assertRecoveryStatus(page, 'en');
      await assertComputed(page, pressure);
    });
    await check('offline: already loaded modules support disk recovery and both native downloads', async () => {
      // Load/reload ONLINE first. This does not test or promise cold-start offline.
      await page.reload({waitUntil: 'networkidle'});
      const serviceWorkers = await page.evaluate(async () => navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).map(item => item.scope) : []);
      const requestCount = session.requests.length;
      await context.setOffline(true);
      try {
        assert.equal(await page.evaluate(() => navigator.onLine), false);
        await page.locator('#import-run').setInputFiles(valid.path);
        await waitForImported(page, initial);
        await assertRecoveryStatus(page, 'en');
        assertSnapshot((await snapshotDownload(page, 'warmed-page-offline-snapshot')).record, initial);
        await assertComputed(page, initial);
        assert.equal(session.requests.length, requestCount, 'No runtime fetch needed for warmed-page recovery');
        environments.push({offlineScope: 'already loaded page/modules only; no cold-start claim', serviceWorkers});
      } finally { await context.setOffline(false); }
    });
    await check('suite: no unhandled page errors, storage writes, or external runtime requests', async () => {
      await assertNoRuntimeLeak(session);
    });
  } finally { await context.close(); }
} catch (error) {
  fatal = error.stack || String(error);
} finally {
  await browser.close();
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({
    status: fatal ? 'failed-or-blocked' : 'passed',
    executedAt: new Date().toISOString(), target: base.href, candidateVersion: VERSION,
    scope: 'Chromium native DOM/file/download checks; offline only after page/modules loaded',
    passed: outcomes.filter(item => item.status === 'passed').length,
    failed: outcomes.filter(item => item.status === 'failed').length,
    outcomes, environments, downloads, fatal,
  }, null, 2));
}
if (fatal) throw new Error(fatal);
console.log(`${outcomes.length} recovery browser checks passed. Evidence: ${output}`);
