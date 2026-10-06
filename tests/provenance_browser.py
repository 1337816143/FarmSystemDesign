"""Real-browser provenance regressions; metadata is controlled, accounting is not.

Run from browser.py or directly against the normal static HTTP server. Each
scenario blocks service workers so held routes cannot be bypassed by a cache.
No external Paper page or map tile needs to be fetched by this regression.
"""
from copy import deepcopy
from pathlib import Path
import json
import re
import time
from urllib.parse import unquote, urlsplit


WORKSPACE_KEY = 'farmsystem-workspace-v2'
PUBLISHED_COMMIT = '0123456789abcdef0123456789abcdef01234567'
PRIVATE_MARKER = 'PROVENANCE_LOCAL_NOTE_DO_NOT_TRANSMIT_71429'
PAPER_LINKS = {
    'totals.margin': 'https://1337816143.github.io/Paper/#/liang-indicator-audit/s2',
    'totals.water': 'https://1337816143.github.io/Paper/#/liang-indicator-audit/s5',
    'totals.labour': 'https://1337816143.github.io/Paper/#/liang-indicator-audit/s4',
    'totals.nSurplus': 'https://1337816143.github.io/Paper/#/liang-indicator-audit/s6',
    'totals.energy': 'https://1337816143.github.io/Paper/#/liang-indicator-audit/s3',
}


