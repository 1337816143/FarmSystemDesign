import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {OfflineBundle, names, scopeKey, sha256, validateManifest, activePath} from '../src/offline-bundle.js';

// These doubles preserve the browser Cache API's clone-on-read/write semantics.
// Mutations are explicit so corruption, quota, partial caches and restart are real
// inputs to the production module, rather than mocked production methods.
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const encoder = new TextEncoder();
const SCOPE = 'https://farm.example/Farm/';
const key = request => typeof request === 'string' ? request : request.url || request.href;
class MemoryCache {
  constructor() { this.entries = new Map(); this.beforePut = null; }
  async match(request) { return this.entries.get(key(request))?.clone(); }
  async put(request, response) {
    await this.beforePut?.(key(request), response);
    this.entries.set(key(request), response.clone());
  }
  async delete(request) { return this.entries.delete(key(request)); }
  async keys() { return [...this.entries.keys()].map(url => new Request(url)); }
}
class MemoryCacheStorage {
  constructor() { this.items = new Map(); this.deleted = []; }
  async open(name) {
    if (!this.items.has(name)) this.items.set(name, new MemoryCache());
    return this.items.get(name);
  }
  async keys() { return [...this.items.keys()]; }
  async delete(name) { this.deleted.push(name); return this.items.delete(name); }
}
async function fixture({scope = SCOPE, files, cacheStorage = new MemoryCacheStorage(), ...options} = {}) {
  const bodies = new Map(Object.entries(files || {
    'index.html': '<h1>Complete site</h1>',
    'src/app.js': 'export const version = 1;',
    'data/local.tif': new Uint8Array([73, 73, 42, 0, 0, 255, 8, 10]),
    'downloads/research.zip': new Uint8Array([80, 75, 3, 4, 254, 0]),
    'discussion/index.html': '<h1>Discussion</h1>',
    'empty.txt': '',
  }).map(([path, value]) => [path, typeof value === 'string' ? encoder.encode(value) : value]));
  const entries = await Promise.all([...bodies].map(async ([path, body]) => ({path, bytes: body.length, sha256: await sha256(body)})));
  const manifest = {schema: 1, version: 'test-1', entries, totalFiles: entries.length,
    totalBytes: entries.reduce((sum, row) => sum + row.bytes, 0), id: await sha256(encoder.encode(JSON.stringify(entries)))};
  const calls = [], failures = new Map();
  const fetcher = async (input, init) => {
    const url = new URL(key(input)), path = url.href.slice(scope.length);
    calls.push({url: url.href, path, init});
    assert.ok(url.href.startsWith(scope), `Fetcher escaped ${scope}: ${url}`);
    const override = failures.get(path);
    if (override) return override(calls.filter(call => call.path === path).length);
    if (path === 'offline-manifest.json') return Response.json(manifest);
    if (!bodies.has(path)) return new Response('Not found', {status: 404});
    return new Response(bodies.get(path));
  };
  const progress = [];
  const bundle = new OfflineBundle({scope, cacheStorage, fetcher, estimate: async () => ({}),
    onProgress: state => progress.push(state), ...options});
  const active = async () => (await cacheStorage.open(names(scope, '').meta)).match(new URL(activePath(manifest.version), scope));
  const marker = async () => (await cacheStorage.open(names(scope, manifest.id).bundle)).match(new URL('offline-manifest.json', scope));
  return {bundle, manifest, bodies, calls, failures, cacheStorage, progress, active, marker, fetcher, scope};
}
async function resign(manifest) {
  manifest.totalFiles = manifest.entries.length;
  manifest.totalBytes = manifest.entries.reduce((sum, row) => sum + row.bytes, 0);
  manifest.id = await sha256(encoder.encode(JSON.stringify(manifest.entries)));
  return manifest;
}

test('manifest identity binds every path, exact byte count and SHA-256', async () => {
  const {manifest} = await fixture();
  assert.equal(await validateManifest(manifest, SCOPE), manifest);
  for (const mutate of [m => m.entries[0].sha256 = '0'.repeat(64), m => m.entries[0].bytes++,
    m => m.totalFiles++, m => m.totalBytes++, m => m.id = 'f'.repeat(64), m => m.schema = 2,
    m => m.version = null, m => m.entries = []]) {
    const changed = structuredClone(manifest); mutate(changed);
    await assert.rejects(validateManifest(changed, SCOPE));
  }
});

