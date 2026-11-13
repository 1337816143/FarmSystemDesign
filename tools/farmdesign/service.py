from pathlib import Path
from queue import Queue, Empty
import atexit
import hashlib
import json
import math
import os
import shutil
import subprocess
import threading
import time
import uuid
import copy
import base64
import io
import zipfile
import csv

ROOT=Path(__file__).resolve().parents[2]
DEFAULT_RUNTIME=ROOT.parents[1]/'原版FarmDESIGN运行时_20261027'
TABLES={'FRM','ENV','ECN','ROT','RCR','CRP','PRD','ANM','APR','ARR','MAN','FRT','CFR','CMR','PST','CPR','GRP','GCR','MCH','BLD','HHD','HMR','DRI','DRF'}
PREFIX='@@FARMDESIGN@@'
ENTITY_TABLE={'MixedFarm':('FRM','FrmID'),'Farm':('FRM','FrmID'),'Environment':('ENV','EnvID'),'Environm':('ENV','EnvID'),'Economics':('ECN','EcnID'),'Rotation':('ROT','RotID'),'RotationCrop':('RCR','RcrID'),'Crop':('CRP','CrpID'),'CropProduct':('PRD','PrdID'),'Animal':('ANM','AnmID'),'AnimalProduct':('APR','AprID'),'AnimalReplacement':('ARR','ArrID'),'Manure':('MAN','ManID'),'Fertilizer':('FRT','FrtID'),'CropFertilizer':('CFR','CfrID'),'CropManure':('CMR','CmrID'),'Pesticide':('PST','PstID'),'CropPesticide':('CPR','CprID'),'Group':('GRP','GrpID'),'GroupCrop':('GCR','GcrID'),'Machine':('MCH','MchID'),'Building':('BLD','BldID'),'Household':('HHD','HhdID'),'HouseholdMember':('HMR','HmrID')}
FIELD_ALIASES={'ANM':{'Number':'AnmNumber','EntericCH4EmissionFactor':'Enteric_CH4_EF','ManureCH4EmissionFactor':'Manure_CH4_EF'},'FRM':{'ProportionCH4':'ProportionCH4inBiogas','AppliedResidue_N2O_EmissionFactor':'Residue_N2O_EF','Fixation_N2O_EmissionFactor':'Fixation_N2O_EF','Deposition_N2O_EmissionFactor':'Deposition_N2O_EF'},'ECN':{'Currency':'Currenc'}}
FIELD_MAP=json.loads((ROOT/'data/farmdesign/native-field-map.json').read_text(encoding='utf-8'))
for _table,_mapping in FIELD_MAP.items():
    ENTITY_TABLE[_mapping['entityType']]=(_table,_mapping['primaryKey'])
    FIELD_ALIASES[_table]={value:key for key,value in _mapping['properties'].items()}


def document_with_values(document,values):
    result=copy.deepcopy(document)
    for item in values:
        entity=item['EntityType']
        if entity not in ENTITY_TABLE:raise ValueError('Unsupported native input entity: '+entity)
        table,pk=ENTITY_TABLE[entity]
        field=FIELD_ALIASES.get(table,{}).get(item['Variable'],item['Variable'])
        row=next((r for r in result['tables'].get(table,[]) if r[pk]==item['ObjID']),None)
        if row is None or field not in row or field in {pk,'FrmID'}:raise ValueError('Native variable is not an editable input: '+entity+'.'+field)
        row[field]=item['value']
    return result


def nondominated(candidates,objectives):
    unique=[];seen=set()
    for candidate in candidates:
        signature=canonical(candidate['values'])
        if signature not in seen:seen.add(signature);unique.append(candidate)
    def dominates(a,b):
        differences=[(a['scores'][o['key']]-b['scores'][o['key']])*(1 if o['direction']=='max' else -1) for o in objectives]
        return all(v>=-1e-9 for v in differences) and any(v>1e-9 for v in differences)
    return [c for c in unique if not any(dominates(other,c) for other in unique if other is not c)]


def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False)


