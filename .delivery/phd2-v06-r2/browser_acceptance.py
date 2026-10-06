"""Frozen r2 browser acceptance. Run only in authorized CI; no browser sandbox bypass.
Every scenario writes a pass/fail record, including failures; screenshots are actual renders.
"""
from pathlib import Path, PurePosixPath
from playwright.sync_api import sync_playwright, expect
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from threading import Thread
import hashlib, json, os, shutil, subprocess, sys, tempfile, traceback, zipfile, re
FILE=Path(sys.argv[1]).resolve(); OUT=Path(sys.argv[2]).resolve(); OUT.mkdir(parents=True,exist_ok=True)
EXPECTED='8639b5d34dc3e0a389bca3aa82d4519ab6673452df40c40b5d49adc2d5819e6d'
ZIP_SHA='c1d501f4619f93af84d055d25f1994c4992bf75d0f8fd7853768646854c35631'
assert FILE.stat().st_size==5402339 and hashlib.sha256(FILE.read_bytes()).hexdigest()==EXPECTED
report={'html_sha256':EXPECTED,'checks':[],'browser':None,'limitations':['Separate Playwright pages test simultaneous live windows, not an OS-composited four-window screenshot.','Parent production CSP and service-worker integration require the actual approved host; loopback is not a substitute.']}
def save(): (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
def check(name,fn):
 try: detail=fn(); report['checks'].append({'name':name,'status':'passed','detail':detail})
 except Exception as e: report['checks'].append({'name':name,'status':'failed','error':str(e),'traceback':traceback.format_exc()})
 save()
def launch(a):
 with a.expect_popup() as pending: a.locator('#presenter').click()
 b=pending.value
 b.wait_for_function('window.presenterTest&&presenterTest.getState().connected&&presenterTest.getState().previews.current&&presenterTest.getState().previews.next')
 return b

def pair(a,b,i,lang=None):
 a.wait_for_function('i=>phdDeck.getState().index===i',arg=i)
 b.wait_for_function('i=>presenterTest.getState().index===i',arg=i)
 b.frame_locator('#iframe-cur').locator('.slide.active').wait_for()
 expect(b.frame_locator('#iframe-cur').locator('.slide.active')).to_have_attribute('id',a.locator('.slide.active').get_attribute('id'))
 if lang:
  a.wait_for_function('l=>phdDeck.getState().language===l',arg=lang)
  b.wait_for_function('l=>presenterTest.getState().language===l',arg=lang)
  expect(b.frame_locator('#iframe-cur').locator('body')).to_have_attribute('data-lang',lang)

def opened(ctx,url):
 a=ctx.new_page(); a.goto(url); a.wait_for_function('window.phdDeck'); return a

def download(source,selector,dest):
 with source.expect_download() as p: source.locator(selector).first.click()
 p.value.save_as(dest)
 b=Path(dest).read_bytes(); assert len(b)==101355 and hashlib.sha256(b).hexdigest()==ZIP_SHA
 return {'bytes':len(b),'sha256':ZIP_SHA}

class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass

with tempfile.TemporaryDirectory(prefix='phd2-r2-') as temp:
 work=Path(temp); shutil.copyfile(FILE,work/'deck.html')
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=temp));Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as p:
   options={'headless':True}
   if os.getenv('CHROMIUM_EXECUTABLE'):options['executable_path']=os.environ['CHROMIUM_EXECUTABLE']
   browser=p.chromium.launch(**options); report['browser']={'version':browser.version,'label':os.getenv('QA_BROWSER_LABEL','unspecified'),'executable':os.getenv('CHROMIUM_EXECUTABLE','Playwright Chromium')};save()
   for scheme,base in [('file',(work/'deck.html').as_uri()),('http',f'http://127.0.0.1:{server.server_port}/deck.html')]:
    for transport in ['normal','postmessage-only']:
     prefix=f'{scheme}-{transport}'
     def interaction():
      ctx=browser.new_context(viewport={'width':1280,'height':900},accept_downloads=True)
      errors=[];external=[]
      ctx.on('page',lambda pg:pg.on('pageerror',lambda e:errors.append(str(e))))
      ctx.on('request',lambda r:external.append(r.url) if r.url.startswith(('https:','http:')) and not r.url.startswith('http://127.0.0.1:') else None)
      if transport=='postmessage-only':ctx.add_init_script("window.__qaTransport='postmessage-only';window.BroadcastChannel=class{constructor(){throw new Error('Test: BroadcastChannel unavailable')}}")
      try:
       a=opened(ctx,base+'?lang=en'); b=launch(a)
       if transport=='postmessage-only':assert a.evaluate('window.__qaTransport')==transport and b.evaluate('window.__qaTransport')==transport
       c=opened(ctx,base+'?appendix=1&lang=zh#period-evidence');d=launch(c)
       assert a.evaluate('phdDeck.getState().count')==18 and c.evaluate('phdDeck.getState().count')==27
       pair(c,d,22,'zh');pair(a,b,0,'en'); assert len(ctx.pages)==4
       b.locator('#btn-next').click();pair(a,b,1);pair(c,d,22,'zh')
       d.locator('#btn-prev').click();pair(c,d,21);pair(a,b,1,'en')
       b.locator('#speaker-language').select_option('zh');d.locator('#speaker-language').select_option('en');pair(a,b,1,'zh');pair(c,d,21,'en')
       assert b.locator('#notes-body .speaker-manuscript').inner_text().strip()
       assert d.locator('#notes-body .speaker-manuscript').inner_text().strip()
       d.locator('#notes-body > details > summary').click();assert d.locator('#notes-body .note-ref').first.is_visible();pair(a,b,1,'zh')
       for n,pg in [('main',a),('main-speaker',b),('appendix',c),('appendix-speaker',d)]:pg.screenshot(path=str(OUT/f'{prefix}-four-{n}.png'),full_page=True)
       e=opened(ctx,base+'?lang=en');f=launch(e)
       assert len({x.evaluate('phdDeck.presenter.getState().sessionId') for x in [a,c,e]})==3
       f.locator('#btn-next').click();pair(e,f,1);pair(a,b,1,'zh');pair(c,d,21,'en')
       b.locator('#btn-pause').click();b.wait_for_function('presenterTest.getState().clock.running');b.wait_for_function("document.querySelector('#timer-display').textContent!=='00:00'",timeout=5000)
       assert not d.evaluate('presenterTest.getState().clock.running') and not f.evaluate('presenterTest.getState().clock.running')
       b.locator('#btn-pause').click();b.wait_for_function('!presenterTest.getState().clock.running'); paused=b.locator('#timer-display').inner_text();b.wait_for_timeout(1100);assert b.locator('#timer-display').inner_text()==paused
       b.locator('#btn-reset').click();b.wait_for_function('presenterTest.getState().clock.elapsedMs===0')
       a.evaluate('phdDeck.go(11);phdDeck.animation.step()');pair(a,b,11);assert c.evaluate('phdDeck.getState().animationStep')==0 and e.evaluate('phdDeck.getState().animationStep')==0
       # Exercise both final-slide END states and recovery of the next frame.
       for audience,speaker,last in [(a,b,17),(c,d,26)]:
        audience.evaluate('n=>phdDeck.go(n)',last);pair(audience,speaker,last)
        speaker.locator('#card-nxt .preview-end').wait_for(state='visible');speaker.locator('#btn-next').click();pair(audience,speaker,last)
        speaker.locator('#btn-prev').click();pair(audience,speaker,last-1)
        expected_last=audience.locator('.slide').nth(last).get_attribute('id')
        expect(speaker.frame_locator('#iframe-nxt').locator('.slide.active')).to_have_attribute('id',expected_last)
       # Real rapid UI messages followed by mixed language/timer controls.
       b.evaluate("()=>{for(let i=0;i<8;i++)document.querySelector('#btn-prev').click();document.querySelector('#speaker-language').value='en';document.querySelector('#speaker-language').dispatchEvent(new Event('change'));document.querySelector('#btn-reset').click()}")
       pair(a,b,8,'en');pair(c,d,25,'en');pair(e,f,1,'en')
       # Current peer closes, reopens; old-token messages sent from the new real popup are rejected.
       old=b.evaluate('presenterTest.getState()');b.close();b=launch(a)
       assert b.evaluate('presenterTest.getState().peerToken')!=old['peerToken']
       b.evaluate("s=>window.opener.postMessage({bridge:'hainan-mit-presenter-v1',from:'presenter',sessionId:s.sessionId,peerToken:s.peerToken,messageId:'old-token',type:'go',controlSequence:99999,idx:0,language:'zh',clock:{running:false,elapsedMs:0,startedAt:null}},'*')",old)
       b.wait_for_timeout(200);pair(a,b,8,'en');pair(c,d,25,'en')
       # Popup blocker must show feedback and recover with the next user action.
       b.close();a.evaluate('window.savedOpen=window.open;window.open=()=>null');a.locator('#presenter').click();assert a.locator('#live-status').inner_text().strip();a.evaluate('window.open=window.savedOpen');b=launch(a);pair(a,b,8,'en')
       # Refresh rotates the audience session; the pre-refresh speaker cannot drive it.
       prior=a.evaluate('phdDeck.presenter.getState().sessionId');a.reload();a.wait_for_function('window.phdDeck');assert a.evaluate('phdDeck.presenter.getState().sessionId')!=prior
       at=a.evaluate('phdDeck.getState().index');b.locator('#btn-next').click();b.wait_for_timeout(200);assert a.evaluate('phdDeck.getState().index')==at;b.close();b=launch(a)
       a.close();b.wait_for_function("document.querySelector('#sync-status').textContent.includes('Audience closed')");pair(c,d,25,'en');pair(e,f,1,'en')
       assert not errors,errors;assert not external,external
       return {'live_windows':6,'page_errors':errors,'external_requests':external}
      finally:ctx.close()
     check(prefix+'-presenter-isolation-lifecycle',interaction)
    def channel_and_order():
     ctx=browser.new_context(viewport={'width':1440,'height':1000})
     # Suppress only protocol postMessage reception; preview messages remain intact.
     ctx.add_init_script("window.__qaTransport='broadcast-only';const originalAdd=window.addEventListener;window.addEventListener=function(t,f,o){if(t==='message'&&typeof f==='function')return originalAdd.call(this,t,function(e){if(e.data&&e.data.bridge==='hainan-mit-presenter-v1')return;return f.call(this,e)},o);return originalAdd.call(this,t,f,o)}")
     try:
      a=opened(ctx,base);b=launch(a);assert a.evaluate('window.__qaTransport')=='broadcast-only' and b.evaluate('window.__qaTransport')=='broadcast-only';b.locator('#btn-next').click();pair(a,b,1)
      # Feed complete real-channel snapshots: latest, older and exact duplicate.
      state=b.evaluate('presenterTest.getState()')
      b.evaluate("s=>{const bc=new BroadcastChannel('hainan-mit-presenter-'+s.sessionId);const pack=(seq,idx,id)=>({bridge:'hainan-mit-presenter-v1',sessionId:s.sessionId,peerToken:s.peerToken,from:'presenter',messageId:id,type:'go',controlSequence:seq,idx,language:'zh',clock:{running:false,elapsedMs:1200,startedAt:null}});const newest=pack(1002,7,'newest');bc.postMessage(newest);bc.postMessage(pack(1001,3,'older'));bc.postMessage(newest);setTimeout(()=>bc.close(),500)}",state)
      pair(a,b,7,'zh');b.wait_for_timeout(600);pair(a,b,7,'zh');assert a.evaluate('phdDeck.presenter.getState().clock.elapsedMs')==1200
      # Drag and restore visible cards. This confirmation is test-owned fixture UI.
      head=b.locator('#card-notes .pcard-head');box=head.bounding_box();before=b.locator('#card-notes').bounding_box()
      b.mouse.move(box['x']+30,box['y']+10);b.mouse.down();b.mouse.move(box['x']+70,box['y']+50,steps=8);b.mouse.up()
      after=b.locator('#card-notes').bounding_box();assert after['x']!=before['x'] or after['y']!=before['y']
      b.once('dialog',lambda dialog:dialog.accept());b.locator('#reset-layout').click()
      for card in ['#card-cur','#card-nxt','#card-notes','#card-timer']:
       box=b.locator(card).bounding_box();assert box and box['width']>100 and box['height']>80 and box['x']>=0 and box['y']>=0
      b.screenshot(path=str(OUT/f'{scheme}-broadcast-only-card-reset.png'),full_page=True)
      return {'transport':'BroadcastChannel-only protocol, standard postMessage previews','stale_and_duplicate':'rejected','cards':'dragged and reset'}
     finally:ctx.close()
    check(scheme+'-broadcast-only-ordering-card-layout',channel_and_order)
    for lang in ['en','zh']:
     def links():
      ctx=browser.new_context();a=opened(ctx,base+'?lang='+lang)
      try:
       links=a.locator('a.appendix-link'); assert links.count()==10
       for index in range(10):
        a.evaluate('phdDeck.go(17)')
        if index>0:a.locator('#contents').click()
        link=links.nth(index);href=link.get_attribute('href');assert 'appendix=1' in href and 'lang='+lang in href
        with a.expect_popup() as pending:link.click()
        child=pending.value;child.wait_for_function('window.phdDeck');assert child.evaluate('phdDeck.getState().count')==27
        assert child.evaluate('phdDeck.getState().language')==lang
        assert child.locator('.slide.active').get_attribute('id')==href.split('#')[1];child.close()
        if index>0:a.keyboard.press('Escape')
       a.locator('body').click(position={'x':2,'y':2});a.keyboard.press('End');a.keyboard.press('ArrowRight');assert a.evaluate('phdDeck.getState().index')==17
       return {'entries':10,'language':lang}
      finally:ctx.close()
     check(f'{scheme}-{lang}-all-appendix-links',links)
    for mode in ['main','appendix']:
     def offline():
      ctx=browser.new_context(accept_downloads=True);suffix='?appendix=1&lang=zh' if mode=='appendix' else '?lang=en'
      try:
       a=opened(ctx,base+suffix);b=launch(a);last=26 if mode=='appendix' else 17
       ctx.set_offline(True)
       a.evaluate('n=>phdDeck.go(n)',last);pair(a,b,last)
       b.locator('#btn-prev').click();pair(a,b,last-1)
       assert b.locator('#notes-body').inner_text().strip()
       if mode=='appendix':
        a.evaluate('phdDeck.go(22)');pair(a,b,22);a.locator('.slide.active [data-notes]').click()
        # Expand source disclosure before the native download click.
        a.locator('#notes-content details').evaluate_all('(xs)=>xs.forEach(x=>x.open=true)')
        download(a,'#notes-content a[download]',str(OUT/f'{scheme}-offline-audience.zip'));a.keyboard.press('Escape')
        b.locator('#notes-body details').evaluate_all('(xs)=>xs.forEach(x=>x.open=true)')
        download(b,'#notes-body a[download]',str(OUT/f'{scheme}-offline-presenter.zip'))
       b.close();b=launch(a);b.screenshot(path=str(OUT/f'{scheme}-{mode}-offline-reopened.png'),full_page=True)
       a.close();b.close()
       # HTTP without a service worker may fail here; record failure, never claim file/cache proves HTTP cold-offline reopen.
       a=opened(ctx,base+suffix);b=launch(a);pair(a,b,0,'zh' if mode=='appendix' else 'en')
       return {'offline':True,'reopened':True}
      finally:ctx.close()
     check(f'{scheme}-{mode}-real-offline-reopen-download',offline)
   browser.close()
 finally:server.shutdown();server.server_close()

