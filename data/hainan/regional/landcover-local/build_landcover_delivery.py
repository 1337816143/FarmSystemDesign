#!/usr/bin/env python3
"""Derive continuous, nearest-neighbour Hainan display grids from pinned 2025 classes."""
from pathlib import Path
import hashlib, json, math, time, sys, os
import numpy as np
from osgeo import gdal, osr
from PIL import Image

gdal.UseExceptions()
gdal.SetCacheMax(64*1024*1024)
ROOT=Path(__file__).resolve().parent
SOURCE=Path(os.environ.get('HAINAN_ESRI_SOURCE',str(ROOT/'source'/'esri49Q-2025.tif')))
SOURCE_SHA='8188a102f7ab2d131b74f74c22da2b5f1a63a977132e696684abb4aa514bdc90'
SOURCE_URL='https://lulctimeseries.blob.core.windows.net/lulctimeseriesv003/lc2025/49Q_20250101-20251231.tif'
DEST_PREFIX='data/hainan/regional/landcover-local/'
BOUNDS=[108.5,17.8,111.5,20.5]
STEP=.00009
CLASSES={0:'No data',1:'Water',2:'Trees',4:'Flooded vegetation',5:'Crops',7:'Built area',8:'Bare ground',9:'Snow / ice',10:'Clouds',11:'Rangeland'}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def bounds(gt,x,y,w,h):return [gt[0]+x*gt[1],gt[3]+(y+h)*gt[5],gt[0]+(x+w)*gt[1],gt[3]+y*gt[5]]
def meters(b,dx,dy):return [dx*111320*math.cos(math.radians((b[1]+b[3])/2)),dy*111320]
reuse_detail='--reuse-verified-detail' in sys.argv
previous=json.loads((ROOT/'landcover-local-manifest.json').read_text()) if reuse_detail else None
if previous:
 assert previous['source_sha256']==SOURCE_SHA
 prior_validation=json.loads((ROOT/'validation.json').read_text())
 assert not any(x['block'].startswith('detail-') for x in prior_validation['mismatches'])
