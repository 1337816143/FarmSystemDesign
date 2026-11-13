"""Persistent, project-isolated sessions of the author's actual Windows forms.

Browser sessions have a private Windows desktop. Only their own windows are drawn;
no host-desktop screenshots, global mouse input, remote services or new runtimes.
"""
from pathlib import Path
from queue import Queue, Empty
import base64
import ctypes
import hashlib
import io
import json
import os
import socket
import shutil
import subprocess
import sys
import threading
import time
import uuid
import zipfile
import xml.etree.ElementTree as ET

PREFIX='@@FARMUI@@'
ROOT=Path(__file__).resolve().parents[2]

class ExistingProcess:
 def __init__(self,pid,path):self.pid=int(pid);self.path=str(Path(path).resolve())
 def poll(self):
  from ctypes import wintypes
  api=ctypes.WinDLL('kernel32',use_last_error=True);api.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD];api.OpenProcess.restype=wintypes.HANDLE;api.CloseHandle.argtypes=[wintypes.HANDLE]
  handle=api.OpenProcess(0x1000,False,self.pid)
  if not handle:return 1
  try:
   name=ctypes.create_unicode_buffer(32768);length=wintypes.DWORD(len(name));api.QueryFullProcessImageNameW.argtypes=[wintypes.HANDLE,wintypes.DWORD,wintypes.LPWSTR,ctypes.POINTER(wintypes.DWORD)]
   if not api.QueryFullProcessImageNameW(handle,0,name,ctypes.byref(length)) or os.path.normcase(name.value)!=os.path.normcase(self.path):return 1
   code=wintypes.DWORD();api.GetExitCodeProcess.argtypes=[wintypes.HANDLE,ctypes.POINTER(wintypes.DWORD)];api.GetExitCodeProcess(handle,ctypes.byref(code));return None if code.value==259 else code.value
  finally:api.CloseHandle(handle)
 def wait(self,timeout):
  end=time.monotonic()+timeout
  while time.monotonic()<end:
   code=self.poll()
   if code is not None:return code
   time.sleep(.05)
  raise subprocess.TimeoutExpired('Owned original process',timeout)


