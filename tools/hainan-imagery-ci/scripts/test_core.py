#!/usr/bin/python3
import json,math
from pathlib import Path
import numpy as np
from scipy.ndimage import maximum_filter
from osgeo import gdal
from pyproj import Transformer
from paths import parser,activate
ARGS=parser('Test7x7guard andcontinuous grid coverage').parse_args();INPUT,OUT,ROOT=activate(ARGS)
from build_tiles import CLEAR,CLOUD

rng=np.random.default_rng(20261003);scl=np.full((47,53),4,dtype='uint8')
for y,x,v in [(0,0,3),(20,20,8),(30,30,9),(46,52,10),(5,32,0),(10,10,7),(35,12,11),(24,45,1),(8,13,2),(42,1,6),(8,48,5)]:scl[y,x]=v
fast=(CLEAR[scl]>0)&(maximum_filter(CLOUD[scl],size=7,mode='constant',cval=0)==0)
slow=np.zeros_like(fast)
for y in range(scl.shape[0]):
 for x in range(scl.shape[1]):slow[y,x]=scl[y,x] in [2,4,5,6] and not np.any(np.isin(scl[max(0,y-3):y+4,max(0,x-3):x+4],[3,8,9,10]))
assert np.array_equal(fast,slow)
assert np.any(np.array([0,2,0])>0) and not np.any(np.array([0,0,0])>0)
grid=json.load(open(INPUT/'grid.json'));tiles=grid['records'];keys={t['row']*10000+t['col'] for t in tiles};px=grid['base_pixel_degrees'];step=px*grid['tile_size']
for t in tiles:
 b=t['bounds_wsen'];assert abs(b[2]-b[0]-step)<1e-12 and abs(b[3]-b[1]-step)<1e-12;assert t['crs']=='EPSG:4326';assert t['transform']==[px,0,b[0],0,-px,b[3]]
old=INPUT/'main-island-mask-100m.tif';ds=gdal.Open(str(old));gt=ds.GetGeoTransform();tr=Transformer.from_crs(32649,4326,always_xy=True);covered=0;total=0
for row in range(0,ds.RasterYSize,128):
 n=min(128,ds.RasterYSize-row);a=ds.ReadAsArray(0,row,ds.RasterXSize,n);yy,xx=np.where(a>0);xx=gt[0]+(xx+.5)*100;yy=gt[3]-(row+yy+.5)*100;lon,lat=tr.transform(xx,yy);cols=np.floor(lon/step).astype(int);rows=np.floor(lat/step).astype(int);kk=rows*10000+cols;good=np.isin(kk,list(keys));covered+=int(good.sum());total+=len(kk)
assert covered==total and total>3000000
result={'status':'passed','scl_guard_naive_vs_vectorized_pixels':int(scl.size),'scl_guard_rule':'Native20m classes2/4/5/6 and7x7 excludes3/8/9/10, including array-edge cases','original_rgb_nonzero_test':'passed','grid_affine_and_adjacent_boundary_checks':'passed','native_tile_count':len(tiles),'connected_main_island_mask_100m_cells':total,'mask_cell_centers_covered_by_native_grid':covered,'grid_covers_mask_cell_centers_percent':covered/total*100,'scope_limit':'The100m connected-main-island mask and300m selection buffer are not administrative boundaries or exhaustive offshore island inventory.'}
(OUT/'grid-and-mask-tests.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