class ProvenanceBrowser:
    def __init__(self, browser, url, out, parent_check):
        self.browser = browser
        self.url = url.rstrip('/')
        self.out = Path(out)
        self.parent_check = parent_check
        self.context = None
        self.page = None
        self.stage = 'initialization'
        self.requests = []
        self.held = []
        self.report = {'checks': [], 'errors': [], 'scenarios': {}, 'screenshots': []}

    def write(self):
        self.report['lastStage'] = self.stage
        (self.out / 'provenance-browser-report.json').write_text(
            json.dumps(self.report, ensure_ascii=False, indent=2), encoding='utf-8')

    def check(self, name, value=True):
        self.report['lastCheck'] = {'name': name, 'passed': bool(value), 'stage': self.stage}
        try:
            self.parent_check('provenance: ' + name, value)
            self.report['checks'].append(name)
        finally:
            self.write()

    def page_error(self, error):
        self.report['errors'].append({
            'message': str(error), 'stack': getattr(error, 'stack', ''),
            'stage': self.stage, 'url': self.page.url,
        })
        self.write()

    def new_page(self, release, mode='verified', hold_fields=False):
        self.close_context()
        self.context = self.browser.new_context(
            viewport={'width': 1440, 'height': 1050}, accept_downloads=True,
            service_workers='block')
        self.context.set_default_timeout(15000)
        self.context.route('**/tile.openstreetmap.org/**', lambda route: route.abort())
        # A link click can be inspected without sending anything to Paper.
        self.context.route('https://1337816143.github.io/Paper/**', lambda route: route.fulfill(
            status=200, content_type='text/html', body='<title>Paper link fixture</title>'))
        self.context.on('request', lambda request: self.requests.append({
            'url': request.url, 'method': request.method, 'body': request.post_data or '',
        }))
        self.release = deepcopy(release)
        self.mode = mode
        self.held = []
        self.held_fields = []

        def metadata_route(route):
            if self.mode == 'hold':
                self.held.append(route)
            elif self.mode == 'failure':
                route.fulfill(status=503, content_type='application/json', body='{}')
            else:
                route.fulfill(status=200, content_type='application/json', body=json.dumps(self.release))

        self.context.route('**/version.json', metadata_route)
        if hold_fields:
            self.context.route('**/data/evidence/ftw-fields-2025.geojson',
                               lambda route: self.held_fields.append(route))
        # Observe real Worker messages. The cancellation test later dispatches a
        # genuine older result as an adversarial late MessageEvent on the old
        # worker; it never replaces Worker calculations or messages in transit.
        self.context.add_init_script('''(() => {
          const OriginalWorker = window.Worker;
          window.provenanceTestWorkers = [];
          window.Worker = class extends OriginalWorker {
            constructor(...args) {
              super(...args);
              window.provenanceTestWorkers.push(this);
              this.addEventListener('message', event => {
                if (event.data?.type === 'result') this.provenanceTestResult = event.data;
              });
            }
          };
        })();''')
        self.page = self.context.new_page()
        self.page.on('pageerror', self.page_error)
        self.page.goto(self.url + '/#planner', wait_until='domcontentloaded')
        self.page.wait_for_selector('.top-version')
        self.page.locator('[data-language="en"]').click()
        return self.page

    def close_context(self):
        if self.context:
            self.context.close()
            self.context = None

    def release_metadata(self):
        self.wait_held(self.held)
        self.check('metadata request was actually held in ' + self.stage, bool(self.held))
        route = self.held.pop(0)
        with self.page.expect_response(lambda response: response.url.endswith('/version.json')):
            route.fulfill(status=200, content_type='application/json', body=json.dumps(self.release))
        self.settle()

    def wait_held(self, routes):
        # Pump actual browser events until the route callback has run. Request
        # events can precede routing by one dispatcher turn in Playwright.
        deadline = time.monotonic() + 10
        while not routes:
            if time.monotonic() >= deadline:
                raise AssertionError('Expected held request did not reach its route: ' + self.stage)
            self.page.evaluate('() => new Promise(requestAnimationFrame)')

    def settle(self):
        # Two rendering turns let response/json continuations and MutationObservers
        # finish; no fixed sleep or network-idle wait can deadlock on a held route.
        self.page.evaluate('''async () => {
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
        }''')

    def defer_main_digest(self):
        self.page.evaluate('''() => {
          const subtle = crypto.subtle, original = subtle.digest;
          let release;
          const gate = new Promise(resolve => {release = resolve;});
          const probe = window.provenanceDigestGate = {original, release, started:0, completed:[]};
          subtle.digest = async function(...args) {
            probe.started++;
            const domain = new TextDecoder().decode(args[1]).split('\\n', 1)[0];
            await gate;
            const value = await original.apply(subtle, args);
            probe.completed.push(domain);
            return value;
          };
        }''')

    def release_main_digest(self):
        self.page.evaluate('window.provenanceDigestGate.release()')
        self.page.wait_for_function('''() => window.provenanceDigestGate.completed.includes(
          'FarmSystemDesign/FrozenRun/v1/computational')''')
        self.settle()
        self.page.evaluate('() => { crypto.subtle.digest = window.provenanceDigestGate.original; }')

    def verify_interrupted_save(self):
        for newer_intent in ['version', 'metric-contracts', 'navigation', 'candidate']:
            self.stage = 'deferred save interrupted by ' + newer_intent
            page = self.page
            before_plans = self.stored()['plans']
            original_candidate = page.locator('tr.selected-row').get_attribute('data-candidate')
            self.defer_main_digest()
            page.locator('[data-action="save-plan"]').click()
            page.wait_for_function('window.provenanceDigestGate.started > 0')
            self.check('save preparation is genuinely awaiting main-context digest for ' + newer_intent,
                       not page.locator('#modal').is_visible())
            if newer_intent in ['version', 'metric-contracts']:
                page.locator('.top-version' if newer_intent == 'version'
                             else '[data-action="metric-contracts"]').click()
                expected_dialog = page.locator('#modal').inner_text()
            elif newer_intent == 'navigation':
                self.nav('analysis')
            else:
                page.locator('tr[data-candidate]').nth(1).locator('button').click()
                expected_candidate = page.locator('tr.selected-row').get_attribute('data-candidate')
            self.release_main_digest()
            self.check('abandoned save preparation writes no snapshot after ' + newer_intent,
                       self.stored()['plans'] == before_plans)
            if newer_intent in ['version', 'metric-contracts']:
                self.check('late save cannot replace newer ' + newer_intent + ' dialog',
                           page.locator('#modal').is_visible()
                           and page.locator('#modal').inner_text() == expected_dialog
                           and page.locator('#modal [name="name"]').count() == 0)
                if newer_intent == 'metric-contracts':
                    self.screenshot('interrupted-save-preserves-dialog')
                self.close_modal()
            elif newer_intent == 'navigation':
                self.check('late save cannot reopen after leaving the planner',
                           not page.locator('#modal').is_visible()
                           and page.locator('nav [data-nav="analysis"]').get_attribute('aria-current') == 'page')
                self.nav('planner')
            else:
                self.check('late save cannot target a different selected candidate',
                           not page.locator('#modal').is_visible()
                           and page.locator('tr.selected-row').get_attribute('data-candidate') == expected_candidate
                           and expected_candidate != original_candidate)
                page.locator('tr[data-candidate="' + original_candidate + '"] button').click()

    def screenshot(self, name):
        filename = 'provenance-' + name + '.png'
        self.page.screenshot(path=str(self.out / filename), full_page=True)
        self.report['screenshots'].append(filename)
        self.write()

    def close_modal(self):
        self.page.locator('#modal [data-action="close-modal"]').first.click()
        self.page.wait_for_selector('#modal', state='hidden')

    def nav(self, name):
        self.page.locator('nav [data-nav="' + name + '"]').click()

    def ready_inputs(self):
        self.nav('data')
        self.page.wait_for_selector('[data-action="export-weather"]:not([disabled])')
        self.nav('planner')
        self.page.select_option('#scope', 'single')
        self.page.select_option('#scope-object', 'F01')

    def run(self):
        started = time.monotonic()
        self.page.locator('[data-action="run"]').first.click()
        self.page.wait_for_selector('[data-action="cancel-run"]', state='hidden', timeout=45000)
        self.page.wait_for_selector('[data-action="save-plan"]:not([disabled])', timeout=45000)
        return round((time.monotonic() - started) * 1000)

    def download(self, action, name):
        with self.page.expect_download(timeout=45000) as event:
            self.page.locator('[data-action="' + action + '"]').first.click()
        path = self.out / ('provenance-' + name + '-temporary.json')
        try:
            event.value.save_as(str(path))
            size = path.stat().st_size
            value = json.loads(path.read_text(encoding='utf-8'))
            return value, size
        finally:
            # Reports retain compact measurements, not whole private workspaces.
            path.unlink(missing_ok=True)

    def stored(self):
        return self.page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', WORKSPACE_KEY)

    def import_bundle(self, bundle, filename):
        self.nav('data')
        self.page.locator('#import-file').set_input_files({
            'name': filename, 'mimeType': 'application/json',
            'buffer': json.dumps(bundle, ensure_ascii=False).encode('utf-8'),
        })
        self.page.wait_for_selector('#modal[open]')
        self.page.locator('#modal-form button[type="submit"]').click()
        self.page.wait_for_selector('#modal', state='hidden')

    def verify_metadata_and_contracts(self, published):
        self.stage = 'pending version independent of map fetch'
        page = self.new_page(published, mode='hold', hold_fields=True)
        page.locator('.top-version').click()
        page.wait_for_selector('#modal [data-release-state="pending"]')
        page.locator('#modal').evaluate("node => node.dataset.provenanceTestIdentity = 'original-dialog'")
        pending = page.locator('#modal [data-release-state]').inner_text().lower()
        self.check('pending metadata is loading, never an invented local preview',
                   'loading' in pending and 'preview' not in pending)
        self.wait_held(self.held_fields)
        self.check('unrelated FTW resource remains held', bool(self.held_fields))
        self.release_metadata()
        page.wait_for_selector('#modal [data-release-state="verified"]')
        self.check('same open dialog updates to the consistent 40-hex source identity',
                   page.locator('#modal').get_attribute('data-provenance-test-identity') == 'original-dialog'
                   and page.locator('#modal [data-release-state]').inner_text() == PUBLISHED_COMMIT
                   and page.locator('#modal').is_visible())
        self.check('version readiness does not wait for unrelated map resources', bool(self.held_fields))
        self.screenshot('version-verified-map-pending')
        self.close_modal()
        for route in self.held_fields:
            route.continue_()
        self.held_fields.clear()
        self.ready_inputs()

        self.stage = 'five English metric contracts and stable evidence links'
        page.locator('[data-action="metric-contracts"]').click()
        page.wait_for_selector('.metric-contracts')
        self.check('five contracts cover the five existing total fields',
                   set(page.locator('.metric-contract').evaluate_all(
                       'nodes => nodes.map(node => node.dataset.metric)')) == set(PAPER_LINKS)
                   and page.locator('.metric-contract').count() == 5)
        for details in page.locator('.metric-contract details').all():
            details.locator('summary').click()
        self.check('complete English contract content has no untranslated Chinese',
                   not re.search(r'[\u3400-\u9fff]', page.locator('#modal').inner_text()))
        contract_text = page.locator('.metric-contracts').inner_text().lower()
        self.check('metric contracts disclose D grade, synthetic coefficients and three-month totals',
                   all(word in contract_text for word in ['grade d', 'synthetic', 'uncalibrated', 'three-month'])
                   and 'not used by the calculation' in contract_text)
        for field, link in PAPER_LINKS.items():
            links = page.locator('.metric-contract[data-metric="' + field + '"] a').evaluate_all(
                'nodes => nodes.map(node => node.href)')
            self.check(field + ' points to its stable Paper ledger section', link in links)
        self.screenshot('contracts-desktop')
        page.set_viewport_size({'width': 390, 'height': 844})
        self.check('English metric contracts fit the mobile document and dialog', page.evaluate('''() => {
          const modal = document.querySelector('#modal'), r = modal.getBoundingClientRect();
          return document.documentElement.scrollWidth <= innerWidth + 1 &&
            r.left >= -1 && r.right <= innerWidth + 1 && modal.scrollWidth <= modal.clientWidth + 1 &&
            [...modal.querySelectorAll('.metric-contract')].every(n => n.scrollWidth <= n.clientWidth + 1);
        }'''))
        self.screenshot('contracts-mobile-english')
        self.close_modal()
        page.locator('[data-language="both"]').click()
        page.locator('[data-action="metric-contracts"]').click()
        self.check('bilingual metric contracts fit the mobile dialog', page.evaluate('''() => {
          const modal = document.querySelector('#modal');
          return document.documentElement.scrollWidth <= innerWidth + 1 && modal.scrollWidth <= modal.clientWidth + 1;
        }'''))
        self.screenshot('contracts-mobile-bilingual')

        for replacement in [False, True]:
            self.stage = 'late metadata after ' + ('replacement dialog' if replacement else 'dismissal')
            page = self.new_page(published, mode='hold')
            page.locator('.top-version').click()
            page.wait_for_selector('#modal [data-release-state="pending"]')
            self.close_modal()
            if replacement:
                page.locator('[data-action="metric-contracts"]').click()
                original = page.locator('#modal').inner_text()
            self.release_metadata()
            if replacement:
                self.check('late metadata cannot overwrite a newer metric dialog',
                           page.locator('#modal').inner_text() == original
                           and page.locator('#modal .metric-contract').count() == 5
                           and page.locator('#modal [data-release-state]').count() == 0)
                self.close_modal()
            else:
                self.check('late metadata cannot reopen a dismissed dialog', not page.locator('#modal').is_visible())
            # Proves the late response was processed even though its old dialog
            # was not updated; reopening must now expose the verified state.
            page.locator('.top-version').click()
            page.wait_for_selector('#modal [data-release-state="verified"]')
            self.check('later explicit open uses resolved metadata after ' + ('replacement' if replacement else 'dismissal'),
                       page.locator('#modal [data-release-state]').inner_text() == PUBLISHED_COMMIT)

        for failure in ['failure', 'mismatch']:
            self.stage = 'metadata ' + failure
            fixture = deepcopy(published)
            if failure == 'mismatch':
                fixture['engineDigest'] = '0' * 64
            page = self.new_page(fixture, mode='failure' if failure == 'failure' else 'verified')
            page.locator('.top-version').click()
            page.wait_for_selector('#modal [data-release-state="unavailable"]')
            text = page.locator('#modal [data-release-state]').inner_text().lower()
            self.check(failure + ' metadata is unavailable, never local preview or a verified commit',
                       'unavailable' in text and 'preview' not in text and PUBLISHED_COMMIT not in text)
            self.screenshot('version-' + failure)

    def verify_runs_and_saved_records(self, published):
        self.stage = 'failed metadata with real F01 search'
        page = self.new_page(published, mode='failure')
        self.ready_inputs()
        self.nav('resources')
        page.locator('[data-resource-tab="plots"]').click()
        page.locator('[data-action="edit-plot"]').first.click()
        page.locator('#modal textarea[name="note"]').fill(PRIVATE_MARKER)
        page.locator('#modal-form button[type="submit"]').click()
        page.wait_for_selector('#modal', state='hidden')
        input_dataset = self.stored()['dataset']
        self.check('synthetic private marker is stored only in a local plot note',
                   any(plot.get('note') == PRIVATE_MARKER for plot in input_dataset['plots']))
        self.nav('planner')
        search_ms = self.run()
        result, result_bytes = self.download('export-results', 'incomplete-search')
        frozen = result['frozenRun']
        self.check('metadata failure still returns the real 256/199/191 F01 result',
                   result['evaluated'] == 256 and result['feasibleCount'] == 199
                   and result['frontierCount'] == len(result['candidates']) == 191)
        self.check('failed release metadata remains an explicitly incomplete run record',
                   frozen['captureStatus'] == 'incomplete-record'
                   and frozen['releaseState']['status'] == 'unavailable'
                   and any('release-metadata' in issue for issue in frozen['captureIssues']))
        self.check('full export retains original dispatch inputs and private note locally',
                   result['runInputs']['dataset'] == input_dataset
                   and result['runInputs']['farmIds'] == ['F01']
                   and result['runInputs']['config'] == result['config']
                   and len(result['runInputs']['climate']['records']) == 12)
        parameters = page.evaluate("async () => {const d = await import('./src/data.js'); return {CROPS:d.CROPS, ANNUALS:d.ANNUALS};}")
        self.check('full export freezes the actual execution coefficients', frozen['parameters'] == parameters)
        self.check('inputs and sidecar are retained once, with no per-candidate copies',
                   frozen['inputsRef'] == 'runInputs' and 'runInputs' not in frozen and 'dataset' not in frozen
                   and all('frozenRun' not in candidate and 'runInputs' not in candidate
                           and 'parameters' not in candidate for candidate in result['candidates']))
        self.check('incomplete metadata leaves content and build-identity digests available',
                   set(frozen['digests']) == {'inputs', 'parameters', 'engineSource', 'output',
                                             'computational', 'explanatory', 'buildIdentity'}
                   and all(re.fullmatch('[a-f0-9]{64}', value or '') for value in frozen['digests'].values()))
        page.locator('[data-action="inspect-run"]').click()
        self.check('run inspector distinguishes incomplete recording from available results',
                   'Run record incomplete' in page.locator('#modal').inner_text()
                   and 'not signatures' in page.locator('#modal').inner_text())
        self.screenshot('incomplete-run')
        self.close_modal()
        self.check('full-download privacy warning is visible before exporting',
                   'original inputs, geometry and notes' in page.locator('.run-record-panel').inner_text()
                   and 'private information' in page.locator('.run-record-panel').inner_text())

        self.stage = 'save dialog input staleness'
        page.locator('[data-action="save-plan"]').click()
        page.wait_for_selector('#modal [name="name"]')
        # The modal makes the background inert for pointer events. A real DOM
        # input event still exercises a programmatic/same-tab input change while
        # the save form is open, without reaching into the app's private state.
        page.locator('#water').evaluate('''node => {
          node.value = '90'; node.dispatchEvent(new Event('input', {bubbles:true}));
        }''')
        page.locator('#modal-form button[type="submit"]').click()
        page.wait_for_function("() => Boolean(document.querySelector('#form-error')?.textContent.trim())")
        self.check('stale inputs block save at modal submission',
                   page.locator('#modal').is_visible() and not self.stored()['plans'])
        self.screenshot('stale-save-rejected')
        self.close_modal()
        page.locator('[data-scenario="normal"]').click()
        self.check('restoring exact original scenario makes the original run savable',
                   page.locator('[data-action="save-plan"]').is_enabled())

        self.verify_interrupted_save()

        self.stage = 'selected incomplete snapshot integrity'
        page.locator('[data-action="save-plan"]').click()
        page.locator('#modal [name="name"]').fill('Provenance incomplete F01')
        page.locator('#modal-form button[type="submit"]').click()
        page.wait_for_selector('#modal', state='hidden')
        incomplete_plan = self.stored()['plans'][0]
        self.check('selected snapshot uses dispatch-time inputs and selected output',
                   incomplete_plan['dataset'] == result['runInputs']['dataset']
                   and incomplete_plan['config'] == result['runInputs']['config']
                   and incomplete_plan['climate'] == result['runInputs']['climate']
                   and incomplete_plan['candidate'] == result['candidates'][0]
                   and incomplete_plan['baseline'] == result['baseline'])
        selected = incomplete_plan['frozenRun']
        self.check('selected record is compact and cites rather than embeds its parent frontier',
                   selected['scope'] == 'selected-candidate'
                   and selected['parentReference']['computationalDigest'] == frozen['digests']['computational']
                   and 'candidateDigests' not in selected['output']
                   and 'candidates' not in incomplete_plan and 'runInputs' not in incomplete_plan
                   and 'results' not in incomplete_plan and 'runInputs' not in selected)
        self.nav('feedback')
        page.locator('[data-action="inspect-plan-record"]').first.click()
        page.wait_for_function("() => document.querySelector('#frozen-verification')?.textContent.includes('Retained content digests match')")
        self.check('saved incomplete record can verify retained content without claiming scientific validity',
                   'not source authentication or scientific validation' in page.locator('#frozen-verification').inner_text()
                   and 'not proof of rechecking the complete frontier' in page.locator('#modal').inner_text())
        self.screenshot('saved-record-verification')
        self.close_modal()

        self.stage = 'deferred saved-record verification cannot replace a newer dialog'
        self.defer_main_digest()
        page.locator('[data-action="inspect-plan-record"]').first.click()
        page.wait_for_function('window.provenanceDigestGate.started > 0')
        page.wait_for_selector('#frozen-verification')
        self.close_modal()
        self.nav('planner')
        page.locator('[data-action="metric-contracts"]').click()
        expected_dialog = page.locator('#modal').inner_text()
        self.release_main_digest()
        self.check('late saved-record digest verification cannot overwrite a different dialog',
                   page.locator('#modal').inner_text() == expected_dialog
                   and page.locator('#frozen-verification').count() == 0
                   and page.locator('#modal .metric-contract').count() == 5)
        self.close_modal()

        self.stage = 'local note and static Paper link privacy'
        self.nav('planner')
        page.locator('[data-action="metric-contracts"]').click()
        article = page.locator('.metric-contract[data-metric="totals.margin"]')
        article.locator('summary').click()
        link = article.locator('a[href="' + PAPER_LINKS['totals.margin'] + '"]')
        with page.expect_popup() as popup_event:
            link.click()
        popup = popup_event.value
        popup.wait_for_load_state('domcontentloaded')
        self.check('Paper opens only its stable public ledger ID', popup.url == PAPER_LINKS['totals.margin'])
        popup.close()
        self.close_modal()

        self.stage = 'complete public identity and immutable earlier record'
        self.mode = 'verified'
        complete_ms = self.run()
        complete, complete_bytes = self.download('export-results', 'complete-search')
        self.check('consistent published source identity produces a complete real run record',
                   complete['frozenRun']['captureStatus'] == 'complete-record'
                   and complete['frozenRun']['releaseState']['metadata']['commit'] == PUBLISHED_COMMIT
                   and complete['frontierCount'] == 191)
        self.check('later metadata success never upgrades the saved incomplete snapshot',
                   self.stored()['plans'][0] == incomplete_plan)
        self.check('metadata status does not change identical accounting or computational digests',
                   complete['candidates'] == result['candidates']
                   and all(complete['frozenRun']['digests'][key] == value
                           for key, value in frozen['digests'].items() if key != 'buildIdentity')
                   and complete['frozenRun']['digests']['buildIdentity'] != frozen['digests']['buildIdentity'])
        page.locator('[data-action="save-plan"]').click()
        page.locator('#modal [name="name"]').fill('Provenance complete F01')
        page.locator('#modal-form button[type="submit"]').click()
        page.wait_for_selector('#modal', state='hidden')
        complete_plan = self.stored()['plans'][0]
        self.check('selected published snapshot also has a complete bounded record',
                   complete_plan['frozenRun']['captureStatus'] == 'complete-record'
                   and complete_plan['frozenRun']['scope'] == 'selected-candidate'
                   and 'candidateDigests' not in complete_plan['frozenRun']['output'])
        page.locator('[data-action="inspect-run"]').click()
        self.check('complete run inspector labels identity as a declaration',
                   'declared build identity is consistent' in page.locator('#modal').inner_text())
        self.screenshot('complete-run')
        self.close_modal()

        self.stage = 'cancel and replacement run with adversarial late result'
        self.mode = 'hold'
        with page.expect_request(lambda request: request.url.endswith('/version.json')):
            page.locator('[data-action="run"]').first.click()
        page.wait_for_selector('[data-action="cancel-run"]')
        cancelled_index = page.evaluate('window.provenanceTestWorkers.length - 1')
        self.wait_held(self.held)
        self.check('cancel test holds an actual worker metadata response', bool(self.held))
        page.locator('[data-action="cancel-run"]').click()
        self.check('cancel leaves the previous valid record and clears running UI',
                   page.locator('[data-action="cancel-run"]').count() == 0
                   and page.locator('[data-action="run"]').first.is_enabled())
        # Termination may already have aborted this request. Explicitly dispose
        # every held response before starting the replacement worker.
        for route in self.held:
            try:
                route.abort()
            except Exception as error:
                if not any(word in str(error).lower() for word in ['closed', 'handled', 'invalid interception']):
                    raise
        self.held.clear()
        self.mode = 'verified'
        page.locator('#water').fill('95')
        page.locator('#water').dispatch_event('input')
        page.locator('#water').dispatch_event('change')
        replacement_ms = self.run()
        replacement, _ = self.download('export-results', 'replacement-search')
        self.check('replacement worker freezes its own changed inputs',
                   replacement['runInputs']['config']['water'] == .95
                   and replacement['frozenRun']['digests']['inputs'] != complete['frozenRun']['digests']['inputs'])
        page.evaluate('''index => {
          const workers = window.provenanceTestWorkers;
          const oldMessage = workers.find(worker => worker.provenanceTestResult)?.provenanceTestResult;
          if (!oldMessage) throw new Error('No genuine old worker result was captured');
          workers[index].dispatchEvent(new MessageEvent('message', {data:structuredClone(oldMessage)}));
          workers[index].dispatchEvent(new MessageEvent('message', {data:{type:'error',error:'late cancelled worker'}}));
        }''', cancelled_index)
        after_late, _ = self.download('export-results', 'after-late-message')
        self.check('cancelled worker late result and error cannot revive or replace newer output',
                   after_late == replacement and page.locator('[data-action="save-plan"]').is_enabled()
                   and 'late cancelled worker' not in page.locator('#toast').inner_text())

        self.stage = 'legacy schema-one project and plan import'
        bundle, _ = self.download('export-bundle', 'project')
        legacy = deepcopy(complete_plan)
        legacy.pop('frozenRun')
        legacy['applicationVersion'] = '0.3.13'
        legacy['name'] = 'Historical plan without provenance'
        legacy_bundle = deepcopy(bundle)
        legacy_bundle.update(version='0.3.13', plans=[legacy], observations=[], audit=[])
        self.import_bundle(legacy_bundle, 'legacy-schema-one-project.json')
        self.check('legacy project imports its old plan unchanged without today\'s parameters',
                   self.stored()['plans'] == [legacy] and 'frozenRun' not in self.stored()['plans'][0])
        self.nav('feedback')
        page.locator('[data-action="inspect-plan-record"]').click()
        self.check('legacy inspector admits missing provenance and does not backfill it',
                   'Historical snapshot' in page.locator('#modal').inner_text()
                   and 'without adding current coefficients' in page.locator('#modal').inner_text()
                   and page.locator('#frozen-verification').count() == 0
                   and page.locator('#modal pre').count() == 0)
        self.screenshot('legacy-record')
        self.close_modal()
        page.reload(wait_until='domcontentloaded')
        page.wait_for_selector('[data-action="inspect-plan-record"]')
        self.check('historical plan still has no backfilled sidecar after reload', self.stored()['plans'] == [legacy])

        self.stage = 'tampered imported claim fails retained-content verification'
        tampered = deepcopy(complete_plan)
        tampered['candidate']['totals']['margin'] += 1
        tampered['name'] = 'Changed imported result'
        tampered_bundle = deepcopy(bundle)
        tampered_bundle.update(plans=[tampered], observations=[], audit=[])
        self.import_bundle(tampered_bundle, 'changed-record-project.json')
        self.nav('feedback')
        page.locator('[data-action="inspect-plan-record"]').click()
        page.wait_for_function("() => document.querySelector('#frozen-verification')?.textContent.includes('could not be verified')")
        self.check('imported complete-record claim cannot hide changed retained output',
                   'Treat this imported or incomplete record as a claim' in page.locator('#frozen-verification').inner_text())
        self.screenshot('tampered-record-rejected')
        self.report['scenarios']['F01'] = {
            'evaluated': result['evaluated'], 'feasible': result['feasibleCount'], 'frontier': result['frontierCount'],
            'incompleteSearchMs': search_ms, 'completeSearchMs': complete_ms, 'replacementSearchMs': replacement_ms,
            'fullExportBytes': result_bytes, 'completeExportBytes': complete_bytes,
            'selectedPlanBytes': len(json.dumps(complete_plan, ensure_ascii=False).encode('utf-8')),
            'computationalDigest': frozen['digests']['computational'],
        }
        self.write()

    def verify_local_preview(self, published):
        self.stage = 'explicit local-preview metadata'
        local = deepcopy(published)
        local['commit'] = 'local-preview'
        page = self.new_page(local)
        self.ready_inputs()
        page.locator('.top-version').click()
        page.wait_for_selector('#modal [data-release-state="verified"]')
        self.check('only explicit local-preview metadata displays Local preview',
                   page.locator('#modal [data-release-state]').inner_text() == 'Local preview')
        self.close_modal()
        elapsed = self.run()
        result, size = self.download('export-results', 'local-preview-search')
        self.check('local-preview computation succeeds but cannot claim published completeness',
                   result['frontierCount'] == 191
                   and result['frozenRun']['captureStatus'] == 'incomplete-record'
                   and any('local-preview-without-published-commit' in issue
                           for issue in result['frozenRun']['captureIssues']))
        self.report['scenarios']['localPreview'] = {'frontier': 191, 'searchMs': elapsed, 'exportBytes': size}

    def verify_privacy(self):
        self.stage = 'aggregate local-only privacy and browser errors'
        self.check('private local-note marker never appears in any request URL or body',
                   all(PRIVATE_MARKER not in unquote(request['url'])
                       and PRIVATE_MARKER not in request['body'] for request in self.requests))
        paper_requests = [request for request in self.requests
                          if urlsplit(request['url']).hostname == '1337816143.github.io'
                          and urlsplit(request['url']).path.startswith('/Paper/')]
        self.check('Paper receives only a static link navigation, with no runtime inputs',
                   len(paper_requests) == 1
                   and all(request['method'] == 'GET' and not request['body']
                           and not urlsplit(request['url']).query
                           and urlsplit(request['url']).path == '/Paper/'
                           for request in paper_requests))
        self.report['privacy'] = {'requestCount': len(self.requests), 'paperStaticNavigations': len(paper_requests),
                                  'privateMarkerTransmitted': False}
        self.check('provenance workflows have no JavaScript page errors', not self.report['errors'])


