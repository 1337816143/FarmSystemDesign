"""Read-only browser diagnostics for a specific HTML; never reports a pass from static checks."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import sys,json,os,hashlib
f=Path(sys.argv[1]).resolve();out=Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=True)
records=[]
with sync_playwright() as p:
 kwargs={'headless':True}
 if os.getenv('CHROMIUM_EXECUTABLE'):kwargs['executable_path']=os.environ['CHROMIUM_EXECUTABLE']
 browser=p.chromium.launch(**kwargs);ctx=browser.new_context(viewport={'width':1440,'height':900})
 def record_page(pg):
  pg.on('pageerror',lambda err:records.append({'type':'pageerror','page':pg.url,'message':str(err)}))
  pg.on('console',lambda msg:records.append({'type':'console','level':msg.type,'page':pg.url,'message':msg.text}) if msg.type in ['error','warning'] else None)
 ctx.on('page',record_page);page=ctx.new_page();page.goto(f.as_uri());page.wait_for_function('window.phdDeck')
 with page.expect_popup() as pop:page.locator('#presenter').click()
 speaker=pop.value;speaker.wait_for_timeout(2500)
 def state(pg):
  return pg.evaluate('''()=>{const read=(fn)=>{try{return fn()}catch(e){return {error:e.name+': '+e.message}}};return {url:location.href,origin:location.origin,windowOrigin:self.origin,hasOpener:!!opener,openerOrigin:read(()=>opener.location.origin),openerDocumentReadable:read(()=>!!opener.document),scriptCount:document.scripts.length,bodyText:document.body.innerText.slice(-2500),presenterApi:read(()=>window.presenterTest?.getState()),audienceApi:read(()=>window.phdDeck?.presenter.getState()),bootstrap:read(()=>{const b=window.__PRESENTER_BOOTSTRAP__;return b?{expectedOrigin:b.expectedOrigin,targetOrigin:b.targetOrigin}:null})}}''')
 result={'html_sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'audience':state(page),'presenter':state(speaker),'events':records}
 page.screenshot(path=str(out/'audience.png'),full_page=True);speaker.screenshot(path=str(out/'presenter.png'),full_page=True)
 (out/'diagnostic.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False));browser.close()
