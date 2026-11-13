"""Exercise the actual original menu, setting dialogs, outputs and optimization UI."""
from pathlib import Path
import argparse,concurrent.futures,json,time,urllib.request,urllib.error,base64,hashlib
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--url',required=True);parser.add_argument('--output',required=True,type=Path);args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
def call(op,**body):
 try:return json.load(urllib.request.urlopen(urllib.request.Request(args.url.rstrip('/')+'/api/farmdesign/'+op,data=json.dumps(body).encode(),headers={'Content-Type':'application/json'}),timeout=120))
 except urllib.error.HTTPError as e:raise RuntimeError(e.read().decode())
doc=json.loads((ROOT/'data/farmdesign/author-cases-2019.json').read_text(encoding='utf-8'))['cases'][0];doc['optimization']['settings'].update(MultiFactor=8,Generations=2)
s=call('original/start',document=doc,mode='browser');sid=s['id'];checks=[];pool=concurrent.futures.ThreadPoolExecutor(max_workers=4)
def frame():return call('original/frame',sessionId=sid,picture=False)
def action(**event):return call('original/action',sessionId=sid,event=event)
def check(ok,message):
 if not ok:raise AssertionError(message)
 checks.append(message);print('PASS',message,flush=True)
def wait(predicate):
 end=time.monotonic()+30
 while time.monotonic()<end:
  f=frame()
  if predicate(f):return f
  time.sleep(.15)
 raise AssertionError([(w['title'],len(w['controls'])) for w in f['windows']])
def items(f):
 def walk(item):
  yield item
  for child in item.get('children',[]):yield from walk(child)
 for w in f['windows']:
  for c in w['controls']:
   for item in c.get('items',[]):yield from walk(item)
def menu(name):
 item=next(i for i in items(frame()) if i['name']==name);return pool.submit(action,action='menu',item=item['id'])