# Native browser-download bytes, not a separate base64 decode, are the reproduction input.
def reproduction():
 downloaded=OUT/'file-offline-audience.zip';assert downloaded.exists(),'Browser download did not complete'
 with tempfile.TemporaryDirectory(prefix='phd2-repro-') as td:
  with zipfile.ZipFile(downloaded) as z:
   for name in z.namelist():
    parts=PurePosixPath(name).parts;assert not name.startswith('/') and '..' not in parts
    assert not name.endswith('.tap') and 'independent-acceptance' not in name
   z.extractall(td)
  root=Path(td)/'b-controller-repro'
  commands=[['node','--test','--test-reporter=tap','--test-name-pattern=Actual controller reproduces 9/8/5','tests/dated-controller.test.mjs'],['node','--test','--test-reporter=tap','tests/dated-events-integration.test.mjs']]
  for i,cmd in enumerate(commands):
   run=subprocess.run(cmd,cwd=root,text=True,encoding='utf-8',capture_output=True,timeout=120);(OUT/f'download-reproduction-{i}.txt').write_text(run.stdout+run.stderr,encoding='utf-8');assert run.returncode==0,run.stdout+run.stderr
 return {'native_download_sha256':ZIP_SHA,'commands':2}
check('browser-downloaded-synthetic-reproduction',reproduction)
print(json.dumps({'checks':len(report['checks']),'failed':sum(x['status']=='failed' for x in report['checks'])}))
sys.exit(1 if any(x['status']=='failed' for x in report['checks']) else 0)
