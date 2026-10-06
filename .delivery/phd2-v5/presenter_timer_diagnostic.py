"""Observe the failed real-browser timer sequence without changing the HTML."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import sys,os,json,hashlib
f=Path(sys.argv[1]).resolve();out=Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=True)
records=[];events=[]
with sync_playwright() as p:
 opts={'headless':True}
 if os.getenv('CHROMIUM_EXECUTABLE'):opts['executable_path']=os.environ['CHROMIUM_EXECUTABLE']
 browser=p.chromium.launch(**opts);ctx=browser.new_context(viewport={'width':1440,'height':1000})
 ctx.on('page',lambda x:x.on('pageerror',lambda e:events.append(str(e))))
 a=ctx.new_page();a.goto(f.as_uri());a.wait_for_function('window.phdDeck')
 with a.expect_popup() as pop:a.locator('#presenter').click()
 b=pop.value;b.wait_for_function('window.presenterTest&&presenterTest.getState().connected');b.set_viewport_size({'width':1440,'height':1000});b.wait_for_function('presenterTest.getState().previews.current&&presenterTest.getState().previews.next')
 # Replay navigation/language/input focus immediately preceding the observed failure.
 a.locator('#presenter').click();a.locator('#next').click();b.wait_for_function('presenterTest.getState().index===1')
 b.locator('#btn-next').click();a.wait_for_function('phdDeck.getState().index===2');b.locator('#btn-prev').click();a.wait_for_function('phdDeck.getState().index===1')
 b.locator('#speaker-language').select_option('zh');a.wait_for_function("phdDeck.getState().language==='zh'");a.evaluate('phdDeck.go(16)');b.wait_for_function('presenterTest.getState().index===16')
 b.locator('#speaker-language').focus();b.locator('#speaker-language').press('ArrowLeft')
 def sample(label):
  records.append({'label':label,'audience':a.evaluate('({state:phdDeck.presenter.getState(),now:Date.now(),visibility:document.visibilityState,focus:document.hasFocus()})'),'presenter':b.evaluate("({state:presenterTest.getState(),now:Date.now(),visibility:document.visibilityState,focus:document.hasFocus(),display:document.getElementById('timer-display').textContent,button:document.getElementById('btn-pause').textContent})")})
 sample('before-click')
 for phase in ['original-focus','explicit-presenter-focus']:
  if phase=='explicit-presenter-focus':b.bring_to_front();b.locator('#btn-reset').click();b.wait_for_timeout(100)
  b.locator('#btn-pause').click();sample(phase+'-0ms')
  for delay,label in [(300,'300ms'),(900,'1200ms'),(1000,'2200ms')]:b.wait_for_timeout(delay);sample(phase+'-'+label)
  b.screenshot(path=str(out/(phase+'.png')),full_page=True)
  b.locator('#btn-pause').click();sample(phase+'-paused');b.wait_for_timeout(1200);sample(phase+'-paused-1200ms')
 b.locator('#btn-reset').click();sample('reset')
 result={'html_sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'browser':browser.version,'records':records,'events':events}
 (out/'timer-diagnostic.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False));browser.close()