def validate_document(document):
    if not isinstance(document,dict) or document.get('schema')!='FarmSystemDesign.FarmDESIGN.NativeTables' or document.get('schemaVersion')!=1:
        raise ValueError('Expected FarmDESIGN NativeTables v1 project')
    farm_id=document.get('farmId')
    if type(farm_id) is not int or farm_id<=0:
        raise ValueError('A positive farmId is required')
    tables=document.get('tables')
    if not isinstance(tables,dict) or set(tables)-TABLES:
        raise ValueError('Unexpected native table')
    for name,rows in tables.items():
        if not isinstance(rows,list) or len(rows)>5000:
            raise ValueError('Native tables support at most 5000 rows')
        for row in rows:
            if not isinstance(row,dict) or len(row)>200:
                raise ValueError('Expected native table row')
            if 'FrmID' in row and row['FrmID']!=farm_id:
                raise ValueError('Farm identity mismatch')
            for key,value in row.items():
                if not isinstance(key,str) or key in {'__proto__','prototype','constructor'} or not isinstance(value,(str,int,float,bool,type(None))) or isinstance(value,(int,float)) and not math.isfinite(value) or isinstance(value,str) and len(value)>20000:
                    raise ValueError('Expected finite, scalar native field values')
    for name in ['FRM','ENV','ECN']:
        if len(tables.get(name,[]))!=1:
            raise ValueError('Exactly one '+name+' row is required')
    if tables['FRM'][0].get('FrmID')!=farm_id:
        raise ValueError('Farm identity mismatch')
    extra=document.get('auxiliaryTables',{})
    if not isinstance(extra,dict) or set(extra)-{'NTE','PHO','VRS'}:raise ValueError('Unexpected auxiliary native table')
    for name,rows in extra.items():
        if not isinstance(rows,list) or len(rows)>5000:raise ValueError('Invalid auxiliary native table')
        for row in rows:
            if not isinstance(row,dict) or 'FrmID' in row and row['FrmID']!=farm_id:raise ValueError('Auxiliary farm identity mismatch')
            if any(not isinstance(v,(str,int,float,bool,type(None))) for v in row.values()):raise ValueError('Auxiliary fields must be scalars')
    fd=document.get('functionalDiversity')
    if fd:
        if not isinstance(fd,dict) or any(not isinstance(fd.get(k),str) for k in ['dendrogram','mapping','products']):raise ValueError('Provide all three NFD text attachments, or remove the incomplete set')
        matrix=[[float(v) for v in line.split('\t')] for line in fd['dendrogram'].splitlines() if line.strip()]
        if not 2<=len(matrix)<=1001 or not 2<=len(matrix[0])<=1000 or any(len(row)!=len(matrix[0]) for row in matrix) or any(not math.isfinite(v) for row in matrix for v in row) or any(v<0 for v in matrix[0]) or sum(matrix[0])<=0 or any(v not in {0,1} for row in matrix[1:] for v in row):raise ValueError('NFD dendrogram needs positive total branch length and an aligned binary membership matrix')
        known={100000+r['PrdID'] for r in tables.get('PRD',[])}|{200000+r['AprID'] for r in tables.get('APR',[])}
        seen=set()
        for line in fd['mapping'].splitlines():
            if not line.strip():continue
            parts=line.split('\t')
            if len(parts)!=2:raise ValueError('NFD mapping requires product key and zero-based species row')
            key,index=map(int,parts)
            if key in seen or key not in known or not 0<=index<len(matrix)-1:raise ValueError('NFD mapping refers to an unknown product or species row')
            seen.add(key)
        if not seen or len([s for s in fd['products'].splitlines() if s.strip()])!=len(matrix)-1:raise ValueError('NFD products must have one name per species row')
    return document