class OriginalProcess:
 def __init__(self,base,mode):
  self.base=base;self.mode=mode;self.pipe=None;self.pending={};self.lock=threading.Lock();self.ready=Queue();self.desktop=None
  startup=None
  if mode=='browser':
   from ctypes import wintypes
   api=ctypes.WinDLL('user32',use_last_error=True)
   api.CreateDesktopW.argtypes=[wintypes.LPCWSTR,wintypes.LPCWSTR,ctypes.c_void_p,wintypes.DWORD,wintypes.DWORD,ctypes.c_void_p]
   api.CreateDesktopW.restype=wintypes.HANDLE
   name='FarmSystem_'+uuid.uuid4().hex
   self.desktop=api.CreateDesktopW(name,None,None,0,0x10000000,None)
   if not self.desktop:raise OSError(ctypes.get_last_error(),'Cannot create a private original-UI desktop')
   self.desktop_api=api;startup=subprocess.STARTUPINFO();startup.lpDesktop='winsta0\\'+name
  executable=Path(os.environ.get('WINDIR',r'C:\Windows'))/'SysWOW64/WindowsPowerShell/v1.0/powershell.exe'
  host=base/'Bin/FarmSystemOriginal.exe'
  stamp=base/'Bin/FarmSystemOriginal.source-sha256'
  source_hash=hashlib.sha256((ROOT/'tools/farmdesign/NativeUi.cs').read_bytes()+(ROOT/'tools/farmdesign/NativeHost.cs').read_bytes()).hexdigest()
  if not host.exists() or not stamp.exists() or stamp.read_text()!=source_hash:
   if host.exists():
    archive=(base/'AdapterArchive'/uuid.uuid4().hex).resolve();archive.relative_to(base.resolve());archive.mkdir(parents=True);shutil.move(str(host),str(archive/host.name))
   compiled=subprocess.run([str(executable),'-NoProfile','-ExecutionPolicy','Bypass','-File',str(ROOT/'tools/farmdesign/native-ui.ps1'),'-Session',str(base),'-CompileOnly'],cwd=base/'Bin',capture_output=True,text=True,encoding='utf-8',creationflags=subprocess.CREATE_NO_WINDOW,timeout=45)
   if compiled.returncode:raise RuntimeError('Original-interface adapter compilation failed: '+compiled.stderr+compiled.stdout)
   stamp.write_text(source_hash)
  self.log=(base/'ui-stderr.log').open('a',encoding='utf-8')
  self.process=subprocess.Popen([str(host),str(base),mode],cwd=base/'Bin',stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=self.log,text=True,encoding='utf-8',bufsize=1,startupinfo=startup,creationflags=subprocess.CREATE_NO_WINDOW)
  self.thread=threading.Thread(target=self._read,daemon=True);self.thread.start()
  try:
   response=self.ready.get(timeout=60)
   if not response.get('ready'):raise RuntimeError(response.get('error','Original forms failed to start'))
   self.port=response['port'];self._connect()
  except BaseException:
   self.abort();raise
 @classmethod
 def attach(cls,base,mode,pid,port):
  result=cls.__new__(cls);result.base=base;result.mode=mode;result.pipe=None;result.pending={};result.lock=threading.Lock();result.desktop=None;result.log=(base/'ui-stderr.log').open('a',encoding='utf-8');result.process=ExistingProcess(pid,base/'Bin/FarmSystemOriginal.exe');result.port=int(port);result._connect()
  try:
   if result.command('frame',timeout=3,picture=False).get('sessionId')!=base.name:raise ValueError('Original process identity mismatch')
  except BaseException:result.release();raise
  return result
 def _read(self):
  try:
   for line in self.process.stdout:
    if not line.startswith(PREFIX):continue
    try:response=json.loads(line[len(PREFIX):])
    except ValueError:continue
    if 'ready' in response:self.ready.put(response)

  finally:
   error={'ok':False,'error':'Original UI process ended. The session files are retained.'}
   self.ready.put(error)
 def _connect(self):
  self.pipe=socket.create_connection(('127.0.0.1',self.port),timeout=5);self.pipe.settimeout(None);self.pipe.setsockopt(socket.IPPROTO_TCP,socket.TCP_NODELAY,1)
  self.pipe_thread=threading.Thread(target=self._receive,daemon=True);self.pipe_thread.start()
 def _receive(self):
  connection=self.pipe
  buffer=b''
  try:
   while True:
    chunk=connection.recv(65536)
    if not chunk:break
    buffer+=chunk
    while b'\n' in buffer:
     line,buffer=buffer.split(b'\n',1);response=json.loads(line.decode('utf-8-sig'));target=self.pending.get(response.get('id'))
     if target:target.put(response)
  except (OSError,ValueError):pass
  finally:
   for target in list(self.pending.values()):target.put({'ok':False,'error':'Original interface connection closed; session files are retained'})
 def command(self,action,timeout=90,**values):
  if any(k in values for k in ('id','token')):raise ValueError('Reserved original command field')
  identifier=uuid.uuid4().hex;queue=Queue();self.pending[identifier]=queue
  try:
   with self.lock:
    if self.process.poll() is not None:raise RuntimeError('Original UI is closed; its files are retained')
    self.pipe.sendall((json.dumps({'id':identifier,'action':action,'token':self.base.name,**values},ensure_ascii=False,allow_nan=False)+'\n').encode('utf-8'))
   try:response=queue.get(timeout=timeout)
   except Empty:raise TimeoutError('The original window is waiting. Complete its open dialog and refresh.')
   if not response.get('ok'):raise ValueError(response.get('error','Original UI operation failed'))
   return response['result']
  finally:self.pending.pop(identifier,None)
 def stop(self):
  if self.process.poll() is None:
   self.command('close',timeout=10)
   try:self.process.wait(timeout=15)
   except subprocess.TimeoutExpired:raise RuntimeError('Original window is waiting for confirmation. Complete it before switching interfaces.')
  self.release()
 def release(self):
  if self.pipe:
   try:self.pipe.shutdown(socket.SHUT_RDWR);self.pipe.close()
   except OSError:pass
   self.pipe=None
  if self.desktop:
   self.desktop_api.CloseDesktop.argtypes=[ctypes.c_void_p];self.desktop_api.CloseDesktop(self.desktop);self.desktop=None
  self.log.close()
 def abort(self):
  if self.process.poll() is None:self.process.terminate();self.process.wait(timeout=10)
  self.release()