previous_records={x['id']:x for x in previous['records']} if previous else {}
assert sha(SOURCE)==SOURCE_SHA
source=gdal.Open(str(SOURCE));inverse=gdal.InvGeoTransform(source.GetGeoTransform())
ll=osr.SpatialReference();ll.ImportFromEPSG(4326);ll.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
utm=osr.SpatialReference();utm.ImportFromEPSG(32649);utm.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
project=osr.CoordinateTransformation(ll,utm)
records=[];lod_summaries=[];checked=0;mis=[];written=[];started=time.monotonic()
for name,factor,minzoom,maxzoom in [('overview',16,0,9),('medium',4,10,11),('detail',1,12,18)]:
 folder=ROOT/'classes'/name;folder.mkdir(parents=True,exist_ok=True)
 d=gdal.Warp('',str(SOURCE),format='VRT',dstSRS='EPSG:4326',outputBounds=BOUNDS,xRes=STEP*factor,yRes=STEP*factor,resampleAlg='near',srcNodata=0,dstNodata=0,errorThreshold=0,overviewLevel='NONE',warpMemoryLimit=32,multithread=False)
 gt=d.GetGeoTransform();nx,ny=d.RasterXSize,d.RasterYSize;hist=np.zeros(256,dtype=np.int64);nr=0;empty=0;bytes_out=0
 block=2048 if name=='overview' else 1024
 for y in range(0,ny,block):
  for x in range(0,nx,block):
   w,h=min(block,nx-x),min(block,ny-y);prior_id=f'{name}-{y//block:02d}-{x//block:02d}';cached=name=='detail' and reuse_detail
   if cached:
    pr=previous_records[prior_id];assert pr['width']==w and pr['height']==h and pr['bounds_wsen']==bounds(gt,x,y,w,h)
    if pr['file']:
     assert sha(ROOT/pr['file'])==pr['sha256'];a=np.array(Image.open(ROOT/pr['file']))
    else:a=np.zeros((h,w),dtype=np.uint8)
   else:a=d.ReadAsArray(x,y,w,h)
   counts=np.bincount(a.ravel(),minlength=256);hist+=counts
   assert all(counts[k]==0 for k in range(256) if k not in CLASSES)
   b=bounds(gt,x,y,w,h);id=f'{name}-{y//block:02d}-{x//block:02d}';file=f'classes/{name}/{id}.png';valid=int(a.size-counts[0]);nr+=1
   row={'id':id,'lod':name,'group':'main','scope':'main-island-and-nearshore-query-rectangle-not-administrative-boundary','crs':'EPSG:4326','bbox':b,'bounds_wsen':b,'width':w,'height':h,'transform':[b[0],gt[1],0,b[3],0,gt[5]],'source_resolution_m':10,'pixel_size_m':meters(b,gt[1],-gt[5]),'pixel_size_degrees':[gt[1],-gt[5]],'resampling':'nearest','min_zoom':minzoom,'max_zoom':maxzoom,'encoding':'uint8 grayscale; red channel equals original class code','total_pixels':int(a.size),'nonzero_pixels':valid,'cloud_pixels':int(counts[10]),'crops_pixels':int(counts[5]),'class_histogram':{str(k):int(counts[k]) for k in CLASSES if counts[k]},'source_nodata':0,'status':'available' if valid else 'source-nodata'}
   if valid:
    p=ROOT/file
    if not cached:Image.fromarray(a).save(p,optimize=True)
    row.update(url=file,values_url=file,preview=file,values=file,file=file,sha256=sha(p),bytes=p.stat().st_size);bytes_out+=p.stat().st_size;written.append(p)
   else:row.update(url=None,values_url=None,preview=None,values=None,file=None);empty+=1
   # Verify nine display pixel centres against exact native UTM source cells.
   for yy in sorted(set([min(h-1,h//8),h//2,min(h-1,7*h//8)])):
    for xx in sorted(set([min(w-1,w//8),w//2,min(w-1,7*w//8)])):
     lon=gt[0]+(x+xx+.5)*gt[1];lat=gt[3]+(y+yy+.5)*gt[5];e,n,_=project.TransformPoint(lon,lat);sx=int(math.floor(inverse[0]+inverse[1]*e+inverse[2]*n));sy=int(math.floor(inverse[3]+inverse[4]*e+inverse[5]*n));v=0
     if 0<=sx<source.RasterXSize and 0<=sy<source.RasterYSize:v=int(source.ReadAsArray(sx,sy,1,1)[0,0])
     checked+=1
     if v!=int(a[yy,xx]):mis.append({'block':id,'lon':lon,'lat':lat,'source':v,'display':int(a[yy,xx])})
   records.append(row)
  if y%4096==0:print(json.dumps({'lod':name,'row':y,'rows':ny,'written_bytes':bytes_out,'elapsed_s':round(time.monotonic()-started,1)}),flush=True)
 assert sum(int(r['total_pixels']) for r in records if r['lod']==name)==nx*ny
 lod_summaries.append({'id':name,'factor':factor,'width':nx,'height':ny,'actual_bbox':bounds(gt,0,0,nx,ny),'pixel_size_degrees':[gt[1],-gt[5]],'min_zoom':minzoom,'max_zoom':maxzoom,'grid_blocks':nr,'empty_source_blocks':empty,'files':nr-empty,'image_bytes':bytes_out,'class_histogram':{str(k):int(hist[k]) for k in CLASSES if hist[k]},'total_pixels':int(hist.sum())})
print(json.dumps({'point_checks':checked,'mismatches':len(mis),'examples':mis[:4]}),flush=True)
manifest={'version':'2026-10-03-mainland-local-v1','product':'Esri / Impact Observatory / Microsoft 2025 10 m land cover v003','year':2025,'source_url':SOURCE_URL,'source_sha256':SOURCE_SHA,'source_bytes':SOURCE.stat().st_size,'source_crs':'EPSG:32649','source_native_resolution_m':10,'license':'CC BY 4.0','attribution':'Impact Observatory, Microsoft, Esri. Contains modified Copernicus Sentinel data (2025).','query_bbox_wsen':BOUNDS,'coverage_bbox_wsen':next(x['actual_bbox'] for x in lod_summaries if x['id']=='detail'),'scope':'Continuous display grid for Hainan main island and nearshore geographic query rectangle; includes ocean and unrelated mainland land. Not an administrative extent. Offshore groups retain separate official-service access.','display_crs':'EPSG:4326','processing':'Full-resolution-source nearest-neighbour resampling (source overviews disabled; exact coordinate transform), without smoothing, filling, class changes or crop-only prefilter. Pixel centres independently transformed to source UTM and checked. Per-LOD native-source nearest values need not equal a mode aggregation of finer display cells.','encoding':{'format':'PNG grayscale L','value':'Original integer class in browser red channel','nodata':0,'cloud_class':10,'crops_class':5,'classes':CLASSES},'limits':['Annual land-cover model classes are not statutory cultivated land, cadastral boundaries, crop species or field measurements.','Crops-only hides non-5 valid classes; its transparent area is not automatically missing data.','Cloud class 10 is retained as cloud/unclassified; no artificial infill.','Displayed detail pixels are about 9.4-9.5 m east-west by 10.02 m north-south; they are reprojected nearest-neighbour derivatives of native 10 m source pixels.','No local Hainan independent classification accuracy claim.'], 'lods':lod_summaries,'records':records,'validation':{'all_detail_grid_cells_accounted_for':True,'source_pixel_center_checks':checked,'source_pixel_mismatches':len(mis),'mismatch_examples':mis[:20],'all_classes_in_official_legend':True,'source_sha256_verified':True}}
dump(ROOT/'landcover-local-manifest.json',manifest)
dump(ROOT/'validation.json',{'source_sha256':SOURCE_SHA,'lods':lod_summaries,'point_checks':checked,'mismatches':mis,'processing_seconds':time.monotonic()-started})
files=written+[ROOT/'landcover-local-manifest.json',ROOT/'validation.json',Path(__file__)]
mapping=[{'source':str(p),'target':DEST_PREFIX+str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':sha(p)} for p in files]
dump(ROOT/'delivery-mapping.json',{'base_commit':'2b89780708154f2763538419f49849a68d5da7d2','files':mapping,'bytes':sum(r['bytes'] for r in mapping),'record_count':len(records),'status':'needs-review' if mis else 'ready','validation':'validation.json'})
print(json.dumps({'file_count':len(files),'bytes':sum(r['bytes'] for r in mapping),'records':len(records),'mismatches':len(mis),'seconds':round(time.monotonic()-started,1)}),flush=True)
