"""Real-worker empty-frontier diagnostics; only ordinary scenario controls are changed."""
from pathlib import Path
import json
import math


def verify_infeasible(browser, url, out, check):
    out = Path(out)
    context = browser.new_context(viewport={'width': 1440, 'height': 1050},
                                  accept_downloads=True, service_workers='block')
    context.route('**/tile.openstreetmap.org/**', lambda route: route.abort())
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    report = {'checks': [], 'scenarios': [], 'errors': errors}

    def verify(name, value=True):
        check('infeasible: ' + name, value)
        report['checks'].append(name)
        (out / 'infeasible-browser-report.json').write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')

    def run_empty():
        page.locator('[data-action="run"]').first.click()
        page.wait_for_selector('.infeasible-details', timeout=60000)
        page.wait_for_function("!document.querySelector('[data-action=run]').disabled")
        page.locator('.infeasible-details summary').click()

    def download_run(name):
        with page.expect_download() as event:
            page.locator('[data-action="export-results"]').click()
        destination = out / name
        event.value.save_as(str(destination))
        return json.loads(destination.read_text(encoding='utf-8'))

    page.goto(url.rstrip('/') + '/#planner', wait_until='networkidle')
    page.wait_for_function("document.querySelector('#rainfall-input option[value=spatial]') && !document.querySelector('#rainfall-input option[value=spatial]').disabled")
    verify('NASA remains the default input', page.locator('#rainfall-input').input_value() == 'legacy')
    # Keep a real selected snapshot so the diagnostic workflow must leave it untouched.
    page.select_option('#scope', 'single')
    page.select_option('#scope-object', 'F01')
    page.locator('[data-action="run"]').first.click()
    page.wait_for_selector('[data-action="save-plan"]', timeout=60000)
    page.locator('[data-action="save-plan"]').click()
    page.locator('#plan-name').fill('Preserved before constraint diagnostics')
    page.locator('#modal-form button[type="submit"]').click()
    saved = page.evaluate("JSON.parse(localStorage.getItem('farmsystem-workspace-v2')).plans")
    page.select_option('#scope', 'region')
    for control in ['water', 'labour']:
        page.locator('#' + control).press('Home')
        page.locator('#' + control).press('Tab')
        verify(control + ' range is zero through native keyboard input',
               page.locator('#' + control).input_value() == '0')
    run_empty()
    original = download_run('infeasible-independent-full-search.json')
    candidate = original['bestInfeasible']
    verify('real full-scope search is sampled and has no feasible candidates',
           original['exact'] is False and original['feasibleCount'] == 0 and not original['candidates'])
    verify('all 78 reasons remain inspectable including the former hidden tail',
           page.locator('.infeasible-violations li').all_text_contents() == candidate['violations']
           and len(candidate['violations']) == 78)
    rows = page.locator('.infeasible-balances tbody tr').all()
    balances = [b for b in candidate['balances'] if b['demand'] > b['capacity'] + 1e-6]
    verify('all 78 monthly resource failures retain the exact boundary, month and unit',
           len(rows) == len(balances) == 78)
    for row, balance in zip(rows, balances):
        cells = row.locator('td').all_text_contents()
        expected_unit = '水 / m³' if balance['resource'] == '水' else '劳动 / 工日'
        assert cells[:3] == [balance['group'], str(balance['month']), expected_unit], cells
        for actual, expected in zip(cells[3:], [balance['demand'], balance['capacity'], balance['demand'] - balance['capacity']]):
            assert math.isclose(float(actual.replace(',', '')), expected, rel_tol=1e-7, abs_tol=1e-10), (actual, expected)
    verify('displayed demand, capacity and shortfall agree with the downloaded unmodified record')
    text = page.locator('.infeasible-details').inner_text()
    verify('candidate explanation is not a global infeasibility or minimum-shortfall claim',
           all(value in text for value in ['只解释该候选', '不等于资源缺口最小', '不是整个问题无解的证明', '合成、未校准', '未选主体']))
    page.locator('.infeasible-details summary').press('Enter')
    verify('constraint disclosure can be collapsed with the keyboard',
           page.locator('.infeasible-details details').get_attribute('open') is None)
    page.locator('.infeasible-details summary').press('Space')
    verify('constraint disclosure can be expanded with the keyboard',
           page.locator('.infeasible-details details').get_attribute('open') is not None)
    page.locator('.infeasible-details summary').press('Enter')
    page.screenshot(path=str(out / 'planner-infeasible-desktop.png'), full_page=True)

    for language in ['en', 'both', 'zh']:
        page.locator(f'button[data-language="{language}"]').click()
        page.locator('.infeasible-details summary').click()
        text = page.locator('.infeasible-details').inner_text()
        verify(language + ' retains all reasons and balances',
               page.locator('.infeasible-violations li').count() == 78 and
               page.locator('.infeasible-balances tbody tr').count() == 78)
        if language == 'en':
            verify('English explanations are readable and fully translated',
                   'month 1: water capacity exceeded' in text and
                   'synthetic, uncalibrated' in text and
                   not page.locator('.infeasible-details').evaluate("el=>/[\\u3400-\\u9fff]/.test(el.innerText)"))
        page.set_viewport_size({'width': 390, 'height': 844})
        verify(language + ' expanded diagnostics keep the mobile document within the viewport',
               page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'))
        page.locator('.infeasible-balances tbody tr').first.locator('td').last.scroll_into_view_if_needed()
        verify(language + ' mobile shortfall column is reachable within its scroll container',
               page.locator('.infeasible-balances').evaluate("table=>{const cell=table.querySelector('tbody tr td:last-child').getBoundingClientRect(),box=table.parentElement.getBoundingClientRect();return cell.left>=box.left-1&&cell.right<=box.right+1}"))
        if language == 'both':
            page.locator('.infeasible-details').scroll_into_view_if_needed()
            page.screenshot(path=str(out / 'planner-infeasible-mobile-bilingual.png'))
        page.set_viewport_size({'width': 1440, 'height': 1050})
    after_languages = download_run('infeasible-after-language-switch.json')
    verify('language and disclosure controls do not alter the captured run', after_languages == original)

    page.select_option('#quarter', '3')
    for mode, expected_balances in [('cooperative', 18), ('centralized', 6)]:
        page.select_option('#decision-mode', mode)
        run_empty()
        record = download_run('infeasible-' + mode + '-q4.json')
        balances = record['bestInfeasible']['balances']
        over_capacity = [b for b in balances if b['demand'] > b['capacity'] + 1e-6]
        verify(mode + ' Q4 uses the actual organizational boundary and October–December',
               len(balances) == expected_balances and
               page.locator('.infeasible-balances tbody tr').count() == len(over_capacity) and
               {b['month'] for b in balances} == {10, 11, 12})
        verify(mode + ' visible boundary IDs match the result instead of current defaults',
               page.locator('.infeasible-balances tbody tr td:first-child').all_text_contents() == [b['group'] for b in over_capacity])
        verify(mode + ' visible months match the captured Q4 balances',
               page.locator('.infeasible-balances tbody tr td:nth-child(2)').all_text_contents() == [str(b['month']) for b in over_capacity])
        report['scenarios'].append({'mode': mode, 'quarter': 3, 'reasons': len(record['bestInfeasible']['violations'])})
    page.select_option('#scope', 'single')
    page.select_option('#scope-object', 'F01')
    page.select_option('#decision-mode', 'independent')
    run_empty()
    exact = download_run('infeasible-exact-f01.json')
    verify('exact discrete enumeration remains distinct from a sampled search',
           exact['exact'] is True and exact['evaluated'] == 256 and
           '当前离散候选集没有可行方案' in page.locator('main').inner_text() and
           page.locator('.infeasible-balances tbody tr').count() == len([b for b in exact['bestInfeasible']['balances'] if b['demand'] > b['capacity'] + 1e-6]))
    verify('saved plan bytes remain unchanged through all diagnostics',
           page.evaluate("JSON.parse(localStorage.getItem('farmsystem-workspace-v2')).plans") == saved)
    verify('no JavaScript exceptions in the diagnostic workflow', not errors)
    context.close()
