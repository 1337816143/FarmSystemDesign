"""Actual browser UI exercise for the built, already-offline route-B page.

Called from the existing full-site offline suite after its server is stopped.
No substitute engine or DOM stub is used. Exports are browser downloads saved
to disk before parsing. This is software verification, not empirical validation.
"""
from pathlib import Path
import copy
import hashlib
import json


def exercise_route_b(page, out, check):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    report = {'checks': [], 'downloads': []}

    def verify(label, value=True):
        check('route-b: ' + label, value)
        report['checks'].append(label)

    def export_record(label):
        with page.expect_download() as event:
            page.locator('#export-run').click()
        item = event.value
        path = out / (label + '.json')
        item.save_as(path)
        assert item.failure() is None, item.failure()
        body = path.read_bytes()
        record = json.loads(body)
        report['downloads'].append({'label': label, 'bytes': len(body),
                                    'sha256': hashlib.sha256(body).hexdigest(),
                                    'suggestedFilename': item.suggested_filename})
        return record

    def export_snapshot(label, expected_input):
        with page.expect_download() as event:
            page.locator('#export-snapshot').click()
        item = event.value
        path = out / (label + '.json')
        item.save_as(path)
        assert item.failure() is None, item.failure()
        body = path.read_bytes()
        record = json.loads(body)
        assert record['schema'] == 'FarmSystemDesign.HainanInputSnapshot'
        assert record['input'] == expected_input and 'result' not in record
        assert record['runConfig'] == {'annual': False, 'maxCombinations': 2000, 'mode': 'period-specific'}
        unsigned = {key: value for key, value in record.items() if key != 'integrity'}
        # Fixture keys are ASCII; sorted Python JSON independently reproduces the
        # product's declared UTF-16-key canonicalization for this exact input.
        digest = hashlib.sha256(json.dumps(unsigned, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        assert record['integrity']['digest'] == digest
        assert len(body) <= 5 * 1024 * 1024
        report['downloads'].append({'label': label, 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest(), 'suggestedFilename': item.suggested_filename})
        return record

    def fill_input(value):
        # The page intentionally requires an explicit apply step.
        page.locator('#json-input').evaluate("e=>e.closest('details').open=true")
        page.locator('#json-input').fill(json.dumps(value, ensure_ascii=False))
        page.locator('#apply-json').click()

    def import_record(value):
        page.locator('#import-run').set_input_files({
            'name': 'route-b-test.json', 'mimeType': 'application/json',
            'buffer': json.dumps(value, ensure_ascii=False).encode()})
        page.wait_for_function("document.querySelector('#status').textContent.includes('独立重算')")

    def import_downloaded_file(label):
        path = out / (label + '.json')
        before = path.read_bytes()
        page.locator('#import-run').set_input_files(str(path.resolve()))
        page.wait_for_function("document.querySelector('#status').textContent.includes('独立重算')")
        verify('native file input uses the unchanged downloaded disk file: ' + label,
               path.read_bytes() == before)

    try:
        page.wait_for_function("document.querySelector('#status').textContent.includes('已完整核算 9')")
        verify('built page labels synthetic data, absent calibration and blocked provincial inference',
               '未经实测校准' in page.locator('main').inner_text() and
               '海南总体推断关口：关闭' in page.locator('#results').inner_text())
        verify('return link keeps route A separately accessible',
               page.locator('#existing-a').is_visible() and
               page.locator('#existing-a').get_attribute('href') == '../index.html')
        default = export_record('default-period')
        verify('actual default UI exports all 9 combinations and 5 feasible/frontier results',
               default['result']['search']['total'] == 9 and
               default['result']['search']['evaluated'] == 9 and
               default['result']['search']['feasible'] == 5 and
               default['result']['search']['frontier'] == 5)
        verify('annual averaging explicitly exposes 8 versus 5 and 3 hidden constraint failures',
               '年度总量通过 8 个；逐期通过 5 个' in page.locator('#results').inner_text() and
               '其中 3 个组合' in page.locator('#results').inner_text())
        shared = next(r for r in default['result']['results']
                      if any(i['key'].startswith('shared-water:') and i.get('excess') == 15
                             for i in r['issues']))
        page.select_option('#select-result', shared['id'])
        verify('shared-source 15 cubic metre excess appears in the actual selected explanation',
               '超出 15 m³' in page.locator('#selection-detail').inner_text())
        page.locator('#save-run').click()
        page.select_option('#mode', 'annual')
        verify('mode changes make exports stale until recomputation', page.locator('#export-run').is_disabled())
        page.locator('#run').click()
        annual = export_record('annual-diagnostic')
        verify('annual diagnostic runs the same input and exposes 8 feasible combinations',
               annual['input'] == default['input'] and annual['result']['search']['feasible'] == 8)
        page.locator('#save-run').click()
        verify('two different run versions are preserved in the current B session', page.locator('#versions .version').count() == 2)
        page.locator('[data-restore="0"]').click()
        restored = export_record('restored-period')
        verify('restoring the period version recalculates the same complete result', restored['result'] == default['result'])
        page.select_option('[data-input="strata.1.waterSourceId"]', 'independent')
        page.locator('#run').click()
        independent = export_record('independent-source')
        changed = next(r for r in independent['result']['results'] if r['id'] == shared['id'])
        verify('changing access to a second source changes feasibility without fabricating additive outputs',
               changed['feasible'] and changed['totals'] == shared['totals'])
        page.locator('#reset').click()
        page.locator('[data-input="waterSources.0.capacity.0"]').fill('0')
        page.locator('#run').click()
        zero = export_record('zero-capacity')
        verify('real zero capacity produces zero feasible results with retained reasons',
               zero['result']['search']['feasible'] == 0 and
               all(r['issues'] for r in zero['result']['results']))
        page.locator('#reset').click()
        before_np = export_record('before-np')
        page.locator('#run-np').click()
        verify('N/P interface retains composition and leaves half at the source',
               '允许接收 50%' in page.locator('#np-result').inner_text() and
               'N 20 / P 10 kg' in page.locator('#np-result').inner_text())
        after_np = export_record('after-np')
        verify('N/P interface does not add a second benefit to menu input or result',
               after_np['input'] == before_np['input'] and after_np['result'] == before_np['result'])
        forged = copy.deepcopy(default)
        forged['result']['search']['feasible'] = 999
        import_record(forged)
        checked = export_record('recomputed-import')
        verify('import independently recomputes instead of accepting forged saved results', checked['result'] == default['result'])
        invalid = copy.deepcopy(default['input'])
        invalid['strata'][0]['laborCapacity'][0] = None
        fill_input(invalid)
        verify('missing resource value is refused without changing the accepted input',
               '合同已通过' not in page.locator('#json-status').inner_text() and
               export_record('after-refused-json')['input'] == default['input'])
        malicious = copy.deepcopy(default['input'])
        malicious['strata'][0]['label'] = '<img src=x onerror="window.__routeBInjected=true">'
        fill_input(malicious)
        verify('untrusted names render as text without executing or loading an injected image',
               page.locator('#controls img').count() == 0 and not page.evaluate('Boolean(window.__routeBInjected)'))
        page.locator('#reset').click()
        snapshot = export_snapshot('cold-offline-default-snapshot', default['input'])
        page.select_option('#mode', 'annual')
        page.locator('#run').click()
        import_downloaded_file('cold-offline-default-snapshot')
        verify('cold offline snapshot restores the actual mode and recomputes without adopting stored audit output',
               page.locator('#mode').input_value() == 'period' and
               '原完整审计结果未载入' in page.locator('#status').inner_text() and
               export_record('cold-offline-restored-default')['result'] == default['result'])
        pressure = json.loads((Path(__file__).resolve().parents[1] / 'route-b/tests/fixtures/large-record-counterexample-input.json').read_text())
        fill_input(pressure)
        before_pressure = export_record('cold-offline-pressure-full-before')
        verify('legitimate large audit remains complete and is explicitly separate from recoverable inputs',
               before_pressure['result']['search']['total'] == 729 and
               sum(len(row['issues']) for row in before_pressure['result']['results']) == 104976 and
               report['downloads'][-1]['bytes'] > 5 * 1024 * 1024)
        compact = export_snapshot('cold-offline-pressure-input-snapshot', pressure)
        verify('the large legitimate run produces a small exact-input snapshot on disk while fully disconnected',
               report['downloads'][-1]['bytes'] == 14485 and compact['summary']['total'] == 729)
        page.reload(wait_until='networkidle')
        page.wait_for_function("document.querySelector('#status').textContent.includes('已完整核算 9')")
        import_downloaded_file('cold-offline-pressure-input-snapshot')
        after_pressure = export_record('cold-offline-pressure-full-after')
        verify('native snapshot import after a fresh offline document reproduces all 729 complete outputs exactly',
               after_pressure['input'] == pressure and after_pressure['result'] == before_pressure['result'])
        del before_pressure, after_pressure
        page.locator('#reset').click()
        page.locator('#save-run').click()
        verify('a real new B session version exists before the final independent reload', page.locator('#versions .version').count() == 1)
        page.set_viewport_size({'width': 1440, 'height': 1000})
        page.screenshot(path=str(out / 'route-b-desktop.png'), full_page=True)
        page.set_viewport_size({'width': 390, 'height': 844})
        verify('narrow-screen document has no horizontal overflow',
               page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
        page.screenshot(path=str(out / 'route-b-mobile.png'), full_page=True)
        page.set_viewport_size({'width': 1440, 'height': 1000})
        page.reload(wait_until='networkidle')
        page.wait_for_function("document.querySelector('#status').textContent.includes('已完整核算 9')")
        verify('independent offline reload recomputes the default and truthfully clears unsaved session versions',
               page.locator('#versions .version').count() == 0 and
               export_record('offline-reloaded')['result'] == default['result'])
        # New dated UI must work after an actual cold document reopen while the
        # parent complete-offline test has already stopped its HTTP server.
        # Preserve all preceding legacy, disk and full-pressure assertions.
        page.reload(wait_until='networkidle')
        page.wait_for_function("document.querySelector('#status').textContent.includes('已完整核算 9')")
        page.locator('#dated-panel > summary').click()
        dated_stratum = default['input']['strata'][0]
        dated_menu = dated_stratum['menus'][1]
        page.select_option('#dated-stratum', dated_stratum['id'])
        page.select_option('#dated-menu', dated_menu['id'])
        page.locator('#dated-example').click()
        original_date_source = json.loads(page.locator('#dated-json').input_value())
        verify('cold offline dated example is explicit synthetic source for the selected menu',
               original_date_source['evidence'] == 'synthetic' and
               original_date_source['stratumId'] == dated_stratum['id'] and
               original_date_source['menuId'] == dated_menu['id'])
        page.locator('#dated-preview').click()
        page.wait_for_function("!document.querySelector('#dated-apply').disabled")
        page.locator('#dated-apply').click()
        before_confirmation = export_record('cold-offline-dated-before-confirmation')
        verify('cold offline date preview cannot adopt without explicit confirmation',
               before_confirmation['input'] == default['input'] and
               not before_confirmation.get('datedRecords'))
        page.locator('#dated-confirm').check()
        page.locator('#dated-apply').click()
        dated_base = export_record('cold-offline-dated-baseline')
        verify('cold offline date adoption retains original source and nine/five baseline',
               dated_base['schemaVersion'] == 2 and dated_base['input'] == default['input'] and
               dated_base['result']['search']['total'] == 9 and
               dated_base['result']['search']['feasible'] == 5 and
               len(dated_base['datedRecords']) == 1 and
               dated_base['datedRecords'][0]['source'] == original_date_source)
        shifted_source = copy.deepcopy(original_date_source)
        labor_events = [event for event in shifted_source['events'] if event['metric'] == 'laborHours']
        verify('cold offline date shift conserves the existing 140 labor hours',
               len(labor_events) == 2 and sum(event['value'] for event in labor_events) == 140)
        labor_events[0]['value'], labor_events[1]['value'] = 140, 0
        page.locator('#dated-json').fill(json.dumps(shifted_source, ensure_ascii=False))
        page.locator('#dated-preview').click()
        page.wait_for_function("!document.querySelector('#dated-apply').disabled")
        page.locator('#dated-confirm').check()
        page.locator('#dated-apply').click()
        dated_period = export_record('cold-offline-dated-peak-period')
        expected_input = copy.deepcopy(default['input'])
        expected_input['strata'][0]['menus'][1]['laborHours'] = [140, 0]
        verify('cold offline 140-hour peak changes only the selected labor vector and yields three feasible combinations',
               dated_period['input'] == expected_input and
               dated_period['result']['search']['total'] == 9 and
               dated_period['result']['search']['feasible'] == 3 and
               dated_period['datedRecords'][0]['source'] == shifted_source)
        page.select_option('#mode', 'annual')
        page.locator('#run').click()
        dated_annual = export_record('cold-offline-dated-peak-annual')
        verify('cold offline same-total annual diagnostic still has eight feasible combinations',
               dated_annual['input'] == expected_input and
               dated_annual['result']['search']['feasible'] == 8 and
               dated_annual['datedRecords'] == dated_period['datedRecords'])
        page.select_option('#mode', 'period')
        page.locator('#run').click()
        dated_snapshot = export_snapshot('cold-offline-dated-schema2-snapshot', expected_input)
        verify('native offline dated input snapshot is schema2 and keeps the exact source, audit and parent binding',
               dated_snapshot['schemaVersion'] == 2 and
               dated_snapshot['datedRecords'] == dated_period['datedRecords'] and
               dated_snapshot['summary']['feasible'] == 3)
        page.reload(wait_until='networkidle')
        page.wait_for_function("document.querySelector('#status').textContent.includes('已完整核算 9')")
        import_downloaded_file('cold-offline-dated-schema2-snapshot')
        dated_restored = export_record('cold-offline-dated-restored')
        verify('a fresh cold offline document imports the actual schema2 disk snapshot and recomputes identical inputs, sources and full results',
               dated_restored['schemaVersion'] == 2 and
               dated_restored['input'] == expected_input and
               dated_restored['datedRecords'] == dated_period['datedRecords'] and
               dated_restored['result'] == dated_period['result'] and
               page.locator('#mode').input_value() == 'period')
        page.screenshot(path=str(out / 'route-b-dated-cold-offline.png'), full_page=True)
        report['status'] = 'PASS'
    except Exception as error:
        report.update(status='FAIL', error=str(error))
        page.screenshot(path=str(out / 'route-b-failure.png'), full_page=True)
        raise
    finally:
        (out / 'route-b-browser-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
