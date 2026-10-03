#!/usr/bin/python3
"""Verify every kit member and restrict public source URLs before any network work."""
import argparse,hashlib,json
from pathlib import Path
from urllib.parse import urlsplit
p=argparse.ArgumentParser();p.add_argument('--kit',type=Path,default=Path(__file__).resolve().parents[1]);a=p.parse_args();root=a.kit.resolve();manifest=json.load(open(root/'SHA256SUMS.json'))
for f in manifest['files']:
 p=root/f['path'];assert p.is_file() and not p.is_symlink();data=p.read_bytes();assert len(data)==f['bytes'] and hashlib.sha256(data).hexdigest()==f['sha256'],('Kit member mismatch',f['path'])
cat=json.load(open(root/'inputs/source-catalog.json'));assert len(cat['scenes'])==63
for s in cat['scenes']:
 assert s['source_index'] in range(1,64) and s.get('geometry')
 for key,tail,res in [('visual','/TCI.tif',10),('scl','/SCL.tif',20)]:
  asset=s['assets'][key];u=urlsplit(asset['href']);assert u.scheme=='https' and u.hostname=='e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com' and u.path.startswith('/sentinel-2-c1-l2a/') and u.path.endswith(tail) and not u.query and not u.username and not u.password;assert asset['native_resolution_m']==res
assert len({s['source_index'] for s in cat['scenes']})==63
assert len(json.load(open(root/'inputs/grid.json'))['records'])==114
print(json.dumps({'status':'passed','kit_files':len(manifest['files']),'kit_payload_bytes':sum(x['bytes'] for x in manifest['files']),'public_source_scenes':63,'native_grid_tiles':114},indent=2))
