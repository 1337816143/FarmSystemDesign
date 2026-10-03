#!/usr/bin/python3
"""Native-window Sentinel2 C1 RGB delivery. No full RGB COG download."""
import os,sys,json,time,math,re,hashlib,datetime,traceback
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import maximum_filter
from pyproj import Transformer
from osgeo import gdal,ogr
KIT=Path(__file__).resolve().parents[1]
INPUT=Path(os.environ.get('IMAGERY_INPUT_DIR',KIT/'inputs')).resolve()
ROOT=Path(os.environ.get('IMAGERY_WORK_DIR',KIT/'work')).resolve()
OUT=Path(os.environ.get('IMAGERY_OUTPUT_DIR',KIT/'generated')).resolve();TILES=OUT/'tiles';META=OUT/'metadata';AUDIT=OUT/'audit';LOGS=ROOT/'logs'
for p in [OUT,TILES,META,AUDIT,LOGS]:p.mkdir(parents=True,exist_ok=True)
METHOD_VERSION='v2-exact-transform'
GRID=json.load(open(INPUT/'grid.json'));CAT=json.load(open(INPUT/'source-catalog.json'));SCENES=CAT['scenes'];BYID={s['id']:s for s in SCENES}
OLDMETA=json.load(open(INPUT/'overview-provenance.json'));OLDINDEX={s['index']:s['id'] for s in OLDMETA['sources']}
OLDQA=np.load(INPUT/'overview-source-index.npz',allow_pickle=False);OLDPIX=OLDQA['source_index'];OLDQA.close()
CLEAR=np.zeros(256,dtype='uint8');CLEAR[[2,4,5,6]]=1
CLOUD=np.zeros(256,dtype='uint8');CLOUD[[3,8,9,10]]=1
gdal.UseExceptions()
for k,v in {'GDAL_DISABLE_READDIR_ON_OPEN':'EMPTY_DIR','CPL_VSIL_CURL_ALLOWED_EXTENSIONS':'.tif','CURL_CA_BUNDLE':'/etc/ssl/certs/ca-certificates.crt','GDAL_HTTP_TIMEOUT':'60','GDAL_HTTP_CONNECTTIMEOUT':'25','GDAL_HTTP_MAX_RETRY':'2','GDAL_HTTP_RETRY_DELAY':'2','GDAL_CACHEMAX':'24','VSI_CACHE':'FALSE','CPL_VSIL_CURL_CACHE_SIZE':'33554432'}.items():gdal.SetConfigOption(k,v)
gdal.SetCacheMax(24*1024*1024)
TRANS={}
def tx(epsg):
 if epsg not in TRANS:TRANS[epsg]=Transformer.from_crs(4326,epsg,always_xy=True)
 return TRANS[epsg]
def intersects(a,b):return a[0]<b[2] and a[2]>b[0] and a[1]<b[3] and a[3]>b[1]
def atomic_json(path,obj):
 t=path.with_suffix(path.suffix+'.tmp');t.write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':')));os.replace(t,path)
def global_window(bbox):
 b=OLDMETA['bbox'];h,w=OLDPIX.shape
 c0=max(0,math.floor((bbox[0]-b[0])/(b[2]-b[0])*w));c1=min(w,math.ceil((bbox[2]-b[0])/(b[2]-b[0])*w));r0=max(0,math.floor((b[3]-bbox[3])/(b[3]-b[1])*h));r1=min(h,math.ceil((b[3]-bbox[1])/(b[3]-b[1])*h))
 return OLDPIX[r0:r1,c0:c1]
def candidates(bbox):
 pix=global_window(bbox);ids,counts=np.unique(pix,return_counts=True);dominants=[OLDINDEX[int(i)] for i,c in sorted(zip(ids,counts),key=lambda t:-t[1]) if i and i in OLDINDEX]
 matches=[s for s in SCENES if intersects(s['bbox_wgs84'],bbox)]
 # Exact source footprint removes false-positive bbox corner intersections.
 poly=ogr.CreateGeometryFromJson(json.dumps({'type':'Polygon','coordinates':[[[bbox[0],bbox[1]],[bbox[2],bbox[1]],[bbox[2],bbox[3]],[bbox[0],bbox[3]],[bbox[0],bbox[1]]]]}))
 actual=[]
 for s in matches:
  geo=ogr.CreateGeometryFromJson(json.dumps(s['geometry']))
  if geo.Intersects(poly):actual.append(s)
 priority={sid:n for n,sid in enumerate(dominants)}
 actual.sort(key=lambda s:(priority.get(s['id'],1000),s['cloud_cover']+.35*(s.get('nodata_percent') or 0),s['datetime']))
 return actual,dominants

