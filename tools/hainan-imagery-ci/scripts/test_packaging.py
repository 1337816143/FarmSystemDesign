#!/usr/bin/python3
"""Packaging-layer synthetic-byte round trip; not a satellite-data validation."""
import hashlib,json,subprocess,sys,tempfile
from pathlib import Path
SCRIPTS=Path(__file__).resolve().parent
with tempfile.TemporaryDirectory(prefix='hainan-pack-test-') as t:
 root=Path(t);src=root/'synthetic-fixture';src.mkdir();parts=root/'parts';dst=root/'reassembled'
 # These metadata stubs exercise only packaging gates and do not represent imagery.
 (src/'manifest.json').write_text(json.dumps({'test_fixture':'synthetic packaging bytes only','native_grid_complete':True,'completed_native_tiles':114,'method_version':'v2-exact-transform','records':[{}]*170}))
 (src/'verification.json').write_text(json.dumps({'test_fixture':'synthetic packaging bytes only','status':'passed','native_grid_complete':True,'checked_native_tiles':114}))
 for i in range(8):(src/f'test-member-{i}.bin').write_bytes(bytes([i])*6144)
 subprocess.run([sys.executable,str(SCRIPTS/'package_artifacts.py'),'--input',str(src),'--output',str(parts),'--max-zip-mib','.015','--max-total-mib','1'],check=True,stdout=subprocess.DEVNULL)
 subprocess.run([sys.executable,str(SCRIPTS/'reassemble_artifacts.py'),'--index',str(parts/'artifact-index.json'),'--parts',str(parts),'--output',str(dst)],check=True,stdout=subprocess.DEVNULL)
 for p in src.iterdir():assert (dst/p.name).read_bytes()==p.read_bytes()
 idx=json.load(open(parts/'artifact-index.json'));assert len(idx['parts'])>1 and all(p['bytes']<=int(.015*1024**2) for p in idx['parts'])
 print(json.dumps({'status':'passed','test_kind':'synthetic packaging roundtrip only','zip_groups':len(idx['parts']),'files_reassembled':len(idx['members']),'every_member_identical':True},indent=2))
