"""Bounded public service verification; samples never imply province-wide coverage."""
import json, hashlib, io
from pathlib import Path
from datetime import datetime, timezone
import requests
from collections import Counter
from PIL import Image
BASE='https://ic.imagery1.arcgis.com/arcgis/rest/services/Sentinel2_10m_LandCover/ImageServer'
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/hainan/landcover-2025'
OUT.mkdir(parents=True,exist_ok=True)
s=requests.Session()
def get(path,params):
 r=s.get(BASE+path,params=params,timeout=60);r.raise_for_status();return r
service=get('',{'f':'json'}).json()
assert any(x['name']=='Isolate Crops for Visualization and Analysis' for x in service['rasterFunctionInfos'])
item=s.get('https://www.arcgis.com/sharing/rest/content/items/cfcb7609de5f478eb7666240902d4d3d',params={'f':'json'},timeout=60).json()
for name,data in [('service.json',service),('item.json',item)]:
 (OUT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
probes=[]
# Window probes cover different regions but are NOT an administrative completeness test.
for name,b in [('main-island',[108.5,17.8,111.5,20.5]),('yazhou',[109.108,18.354,109.151,18.397]),('xisha-window',[111.5,15.5,113,17.5]),('nansha-window',[109,3,118,12])]:
 params={'f':'image','bbox':','.join(map(str,b)),'bboxSR':4326,'imageSR':4326,'size':'256,256','format':'png32','interpolation':'RSP_NearestNeighbor','mosaicRule':json.dumps({'mosaicMethod':'esriMosaicAttribute','where':'Year = 2025'}),'renderingRule':json.dumps({'rasterFunction':'Cartographic Renderer for Visualization and Analysis'})}
 r=get('/exportImage',params)
 im=Image.open(io.BytesIO(r.content)).convert('RGBA')
 pixels=list(im.getdata());opaque=sum(p[3]>0 for p in pixels)
 path=OUT/(name+'-probe.png');path.write_bytes(r.content)
 probes.append({'name':name,'bbox_wsen':b,'request_url':r.url,'sha256':hashlib.sha256(r.content).hexdigest(),'bytes':len(r.content),'size':list(im.size),'nontransparent_pixels':opaque,'total_pixels':len(pixels),'interpretation':'coarse rendered window probe; includes ocean; not complete land coverage or native-class statistics'})
catalog=get('/query',{'f':'json','where':'Year = 2025','outFields':'OBJECTID,Year,Name','returnGeometry':'false'}).json()
assert catalog.get('features'),catalog
(OUT/'catalog-2025.json').write_text(json.dumps(catalog,indent=2)+'\n',encoding='utf8',newline='\n')
raw=get('/exportImage',{'f':'image','bbox':'109.108,18.354,109.151,18.397','bboxSR':4326,'imageSR':4326,'size':'256,256','format':'tiff','pixelType':'U8','interpolation':'RSP_NearestNeighbor','mosaicRule':json.dumps({'mosaicMethod':'esriMosaicAttribute','where':'Year = 2025'}),'renderingRule':json.dumps({'rasterFunction':'None'})})
(OUT/'yazhou-classes-sample.tif').write_bytes(raw.content)
im=Image.open(io.BytesIO(raw.content));assert len(im.getbands())==1,im.getbands()
counts={str(k):v for k,v in sorted(Counter(im.getdata()).items())}
assert sum(counts.values())==im.width*im.height
crop_params={'f':'image','bbox':'109.108,18.354,109.151,18.397','bboxSR':4326,'imageSR':4326,'size':'256,256','format':'png32','interpolation':'RSP_NearestNeighbor','mosaicRule':json.dumps({'mosaicMethod':'esriMosaicAttribute','where':'Year = 2025'}),'renderingRule':json.dumps({'rasterFunction':'Isolate Crops for Visualization and Analysis'})}
crop_response=get('/exportImage',crop_params)
crop_image=Image.open(io.BytesIO(crop_response.content)).convert('RGBA')
crop_count=sum(p[3]>0 for p in crop_image.getdata())
assert crop_count==counts.get('5',0),(crop_count,counts)
(OUT/'yazhou-crops-probe.png').write_bytes(crop_response.content)
(OUT/'crop-class-consistency.json').write_text(json.dumps({'year':2025,'class':5,'rawClassPixels':counts['5'],'renderedNontransparentPixels':crop_count,'passed':True,'request_url':crop_response.url,'interpretation':'same bounded sample; confirms class-isolation rendering matches raw Crops codes; not full-region area'},indent=2)+'\n',encoding='utf8',newline='\n')
url='https://lulctimeseries.blob.core.windows.net/lulctimeseriesv003/lc2025/49Q_20250101-20251231.tif'
cog=s.get(url,headers={'Range':'bytes=0-65535'},timeout=60)
assert cog.status_code==206,cog.status_code
assert len(cog.content)==65536,len(cog.content)
assert cog.content[:2] in [b'II',b'MM'],cog.content[:16]
(OUT/'49Q-cog-range-verification.json').write_text(json.dumps({'url':url,'status':cog.status_code,'contentRange':cog.headers.get('Content-Range'),'cors':cog.headers.get('Access-Control-Allow-Origin'),'sampleBytes':len(cog.content),'sampleSha256':hashlib.sha256(cog.content).hexdigest(),'interpretation':'64KiB header range verification only; NOT a full-file hash or validated province coverage; public 2025 tile 49Q covers main-island region'},indent=2)+'\n',encoding='utf8',newline='\n')
report={'retrievedAt':datetime.now(timezone.utc).isoformat(),'year':2025,'source':BASE,'itemId':item['id'],'latestVerifiedYearInThisService':2025,'nativeResolutionM':10,'classCode':5,'className':'Crops','sourceLicense':'CC-BY-4.0','serviceLicense':'Esri Master License Agreement; see item.json licenseInfo','attribution':'Impact Observatory, Microsoft, and Esri','classification':'annual deep-learning land-cover class, not cadastral or statutory cultivated land','cloudClass':10,'probes':probes,'classSample':{'file':'yazhou-classes-sample.tif','request_url':raw.url,'counts':counts,'total':im.width*im.height,'interpretation':'bounded 256x256 nearest-neighbour raw-class sample, not native-area or province-wide statistics'},'coverage':{'mainIsland':'rendered window verified; full pixel completeness not established','outlyingIslands':'not individually enumerated or validated','sansha':'Xisha/Nansha window probes only; every island/reef not validated'},'budget':{'requests':10,'maximumExportPixelsPerRequest':65536,'cogRangeBytes':65536,'bulkRasterDownload':False},'hashes':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.iterdir() if p.is_file() and p.name!='verification.json'}}
(OUT/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
print(json.dumps({'year':2025,'probes':[{k:p[k] for k in ['name','nontransparent_pixels','bytes']} for p in probes]},indent=2))
