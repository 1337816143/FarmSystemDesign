"""Full-frontier UI regression, isolated from edits in the general browser workflow."""
from pathlib import Path
import gc,hashlib,json,time


def verify_pareto(browser,url,out,check):
    context=browser.new_context(viewport={'width':1440,'height':1050},accept_downloads=True)
    context.route('**/tile.openstreetmap.org/**',lambda route:route.abort())
    page=context.new_page();errors=[];stage='initialization'
    metrics={'errors':errors,'checks':[]}
    def write_metrics():
        (out/'pareto-browser-metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf-8')
    record_check=check
    def check(name,value=True):
        metrics['lastCheck']={'name':name,'passed':bool(value),'stage':stage,'url':page.url}
        try:
            record_check(name,value)
            metrics['checks'].append(name)
        finally:
            write_metrics()
    def page_error(error):
        detail={'message':str(error),'stack':getattr(error,'stack',''),'stage':stage,'url':page.url}
        errors.append(detail)
        print('PARETO_BROWSER_ERROR '+json.dumps(detail,ensure_ascii=False),flush=True)
        write_metrics()
    page.on('pageerror',page_error)
    page.goto(url.rstrip('/')+'/#data',wait_until='networkidle')
    page.wait_for_selector('[data-action="export-weather"]:not([disabled])')
    release=page.request.get(url.rstrip('/')+'/version.json').json()
    page.locator('.top-version').click()
    check('release dialog header matches current name and date',release['name'] in page.locator('.release-header').inner_text() and release['releasedOn'] in page.locator('.release-header').inner_text())
    page.locator('[data-action="close-modal"]').first.click()
    page.locator('nav [data-nav="planner"]').click()
    page.wait_for_selector('[data-action="run"]')
    stage='search worker and in-flight preference'
    started=time.monotonic()
    page.locator('[data-action="run"]').first.click()
    check('preference changes while the real worker is running',page.locator('[data-action="cancel-run"]').is_visible() and page.locator('[data-action="run"]').first.is_disabled())
    # A preference changed while the worker is running must apply to its eventual result.
    page.select_option('#objective','water')
    page.wait_for_selector('[data-action="save-plan"]',timeout=90000)
    search_ms=round((time.monotonic()-started)*1000)
    check('full frontier initial render is limited to 36 rows and points',page.locator('tr[data-candidate]').count()==36 and page.locator('.pareto-chart [data-candidate]').count()==36)
    check('first frontier page disables previous navigation',page.locator('[data-action="previous-candidates"]').is_disabled())

    def download_json(action,name):
        started=time.monotonic()
        with page.expect_download(timeout=90000) as event:page.locator(f'[data-action="{action}"]').first.click()
        path=out/name;event.value.save_as(str(path))
        size=path.stat().st_size
        with path.open(encoding='utf-8') as stream:result=json.load(stream)
        path.unlink()  # Keep only small verified digests in the CI evidence artifact.
        return result,size,round((time.monotonic()-started)*1000)

    def accounting_digest(result):
        digest=hashlib.sha256()
        for candidate in sorted(result['candidates'],key=lambda c:c['id']):
            digest.update(json.dumps({k:v for k,v in candidate.items() if k!='score'},sort_keys=True,separators=(',',':'),ensure_ascii=False).encode())
        return digest.hexdigest()

    stage='complete initial export'
    first,export_bytes,export_ms=download_json('export-results','pareto-full-temporary.json')
    check('default worker exports all 1414 frontier candidates',first['evaluated']==3897 and first['feasibleCount']==2008 and first['frontierCount']==1414 and len(first['candidates'])==1414)
    check('worker arrival uses latest preference without forging run configuration',first['ranking']['objective']=='water' and first['config']['objective']=='balanced')
    ids=[c['id'] for c in first['candidates']];original_hash=first['inputHash'];original_config=first['config'];digest=accounting_digest(first)
    pages=(len(ids)+35)//36;target=first['candidates'][(pages-1)*36]
    del first;gc.collect()
    stage='same-page lower-bound normalization'
    page.locator('tr[data-candidate]').nth(1).locator('button').click()
    page.locator('#candidate-page').fill('0');page.locator('#candidate-page').dispatch_event('change')
    check('below-range page normalizes without resetting same-page selection',page.locator('#candidate-page').input_value()=='1' and page.locator('tr.selected-row').get_attribute('data-candidate')==ids[1])
    stage='later-page navigation and selection'
    page.locator('[data-action="next-candidates"]').click()
    check('next page exposes candidates beyond the first 36',page.locator('tr[data-candidate]').first.get_attribute('data-candidate')==ids[36])
    stage='native page-number Enter and blur'
    page.locator('#candidate-page').fill('3');page.locator('#candidate-page').press('Enter');page.keyboard.press('Tab')
    check('Enter followed by blur commits the requested page without a reentrant render',page.locator('#candidate-page').input_value()=='3' and page.locator('tr[data-candidate]').first.get_attribute('data-candidate')==ids[72])
    page.locator('#candidate-page').fill('4');page.locator('#candidate-page').press('Tab')
    check('blur commits the requested page without a reentrant render',page.locator('#candidate-page').input_value()=='4' and page.locator('tr[data-candidate]').first.get_attribute('data-candidate')==ids[108])
    page.locator('tr[data-candidate]').nth(1).locator('button').click()
    for _ in range(2):
        page.locator('#candidate-page').fill('4');page.locator('#candidate-page').dispatch_event('change')
        page.locator('#candidate-page').press('Enter');page.locator('#candidate-page').press('Tab')
    check('repeated same-page changes preserve the selected candidate',page.locator('tr.selected-row').get_attribute('data-candidate')==ids[109])
    page.locator('#candidate-page').fill('4.8');page.locator('#candidate-page').dispatch_event('change')
    check('fractional same-page input normalizes without resetting selection',page.locator('#candidate-page').input_value()=='4' and page.locator('tr.selected-row').get_attribute('data-candidate')==ids[109])
    stage='focused input adversarial change dispatch'
    page.locator('#candidate-page').fill(str(pages));page.locator('#candidate-page').dispatch_event('change')
    check('direct last-page access preserves all remaining candidates',page.locator('tr[data-candidate]').count()==len(ids)%36 and page.locator('[data-action="next-candidates"]').is_disabled())
    page.locator(f'tr[data-candidate="{target["id"]}"] button').click()
    check('late-page selection updates both table and chart',page.locator('tr.selected-row').get_attribute('data-candidate')==target['id'] and page.locator(f'.pareto-chart [data-candidate="{target["id"]}"]').get_attribute('r')=='7')
    page.locator('#candidate-page').fill('999');page.locator('#candidate-page').dispatch_event('change')
    check('above-range last-page input normalizes without another render',page.locator('#candidate-page').input_value()==str(pages) and page.locator('tr.selected-row').get_attribute('data-candidate')==target['id'])
    page.screenshot(path=str(out/'pareto-last-page.png'),full_page=True)
    stage='preference switching and reranked export'
    ranking_ms=[]
    for preference in ['income','environment','food','water','balanced']:
        started=time.monotonic();page.select_option('#objective',preference);ranking_ms.append(round((time.monotonic()-started)*1000))
        check(f'{preference} keeps late selection reachable and current',page.locator('tr.selected-row').get_attribute('data-candidate')==target['id'] and page.locator('[data-action="save-plan"]').is_enabled() and page.locator('tr[data-candidate]').count()<=36)
    second,second_bytes,second_ms=download_json('export-results','pareto-reranked-temporary.json')
    check('all preference switches preserve every candidate and complete accounting',set(c['id'] for c in second['candidates'])==set(ids) and accounting_digest(second)==digest)
    check('reranked export retains original run provenance and separate preference',second['inputHash']==original_hash and second['config']==original_config and second['ranking']['objective']=='balanced')
    del second;gc.collect()
    stage='save selected snapshot'
    page.select_option('#objective','food')
    page.locator('[data-action="save-plan"]').click();page.locator('[name="name"]').fill('Late frontier regression');page.locator('#modal-form button[type="submit"]').click()
    stored=json.loads(page.evaluate("localStorage.getItem('farmsystem-workspace-v2')"));plan=stored['plans'][0]
    check('late-page snapshot persists the selected full candidate only',plan['candidate']['id']==target['id'] and plan['candidate']['allocation']==target['allocation'] and plan['candidate']['totals']==target['totals'] and 'results' not in stored and 'candidates' not in stored and 'candidates' not in plan and 'results' not in plan)
    check('one saved snapshot stays below browser storage budget',len(page.evaluate("localStorage.getItem('farmsystem-workspace-v2')").encode('utf-8'))<1024*1024)
    check('saved ranking is separate from original run config and hash',plan['ranking']['objective']=='food' and plan['config']['objective']=='balanced' and plan['config']==original_config and plan['inputHash']==original_hash)
    baseline=[p['crop'] for p in stored['dataset']['plots']]
    stage='candidate map preview'
    page.locator('[data-action="preview-candidate"]').click();page.wait_for_selector('.parcel')
    stage='preview map theme change'
    page.select_option('#map-theme','activity')
    colors=page.evaluate("async()=>Object.fromEntries(Object.entries((await import('./src/data.js')).CROPS).map(([key,crop])=>[key,crop.color]))")
    displayed=page.locator('.parcel').evaluate_all("nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.plotId,n.getAttribute('fill')]))")
    highlighted=stored['dataset']['plots'][0]['id']
    check('late-page map preview colors match the selected allocation',all(displayed[plot_id]==('#eac16f' if plot_id==highlighted else colors[crop]) for plot_id,crop in target['allocation'].items()))
    check('late-page preview leaves baseline crops unchanged',page.evaluate("JSON.parse(localStorage.getItem('farmsystem-workspace-v2')).dataset.plots.map(p=>p.crop)")==baseline)
    stage='leave preview map for saved plan export'
    page.locator('nav [data-nav="feedback"]').click()
    snapshot,_,_=download_json('export-plan','pareto-plan-temporary.json')
    check('saved late-page plan export retains its full detail',snapshot['candidate']==plan['candidate'])
    stage='project bundle export'
    page.locator('nav [data-nav="data"]').click()
    bundle,_,_=download_json('export-bundle','pareto-bundle-temporary.json')
    check('project export contains saved snapshot without entire search',len(bundle['plans'])==1 and bundle['plans'][0]['candidate']['id']==target['id'] and 'results' not in bundle and 'candidates' not in bundle)
    page.locator('nav [data-nav="planner"]').click()
    stage='English and bilingual mobile rendering'
    page.locator('button[data-language="en"]').click()
    check('new paging and retention explanations translate to English','Previous page' in page.locator('.candidate-pagination').inner_text() and 'only in this session' in page.locator('.result-retention').inner_text() and 'current page' in page.locator('.pareto-chart + p').inner_text())
    page.set_viewport_size({'width':390,'height':844})
    page.locator('button[data-language="both"]').click()
    check('bilingual frontier controls fit a mobile viewport',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
    page.screenshot(path=str(out/'pareto-mobile-bilingual.png'),full_page=True)
    stage='actual input staleness after preference switch'
    page.locator('#water').fill('90');page.locator('#water').dispatch_event('input');page.locator('#water').dispatch_event('change');page.select_option('#objective','food')
    check('preference switch cannot clear real input staleness',page.locator('[data-action="save-plan"]').is_disabled())
    stage='reload and session cleanup'
    page.reload(wait_until='networkidle')
    check('reload clears session search but preserves chosen snapshot',page.locator('[data-action="save-plan"]').count()==0 and len(json.loads(page.evaluate("localStorage.getItem('farmsystem-workspace-v2')"))['plans'])==1)
    metrics.update({'evaluated':3897,'feasible':2008,'frontier':1414,'pageSize':36,'pages':pages,'lateCandidate':target['id'],'candidateIds':ids,'accountingSha256':digest,'searchAndFirstRenderMs':search_ms,'compactExportBytes':export_bytes,'downloadAndParseMs':export_ms,'rerankedExportBytes':second_bytes,'rerankedDownloadAndParseMs':second_ms,'preferenceAndRenderMs':ranking_ms,'errors':errors})
    write_metrics()
    try:
        check('full-frontier browser workflow has no JavaScript errors',not errors)
    finally:
        write_metrics()
        context.close()

    verify_pareto_stress(browser,url,out,record_check)


def verify_pareto_stress(browser,url,out,check):
    """Bounded high-frontier case in its own workspace; keep only compact evidence."""
    context=browser.new_context(viewport={'width':1440,'height':1050},accept_downloads=True)
    page=context.new_page();stage='stress initialization';errors=[]
    metrics={'case':'water2-labour2','errors':errors}
    report_path=out/'pareto-browser-metrics.json'
    def write_metrics():
        report=json.loads(report_path.read_text(encoding='utf-8')) if report_path.exists() else {}
        report['stress']=metrics
        report_path.write_text(json.dumps(report,indent=2),encoding='utf-8')
    def page_error(error):
        detail={'message':str(error),'stack':getattr(error,'stack',''),'stage':stage,'url':page.url}
        errors.append(detail);print('PARETO_STRESS_ERROR '+json.dumps(detail,ensure_ascii=False),flush=True);write_metrics()
    page.on('pageerror',page_error)
    try:
        page.goto(url.rstrip('/')+'/#data',wait_until='networkidle')
        page.wait_for_selector('[data-action="export-weather"]:not([disabled])')
        page.locator('nav [data-nav="planner"]').click()
        for control in ['water','labour']:
            page.locator('#'+control).fill('200');page.locator('#'+control).dispatch_event('input');page.locator('#'+control).dispatch_event('change')
        metrics['longTaskObserverSupported']=page.evaluate("""() => {window.paretoStressLongTasks=[];const supported=Boolean(window.PerformanceObserver&&PerformanceObserver.supportedEntryTypes.includes('longtask'));if(supported){window.paretoStressObserver=new PerformanceObserver(list=>window.paretoStressLongTasks.push(...list.getEntries().map(e=>({startMs:e.startTime,durationMs:e.duration}))));window.paretoStressObserver.observe({type:'longtask'});}return supported;}"""
        )
        stage='stress search and first render';started=time.monotonic()
        page.locator('[data-action="run"]').first.click();page.wait_for_selector('[data-action="save-plan"]',timeout=90000)
        metrics['searchAndFirstRenderMs']=round((time.monotonic()-started)*1000)
        check('stress frontier initially renders at most 36 rows and points',page.locator('tr[data-candidate]').count()==36 and page.locator('.pareto-chart [data-candidate]').count()==36)
        stage='stress complete export';started=time.monotonic()
        with page.expect_download(timeout=90000) as event:page.locator('[data-action="export-results"]').click()
        metrics['exportReadyMs']=round((time.monotonic()-started)*1000)
        stage='stress immediate page interaction after export';interaction_start=time.monotonic()
        page.locator('[data-action="next-candidates"]').click(timeout=5000)
        check('stress page controls respond immediately after full export',page.locator('#candidate-page').input_value()=='2' and page.locator('tr[data-candidate]').count()==36)
        metrics['pageInteractionAfterExportMs']=round((time.monotonic()-interaction_start)*1000)
        second_page_id=page.locator('tr[data-candidate]').first.get_attribute('data-candidate')
        stage='stress full JSON parse';path=out/'pareto-stress-temporary.json'
        try:
            event.value.save_as(str(path));metrics['compactExportBytes']=path.stat().st_size
            with path.open(encoding='utf-8') as stream:result=json.load(stream)
        finally:
            path.unlink(missing_ok=True)
        metrics['exportDownloadAndParseMs']=round((time.monotonic()-started)*1000)
        ids=[candidate['id'] for candidate in result['candidates']]
        check('stress export retains all 2536 complete unique candidates',result['evaluated']==3561 and result['feasibleCount']==3561 and result['frontierCount']==2536 and len(ids)==len(set(ids))==2536 and all(c['feasible'] and c['allocation'] and c['totals'] and c['farms'] and c['plots'] for c in result['candidates']))
        check('stress paging reaches the corresponding full-export candidate',second_page_id==ids[36])
        metrics.update(evaluated=result['evaluated'],feasible=result['feasibleCount'],frontier=result['frontierCount'],candidateIds=ids,candidateIdsSha256=hashlib.sha256('\n'.join(ids).encode()).hexdigest())
        del result;gc.collect()
        stage='stress preference and last page';started=time.monotonic();page.select_option('#objective','water')
        check('stress preference switch preserves selected candidate',page.locator('tr.selected-row').get_attribute('data-candidate')==second_page_id and page.locator('tr[data-candidate]').count()<=36)
        metrics['preferenceAndRenderMs']=round((time.monotonic()-started)*1000)
        page.locator('#candidate-page').fill('71');page.locator('#candidate-page').dispatch_event('change')
        check('stress final page exposes remaining 16 candidates',page.locator('tr[data-candidate]').count()==16 and page.locator('[data-action="next-candidates"]').is_disabled())
        metrics['mainThreadLongTasks']=page.evaluate('window.paretoStressLongTasks')
        metrics['maxMainThreadTaskMs']=max((task['durationMs'] for task in metrics['mainThreadLongTasks']),default=0)
        write_metrics()
        check('stress full-frontier browser workflow has no JavaScript errors',not errors)
    finally:
        metrics['lastStage']=stage;write_metrics();context.close()


if __name__=='__main__':
    import argparse,os
    from playwright.sync_api import sync_playwright
    parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:4173');parser.add_argument('--output',default='test-results');args=parser.parse_args()
    out=Path(args.output);out.mkdir(exist_ok=True,parents=True);checks=[]
    def check(name,value=True):
        assert value,name
        checks.append(name)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'))
        verify_pareto(browser,args.url,out,check);browser.close()
    print(json.dumps({'passed':len(checks),'checks':checks},ensure_ascii=False))