test('manifest rejects traversal, external destinations, duplicates and malformed entry metadata', async () => {
  const {manifest} = await fixture();
  for (const path of ['../secret', './app.js', '/outside', 'data//x', 'data/../x', 'data\\x',
    'https://elsewhere.example/x', '//elsewhere.example/x', 'data/%2e%2e/x', 'data/x?query', 'data/x#hash', '']) {
    const changed = structuredClone(manifest); changed.entries[0].path = path;
    await resign(changed);
    await assert.rejects(validateManifest(changed, SCOPE), undefined, path);
  }
  const duplicate = structuredClone(manifest); duplicate.entries.push({...duplicate.entries[0]});
  await assert.rejects(validateManifest(await resign(duplicate), SCOPE));
  for (const bytes of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const changed = structuredClone(manifest); changed.entries[0].bytes = bytes;
    await assert.rejects(validateManifest(await resign(changed), SCOPE));
  }
});

test('fresh bundle is incomplete and cannot advertise readiness until all files verify', async () => {
  const f = await fixture();
  await f.bundle.load();
  assert.equal(f.bundle.state.status, 'incomplete');
  assert.equal(f.bundle.state.completeFiles, 0);
  assert.equal(await f.active(), undefined);
  assert.equal(await f.marker(), undefined);
  await f.bundle.start();
  assert.equal(f.bundle.state.status, 'complete');
  assert.equal(f.bundle.state.completeFiles, f.manifest.totalFiles);
  assert.equal(f.bundle.state.completeBytes, f.manifest.totalBytes);
  assert.equal((await (await f.active()).json()).id, f.manifest.id);
  assert.deepEqual(await (await f.marker()).json(), f.manifest);
  for (const row of f.manifest.entries) {
    assert.ok(await f.bundle.validResponse(await f.bundle.cache.match(new URL(row.path, f.scope)), row));
  }
  assert.ok(f.calls.every(call => call.init.cache === 'reload'));
  for (const call of f.calls.filter(call => call.path !== 'offline-manifest.json')) {
    assert.equal(new Headers(call.init.headers).get('X-Farm-Offline-Bundle'), '1',
      'Bulk file downloads must not also populate the worker runtime cache');
    assert.ok(call.init.signal instanceof AbortSignal, 'Every file request has a bounded timeout');
  }
  assert.ok(f.progress.every(s => s.completeFiles <= s.totalFiles && s.completeBytes <= s.totalBytes));
  assert.equal(f.bundle.running, false);
});

test('pause retains verified bytes; a new bundle instance resumes without refetching them', async () => {
  const f = await fixture({concurrency: 1});
  f.bundle.onProgress = state => {
    if (state.status === 'downloading' && state.completeFiles === 1) f.bundle.pause();
  };
  await f.bundle.start();
  assert.equal(f.bundle.state.status, 'paused');
  assert.equal(f.bundle.state.completeFiles, 1);
  assert.equal(await f.active(), undefined);
  const firstPath = f.manifest.entries[0].path;
  const before = f.calls.filter(call => call.path === firstPath).length;
  const reopened = new OfflineBundle({scope: f.scope, cacheStorage: f.cacheStorage, fetcher: f.fetcher,
    estimate: async () => ({}), concurrency: 2});
  await reopened.load();
  assert.equal(reopened.state.completeFiles, 1);
  await reopened.start();
  assert.equal(reopened.state.status, 'complete');
  assert.equal(f.calls.filter(call => call.path === firstPath).length, before);
});

test('same-size corruption and missing retained files are detected and only those files are redownloaded', async () => {
  const f = await fixture(); await f.bundle.start();
  const [damaged, missing] = f.manifest.entries;
  await f.bundle.cache.put(new URL(damaged.path, f.scope), new Response(new Uint8Array(damaged.bytes).fill(88)));
  await f.bundle.cache.delete(new URL(missing.path, f.scope));
  const start = f.calls.length;
  await f.bundle.inspect();
  assert.equal(f.bundle.state.status, 'incomplete');
  assert.equal(f.bundle.state.completeFiles, f.manifest.totalFiles - 2);
  await f.bundle.start();
  assert.equal(f.bundle.state.status, 'complete');
  assert.deepEqual(f.calls.slice(start).map(call => call.path).sort(), [damaged.path, missing.path].sort());
});