def close(window):
 action(action='window-close',window=window['id'])
 end=time.monotonic()+5
 while time.monotonic()<end:
  f=frame()
  if not any(w['id']==window['id'] for w in f['windows']):return
  confirm=next((w for w in f['windows'] if w['id']!=window['id'] and not w['main'] and w['state']=='native'),None)
  if confirm:
   button=next((c for c in confirm['controls'] if c['type']=='Button' and c['text'].replace('&','') in ['OK','Yes','确定','是']),None)
   if button:
    b=button['bounds'];action(action='click',window=confirm['id'],x=b[0]+b[2]//2,y=b[1]+b[3]//2)
  time.sleep(.1)
wait(lambda f:f['farmId']==79)
features={i['name'] for i in items(frame())}
for name in ['toolStripMenuItemExportFarm','toolStripMenuItemExportRepository','toolStripMenuItemImportFarm','toolStripMenuItemImportRepository','toolStripMenuItemImportTextData','toolStripButtonRepository','toolStripButtonNotes','toolStripButtonPhoto','menuItemAnalyser']:
 check(name in features,'Original menu available: '+name)
for name,kind in [('menuItemModules','modules'),('menuItemFeedEvaluation','feed'),('menuItemEnergyProd','energy'),('menuItemHumanNutrition','nutrition'),('menuItemGHG','ghg'),('menuItemFunctionalDiversity','nfd'),('menuItemNetworkMetricsType','networks'),('toolStripButtonRepository','repository'),('toolStripButtonTextImport','text-import'),('toolStripButtonNotes','notes')]:
 if kind=='notes':
  tree=next(c for w in frame()['windows'] for c in w['controls'] if 'nodes' in c);action(action='tree',node=tree['nodes'][1]['id']);action(action='tree',node=tree['nodes'][0]['id'])
  menu(name).result(timeout=15);f=frame();tabs=next(c for w in f['windows'] for c in w['controls'] if any(t['text']=='Notes' for t in c.get('tabs',[])));tab=next(t for t in tabs['tabs'] if t['text']=='Notes');action(action='tab',control=tabs['id'],index=tab['index']);f=frame();text=next(c for w in f['windows'] for c in w['controls'] if c.get('multiline') and c.get('editable'));action(action='value',control=text['id'],value='Original-interface acceptance note; software test only');snapshot=call('original/snapshot',sessionId=sid)['document'];check(any('acceptance note' in row['NoteText'] for row in snapshot['auxiliaryTables']['NTE']),'Original Notes tab writes the actual NTE table');continue
 pending=menu(name);f=wait(lambda f:len(f['windows'])>1);window=f['windows'][0]
 check(bool(window['controls']),'Actual author dialog opens: '+kind)
 (args.output/(kind+'.json')).write_text(json.dumps(window,ensure_ascii=False,indent=2),encoding='utf-8')
 close(window);pending.result(timeout=15);wait(lambda f:len(f['windows'])==1)
pending=menu('menuItemExplain');f=wait(lambda f:any(w['title']=='Explain' for w in f['windows']));pending.result(timeout=15)
window=next(w for w in f['windows'] if w['title']=='Explain');tabs=next(c for c in window['controls'] if c.get('tabs'));check(len(tabs['tabs'])==19,'All 19 original Explain modules are present')
for tab in tabs['tabs']:
 action(action='tab',control=tabs['id'],index=tab['index']);f=frame();w=next(w for w in f['windows'] if w['id']==window['id']);check(any(c['type'].startswith('Output') and c['type']!='OutputForm' for c in w['controls']),'Original output page renders: '+tab['text'])
close(window);wait(lambda f:len(f['windows'])==1)
pending=menu('menuItemEvaluate');f=wait(lambda f:any(w['title']=='Evaluate' for w in f['windows']));pending.result(timeout=15);window=next(w for w in f['windows'] if w['title']=='Evaluate');check(any(c['type'].startswith('Output') or c.get('cells') for c in window['controls']),'Original Evaluate shows actual decision variables and constraints');close(window);wait(lambda f:len(f['windows'])==1)
pending=menu('menuItemExplore');f=wait(lambda f:len(f['windows'])>1)
(args.output/'explore.json').write_text(json.dumps(f,ensure_ascii=False,indent=2),encoding='utf-8')
window=f['windows'][0]
if window['title']=='Not ready for exploration':
 check(any('Switch off network metrics' in c['text'] for c in window['controls']),'Original exploration retains its network-calculation prerequisite')
 button=next(c for c in window['controls'] if c['type']=='Button');b=button['bounds'];action(action='click',window=window['id'],x=b[0]+b[2]//2,y=b[1]+b[3]//2);pending.result(timeout=15)
 pending=menu('menuItemNetworkMetricsType');f=wait(lambda f:len(f['windows'])>1);w=f['windows'][0]
 for name in ['radioButton_None','button_OK']:
  c=next(c for c in w['controls'] if c['name']==name);b=c['bounds'];action(action='click',window=w['id'],x=b[0]+b[2]//2,y=b[1]+b[3]//2)
 pending.result(timeout=15);pending=menu('menuItemExplore');f=wait(lambda f:len(f['windows'])>1);window=f['windows'][0]
check('Explore' in window['title'],'Original Explore window opens');pending.result(timeout=15)
run=next((i for i in items(f) if i['name']=='toolStripButtonRun'),None)
if run:
 iterations=next(c for w in f['windows'] if w['id']==window['id'] for c in w['controls'] if c['type']=='ToolStripTextBoxControl');action(action='value',control=iterations['id'],value='2')
 action(action='menu',item=run['id']);time.sleep(.5);f=frame();(args.output/'after-native-run.json').write_text(json.dumps(f,ensure_ascii=False,indent=2),encoding='utf-8');check(not f.get('warning') and any(c['type']=='ProgressBar' and c.get('value')==c.get('maximum')==2 for w in f['windows'] for c in w['controls']),'Original Explore Run completes both requested iterations without adapter errors')
close(window)
for _ in range(12):
 f=frame()
 if len(f['windows'])==1:break
 top=f['windows'][0];choice=next((c for c in top['controls'] if c['type']=='ListBox'),None)
 if choice:action(action='value',control=choice['id'],index=0);action(action='control-double',control=choice['id'])
 else:close(top)
wait(lambda f:len(f['windows'])==1)
files=call('original/files',sessionId=sid)['files'];manual=next(file for file in files if file['path'].startswith('Docs/') and file['path'].endswith('.pdf'));data=call('original/file',sessionId=sid,path=manual['path']);check(hashlib.sha256(base64.b64decode(data['base64'])).hexdigest()==data['sha256'],'Original manual download has a matching content hash')
export=call('original/export',sessionId=sid);check(hashlib.sha256(base64.b64decode(export['base64'])).hexdigest()==export['sha256'],'Complete original session export has a matching content hash')
call('original/switch',sessionId=sid,mode='desktop');wait(lambda f:f['farmId']==79);check(call('original/status',sessionId=sid)['mode']=='desktop','Actual original desktop window opens with the same project')
call('original/switch',sessionId=sid,mode='browser');wait(lambda f:f['farmId']==79);check(call('original/status',sessionId=sid)['mode']=='browser','Desktop session switches back to browser')
call('original/end',sessionId=sid);pool.shutdown()
(args.output/'checks.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'session':s},ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'passed':len(checks)}))
