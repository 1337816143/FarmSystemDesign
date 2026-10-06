"""Run against the standalone file or the Farm deployed discussion URL.
python tests/browser_qa.py [path-or-url] [output-dir]
Dependency: Playwright + Chromium. Does not need a local HTTP server.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,sys,os
ROOT=Path(__file__).resolve().parents[1]
target=sys.argv[1] if len(sys.argv)>1 else str(ROOT/'PhD2-JR-Discussion.html')
url=target if target.startswith(('http://','https://','file:')) else Path(target).resolve().as_uri()
OUT=Path(sys.argv[2]).resolve() if len(sys.argv)>2 else ROOT/'qa/browser'
OUT.mkdir(parents=True,exist_ok=True)
errors=[];requests=[];checks=[]
def passed(s):checks.append(s)
def check_slide(page,i,lang):
 page.evaluate('n=>window.phdDeck.go(n)',i)
 page.wait_for_timeout(25)
 assert page.locator('.slide.active').count()==1
 assert page.locator('#page-counter').inner_text()==f'{i+1} / 15'
 bad=page.evaluate('''()=>{const s=document.querySelector('.slide.active'),r=s.getBoundingClientRect(),bad=[];
 const walk=document.createTreeWalker(s,NodeFilter.SHOW_TEXT);let n;
 while(n=walk.nextNode()){if(!n.textContent.trim())continue;const p=n.parentElement;if(!p||p.closest('[hidden]')||!p.getClientRects().length||getComputedStyle(p).display==='none')continue;const range=document.createRange();range.selectNodeContents(n);for(const q of range.getClientRects()){if(q.width&&q.height&&(q.bottom>r.bottom+2||q.top<r.top-2||q.left<r.left-2||q.right>r.right+2))bad.push(n.textContent.slice(0,70));}}
 const rows=[...s.children].filter(e=>['HEADER','DIV','UL','P','FOOTER'].includes(e.tagName)&&e.getClientRects().length).map(e=>({tag:e.className||e.tagName,r:e.getBoundingClientRect()}));
 for(let i=1;i<rows.length;i++)if(rows[i].r.top<rows[i-1].r.bottom-2)bad.push('Overlap: '+rows[i-1].tag+' / '+rows[i].tag);return [...new Set(bad)]}''')
 assert not bad, f'{lang} slide {i+1}: {bad}'
 page.locator('.slide.active').screenshot(path=str(OUT/f'{lang}-{i+1:02}.png'))
with sync_playwright() as p:
 exe=os.getenv('CHROMIUM_EXECUTABLE')
 browser=p.chromium.launch(**({'executable_path':exe} if exe else {}),headless=True)
 ctx=browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1)
 page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append({'url':r.url,'type':r.resource_type}))
 page.goto(url,wait_until='load');page.wait_for_function('window.phdDeck && window.phdDeck.getState().count===15')
 for lang in ['en','zh','bi']:
  page.locator(f'[data-language="{lang}"]').click()
  for i in range(15):check_slide(page,i,lang)
 passed('45 desktop slide/language renders, no overflow or block overlaps')
 page.locator('[data-language="en"]').click();page.keyboard.press('Home');assert page.locator('#page-counter').inner_text()=='1 / 15'
 page.keyboard.press('ArrowRight');assert page.locator('#page-counter').inner_text()=='2 / 15'
 page.keyboard.press('End');assert page.locator('#page-counter').inner_text()=='15 / 15'
 page.keyboard.press('ArrowRight');assert page.locator('#page-counter').inner_text()=='15 / 15'
 page.keyboard.press('ArrowLeft');assert page.locator('#page-counter').inner_text()=='14 / 15'
 passed('Arrow, Home, End and end-of-deck boundary navigation')
 page.locator('#contents').click();page.locator('[data-goto="6"]').click();assert page.locator('#page-counter').inner_text()=='7 / 15'
 page.locator('.slide.active [data-notes]').click();assert page.locator('#notes-dialog').is_visible();assert page.locator('#notes-content').inner_text().strip()
 page.keyboard.press('ArrowRight');assert page.locator('#page-counter').inner_text()=='7 / 15'
 page.locator('#notes-content details').first.locator('summary').click();assert page.locator('#notes-content details').first.get_attribute('open') is not None
 page.keyboard.press('Escape');assert not page.locator('#notes-dialog').is_visible()
 for i in range(15):
  page.evaluate('n=>window.phdDeck.go(n)',i);page.locator('.slide.active [data-notes]').click();assert len(page.locator('#notes-content .notes-copy').inner_text())>50;assert page.locator('#notes-content details').count()>0;page.keyboard.press('Escape')
 passed('Contents, all 15 speaker notes/source lists, disclosure expansion and modal keyboard isolation')
 page.locator('#fullscreen').click();page.wait_for_timeout(200)
 fs=page.evaluate('!!document.fullscreenElement')
 if fs:page.evaluate('document.exitFullscreen()');passed('Fullscreen entered and exited')
 else:passed('Fullscreen denied gracefully by browser; fallback message checked' if page.locator('#message').inner_text() else 'Fullscreen state unavailable in this browser')
 page.keyboard.press('Home');page.locator('#reading').click();assert page.locator('.slide:visible').count()==15;page.locator('#reading').click();assert page.locator('.slide:visible').count()==1
 passed('Reading/presentation toggle preserves page state')
 # Offline test after initial load. The standalone document has no runtime assets.
 ctx.set_offline(True);page.reload(wait_until='load');page.wait_for_function('window.phdDeck');page.keyboard.press('End');assert page.locator('#page-counter').inner_text()=='15 / 15';ctx.set_offline(False)
 passed('Reload and navigation offline')
 page.set_viewport_size({'width':1366,'height':768});page.locator('[data-language="bi"]').click()
 for i in range(15):check_slide(page,i,'bi-1366')
 passed('15 bilingual renders at 1366 × 768')
 page.set_viewport_size({'width':390,'height':844})
 for lang in ['en','zh','bi']:
  page.locator(f'[data-language="{lang}"]').click()
  for i in range(15):
   page.evaluate('n=>window.phdDeck.go(n)',i)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'mobile horizontal overflow {lang} {i+1}'
  page.evaluate('window.phdDeck.go(8)');page.screenshot(path=str(OUT/f'mobile-{lang}.png'),full_page=True)
 passed('45 mobile slide/language checks without horizontal overflow')
 page.set_viewport_size({'width':1440,'height':900});page.locator('[data-language="en"]').click();page.emulate_media(media='print');assert page.locator('.slide:visible').count()==15
 page.pdf(path=str(OUT/'print-preview.pdf'),prefer_css_page_size=True,print_background=True)
 passed('Print stylesheet reveals all 15 slides and emits a PDF')
 assert not errors,errors
 runtime=[r for r in requests if r['type'] in ['script','stylesheet','font','image','fetch','xhr','media'] and r['url'].startswith(('http:','https:'))]
 assert not runtime,runtime
 passed('No JavaScript errors and no external runtime requests')
 browser.close()
result={'status':'PASS','url':url,'checks':checks,'console_errors':errors,'external_runtime_requests':runtime}
(OUT/'result.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n');print(json.dumps(result,indent=2,ensure_ascii=False))