test('inspection revokes its old completeness marker if a previously complete file is lost', async () => {
  const f = await fixture(); await f.bundle.start();
  await f.bundle.cache.delete(new URL(f.manifest.entries[0].path, f.scope));
  await f.bundle.inspect();
  assert.equal(f.bundle.state.status, 'incomplete');
  assert.equal(await f.active(), undefined, 'An incomplete bundle must not keep its active marker');
  assert.equal(await f.marker(), undefined, 'An incomplete bundle must not retain its completeness manifest');
});

test('bounded retries recover a temporary fetch error and verify each response', async () => {
  const f = await fixture({retries: 2});
  const path = f.manifest.entries[1].path;
  f.failures.set(path, attempt => {
    if (attempt === 1) throw new TypeError('Network interrupted');
    return attempt === 2 ? new Response('server error', {status: 503}) : new Response(f.bodies.get(path));
  });
  await f.bundle.start();
  assert.equal(f.bundle.state.status, 'complete');
  assert.equal(f.calls.filter(call => call.path === path).length, 3);
  assert.deepEqual(f.bundle.state.failed, []);
});

test('permanent HTTP or hash failure stays incomplete, preserves other files, and succeeds on retry', async () => {
  const f = await fixture({retries: 1});
  const path = f.manifest.entries[0].path;
  f.failures.set(path, () => new Response(new Uint8Array(f.bodies.get(path).length).fill(90)));
  await f.bundle.start();
  assert.equal(f.bundle.state.status, 'incomplete');
  assert.equal(f.bundle.state.completeFiles, f.manifest.totalFiles - 1);
  assert.equal(f.calls.filter(call => call.path === path).length, 2);
  assert.equal(f.bundle.state.failed[0].path, path);
  assert.equal(await f.active(), undefined);
  assert.equal(await f.marker(), undefined);
  assert.equal(await f.bundle.cache.match(new URL(path, f.scope)), undefined);
  f.failures.delete(path); const start = f.calls.length;
  await f.bundle.start();
  assert.equal(f.bundle.state.status, 'complete');
  assert.deepEqual(f.calls.slice(start).map(call => call.path), [path]);
});

test('partial, opaque, non-200, truncated and corrupt responses cannot count as verified', async () => {
  const f = await fixture(), row = f.manifest.entries[0], bytes = f.bodies.get(row.path);
  for (const response of [undefined, new Response(bytes, {status: 206}), new Response(bytes, {status: 404}),
    new Response(bytes.slice(1)), new Response(new Uint8Array(bytes.length))]) {
    assert.equal(await f.bundle.validResponse(response, row), false);
  }
  const opaque = new Response(bytes); Object.defineProperty(opaque, 'type', {value: 'opaque'});
  assert.equal(await f.bundle.validResponse(opaque, row), false);
});

test('quota preflight stops without downloading missing assets or advertising completeness', async () => {
  const f = await fixture({estimate: async () => ({quota: 10, usage: 9})});
  await f.bundle.start();
  assert.equal(f.bundle.state.status, 'insufficient-space');
  assert.equal(f.bundle.state.freeBytes, 1);
  assert.equal(f.bundle.state.requiredBytes, f.manifest.totalBytes);
  assert.deepEqual(f.calls.map(call => call.path), ['offline-manifest.json']);
  assert.equal(await f.active(), undefined);
});

test('quota preflight uses remaining bytes and estimate failures do not prevent a valid download', async () => {
  const f = await fixture({concurrency: 1}); await f.bundle.load();
  for (const row of f.manifest.entries.slice(0, -2)) {
    await f.bundle.cache.put(new URL(row.path, f.scope), new Response(f.bodies.get(row.path)));
  }
  const remaining = f.manifest.entries.slice(-2).reduce((n, row) => n + row.bytes, 0);
  f.bundle.estimate = async () => ({quota: remaining * 1.1 + 1, usage: 0});
  await f.bundle.start(); assert.equal(f.bundle.state.status, 'complete');
  const unknown = await fixture({estimate: async () => { throw Error('Estimate unavailable'); }});
  await unknown.bundle.start(); assert.equal(unknown.bundle.state.status, 'complete');
});

test('actual Cache.put quota exhaustion preserves verified progress and resumes after capacity returns', async () => {
  const f = await fixture({concurrency: 1}); await f.bundle.load();
  let writes = 0;
  f.bundle.cache.beforePut = () => { if (++writes === 2) throw new DOMException('Storage is full', 'QuotaExceededError'); };
  await f.bundle.start();
  assert.notEqual(f.bundle.state.status, 'complete');
  assert.equal(f.bundle.state.completeFiles, 1);
  assert.match(f.bundle.state.failed[0].error, /quota/i);
  assert.equal(await f.active(), undefined);
  f.bundle.cache.beforePut = null;
  await f.bundle.start(); assert.equal(f.bundle.state.status, 'complete');
});

