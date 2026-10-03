"""Native 2025 source-class audit; uses installed GDAL, not RGB colors.
Run with /usr/bin/python3; source cache is outside the published data directory.
Projected UTM pixel areas, an inferred 100 m island mask, not statutory land area.
"""
from pathlib import Path
import json, hashlib, urllib.request, shutil, os
import numpy as np
from osgeo import gdal, osr
from scipy.ndimage import label, binary_fill_holes

gdal.UseExceptions()
ROOT=Path(__file__).resolve().parents[1]
CACHE=Path(os.environ.get('FARM_SOURCE_CACHE',str(ROOT.parent/'cache'))); CACHE.mkdir(exist_ok=True)
URL='https://lulctimeseries.blob.core.windows.net/lulctimeseriesv003/lc2025/49Q_20250101-20251231.tif'
path=CACHE/'esri49Q-2025.tif'
if not path.exists():
 print('Fetching public 136 MB source once',flush=True)
 with urllib.request.urlopen(URL,timeout=180) as r,path.with_suffix('.part').open('wb') as f: shutil.copyfileobj(r,f)
 assert path.with_suffix('.part').stat().st_size==136217448
 path.with_suffix('.part').rename(path)
sha=hashlib.sha256(path.read_bytes()).hexdigest()
ds=gdal.Open(str(path));gt=ds.GetGeoTransform();band=ds.GetRasterBand(1)
assert gt[1]==10 and gt[5]==-10 and ds.RasterXSize==64218
wgs=osr.SpatialReference();wgs.ImportFromEPSG(4326);wgs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
utm=osr.SpatialReference(wkt=ds.GetProjection());utm.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
trans=osr.CoordinateTransformation(wgs,utm)
points=[trans.TransformPoint(x,y) for x in [108.5,111.5] for y in [17.8,20.5]]
x0=int((min(p[0] for p in points)-gt[0])/10)//20*20;y0=int((gt[3]-max(p[1] for p in points))/10)//20*20
x1=(int((max(p[0] for p in points)-gt[0])/10)//20+1)*20;y1=(int((gt[3]-min(p[1] for p in points))/10)//20+1)*20
w,h=x1-x0,y1-y0
sx,sy,_=trans.TransformPoint(109.8,19.0)
def mask(step):
 a=band.ReadAsArray(x0,y0,w,h,buf_xsize=w//step,buf_ysize=h//step,resample_alg=gdal.GRIORA_NearestNeighbour)
 cc,n=label((a!=0)&(a!=1))
 seed=cc[int(((gt[3]-sy)/10-y0)//step),int(((sx-gt[0])/10-x0)//step)]
 assert seed!=0 and n>1
 return binary_fill_holes(cc==seed)
m100=mask(10);m200=mask(20)
print('Mask areas',m100.sum()/100,m200.sum()/25,flush=True)
counts=np.zeros(256,dtype=np.int64); blocks=0
for yy in range(0,h,1024):
 for xx in range(0,w,1024):
  bw,bh=min(1024,w-xx),min(1024,h-yy)
  m=m100[np.ix_(np.arange(yy,yy+bh)//10,np.arange(xx,xx+bw)//10)]
  if not m.any(): continue
  arr=band.ReadAsArray(x0+xx,y0+yy,bw,bh)
  counts+=np.bincount(arr[m],minlength=256);blocks+=1
 print('row',yy,'blocks',blocks,flush=True)
classes={1:'Water',2:'Trees',4:'Flooded vegetation',5:'Crops',7:'Built area',8:'Bare ground',9:'Snow/ice',10:'Clouds',11:'Rangeland'}
assert not set(np.nonzero(counts)[0])-set(classes)-{0}
classified=int(counts.sum()-counts[0]-counts[10]);area=classified/10000
assert 30000<area<37000
out={'product':'Esri / Impact Observatory / Microsoft Sentinel-2 10 m land cover 2025 v003','year':2025,'native_resolution_m':10,'source_crs':'EPSG:32649','source_url':URL,'source_sha256':sha,'source_bytes':path.stat().st_size,'license':'CC BY 4.0','attribution':'Impact Observatory, Microsoft, Esri. Contains modified Copernicus Sentinel data (2025)','geography':'Inferred Hainan main island only; excludes detached islands and Sansha','method':'Source-native class counts within connected main-island component from 100 m nearest-neighbor classification; enclosed water holes filled. Seed 109.8E,19N. Areas are projected UTM grid areas (100 m²/pixel), not equal-area/geodesic areas. Projection distortion and mask uncertainty apply.','not_for':'Official cultivated-land or administrative area, county statistics, cadastral interpretation, local classification accuracy, or direct cross-product change claims. Trees can include orchards/rubber/coconut; Crops=5 is not all agriculture.','mask_area_100m_km2':round(int(m100.sum())/100,2),'mask_area_200m_km2':round(int(m200.sum())/25,2),'mask_sampling_difference_percent':round(abs(m100.sum()/100-m200.sum()/25)/(m100.sum()/100)*100,4),'masked_nodata_pixels':int(counts[0]),'cloud_pixels':int(counts[10]),'classified_pixels':classified,'total_classified_km2':round(area,2),'classes':[{'code':k,'name':v,'pixels':int(counts[k]),'km2':round(int(counts[k])/10000,4),'percent':round(int(counts[k])/classified*100,4),'valid_class':k!=10} for k,v in classes.items()]}
target=ROOT/'data/hainan/regional/landcover2025-main-island-summary.json';target.parent.mkdir(exist_ok=True);target.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(target, json.dumps(out),flush=True)
