"""Join existing public snapshots to unchanged demo plots; no download or coefficient fitting.
Requires Python rasterio, shapely and Pillow. Rebuild: python tools/build-spatial-inputs.py
"""
from pathlib import Path
import hashlib, json, math, subprocess
import rasterio
from shapely.geometry import shape, Point
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
read=lambda path:json.loads((ROOT/path).read_text())
sha=lambda path:hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
dataset=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {makeDemo,hash} from './src/data.js'; const d=makeDemo(); for(const p of d.plots)p.bindingFingerprint=hash({type:p.geometry.type,coordinates:p.geometry.coordinates}); console.log(JSON.stringify(d));"],cwd=ROOT,text=True))
sources={}
def source(path,**extra):
    if path not in sources:sources[path]={'path':path,'sha256':sha(path),**extra}
    return path
admin_path='data/hainan/regional/county-osm-reference-20261003.geojson'
admin=read(admin_path);source(admin_path,role='context-only',version='OSM snapshot 2026-10-03',crs='EPSG:4326',license='ODbL-1.0')
lcpath='data/hainan/regional/landcover-local/landcover-local-manifest.json';lc=read(lcpath)
source(lcpath,role='context-only',version=lc['version'],sourceUrl=lc['source_url'],sourceNativeResolutionM=10,displayCRS='EPSG:4326',license=lc['license'])
rasters={}
for variable in ['precipitation','temperature']:
 for month in range(1,13):
  path=f'data/hainan/regional/climate/{variable}-2025-{month:02}-main.json';meta=read(path);tif=str(Path(path).parent/meta['geotiff'])
  assert sha(tif)==meta['sha256']['geotiff'],tif
  source(path,role='model-input' if variable=='precipitation' else 'context-only',dataset=meta['dataset'],period=meta['period'],units=meta['units'],sourceUrl=meta['source'])
  source(tif,role='model-input' if variable=='precipitation' else 'context-only',metadataPath=path,crs='EPSG:4326',bounds=meta['bbox'],width=meta['width'],height=meta['height'],nativeResolutionDegrees=meta['native_resolution_degrees'])
  ds=rasterio.open(ROOT/tif);assert ds.crs.to_epsg()==4326 and list(ds.bounds)==meta['bbox']
  rasters[variable,month]=(ds,ds.read(1,masked=True),tif,meta)
def sample(variable,month,point):
 ds,values,tif,meta=rasters[variable,month];row,col=ds.index(*point)
 inside=0<=row<ds.height and 0<=col<ds.width
 value=values[row,col] if inside else None
 valid=inside and not bool(getattr(value,'mask',False)) and math.isfinite(float(value)) and (variable!='precipitation' or value>=0)
 return {'period':meta['period'],'value':float(value) if valid else None,'units':meta['units'],'status':'available' if valid else 'source-nodata' if inside else 'outside-source-grid','sourceRef':tif,'row':row,'column':col,'cellBounds':list(rasterio.windows.bounds(rasterio.windows.Window(col,row,1,1),ds.transform)) if inside else None}
bindings=[];images={}
for plot in dataset['plots']:
 point=plot['representativePoint'];geom=shape(plot['geometry']);assert geom.covers(Point(point))
 rainfall=[sample('precipitation',m,point) for m in range(1,13)]
 temperatures=[sample('temperature',m,point) for m in range(1,13)]
 matches=[{'name':f['properties']['name'],'osmRelationId':f['properties']['osm_relation_id'],'wholeGeometryCovered':shape(f['geometry']).covers(geom)} for f in admin['features'] if shape(f['geometry']).covers(Point(point))]
 matches_lc=[r for r in lc['records'] if r['lod']=='detail' and r['bbox'][0]<=point[0]<r['bbox'][2] and r['bbox'][1]<point[1]<=r['bbox'][3]]
 context={'administrative':{'method':'representative-point containment; not ownership or decision rights','sourceRef':admin_path,'matches':matches},'temperature':temperatures}
 if len(matches_lc)==1 and matches_lc[0].get('file'):
  rec=matches_lc[0];path=str(Path(lcpath).parent/rec['file']);image=images.get(path)
  if image is None:image=images[path]=Image.open(ROOT/path)
  w,s,e,n=rec['bbox'];col=math.floor((point[0]-w)/(e-w)*image.width);row=math.floor((n-point[1])/(n-s)*image.height);code=image.getpixel((col,row));code=code[0] if isinstance(code,tuple) else code
  source(path,role='context-only',manifestRef=lcpath,bounds=rec['bbox'],width=image.width,height=image.height,crs='EPSG:4326',processing='existing detail nearest-neighbour display derivative')
  context['landCover']={'sourceRef':path,'manifestRef':lcpath,'year':2025,'classCode':code,'classLabel':lc['encoding']['classes'][str(code)],'status':'source-nodata' if code==0 else 'cloud-unclassified' if code==10 else 'available','row':row,'column':col,'method':'representative-point class on existing reprojected detail display grid; not plot majority or crop species','modelUse':'none'}
 else:context['landCover']={'status':'outside-or-ambiguous-grid','modelUse':'none'}
 bindings.append({'plotId':plot['id'],'geometryFingerprint':plot['bindingFingerprint'],'geometrySha256':plot['geometrySha256'],'representativePoint':point,'areaHa':plot['areaHa'],'rainfall':rainfall,'context':context})
contract={'schema':'FarmSystemDesign.SpatialInputContract','schemaVersion':1,'version':'spatial-inputs-2025-r1','builtOn':'2026-10-04','sourceDatasetVersion':dataset['version'],'geometryCRS':'EPSG:4326','periodYear':2025,'sampling':'unchanged plot representative point -> containing native climate grid cell; no interpolation','admittedModelVariable':'precipitationMmMonth','units':'mm/month','rainfallDataset':'CHIRPS v3 final monthly precipitation','nativeResolutionDegrees':[.05,.05],'role':'optional historical rainfall sensitivity input; synthetic uncalibrated farm model','limitations':['Not a plot rainfall observation, irrigation entitlement, field-calibrated response, or adaptive forecast.','110 rule-selected public ML plots are not a representative farm sample.','Point assignment does not estimate plot-area mean; crossing grid boundaries is not area weighted.','Land cover, administrative containment and temperature remain context-only; they do not set crops, rights, groups, yields, soil factors, or resource capacity.','All 12 monthly values and binding identity must be available for each selected plot; no zero fill or legacy-rainfall fallback in this mode.','The geometry FNV fingerprint detects ordinary stale bindings only, not cryptographic authenticity; FrozenRun SHA-256 protects captured record integrity.'],'sources':list(sources.values()),'bindings':bindings}
out=ROOT/'data/derived/spatial-inputs-2025.json';out.parent.mkdir(exist_ok=True);out.write_text(json.dumps(contract,ensure_ascii=False,separators=(',',':'))+'\n')
print(json.dumps({'plots':len(bindings),'rainfallObservations':sum(len(x['rainfall']) for x in bindings),'uniqueClimateCells':len({(x['rainfall'][0]['row'],x['rainfall'][0]['column']) for x in bindings}),'sourceFiles':len(sources),'sha256':sha(str(out.relative_to(ROOT)))},indent=2))
