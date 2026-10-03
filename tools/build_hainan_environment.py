#!/usr/bin/python3
"""Rebuild public environmental assets in the dot cloud with preinstalled GDAL.
No keys/accounts. Run /usr/bin/python3 scripts/build_environment.py [dsm|rain|soil|all].
Outputs are physical rasters, value PNGs and audit JSON. Cache is not deployed.
"""
from pathlib import Path
import os
import sys,json,hashlib,urllib.request,urllib.parse,math,time,concurrent.futures,shutil
import numpy as np
from PIL import Image
from osgeo import gdal,osr
REPO=Path(__file__).resolve().parents[1]
ROOT=Path(os.environ.get('HAINAN_ENV_WORKDIR',str(REPO/'.data-cache/hainan-environment'))).resolve(); CACHE=ROOT/'cache'; OUT=Path(os.environ.get('HAINAN_ENV_ASSET_DIR',str(REPO/'data/hainan/regional/environment'))).resolve()
for p in [CACHE,OUT]:p.mkdir(parents=True,exist_ok=True)
gdal.UseExceptions()
for k,v in {'GDAL_DISABLE_READDIR_ON_OPEN':'EMPTY_DIR','GDAL_HTTP_TIMEOUT':'90','GDAL_HTTP_MAX_RETRY':'2','GDAL_HTTP_RETRY_DELAY':'1','CPL_VSIL_CURL_ALLOWED_EXTENSIONS':'.tif'}.items():gdal.SetConfigOption(k,v)
AOI=json.loads((ROOT/'aoi-inventory.json' if (ROOT/'aoi-inventory.json').exists() else REPO/'data/hainan/regional/aoi-inventory.json').read_text());DATE='2026-10-03'
EPSG=osr.SpatialReference();EPSG.ImportFromEPSG(4326)

def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def write_json(p,obj):Path(p).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
def bbox(ds):
 t=ds.GetGeoTransform();return [t[0],t[3]+ds.RasterYSize*t[5],t[0]+ds.RasterXSize*t[1],t[3]]
def get(url,path):
 if not path.exists():
  with urllib.request.urlopen(url,timeout=120) as r:path.write_bytes(r.read())
 return path

def raster(path,a,gt,nodata=-9999,dt=gdal.GDT_Float32):
 d=gdal.GetDriverByName('GTiff').Create(str(path),a.shape[1],a.shape[0],1,dt,options=['COMPRESS=DEFLATE','PREDICTOR=3' if dt==gdal.GDT_Float32 else 'PREDICTOR=2','TILED=YES'])
 d.SetProjection(EPSG.ExportToWkt());d.SetGeoTransform(gt);d.GetRasterBand(1).SetNoDataValue(nodata);d.GetRasterBand(1).WriteArray(a);d.FlushCache();return d

