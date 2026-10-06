"""Serve real legacy bytes with a warm HTTP cache, then upgrade in the same browser context."""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, unquote
import hashlib
import json
import threading
import time


def verify_upgrade(browser, url, out, check):
    root = Path(__file__).resolve().parents[1]
    out = Path(out)
    fixture = json.loads((root / 'tests/fixtures/upgrade-shell-0.3.15.json').read_text())
    for name, text in fixture['files'].items():
        payload = text.encode()
        assert hashlib.sha1(f'blob {len(payload)}\0'.encode() + payload).hexdigest() == fixture['gitBlobShas'][name]
    state = {'phase': 'legacy', 'requests': []}

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root), **kwargs)

        def log_message(self, *args):
            pass

        def end_headers(self):
            # No Playwright routes: routing disables the very HTTP cache being tested.
            self.send_header('Cache-Control', 'public, max-age=3600')
            super().end_headers()

        def do_GET(self):
            path = unquote(urlsplit(self.path).path).lstrip('/') or 'index.html'
            state['requests'].append({'phase': state['phase'], 'path': path,
                                      'cacheControl': self.headers.get('Cache-Control')})
            legacy = state['phase'] == 'legacy' or (state['phase'] == 'mixed' and path in ['src/app.js', 'src/results.js', 'sw.js'])
            if legacy and path in fixture['files']:
                payload = fixture['files'][path].encode()
                self.send_response(200)
                self.send_header('Content-Type', self.guess_type(path))
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
            else:
                super().do_GET()

    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    context = browser.new_context(viewport={'width': 1440, 'height': 1050}, accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    report = {'sourceCommit': fixture['sourceCommit'], 'checks': [], 'errors': errors}

    def snapshot(stage):
        report.setdefault('stages', []).append({'stage': stage, 'observed': page.evaluate('''async()=>{
            const r=await navigator.serviceWorker.getRegistration(),keys=await caches.keys(),cached=[];
            for(const key of keys){const cache=await caches.open(key);const values={},entries=(await cache.keys()).length;
              for(const path of ['src/app.js','src/version.js','src/engine-identity.generated.js']){
                const response=await cache.match(new URL(path,location.href));
                if(response){const text=await response.text();values[path]={length:text.length,hasDiagnostics:text.includes('infeasibleDetails'),version:text.match(/(?:VERSION = |applicationVersion": )['"]([^'"]+)/)?.[1]||null};}
              }cached.push({key,entries,values});
            }
            const controllerIdentity=await new Promise(resolve=>{if(!navigator.serviceWorker.controller)return resolve(null);const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(null);},300);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};navigator.serviceWorker.controller.postMessage({type:'FARM_SHELL_IDENTITY'},[channel.port2]);});
            const worker=w=>w?{url:w.scriptURL,state:w.state}:null;
            return {badge:document.querySelector('.top-version')?.textContent,title:document.title,body:document.body.innerText.slice(0,1800),controller:worker(navigator.serviceWorker.controller),controllerIdentity,registration:r?{scope:r.scope,active:worker(r.active),installing:worker(r.installing),waiting:worker(r.waiting)}:null,cached};
        }''')})
        report['requests'] = state['requests']
        (out / 'upgrade-browser-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))

    def response_observed(response):
        path = urlsplit(response.url).path.lstrip('/')
        if path not in ['src/app.js', 'src/version.js', 'src/engine-identity.generated.js', 'version.json']:
            return
        try:
            payload = response.body()
            report.setdefault('moduleResponses', []).append({'phase': state['phase'], 'path': path,
                'status': response.status, 'fromServiceWorker': response.from_service_worker,
                'sha256': hashlib.sha256(payload).hexdigest(), 'bytes': len(payload),
                'cacheControl': response.headers.get('cache-control')})
        except Exception as error:
            report.setdefault('observationErrors', []).append(str(error))
    page.on('response', response_observed)

    def verify(name, value=True):
        check('upgrade: ' + name, value)
        report['checks'].append(name)
        (out / 'upgrade-browser-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))

    def wait_version(version):
        page.wait_for_function('(v)=>document.querySelector(".top-version")?.textContent===v', arg='v' + version)

    def wait_current_worker(target_page, expected_cache):
        # wait_for_function treats a returned Promise as truthy in its polling loop.
        # Await the full async observation explicitly, then poll its boolean result.
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            ready = target_page.evaluate("""async key=>{
                const registration=await navigator.serviceWorker.getRegistration();
                const controller=navigator.serviceWorker.controller;
                if(!controller || !registration?.active || registration.active.state!=='activated' ||
                   registration.installing || registration.waiting || controller!==registration.active)return false;
                const identity=await new Promise(resolve=>{
                    const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(null);},300);
                    channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};
                    controller.postMessage({type:'FARM_SHELL_IDENTITY'},[channel.port2]);
                });
                if(identity?.cache!==key || !Array.isArray(identity.shell) || identity.shell.length<40)return false;
                const cache=await caches.open(key);
                const complete=await Promise.all(identity.shell.map(path=>cache.match(new URL(path,location.href))));
                if(complete.some(response=>!response?.ok))return false;
                const app=await cache.match(new URL('src/app.js',location.href));
                const version=await cache.match(new URL('src/version.js',location.href));
                return !!app && !!version && (await app.text()).includes('infeasibleDetails') &&
                       (await version.text()).includes("VERSION = '0.3.16'");
            }""", expected_cache)
            if ready:
                return
            time.sleep(0.1)
        raise AssertionError('The expected worker did not control this legacy session with a complete new shell')

    def run_zero():
        page.select_option('#scope', 'region')
        for name in ['water', 'labour']:
            page.locator('#' + name).press('Home')
            page.locator('#' + name).press('Tab')
        page.locator('[data-action="run"]').first.click()
        page.wait_for_function('!document.querySelector("[data-action=run]").disabled', timeout=60000)

    try:
        page.goto(f'http://127.0.0.1:{server.server_port}/#planner', wait_until='networkidle')
        wait_version('0.3.15')
        page.wait_for_function('navigator.serviceWorker.controller !== null', timeout=60000)
        page.select_option('#scope', 'single')
        page.select_option('#scope-object', 'F01')
        page.locator('[data-action="run"]').first.click()
        page.wait_for_selector('[data-action="save-plan"]', timeout=60000)
        page.locator('[data-action="save-plan"]').click()
        page.locator('#plan-name').fill('Actual legacy plan preserved across upgrade')
        page.locator('#modal-form button[type=submit]').click()
        saved = page.evaluate("JSON.parse(localStorage.getItem('farmsystem-workspace-v2')).plans")
        verify('legacy fixture creates an actual 0.3.15 saved snapshot',
               saved[0]['frozenRun']['engineIdentity']['applicationVersion'] == '0.3.15')
        page.reload(wait_until='networkidle')
        run_zero()
        verify('real warm legacy app reproduces the eight-reason truncation',
               page.locator('.infeasible-details').count() == 0 and
               'F02 · 1月劳动超限' in page.locator('main').inner_text() and
               'F13 · 3月劳动超限' not in page.locator('main').inner_text())
        snapshot('warm-legacy')
        state['phase'] = 'candidate'
        page.reload(wait_until='networkidle')
        new_cache = 'farmsystem-v0.3.16-20261006-constraint-diagnostics-r1'
        wait_current_worker(page, new_cache)
        first_version = page.locator('.top-version').inner_text()
        report['firstReloadAppVersion'] = first_version
        snapshot('new-cache-ready-before-second-reload')
        if first_version == 'v0.3.15':
            page.locator('.top-version').click()
            page.wait_for_selector('[data-release-state="unavailable"]')
            verify('transitional old document does not claim the new build identity',
                   '暂未取得一致的构建信息' in page.locator('#modal').inner_text())
            page.locator('#modal [data-action="close-modal"]').first.click()
        # Activation cannot replace code already running. Do not auto-reload or clear user state.
        page.reload(wait_until='networkidle')
        snapshot('after-second-ordinary-reload')
        wait_version('0.3.16')
        run_zero()
        page.wait_for_selector('.infeasible-details')
        page.locator('.infeasible-details summary').click()
        verify('ordinary reload after activation executes the new 78-reason UI',
               page.locator('.infeasible-violations li').count() == 78 and
               page.locator('.infeasible-balances tbody tr').count() == 78)
        verify('upgrade requests actually revalidate app, version and results modules',
               all(any(r['phase'] == 'candidate' and r['path'] == name and
                       r['cacheControl'] in ['no-cache', 'max-age=0'] for r in state['requests'])
                   for name in ['src/app.js', 'src/version.js', 'src/results.js']))
        verify('legacy saved snapshot survives upgrade unchanged',
               page.evaluate("JSON.parse(localStorage.getItem('farmsystem-workspace-v2')).plans") == saved)
        context.set_offline(True)
        page.reload(wait_until='domcontentloaded')
        wait_version('0.3.16')
        run_zero()
        verify('offline reload retains new code and old saved plans',
               page.locator('.infeasible-violations li').count() == 78 and
               page.locator('.infeasible-balances tbody tr').count() == 78 and
               page.evaluate("JSON.parse(localStorage.getItem('farmsystem-workspace-v2')).plans") == saved)
        context.set_offline(False)
        page.set_viewport_size({'width': 390, 'height': 844})
        page.locator('button[data-language="both"]').click()
        page.wait_for_function("!document.querySelector('#toast').classList.contains('show') && getComputedStyle(document.querySelector('#toast')).opacity==='0'")
        page.wait_for_function("document.querySelector('.sidebar').getBoundingClientRect().right<=1")
        page.locator('.infeasible-details summary').scroll_into_view_if_needed()
        verify('settled bilingual mobile upgrade has no document overflow or toast overlay',
               page.evaluate("document.documentElement.scrollWidth<=innerWidth+1 && !document.querySelector('#toast').classList.contains('show') && getComputedStyle(document.querySelector('#toast')).opacity==='0'"))
        page.screenshot(path=str(out / 'planner-upgraded-mobile-clean.png'))
        page.set_viewport_size({'width': 1440, 'height': 1050})
        page.locator('button[data-language="zh"]').click()
        page.locator('.infeasible-details summary').scroll_into_view_if_needed()
        page.screenshot(path=str(out / 'planner-upgraded-desktop-clean.png'))
        # Negative control: fresh version/identity modules alone can label an old UI.
        # Actual DOM behavior, rather than the badge, is the upgrade acceptance criterion.
        mixed = browser.new_context(viewport={'width': 1440, 'height': 1050})
        try:
            state['phase'] = 'mixed'
            probe = mixed.new_page()
            probe.on('pageerror', lambda error: errors.append('mixed: ' + str(error)))
            probe.goto(f'http://127.0.0.1:{server.server_port}/#planner', wait_until='networkidle')
            probe.wait_for_function("document.querySelector('.top-version')?.textContent==='v0.3.16'")
            probe.wait_for_function('navigator.serviceWorker.controller !== null', timeout=60000)
            for name in ['water', 'labour']:
                probe.locator('#' + name).press('Home')
                probe.locator('#' + name).press('Tab')
            probe.locator('[data-action="run"]').first.click()
            probe.wait_for_function('!document.querySelector("[data-action=run]").disabled', timeout=60000)
            verify('negative control proves a fresh badge is not proof of the new renderer',
                   probe.locator('.infeasible-details').count() == 0 and
                   'F02 · 1月劳动超限' in probe.locator('main').inner_text())
            state['phase'] = 'candidate'
            probe.reload(wait_until='networkidle')
            wait_current_worker(probe, new_cache)
            probe.reload(wait_until='networkidle')
            for name in ['water', 'labour']:
                probe.locator('#' + name).press('Home')
                probe.locator('#' + name).press('Tab')
            probe.locator('[data-action="run"]').first.click()
            probe.wait_for_selector('.infeasible-details', timeout=60000)
            probe.locator('.infeasible-details summary').click()
            verify('activated new worker plus ordinary reload repairs the mixed-shell negative control',
                   probe.locator('.infeasible-violations li').count() == 78)
        finally:
            mixed.close()
        verify('upgrade workflow including mixed negative control has no JavaScript exceptions', not errors)
        report['requests'] = state['requests']
        (out / 'upgrade-browser-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    except BaseException as error:
        report['failure'] = str(error)
        snapshot('failure')
        page.screenshot(path=str(out / 'planner-upgrade-failure.png'), full_page=True)
        raise
    finally:
        context.close()
        server.shutdown()
        server.server_close()
