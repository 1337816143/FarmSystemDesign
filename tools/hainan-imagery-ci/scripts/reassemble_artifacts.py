#!/usr/bin/python3
"""Verify archives and reconstruct files; never concatenate split binary data."""
import argparse,hashlib,json,stat,zipfile
from pathlib import Path,PurePosixPath
p=argparse.ArgumentParser();p.add_argument('--index',type=Path,required=True);p.add_argument('--parts',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();idx=json.load(open(a.index));out=a.output.resolve();out.mkdir(parents=True,exist_ok=True)
def hashfile(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
expected={m['path']:m for m in idx['members']};seen=set()
for part in idx['parts']:
 found=list(a.parts.rglob(part['filename']));assert len(found)==1,('Missing/ambiguous complete ZIP part',part['filename'])
 path=found[0];assert path.stat().st_size==part['bytes'] and hashfile(path)==part['sha256'],('Archive hash mismatch',path.name)
 with zipfile.ZipFile(path) as z:
  assert z.testzip() is None
  pm=json.loads(z.read('part-manifest.json'));assert pm['dataset_content_sha256']==idx['dataset_content_sha256']
  assert set(z.namelist())=={m['path'] for m in pm['members']}|{'part-manifest.json'}
  for m in pm['members']:
   rel=PurePosixPath(m['path']);assert not rel.is_absolute() and '..' not in rel.parts and '\\' not in str(rel)
   info=z.getinfo(m['path']);assert not stat.S_ISLNK(info.external_attr>>16)
   assert m==expected[m['path']] and m['path'] not in seen
   target=out.joinpath(*rel.parts);assert target.resolve().is_relative_to(out)
   if target.exists():assert target.is_file() and target.stat().st_size==m['bytes'] and hashfile(target)==m['sha256'],('Existing different file; refuse overwrite',str(target))
   else:
    target.parent.mkdir(parents=True,exist_ok=True);h=hashlib.sha256();n=0
    with z.open(m['path']) as source,target.open('wb') as sink:
     for b in iter(lambda:source.read(1024*1024),b''):sink.write(b);h.update(b);n+=len(b)
    assert n==m['bytes'] and h.hexdigest()==m['sha256'],('Member hash mismatch',m['path'])
   seen.add(m['path'])
assert seen==set(expected),('Missing members',sorted(set(expected)-seen))
print(json.dumps({'status':'passed','files_reassembled':len(seen),'payload_bytes':idx['payload_bytes'],'dataset_content_sha256':idx['dataset_content_sha256']},indent=2))