class NativeUiSessions:
 def __init__(self,runtime,worker_factory,validator,session_root=None):
  self.runtime=Path(runtime);self.worker_factory=worker_factory;self.validate=validator;self.lock=threading.RLock();self.sessions={}
  portable=self.runtime.parent/'UserData'
  self.root=Path(session_root or (portable/'OriginalInterface' if portable.exists() else ROOT.parents[1]/'原版界面工作区_20261028')).resolve()
 def start(self,document,mode):
  self.validate(document)
  if os.name!='nt' or mode not in {'browser','desktop'}:raise ValueError('Original interfaces require Windows and browser/desktop mode')
  with self.lock:
   # A new project creates a new recoverable session, never overwrites another session.
   identifier=uuid.uuid4().hex;base=self.root/identifier;base.mkdir(parents=True)
   (base/'Input').mkdir();(base/'Output').mkdir()
   shutil.copytree(self.runtime/'Bin',base/'Bin')
   shutil.copytree(self.runtime/'Docs',base/'Docs')
   worker=self.worker_factory(self.runtime,document.get('runtimeOptions',{}).get('networkMetrics','Simple'))
   try:
    staged=worker.command('stage-gui',document)
    for path in (worker.session/'Input').rglob('*'):
     if path.is_file() and path.suffix.lower()!='.ldb':
      destination=base/'Input'/path.relative_to(worker.session/'Input');destination.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,destination)
   finally:worker.close()
   (base/'source-project.json').write_text(json.dumps(document,ensure_ascii=False,indent=2),encoding='utf-8')
   (base/'staging.json').write_text(json.dumps(staged,ensure_ascii=False,indent=2),encoding='utf-8')
   self._config(base,document['farmId'],document.get('runtimeOptions',{}).get('networkMetrics','Simple'))
   process=OriginalProcess(base,mode)
   session={'id':identifier,'base':base,'mode':mode,'process':process,'sourceDigest':hashlib.sha256(json.dumps(document,sort_keys=True,ensure_ascii=False).encode()).hexdigest()}
   self.sessions[identifier]=session;self._record(session)
   return self.status(identifier)
 def _config(self,base,farm_id,network):
  path=base/'Bin/applConfig.FarmDESIGN.ini';tree=ET.parse(path);root=tree.getroot()
  values={'InputDirectoryPath':str(base/'Input')+'\\','OutputDirectoryPath':str(base/'Output')+'\\','CurrentFarm':str(farm_id),'NetworkMetrics':'' if network=='None' else network}
  for name,value in values.items():
   element=next((row for row in root.findall('element') if row.findtext('name')==name),None)
   if element is None:element=ET.SubElement(root,'element');ET.SubElement(element,'name').text=name;ET.SubElement(element,'value')
   element.find('value').text=value
  tree.write(path,encoding='utf-8',xml_declaration=True)
 def _rebase(self,base):
  path=base/'Bin/applConfig.FarmDESIGN.ini';tree=ET.parse(path)
  saved=base/'directories.json';record=json.loads(saved.read_text(encoding='utf-8')) if saved.exists() else {}
  for row in tree.getroot().findall('element'):
   name=row.findtext('name')
   if name not in {'InputDirectoryPath','OutputDirectoryPath'}:continue
   area='Input' if name=='InputDirectoryPath' else 'Output';raw=row.findtext('value') or str(base/area);old=Path(raw.rstrip('\\/'));info=record.get('areas',{}).get(area,{})
   if info and os.path.normcase(str(old)) in {os.path.normcase(info['original']),os.path.normcase(info.get('configured',info['original']))}:
    if info.get('relative') is not None:target=(base/info['relative']).resolve();target.relative_to(base.resolve())
    elif record.get('sessionFolder')!=str(base) or not old.is_dir():
     target=(base/info['portable']).resolve();target.relative_to(base.resolve())
    else:target=old
   elif old.name==area and old.parent.name==base.name:target=base/area
   else:target=old
   if not target.is_dir():raise ValueError('Original '+area+' directory is unavailable. Restore its saved folder before reopening this session: '+str(target))
   row.find('value').text=str(target)+'\\'
  tree.write(path,encoding='utf-8',xml_declaration=True)

 def _areas(self,s):
  if s['process'].process.poll() is None:values=s['process'].command('directories')
  else:
   config={row.findtext('name'):row.findtext('value') for row in ET.parse(s['base']/'Bin/applConfig.FarmDESIGN.ini').getroot().findall('element')}
   values={area:config.get(area+'DirectoryPath') or str(s['base']/area) for area in ['Input','Output']};values['networkMetrics']=config.get('NetworkMetrics') or 'None'
  return {area:Path(values[area].rstrip('\\/')).resolve() for area in ['Input','Output']}|{'Docs':s['base']/'Docs','Bin/Photos':s['base']/'Bin/Photos'},values

 def _area_files(self,base,root):
  # A selected directory may be an ancestor of the session. Never copy the
  # session into itself, or follow links outside the directory the user chose.
  base=base.resolve();root=root.resolve()
  def allowed(path):
   resolved=path.resolve()
   return resolved.is_relative_to(root) and (root.is_relative_to(base) or not resolved.is_relative_to(base))
  def fail(error):raise error
  for directory,folders,files in os.walk(root,followlinks=False,onerror=fail):
   folders[:]=[name for name in folders if allowed(Path(directory)/name)]
   for name in files:
    path=Path(directory)/name
    if path.suffix.lower()!='.ldb' and allowed(path):yield path

 def _capture_directories(self,s,areas,settings):
  record={'sessionFolder':str(s['base']),'areas':{}}
  for area in ['Input','Output']:
   root=areas[area];info={'original':str(root),'configured':settings[area].rstrip('\\/')}
   if root.is_relative_to(s['base']):info['relative']=root.relative_to(s['base']).as_posix()
   else:
    files=list(self._area_files(s['base'],root));digest=hashlib.sha256()
    for path in sorted(files):digest.update(path.relative_to(root).as_posix().encode('utf-8'));digest.update(hashlib.sha256(path.read_bytes()).digest())
    mirror=s['base']/'DirectoryCopies'/(area+'-'+digest.hexdigest());mirror.mkdir(parents=True,exist_ok=True)
    for path in files:
     destination=mirror/path.relative_to(root)
     if not destination.exists() or hashlib.sha256(destination.read_bytes()).digest()!=hashlib.sha256(path.read_bytes()).digest():
      destination.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,destination)
    info['portable']=mirror.relative_to(s['base']).as_posix()
   record['areas'][area]=info
  pending=s['base']/'directories.pending.json';pending.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8');pending.replace(s['base']/'directories.json')
 def _record(self,s):
  data={k:s[k] for k in ['id','mode','sourceDigest']};data['engineVersion']='4.21.5.0'
  data['pid']=s['process'].process.pid;data['port']=s['process'].port
  data['closed']=s['process'].process.poll() is not None
  data['ownerPid']=os.getpid();data['ownerExecutable']=sys.executable
  pending=s['base']/'session.pending.json';pending.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8');pending.replace(s['base']/'session.json')
 def get(self,identifier,resume=False):
  with self.lock:
   if identifier in self.sessions:
    session=self.sessions[identifier]
    if session['process'].process.poll() is not None and resume:
     session['process'].release();self._rebase(session['base']);session['process']=OriginalProcess(session['base'],session['mode']);self._record(session)
    return session
   if not isinstance(identifier,str) or len(identifier)!=32 or any(c not in '0123456789abcdef' for c in identifier):raise ValueError('Invalid original session identity')
   base=(self.root/identifier).resolve();base.relative_to(self.root)
   path=base/'session.json'
   if not path.exists():raise ValueError('Original session is unavailable in this folder. Start a new session from the current project.')
   data=json.loads(path.read_text(encoding='utf-8'));mode=data.get('mode','browser')
   existing=ExistingProcess(data.get('pid',0),base/'Bin/FarmSystemOriginal.exe')
   owner=ExistingProcess(data.get('ownerPid',0),data.get('ownerExecutable',sys.executable))
   if existing.poll() is None and data.get('ownerPid')!=os.getpid() and owner.poll() is None:raise ValueError('This original session is open in another local Farm service. Close that service before continuing here.')
   if existing.poll() is not None and not resume:raise ValueError('Original session is closed. Use either original-interface entry to reopen its saved inputs.')
   if existing.poll() is not None:self._rebase(base)
   process=OriginalProcess.attach(base,mode,existing.pid,data['port']) if existing.poll() is None and data.get('port') else OriginalProcess(base,mode)
   self.sessions[identifier]={'id':identifier,'base':base,'mode':mode,'sourceDigest':data['sourceDigest'],'process':process};self._record(self.sessions[identifier])
   return self.sessions[identifier]
 def list_sessions(self):
  result=[]
  if not self.root.exists():return result
  for path in self.root.glob('*/session.json'):
   try:
    data=json.loads(path.read_text(encoding='utf-8'));latest=path.parent/'latest-project.json';source=json.loads((latest if latest.exists() else path.parent/'source-project.json').read_text(encoding='utf-8'));result.append({'id':data['id'],'mode':data.get('mode','browser'),'name':source['tables']['FRM'][0]['Name'],'farmId':source['farmId'],'updatedAt':path.stat().st_mtime,'running':ExistingProcess(data.get('pid',0),path.parent/'Bin/FarmSystemOriginal.exe').poll() is None})
   except (ValueError,KeyError,OSError):continue
  for item in result:
   record=json.loads((self.root/item['id']/'session.json').read_text(encoding='utf-8'));owner=ExistingProcess(record.get('ownerPid',0),record.get('ownerExecutable',sys.executable));item['available']=item['id'] in self.sessions or not item['running'] or bool(record.get('ownerPid')) and owner.poll() is not None
  return sorted(result,key=lambda item:item['updatedAt'],reverse=True)
 def end(self,identifier):
  session=self.get(identifier)
  if session['process'].process.poll() is None:self.snapshot(identifier);session['process'].stop()
  else:session['process'].release()
  areas,settings=self._areas(session);self._capture_directories(session,areas,settings)
  self._record(session)
  return {'closed':True,'filesRetained':True}
 def status(self,identifier):
  if identifier not in self.sessions and isinstance(identifier,str) and len(identifier)==32 and all(c in '0123456789abcdef' for c in identifier):
   base=self.root/identifier;path=base/'session.json'
   if path.exists():
    saved=json.loads(path.read_text(encoding='utf-8'))
    if ExistingProcess(saved.get('pid',0),base/'Bin/FarmSystemOriginal.exe').poll() is not None:return {'id':identifier,'mode':saved.get('mode','browser'),'running':False,'sourceDigest':saved['sourceDigest'],'engineVersion':'4.21.5.0','sessionFolder':str(base),'implementation':'unchanged-original-author-forms'}
  s=self.get(identifier);return {'id':s['id'],'mode':s['mode'],'running':s['process'].process.poll() is None,'sourceDigest':s['sourceDigest'],'engineVersion':'4.21.5.0','sessionFolder':str(s['base']),'implementation':'unchanged-original-author-forms'}
 def presentation(self,identifier,language,translations):
  if language not in {'zh','en','both'} or not isinstance(translations,dict) or len(translations)>5000 or any(not isinstance(k,str) or not isinstance(v,str) or len(k)>1000 or len(v)>2000 for k,v in translations.items()):raise ValueError('Invalid original presentation preferences')
  s=self.get(identifier);source=json.loads((s['base']/'source-project.json').read_text(encoding='utf-8'));protected=[row['Name'] for rows in source['tables'].values() for row in rows if row.get('Name')]
  result=s['process'].command('presentation',language=language,translations=translations,protectedNames=protected)
  (s['base']/'presentation.json').write_text(json.dumps({'language':language,'translations':translations,'protectedNames':protected},ensure_ascii=False),encoding='utf-8')
  return result
 def frame(self,identifier,picture=True):
  s=self.get(identifier)
  if s['process'].process.poll() is not None:
   s['process'].release()
   areas,settings=self._areas(s);self._capture_directories(s,areas,settings);self._record(s)
   return {'windows':[],'running':False,'initializing':False,'sessionId':identifier,'engineVersion':'4.21.5.0'}
  return s['process'].command('frame',timeout=30,picture=picture)
 def action(self,identifier,action):
  if not isinstance(action,dict) or action.get('action') not in {'menu','tree','value','cell','resize','window-close','click','scroll','key','pointer','control-double','tab','error-clear','folder-select'} or any(k in action for k in ('id','token','timeout')):raise ValueError('Invalid original UI action')
  return self.get(identifier)['process'].command(**action)
 def snapshot(self,identifier,before=None):
  s=self.get(identifier);document=s['process'].command('snapshot');self.validate(document)
  if before is not None:
   self.validate(before);backup=s['base']/'WebBeforePull';backup.mkdir(exist_ok=True)
   (backup/(str(time.time_ns())+'.json')).write_text(json.dumps(before,ensure_ascii=False,indent=2),encoding='utf-8')
  original=json.loads((s['base']/'source-project.json').read_text(encoding='utf-8'))
  document['runtimeOptions']=original.get('runtimeOptions',{'networkMetrics':'Simple'})
  areas,settings=self._areas(s);network=settings.get('networkMetrics') or 'None'
  if network in {'None','Simple','Complex'}:document['runtimeOptions']={**document['runtimeOptions'],'networkMetrics':network}
  name=document['tables']['FRM'][0]['Name'].replace(' ','_');attachments={}
  for key,suffix in [('dendrogram','Dendrogram'),('mapping','Mapping'),('products','Products')]:
   p=areas['Input']/f'{name}.FD.{suffix}.txt'
   if p.exists():attachments[key]=p.read_text(encoding='utf-8-sig')
  if len(attachments)==3:document['functionalDiversity']=attachments
  self._capture_directories(s,areas,settings)
  p=s['base']/'latest-project.json';p.write_text(json.dumps(document,ensure_ascii=False,indent=2),encoding='utf-8')
  return {'document':document,'sessionId':identifier}
 def switch(self,identifier,mode):
  if mode not in {'browser','desktop'}:raise ValueError('Invalid original interface mode')
  with self.lock:
   s=self.get(identifier,resume=True)
   if s['mode']==mode and s['process'].process.poll() is None:return self.status(identifier)
   if s['process'].process.poll() is None:self.snapshot(identifier);s['process'].stop()
   else:s['process'].release()
   self._rebase(s['base']);s['process']=OriginalProcess(s['base'],mode);s['mode']=mode;self._record(s);return self.status(identifier)
 def files(self,identifier):
  s=self.get(identifier);result=[];areas,_=self._areas(s)
  for area,root in areas.items():
   for path in self._area_files(s['base'],root):result.append({'path':area+'/'+path.relative_to(root).as_posix(),'bytes':path.stat().st_size,'updatedAt':path.stat().st_mtime})
  return {'files':sorted(result,key=lambda row:row['path']),'directories':{area:str(path) for area,path in areas.items()}}
 def read_file(self,identifier,path):
  s=self.get(identifier)
  if not isinstance(path,str) or not any(path.startswith(area+'/') for area in ['Output','Docs','Input','Bin/Photos']):raise ValueError('Choose a file listed in this original session')
  areas,_=self._areas(s);area=next(area for area in areas if path.startswith(area+'/'));file=(areas[area]/path[len(area)+1:]).resolve();file.relative_to(areas[area].resolve())
  if not areas[area].is_relative_to(s['base']) and file.is_relative_to(s['base']):raise ValueError('Choose a file listed in this original session')
  if file.suffix.lower()=='.ldb' or not file.is_file() or file.stat().st_size>32*1024*1024:raise ValueError('Original file unavailable or larger than 32 MB; use the complete session export')
  data=file.read_bytes();return {'filename':file.name,'base64':base64.b64encode(data).decode(),'sha256':hashlib.sha256(data).hexdigest()}
 def export(self,identifier):
  s=self.get(identifier);self.snapshot(identifier);buffer=io.BytesIO();areas,_=self._areas(s)
  with zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as archive:
   folders={k:v for k,v in areas.items() if k!='Docs'}
   if (s['base']/'WebBeforePull').is_dir():folders['WebBeforePull']=s['base']/'WebBeforePull'
   for folder,root in folders.items():
    for path in self._area_files(s['base'],root):archive.write(path,folder+'/'+path.relative_to(root).as_posix())
   for name in ['latest-project.json','source-project.json','session.json','directories.json']:archive.write(s['base']/name,name)
   archive.writestr('README.txt','Actual FarmDESIGN 4.21.5 original-interface session. Original forms and calculations run unchanged. Input databases, original outputs and session snapshots are preserved. The original executable is available in the portable package engine/Bin.\n')
  data=buffer.getvalue();return {'filename':'FarmDESIGN-original-session.zip','base64':base64.b64encode(data).decode(),'sha256':hashlib.sha256(data).hexdigest()}
 def close(self):
  # Keep project files on disk. Stop only owned processes when the local server stops.
  for s in self.sessions.values():
   try:self.end(s['id'])
   except Exception:s['process'].release()
