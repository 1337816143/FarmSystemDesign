"""True file/HTTP browser tests of the adapted MIT speaker implementation."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from functools import partial
import tempfile,shutil,sys,os,json,hashlib
FILE=Path(sys.argv[1]).resolve();OUT=Path(sys.argv[2]).resolve();OUT.mkdir(parents=True,exist_ok=True);checks=[];errors=[];requests=[]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass

def wait_pair(a,b,i):
 a.wait_for_function('i=>phdDeck.getState().index===i',arg=i);b.wait_for_function('i=>presenterTest.getState().index===i',arg=i)
def launch(a):
 with a.expect_popup() as p:a.locator('#presenter').click()
 b=p.value;b.wait_for_function('window.presenterTest&&presenterTest.getState().ready',timeout=30000);b.wait_for_function('presenterTest.getState().connected',timeout=30000);b.wait_for_function('presenterTest.getState().previews.current&&presenterTest.getState().previews.next',timeout=30000);return b
with tempfile.TemporaryDirectory(prefix='mit-speaker-qa-') as td:
 w=Path(td);shutil.copyfile(FILE,w/'deck.html');shutil.copyfile(FILE,w/'deck-other.html');(w/'neutral.html').write_text('<html><body>Neutral</body></html>')
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=td));Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as p:
   opts={'headless':True}
   if os.getenv('CHROMIUM_EXECUTABLE'):opts['executable_path']=os.environ['CHROMIUM_EXECUTABLE']
   browser=p.chromium.launch(**opts)
   for scheme,url in [('file',(w/'deck.html').as_uri()),('http',f'http://127.0.0.1:{server.server_port}/deck.html')]:
    ctx=browser.new_context(viewport={'width':1440,'height':1000});ctx.on('page',lambda pg:pg.on('pageerror',lambda e:errors.append(str(e))))
    ctx.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) and not r.url.startswith('http://127.0.0.1:') else None)
    a=ctx.new_page();a.goto(url);a.wait_for_function('window.phdDeck');b=launch(a);b.set_viewport_size({'width':1440,'height':1000})
    assert len(b.locator('#notes-body').inner_text())>100;assert '1 / 18' in b.locator('#timer-count').inner_text();assert not a.locator('.notes-copy:visible').count()
    assert b.frame_locator('#iframe-cur').locator('.slide.active').count()==1
    assert b.frame_locator('#iframe-nxt').locator('.slide.active').count()==1
    b.screenshot(path=str(OUT/f'{scheme}-initial-speaker.png'),full_page=True);a.screenshot(path=str(OUT/f'{scheme}-audience.png'),full_page=True);checks.append(scheme+': real current/next slide pixels and local manuscript initialise')
    a.locator('#presenter').click();assert len(ctx.pages)==2
    a.locator('#next').click();wait_pair(a,b,1);b.locator('#btn-next').click();wait_pair(a,b,2);b.locator('#btn-prev').click();wait_pair(a,b,1)
    b.locator('#speaker-language').select_option('zh');a.wait_for_function("phdDeck.getState().language==='zh'");assert '我' in b.locator('#notes-body').inner_text()
    assert b.frame_locator('#iframe-cur').locator('body').get_attribute('data-lang')=='zh'
    a.evaluate('phdDeck.go(16)');wait_pair(a,b,16);b.screenshot(path=str(OUT/f'{scheme}-slide17-zh.png'),full_page=True);checks.append(scheme+': bidirectional navigation/language and repeated-open reuse')
    # Read-only manuscripts follow upstream; dropdown typing cannot navigate the deck.
    index=a.evaluate('phdDeck.getState().index');b.locator('#speaker-language').focus();b.locator('#speaker-language').press('ArrowLeft');assert a.evaluate('phdDeck.getState().index')==index
    b.locator('#btn-pause').click()
    b.wait_for_function('presenterTest.getState().clock.running');a.wait_for_function('phdDeck.presenter.getState().clock.running')
    started=b.evaluate('presenterTest.getState().clock');assert started['startedAt']==a.evaluate('phdDeck.presenter.getState().clock.startedAt')
    # Await the actual display transition. A 250ms tick plus integer-second
    # formatting can legitimately update just after a fixed 1200ms sample.
    b.wait_for_function("document.getElementById('timer-display').textContent!=='00:00'",timeout=4000)
    b.locator('#btn-pause').click();b.wait_for_function('!presenterTest.getState().clock.running');a.wait_for_function('!phdDeck.presenter.getState().clock.running')
    paused_state=b.evaluate('presenterTest.getState().clock');assert paused_state['elapsedMs']>=1000;assert paused_state==a.evaluate('phdDeck.presenter.getState().clock')
    paused=b.locator('#timer-display').inner_text();b.wait_for_timeout(1200);assert b.locator('#timer-display').inner_text()==paused;assert b.evaluate('presenterTest.getState().clock')==paused_state
    b.locator('#btn-reset').click();b.wait_for_function("document.getElementById('timer-display').textContent==='00:00'&&presenterTest.getState().clock.elapsedMs===0&&!presenterTest.getState().clock.running");a.wait_for_function('phdDeck.presenter.getState().clock.elapsedMs===0&&!phdDeck.presenter.getState().clock.running');checks.append(scheme+': timer starts on both windows, display advances, pause remains stable and reset is shared; input-key isolation')
    # Opening at the final slide must load Next too, so going back can reveal it.
    a.evaluate('phdDeck.go(17)');wait_pair(a,b,17);b.close();b=launch(a);assert b.locator('#iframe-nxt').get_attribute('src');b.locator('#btn-prev').click();wait_pair(a,b,16);assert b.locator('#iframe-nxt').is_visible();assert b.frame_locator('#iframe-nxt').locator('.slide.active').get_attribute('id')=='joint-decisions';checks.append(scheme+': last-slide reopen and Next recovery')
    # Two copies of the same deck remain separate.
    c=ctx.new_page();c.goto(url);c.wait_for_function('window.phdDeck');d=launch(c);assert a.evaluate('phdDeck.presenter.getState().sessionId')!=c.evaluate('phdDeck.presenter.getState().sessionId');d.locator('#btn-next').click();wait_pair(c,d,1);assert a.evaluate('phdDeck.getState().index')==16
    b.locator('#btn-prev').click();wait_pair(a,b,15);assert c.evaluate('phdDeck.getState().index')==1;d.close();c.close();checks.append(scheme+': same-file multi-open isolation')
    # Offline after all self-file frames load; all control messages stay local.
    ctx.set_offline(True);b.locator('#btn-next').click();wait_pair(a,b,16);b.screenshot(path=str(OUT/f'{scheme}-offline-speaker.png'),full_page=True);checks.append(scheme+': offline navigation with loaded single-file previews')
    ctx.set_offline(False);b.close();a.evaluate('window.__savedOpen=window.open;window.open=()=>null');a.locator('#presenter').click();assert a.locator('#live-status').is_visible();assert a.locator('#live-status').inner_text();a.evaluate('window.open=window.__savedOpen');checks.append(scheme+': visible popup-blocked recovery')
    a.locator('body').click(position={'x':3,'y':3})
    with a.expect_popup() as e:a.keyboard.press('s')
    b=e.value;b.wait_for_function('window.presenterTest&&presenterTest.getState().connected');a.close();b.wait_for_function("document.getElementById('sync-status').textContent.includes('Audience closed')");b.screenshot(path=str(OUT/f'{scheme}-audience-closed.png'),full_page=True);b.close();ctx.close();checks.append(scheme+': S shortcut and audience-close status')
   browser.close()
 finally:server.shutdown();server.server_close()
report={'html_sha256':hashlib.sha256(FILE.read_bytes()).hexdigest(),'checks':checks,'errors':errors,'external_requests':requests};(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False));assert not errors,errors;assert not requests,requests
