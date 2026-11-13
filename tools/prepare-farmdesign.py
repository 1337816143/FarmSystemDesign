"""Prepare an isolated copy of the author's FarmDESIGN; never alter source data.

The original model is executed locally through its managed calculation classes.
This command performs no network request, installation or publication.
"""
from pathlib import Path
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import csv

ROOT=Path(__file__).resolve().parents[1]
TABLES=['FRM','ENV','ECN','ROT','RCR','CRP','PRD','ANM','APR','ARR','MAN','FRT','CFR','CMR','PST','CPR','GRP','GCR','MCH','BLD','HHD','HMR','DRI','DRF']
DEFAULT_SOURCE=Path.home()/'Documents'/'ChatGPT'/'博士论文 2'/'FarmDESIGN'/'downloads'/'Ditzler_etal_2019'/'FarmDESIGN.Ditzler_etal_2019'
DEFAULT_RUNTIME=ROOT.parents[1]/'原版FarmDESIGN运行时_20261027'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare(source, runtime):
    source=source.resolve(strict=True)
    runtime=runtime.resolve()
    if runtime==source or source in runtime.parents or runtime in source.parents:
        raise ValueError('The runtime must be separate from the original author package')
    required=['Bin/FarmDESIGN.exe','Bin/DAL.dll','Bin/DE.dll','Bin/NetworkMetrics.dll','Bin/ParetoDE.dll','Input/FarmDB.mdb','Input/de.mdb']
    identities={name:sha(source/name) for name in required}
    runtime.mkdir(parents=True,exist_ok=True)
    if (runtime/'source-identity.json').exists():
        saved=json.loads((runtime/'source-identity.json').read_text(encoding='utf-8'))
        if saved['hashes']!=identities:
            raise ValueError('Existing runtime uses a different author package; choose a new runtime path')
    def copy_if_changed(src,dst):
        target=Path(dst).resolve()
        target.relative_to(runtime)
        if target.exists() and sha(Path(src))==sha(target):return str(target)
        return shutil.copy2(src,dst)
    for directory in ['Bin','Input','Docs']:
        shutil.copytree(source/directory,runtime/directory,dirs_exist_ok=True,copy_function=copy_if_changed)
    (runtime/'Output').mkdir(exist_ok=True)
    # Configuration is changed only in this isolated copy.
    import xml.etree.ElementTree as ET
    config=runtime/'Bin/applConfig.FarmDESIGN.ini'
    tree=ET.parse(config)
    for element in tree.getroot().findall('element'):
        if element.findtext('name')=='InputDirectoryPath':element.find('value').text=str(runtime/'Input')+os.sep
        if element.findtext('name')=='OutputDirectoryPath':element.find('value').text=str(runtime/'Output')+os.sep
    tree.write(config,encoding='utf-8',xml_declaration=True)
    adaptations=[]
    matrix=runtime/'Bin/Images/FlowMatrix.txt'
    source_matrix=source/'Bin/Images/FlowMatrix.txt'
    if matrix.exists():
        lines=matrix.read_text(encoding='utf-8-sig').splitlines()
        rows=[line.split('\t') for line in lines if line.strip()]
        if len(rows)==2 and all(len(row)==35 for row in rows):
            # The binary exposes 39 sNPK fields. The four appended fields are
            # efficiencies, not mass flows; -1 is the native "ignore" index.
            matrix.write_text('\n'.join('\t'.join(row+['-1']*4) for row in rows)+'\n',encoding='utf-8')
            adaptations.append({'path':'Bin/Images/FlowMatrix.txt','reason':'Retain 35 original flow indices; exclude four appended efficiency ratios using native -1 ignore indices','sourceSha256':sha(source_matrix),'runtimeSha256':sha(matrix),'originalIndicesPreserved':True})
    identity={'software':'FarmDESIGN','version':'4.21.5.0','source':str(source),'datasetDOI':'10.17632/n3sk27ggwf.1','license':'CC BY 4.0 (author dataset)', 'hashes':identities,'resourceAdaptations':adaptations}
    (runtime/'source-identity.json').write_text(json.dumps(identity,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    powershell=Path(os.environ.get('WINDIR',r'C:\Windows'))/'System32/WindowsPowerShell/v1.0/powershell.exe'
    exports={}
    for name,db in [('farm-tables','FarmDB.mdb'),('de-tables','de.mdb')]:
        dest=runtime/(name+'.json')
        subprocess.run([str(powershell),'-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(ROOT/'tools/farmdesign/export-tables.ps1'),'-Database',str(runtime/'Input'/db),'-Destination',str(dest)],check=True,timeout=90,capture_output=True)
        exports[name]=json.loads(dest.read_text(encoding='utf-8-sig'))
    data=exports['farm-tables'];de=exports['de-tables']
    cases=[]
    for farm in data['FRM']['rows']:
        farm_id=farm['FrmID']
        if farm_id==0:continue
        selected={name:[r for r in data[name]['rows'] if 'FrmID' not in r or r['FrmID']==farm_id] for name in TABLES}
        # Join tables have no FrmID and must follow the actual parent identifiers.
        for name,foreign,parent,key in [('RCR','RotID','ROT','RotID'),('ARR','AnmID','ANM','AnmID'),('CFR','CrpID','CRP','CrpID'),('CMR','CrpID','CRP','CrpID'),('CPR','CrpID','CRP','CrpID'),('GCR','GrpID','GRP','GrpID')]:
            ids={r[key] for r in selected[parent]}
            selected[name]=[r for r in selected[name] if r[foreign] in ids]
        auxiliary={name:[r for r in data[name]['rows'] if 'FrmID' not in r or r['FrmID']==farm_id] for name in ['NTE','PHO','VRS']}
        doc={'schema':'FarmSystemDesign.FarmDESIGN.NativeTables','schemaVersion':1,'farmId':farm_id,'tables':selected,'auxiliaryTables':auxiliary,
             'optimization':{'variables':[r for r in de.get('DVR',{}).get('rows',[]) if r['CasID']==farm_id],
                             'indicators':[r for r in de.get('OUV',{}).get('rows',[]) if r['CasID']==farm_id],
                             'settings':de.get('DEP',{}).get('rows',[{}])[0]},
             'provenance':{'kind':'author-example','source':'Ditzler et al. 2019 research data','doi':'10.17632/n3sk27ggwf.1','farmDBSHA256':identities['Input/FarmDB.mdb'],'notice':'Author example from Vietnam; not local observations in Hainan'}}
        cases.append(doc)
    asset=ROOT/'data/farmdesign/author-cases-2019.json'
    asset.parent.mkdir(parents=True,exist_ok=True)
    public_identity={key:value for key,value in identity.items() if key!='source'}
    mapping_path=ROOT/'data/farmdesign/native-field-map.json'
    field_map=json.loads(mapping_path.read_text(encoding='utf-8')) if mapping_path.exists() else {}
    labels={}
    for key,name in [('describe','D'),('explain','E')]:
        with (runtime/f'Bin/Files/Translations.{name}.EN.txt').open(encoding='cp1252',errors='replace') as file:
            labels[key]={row['VarName']:row for row in csv.DictReader(file,delimiter='\t') if row.get('VarName')}
    asset.write_text(json.dumps({'source':public_identity,'columns':{n:data[n]['columns'] for n in TABLES},'cases':cases,'fieldMap':field_map,'labels':labels},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    assert all(sha(source/name)==digest for name,digest in identities.items()),'Original author files changed unexpectedly'
    print(json.dumps({'runtime':str(runtime),'cases':len(cases),'sourceUnchanged':True,'assetBytes':asset.stat().st_size},ensure_ascii=False))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,default=DEFAULT_SOURCE)
    parser.add_argument('--runtime',type=Path,default=DEFAULT_RUNTIME)
    args=parser.parse_args()
    prepare(args.source,args.runtime)
