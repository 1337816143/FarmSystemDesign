"""Supplement to unchanged v5 main-deck layout checks: all 27 appendix-mode pages."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os,sys,json,re,hashlib,traceback
FILE=Path(sys.argv[1]).resolve();OUT=Path(sys.argv[2]).resolve();OUT.mkdir(parents=True,exist_ok=True)
assert hashlib.sha256(FILE.read_bytes()).hexdigest()=='8639b5d34dc3e0a389bca3aa82d4519ab6673452df40c40b5d49adc2d5819e6d'
rows=[];errors=[];failure=None
def geometry(page):
 return page.evaluate('''()=>{const s=document.querySelector('.slide.active'),r=s.getBoundingClientRect(),bad=[];const walk=document.createTreeWalker(s,NodeFilter.SHOW_TEXT);let n;while(n=walk.nextNode()){if(!n.textContent.trim())continue;const p=n.parentElement;if(!p||p.closest('script,style,template')||!p.getClientRects().length||getComputedStyle(p).display==='none')continue;if(p.closest('.tablewrap')&&innerWidth<=900)continue;const range=document.createRange();range.selectNodeContents(n);for(const q of range.getClientRects()){if(q.width&&q.height&&(q.bottom>r.bottom+2||q.top<r.top-2||q.left<r.left-2||q.right>r.right+2))bad.push(n.textContent.slice(0,95));}} for(const box of s.querySelectorAll('.tablewrap,.purpose-grid')){if(!box.getClientRects().length)continue;const br=box.getBoundingClientRect(),walker=document.createTreeWalker(box,NodeFilter.SHOW_TEXT);let t;while(t=walker.nextNode()){if(!t.textContent.trim()||!t.parentElement.getClientRects().length)continue;const tr=document.createRange();tr.selectNodeContents(t);for(const qr of tr.getClientRects())if(qr.width&&qr.height&&(qr.top<br.top-2||qr.bottom>br.bottom+2))bad.push('Clipped inside '+box.className+': '+t.textContent.slice(0,80));}} const rows=[...s.children].filter(e=>e.getClientRects().length).map(e=>({name:e.className,r:e.getBoundingClientRect()}));for(let i=1;i<rows.length;i++)if(rows[i].r.top<rows[i-1].r.bottom-2)bad.push('Overlap '+rows[i-1].name+' / '+rows[i].name);return [...new Set(bad)]}''')
try:
 with sync_playwright() as p:
  options={'headless':True}
  if os.getenv('CHROMIUM_EXECUTABLE'):options['executable_path']=os.environ['CHROMIUM_EXECUTABLE']
  browser=p.chromium.launch(**options)
  for dpi in [1,2]:
   ctx=browser.new_context(device_scale_factor=dpi);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(FILE.as_uri()+'?appendix=1');page.wait_for_function('window.phdDeck&&phdDeck.getState().count===27')
   sizes=[(2048,1008),(1440,900),(1366,768),(390,844),(768,1024)] if dpi==1 else [(1366,768)]
   for w,h in sizes:
    page.set_viewport_size({'width':w,'height':h})
    for lang in ['en','zh']:
     page.evaluate('l=>phdDeck.language(l)',lang)
     for i in range(27):
      page.evaluate('i=>phdDeck.go(i)',i);page.wait_for_timeout(35)
      assert page.locator('#page-counter').inner_text()==f'{i+1} / 27'
      bad=geometry(page)
      if page.evaluate('document.documentElement.scrollWidth>innerWidth+1'):bad.append('Page-level horizontal overflow')
      rows.append({'width':w,'height':h,'dpi':dpi,'lang':lang,'slide':i+1,'overflow':bad})
      page.screenshot(path=str(OUT/f'{w}-dpi{dpi}-{lang}-{i+1:02}.png'),full_page=True)
   if dpi==1:
    page.set_viewport_size({'width':1440,'height':900});page.locator('#reading').click();assert page.locator('.slide:visible').count()==27;page.locator('#reading').click()
    page.emulate_media(media='print')
    for lang in ['en','zh']:
     page.evaluate('l=>phdDeck.language(l)',lang)
     for i in range(27):
      page.evaluate('i=>phdDeck.go(i)',i);rows.append({'mode':'print','lang':lang,'slide':i+1,'overflow':geometry(page)})
     pdf=OUT/f'appendix-print-{lang}.pdf';page.pdf(path=str(pdf),print_background=True,prefer_css_page_size=True)
     assert len(re.findall(rb'/Type\s*/Page\b',pdf.read_bytes()))==27
   ctx.close()
  browser.close()
except Exception:
 failure=traceback.format_exc()
finally:
 bad=[x for x in rows if x['overflow']]
 (OUT/'appendix-layout-report.json').write_text(json.dumps({'html_sha256':hashlib.sha256(FILE.read_bytes()).hexdigest(),'geometries':rows,'failed_geometries':bad,'page_errors':errors,'fatal_error':failure},ensure_ascii=False,indent=2),encoding='utf-8')
assert not failure,failure
assert not errors,errors
assert not bad,json.dumps(bad,ensure_ascii=False)