test('offline reopening uses only an integrity-checked retained manifest', async () => {
  const f = await fixture(); await f.bundle.start();
  f.failures.set('offline-manifest.json', () => { throw new TypeError('Offline'); });
  const reopened = new OfflineBundle({scope: f.scope, cacheStorage: f.cacheStorage, fetcher: f.fetcher});
  await reopened.load();
  assert.equal(reopened.state.fromNetwork, false);
  assert.equal(reopened.state.status, 'complete');
  const meta = await f.cacheStorage.open(names(f.scope, '').meta);
  await meta.put(new URL('offline-manifest.json', f.scope), Response.json({...f.manifest, id: '0'.repeat(64)}));
  await assert.rejects(new OfflineBundle({scope: f.scope, cacheStorage: f.cacheStorage, fetcher: f.fetcher}).load(), /integrity/);
});

test('invalid or missing network manifests cannot create a usable offline bundle', async () => {
  for (const response of [() => new Response('Missing', {status: 404}),
    () => Response.json({schema: 1, entries: []}), () => new Response('{broken json')]) {
    const f = await fixture(); f.failures.set('offline-manifest.json', response);
    await assert.rejects(f.bundle.load());
    assert.equal(await f.active(), undefined);
  }
});

test('full bundle caches are isolated by site scope and unrelated caches are untouched', async () => {
  const shared = new MemoryCacheStorage();
  await (await shared.open('user-other-cache')).put('https://farm.example/user-sentinel', new Response('keep'));
  const a = await fixture({scope: 'https://farm.example/Farm/', cacheStorage: shared});
  const b = await fixture({scope: 'https://farm.example/Other/', cacheStorage: shared});
  assert.notEqual(scopeKey(a.scope), scopeKey(b.scope));
  assert.notEqual(names(a.scope, a.manifest.id).bundle, names(b.scope, b.manifest.id).bundle);
  await a.bundle.start(); await b.bundle.load();
  assert.equal(b.bundle.state.completeFiles, 0);
  assert.equal(await b.active(), undefined);
  await b.bundle.start();
  assert.equal((await (await a.active()).json()).id, a.manifest.id);
  assert.equal((await (await b.active()).json()).id, b.manifest.id);
  assert.equal(await (await (await shared.open('user-other-cache')).match('https://farm.example/user-sentinel')).text(), 'keep');
  assert.deepEqual(shared.deleted, []);
});

test('an incomplete new release does not revoke another complete release for the same scope', async () => {
  const f = await fixture(); await f.bundle.start();
  const newer = await fixture({cacheStorage: f.cacheStorage, files: {'index.html': 'new release'}});
  await newer.bundle.load();
  assert.equal(newer.bundle.state.status, 'incomplete');
  assert.equal((await (await f.active()).json()).id, f.manifest.id);
  assert.ok(await f.marker());
});

test('restarting an already complete bundle revalidates but does not redownload asset bodies', async () => {
  const f = await fixture(); await f.bundle.start(); const start = f.calls.length;
  await f.bundle.start();
  assert.equal(f.bundle.state.status, 'complete');
  assert.equal(f.calls.length, start);
  assert.equal(f.bundle.running, false);
});


function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}

