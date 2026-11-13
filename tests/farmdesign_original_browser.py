"""Real browser + original author forms, including database writes and input pull.

Run against tools/serve.py or a clean portable copy. No mocks or replacement model.
"""
from pathlib import Path
import argparse,concurrent.futures,copy,json,math,time,urllib.request,urllib.error
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',default='http://127.0.0.1:4173/')
parser.add_argument('--output',required=True,type=Path)
parser.add_argument('--session')
args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
checks=[];sessions=[]
def check(condition,message):
 if not condition:raise AssertionError(message)
 checks.append(message);print('PASS',message,flush=True)
def call(operation,**body):
 req=urllib.request.Request(args.url.rstrip('/')+'/api/farmdesign/'+operation,data=json.dumps(body).encode(),headers={'Content-Type':'application/json'})
 try:return json.load(urllib.request.urlopen(req,timeout=120))
 except urllib.error.HTTPError as e:raise RuntimeError(e.read().decode())
def wait_frame(sid,predicate):
 end=time.monotonic()+30
 while time.monotonic()<end:
  frame=call('original/frame',sessionId=sid,picture=False)
  if predicate(frame):return frame
  time.sleep(.15)
 raise AssertionError('Original window did not reach expected state: '+str([(w['title'],len(w['controls'])) for w in frame['windows']]))
def flatten(value,path=''):
 if isinstance(value,dict):
  for key,item in value.items():yield from flatten(item,path+'.'+key)
 elif isinstance(value,list):
  for key,item in enumerate(value):yield from flatten(item,path+'['+str(key)+']')
 else:yield path,value
catalog=json.loads((ROOT/'data/farmdesign/author-cases-2019.json').read_text(encoding='utf-8'))
for index,source in enumerate(catalog['cases']):
 document=copy.deepcopy(source);document['optimization']['settings'].update(MultiFactor=8,Generations=2)
 session=call('original/status',sessionId=args.session) if index==0 and args.session else call('original/start',document=document,mode='browser')
 sid=session['id'];sessions.append(session)
 wait_frame(sid,lambda f:f['farmId']==document['farmId'] and not f['initializing'])
 snapshot=call('original/snapshot',sessionId=sid)['document'];gui=call('original/results',sessionId=sid);headless=call('evaluate',document=snapshot)
 left=dict(flatten(gui['modules']));right=dict(flatten(headless['modules']));mismatches=[]
 for key,x in left.items():
  y=right.get(key)
  same=math.isclose(x,y,rel_tol=1e-10,abs_tol=1e-10) if type(x) in {int,float} and type(y) in {int,float} else x==y
  if not same:mismatches.append([key,x,y])
 check(len(gui['modules'])==20 and not mismatches,f"Case {source['farmId']}: 20 modules, {len(left)} leaves equal to actual GUI model")
 for table in ['NTE','PHO','VRS']:check(snapshot['auxiliaryTables'][table]==document['auxiliaryTables'][table],f"Case {source['farmId']}: {table} preserved")
 check(snapshot['optimization']['displayVariables']==document['optimization']['displayVariables'],f"Case {source['farmId']}: original chart axis references retained")
 (args.output/f"parity-{source['farmId']}.json").write_text(json.dumps({'leaves':len(left),'mismatches':mismatches,'session':session},ensure_ascii=False,indent=2),encoding='utf-8')
 if index==0:base=document;reference=gui;first=session
 else:call('original/end',sessionId=sid)

