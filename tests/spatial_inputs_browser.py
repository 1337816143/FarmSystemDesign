"""Optional source comparison, recording, language, mobile and failed-admission UI flows."""
from pathlib import Path
import json

def verify_spatial_inputs(browser,url,out,check):
    out=Path(out);context=browser.new_context(viewport={'width':1440,'height':1050},accept_downloads=True,service_workers='block')
    context.route('**/tile.openstreetmap.org/**',lambda route:route.abort())
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(url.rstrip('/')+'/#planner',wait_until='networkidle')
    page.wait_for_function("document.querySelector('#rainfall-input option[value=spatial]') && !document.querySelector('#rainfall-input option[value=spatial]').disabled")
    check('spatial: legacy NASA source is still default',page.locator('#rainfall-input').input_value()=='legacy')
    check('spatial: 110 bindings truthfully display one climate cell','110 个地块 / 1 个独立降雨网格' in page.locator('.spatial-support').inner_text())
    check('spatial: same-input water comparison actually differs','7,416.54' in page.locator('.spatial-water-delta').inner_text())
    page.select_option('#scope','single');page.select_option('#scope-object','F01');page.select_option('#rainfall-input','spatial');page.select_option('#quarter','1')
    check('spatial: selected-quarter comparison uses April to June','2025-04' in page.locator('.spatial-input-panel').inner_text() and '2025-06' in page.locator('.spatial-input-panel').inner_text())
    page.locator('[data-action="run"]').first.click();page.wait_for_selector('[data-action="save-plan"]',timeout=60000)
    with page.expect_download() as event:page.locator('[data-action="export-results"]').click()
    event.value.save_as(str(out/'spatial-full-search.json'));record=json.loads((out/'spatial-full-search.json').read_text())
    check('spatial: download captures complete public input contract',record['runInputs']['config']['spatialRainfall']['schema']=='FarmSystemDesign.SpatialInputContract')
    check('spatial: accounting retains plot rainfall and source summary',record['baseline']['spatialRainfall']['uniqueGridCells']==1 and len(record['baseline']['plots'][0]['rainMonths'])==3)
    check('spatial: full frontier is preserved',len(record['candidates'])==record['frontierCount'])
    page.locator('[data-action="save-plan"]').click();page.wait_for_selector('#modal-form');page.locator('#plan-name').fill('CHIRPS source sensitivity');page.locator('#modal-form button[type="submit"]').click()
    stored=json.loads(page.evaluate("localStorage.getItem('farmsystem-workspace-v2')"));check('spatial: saved plan retains exact optional input contract',stored['plans'][0]['config']['spatialRainfall']==record['runInputs']['config']['spatialRainfall'])
    page.select_option('#rainfall-input','legacy');check('spatial: manual return to original source marks previous results stale',page.locator('[data-action="save-plan"]').is_disabled())
    check('spatial: saved snapshot was not rewritten after source switch',json.loads(page.evaluate("localStorage.getItem('farmsystem-workspace-v2')"))['plans'][0]==stored['plans'][0])
    page.locator('button[data-language="en"]').click();check('spatial: English panel has no untranslated Chinese',not page.locator('.spatial-input-panel').evaluate("el=>/[\\u3400-\\u9fff]/.test(el.innerText)"))
    page.screenshot(path=str(out/'spatial-input-desktop.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844});page.locator('button[data-language="both"]').click();page.screenshot(path=str(out/'spatial-input-mobile.png'),full_page=True)
    check('spatial: bilingual mobile stays within viewport',page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'))
    page.locator('button[data-language="zh"]').click();page.set_viewport_size({'width':1440,'height':1050})
    page.select_option('#rainfall-input','spatial')
    # Authorized local fixture import through the same controls as users, not a hidden state mutation.
    changed=json.loads(json.dumps(record['runInputs']['dataset']));changed['version']='test-spatial-stale-geometry'
    # Mutate a plot in the actor actually selected below. P001 belongs to F13, not F01.
    altered_plot=next(plot for plot in changed['plots'] if plot['farmId']=='F01')
    assert altered_plot['id'] in [plot['id'] for plot in record['baseline']['plots']]
    for ring in altered_plot['geometry']['coordinates']:
        for point in ring:point[0]+=.001
    altered_plot['representativePoint'][0]+=.001
    altered=out/'spatial-stale-geometry.json';altered.write_text(json.dumps(changed),encoding='utf-8')
    page.locator('nav [data-nav="data"]').click();page.locator('#import-file').set_input_files(str(altered));page.wait_for_selector('#modal[open]');page.locator('#modal-form button[type="submit"]').click()
    page.locator('nav [data-nav="planner"]').click();page.select_option('#scope','single');page.select_option('#scope-object','F01')
    check('spatial: altered geometry blocks active CHIRPS admission','binding mismatch' in page.locator('.spatial-input-panel').inner_text() and page.locator('#rainfall-input').input_value()=='spatial')
    page.locator('[data-action="run"]').first.click();check('spatial: blocked mode does not silently fall back','binding mismatch' in page.locator('#toast').inner_text() and page.locator('[data-action="save-plan"]').count()==0)
    page.select_option('#rainfall-input','legacy');page.locator('[data-action="run"]').first.click();page.wait_for_selector('[data-action="save-plan"]',timeout=60000)
    check('spatial: manual NASA switch recovers after stale binding',page.locator('[data-action="save-plan"]').is_enabled())
    check('spatial: stale-geometry import leaves prior selected snapshot intact',json.loads(page.evaluate("localStorage.getItem('farmsystem-workspace-v2')"))['plans'][0]==stored['plans'][0])
    check('spatial: no browser exceptions',not errors);context.close()
    # A failed source must disable the opt-in and preserve the original calculation entry.
    broken=browser.new_context(service_workers='block');broken.route('**/data/derived/spatial-inputs-2025.json',lambda route:route.fulfill(status=503,body='unavailable'))
    page=broken.new_page();page.goto(url.rstrip('/')+'/#planner',wait_until='networkidle');page.wait_for_selector('#rainfall-input')
    check('spatial: unavailable contract disables only optional input',page.locator('#rainfall-input option[value="spatial"]').is_disabled() and page.locator('#rainfall-input').input_value()=='legacy')
    page.select_option('#scope','single');page.select_option('#scope-object','F01');page.locator('[data-action="run"]').first.click();page.wait_for_selector('[data-action="save-plan"]',timeout=60000)
    check('spatial: legacy search remains usable when contract fetch fails',page.locator('[data-action="save-plan"]').is_enabled());broken.close()