test('estimate-stage competing load/inspect/start cannot replace the running manifest, cache or valid set', async () => {
  const entered = deferred(), capacity = deferred();
  const f = await fixture({estimate: () => { entered.resolve(); return capacity.promise; }});
  await f.bundle.load();
  const first = f.manifest.entries[0];
  await f.bundle.cache.put(new URL(first.path, f.scope), new Response(f.bodies.get(first.path)));
  const next = await fixture({cacheStorage: f.cacheStorage, files: {'next-release.html': 'Different release'}});
  next.manifest.version = 'test-2';
  const run = f.bundle.start();
  await entered.promise;
  assert.equal(f.bundle.running, true);
  const owned = {manifest: f.bundle.manifest, cache: f.bundle.cache, valid: f.bundle.valid};
  const calls = f.calls.length;
  f.failures.set('offline-manifest.json', () => Response.json(next.manifest));
  await Promise.all([f.bundle.load(), f.bundle.inspect(), f.bundle.start(),
    f.bundle.load(), f.bundle.inspect(), f.bundle.start()]);
  assert.equal(f.bundle.manifest, owned.manifest);
  assert.equal(f.bundle.cache, owned.cache);
  assert.equal(f.bundle.valid, owned.valid);
  assert.deepEqual([...f.bundle.valid], [first.path]);
  assert.equal(f.calls.length, calls, 'Competing actions may not fetch a new manifest or file');
  assert.ok(!(await f.cacheStorage.keys()).includes(names(f.scope, next.manifest.id).bundle));
  capacity.resolve({});
  await run;
  assert.equal(f.bundle.state.status, 'complete');
  assert.equal(f.bundle.state.completeBytes, f.manifest.totalBytes);
  assert.equal(f.bundle.valid.size, f.manifest.totalFiles);
  assert.equal((await (await f.active()).json()).id, f.manifest.id);
  for (const row of f.manifest.entries) {
    assert.ok(await f.bundle.validResponse(await owned.cache.match(new URL(row.path, f.scope)), row));
  }
  // Once the original transaction finishes, an explicit reload can safely adopt
  // the next release. No old rows may have leaked into that new bundle cache.
  await f.bundle.load();
  assert.equal(f.bundle.manifest.id, next.manifest.id);
  assert.equal(f.bundle.state.status, 'incomplete');
  assert.equal(f.bundle.state.completeFiles, 0);
  assert.deepEqual(await f.bundle.cache.keys(), []);
  assert.equal((await (await f.active()).json()).id, f.manifest.id);
});

test('first start acquires its lock before awaiting the initial manifest fetch', async () => {
  const fetched = deferred(), response = deferred();
  const f = await fixture();
  f.failures.set('offline-manifest.json', () => { fetched.resolve(); return response.promise; });
  const run = f.bundle.start();
  await fetched.promise;
  assert.equal(f.bundle.running, true);
  await Promise.all([f.bundle.start(), f.bundle.load(), f.bundle.inspect()]);
  assert.equal(f.calls.length, 1);
  assert.equal(f.bundle.manifest, undefined);
  response.resolve(Response.json(f.manifest));
  await run;
  assert.equal(f.bundle.state.status, 'complete');
  assert.equal(f.bundle.state.completeFiles, f.manifest.totalFiles);
  assert.equal(f.bundle.state.completeBytes, f.manifest.totalBytes);
  assert.equal(f.calls.filter(call => call.path === 'offline-manifest.json').length, 1);
  for (const row of f.manifest.entries) assert.equal(f.calls.filter(call => call.path === row.path).length, 1);
  assert.equal(f.bundle.running, false);
});

test('an outstanding public load excludes starts, inspections and duplicate manifest loads', async () => {
  const fetched = deferred(), response = deferred();
  const f = await fixture();
  f.failures.set('offline-manifest.json', () => { fetched.resolve(); return response.promise; });
  const loading = f.bundle.load();
  await fetched.promise;
  assert.equal(f.bundle.loading, true);
  await Promise.all([f.bundle.load(), f.bundle.start(), f.bundle.inspect()]);
  assert.equal(f.calls.length, 1);
  response.resolve(Response.json(f.manifest));
  await loading;
  assert.equal(f.bundle.loading, false);
  assert.equal(f.bundle.running, false);
  assert.equal(f.bundle.state.status, 'incomplete');
  assert.equal(f.bundle.state.completeFiles, 0);
  await f.bundle.start();
  assert.equal(f.bundle.state.status, 'complete');
});

test('a deferred cache inspection owns the retained set and blocks competing manifest changes', async () => {
  const f = await fixture(); await f.bundle.start();
  const entered = deferred(), continued = deferred();
  const original = f.bundle.cache.match.bind(f.bundle.cache);
  let first = true;
  f.bundle.cache.match = async request => {
    if (first) { first = false; entered.resolve(); await continued.promise; }
    return original(request);
  };
  const inspect = f.bundle.inspect();
  await entered.promise;
  const owned = {manifest: f.bundle.manifest, cache: f.bundle.cache, valid: f.bundle.valid};
  const calls = f.calls.length;
  assert.equal(f.bundle.inspecting, true);
  await Promise.all([f.bundle.load(), f.bundle.start(), f.bundle.inspect()]);
  assert.equal(f.bundle.manifest, owned.manifest);
  assert.equal(f.bundle.cache, owned.cache);
  assert.equal(f.bundle.valid, owned.valid);
  assert.equal(f.calls.length, calls);
  continued.resolve();
  await inspect;
  assert.equal(f.bundle.inspecting, false);
  assert.equal(f.bundle.state.status, 'complete');
  assert.equal(f.bundle.state.completeBytes, f.manifest.totalBytes);
});

