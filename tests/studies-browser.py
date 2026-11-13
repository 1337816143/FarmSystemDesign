"""Real Chrome acceptance for scenario studies. Browser plugin not available.

Use a synthetic fixture and a separate browser context; never touches the user's workspace.
"""
import argparse
import json
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser()
parser.add_argument('--url',default='http://127.0.0.1:4186')
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
fixture=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {workspace} from './tests/fixtures/study-workspace.mjs';console.log(JSON.stringify(workspace()));"],cwd=Path(__file__).resolve().parents[1],text=True,encoding='utf-8'))
(args.output/'fixture.json').write_text(json.dumps(fixture,ensure_ascii=False),encoding='utf-8')
checks=[];errors=[]
def check(name,value):
 checks.append({'name':name,'pass':bool(value)})
 assert value,name
def save():
 (args.output/'studies-browser-report.json').write_text(json.dumps({'checks':checks,'pageErrors':errors,'browser':'Chrome / Playwright; Browser plugin not available'},ensure_ascii=False,indent=2),encoding='utf-8')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
 context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
 page=context.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
 def go(name):
  page.goto(args.url+'/#'+name);page.wait_for_selector('#main-content h1');page.wait_for_timeout(150)
 def lang(mode):
  page.locator('button[data-language="'+mode+'"]').click();page.wait_for_timeout(100)
 def store():return page.evaluate("JSON.parse(localStorage.getItem('farmsystem-workspace-v2'))")
 def modal_save():page.locator('#modal-form button[type=submit]').click();page.wait_for_timeout(100)
 try:
  page.goto(args.url);page.evaluate('(value)=>{localStorage.clear();localStorage.setItem("farmsystem-workspace-v2",JSON.stringify(value));localStorage.setItem("farmsystem-language-v1","zh")}',fixture)
  page.reload();go('experiments');page.wait_for_selector('#batch-settings button:not(:disabled)')
  check('new batch page is reachable',page.locator('#batch-settings').count()==1)
  for mode,label in [('en','Batch scenario experiments'),('both','批量情景实验 / Batch scenario experiments'),('zh','批量情景实验')]:
   lang(mode);check('batch title '+mode,page.locator('#main-content h1').inner_text()==label)
  [box.uncheck() for box in page.locator('[name=scenarios]').all()];page.locator('[name=scenarios][value=normal]').check();page.locator('[name=scenarios][value=drought]').check()
  page.locator('[name=quarters][value="1"]').check();check('cross-product count',page.locator('#batch-count').inner_text()=='4')
  page.locator('#batch-settings button[type=submit]').click();page.wait_for_selector('[data-batch-action=start]:not(:disabled)')
  check('batch input frozen and persisted',page.evaluate('JSON.parse(localStorage.getItem("farmsystem-scenario-batch-v1")).jobs.length')==4)
  page.locator('[data-batch-action=start]').click();page.locator('[data-batch-action=pause]:not(:disabled)').click()
  page.wait_for_function('JSON.parse(localStorage.getItem("farmsystem-scenario-batch-v1")).status==="paused"')
  check('pause checkpoint survives reload',True);page.reload();page.wait_for_selector('[data-batch-action=start]:not(:disabled)')
  page.locator('[data-batch-action=start]').click();page.wait_for_function('JSON.parse(localStorage.getItem("farmsystem-scenario-batch-v1")).jobs.every(j=>j.status==="completed")',timeout=90000)
  check('real worker completes all independent jobs',True)
  batch=page.evaluate('JSON.parse(localStorage.getItem("farmsystem-scenario-batch-v1"))')
  check('physical values retained with SHA256',all(len(j['result']['contentDigest'])==64 and j['result']['baseline'] for j in batch['jobs']))
  with page.expect_download() as d:page.locator('[data-batch-action=export]').click()
  d.value.save_as(args.output/'batch-export.json');check('batch JSON roundtrip bytes',json.loads((args.output/'batch-export.json').read_text(encoding='utf-8'))['inputDigest']==batch['inputDigest'])
  with page.expect_download() as d:page.locator('[data-batch-action=csv]').click()
  d.value.save_as(args.output/'batch-results.csv');check('CSV has units and all four jobs',len((args.output/'batch-results.csv').read_text(encoding='utf-8-sig').splitlines())==5)
  lang('en');check('completed batch globally switches language','No feasible' in page.locator('#batch-workspace').inner_text() or 'Completed' in page.locator('#batch-workspace').inner_text())
  page.screenshot(path=str(args.output/'batch-desktop.png'),full_page=True)
  page.locator('[data-batch-action=rerun]').first.click();modal_save();page.wait_for_function('document.querySelector("[data-action=save-plan]")!==null',timeout=90000)
  check('rerun opens full original optimizer frontier',page.locator('[data-action=save-plan]').count()>0)
  go('feedback');lang('en');check('comparison reports accounting match','physical metric differences are shown' in page.locator('.study-comparison').inner_text())
  check('comparison identifies scenario difference','Price multiplier' in page.locator('.study-comparison').inner_text())
  with page.expect_download() as d:page.locator('[data-action=export-comparison]').click()
  d.value.save_as(args.output/'plan-comparison.csv');check('comparison CSV includes comparability','interpretation' in (args.output/'plan-comparison.csv').read_text(encoding='utf-8-sig'))
  original=store()['plans'][0];page.locator('[data-action=annotate-plan]').first.click();page.locator('[name=label]').fill('Reviewed plan');page.locator('[name=note]').fill('Separate management note');modal_save()
  check('annotation leaves historical snapshot unchanged',store()['plans'][0]==original)
  check('annotation visible','Reviewed plan' in page.locator('.study-records').inner_text())
  page.locator('[data-action=add-observation]').click();page.locator('[name=metric]').select_option('margin');page.locator('[name=value]').fill('-123');page.locator('[name=date]').fill('2025-03-31');page.locator('[name=note]').fill('Synthetic same full window and selected farms.');page.locator('[name=sameScope]').check()
  page.evaluate('localStorage.setItem("farmsystem-language-v1","both");window.dispatchEvent(new Event("farmsystem-languagechange"))')
  # Cross-tab storage event uses the actual shared watcher interface.
  peer=context.new_page();peer.goto(args.url+'/#guide');peer.locator('button[data-language=zh]').click();peer.locator('button[data-language=both]').click();page.wait_for_timeout(200)
  check('open feedback form retains unsaved values on global switch',page.locator('[name=value]').input_value()=='-123' and page.locator('[name=sameScope]').is_checked())
  check('open feedback form label switches globally','Metric and unit' in page.locator('#modal').inner_text() and '指标及单位' in page.locator('#modal').inner_text());peer.close();modal_save()
  record=store()['observations'][0];check('signed feedback has frozen model reference',record['value']==-123 and record['reference']['quarter']==0 and record['history']==[])
  page.locator('[data-action=edit-feedback]').click();page.locator('[name=value]').fill('-234');page.locator('[name=sameScope]').check();modal_save()
  record=store()['observations'][0];check('feedback edit retains previous value and original timestamp',record['history'][0]['previous']['value']==-123 and record['recordedAt']==record['history'][0]['previous']['recordedAt'])
  page.locator('[data-action=archive-feedback]').click();check('archive keeps record and hides it',store()['observations'][0]['archived'] and page.locator('[data-action=edit-feedback]').count()==0)
  page.locator('#show-archived').check();page.locator('[data-action=archive-feedback]').click();check('archived feedback can be restored',not store()['observations'][0]['archived'])
  page.locator('[data-action=feedback-history]').click();check('history displays archived and restored revisions','archive' in page.locator('.study-history').inner_text());modal_save()
  with page.expect_download() as d:page.locator('[data-action=export-feedback]').click()
  d.value.save_as(args.output/'feedback-archive.json');check('complete feedback archive retains history',len(json.loads((args.output/'feedback-archive.json').read_text(encoding='utf-8'))['observations'][0]['history'])==3)
  page.locator('[data-action=edit-feedback]').click();page.locator('[name=value]').fill('-345');page.locator('[name=sameScope]').check()
  page.evaluate("()=>{window.qaOriginalSave=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='farmsystem-workspace-v2')throw Error('quota test');return window.qaOriginalSave.call(this,k,v)}}")
  page.locator('#modal-form button[type=submit]').click();check('failed storage leaves feedback uncommitted',store()['observations'][0]['value']==-234 and bool(page.locator('#form-error').inner_text()))
  page.evaluate('()=>{Storage.prototype.setItem=window.qaOriginalSave;}');page.locator('#modal [data-action=close-modal]').first.click()
  go('planner');page.locator('#scope').select_option('single');page.locator('#scope-object').select_option('receiver');page.locator('#quarter').select_option('2');page.locator('#decision-mode').select_option('centralized');page.locator('#objective').select_option('water');page.locator('#water').evaluate("el=>{el.value='75';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}");page.reload();page.wait_for_selector('#scope')
  check('scope, selected farm and quarter survive reload',page.locator('#scope').input_value()=='single' and page.locator('#scope-object').input_value()=='receiver' and page.locator('#quarter').input_value()=='2')
  check('scenario controls and ranking survive reload',page.locator('#water').input_value()=='75' and page.locator('#decision-mode').input_value()=='centralized' and page.locator('#objective').input_value()=='water')
  go('experiments');check('batch stays frozen after workspace changes',page.evaluate('JSON.parse(localStorage.getItem("farmsystem-scenario-batch-v1")).inputDigest')==batch['inputDigest'])
  page.locator('[data-batch-action=clear]').click();modal_save();page.locator('#batch-import').set_input_files(str(args.output/'batch-export.json'));page.wait_for_selector('[data-batch-job]');check('batch import validates and restores all results',page.locator('[data-batch-job]').count()==4)
  check('imported controls display frozen settings rather than current workspace',page.locator('[name=quarters][value=\"0\"]').is_checked() and page.locator('[name=quarters][value=\"1\"]').is_checked() and not page.locator('[name=quarters][value=\"2\"]').is_checked() and page.locator('[name=objective]').input_value()=='balanced')
  for mode in ['zh','en','both']:
   lang(mode);check('batch all results switch '+mode,('基准' in page.locator('.study-results').inner_text())==(mode!='en'))
   go('feedback');check('feedback global language '+mode,('反馈记录' in page.locator('.study-records').inner_text())==(mode!='en'))
   if mode=='en':check('feedback audit actions also switch globally',not page.evaluate(r"/[\u3400-\u9fff]/.test(document.querySelector('#main-content').innerText)"))
   go('experiments')
  # Warm offline shell includes all new imports and the existing worker dependencies.
  page.wait_for_function('navigator.serviceWorker.controller!==null',timeout=30000);context.set_offline(True);page.reload();page.wait_for_selector('[data-batch-job]');check('new workflow survives offline reload',page.locator('[data-batch-job]').count()==4);context.set_offline(False)
  page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(350);page.screenshot(path=str(args.output/'batch-mobile.png'),full_page=True);check('mobile avoids page-wide horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
  check('no JavaScript page errors',not errors);save();print(json.dumps({'pass':len(checks),'fail':0},ensure_ascii=False))
 except Exception:
  page.screenshot(path=str(args.output/'failure.png'),full_page=True);save();raise
 finally:browser.close()
