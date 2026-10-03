#!/usr/bin/python3
"""Derive compact display LODs directly from completed native-resolution tiles."""
import json,math,time,hashlib,os
from pathlib import Path
import numpy as np
from PIL import Image
from paths import parser,activate
ap=parser('Build nearest-neighbor display LODs');ap.add_argument('--partial',action='store_true');ARGS=ap.parse_args();INPUT,OUT,ROOT=activate(ARGS);SIZE=2048
GRID=json.load(open(INPUT/'grid.json'));BASE={r['id']:r for r in GRID['records']}
ZOOM={0:(14,22),1:(13,13),2:(12,12),3:(11,11),4:(0,10)}
def save_json(path,obj):
 t=path.with_suffix('.json.tmp');t.write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':')));os.replace(t,path)
def record(m):
 lv=m['level'];lo,hi=ZOOM[lv]
 return {'id':m['id'],'level':lv,'col':m['col'],'row':m['row'],'crs':'EPSG:4326','bounds_wsen':m['bounds_wsen'],'width':m['width'],'height':m['height'],'pixel_size_degrees':m['pixel_size_degrees'],'transform':m['transform'],'transform_convention':'Rasterio/Affine[a,b,c,d,e,f]','gdal_transform':m['gdal_transform'],'display_pixel_m_at_center':m['display_pixel_m_at_center'],'native_rgb_m':10,'preview':m['image'],'metadata':'metadata/'+m['id']+'.json','min_zoom':lo,'max_zoom':hi,'status_image':m.get('status_image'),'status_preview':m.get('status_image'),'source_date_image':m.get('source_date_image'),'image_bytes':m['image_bytes'],'sha256':m['image_sha256'],'complete':m['complete']}