test('an old tab finishing activation late cannot replace the newer version pointer', async () => {
  const entered = deferred(), finishOldDownload = deferred();
  const shared = new MemoryCacheStorage();
  const old = await fixture({cacheStorage: shared,
    files: {'index.html': '<h1>Old application</h1>', 'data/old.txt': 'old data'},
    estimate: () => { entered.resolve(); return finishOldDownload.promise; }});
  old.manifest.version = 'test-old';
  const current = await fixture({cacheStorage: shared,
    files: {'index.html': '<h1>Current application</h1>', 'data/new.txt': 'new data'}});
  current.manifest.version = 'test-current';
  const lateOldRun = old.bundle.start();
  await entered.promise;
  await current.bundle.start();
  assert.equal(current.bundle.state.status, 'complete');
  const currentPointer = await (await current.active()).text();
  const currentIdentity = JSON.parse(currentPointer);
  assert.equal(currentIdentity.id, current.manifest.id);
  assert.equal(currentIdentity.version, current.manifest.version);
  assert.ok(currentIdentity.generation);
  assert.equal(await old.active(), undefined);
  finishOldDownload.resolve({});
  await lateOldRun;
  assert.equal(old.bundle.state.status, 'complete');
  assert.equal(await (await current.active()).text(), currentPointer,
    'A late old-version activation must not modify any byte of the current version pointer');
  const oldIdentity = await (await old.active()).json();
  assert.equal(oldIdentity.id, old.manifest.id);
  assert.equal(oldIdentity.version, old.manifest.version);
  assert.notEqual(activePath(old.manifest.version), activePath(current.manifest.version));
  assert.notEqual(oldIdentity.generation, currentIdentity.generation);
  assert.deepEqual(await (await current.marker()).json(), current.manifest);
  assert.deepEqual(await (await old.marker()).json(), old.manifest);
  const meta = await shared.open(names(SCOPE, '').meta);
  assert.equal(await meta.match(new URL('offline-active.json', SCOPE)), undefined,
    'No shared unversioned pointer may be written as a fallback');
});

test('a stale incomplete scan cannot revoke another tab\'s freshly reverified generation', async () => {
  const f = await fixture(); await f.bundle.start();
  const before = await (await f.active()).json();
  const missing = f.manifest.entries[0], missingURL = new URL(missing.path, f.scope);
  await f.bundle.cache.delete(missingURL);
  const capturedMissing = deferred(), continueScan = deferred();
  const originalMatch = f.bundle.cache.match.bind(f.bundle.cache);
  let holdFirstRead = true;
  f.bundle.cache.match = async request => {
    const response = await originalMatch(request);
    if (holdFirstRead && key(request) === missingURL.href) {
      holdFirstRead = false;
      assert.equal(response, undefined);
      // Hold the already-read missing result, not the mutable cache entry. This
      // reproduces a slow tab carrying a stale negative observation across repair.
      capturedMissing.resolve();
      await continueScan.promise;
    }
    return response;
  };
  const staleScan = f.bundle.inspect();
  await capturedMissing.promise;
  await f.bundle.cache.put(missingURL, new Response(f.bodies.get(missing.path)));
  const otherTab = new OfflineBundle({scope: f.scope, cacheStorage: f.cacheStorage, fetcher: f.fetcher,
    estimate: async () => ({})});
  await otherTab.load();
  assert.equal(otherTab.state.status, 'complete');
  const repairedPointer = await (await f.active()).text();
  const repaired = JSON.parse(repairedPointer);
  assert.equal(repaired.id, before.id);
  assert.notEqual(repaired.generation, before.generation);
  assert.ok(await f.marker());
  continueScan.resolve();
  await staleScan;
  assert.equal(f.bundle.state.status, 'incomplete', 'The old scan must honestly report its stale observation');
  assert.equal(f.bundle.state.completeFiles, f.manifest.totalFiles - 1);
  assert.equal(await (await f.active()).text(), repairedPointer,
    'The old scan must not delete or replace a pointer activated during its scan');
  assert.deepEqual(await (await f.marker()).json(), f.manifest,
    'The newer tab\'s complete-bundle marker must survive the stale scan');
  for (const row of f.manifest.entries) {
    assert.ok(await otherTab.validResponse(await originalMatch(new URL(row.path, f.scope)), row));
  }
});
