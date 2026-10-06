"""Actual browser QA for own, offline single-file presenter windows.
Run only in an authorised browser environment. Exercises both file:// and local HTTP.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
import tempfile,shutil,json,sys,os,time,hashlib
ROOT=Path(__file__).resolve().parents[1]
FILE=Path(sys.argv[1] if len(sys.argv)>1 else ROOT/'PhD2-Hainan-Joint-Discussion-candidate.html').resolve()
OUT=Path(sys.argv[2] if len(sys.argv)>2 else ROOT/'qa/presenter-browser').resolve();OUT.mkdir(parents=True,exist_ok=True)
checks=[];page_errors=[];external=[]
def passed(s):checks.append(s)
def state(page):return page.evaluate('phdDeck.getState()')
def open_presenter(page):
 with page.expect_popup() as event:page.locator('#presenter').click()
 popup=event.value;popup.wait_for_function('window.presenterTest && presenterTest.getState().ready',timeout=30000);page.wait_for_function('phdDeck.presenter.getState().ready');return popup
def wait_index(page,popup,n):
 page.wait_for_function('n=>phdDeck.getState().index===n',arg=n);popup.wait_for_function('n=>presenterTest.getState().index===n',arg=n)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
with tempfile.TemporaryDirectory(prefix='hainan-presenter-qa-') as td:
 work=Path(td);shutil.copyfile(FILE,work/'deck-a.html');shutil.copyfile(FILE,work/'deck-b.html');(work/'neutral.html').write_text('<!doctype html><html><head><title>Neutral test document</title></head><body>Neutral test document</body></html>')
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(work)));Thread(target=server.serve_forever,daemon=True).start()
 urls={'file':(work/'deck-a.html').as_uri(),'http':f'http://127.0.0.1:{server.server_port}/deck-a.html'}
 try:
  with sync_playwright() as p:
   args={'headless':True}
   if os.getenv('CHROMIUM_EXECUTABLE'):args['executable_path']=os.environ['CHROMIUM_EXECUTABLE']
   browser=p.chromium.launch(**args)
   for scheme,url in urls.items():
    ctx=browser.new_context(viewport={'width':1440,'height':900})
    ctx.on('page',lambda pg:pg.on('pageerror',lambda e:page_errors.append(str(e))))
    page=ctx.new_page();page.on('request',lambda r:external.append(r.url) if r.url.startswith(('https://','http://')) and not r.url.startswith('http://127.0.0.1:') else None)
    page.goto(url);page.wait_for_function('window.phdDeck');popup=open_presenter(page)
    popup.set_viewport_size({'width':1440,'height':1000});popup.wait_for_timeout(700)
    assert popup.locator('#current-frame').count()==1 and popup.locator('#next-frame').count()==1
    assert len(popup.locator('#transcript').input_value())>100
    assert not page.locator('.notes-copy:visible').count()
    assert 'Speaking script' not in page.locator('body').inner_text()
    popup.screenshot(path=str(OUT/f'{scheme}-speaker-initial.png'),full_page=True);page.screenshot(path=str(OUT/f'{scheme}-audience-initial.png'),full_page=True)
    passed(scheme+': distinct current/next previews and current manuscript; audience contains no visible manuscript')
    # Parent-to-child and child-to-parent navigation, including keyboard.
    page.locator('#next').click();wait_index(page,popup,1)
    popup.locator('#speaker-next').click();wait_index(page,popup,2)
    popup.locator('#speaker-prev').click();wait_index(page,popup,1)
    popup.locator('#slide-select').select_option('16');wait_index(page,popup,16)
    popup.locator('#speaker-language').select_option('zh');page.wait_for_function("phdDeck.getState().language==='zh'");popup.wait_for_function("presenterTest.getState().language==='zh'")
    assert '我' in popup.locator('#transcript').input_value()
    popup.screenshot(path=str(OUT/f'{scheme}-speaker-zh-slide17.png'),full_page=True)
    passed(scheme+': bidirectional page/language synchronisation')
    # Text entry and arrows do not navigate or create another popup.
    original=popup.locator('#transcript').input_value();popup.locator('#transcript').fill(original+'\nSESSION EDIT s S');popup.locator('#transcript').press('ArrowLeft');popup.locator('#transcript').press('ArrowRight');popup.wait_for_timeout(500);assert state(page)['index']==16;assert len(ctx.pages)==2
    popup.locator('#speaker-next').click();wait_index(page,popup,17);popup.locator('#speaker-prev').click();wait_index(page,popup,16);assert 'SESSION EDIT' in popup.locator('#transcript').input_value()
    passed(scheme+': text shortcuts isolated; manuscript session edits survive page changes')
    popup.locator('#transcript').fill(popup.locator('#transcript').input_value()+' CLOSE ACK')
    with popup.expect_event('close'):popup.locator('#speaker-close').click()
    popup=open_presenter(page);assert 'CLOSE ACK' in popup.locator('#transcript').input_value()
    passed(scheme+': explicit Close waits for the latest manuscript ACK')
    # Duplicate command IDs apply once. Old/fake session messages are rejected.
    page.evaluate('phdDeck.go(0)');wait_index(page,popup,0)
    popup.evaluate("""()=>{const b=window.__PRESENTER_BOOTSTRAP__;const m={protocol:'hainan-presenter-v1',deckId:b.deckId,sessionId:b.sessionId,peerToken:b.peerToken,type:'COMMAND',payload:{commandId:b.peerToken+':duplicate-test',action:'NEXT',args:{}}};window.presenterTest.sendRaw(m);window.presenterTest.sendRaw(m)}""")
    wait_index(page,popup,1);popup.wait_for_timeout(200);assert state(page)['index']==1
    popup.evaluate("""()=>{const b=window.__PRESENTER_BOOTSTRAP__;window.presenterTest.sendRaw({protocol:'hainan-presenter-v1',deckId:b.deckId,sessionId:'wrong-session',peerToken:b.peerToken,type:'COMMAND',payload:{commandId:'forged',action:'LAST',args:{}}})}""")
    popup.wait_for_timeout(200);assert state(page)['index']==1
    passed(scheme+': duplicate command de-duplication and invalid-session rejection')
    popup.evaluate("presenterTest.command('SET_MANUSCRIPT',{index:1,language:'zh',text:'x'.repeat(50001)})")
    popup.wait_for_function("document.getElementById('connection').classList.contains('bad')")
    assert popup.locator('#transcript').get_attribute('maxlength')=='50000'
    before_text=popup.locator('#transcript').input_value();popup.locator('#transcript').fill(before_text);popup.wait_for_timeout(400)
    passed(scheme+': oversized script receives visible NACK rather than silent success')
    # Clock survives presenter close/reopen and can pause/reset.
    popup.locator('#timer-toggle').click();page.wait_for_function('phdDeck.presenter.getState().clock.running');popup.wait_for_timeout(1150);assert popup.locator('#elapsed').inner_text()!='00:00'
    peer_before=page.evaluate('phdDeck.presenter.getState().peerToken');popup.close();page.wait_for_function('!phdDeck.presenter.getState().windowOpen');popup=open_presenter(page);assert page.evaluate('phdDeck.presenter.getState().peerToken')!=peer_before;assert popup.locator('#elapsed').inner_text()!='00:00'
    popup.locator('#timer-toggle').click();page.wait_for_function('!phdDeck.presenter.getState().clock.running');paused=popup.locator('#elapsed').inner_text();popup.wait_for_timeout(650);assert popup.locator('#elapsed').inner_text()==paused
    popup.locator('#timer-reset').click();popup.wait_for_function("document.getElementById('elapsed').textContent==='00:00'")
    popup.locator('#slide-select').select_option('16');wait_index(page,popup,16);assert 'SESSION EDIT' in popup.locator('#transcript').input_value()
    passed(scheme+': close/reopen uses fresh peer; timer and manuscript session state retained')
    # Same file opened twice cannot cross-control even though pathname is identical.
    other=ctx.new_page();other.goto(url);other.wait_for_function('window.phdDeck');other_popup=open_presenter(other)
    assert page.evaluate('phdDeck.presenter.getState().sessionId')!=other.evaluate('phdDeck.presenter.getState().sessionId')
    other_popup.locator('#speaker-next').click();wait_index(other,other_popup,1);assert state(page)['index']==16
    popup.locator('#speaker-prev').click();wait_index(page,popup,15);assert state(other)['index']==1
    # A second distinct deck path is likewise isolated.
    another=ctx.new_page();another.goto(url.replace('deck-a.html','deck-b.html'));another.wait_for_function('window.phdDeck');another_popup=open_presenter(another);another_popup.locator('#speaker-next').click();wait_index(another,another_popup,1);assert state(page)['index']==15 and state(other)['index']==1
    passed(scheme+': same-file multi-open and different-deck isolation')
    another_popup.close();another.close();other_popup.close();other.close()
    # Popup-blocked branch is observable and does not expose notes in audience.
    popup.close();page.wait_for_function('!phdDeck.presenter.getState().windowOpen');page.evaluate('window.__realOpen=window.open;window.open=()=>null');page.locator('#presenter').click();assert page.locator('#live-status').is_visible();assert page.locator('#live-status').inner_text();assert not page.locator('.notes-copy:visible').count();page.evaluate('window.open=window.__realOpen')
    passed(scheme+': simulated popup blocking produces a visible recovery message')
    # S shortcut opens; presenter can work offline with no runtime requests.
    page.locator('body').click(position={'x':3,'y':3})
    with page.expect_popup() as event:page.keyboard.press('s')
    popup=event.value;popup.wait_for_function('window.presenterTest && presenterTest.getState().ready');ctx.set_offline(True);popup.locator('#speaker-next').click();wait_index(page,popup,16);popup.screenshot(path=str(OUT/f'{scheme}-speaker-offline.png'),full_page=True)
    passed(scheme+': S shortcut and disconnected operation')
    # Navigation of the existing presenter WindowProxy does not receive note/slide payloads.
    ctx.set_offline(False);popup.goto(url.replace('deck-a.html','neutral.html'));popup.evaluate("window.received=[];window.addEventListener('message',e=>window.received.push(e.data))")
    page.evaluate('phdDeck.go(0)');popup.wait_for_timeout(300);assert popup.evaluate('window.received.length')==0
    popup.close();page.wait_for_function('!phdDeck.presenter.getState().windowOpen');popup=open_presenter(page)
    passed(scheme+': navigating the presenter away cannot receive slide or manuscript STATE')
    # Audience loss does not misreport connected status.
    page.close();popup.wait_for_function('!presenterTest.getState().connected');assert popup.locator('#connection').inner_text();popup.screenshot(path=str(OUT/f'{scheme}-audience-closed.png'),full_page=True);popup.close();ctx.close();passed(scheme+': audience-close recovery status')
   browser.close()
 finally:server.shutdown();server.server_close()
report={'html_sha256':hashlib.sha256(FILE.read_bytes()).hexdigest(),'checks':checks,'page_errors':page_errors,'external_runtime_requests':external,'passed':not page_errors and not external};(OUT/'presenter-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False));assert not page_errors,page_errors;assert not external,external