def main(allow_partial=False):
 metadata={}
 for t in GRID['records']:
  p=OUT/'metadata'/(t['id']+'.json')
  if p.exists():
   m=json.load(open(p))
   if m.get('complete') and m.get('method_version')=='v2-exact-transform':metadata[t['id']]=m
 if len(metadata)!=len(BASE) and not allow_partial:raise RuntimeError(f'Native grid not complete:{len(metadata)}/{len(BASE)}')
 parents=[]
 for lv in range(1,5):
  groups={}
  for t in GRID['records']:groups.setdefault((t['col']//2**lv,t['row']//2**lv),[]).append(t)
  for (c,r),children in sorted(groups.items()):
   if any(t['id'] not in metadata for t in children):continue
   ident=f'{lv}-{c}-{r}';dest=OUT/'tiles'/(ident+'.webp');mp=OUT/'metadata'/(ident+'.json')
   rgba=Image.new('RGBA',(SIZE,SIZE),(0,0,0,0));status=np.zeros((SIZE,SIZE),dtype='uint8');source_counts={};dates=set();childmeta=[]
   side=SIZE//(2**lv)
   for t in children:
    m=metadata[t['id']];childmeta.append(m);x=(t['col']-c*2**lv)*side;y=(2**lv-1-(t['row']-r*2**lv))*side
    im=Image.open(OUT/m['image']).convert('RGBA').resize((side,side),Image.Resampling.NEAREST);rgba.paste(im,(x,y));st=np.array(Image.open(OUT/m['status_image']).resize((side,side),Image.Resampling.NEAREST));status[y:y+side,x:x+side]=st;dates.update(m['actual_dates'])
    for a in m['attempts']:
     if a.get('contributing_pixels'):source_counts[a['id']]=source_counts.get(a['id'],0)+a['contributing_pixels']
   rgba.save(dest,'WEBP',quality=88,method=6)
   status_path=OUT/'audit'/(ident+'-status.png');Image.fromarray(status).save(status_path,optimize=True)
   px=GRID['base_pixel_degrees']*(2**lv);step=px*SIZE;b=[c*step,r*step,(c+1)*step,(r+1)*step];mid=(b[1]+b[3])/2
   md={'id':ident,'level':lv,'col':c,'row':r,'crs':'EPSG:4326','width':SIZE,'height':SIZE,'bounds_wsen':b,'bbox':b,'pixel_size_degrees':[px,px],'transform':[px,0,b[0],0,-px,b[3]],'transform_convention':'Rasterio/Affine[a,b,c,d,e,f]','gdal_transform':[b[0],px,0,b[3],0,-px],'display_pixel_m_at_center':[px*111320*math.cos(math.radians(mid)),px*111320],'native_rgb_m':10,'native_scl_m':20,'method_version':'v2-exact-transform','complete':True,'image':str(dest.relative_to(OUT)),'status_image':str(status_path.relative_to(OUT)),'status_preview':str(status_path.relative_to(OUT)),'image_bytes':dest.stat().st_size,'image_sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'children_native':[t['id'] for t in children],'actual_dates':sorted(dates),'sources_contributing_native_pixels':source_counts,'stats':{'pixel_count':SIZE*SIZE,'display_status_counts':{str(i):int((status==i).sum()) for i in [0,1,2,3]}},'method':'Display overview sampled directly by nearest-neighbor from native-level same-origin tiles; no RGB averaging into clouds/nodata. Missing grid children remain transparent. Native-level PNG evidence is authoritative for per-pixel source/date/status; overview is not a native10m quantitative raster.'}
   save_json(mp,md);parents.append(md);print('LOD',ident,'bytes',md['image_bytes'],flush=True)
 allm=list(metadata.values())+parents;records=[record(m) for m in sorted(allm,key=lambda m:(-m['level'],-m['row'],m['col']))]
 mf={'version':GRID['version'],'method_version':'v2-exact-transform','dataset':'Sentinel-2 C1 L2A 2025 continuous Hainan-main-island display mosaic','scope':GRID['selection'],'crs':'EPSG:4326','native_rgb_m':10,'native_scl_m':20,'base_pixel_degrees':GRID['base_pixel_degrees'],'tile_size':SIZE,'source_catalog':'source-catalog.json','source_notices':'source-notices.json','expected_native_tiles':len(BASE),'completed_native_tiles':len(metadata),'native_grid_complete':len(metadata)==len(BASE),'lod_policy':'Choose one active level by zoom or screen resolution; fetch only intersecting viewport records, cancel stale requests, decoded-RGBA LRU budget~8tiles. Do not fetch every tile or all LODs at once.','levels':[{'level':lv,'pixel_size_degrees':[GRID['base_pixel_degrees']*2**lv]*2,'min_zoom':ZOOM[lv][0],'max_zoom':ZOOM[lv][1],'expected_tiles':len(set((t['col']//2**lv,t['row']//2**lv) for t in GRID['records'])),'completed_tiles':sum(r['level']==lv for r in records)} for lv in range(5)],'records':records,'attribution':'Contains modified Copernicus Sentinel data(2025); Earth Search/Element84 public C1 L2A COGs','limitations':['Multi-date display mosaic, not single-date or certified cloud-free imagery','Source10m; WGS84 display pixels are approximately9.4–9.5m east-west and10.019m north-south with nearest-neighbor reprojection; no finer source detail is created','Mask-derived main-island grid with300m coastline selection buffer; not an administrative boundary or exhaustive offshore-island inventory','Transparent cells retain missing source, quality rejection or RGB nodata; statuses stored separately','Radiometric analysis must use original reflectance assets; lossy WebP is for display only']}
 save_json(OUT/'manifest.json',mf)
 if (INPUT/'source-catalog.json').exists():(OUT/'source-catalog.json').write_bytes((INPUT/'source-catalog.json').read_bytes())
 if (INPUT/'source-notices.json').exists():(OUT/'source-notices.json').write_bytes((INPUT/'source-notices.json').read_bytes())
 print('MANIFEST',len(records),'native',len(metadata),'/',len(BASE),flush=True)
if __name__=='__main__':
 main(ARGS.partial)