def read_scl_window(scene,bbox):
 ds=gdal.Open('/vsicurl/'+scene['assets']['scl']['href']);gt=ds.GetGeoTransform();inv=gdal.InvGeoTransform(gt)
 # Densified edges bound transformed windows; 4native20m pixels include7x7 cloud guard.
 v=np.linspace(0,1,9);lon=np.r_[bbox[0]+v*(bbox[2]-bbox[0]),bbox[0]+v*(bbox[2]-bbox[0]),np.full(9,bbox[0]),np.full(9,bbox[2])];lat=np.r_[np.full(9,bbox[1]),np.full(9,bbox[3]),bbox[1]+v*(bbox[3]-bbox[1]),bbox[1]+v*(bbox[3]-bbox[1])]
 x,y=tx(scene['epsg']).transform(lon,lat);cols=inv[0]+inv[1]*x+inv[2]*y;rows=inv[3]+inv[4]*x+inv[5]*y
 c0=max(0,math.floor(float(cols.min()))-4);r0=max(0,math.floor(float(rows.min()))-4);c1=min(ds.RasterXSize,math.ceil(float(cols.max()))+4);r1=min(ds.RasterYSize,math.ceil(float(rows.max()))+4)
 if c1<=c0 or r1<=r0:return None,None,None
 scl=ds.ReadAsArray(c0,r0,c1-c0,r1-r0);newgt=[gt[0]+c0*gt[1]+r0*gt[2],gt[1],gt[2],gt[3]+c0*gt[4]+r0*gt[5],gt[4],gt[5]]
 return scl,newgt,ds.GetProjection()
def warp_mask(arr,gt,wkt,bbox,size):
 ds=gdal.GetDriverByName('MEM').Create('',arr.shape[1],arr.shape[0],1,gdal.GDT_Byte);ds.SetGeoTransform(gt);ds.SetProjection(wkt);ds.GetRasterBand(1).WriteArray(arr)
 dst=gdal.Warp('',ds,format='MEM',dstSRS='EPSG:4326',outputBounds=bbox,width=size,height=size,resampleAlg='near',dstNodata=0,warpMemoryLimit=16,errorThreshold=0)
 out=dst.ReadAsArray();dst=None;ds=None;return out>0

