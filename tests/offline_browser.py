"""Full published-site offline proof, using a real server and a fresh browser context.

Imported by browser.py as verify_offline(browser, out, check). The supplied browser
is reused, but caches, workers and storage are isolated from the other tests. No
Playwright request routing or synthetic network responses are used. Browser runs
belong in the existing GitHub Actions job, not restricted cloud Chromium.
"""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit
import hashlib
import json
import subprocess
import threading
import time
import traceback


ROUTES = ['atlas', 'research', 'overview', 'resources', 'analysis', 'planner',
          'feedback', 'data', 'evidence', 'guide']
WORKSPACE_KEY = 'farmsystem-workspace-v2'


def verify_offline(browser, out, check):
    root = Path(__file__).resolve().parents[1]
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    deadline = started + 540  # Whole function, including build, stays below ten minutes.
    report = {'status': 'running', 'checks': [], 'pageErrors': [], 'externalRequests': [],
              'requests': [], 'stages': []}
    context = page = server = None
    server_closed = False
    network = {'phase': 'prepare', 'delay': 0}
    response_sources = {}

    def write_report():
        report['elapsedSeconds'] = round(time.monotonic() - started, 2)
        (out / 'offline-browser-report.json').write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    def budget(limit=30000):
        remaining = int((deadline - time.monotonic()) * 1000)
        if remaining <= 0:
            raise AssertionError('Full offline verification exceeded its nine-minute budget')
        return min(limit, remaining)

    def verify(name, value=True):
        budget()
        check('offline: ' + name, value)
        report['checks'].append(name)
        write_report()

    def observe_request(request):
        parts = urlsplit(request.url)
        if parts.scheme in ['http', 'https'] and parts.hostname not in ['127.0.0.1', 'localhost']:
            report['externalRequests'].append({'url': request.url, 'type': request.resource_type,
                                               'phase': network['phase']})

    def observe_response(response):
        if network['phase'] == 'offline':
            response_sources[unquote(urlsplit(response.url).path).lstrip('/')] = response.from_service_worker

    def new_page():
        result = context.new_page()
        result.on('pageerror', lambda error: report['pageErrors'].append(str(error)))
        result.on('response', observe_response)
        return result

    def controller_proof():
        proof = page.evaluate('''async () => {
            const registration = await navigator.serviceWorker.getRegistration();
            const controller = navigator.serviceWorker.controller;
            if (!registration || !controller) return null;
            const identity = await new Promise(resolve => {
                const channel = new MessageChannel();
                const timer = setTimeout(() => {channel.port1.close();resolve(null);}, 1500);
                channel.port1.onmessage = event => {clearTimeout(timer);channel.port1.close();resolve(event.data);};
                controller.postMessage({type:'FARM_SHELL_IDENTITY'}, [channel.port2]);
            });
            return {scope:registration.scope, identity, active:controller === registration.active,
                    installing:!!registration.installing, waiting:!!registration.waiting};
        }''')
        report.setdefault('controllerProofs', []).append(proof)
        expected = 'farmsystem-shell-%2F-v' + manifest['version']
        verify('download/readiness uses an acknowledged controller matching the exact scope and manifest version',
               bool(proof) and proof['scope'] == base and proof['active'] and
               not proof['installing'] and not proof['waiting'] and
               bool(proof['identity']) and proof['identity'].get('cache') == expected)

    def shell_snapshot():
        return page.evaluate('''async () => {
            const result = [];
            for (const name of (await caches.keys()).filter(key => key.startsWith('farmsystem-shell-%2F-v'))) {
                const cache = await caches.open(name);
                result.push({name,paths:(await cache.keys()).map(r => new URL(r.url).pathname.slice(1)).sort()});
            }
            return result;
        }''')

    def wait_ready():
        page.wait_for_function("navigator.serviceWorker.controller !== null", timeout=budget(45000))
        page.wait_for_function("!document.querySelector('#start').disabled || document.querySelector('#status').classList.contains('complete')",
                               timeout=budget(45000))
        verify('offline manager loads a real manifest',
               str(manifest['totalFiles']) in page.locator('#count').inner_text().replace(',', ''))
        controller_proof()

    def cache_snapshot():
        return page.evaluate('''async ({id, prefix, version}) => {
            const cache = await caches.open(prefix + id);
            const paths = (await cache.keys()).map(r => new URL(r.url).pathname.slice(1));
            const meta = await caches.open('farmsystem-full-meta-v1-' + encodeURIComponent('/'));
            const active = await meta.match(new URL('offline-active-v'+encodeURIComponent(version)+'.json', location.origin));
            return {paths, active: active ? await active.json() : null,
                    progress: document.querySelector('#progress').value,
                    status: document.querySelector('#status').textContent};
        }''', {'id': manifest['id'], 'prefix': 'farmsystem-full-v1-%2F-', 'version': manifest['version']})

    def current_plans():
        return page.evaluate('(key) => JSON.parse(localStorage.getItem(key)).plans', WORKSPACE_KEY)

    try:
        built = subprocess.run(['node', 'tools/build.mjs'], cwd=root, capture_output=True,
                               text=True, timeout=budget(90000) / 1000)
        report['build'] = {'exitCode': built.returncode, 'stdout': built.stdout, 'stderr': built.stderr}
        verify('publication build succeeds before testing its exact output', built.returncode == 0)
        site = root / '_site'
        manifest = json.loads((site / 'offline-manifest.json').read_text(encoding='utf-8'))
        entries = manifest['entries']
        report['manifest'] = {key: value for key, value in manifest.items() if key != 'entries'}
        files = sorted(path.relative_to(site).as_posix() for path in site.rglob('*')
                       if path.is_file() and path.relative_to(site).as_posix() != 'offline-manifest.json')
        verify('manifest enumerates every published file without exclusions or duplicates',
               sorted(row['path'] for row in entries) == files)
        identity = hashlib.sha256(json.dumps(entries, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
        verify('manifest identifier and totals independently recompute',
               identity == manifest['id'] and len(entries) == manifest['totalFiles'] and
               sum(row['bytes'] for row in entries) == manifest['totalBytes'])
        for row in entries:
            payload = (site / row['path']).read_bytes()
            if len(payload) != row['bytes'] or hashlib.sha256(payload).hexdigest() != row['sha256']:
                raise AssertionError('Build manifest does not match published bytes: ' + row['path'])
        verify('all published bytes independently match their SHA-256 records')
        by_path = {row['path']: row for row in entries}
        verify('published bundle includes the application, offline UI and standalone discussion',
               all(path in by_path for path in ['index.html', 'offline.html', 'sw.js',
                                               'src/offline-bundle.js', 'discussion/index.html']))
        zip_rows = [row for row in entries if row['path'].lower().endswith('.zip')]
        tif_rows = [row for row in entries if row['path'].lower().endswith(('.tif', '.tiff'))]
        verify('published download archive and TIFF source rasters are included', bool(zip_rows) and bool(tif_rows))

        class Handler(SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=str(site), **kwargs)

            def log_message(self, *args):
                pass

            def end_headers(self):
                self.send_header('Cache-Control', 'no-cache')
                # Explicitly disallow live external map/API retrieval, without any
                # browser route interception (which would disable HTTP caching).
                self.send_header('Content-Security-Policy', "connect-src 'self'; img-src 'self' data: blob:")
                super().end_headers()

            def do_GET(self):
                path = unquote(urlsplit(self.path).path).lstrip('/')
                report['requests'].append({'phase': network['phase'], 'path': path,
                                           'range': self.headers.get('Range'),
                                           'offlineBundle': self.headers.get('X-Farm-Offline-Bundle')})
                if path == '__offline_test_seed.html':
                    payload = b'<!doctype html><title>Offline test origin</title><p>Isolated test origin</p>'
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/html')
                    self.send_header('Content-Length', str(len(payload)))
                    self.end_headers()
                    self.wfile.write(payload)
                    return
                if network['delay'] and path in by_path:
                    time.sleep(network['delay'])
                try:
                    super().do_GET()
                except (BrokenPipeError, ConnectionResetError):
                    pass  # Expected when the interrupted tab is closed.

        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        server.daemon_threads = True
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = f'http://127.0.0.1:{server.server_port}/'
        report['origin'] = base
        context = browser.new_context(viewport={'width': 1440, 'height': 1050}, accept_downloads=True)
        context.set_default_timeout(30000)
        context.on('request', observe_request)
        page = new_page()
        page.goto(base + '__offline_test_seed.html', wait_until='load', timeout=budget())
        page.evaluate('''async () => {
            localStorage.setItem('offline-test-user-sentinel', 'keep-private-user-state');
            const other = await caches.open('user-other-cache');
            await other.put(new URL('private-sentinel.txt', location.origin), new Response('keep-other-cache'));
            const anotherScope = await caches.open('farmsystem-shell-%2Fother%2F-vtest');
            await anotherScope.put(new URL('/other/index.html', location.origin), new Response('keep-other-scope'));
        }''')
        page.goto(base + 'index.html#planner', wait_until='networkidle', timeout=budget(45000))
        page.wait_for_function('navigator.serviceWorker.controller !== null', timeout=budget(45000))
        page.select_option('#scope', 'single')
        page.select_option('#scope-object', 'F01')
        page.locator('[data-action="run"]').first.click()
        page.wait_for_selector('[data-action="save-plan"]', timeout=budget(45000))
        page.locator('[data-action="save-plan"]').click()
        page.locator('#plan-name').fill('Actual plan preserved across complete offline download')
        page.locator('#modal-form button[type="submit"]').click()
        saved = current_plans()
        verify('a real optimizer result is saved before the offline operation',
               len(saved) == 1 and bool(saved[0].get('candidate')) and bool(saved[0].get('frozenRun')))
        saved_digest = hashlib.sha256(json.dumps(saved, sort_keys=True).encode()).hexdigest()
        report['savedPlanSha256'] = saved_digest
        page.goto(base + 'offline.html', wait_until='networkidle', timeout=budget(45000))
        wait_ready()
        initial = cache_snapshot()
        verify('fresh full bundle is visibly incomplete with no active marker',
               not initial['active'] and not page.locator('#status').evaluate("e => e.classList.contains('complete')"))
        shell_before = shell_snapshot()
        report['shellCachesBeforeBulk'] = shell_before
        network.update(phase='download-pause', delay=0.025)
        page.locator('#start').click()
        page.wait_for_function("document.querySelector('#progress').value > 0 && !document.querySelector('#pause').disabled",
                               timeout=budget(60000))
        page.locator('#pause').click()
        page.wait_for_function("!document.querySelector('#start').disabled && document.querySelector('#pause').disabled",
                               timeout=budget(30000))
        retained = cache_snapshot()
        retained_paths = set(retained['paths']) - {'offline-manifest.json'}
        report['stages'].append({'stage': 'paused-before-close', **retained})
        verify('pause retains partial verified bytes and cannot claim complete readiness',
               0 < len(retained_paths) < manifest['totalFiles'] and not retained['active'] and
               'offline-manifest.json' not in retained['paths'])
        page.close()
        network.update(phase='reopen', delay=0)
        page = new_page()  # Same browser and context, different document and JS heap.
        page.goto(base + 'offline.html', wait_until='networkidle', timeout=budget(45000))
        wait_ready()
        reopened = cache_snapshot()
        report['stages'].append({'stage': 'reopened-partial', **reopened})
        verify('closing and reopening the tab retains exactly the verified partial files',
               set(reopened['paths']) == set(retained['paths']) and reopened['progress'] == retained['progress'])
        network['phase'] = 'resume'
        page.locator('#start').click()
        page.wait_for_function("document.querySelector('#status').classList.contains('complete') || (!document.querySelector('#start').disabled && document.querySelector('#errors').textContent.trim()) || document.querySelector('#capacity').textContent.trim()",
                               timeout=budget(210000))
        verify('resumed full download finishes with every file verified and no error',
               page.locator('#status').evaluate("e => e.classList.contains('complete')") and
               not page.locator('#errors').inner_text().strip())
        controller_proof()
        completed = cache_snapshot()
        report['stages'].append({'stage': 'complete', 'cachedFiles': len(completed['paths']),
                                 'active': completed['active'], 'progress': completed['progress']})
        verify('complete marker, cached paths and displayed bytes match the published manifest',
               completed['active']['id'] == manifest['id'] and
               set(completed['paths']) == set(by_path) | {'offline-manifest.json'} and
               completed['progress'] == manifest['totalBytes'])
        bulk_paths = {request['path'] for request in report['requests']
                      if request['phase'] in ['download-pause', 'resume'] and request['offlineBundle'] == '1'}
        verify('every published file download carries the runtime-cache opt-out header through the real worker',
               bulk_paths == set(by_path))
        shell_after = shell_snapshot()
        report['shellCachesAfterBulk'] = shell_after
        data_before = {path for cache in shell_before for path in cache['paths'] if path.startswith('data/')}
        data_after = {path for cache in shell_after for path in cache['paths'] if path.startswith('data/')}
        published_data = {path for path in by_path if path.startswith('data/')}
        verify('full download does not make a second copy of all data in the ordinary runtime shell cache',
               data_after == data_before and data_after < published_data)
        resume_paths = {request['path'] for request in report['requests'] if request['phase'] == 'resume'}
        verify('resume does not redownload any retained verified file', not (retained_paths & resume_paths))
        verify('download operation preserves the pre-existing saved plan byte-for-byte', current_plans() == saved)
        page.screenshot(path=str(out / 'offline-complete-manager.png'), full_page=True, timeout=budget())
        verify('no OSM or other external host was requested while online', not report['externalRequests'])

        # Remove only this isolated origin's ordinary shell caches so a broken
        # full-bundle reader cannot silently pass via incidental online warm-up.
        removed_shells = page.evaluate('''async () => {
            const keys = (await caches.keys()).filter(key => key.startsWith('farmsystem-shell-%2F-v'));
            for (const key of keys) await caches.delete(key);
            return keys;
        }''')
        report['removedOrdinaryShellCaches'] = removed_shells
        verify('ordinary shell warm-up cache is removed before proving the complete bundle', bool(removed_shells))

        # Disconnect Chromium AND stop the actual server. Reload-cache fetches below
        # cannot quietly succeed through a warm HTTP cache or a still-live server.
        context.set_offline(True)
        server.shutdown()
        server.server_close()
        server_closed = True
        network['phase'] = 'offline'
        request_count = len(report['requests'])
        page.close()
        page = new_page()
        page.goto(base + 'offline.html', wait_until='networkidle', timeout=budget(45000))
        wait_ready()
        verify('a fresh offline document revalidates the retained full bundle',
               page.locator('#status').evaluate("e => e.classList.contains('complete')"))
        negative = page.evaluate("async () => { const r = await fetch('__offline_missing_probe__.bin', {cache:'reload'}); return {status:r.status, body:await r.text()}; }")
        verify('a never-cached resource cannot be fetched after disconnection', negative['status'] >= 400)

        # Keep per-file proof, not only a completion label. Use bounded concurrency
        # and in-page SHA-256 to avoid transferring 284 MB over the DevTools bridge.
        page.evaluate('''rows => {
            window.__offlineAudit = {done:false, rows:[], failures:[], count:0, bytes:0};
            const state = window.__offlineAudit;
            void (async () => {
                let next = 0;
                const work = async () => {
                    while (next < rows.length) {
                        const row = rows[next++];
                        try {
                            const response = await fetch(row.path, {cache:'reload', signal:AbortSignal.timeout(20000)});
                            const body = await response.arrayBuffer();
                            const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', body))]
                                .map(x => x.toString(16).padStart(2,'0')).join('');
                            const result = {path:row.path, status:response.status, bytes:body.byteLength, sha256:digest};
                            state.rows.push(result);
                            if (response.status !== 200 || body.byteLength !== row.bytes || digest !== row.sha256)
                                state.failures.push(result);
                            state.count++; state.bytes += body.byteLength;
                        } catch (error) { state.failures.push({path:row.path,error:String(error)}); }
                    }
                };
                await Promise.all(Array.from({length:4}, work));
                state.done = true;
            })().catch(error => {state.failures.push({error:String(error)});state.done=true;});
        }''', entries)
        page.wait_for_function('window.__offlineAudit.done', timeout=budget(180000))
        audit = page.evaluate('window.__offlineAudit')
        report['offlineFiles'] = sorted(audit['rows'], key=lambda row: row['path'])
        report['offlineFileFailures'] = audit['failures']
        verify('every manifest file is fetched with real networking disabled and matches exact bytes/SHA-256',
               not audit['failures'] and audit['count'] == manifest['totalFiles'] and
               audit['bytes'] == manifest['totalBytes'])
        missing_worker_proof = [row['path'] for row in entries if response_sources.get(row['path']) is not True]
        report['missingServiceWorkerProof'] = missing_worker_proof
        verify('all manifest responses actually came from the service worker', not missing_worker_proof)

        for route in ROUTES:
            page.goto(base + 'index.html#' + route, wait_until='networkidle', timeout=budget(30000))
            page.wait_for_selector(f'nav [data-nav="{route}"][aria-current="page"]', timeout=budget())
            verify(f'#{route} reopens independently while offline',
                   page.locator('main h1').count() == 1 and
                   '当前输入无法计算' not in page.locator('main h1').inner_text())
            if route == 'atlas':
                page.locator('[data-atlas="classes2025"]').click()
                page.wait_for_function("Array.from(document.querySelectorAll('#hainan-atlas-map canvas.leaflet-tile')).some(c => Number(c.dataset.validPixels) > 0)",
                                       timeout=budget(30000))
                verify('the local 2025 atlas renders actual valid raster pixels offline')
                page.screenshot(path=str(out / 'offline-atlas.png'), full_page=True, timeout=budget())
            if route == 'planner':
                page.select_option('#scope', 'single')
                page.select_option('#scope-object', 'F01')
                page.locator('[data-action="run"]').first.click()
                page.wait_for_selector('[data-action="save-plan"]', timeout=budget(45000))
                verify('the real module optimizer runs and returns candidates offline',
                       page.locator('tr[data-candidate]').count() > 0)
        page.goto(base, wait_until='networkidle', timeout=budget())
        verify('the site-root directory alias resolves to the offline application',
               page.locator('nav [data-nav="atlas"][aria-current="page"]').count() == 1)
        page.goto(base + 'discussion/index.html', wait_until='networkidle', timeout=budget())
        page.wait_for_function('window.phdDeck && window.phdDeck.getState().count === 15', timeout=budget())
        for index in range(15):
            page.evaluate('index => window.phdDeck.go(index)', index)
            verify(f'discussion page {index + 1}/15 renders offline',
                   page.locator('.slide.active').count() == 1 and
                   page.locator('#page-counter').inner_text() == f'{index + 1} / 15' and
                   len(page.locator('.slide.active').inner_text().strip()) > 20)
        page.screenshot(path=str(out / 'offline-discussion-15.png'), full_page=True, timeout=budget())
        page.goto(base + 'discussion/', wait_until='networkidle', timeout=budget())
        page.wait_for_function('window.phdDeck && window.phdDeck.getState().count === 15', timeout=budget())
        verify('the discussion directory alias resolves offline without falling back to the main app')
        page.goto(base + 'offline.html', wait_until='networkidle', timeout=budget())
        wait_ready()

        for kind, row in [('zip', min(zip_rows, key=lambda row: row['bytes'])),
                          ('tif', min(tif_rows, key=lambda row: row['bytes']))]:
            page.evaluate('''path => {
                document.querySelector('#offline-test-download')?.remove();
                const link = document.createElement('a'); link.id = 'offline-test-download';
                link.href = new URL(path, location.href); link.download = path.split('/').pop();
                link.textContent = 'Download verified offline file'; document.body.append(link);
            }''', row['path'])
            with page.expect_download(timeout=budget(30000)) as event:
                page.locator('#offline-test-download').click()
            download = event.value
            destination = out / ('offline-download-' + Path(row['path']).name)
            download.save_as(str(destination))
            payload = destination.read_bytes()
            verify(f'real browser {kind.upper()} download succeeds offline with exact original bytes',
                   len(payload) == row['bytes'] and hashlib.sha256(payload).hexdigest() == row['sha256'])
            report.setdefault('downloads', []).append({'path': row['path'], 'file': destination.name,
                                                       'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()})

        raster = min((row for row in tif_rows if row['bytes'] >= 4096), key=lambda row: row['bytes'])
        source = (site / raster['path']).read_bytes()
        range_cases = [('bytes=128-1023', 206, source[128:1024], f'bytes 128-1023/{len(source)}'),
                       ('bytes=-1024', 206, source[-1024:], f'bytes {len(source)-1024}-{len(source)-1}/{len(source)}'),
                       (f'bytes={len(source)}-', 416, b'', f'bytes */{len(source)}')]
        for header, status, expected, content_range in range_cases:
            observed = page.evaluate('''async ({path, range}) => {
                const r = await fetch(path, {cache:'reload',headers:{Range:range},signal:AbortSignal.timeout(15000)});
                const bytes = await r.arrayBuffer();
                const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
                    .map(x => x.toString(16).padStart(2,'0')).join('');
                return {status:r.status,range:r.headers.get('Content-Range'),bytes:bytes.byteLength,sha256};
            }''', {'path': raster['path'], 'range': header})
            report.setdefault('ranges', []).append({'path': raster['path'], 'request': header, **observed})
            verify(f'offline TIFF {header} returns correct {status} body and Content-Range',
                   observed['status'] == status and observed['range'] == content_range and
                   observed['bytes'] == len(expected) and observed['sha256'] == hashlib.sha256(expected).hexdigest())
        sentinels = page.evaluate('''async () => {
            const other = await (await caches.open('user-other-cache')).match(new URL('private-sentinel.txt', location.origin));
            const scope = await (await caches.open('farmsystem-shell-%2Fother%2F-vtest')).match(new URL('/other/index.html', location.origin));
            return {local:localStorage.getItem('offline-test-user-sentinel'),other:other && await other.text(),
                    scope:scope && await scope.text(),keys:await caches.keys()};
        }''')
        report['sentinels'] = sentinels
        verify('saved plan remains unchanged after offline navigation, optimization, downloads and ranges', current_plans() == saved)
        verify('unrelated user localStorage, cache and other-site-scope cache survive unchanged',
               sentinels['local'] == 'keep-private-user-state' and sentinels['other'] == 'keep-other-cache' and
               sentinels['scope'] == 'keep-other-scope')
        verify('no server request succeeds after real server shutdown', len(report['requests']) == request_count)
        verify('offline workflow has no uncaught JavaScript exceptions', not report['pageErrors'])
        verify('no external live OSM/map/API request was triggered', not report['externalRequests'])
        report['status'] = 'PASS'
        write_report()
    except BaseException as error:
        report['status'] = 'FAIL'
        report['failure'] = str(error)
        report['traceback'] = traceback.format_exc()
        if page and not page.is_closed():
            try:
                report['failurePage'] = {'url': page.url, 'text': page.locator('body').inner_text(timeout=3000)[:12000]}
                page.screenshot(path=str(out / 'offline-failure.png'), full_page=True, timeout=5000)
            except Exception as capture_error:
                report['failureCaptureError'] = str(capture_error)
        write_report()
        raise
    finally:
        if context:
            context.close()
        if server and not server_closed:
            server.shutdown()
            server.server_close()
