import requests,json,os,hashlib,time,traceback
import xml.etree.ElementTree as ET
import numpy as np
from pathlib import Path
from datetime import datetime,timezone
from shapely.geometry import Polygon,mapping,shape,box
from pyproj import Geod,Transformer
from PIL import Image
out=Path('evidence-v2'); now=datetime.now(timezone.utc).isoformat(); bbox=[109.09,18.30,109.26,18.45]
session=requests.Session(); session.headers['User-Agent']='FarmSystemDesignResearch/0.2 (https://github.com/1337816143/FarmSystemDesign)'
report={'retrievedAt':now,'bbox':bbox,'attempts':[]}; geod=Geod(ellps='WGS84')
def save(name,obj): (out/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2))
context=[]; fields=[]; ids=set()
# Complete source ways are retained; this is land-use evidence, not cadastral ownership.
for k,b in enumerate([[109.09,18.30,109.175,18.45],[109.175,18.30,109.26,18.45]]):
  url='https://api.openstreetmap.org/api/0.6/map?bbox='+','.join(map(str,b))
  try:
    r=session.get(url,timeout=80);r.raise_for_status();(out/f'osm-source-{k}.osm').write_bytes(r.content)
    root=ET.fromstring(r.content); nodes={n.attrib['id']:[float(n.attrib['lon']),float(n.attrib['lat'])] for n in root.findall('node')}
    for way in root.findall('way'):
      oid=way.attrib['id']
      if oid in ids:continue
      ids.add(oid); tags={t.attrib['k']:t.attrib['v'] for t in way.findall('tag')}; refs=[n.attrib['ref'] for n in way.findall('nd')]
      if len(refs)<2 or not all(n in nodes for n in refs):continue
      coords=[nodes[n] for n in refs]; closed=refs[0]==refs[-1] and len(refs)>=4
      if not any(k in tags for k in ['landuse','natural','waterway','highway','building','railway']):continue
      geom={'type':'Polygon' if closed else 'LineString','coordinates':[coords] if closed else coords}
      props={'osmType':'way','osmId':oid,'sourceUrl':'https://www.openstreetmap.org/way/'+oid,'sourceVersion':way.attrib.get('version'),'sourceTimestamp':way.attrib.get('timestamp'),'retrievedAt':now,'tags':tags,'geometryStatus':'public-osm','license':'ODbL-1.0'}
      f={'type':'Feature','id':'way/'+oid,'geometry':geom,'properties':props};context.append(f)
      if closed and tags.get('landuse') in ['farmland','orchard','plant_nursery','vineyard']:
        p=shape(geom);area=abs(geod.geometry_area_perimeter(p)[0])/1e4
        if p.is_valid and area>=0.1 and area<=400 and box(*bbox).contains(p.centroid):
          props.update({'areaHaEllipsoid':area,'geometryValid':True,'vertexCount':len(coords),'representativePoint':list(p.representative_point().coords)[0]})
          fields.append(f)
    report['attempts'].append({'kind':'osm','url':url,'ok':True,'bytes':len(r.content)})
  except Exception as e:report['attempts'].append({'kind':'osm','url':url,'ok':False,'error':str(e)})