sid=first['id'];before=call('original/snapshot',sessionId=sid)['document']
(args.output/'sessions.json').write_text(json.dumps(sessions,ensure_ascii=False,indent=2),encoding='utf-8')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
 context=browser.new_context(viewport={'width':1600,'height':1120})
 context.add_init_script('localStorage.setItem("farmsystem-language-v1","en");localStorage.setItem("farmsystem-farmdesign-native-v1",'+json.dumps(json.dumps({'document':base,'plans':[],'originalSession':first}))+');')
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(args.url.rstrip('/')+'/#farmdesign');page.wait_for_selector('[data-fd-tab=original]')
 # Portable folder storage intentionally overrides pre-page browser storage.
 # Seed through its installed Storage API, then restore the actual saved project.
 page.evaluate('(value)=>{localStorage.setItem("farmsystem-language-v1","en");localStorage.setItem("farmsystem-farmdesign-native-v1",value);}',json.dumps({'document':base,'plans':[],'originalSession':first}))
 page.reload();page.locator('[data-fd-tab=original]').click()
 page.wait_for_function('document.querySelector(".fd-original-surface img")?.naturalWidth>100',timeout=60000)
 def click_native(control):
  bounds=control['bounds'];box=page.locator('.fd-original-surface img').bounding_box();width=page.locator('.fd-original-surface img').evaluate('e=>e.naturalWidth')
  page.locator('.fd-original-surface img').click(position={'x':(bounds[0]+min(bounds[2]/2,30))*box['width']/width,'y':(bounds[1]+bounds[3]/2)*box['width']/width})
 frame=wait_frame(sid,lambda f:any(c.get('nativeProperty')=='Description' for w in f['windows'] for c in w['controls']))
 main=next(w for w in frame['windows'] if w['main']);page.locator('#fd-original-window').select_option(main['id'])
 field=next(c for c in main['controls'] if c.get('nativeProperty')=='Description')
 click_native(field);editor=page.locator('.fd-original-editor input');editor.fill(base['tables']['FRM'][0]['Description']+'_browser_edit');editor.press('Enter')
 wait_frame(sid,lambda f:any(c.get('nativeProperty')=='Description' and c['text'].endswith('_browser_edit') for w in f['windows'] for c in w['controls']))
 snapshot=call('original/snapshot',sessionId=sid)['document']
 end=time.monotonic()+15
 while not snapshot['tables']['FRM'][0]['Description'].endswith('_browser_edit') and time.monotonic()<end:
  time.sleep(.15);snapshot=call('original/snapshot',sessionId=sid)['document']
 check(snapshot['tables']['FRM'][0]['Description'].endswith('_browser_edit'),'Browser text edit reaches the actual original database')
 tree=next(c for c in main['controls'] if 'nodes' in c);economic=next(n for n in tree['nodes'] if n['text'].startswith('Economics'))
 call('original/action',sessionId=sid,event={'action':'tree','node':economic['id']})
 frame=wait_frame(sid,lambda f:any(c.get('nativeProperty')=='GeneralCosts' for w in f['windows'] for c in w['controls']))
 field=next(c for w in frame['windows'] for c in w['controls'] if c.get('nativeProperty')=='GeneralCosts')
 old=before['tables']['ECN'][0]['GeneralCosts'];time.sleep(.8);click_native(field);editor=page.locator('.fd-original-editor input');editor.fill(str(old+1000));editor.press('Enter')
 end=time.monotonic()+15
 while time.monotonic()<end:
  snapshot=call('original/snapshot',sessionId=sid)['document']
  if snapshot['tables']['ECN'][0]['GeneralCosts']==old+1000:break
  time.sleep(.15)
 check(snapshot['tables']['ECN'][0]['GeneralCosts']==old+1000,'Browser numeric edit is persisted by the original ModifiedChanged handler')
 result=call('original/results',sessionId=sid)
 check(math.isclose(reference['modules']['Budget']['FreeBudget']-result['modules']['Budget']['FreeBudget'],1000,abs_tol=1e-6),'Edited original cost changes the actual original budget by 1000')
 # Restore costs before testing global presentation; presentation must not change inputs.
 frame=call('original/frame',sessionId=sid,picture=False);field=next(c for w in frame['windows'] for c in w['controls'] if c.get('nativeProperty')=='GeneralCosts')
 call('original/action',sessionId=sid,event={'action':'value','control':field['id'],'value':str(old)})
 clean=copy.deepcopy(before['tables']);clean['FRM'][0]['Description']=base['tables']['FRM'][0]['Description']+'_browser_edit'
 end=time.monotonic()+15
 while call('original/snapshot',sessionId=sid)['document']['tables']!=clean and time.monotonic()<end:time.sleep(.15)
 (args.output/'expected-tables.json').write_text(json.dumps(clean,ensure_ascii=False,indent=2),encoding='utf-8')
 for language,title in [('zh','输入描述'),('both','输入描述 / Describe'),('en','Describe')]:
  page.locator('[data-language='+language+']').click()
  wait_frame(sid,lambda f:any(w['main'] and w['title']==title for w in f['windows']))
  page.wait_for_function('(title)=>[...document.querySelector("#fd-original-window").options].some(o=>o.text===title)',arg=title)
  actual=call('original/snapshot',sessionId=sid)['document']['tables'];(args.output/('tables-'+language+'.json')).write_text(json.dumps(actual,ensure_ascii=False,indent=2),encoding='utf-8')
  check(actual==clean,'Global '+language+' changes actual original captions without changing input values')
  page.screenshot(path=str(args.output/('original-'+language+'.png')),full_page=True)
 page.locator('[data-original=pull]').click();page.wait_for_selector('[data-fd-field=Name]',timeout=30000)
 saved=json.loads(page.evaluate('localStorage.getItem("farmsystem-farmdesign-native-v1")'))
 check(saved['document']['tables']['FRM'][0]['Description'].endswith('_browser_edit'),'Pull original inputs updates the modern project')
 check(bool(list((Path(first['sessionFolder'])/'WebBeforePull').glob('*.json'))),'Previous modern inputs are backed up before pull')
 check(not errors,'No browser JavaScript errors in original interface workflows')
 browser.close()
call('original/end',sessionId=sid)
call('original/switch',sessionId=sid,mode='browser')
restored=wait_frame(sid,lambda f:f['farmId']==base['farmId'])
check(call('original/snapshot',sessionId=sid)['document']['tables']['FRM'][0]['Description'].endswith('_browser_edit'),'Closed original session restores edited database inputs')
call('original/end',sessionId=sid)
(args.output/'checks.json').write_text(json.dumps({'checks':checks,'count':len(checks)},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':len(checks),'output':str(args.output)},ensure_ascii=False))
