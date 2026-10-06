"""True browser checks for the Task10 visual redesign. No screenshot is fabricated.
Usage: python tests/browser_qa.py /absolute/path/to/candidate.html /output/dir
Run in authorised Farm CI because cloud browser process creation is restricted.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,sys,os,re
ROOT=Path(__file__).resolve().parents[1]
target=sys.argv[1] if len(sys.argv)>1 else str(ROOT/'PhD2-Hainan-Joint-Discussion-candidate.html')
url=target if target.startswith(('http://','https://','file:')) else Path(target).resolve().as_uri()
OUT=Path(sys.argv[2]).resolve() if len(sys.argv)>2 else ROOT/'qa/browser';OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];requests=[];results=[]
def ok(s):checks.append(s)
def geometry(page):
 return page.evaluate('''()=>{const s=document.querySelector('.slide.active'),r=s.getBoundingClientRect(),bad=[];const walk=document.createTreeWalker(s,NodeFilter.SHOW_TEXT);let n;while(n=walk.nextNode()){if(!n.textContent.trim())continue;const p=n.parentElement;if(!p||p.closest('script,style,template')||!p.getClientRects().length||getComputedStyle(p).display==='none')continue;if(p.closest('.tablewrap')&&innerWidth<=900)continue;const range=document.createRange();range.selectNodeContents(n);for(const q of range.getClientRects()){if(q.width&&q.height&&(q.bottom>r.bottom+2||q.top<r.top-2||q.left<r.left-2||q.right>r.right+2))bad.push(n.textContent.slice(0,95));}} const rows=[...s.children].filter(e=>e.getClientRects().length).map(e=>({name:e.className,r:e.getBoundingClientRect()}));for(let i=1;i<rows.length;i++)if(rows[i].r.top<rows[i-1].r.bottom-2)bad.push('Overlap '+rows[i-1].name+' / '+rows[i].name);return [...new Set(bad)]}''')
with sync_playwright() as p:
 kwargs={'headless':True}
 if os.getenv('CHROMIUM_EXECUTABLE'):kwargs['executable_path']=os.environ['CHROMIUM_EXECUTABLE']
 browser=p.chromium.launch(**kwargs)
 ctx=browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1)
 page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url));page.goto(url,wait_until='load');page.wait_for_function('window.phdDeck&&window.phdDeck.getState().count===18')
 ids=page.locator('[id]').evaluate_all('(e)=>e.map(x=>x.id)');assert len(ids)==len(set(ids));ok('All DOM IDs unique')
 assert page.locator('img').evaluate_all('(e)=>e.every(x=>x.complete&&x.naturalWidth>0&&x.naturalHeight>0)');ok('All embedded images decode with positive natural dimensions')
 for w,h in [(2048,1008),(1440,900),(1366,768)]:
  page.set_viewport_size({'width':w,'height':h})
  for lang in ['en','zh']:
   page.evaluate('l=>phdDeck.language(l)',lang)
   for i in range(18):
    page.evaluate('n=>phdDeck.go(n)',i);page.wait_for_timeout(35)
    assert page.locator('.slide.active').count()==1
    assert page.locator('#page-counter').inner_text()==f'{i+1} / 18'
    bad=geometry(page)
    horizontal=page.evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})')
    if horizontal['scrollWidth']>horizontal['width']+1:bad.append('Document horizontal overflow: '+json.dumps(horizontal))
    results.append({'width':w,'height':h,'lang':lang,'slide':i+1,'overflow':bad})
    (OUT/'browser-report.partial.json').write_text(json.dumps({'checks':checks,'page_errors':errors,'geometries':results,'failed_geometries':[r for r in results if r['overflow']]},ensure_ascii=False,indent=2),encoding='utf-8')
    page.screenshot(path=str(OUT/f'{w}-{lang}-{i+1:02}.png'),full_page=True)
 ok('108 actual desktop slide screenshots across 3 viewports and 2 languages')
 # Numerical assertions compare source aggregate JSON and generated chart marks.
 d=page.evaluate('phdDeck.data');assert d['summary']['record_count']==198;assert d['summary']['entirely_blank_fields']==23
 counts=page.locator('#record-distribution .barrow').evaluate_all('(els)=>els.map(e=>Number(e.dataset.count))')
 assert counts==[x['count'] for x in d['crop_distribution']] and sum(counts)==198
 cells=page.locator('#coverage-heatmap td').evaluate_all('(els)=>els.map(e=>({label:e.dataset.label,column:e.dataset.column,n:Number(e.dataset.n),d:Number(e.dataset.d)}))')
 assert len(cells)==108
 for c in cells:
  v=next(x for x in d['coverage_heatmap'] if x['label']==c['label'] and x['column']==c['column']);assert c['n']==v['nonempty'] and c['d']==v['denominator']
 assert page.locator('#calendar-table [data-row="63"].sow').get_attribute('data-month')=='11'
 assert page.locator('#calendar-table [data-row="63"].harvest').get_attribute('data-month')=='12'
 assert page.locator('#calendar-table tbody tr').count()==7
 ok('Distribution, all 108 coverage cells and calendar source markers match audited JSON')
 page.set_viewport_size({'width':1440,'height':900});page.evaluate("phdDeck.language('en');phdDeck.go(0)");page.locator('body').click(position={'x':4,'y':4});page.keyboard.press('ArrowRight');assert page.locator('#page-counter').inner_text()=='2 / 18';page.keyboard.press('End');assert page.locator('#page-counter').inner_text()=='18 / 18';page.keyboard.press('ArrowRight');assert page.locator('#page-counter').inner_text()=='18 / 18';page.keyboard.press('Home');assert page.locator('#page-counter').inner_text()=='1 / 18';ok('Keyboard navigation and bounds')
 page.locator('#contents').click();page.locator('[data-goto="5"]').click();assert page.locator('#page-counter').inner_text()=='6 / 18'
 for i in range(18):
  page.evaluate('n=>phdDeck.go(n)',i);page.locator('.slide.active [data-notes]').click();assert page.locator('#notes-dialog').is_visible();assert page.locator('#notes-content .notes-copy').count()==0;assert page.locator('#notes-content details').count()>0;before=page.locator('#page-counter').inner_text();page.keyboard.press('ArrowRight');assert page.locator('#page-counter').inner_text()==before;page.locator('#notes-content details').first.locator('summary').click();page.keyboard.press('Escape');assert not page.locator('#notes-dialog').is_visible()
 ok('Contents, 18 audience source-only dialogs and modal keyboard isolation')
 page.evaluate('phdDeck.go(11)');assert page.evaluate('phdDeck.getState().animationPlaying') is False
 page.locator('#anim-next').click();assert page.evaluate('phdDeck.getState().animationStep')==1
 vals=page.locator('.anim-bar.capacity').evaluate_all('(e)=>e.map(x=>Number(x.dataset.value))');assert vals==[100,70,100]
 page.locator('#anim-next').click();assert page.locator('.anim-bar.demand').evaluate_all('(e)=>e.map(x=>Number(x.dataset.value))')==[80,70,100]
 page.locator('#anim-play').click();assert page.evaluate('phdDeck.getState().animationPlaying');page.locator('#anim-play').click();assert not page.evaluate('phdDeck.getState().animationPlaying');page.locator('#anim-reset').click();assert page.evaluate('phdDeck.getState().animationStep')==0
 ok('Synthetic animation values, single-step, play, pause and reset')
 page.locator('#fullscreen').click();page.wait_for_timeout(100);fs=page.evaluate('!!document.fullscreenElement');assert fs or bool(page.locator('#live-status').inner_text());
 if fs:page.evaluate('document.exitFullscreen()')
 ok('Fullscreen or explicit browser limitation')
 page.locator('#reading').click();assert page.locator('.slide:visible').count()==18;page.locator('#reading').click();assert page.locator('.slide:visible').count()==1;ok('Reading mode')
 ctx.set_offline(True);page.reload(wait_until='load');page.wait_for_function('window.phdDeck');assert page.locator('.slide.active').count()==1;ok('Offline reload of self-contained HTML')
 page.emulate_media(media='print');page.pdf(path=str(OUT/'print-en.pdf'),print_background=True,prefer_css_page_size=True);page.evaluate("phdDeck.language('zh')");page.pdf(path=str(OUT/'print-zh.pdf'),print_background=True,prefer_css_page_size=True)
 for lang in ['en','zh']:
  pdf=(OUT/f'print-{lang}.pdf').read_bytes();n=len(re.findall(rb'/Type\s*/Page\b',pdf));assert n==18,(lang,n)
 ok('English and Chinese print exports contain exactly 18 pages')
 page.emulate_media(media='screen')
 for w,h in [(390,844),(768,1024)]:
  page.set_viewport_size({'width':w,'height':h})
  for lang in ['en','zh']:
   page.evaluate('l=>phdDeck.language(l)',lang)
   for i in range(18):
    page.evaluate('n=>phdDeck.go(n)',i);page.screenshot(path=str(OUT/f'mobile-{w}-{lang}-{i+1:02}.png'),full_page=True)
    bad=geometry(page)
    horizontal=page.evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})')
    if horizontal['scrollWidth']>horizontal['width']+1:bad.append('Document horizontal overflow: '+json.dumps(horizontal))
    results.append({'width':w,'height':h,'lang':lang,'slide':i+1,'overflow':bad})
    (OUT/'browser-report.partial.json').write_text(json.dumps({'checks':checks,'page_errors':errors,'geometries':results,'failed_geometries':[r for r in results if r['overflow']]},ensure_ascii=False,indent=2),encoding='utf-8')
 ok('72 real mobile/tablet screenshots; no page-level horizontal overflow')
 reduced_ctx=browser.new_context(viewport={'width':1440,'height':900},reduced_motion='reduce');rp=reduced_ctx.new_page();rp.goto(url);assert rp.evaluate('phdDeck.getState().reducedMotion');assert not rp.evaluate('phdDeck.getState().animationPlaying');rp.evaluate('phdDeck.go(11)');rp.locator('#anim-next').click();assert rp.evaluate('phdDeck.getState().animationStep')==1;ok('Reduced motion defaults to paused; manual step works')
 assert not errors,errors;external=[u for u in requests if u.startswith(('http://','https://')) and u!=url];assert not external,external;ok('No runtime errors or external runtime asset requests')
 bad=[r for r in results if r['overflow']]
 (OUT/'browser-report.json').write_text(json.dumps({'checks':checks,'page_errors':errors,'external_requests':external,'geometries':results,'failed_geometries':bad},ensure_ascii=False,indent=2))
 browser.close();print(json.dumps({'checks':len(checks),'geometries':len(results),'failed_geometries':len(bad)},ensure_ascii=False))
 assert not bad,json.dumps(bad,ensure_ascii=False)