def export(ds,stem,kind,valid=None,write_tif=True):
 a=ds.ReadAsArray();v=np.isfinite(a)&(a!=-9999) if valid is None else valid
 if kind.startswith('soil'):v&=a>0
 if kind=='rain':v&=a>=0
 # The source DSM uses zero for ocean. Numeric validity includes zero; positive-surface count is distinct.
 visible=v&(a!=0) if kind=='dsm' else v
 stops={'dsm':[(0,(224,239,193)),(100,(130,180,121)),(500,(179,167,111)),(1000,(166,117,89)),(1900,(250,243,230))],
 'rain':[(0,(246,233,174)),(1000,(156,202,150)),(2000,(64,155,160)),(3000,(46,100,166)),(4000,(72,51,125))],
 'soil-ph':[(40,(161,62,52)),(50,(204,103,64)),(60,(225,193,107)),(75,(83,151,121))],
 'soil-soc':[(0,(247,234,179)),(200,(220,210,130)),(400,(119,167,114)),(650,(33,109,112)),(1000,(37,57,91))]}[kind]
 rgba=np.zeros((*a.shape,4),np.uint8);vals=np.array([x[0] for x in stops]);colors=np.array([x[1] for x in stops])
 for c in range(3):rgba[:,:,c]=np.interp(a,vals,colors[:,c]).astype('uint8')
 rgba[:,:,3]=np.where(visible,220,0);rgba[~visible,:3]=0
 preview=OUT/(stem+'-preview.png');Image.fromarray(rgba).save(preview,optimize=True)
 # R+256G uint16, A=255 valid, A=0 invalid. DSM adds 500m; rain preserves 0.1mm; soils native integer.
 scale=10 if kind=='rain' else 1; offset=500 if kind=='dsm' else 0
 code=np.where(v,np.clip(np.rint(a*scale+offset),0,65535),0).astype('uint16')
 encoded=np.zeros((*a.shape,4),np.uint8);encoded[:,:,0]=code%256;encoded[:,:,1]=code//256;encoded[:,:,3]=np.where(v,255,0)
 values=OUT/(stem+'-values.png');Image.fromarray(encoded).save(values,optimize=True)
 count=int(v.sum());total=a.size
 rec={'id':stem,'kind':kind,'bounds_wsen':bbox(ds),'width':a.shape[1],'height':a.shape[0],'crs':'EPSG:4326','pixel_size_degrees':[ds.GetGeoTransform()[1],abs(ds.GetGeoTransform()[5])],
 'preview':preview.name,'values':values.name,'value_encoding':{'formula':f'(red + 256 * green - {offset}) / {10 if kind.startswith("soil") else scale}','nodata':'alpha == 0','units':{'dsm':'m','rain':'mm/year','soil-ph':'pH','soil-soc':'g/kg'}[kind]},
 'coverage':{'denominator':'all cells in this rectangular geographic query window; includes sea and sometimes other jurisdictions; not provincial land completeness','grid_cells':int(total),'valid_cells':count,'nodata_cells':int(total-count),'valid_percent':round(100*count/total,4),'cloud_cells':None,'cloud_note':'not applicable: this environmental product has no cloud class'},
 'statistics':{'min':float(a[v].min()) / (10 if kind.startswith('soil') else 1) if count else None,'max':float(a[v].max()) / (10 if kind.startswith('soil') else 1) if count else None,'mean':float(a[v].mean()) / (10 if kind.startswith('soil') else 1) if count else None},
 'status':'available' if count else 'unavailable-no-prediction','sha256':{'preview':sha(preview),'values':sha(values)}}
 if kind=='dsm':
  rec['coverage']['positive_surface_cells']=int((v&(a>0)).sum());rec['coverage']['zero_height_cells']=int((v&(a==0)).sum());rec['preview_note']='Zero-height cells are transparent in preview (usually ocean); numerical grid preserves source zero. Not a coastline or verified land mask.'
 if write_tif:
  t=OUT/(stem+'.tif');d=raster(t,np.where(v,a.astype('float32'),-9999),ds.GetGeoTransform());d.GetRasterBand(1).SetScale(0.1 if kind.startswith('soil') else 1);d.GetRasterBand(1).SetUnitType({'dsm':'m','rain':'mm/year','soil-ph':'pH','soil-soc':'g/kg'}[kind]);d=None
  rec['geotiff']=t.name;rec['sha256']['geotiff']=sha(t)
 write_json(OUT/(stem+'.json'),rec);return rec

