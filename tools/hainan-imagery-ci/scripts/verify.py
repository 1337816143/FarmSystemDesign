#!/usr/bin/python3
import json,hashlib,math
from pathlib import Path
import numpy as np
from PIL import Image
from paths import parser,activate
ap=parser('Validate complete native tiles,provenance,andLOD');ap.add_argument('--partial',action='store_true');ARGS=ap.parse_args();INPUT,OUT,ROOT=activate(ARGS);GRID=json.load(open(INPUT/'grid.json'));CAT=json.load(open(INPUT/'source-catalog.json'));INDEX={s['source_index']:s for s in CAT['scenes']}

def verify(allow_partial=False):
 rows=[];missing=[];total={str(i):0 for i in [0,1,2,3]};land={str(i):0 for i in [0,1,2,3]}
 for t in GRID['records']:
  p=OUT/'metadata'/(t['id']+'.json')
  if not p.exists():missing.append(t['id']);continue
  m=json.load(open(p))
  if not m['complete'] or m.get('method_version')!='v2-exact-transform':missing.append(t['id']);continue
  rgba=np.asarray(Image.open(OUT/m['image']).convert('RGBA'));st=np.asarray(Image.open(OUT/m['status_image']));pr=np.asarray(Image.open(OUT/m['source_date_image']).convert('RGB'));doy=pr[:,:,1].astype('uint16')+256*pr[:,:,2].astype('uint16');alpha=rgba[:,:,3]
  assert rgba.shape==(2048,2048,4)
  assert np.array_equal(alpha==255,st==2),(t['id'],'alpha/status')
  assert set(np.unique(alpha)).issubset({0,255})
  assert np.array_equal(pr[:,:,0]>0,st==2),(t['id'],'source/status')
  assert np.array_equal(doy>0,st==2),(t['id'],'date/status')
  for idx in np.unique(pr[:,:,0]):
   if not idx:continue
   assert int(idx) in INDEX
   import datetime
   expected=datetime.date.fromisoformat(INDEX[int(idx)]['datetime'][:10]).timetuple().tm_yday
   assert np.all(doy[pr[:,:,0]==idx]==expected),(t['id'],'date/catalog mismatch')
  assert int((st==2).sum())==sum(a.get('contributing_pixels',0) for a in m['attempts'])
  for a in m['attempts']:
   if a.get('contributing_pixels',0):
    ck=a.get('raw_pixel_checks',{});assert ck.get('count',0)>0 and ck.get('rgb_mismatches')==0 and ck.get('scl_guard_mismatches')==0,(t['id'],'missing/failed live source controls')
  assert int((st==2).sum())<=m['stats']['source_observed_pixels']
  assert hashlib.sha256((OUT/m['image']).read_bytes()).hexdigest()==m['image_sha256']
  for k in total:total[k]+=m['stats']['status_counts'][k];land[k]+=m['stats']['approx_main_island_mask_status_counts'][k]
  rows.append({'id':t['id'],'status':'passed','bytes':m['image_bytes'],'accepted_pixels':m['stats']['status_counts']['2'],'contributing_scenes':sum(a.get('contributing_pixels',0)>0 for a in m['attempts']),'raw_rgb_control_points':sum(a.get('raw_pixel_checks',{}).get('count',0) for a in m['attempts']),'actual_dates':m['actual_dates']})
 if missing and not allow_partial:raise AssertionError('Missing/incomplete native grid:'+str(missing))
 files=[{'path':str(p.relative_to(OUT)),'bytes':p.stat().st_size} for p in OUT.rglob('*') if p.is_file() and p.name!='verification.json']
 assert all(x['bytes']<10000000 for x in files)
 mfpath=OUT/'manifest.json';lod=[]
 if mfpath.exists():
  mf=json.load(open(mfpath))
  for r in mf['records']:
   if r['level']==0:continue
   p=OUT/r['preview'];assert p.exists();assert Image.open(p).size==(2048,2048);assert hashlib.sha256(p.read_bytes()).hexdigest()==r['sha256'];lod.append({'id':r['id'],'status':'passed','bytes':p.stat().st_size})
 result={'method_version':'v2-exact-transform','status':'passed' if not missing else 'partial-validation','expected_native_tiles':len(GRID['records']),'checked_native_tiles':len(rows),'missing_tiles':missing,'native_grid_complete':not missing,'native_pixel_count':sum(total.values()),'native_status_counts':total,'approx_main_island_mask_status_counts':land,'approx_main_island_mask_accepted_percent':100*land['2']/sum(land.values()) if sum(land.values()) else None,'coverage_denominator':'WGS84 display-pixel counts on nearest-sampled Esri2025 connected-main-island100m mask. Not surveyed land area or provincial completeness.','raw_rgb_and_guard_control_points':sum(r['raw_rgb_control_points'] for r in rows),'native_checks':rows,'lod_checks':lod,'payload_total_bytes':sum(f['bytes'] for f in files),'largest_blob_bytes':max((f['bytes'] for f in files),default=0),'all_blobs_under_10mb':True,'files':files,'quality_semantics':'Every accepted native display cell has precompression nonzero original TCI RGB and accepted native20m SCL with7x7 cloud/shadow/cirrus exclusion. SCL may miss haze/cloud; this is not independent cloud-free certification.'}
 (OUT/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in result.items() if k not in ['native_checks','lod_checks','files']},ensure_ascii=False,indent=2));return result
if __name__=='__main__':
 verify(ARGS.partial)