class Worker:
    def __init__(self,runtime,network_mode='Simple'):
        if network_mode not in {'None','Simple','Complex'}:raise ValueError('Unsupported native flow-network mode')
        self.network_mode=network_mode
        self.runtime=Path(runtime).resolve(strict=True)
        self.base=(self.runtime/'sessions').resolve()
        self.base.mkdir(exist_ok=True)
        self.session=(self.base/uuid.uuid4().hex).resolve()
        self.session.relative_to(self.base)
        (self.session/'Input').mkdir(parents=True)
        (self.session/'Output').mkdir()
        for name in ['FarmDB.mdb','de.mdb']:
            shutil.copy2(self.runtime/'Input'/name,self.session/'Input'/name)
        exe=Path(os.environ.get('WINDIR',r'C:\Windows'))/'SysWOW64/WindowsPowerShell/v1.0/powershell.exe'
        self.log=(self.session/'worker-stderr.txt').open('w',encoding='utf-8')
        self.queue=Queue()
        self.process=subprocess.Popen([str(exe),'-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(ROOT/'tools/farmdesign/worker.ps1'),'-Runtime',str(self.runtime),'-Session',str(self.session),'-NetworkMode',network_mode],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=self.log,text=True,encoding='utf-8',bufsize=1,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        self.thread=threading.Thread(target=self._read,daemon=True)
        self.thread.start()
        try:
            ready=self._response(60)
            if not ready.get('ready'):
                raise RuntimeError(ready.get('error','Original engine failed to initialize'))
        except BaseException:
            self.close()
            raise
        self.loaded=None

    def _read(self):
        try:
            for line in self.process.stdout:
                if line.startswith(PREFIX):
                    self.queue.put(json.loads(line[len(PREFIX):]))
        finally:
            self.queue.put({'error':'Original engine process ended unexpectedly'})

    def _response(self,timeout):
        try:
            return self.queue.get(timeout=timeout)
        except Empty:
            raise TimeoutError('Original FarmDESIGN engine timed out')

    def command(self,action,value=None,timeout=90):
        message={'action':action}
        if value is not None:
            message['json']=canonical(value)
        self.process.stdin.write(json.dumps(message,ensure_ascii=False)+'\n')
        self.process.stdin.flush()
        response=self._response(timeout)
        if not response.get('ok'):
            raise RuntimeError(response.get('error','Original engine rejected the command'))
        return response['result']

    def load(self,document):
        validate_document(document)
        key=hashlib.sha256(canonical(document).encode()).hexdigest()
        if self.loaded==key:
            return self.command('evaluate')
        result=self.command('load',document)
        self.loaded=key
        return result

    def close(self):
        process=getattr(self,'process',None)
        if process:
            if process.poll() is None:
                try:
                    process.stdin.write('{"action":"quit"}\n');process.stdin.flush();process.wait(timeout=3)
                except (OSError,subprocess.TimeoutExpired):
                    process.terminate();process.wait(timeout=5)
            for pipe in [process.stdin,process.stdout]:
                self.thread.join(timeout=1)
                if pipe:pipe.close()
        if getattr(self,'log',None):self.log.close()
        # Sessions are owned disposable copies. Original/runtime source DBs are outside this target.
        if getattr(self,'session',None) and self.session.exists():
            target=self.session.resolve()
            target.relative_to(self.base.resolve())
            if target==self.base.resolve():raise ValueError('Refusing to remove session root')
            shutil.rmtree(target)


class FarmDesignService:
    def __init__(self,runtime=None):
        self.runtime=Path(runtime or os.environ.get('FARMDESIGN_RUNTIME',str(DEFAULT_RUNTIME))).resolve()
        self.lock=threading.RLock()
        self.worker=None
        self.jobs={}
        self.identity=None
        self.original_ui=None
        atexit.register(self.close)

    def _ensure(self,network_mode=None):
        if self.worker is not None and network_mode is not None and self.worker.network_mode!=network_mode:
            self.worker.close();self.worker=None
        if self.worker is None:
            manifest=self.runtime/'source-identity.json'
            if not manifest.exists():
                raise RuntimeError('Run python tools/prepare-farmdesign.py to prepare the isolated author runtime')
            self.identity=json.loads(manifest.read_text(encoding='utf-8'))
            for name,expected in self.identity['hashes'].items():
                if hashlib.sha256((self.runtime/name).read_bytes()).hexdigest()!=expected:
                    raise RuntimeError('Author runtime source identity mismatch: '+name)
            for adaptation in self.identity.get('resourceAdaptations',[]):
                if hashlib.sha256((self.runtime/adaptation['path']).read_bytes()).hexdigest()!=adaptation['runtimeSha256']:
                    raise RuntimeError('Native flow resource identity mismatch')
            self.worker=Worker(self.runtime,network_mode or 'Simple')
        return self.worker

    def capabilities(self):
        try:
            with self.lock:self._ensure()
            return {'ready':True,'identity':self.identity,'native':True,'engineVersion':'4.21.5.0','internetRequired':False}
        except Exception as error:
            return {'ready':False,'error':str(error)}

    def evaluate(self,document):
        validate_document(document)
        with self.lock:
            mode=document.get('runtimeOptions',{}).get('networkMetrics','Simple')
            result=self._ensure(mode).load(document)
            result['identity']=self.identity
            result['runtimeOptions']={'networkMetrics':mode}
            result['functionalDiversity']={'status':'configured' if document.get('functionalDiversity') else 'not-configured','attachmentsRequired':['dendrogram','mapping','products']}
            if not document.get('functionalDiversity'):
                result['warnings'].append('Nutritional functional diversity is not configured: the native zero is not an estimated NFD score. Supply the three trait-tree text attachments.')
                for metric in result['metrics']:
                    if any(word in metric['key'].lower() for word in ['functionaldiversity','nfd']):metric.update({'rawNativeValue':metric['value'],'value':None,'status':'not-configured'})
            result['inputDigest']=hashlib.sha256(canonical(document).encode()).hexdigest()
            return result

    def export_xml(self,document):
        validate_document(document)
        with self.lock:
            worker=self._ensure(document.get('runtimeOptions',{}).get('networkMetrics','Simple'));worker.load(document)
            return worker.command('export-xml')

    def import_xml(self,xml):
        if not isinstance(xml,str) or len(xml.encode('utf-8'))>8*1024*1024:raise ValueError('Native XML must be within 8 MB')
        with self.lock:
            result=self._ensure().command('import-xml',xml)
            validate_document(result['document'])
            return result

    def export_package(self,document):
        validate_document(document)
        with self.lock:
            result=self.evaluate(document)
            worker=self._ensure(document.get('runtimeOptions',{}).get('networkMetrics','Simple'))
            xml=worker.command('export-xml')['xml']
            output=io.BytesIO()
            def flat(value,path=''):
                if isinstance(value,dict):
                    for k,v in value.items():yield from flat(v,path+'.'+k if path else k)
                elif isinstance(value,list):
                    for i,v in enumerate(value):yield from flat(v,f'{path}[{i}]')
                else:yield path,value
            def safe(value):
                return "'"+value if isinstance(value,str) and value.startswith(('=','+','-','@','\t','\r')) else value
            with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
                archive.writestr('project.json',json.dumps(document,ensure_ascii=False,indent=2))
                archive.writestr('native-results.json',json.dumps(result,ensure_ascii=False,indent=2))
                archive.writestr('source-identity.json',json.dumps(self.identity,ensure_ascii=False,indent=2))
                archive.writestr('FarmDESIGN.xml',xml)
                for name in ['FarmDB.mdb','de.mdb']:archive.write(worker.session/'Input'/name,'Input/'+name)
                fd=document.get('functionalDiversity')
                if fd:
                    name=document['tables']['FRM'][0]['Name'].replace(' ','_')
                    for key,suffix in [('dendrogram','Dendrogram'),('mapping','Mapping'),('products','Products')]:archive.writestr(f'Input/{name}.FD.{suffix}.txt',fd[key])
                for module,values in result['modules'].items():
                    text=io.StringIO(newline='');writer=csv.writer(text);writer.writerow(['path','value'])
                    for path,value in flat(values):writer.writerow([safe(path),safe(value)])
                    archive.writestr('Reports/'+module+'.csv','\ufeff'+text.getvalue())
                archive.writestr('README.txt','Local FarmDESIGN 4.21.5 project. Author executables are not included. Input/FarmDB.mdb and Input/de.mdb are the edited, isolated project databases. Native XML excludes global DRI/DRF references; these are retained in the included FarmDB.mdb and project.json. NFD trait attachments, if configured, are included under Input. Reports preserve native calculation values; they do not establish empirical calibration.\n')
            return {'filename':'FarmDESIGN-local-project.zip','base64':base64.b64encode(output.getvalue()).decode(),'sha256':hashlib.sha256(output.getvalue()).hexdigest()}

    def start_job(self,body):
        document=validate_document(body.get('document'))
        variables=body.get('variables');objectives=body.get('objectives');constraints=body.get('constraints',[]);settings=body.get('settings')
        if not isinstance(variables,list) or not 1<=len(variables)<=256:raise ValueError('Select 1..256 decision variables')
        if not isinstance(objectives,list) or not 1<=len(objectives)<=20:raise ValueError('Select 1..20 original-model objectives')
        if not isinstance(settings,dict):raise ValueError('Search settings are required')
        for field,minimum,maximum in [('population',8,600),('generations',1,10000)]:
            if type(settings.get(field)) is not int or not minimum<=settings[field]<=maximum:raise ValueError(f'{field} must be in {minimum}..{maximum}')
        for field,minimum,maximum in [('F',0.0001,2),('CR',0,1)]:
            if type(settings.get(field)) not in {float,int} or not math.isfinite(settings[field]) or not minimum<=settings[field]<=maximum:raise ValueError('Invalid '+field)
        keys=set()
        for variable in variables:
            lo,hi=variable.get('Minimum'),variable.get('Maximum')
            if type(lo) not in {int,float} or type(hi) not in {int,float} or not math.isfinite(lo) or not math.isfinite(hi) or lo>hi:raise ValueError('Decision bounds must be finite and ordered')
            signature=(variable.get('EntityType'),variable.get('ObjID'),variable.get('Variable'))
            if signature in keys:raise ValueError('Duplicate decision variable')
            keys.add(signature)
            document_with_values(document,[{**variable,'value':lo}])
        if len({o.get('key') for o in objectives})!=len(objectives) or any(o.get('direction') not in {'max','min'} for o in objectives):raise ValueError('Objectives must be unique with min/max directions')
        for constraint in constraints:
            lo,hi=constraint.get('min'),constraint.get('max')
            if (lo is not None and (type(lo) not in {int,float} or not math.isfinite(lo))) or (hi is not None and (type(hi) not in {int,float} or not math.isfinite(hi))) or lo is not None and hi is not None and lo>hi:raise ValueError('Indicator bounds must be finite and ordered')
        with self.lock:
            if sum(j['public']['status'] in {'queued','running'} for j in self.jobs.values())>=2:raise ValueError('Two local searches are already running; stop one before starting another')
            reference=self._ensure(document.get('runtimeOptions',{}).get('networkMetrics','Simple')).load(document)
            allowed={metric['key'] for metric in reference['metrics'] if metric.get('native')}
            if any(o.get('key') not in allowed for o in objectives+constraints):raise ValueError('Choose an original model outcome from the native catalog')
            document=copy.deepcopy(document)
            outcomes={':'.join((v['EntityType'],v['ObjName'],v['Variable'])):copy.deepcopy(v) for v in document['optimization']['indicators']}
            for item in outcomes.values():item['Objective']=False
            for item in objectives+constraints:
                key=item['key']
                if key not in outcomes:
                    entity,remainder=key.split(':',1);obj,field=remainder.rsplit(':',1)
                    outcomes[key]={'Description':key,'EntityType':entity,'ObjName':obj,'Variable':field,'Weight':0,'Original':0,'Objective':False,'Direction':1,'Constrain':False,'Minimum':0,'Maximum':0}
            for item in objectives:outcomes[item['key']].update({'Objective':True,'Direction':1 if item['direction']=='max' else -1})
            for item in constraints:
                target=outcomes[item['key']];lo=item.get('min');hi=item.get('max')
                lo=-1e30 if lo is None else lo;hi=1e30 if hi is None else hi
                if target.get('Constrain'):lo=max(lo,target['Minimum']);hi=min(hi,target['Maximum'])
                if lo>hi:raise ValueError('Additional constraint conflicts with an existing native constraint')
                target.update({'Constrain':True,'Minimum':lo,'Maximum':hi})
            next_outcome=max([0]+[int(item.get('OuvID',0)) for item in list(outcomes.values())+document['optimization'].get('referenceIndicators',[])])
            for item in outcomes.values():
                if 'OuvID' not in item:next_outcome+=1;item['OuvID']=next_outcome
                item['CasID']=document['farmId']
            document['optimization']['indicators']=list(outcomes.values())
            document['optimization']['variables']=copy.deepcopy(variables)
            job_id=uuid.uuid4().hex
            job={'cancel':threading.Event(),'public':{'id':job_id,'status':'queued','generation':0,'population':settings['population'],'evaluations':None,'feasible':None,'frontier':None}}
            self.jobs[job_id]=job
            config=copy.deepcopy({'variables':variables,'objectives':objectives,'constraints':constraints,'settings':settings})
            thread=threading.Thread(target=self._run_job,args=(job,copy.deepcopy(document),config),daemon=True)
            job['thread']=thread;thread.start()
            return copy.deepcopy(job['public'])

    def _run_job(self,job,document,config):
        worker=None;started=time.monotonic()
        try:
            worker=Worker(self.runtime,document.get('runtimeOptions',{}).get('networkMetrics','Simple'));job['public']['status']='running'
            worker.load(document)
            worker.command('start-search',config)
            generations=config['settings']['generations']
            for generation in range(generations):
                if job['cancel'].is_set():break
                progress=worker.command('step-search',timeout=180)
                job['public']['generation']=progress['iteration']
                if not progress.get('continue',True):break
            final=worker.command('finish-search',timeout=180)
            for candidate in final['candidates']:
                candidate['document']=document_with_values(document,candidate['values'])
            frontier=nondominated(final['candidates'],config['objectives'])
            job['public'].update({'status':'cancelled' if job['cancel'].is_set() else 'completed','frontier':frontier,'feasible':len(final['candidates']),'validatedPopulation':final['population'],'objectives':config['objectives'],'variables':config['variables'],'settings':config['settings'],'generation':final['iteration'],'elapsedSeconds':round(time.monotonic()-started,3),'algorithm':'Original FarmDESIGN 4.21.5 Rand1Bin / ParetoRank','randomness':'Original native random generator; seed control is not exposed','identity':self.identity,'document':document,'native':True})
        except Exception as error:
            job['public'].update({'status':'failed','error':str(error)})
        finally:
            if worker:worker.close()

    def get_job(self,job_id):
        with self.lock:
            if job_id not in self.jobs:raise ValueError('Unknown local search job')
            return copy.deepcopy(self.jobs[job_id]['public'])

    def cancel_job(self,job_id):
        with self.lock:
            if job_id not in self.jobs:raise ValueError('Unknown local search job')
            self.jobs[job_id]['cancel'].set()
            return {'cancelRequested':True,'id':job_id}

    def close(self):
        with self.lock:
            for job in self.jobs.values():job['cancel'].set()
            if self.worker:self.worker.close();self.worker=None
            if self.original_ui:self.original_ui.close()

    def dispatch(self,path,body=None):
        body=body or {}
        if path.startswith('original/'):
            if self.original_ui is None:
                from .native_ui import NativeUiSessions
                self.original_ui=NativeUiSessions(self.runtime,Worker,validate_document)
            operation=path.split('/',1)[1];identifier=body.get('sessionId')
            if operation=='sessions':return {'sessions':self.original_ui.list_sessions()}
            if operation=='end':return self.original_ui.end(identifier)
            if operation=='start':
                with self.lock:self._ensure()
                return self.original_ui.start(body.get('document'),body.get('mode','browser'))
            if operation=='status':return self.original_ui.status(identifier)
            if operation=='presentation':return self.original_ui.presentation(identifier,body.get('language'),body.get('translations'))
            if operation=='frame':return self.original_ui.frame(identifier,body.get('picture',True))
            if operation=='action':return self.original_ui.action(identifier,body.get('event'))
            if operation=='snapshot':return self.original_ui.snapshot(identifier,body.get('previousDocument'))
            if operation=='results':return self.original_ui.get(identifier)['process'].command('results')
            if operation=='switch':return self.original_ui.switch(identifier,body.get('mode'))
            if operation=='export':return self.original_ui.export(identifier)
            if operation=='files':return self.original_ui.files(identifier)
            if operation=='file':return self.original_ui.read_file(identifier,body.get('path'))
            raise ValueError('Unknown original interface operation')
        if path=='capabilities':return self.capabilities()
        if path=='evaluate':return self.evaluate(body.get('document'))
        if path=='export-xml':return self.export_xml(body.get('document'))
        if path=='import-xml':return self.import_xml(body.get('xml'))
        if path=='export-package':return self.export_package(body.get('document'))
        if path=='optimize':return self.start_job(body)
        if path.startswith('jobs/'):return self.get_job(path.split('/')[-1])
        if path=='cancel':return self.cancel_job(body.get('jobId'))
        raise ValueError('Unknown FarmDESIGN operation: '+path)
