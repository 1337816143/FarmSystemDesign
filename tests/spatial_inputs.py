"""Independent audit of the public spatial contract against existing native raster bytes.
No network, resampling, infilling, model fitting or source rewrites.
"""
import json,hashlib,math
from pathlib import Path
import rasterio
from shapely.geometry import shape,Point
from PIL import Image
R=Path(__file__).resolve().parents[1]
c=json.loads((R/'data/derived/spatial-inputs-2025.json').read_text())
plots={f['properties']['id']:f for f in json.loads((R/'data/evidence/selected-fields.geojson').read_text())['features']}
sources={s['path']:s for s in c['sources']};assert len(sources)==len(c['sources'])
for path,s in sources.items():assert hashlib.sha256((R/path).read_bytes()).hexdigest()==s['sha256'],path
admin=json.loads((R/'data/hainan/regional/county-osm-reference-20261003.geojson').read_text())
rasters={};observations=0;rain_cells=set();classes={}
for b in c['bindings']:
 p=plots[b['plotId']];point=b['representativePoint'];assert shape(p['geometry']).covers(Point(point));assert point==p['properties']['representativePoint'];assert b['areaHa']==p['properties']['areaHa'];assert b['geometrySha256']==p['properties']['geometrySha256']
 for variable,series in [('precipitation',b['rainfall']),('temperature',b['context']['temperature'])]:
  assert len(series)==12
  for month,o in enumerate(series,1):
   assert o['period']==f'2025-{month:02}' and o['status']=='available'
   path=o['sourceRef']
   if path not in rasters:rasters[path]=rasterio.open(R/path)
   ds=rasters[path];row,col=ds.index(*point);assert row==o['row'] and col==o['column'];value=next(ds.sample([point],masked=True))[0];assert not bool(getattr(value,'mask',False));assert float(value)==o['value']
   if variable=='precipitation':assert o['units']=='mm/month' and value>=0;rain_cells.add((row,col));observations+=1
 expected=[f['properties']['osm_relation_id'] for f in admin['features'] if shape(f['geometry']).covers(Point(point))]
 assert [x['osmRelationId'] for x in b['context']['administrative']['matches']]==expected
 lc=b['context']['landCover'];s=sources[lc['sourceRef']];w,south,e,n=s['bounds'];image=Image.open(R/lc['sourceRef']);col=math.floor((point[0]-w)/(e-w)*image.width);row=math.floor((n-point[1])/(n-south)*image.height);assert (row,col)==(lc['row'],lc['column']);value=image.getpixel((col,row));value=value[0] if isinstance(value,tuple) else value;assert value==lc['classCode'];classes[value]=classes.get(value,0)+1
assert len(c['bindings'])==110 and observations==1320 and len(rain_cells)==1
print(json.dumps({'passed':True,'plots':110,'monthly_rainfall_observations':observations,'independent_rainfall_cells':len(rain_cells),'source_hashes':len(sources),'context_point_landcover_classes':classes,'assertion':'One climate cell is not 110 independent observations; class counts are point samples, not plot-majority or area.'},ensure_ascii=False,indent=2))
