#!/usr/bin/python3
"""Normalize output metadata for Leaflet/WebGL clients; no network access."""
from pathlib import Path
import os
import json,hashlib
import numpy as np
from PIL import Image
from osgeo import gdal,osr
gdal.UseExceptions()
REPO=Path(__file__).resolve().parents[1]
ROOT=Path(os.environ.get('HAINAN_ENV_WORKDIR',str(REPO/'.data-cache/hainan-environment'))).resolve();OUT=Path(os.environ.get('HAINAN_ENV_ASSET_DIR',str(REPO/'data/hainan/regional/environment'))).resolve()
def read(p):return json.loads(p.read_text())
def write(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
aois=read(ROOT/'aoi-inventory.json' if (ROOT/'aoi-inventory.json').exists() else REPO/'data/hainan/regional/aoi-inventory.json'); groupids={x['id'] for x in aois['groups']};places={x['id']:x for x in aois['places']}
layers={}
for name,key in [('dsm','dsm'),('rain','rain'),('soil','soilPh')]:
 manifest=read(OUT/f'{name}-manifest.json')
 keys=['soilPh','soilSoc'] if name=='soil' else [key]
 for key in keys:
  raw=[r for r in manifest['records'] if name!='soil' or r['kind']==('soil-ph' if key=='soilPh' else 'soil-soc')]
  records=[]
  for r in raw:
   kind=r['kind'];scale=.1 if kind=='rain' or kind.startswith('soil') else 1;offset=-500 if kind=='dsm' else 0
   if kind=='dsm' and r['aoi'] in groupids and 'geotiff' in r:
    # Overview TIFF is redundant with preview/value PNG; retain native-window TIFFs.
    (OUT/r['geotiff']).unlink(missing_ok=True);r.pop('geotiff');r['sha256'].pop('geotiff',None)
   if kind=='dsm' and r['coverage']['valid_cells'] and not r['coverage']['positive_surface_cells']:
    r['status']='unresolved-source-zero-surface';r['coverage_note']='The source tile exists but this entire window has only zero-height cells. Do not treat this as measured island terrain.'
   if kind=='rain' and r['aoi'] in places and places[r['aoi']]['kind']!='main-island-sample' and r['coverage']['valid_cells']:
    r['status']='coarse-context-only';r['coverage_note']='Valid ~5.5 km cell context does not resolve the named small island or reef; no island-specific rainfall estimate is established.'
   r['raster_scale']=.1 if kind.startswith('soil') else 1
   r['raster_offset']=0
   write(OUT/(r['id']+'.json'),r)
   e={'id':r['aoi'],'group':r['group'],'file':r['preview'],'values_file':r['values'],'bbox':r['bounds_wsen'],'bbox_wgs84':r['bounds_wsen'],'width':r['width'],'height':r['height'],'epsg':4326,'values_epsg':4326,'preview_epsg':4326,'native_resolution_m':30 if kind=='dsm' else 5500 if kind=='rain' else 250,'native_resolution_degrees':1/3600 if kind=='dsm' else 0.05 if kind=='rain' else None,'display_resolution':{'degrees':r['pixel_size_degrees'],'label':r.get('render_resolution','0.05° (~5.5 km), source grid' if kind=='rain' else 'WCS grid at nominal 250 m source resolution')},'decode':{'encoding':'uint16 red + 256*green','scale':scale,'offset':offset,'nodata':'alpha === 0','units':'m' if kind=='dsm' else 'mm/year' if kind=='rain' else 'pH' if kind=='soil-ph' else 'g/kg','formula':'(red + 256*green) * scale + offset'},'status':r['status'],'coverage':r['coverage'],'statistics':r['statistics'],'metadata_file':r['id']+'.json','coverage_note':r.get('coverage_note',r.get('spatial_warning')),'sha256':r['sha256']}
   if r.get('geotiff'):e['native_window_geotiff']=r['geotiff']
   records.append(e)
  layer={'dataset':manifest['dataset'],'period':'2025-01-01/2025-12-31' if name=='rain' else 'TanDEM-X mainly 2011–2015, older infill possible' if name=='dsm' else 'SoilGrids 2.0 model, 0–5 cm mean; not annual survey','license':manifest['license'],'license_url':manifest['license_url'],'attribution':manifest['attribution'],'native_resolution_m':30 if name=='dsm' else 5500 if name=='rain' else 250,'groups':[r for r in records if r['id'] in groupids],'previews':records,'coverage_note':manifest.get('coverage_warning','Window counts are not a province land-coverage claim; no verified exhaustive island land mask.')}
  if name=='dsm':layer['assets']=[{'id':a['id'],'href':a['href'],'bbox_wgs84':a['bbox'],'epsg':4326,'native_resolution_m':30,'native_resolution_degrees':1/3600,'nodata':None,'scale':1,'offset':0,'units':'m','ocean_value':0,'browser_access':'Range verified, CORS not established; use same-origin materialized window or permitted proxy'} for a in manifest['source_tiles']]
  else:layer['assets']=[]
  layers[key]=layer
  # Preserve normalised statuses in larger audit manifests too.
  if name!='soil':manifest['records']=raw;write(OUT/f'{name}-manifest.json',manifest)
result={'schema_version':'hainan-environment-v1','built_at':'2026-10-03','execution':'dot cloud only','epsg':4326,'base_path':'./data/hainan/regional/environment/','scope_note':aois['scope_note'],'completion_gate':aois['completion_gate'],'layers':layers,'quality_notes':['All delivered image assets are actual raster-derived pixels. No placeholders or fabricated island values.','Broad geographic envelopes contain ocean and can include land outside the administrative scope; counts are rectangular-grid support, not provincial land completeness.','Native DSM ~30 m, SoilGrids ~250 m and CHIRPS ~5.5 km remain distinct; previews can be coarser.','DSM is historical surface height including vegetation/buildings. Source zero or absent tile does not establish present-day reef or reclaimed-island topography.','CHIRPS data coverage is not temperature, evapotranspiration, or a full climate model.','Offshore soil is audited at four named windows only; no claim of complete offshore soil mapping.']}
write(OUT/'environment-manifest.json',result)
files={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in OUT.iterdir() if p.is_file() and p.name!='asset-checksums.json'}
write(OUT/'asset-checksums.json',{'files':files,'total_bytes':sum(x['bytes'] for x in files.values())})
print('assets bytes',sum(x['bytes'] for x in files.values()),'records',sum(len(v['previews']) for v in layers.values()))