save('osm-context-v2.geojson',{'type':'FeatureCollection','features':context})
save('agricultural-evidence.geojson',{'type':'FeatureCollection','features':fields,'metadata':{'retrievedAt':now,'bbox':bbox,'selection':'All valid complete OSM farmland/orchard/plant_nursery/vineyard ways with centroid inside bbox and area 0.1–400 ha. No fabricated subdivision.','interpretation':'Public land-use patches, not verified field/cadastral boundaries or ownership.','license':'ODbL-1.0'}})
report['agriculturalFeatures']=len(fields);report['contextFeatures']=len(context)
print('AGRICULTURAL',len(fields),[(f['id'],round(f['properties']['areaHaEllipsoid'],2),f['properties']['tags']) for f in fields],flush=True)
# Build a fixed 10 m EPSG:3857 visual crop and validate local cloud/shadow classes.
try:
  import rasterio,planetary_computer
  from rasterio.vrt import WarpedVRT
  from rasterio.enums import Resampling
  from rasterio.transform import from_bounds
  import math
  if fields:
    union=__import__('shapely').ops.unary_union([shape(f['geometry']) for f in fields]) if False else None
    bounds=[shape(f['geometry']).bounds for f in fields]
    ib=[max(bbox[0],min(b[0] for b in bounds)-.012),max(bbox[1],min(b[1] for b in bounds)-.012),min(bbox[2],max(b[2] for b in bounds)+.012),min(bbox[3],max(b[3] for b in bounds)+.012)]
  else:ib=[109.12,18.32,109.22,18.40]
  url='https://planetarycomputer.microsoft.com/api/stac/v1/search'
  q={'collections':'sentinel-2-l2a','bbox':','.join(map(str,ib)),'datetime':'2025-01-01T00:00:00Z/2025-05-31T23:59:59Z','limit':80}
  r=session.get(url,params=q,timeout=60);r.raise_for_status();items=r.json()['features'];save('sentinel-search.json',r.json())
  items=sorted(items,key=lambda i:i['properties'].get('eo:cloud_cover',100))
  trans=Transformer.from_crs(4326,3857,always_xy=True); xmin,ymin=trans.transform(ib[0],ib[1]);xmax,ymax=trans.transform(ib[2],ib[3]);width=math.ceil((xmax-xmin)/10);height=math.ceil((ymax-ymin)/10);affine=from_bounds(xmin,ymin,xmax,ymax,width,height)
  best=None
  for item in items[:5]:
    try:
      if not shape(item['geometry']).covers(box(*ib)):continue
      signed=planetary_computer.sign(item)
      with rasterio.Env(GDAL_HTTP_MAX_RETRY=2,GDAL_HTTP_TIMEOUT=90):
        with rasterio.open(signed['assets']['visual']['href']) as src:
          nativeRes=src.res;nativeCrs=str(src.crs)
          with WarpedVRT(src,crs='EPSG:3857',transform=affine,width=width,height=height,resampling=Resampling.bilinear) as vrt:rgb=vrt.read([1,2,3])
        with rasterio.open(signed['assets']['SCL']['href']) as src:
          with WarpedVRT(src,crs='EPSG:3857',transform=affine,width=width,height=height,resampling=Resampling.nearest) as vrt:scl=vrt.read(1)
      valid=np.isin(scl,[4,5,6,7]);local=float(valid.mean());attempt={'kind':'sentinel','item':item['id'],'date':item['properties']['datetime'],'sceneCloudPct':item['properties'].get('eo:cloud_cover'),'localUsableFraction':local,'rgbStd':float(rgb.std()),'ok':True};report['attempts'].append(attempt)
      print(attempt,flush=True)
      if best is None or local>best[0]:best=(local,item,rgb,scl,nativeRes,nativeCrs)
      if local>.97:break
    except Exception as e: report['attempts'].append({'kind':'sentinel','item':item['id'],'ok':False,'error':str(e)})
  if best:
    local,item,rgb,scl,nativeRes,nativeCrs=best
    assert rgb.std()>5,'Blank imagery rejected'
    Image.fromarray(np.moveaxis(rgb,0,2)).save(out/'sentinel2-visual.webp',quality=92,method=6)
    Image.fromarray(scl).save(out/'sentinel2-scl.png')
    with rasterio.open(out/'sentinel2-visual.tif','w',driver='GTiff',width=width,height=height,count=3,dtype=rgb.dtype,crs='EPSG:3857',transform=affine,compress='deflate') as ds:ds.write(rgb)
    save('sentinel-item.json',item)
    meta={'provider':'ESA / Copernicus Sentinel-2 L2A · Microsoft Planetary Computer','itemId':item['id'],'sourceUrl':f"https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/{item['id']}",'acquiredAt':item['properties']['datetime'],'retrievedAt':now,'bbox':ib,'projectedBounds':[xmin,ymin,xmax,ymax],'crs':'EPSG:3857','filename':'sentinel2-visual.webp','nativeCrs':nativeCrs,'nativeResolutionM':nativeRes[0],'displayPixelSizeM':[(xmax-xmin)/width,(ymax-ymin)/height],'width':width,'height':height,'sceneCloudPct':item['properties'].get('eo:cloud_cover'),'localUsableFraction':local,'sclValidClasses':[4,5,6,7],'qualityMethod':'SCL nearest-neighbor; classes 4,5,6,7 usable, not a guarantee of cloud-free field observations.','processing':'Provider visual RGB; bilinear warp to EPSG:3857, ~10 m projected display pixels; no inferred field boundaries.','license':'Copernicus Sentinel data terms; contains modified Copernicus Sentinel data 2025','sha256':hashlib.sha256((out/'sentinel2-visual.webp').read_bytes()).hexdigest()}
    save('sentinel-imagery.json',meta);report['imageryAvailable']=True
  else:report['imageryAvailable']=False
except Exception as e:report['imageryAvailable']=False;report['imageryError']=str(e);traceback.print_exc()
save('acquisition-v2.json',report)
