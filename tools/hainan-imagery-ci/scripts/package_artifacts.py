#!/usr/bin/python3
"""Pack complete generated data into whole-member ZIP groups <=20MiB."""
import argparse,hashlib,json,os,zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--max-zip-mib',type=float,default=20);p.add_argument('--max-total-mib',type=float,default=220);a=p.parse_args();src=a.input.resolve();dst=a.output.resolve();dst.mkdir(parents=True,exist_ok=True);limit=int(a.max_zip_mib*1024**2)
def canonical(x):return json.dumps(x,sort_keys=True,separators=(',',':')).encode()
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
verification=json.load(open(src/'verification.json'));manifest=json.load(open(src/'manifest.json'))
assert verification['status']=='passed' and verification['native_grid_complete'] and verification['checked_native_tiles']==114
assert manifest['native_grid_complete'] and manifest['completed_native_tiles']==114 and len(manifest['records'])==170
assert manifest['method_version']=='v2-exact-transform'
files=[]
for f in sorted(src.rglob('*')):
 if not f.is_file():continue
 rel=f.relative_to(src).as_posix();n=f.stat().st_size
 assert not f.is_symlink() and n<10000000,(rel,'unexpected symlink or blob>=10MB')
 files.append({'path':rel,'bytes':n,'sha256':sha(f)})
total=sum(x['bytes'] for x in files)
assert total<=a.max_total_mib*1024**2,('Output budget exceeded',total,a.max_total_mib)
dataset_hash=hashlib.sha256(canonical(files)).hexdigest()
def partmeta(items,number):return {'schema':'whole-member-zip-v1','dataset_content_sha256':dataset_hash,'part_number':number,'members':items}
def zip_size(items,number):
 meta=canonical(partmeta(items,number));entries=items+[{'path':'part-manifest.json','bytes':len(meta)}]
 return 22+sum(e['bytes']+76+2*len(e['path'].encode()) for e in entries)
groups=[];current=[]
for f in files:
 if current and zip_size(current+[f],len(groups)+1)>limit:groups.append(current);current=[]
 assert zip_size([f],len(groups)+1)<=limit,(f['path'],'single member does not fit')
 current.append(f)
if current:groups.append(current)
parts=[]
for i,items in enumerate(groups,1):
 name=f'hainan-imagery-part-{i:03d}.zip';path=dst/name
 with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_STORED,allowZip64=False) as z:
  for item in items:z.write(src/item['path'],item['path'])
  z.writestr('part-manifest.json',canonical(partmeta(items,i)))
 assert path.stat().st_size<=limit,(name,path.stat().st_size,limit)
 with zipfile.ZipFile(path) as z:assert z.testzip() is None
 parts.append({'filename':name,'artifact_name':name[:-4],'bytes':path.stat().st_size,'sha256':sha(path),'member_count':len(items),'member_payload_bytes':sum(x['bytes'] for x in items)})
index={'schema':'whole-member-zip-v1','method_version':manifest['method_version'],'dataset_content_sha256':dataset_hash,'file_count':len(files),'payload_bytes':total,'zip_part_limit_bytes':limit,'artifact_envelope_guidance':'Upload each ZIP as a separate artifact, compression-level0. Every part<=20MiB leaves margin below24MiB artifact and32MiB materialization limits. Do not upload all parts as one artifact.','parts':parts,'members':files}
(dst/'artifact-index.json').write_bytes(canonical(index));print(json.dumps({'files':len(files),'payload_bytes':total,'parts':parts},indent=2))