def intersect(a,b):return a[0]<b[2] and a[2]>b[0] and a[1]<b[3] and a[3]>b[1]
def dsm():
 catalog_url='https://earth-search.aws.element84.com/v1/search?'+urllib.parse.urlencode({'collections':'cop-dem-glo-30','bbox':'108.5,3.5,118.1,20.5','limit':100})
 cat=get(catalog_url,CACHE/'dsm-stac-groups.json');j=json.loads(cat.read_text());features=j['features']
 # This request is <100; assert exact count so missing pagination cannot silently drop tiles.
 assert j.get('numberMatched',len(features))==len(features)
 features=[f for f in features if any(intersect(f['bbox'],a['bbox']) for a in AOI['groups'])]
 def prep(f):
  href=f['assets']['data']['href'].replace('s3://copernicus-dem-30m/','https://copernicus-dem-30m.s3.eu-central-1.amazonaws.com/')
  f['https_href']=href;p=CACHE/(f['id']+'-overview.tif')
  if not p.exists():
   d=gdal.Open('/vsicurl/'+href);o=gdal.Translate(str(p),d,width=450,height=450,resampleAlg='average',creationOptions=['COMPRESS=DEFLATE','PREDICTOR=3']);o=None;d=None
  print('DSM overview',f['id'],flush=True);return f
 with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:features=list(ex.map(prep,features))
 records=[]
 for aoi in AOI['groups']+AOI['places']:
  group=aoi in AOI['groups'];b=aoi['bbox'];matched=[f for f in features if intersect(f['bbox'],b)]
  resolution=8/3600 if group and aoi['id']!='nansha' else 32/3600 if group else 1/3600
  # Match the native DSM cell-edge lattice (half-arcsecond offset).
  if not group:
   origin=-resolution/2
   b=[math.floor((b[0]-origin)/resolution)*resolution+origin, math.floor((b[1]-origin)/resolution)*resolution+origin, math.ceil((b[2]-origin)/resolution)*resolution+origin, math.ceil((b[3]-origin)/resolution)*resolution+origin]
  # Grid-aligned output window; zero must not be treated as missing height.
  sources=[str(CACHE/(f['id']+'-overview.tif')) if group else '/vsicurl/'+f['https_href'] for f in matched]
  if sources:
   d=gdal.Warp('',sources,format='MEM',dstSRS='EPSG:4326',outputBounds=b,xRes=resolution,yRes=resolution,srcNodata=-9999,dstNodata=-9999,resampleAlg='average' if group else 'near')
  else:
   w=round((b[2]-b[0])/resolution);h=round((b[3]-b[1])/resolution)
   d=gdal.GetDriverByName('MEM').Create('',w,h,1,gdal.GDT_Float32);d.SetGeoTransform((b[0],(b[2]-b[0])/w,0,b[3],0,-(b[3]-b[1])/h));d.SetProjection(EPSG.ExportToWkt());d.GetRasterBand(1).Fill(-9999)
  rec=export(d,'dsm-'+aoi['id'],'dsm',write_tif=not group);rec.update({'aoi':aoi['id'],'group':aoi.get('group',aoi['id']),'level':'overview' if group else 'native-grid-window','native_resolution':'1 arcsecond (~30 m latitude); source DSM, not bare-earth terrain','render_resolution':'8 arcseconds (~247 m latitude)' if group and aoi['id']!='nansha' else '32 arcseconds (~989 m latitude)' if group else '1 arcsecond (~30 m latitude)','period':'TanDEM-X mainly 2011–2015; infill can be older; catalog 2021 publication is not observation date','source_tiles':[{'id':f['id'],'href':f['https_href']} for f in matched]})
  if not matched:rec['status']='unavailable-no-source-tile'
  write_json(OUT/('dsm-'+aoi['id']+'.json'),rec);records.append(rec);print('DSM asset',aoi['id'],rec['coverage'],flush=True)
 write_json(OUT/'dsm-manifest.json',{'dataset':'Copernicus DEM GLO-30','license':'Copernicus DEM free licence','license_url':'https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model','attribution':'© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved','accessed':DATE,'native_resolution_m':30,'source_catalog_query':catalog_url,'source_tile_count':len(features),'source_tiles':[{'id':f['id'],'bbox':f['bbox'],'href':f['https_href']} for f in features],'scope_note':AOI['scope_note'],'records':records})

def rain():
 href='https://data.chc.ucsb.edu/products/CHIRPS/v3.0/annual/global/tifs/chirps-v3.0.2025.tif'
 p=CACHE/'chirps-2025-expanded.tif'
 if not p.exists():
  o=gdal.Translate(str(p),'/vsicurl/'+href,projWin=[108.45,20.55,118.15,3.45],creationOptions=['COMPRESS=DEFLATE']);o=None
 d=gdal.Open(str(p));records=[]
 for aoi in AOI['groups']+AOI['places']:
  b=aoi['bbox'];w=gdal.Translate('',d,format='MEM',projWin=[b[0],b[3],b[2],b[1]])
  rec=export(w,'rain-2025-'+aoi['id'],'rain');rec.update({'aoi':aoi['id'],'group':aoi.get('group',aoi['id']),'level':'native-grid-window','native_resolution_degrees':0.05,'nominal_resolution_km':5.5,'period':'2025-01-01/2025-12-31','source':href,'spatial_warning':'Native cells are approximately 5.5 km. Window may be grid-aligned beyond the requested bbox. Not island-scale or parcel rainfall; no interpolation over ocean nodata.'})
  write_json(OUT/('rain-2025-'+aoi['id']+'.json'),rec);records.append(rec);print('RAIN',aoi['id'],rec['coverage'],flush=True)
 write_json(OUT/'rain-manifest.json',{'dataset':'CHIRPS v3.0 final annual precipitation','year':2025,'latest_completed_year':2025,'source':href,'source_directory':'https://data.chc.ucsb.edu/products/CHIRPS/v3.0/annual/global/tifs/','source_publication':'2026-03-06','period':'2025-01-01/2025-12-31','accessed':DATE,'license':'CC-BY-4.0; CHC additionally states public-domain waiver','license_url':'https://chc.ucsb.edu/data/chirps3','attribution':'Climate Hazards Center Infrared Precipitation with Stations version 3 (CHIRPS3), DOI:10.15780/G2JQ0P','native_resolution_degrees':0.05,'native_grid':list(d.GetGeoTransform()),'nodata':-9999,'nodata_note':'Source file has no GDAL nodata tag; actual negative fill is -9999; nonnegative finite values retained, including zero rainfall','scope_note':AOI['scope_note'],'records':records})