def verify_provenance(browser, url, out, check):
    suite = ProvenanceBrowser(browser, url, out, check)
    probe = browser.new_context(service_workers='block')
    try:
        response = probe.request.get(url.rstrip('/') + '/version.json')
        suite.check('served metadata is available for the fixture', response.ok)
        release = response.json()
        suite.check('served application metadata is v0.3.16', release['version'] == '0.3.16')
    finally:
        probe.close()
    published = {**release, 'commit': PUBLISHED_COMMIT}
    try:
        suite.verify_metadata_and_contracts(published)
        suite.verify_runs_and_saved_records(published)
        suite.verify_local_preview(published)
        suite.verify_privacy()
        suite.report['passed'] = len(suite.report['checks'])
    except Exception as error:
        suite.report['failure'] = {'stage': suite.stage, 'message': str(error)}
        if suite.page and not suite.page.is_closed():
            try:
                suite.screenshot('failure')
            except Exception as screenshot_error:
                suite.report['screenshotError'] = str(screenshot_error)
        raise
    finally:
        suite.write()
        suite.close_context()


if __name__ == '__main__':
    import argparse
    import os
    from playwright.sync_api import sync_playwright
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:4173')
    parser.add_argument('--output', default='test-results')
    args = parser.parse_args()
    output = Path(args.output)
    output.mkdir(exist_ok=True, parents=True)
    checks = []

    def check(name, value=True):
        assert value, name
        checks.append(name)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True, executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'))
        try:
            verify_provenance(browser, args.url, output, check)
        finally:
            browser.close()
    print(json.dumps({'passed': len(checks), 'checks': checks}, ensure_ascii=False))
