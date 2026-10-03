"""Build a dated community-reference layer, never an official county boundary.
Source acquisition: official Geofabrik Hainan OSM PBF, then GDAL OSM driver.
Requires /usr/bin/python3 with installed GDAL, and ogr2ogr. Source cache external.
"""
import json,hashlib,re,subprocess,urllib.request,shutil,os
from pathlib import Path
from osgeo import ogr,osr
ROOT=Path(__file__).resolve().parents[1];CACHE=Path(os.environ.get('FARM_SOURCE_CACHE',str(ROOT.parent/'cache')));CACHE.mkdir(exist_ok=True)
source=CACHE/'hainan-20261003.osm.pbf';geo=CACHE/'admin-osm.geojson';url='https://download.geofabrik.de/asia/china/hainan-latest.osm.pbf'
if not source.exists():
 with urllib.request.urlopen(url,timeout=60) as r,source.open('wb') as f:shutil.copyfileobj(r,f)
if not geo.exists():subprocess.run(['ogr2ogr','-f','GeoJSON',str(geo),str(source),'multipolygons','-where',"boundary='administrative'"],check=True)
names=['海口市','三亚市','三沙市','儋州市','五指山市','琼海市','文昌市','万宁市','东方市','定安县','屯昌县','澄迈县','临高县','白沙黎族自治县','昌江黎族自治县','乐东黎族自治县','陵水黎族自治县','保亭黎族苗族自治县','琼中黎族苗族自治县']
data=json.load(open(geo));features=[];geoms=[]
wgs=osr.SpatialReference();wgs.ImportFromEPSG(4326);wgs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);utm=osr.SpatialReference();utm.ImportFromEPSG(32649);to=osr.CoordinateTransformation(wgs,utm)
for name in names:
 matches=[f for f in data['features'] if f['properties'].get('name')==name]
 assert len(matches)<=1,(name,len(matches))
 if not matches:continue
 f=matches[0];g=ogr.CreateGeometryFromJson(json.dumps(f['geometry']));assert g.IsValid(),name
 tags=dict(re.findall(r'"([^\"]+)"=>"([^\"]*)"',f['properties'].get('other_tags','')))
 p={'name':name,'shapeName':name,'osm_relation_id':f['properties'].get('osm_id'),'source_admin_level':f['properties'].get('admin_level'),'reference_kind':'community administrative boundary; not official','snapshot_download_date':'2026-10-03','license':'ODbL-1.0','source_url':'https://www.openstreetmap.org/relation/'+f['properties']['osm_id']}
 if 'division_code' in tags:p['source_division_code']=tags['division_code']
 g.Transform(to);geoms.append((name,g));p['utm_polygon_area_km2']=round(g.Area()/1e6,4);features.append({'type':'Feature','properties':p,'geometry':f['geometry']})
assert len(features)==18 and any(f['properties']['name']=='五指山市' for f in features)
assert not any(f['properties']['name']=='琼山区' for f in features)
overlaps=[]
for i,(a,g) in enumerate(geoms):
 for b,h in geoms[i+1:]:
  if g.Intersects(h):
   area=g.Intersection(h).Area()/1e6
   if area>0.000001:overlaps.append({'a':a,'b':b,'km2':area})
report={'source':'OpenStreetMap contributors via Geofabrik Hainan extract','source_url':url,'download_date':'2026-10-03','source_http_last_modified':'2026-10-03T01:13:29Z','source_pbf_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'source_bytes':source.stat().st_size,'license':'ODbL-1.0','license_url':'https://opendatacommons.org/licenses/odbl/1-0/','attribution':'© OpenStreetMap contributors','reference_url':'https://download.geofabrik.de/asia/china/hainan.html','geometry_crs':'EPSG:4326 (WGS84)','geometry_transform':'None; unmodified OSM relation coordinates from GDAL assembly, properties reduced','features':len(features),'all_geometries_valid':True,'overlaps_above_1m2':overlaps,'total_polygon_utm_km2':sum(f['properties']['utm_polygon_area_km2'] for f in features),'statistical_reference':'https://stats.hainan.gov.cn/tjj/tjsu/ndsj/2024/202412/P020250116308974141111.pdf','statistical_reference_year':2023,'units':[{'name':n,'geometry_status':'available-community-reference' if n!='三沙市' else 'missing-complete-aggregate-polygon'} for n in names],'limitations':['Community-maintained geometry, not authoritative current surveyed boundary. Download date is not proof every relation is current.','No completeness claim for nearshore islands, Sansha or maritime extents. Geofabrik extract omits the southern Nansha geography.','Mainland 18 names now match statistical aggregate names including Wuzhishan; no official topology, area or join approval is implied.','No county choropleth or statistical allocation uses this layer. Legal/public cartographic compliance not established by an ODbL data licence.','Municipal district children (including Qiongshan) are not peers of Haikou; they are excluded.']}
out=ROOT/'data/hainan/regional';(out/'county-osm-reference-20261003.geojson').write_text(json.dumps({'type':'FeatureCollection','name':'Hainan main-island OSM reference snapshot','properties':report,'features':features},ensure_ascii=False,separators=(',',':'))+'\n');(out/'county-osm-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2))
