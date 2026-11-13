"""Reconstructed real-browser regression. NOT_RUN in the restricted cloud workspace.
Use only an authorized externally served candidate and FARM_ALLOW_BROWSER=1.
No server is started here. Do not bypass the cloud Chromium socket restriction.
"""
import argparse
import json
import os
from pathlib import Path


def verify_route_a_np(browser, url, out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 1050}, accept_downloads=True)
    page = context.new_page()
    errors, checks = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    def check(name, ok):
        checks.append({'name': name, 'passed': bool(ok)})
        (out / 'browser-checks.json').write_text(json.dumps(checks, indent=2), encoding='utf-8')
        assert ok, name
    def download(selector, name):
        with page.expect_download() as event:
            page.locator(selector).first.click()
        event.value.save_as(str(out / name))
        return (out / name).read_bytes().decode('utf-8')
    def run():
        page.locator('[data-action="run"]').first.click()
        page.wait_for_function("document.querySelector('[data-action=save-plan]') && !document.querySelector('[data-action=save-plan]').disabled", timeout=60000)
    page.goto(url.rstrip('/') + '/#planner', wait_until='networkidle')
    page.wait_for_selector('#manure-np-mode')
    page.locator('button[data-language="en"]').click()
    check('default off', page.locator('#manure-np-mode').input_value() == 'off')
    page.select_option('#scope', 'single')
    page.select_option('#scope-object', 'F01')
    run()
    legacy = json.loads(download('[data-action="export-results"]', 'np-off-search.json'))
    check('default lacks P', 'manurePhosphorus' not in legacy['baseline'])
    template = json.loads(download('[data-action="np-template"]', 'np-blank.json'))
    check('template nulls', all(b['recoveredManureP'] is None and b['remainingApplicationCapacityP'] is None for b in template['bindings']))
    for b in template['bindings']:
        b.update(recoveredManureP=1.25, remainingApplicationCapacityP=0.5, provenance='synthetic', source='Explicit browser-test synthetic input; not observed')
    # Deliberate CRLF input: compare the actual browser bytes without Python's
    # universal-newline translation masking a source-archive regression.
    raw = json.dumps(template, ensure_ascii=False, indent=2).replace('\n', '\r\n') + '\r\n'
    source = out / 'np-synthetic.json'
    source.write_bytes(raw.encode('utf-8'))
    page.locator('#np-import-file').set_input_files(str(source))
    page.wait_for_selector('#modal[open]')
    page.locator('#modal [data-action="close-modal"]').first.click()
    check('cancel leaves no draft', page.locator('#manure-np-mode option[value="on"]').is_disabled())
    page.locator('#np-import-file').set_input_files(str(source))
    page.wait_for_selector('#modal[open]')
    page.locator('[name="np-confirm"]').check()
    page.locator('#modal-form button[type="submit"]').click()
    check('import stays off', page.locator('#manure-np-mode').input_value() == 'off')
    check('original JSON preserved', download('[data-action="np-export"]', 'np-raw-export.json') == raw)
    page.select_option('#manure-np-mode', 'on')
    run()
    enabled = json.loads(download('[data-action="export-results"]', 'np-on-search.json'))
    check('worker source archived', enabled['runInputs']['config']['manurePhosphorus']['inputArchive']['rawJSON'] == raw)
    check('ledger period', enabled['baseline']['manurePhosphorus']['period'] == template['period'])
    check('bounded scope', 'not a whole-farm P balance' in page.locator('.manure-np-result').inner_text())
    check('English complete', not page.locator('.manure-np-panel').evaluate("el=>/[\\u3400-\\u9fff]/.test(el.innerText)"))
    page.locator('[data-action="save-plan"]').click()
    page.locator('#plan-name').fill('Retained NP synthetic fixture')
    page.locator('#modal-form button[type="submit"]').click()
    saved = json.loads(page.evaluate("localStorage.getItem('farmsystem-workspace-v2')"))['plans'][0]
    page.select_option('#quarter', '1')
    check('quarter mismatch blocks enabled mode', 'quarter changed' in page.locator('.np-error').inner_text() and page.locator('#manure-np-mode').input_value() == 'on')
    page.locator('[data-action="np-disable"]').click()
    page.select_option('#quarter', '0')
    run()
    disabled = json.loads(download('[data-action="export-results"]', 'np-disabled-search.json'))
    check('explicit off reproduces baseline', disabled['baseline'] == legacy['baseline'])
    page.select_option('#manure-np-mode', 'on')
    page.select_option('#scope', 'region')
    check('scope mismatch blocks without fallback', 'boundary changed' in page.locator('.np-error').inner_text() and page.locator('#manure-np-mode').input_value() == 'on')
    page.locator('[data-action="np-disable"]').click()
    page.select_option('#scope', 'single')
    page.select_option('#scope-object', 'F01')
    for label, change in [('null', lambda c: c['bindings'][0].update(recoveredManureP=None)), ('unit', lambda c: c.update(unit='kg P2O5')), ('quarter', lambda c: c.update(period='2025-Q2'))]:
        c = json.loads(raw)
        change(c)
        f = out / f'invalid-{label}.json'
        f.write_text(json.dumps(c), encoding='utf-8')
        page.locator('#np-import-file').set_input_files(str(f))
        page.wait_for_function("document.querySelector('#toast').textContent.includes('Import failed')")
        check(label + ' rejection preserves source', download('[data-action="np-export"]', f'after-{label}.json') == raw)
    project = json.loads(download('[data-action="export-bundle"]', 'np-project.json'))
    changed = json.loads(json.dumps(project['dataset']))
    next(f for f in changed['farms'] if f['id'] == 'F01')['poultry'] += 1
    changed_file = out / 'np-changed-resources.json'
    changed_file.write_text(json.dumps(changed), encoding='utf-8')
    page.select_option('#manure-np-mode', 'on')
    page.locator('nav [data-nav="data"]').click()
    page.locator('#import-file').set_input_files(str(changed_file))
    page.wait_for_selector('#modal[open]')
    page.locator('#modal-form button[type="submit"]').click()
    page.locator('nav [data-nav="planner"]').click()
    page.select_option('#scope', 'single')
    page.select_option('#scope-object', 'F01')
    check('ordinary import keeps active P and blocks inventory change', page.locator('#manure-np-mode').input_value() == 'on' and 'inventory changed' in page.locator('.np-error').inner_text())
    page.locator('nav [data-nav="data"]').click()
    page.locator('#import-file').set_input_files(str(out / 'np-project.json'))
    page.wait_for_selector('#modal[open]')
    page.locator('#modal-form button[type="submit"]').click()
    page.locator('nav [data-nav="planner"]').click()
    check('project restores source disabled', page.locator('#manure-np-mode').input_value() == 'off' and download('[data-action="np-export"]', 'np-project-raw.json') == raw)
    check('saved snapshot unchanged', json.loads(page.evaluate("localStorage.getItem('farmsystem-workspace-v2')"))['plans'][0] == saved)
    page.locator('button[data-language="both"]').click()
    page.screenshot(path=str(out / 'np-bilingual-desktop.png'), full_page=True)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.screenshot(path=str(out / 'np-bilingual-mobile.png'), full_page=True)
    check('mobile no overflow', page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'))
    page.wait_for_function('navigator.serviceWorker.controller !== null', timeout=30000)
    context.set_offline(True)
    page.reload(wait_until='domcontentloaded')
    page.wait_for_selector('#manure-np-mode')
    check('offline reload retains source disabled', page.locator('#manure-np-mode').input_value() == 'off' and not page.locator('#manure-np-mode option[value="on"]').is_disabled())
    page.select_option('#scope', 'single')
    page.select_option('#scope-object', 'F01')
    page.select_option('#manure-np-mode', 'on')
    run()
    check('NP worker runs offline', page.locator('.manure-np-result').count() == 1)
    check('no page exceptions', not errors)
    context.close()
    return checks


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--url', required=True)
    p.add_argument('--out', required=True)
    args = p.parse_args()
    if os.environ.get('FARM_ALLOW_BROWSER') != '1':
        print(json.dumps({'status': 'NOT_RUN', 'reason': 'Browser launch requires an explicitly permitted environment; do not bypass cloud socket policy'}))
        raise SystemExit(2)
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'))
        try:
            print(json.dumps({'status': 'PASS', 'checks': len(verify_route_a_np(browser, args.url, args.out))}))
        finally:
            browser.close()