def build(tile,debug=False):
 meta_path=META/(tile['id']+'.json')
 if meta_path.exists():
  m=json.load(open(meta_path))
  if m.get('complete') and m.get('method_version')==METHOD_VERSION and (OUT/m['image']).exists():print('SKIP',tile['id'],flush=True);return m
 start=time.time();log=LOGS/(tile['id']+'.gdal.log')
 if debug:
  gdal.SetConfigOption('CPL_LOG',str(log));gdal.SetConfigOption('CPL_DEBUG','ON');gdal.SetConfigOption('CPL_CURL_VERBOSE','YES')
 b=tile['bbox'];N=tile['width'];pix=tile['pixel_size_degrees'][0]
 rgba=np.zeros((N,N,4),dtype='uint8');source=np.zeros((N,N),dtype='uint8');doy=np.zeros((N,N),dtype='uint16');seen=np.zeros((N,N),dtype=bool);rejected=np.zeros((N,N),dtype=bool);rgbnodata=np.zeros((N,N),dtype=bool);pending=np.zeros((N,N),dtype=bool)
 choices,dominants=candidates(b);attempts=[]
 print('START',tile['id'],'candidates',len(choices),'dominants',dominants,flush=True)
 for scene in choices:
  if np.all(rgba[:,:,3]):break
  at={'id':scene['id'],'source_index':scene['source_index'],'datetime':scene['datetime'],'cloud_cover':scene['cloud_cover'],'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat()};t=time.time()
  for retry in range(3):
   try:
    scl,gt,wkt=read_scl_window(scene,b)
    if scl is None:at.update(status='no-intersecting-source-window',contributing_pixels=0);break
    good=(CLEAR[scl]>0)&(maximum_filter(CLOUD[scl],size=7,mode='constant',cval=0)==0)
    obs=warp_mask((scl>0).astype('uint8'),gt,wkt,b,N);clear=warp_mask(good.astype('uint8'),gt,wkt,b,N)
    seen|=obs;rejected|=obs&~clear;new=clear&(rgba[:,:,3]==0);nn=int(new.sum());at['scl_window_shape']=list(scl.shape);at['scl_clear_pixels']=int(clear.sum());at['scl_observed_pixels']=int(obs.sum());good=None
    if not nn:at.update(status='no-new-accepted-mask-pixels',contributing_pixels=0);break
    yy,xx=np.where(new);c0,c1=int(xx.min()),int(xx.max())+1;r0,r1=int(yy.min()),int(yy.max())+1
    sub=[b[0]+c0*pix,b[3]-r1*pix,b[0]+c1*pix,b[3]-r0*pix]
    ds=gdal.Open('/vsicurl/'+scene['assets']['visual']['href']);rgbds=gdal.Warp('',ds,format='MEM',dstSRS='EPSG:4326',outputBounds=sub,width=c1-c0,height=r1-r0,resampleAlg='near',srcNodata='None',dstNodata=0,overviewLevel='NONE',warpMemoryLimit=24,errorThreshold=0);rgb=np.moveaxis(rgbds.ReadAsArray(),0,-1);rgbds=None
    # Independent live-source controls: exact projected native pixel and7x7SCL guard.
    flat=np.flatnonzero(new[r0:r1,c0:c1]);chosen=flat[np.linspace(0,len(flat)-1,min(12,len(flat))).astype(int)];checks=[];rgbinv=gdal.InvGeoTransform(ds.GetGeoTransform());sclinv=gdal.InvGeoTransform(gt)
    for pos in chosen:
     qr,qc=divmod(int(pos),c1-c0);lon=b[0]+(c0+qc+.5)*pix;lat=b[3]-(r0+qr+.5)*pix;east,north=tx(scene['epsg']).transform(lon,lat);rc=math.floor(rgbinv[0]+rgbinv[1]*east+rgbinv[2]*north);rr=math.floor(rgbinv[3]+rgbinv[4]*east+rgbinv[5]*north);raw=ds.ReadAsArray(rc,rr,1,1)[:,0,0];sc=math.floor(sclinv[0]+sclinv[1]*east+sclinv[2]*north);sr=math.floor(sclinv[3]+sclinv[4]*east+sclinv[5]*north);patch=scl[max(0,sr-3):sr+4,max(0,sc-3):sc+4];guard_ok=bool(CLEAR[scl[sr,sc]] and not np.any(CLOUD[patch]));rgb_ok=bool(np.array_equal(raw,rgb[qr,qc]));checks.append({'target_col':c0+qc,'target_row':r0+qr,'source_col':rc,'source_row':rr,'rgb_exact':rgb_ok,'scl_guard_exact':guard_ok})
     if not rgb_ok or not guard_ok:raise RuntimeError('Exact-source control mismatch:'+json.dumps({'lon':lon,'lat':lat,'raw_rgb':raw.tolist(),'warp_rgb':rgb[qr,qc].tolist(),'scl_guard':guard_ok,'rgb_exact':rgb_ok}))
    at['raw_pixel_checks']={'count':len(checks),'rgb_mismatches':0,'scl_guard_mismatches':0,'controls':checks};ds=None;scl=None
    valid=np.any(rgb>0,axis=2);fill=new[r0:r1,c0:c1]&valid
    rgba[r0:r1,c0:c1,:3][fill]=rgb[fill];rgba[r0:r1,c0:c1,3][fill]=255;source[r0:r1,c0:c1][fill]=scene['source_index'];day=datetime.date.fromisoformat(scene['datetime'][:10]).timetuple().tm_yday;doy[r0:r1,c0:c1][fill]=day
    rgbnodata[r0:r1,c0:c1]|=new[r0:r1,c0:c1]&~valid
    at.update(status='rendered',contributing_pixels=int(fill.sum()),rgb_target_window=[c0,r0,c1,r1],rgb_read_output_pixels=int(rgb.shape[0]*rgb.shape[1]),retries=retry)
    break
   except Exception as e:
    at['last_error']=str(e);at['retries']=retry
    if retry==2:at.update(status='failed',contributing_pixels=0)
    else:time.sleep(2*(retry+1))
  at['elapsed_seconds']=round(time.time()-t,3);attempts.append(at)
  print('SOURCE',tile['id'],scene['id'],at['status'],at.get('contributing_pixels',0),at['elapsed_seconds'],flush=True)
 status=np.zeros((N,N),dtype='uint8');status[rejected]=1;status[rgbnodata]=3;status[rgba[:,:,3]>0]=2
 image_path=TILES/(tile['id']+'.webp');Image.fromarray(rgba).save(image_path,'WEBP',quality=88,method=6)
 status_path=AUDIT/(tile['id']+'-status.png');Image.fromarray(status).save(status_path,optimize=True)
 provenance=np.zeros((N,N,3),dtype='uint8');provenance[:,:,0]=source;provenance[:,:,1]=(doy&255).astype('uint8');provenance[:,:,2]=(doy>>8).astype('uint8');prov_path=AUDIT/(tile['id']+'-source-date.png');Image.fromarray(provenance).save(prov_path,optimize=True)
 # Mainland denominator is a documented approximate100m land mask, not an administrative polygon.
 md=gdal.Warp('',str(INPUT/'main-island-mask-100m.tif'),format='MEM',dstSRS='EPSG:4326',outputBounds=b,width=N,height=N,resampleAlg='near',errorThreshold=0,warpMemoryLimit=16);land=md.ReadAsArray()>0;md=None
 counts={str(k):int((status==k).sum()) for k in [0,1,2,3]};lc={str(k):int(((status==k)&land).sum()) for k in [0,1,2,3]}
 # Report measured HTTP response payload when verbose Range headers are available.
 transfer=None
 if log.exists():
  s=log.read_text(errors='replace');ranges=re.findall(r'content-range:\s*bytes\s+(\d+)-(\d+)/(\d+)',s,re.I);requested=re.findall(r'Downloading (\d+)-(\d+) \((https://[^)]+)\)',s)
  transfer={'response_range_bytes':sum(int(e)-int(a)+1 for a,e,total in ranges),'range_responses':len(ranges),'requested_range_bytes':sum(int(e)-int(a)+1 for a,e,u in requested),'range_requests':len(requested),'completed_single_206_responses':s.count('Got response_code=206'),'completed_multirange_batches':s.count('Download completed'),'method':'Response payload sums when Content-Range headers are logged; requested-span estimate otherwise. Includes completed multi-range batches, excludes HEAD/HTTP overhead.'}

 m={**tile,'transform_convention':'Rasterio/Affine[a,b,c,d,e,f]','gdal_transform':[b[0],pix,0,b[3],0,-pix],'method_version':METHOD_VERSION,'projection_error_threshold':0,'complete':not any(a['status']=='failed' for a in attempts),'image':str(image_path.relative_to(OUT)),'status_image':str(status_path.relative_to(OUT)),'status_preview':str(status_path.relative_to(OUT)),'source_date_image':str(prov_path.relative_to(OUT)),'source_date_encoding':'RGB8 lossless PNG: R=source_index(1-based source-catalog), G=2025 day-of-year lowbyte, B=highbyte; date=G+256*B. Index0 andday0 unavailable.','native_rgb_m':10,'native_scl_m':20,'rgb_resampling':'nearest native COG pixels with exact transformer(errorThreshold=0); no new source detail','quality_rule':'Original TCI RGB must have at least one nonzero channel. Native20m SCL must be2/4/5/6 and7x7 neighborhood (60m per-axis) must contain none of3/8/9/10; sample accepted mask by nearest-neighbor. Missing/rejected pixels transparent.','status_legend':{'0':'No accepted or rejected valid-SCL observation among processed candidates (including SCL0/unobserved)','1':'Observed but rejected by SCL class/60m cloud guard','2':'Accepted original RGB + SCL guard','3':'SCL accepted but tested RGB allzero'},'stats':{'pixel_count':N*N,'status_counts':counts,'source_observed_pixels':int(seen.sum()),'approx_main_island_mask_pixels':int(land.sum()),'approx_main_island_mask_status_counts':lc},'candidate_ids':[s['id'] for s in choices],'dominant_old_preview_sources':dominants,'attempts':attempts,'actual_dates':sorted(set(a['datetime'][:10] for a in attempts if a.get('contributing_pixels',0))),'image_bytes':image_path.stat().st_size,'image_sha256':hashlib.sha256(image_path.read_bytes()).hexdigest(),'status_bytes':status_path.stat().st_size,'source_date_bytes':prov_path.stat().st_size,'elapsed_seconds':round(time.time()-start,3),'transfer':transfer}
 atomic_json(meta_path,m);print('DONE',tile['id'],m['image_bytes'],m['status_bytes']+m['source_date_bytes'],m['elapsed_seconds'],transfer,flush=True)
 return m
if __name__=='__main__':
 raise SystemExit('Use scripts/generate.py with --inputs/--output/--work.')