def soil():
 records=[];old=ROOT/'input/soil-history' if (ROOT/'input/soil-history').exists() else REPO/'data/hainan'
 # The existing cloud-restored value rasters retain their historical hashes and citation.
 for prop in ['ph','soc']:
  meta=json.loads((old/f'soil-{prop}-metadata.json').read_text());img=np.array(Image.open(old/f'soil-{prop}-values.png'))
  arr=img if prop=='ph' else img[:,:,0].astype('uint16')+256*img[:,:,1].astype('uint16')
  b=meta['bounds_wsen'];h,w=arr.shape;gt=(b[0],(b[2]-b[0])/w,0,b[3],0,-(b[3]-b[1])/h)
  d=raster(CACHE/f'soil-{prop}-main.tif',arr,gt,0,gdal.GDT_UInt16)
  main=export(d,f'soil-{prop}-main','soil-'+prop,arr>0);main.update({'aoi':'main','group':'main','level':'historical-restored-WCS-window','source_record':meta,'native_resolution_m':250,'period':'SoilGrids 2.0 model; not an annual soil survey','value_scale_to_physical':0.1,'source':'https://maps.isric.org/mapserv?map=/map/'+('phh2o' if prop=='ph' else 'soc')+'.map'})
  write_json(OUT/f'soil-{prop}-main.json',main);records.append(main)
  for aoi in AOI['places']:
   if aoi['group']=='main':
    b=aoi['bbox'];sub=gdal.Translate('',d,format='MEM',projWin=[b[0],b[3],b[2],b[1]])
    rec=export(sub,f'soil-{prop}-'+aoi['id'],'soil-'+prop);rec.update({'aoi':aoi['id'],'group':'main','source':'restored-main-soil-WCS','native_resolution_m':250,'value_scale_to_physical':0.1,'period':main['period']});records.append(rec);write_json(OUT/(rec['id']+'.json'),rec)
 def offshore(task):
  prop,aoi=task;b=aoi['bbox'];coverage='phh2o' if prop=='ph' else 'soc';base='https://maps.isric.org/mapserv?map=/map/'+coverage+'.map'
  pairs=[('SERVICE','WCS'),('VERSION','2.0.1'),('REQUEST','GetCoverage'),('COVERAGEID',coverage+'_0-5cm_mean'),('FORMAT','image/tiff'),('SUBSET',f'X({b[0]},{b[2]})'),('SUBSET',f'Y({b[1]},{b[3]})'),('SUBSETTINGCRS','http://www.opengis.net/def/crs/EPSG/0/4326'),('OUTPUTCRS','http://www.opengis.net/def/crs/EPSG/0/4326')]
  u=base+'&'+urllib.parse.urlencode(pairs);p=CACHE/f'soil-{prop}-{aoi["id"]}-wcs.tif';get(u,p);sub=gdal.Open(str(p));rec=export(sub,f'soil-{prop}-'+aoi['id'],'soil-'+prop);rec.update({'aoi':aoi['id'],'group':aoi['group'],'source':u,'native_resolution_m':250,'value_scale_to_physical':0.1,'source_sha256':sha(p),'period':'SoilGrids 2.0 model; not an annual soil survey','level':'fresh-WCS-native-scale-window'});write_json(OUT/(rec['id']+'.json'),rec);print('SOIL',prop,aoi['id'],rec['coverage'],flush=True);return rec
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:records.extend(ex.map(offshore,[(prop,a) for prop in ['ph','soc'] for a in AOI['places'] if a['group']!='main']))
 write_json(OUT/'soil-manifest.json',{'dataset':'ISRIC SoilGrids 2.0 predicted mean pH(H2O) and SOC, 0–5 cm depth','native_resolution_m':250,'license':'CC-BY-4.0','license_url':'https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html','attribution':'ISRIC — World Soil Information; SoilGrids 2.0','accessed':DATE,'coverage_warning':'Main island restored WCS raster plus explicit offshore sample audit; broad offshore soil coverage has NOT been established. Zero means no prediction. No filling from nearby land.','records':records})

if __name__=='__main__':
 selection=sys.argv[1] if len(sys.argv)>1 else 'all'
 for name,fn in [('rain',rain),('soil',soil),('dsm',dsm)]:
  if selection in ['all',name]:fn()
