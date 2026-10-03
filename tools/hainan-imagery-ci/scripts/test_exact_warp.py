#!/usr/bin/python3
import json,math
from pathlib import Path
import numpy as np
from osgeo import gdal,osr
from scipy.ndimage import maximum_filter
from pyproj import Transformer
from paths import parser,activate
ARGS=parser('Test exact source-grid warp andSCL guard').parse_args();INPUT,OUT,ROOT=activate(ARGS)
from build_tiles import CLEAR,CLOUD,warp_mask
OUT.mkdir(parents=True,exist_ok=True)
gdal.UseExceptions();gdal.SetCacheMax(24*1024*1024)
cat=json.load(open(INPUT/'source-catalog.json'));sc=next(s for s in cat['scenes'] if s['id']=='S2C_T49QDC_20250327T031111_L2A');tile=next(t for t in json.load(open(INPUT/'grid.json'))['records'] if t['id']=='0-598-108');b=tile['bbox'];N=tile['width'];px=tile['pixel_size_degrees'][0];proj=Transformer.from_crs(4326,sc['epsg'],always_xy=True);sr=osr.SpatialReference();sr.ImportFromEPSG(sc['epsg']);wkt=sr.ExportToWkt()
x,y=proj.transform([b[0],b[2],b[0],b[2]],[b[1],b[1],b[3],b[3]])
rng=np.random.default_rng(20261003);cols=rng.integers(0,N,size=20000);rows=rng.integers(0,N,size=20000);lons=b[0]+(cols+.5)*px;lats=b[3]-(rows+.5)*px;xx,yy=proj.transform(lons,lats)
results=[]
for key,res,bands in [('scl',20,1),('visual',10,3)]:
 a=sc['assets'][key]['transform'];c0=math.floor((min(x)-a[2])/res)-8;c1=math.ceil((max(x)-a[2])/res)+8;r0=math.floor((a[5]-max(y))/res)-8;r1=math.ceil((a[5]-min(y))/res)+8;gt=[a[2]+c0*res,res,0,a[5]-r0*res,0,-res];h,w=r1-r0,c1-c0;rr,cc=np.indices((h,w));
 if key=='scl':data=((rr//17+cc//23)%12).astype('uint8')[None,:,:]
 else:data=np.stack([(cc*3+rr*5)%256,(cc*11+rr*7)%256,(cc*13+rr*17)%256]).astype('uint8')
 src=gdal.GetDriverByName('MEM').Create('',w,h,bands,gdal.GDT_Byte);src.SetGeoTransform(gt);src.SetProjection(wkt)
 for band in range(bands):src.GetRasterBand(band+1).WriteArray(data[band])
 dst=gdal.Warp('',src,format='MEM',dstSRS='EPSG:4326',outputBounds=b,width=N,height=N,resampleAlg='near',dstNodata=0,srcNodata='None',errorThreshold=0,warpMemoryLimit=24);got=dst.ReadAsArray();dst=None
 c=np.floor((xx-gt[0])/res).astype(int);r=np.floor((gt[3]-yy)/res).astype(int);expected=data[:,r,c];actual=got[rows,cols][None,:] if bands==1 else got[:,rows,cols];mismatch=int(np.any(actual!=expected,axis=0).sum());assert mismatch==0,(key,mismatch)
 entry={'source_kind':key,'native_m':res,'control_points':len(rows),'nearest_native_value_mismatches':mismatch,'projection_error_threshold':0}
 if key=='scl':
  guard=(CLEAR[data[0]]>0)&(maximum_filter(CLOUD[data[0]],size=7,mode='constant',cval=0)==0);mapped=warp_mask(guard.astype('uint8'),gt,wkt,b,N);mismatch=int(np.sum(mapped[rows,cols]!=guard[r,c]));assert mismatch==0;entry['guard_mismatches']=mismatch
 results.append(entry)
(OUT/'exact-transform-tests.json').write_text(json.dumps({'status':'passed','method_version':'v2-exact-transform','tests':results,'meaning':'Synthetic native-grid values and7x7 masks at the real Hainan source affine are compared with independent pyproj-native pixel indexing. Live-source evidence is separate.'},indent=2));print((OUT/'exact-transform-tests.json').read_text())
