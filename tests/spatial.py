"""Independent geospatial checks of the released baseline source geometries."""
import json,hashlib
from pathlib import Path
from shapely.geometry import shape,box
from shapely.ops import transform,unary_union
from pyproj import Geod,Transformer
R=Path(__file__).resolve().parents[1];E=R/'data/evidence'
get=lambda n:json.loads((E/n).read_text(encoding='utf-8'))
src={str(f['properties']['id']):f for f in get('ftw-fields-2025.geojson')['features']}
selected=get('selected-fields.geojson')['features'];quality=get('quality-report.json');im=get('sentinel-imagery.json');g=Geod(ellps='WGS84');proj=Transformer.from_crs(4326,32649,always_xy=True).transform
land=unary_union([transform(proj,shape(f['geometry'])) for f in get('agricultural-evidence.geojson')['features']]);checks=[]
def check(name,v):
 assert v,name
 checks.append(name)
check('exact source coordinates including holes',all(f['geometry']==src[f['properties']['sourceId']]['geometry'] for f in selected))
check('valid geometry and non-empty interior',all(shape(f['geometry']).is_valid and not shape(f['geometry']).is_empty for f in selected))
check('independent ellipsoid area calculation',all(abs(abs(g.geometry_area_perimeter(shape(f['geometry']))[0])/1e4-f['properties']['areaHa'])<1e-6 for f in selected))
check('full historical image footprint coverage',all(box(*im['bbox']).covers(shape(f['geometry'])) for f in selected))
check('source and published image digest',hashlib.sha256((E/'sentinel2-visual.webp').read_bytes()).hexdigest()==im['sha256'])
check('interior label anchors',all(shape(f['geometry']).covers(__import__('shapely').geometry.Point(f['properties']['representativePoint'])) for f in selected))
check('all selected meet documented projected overlap',all((lambda p:p.intersection(land).area/p.area>=.9-1e-9)(transform(proj,shape(f['geometry']))) for f in selected))
metric=[transform(proj,shape(f['geometry'])) for f in selected]
check('no hidden overlapping double-counted geometry',all(p.intersection(q).area<=.01 for i,p in enumerate(metric) for q in metric[:i] if p.intersects(q)))
def source_hash_ok(name, expected):
 raw=(E/name).read_bytes()
 if hashlib.sha256(raw).hexdigest()==expected:return True
 # Git for Windows may check out tracked JSON with CRLF; the published source is LF.
 return Path(name).suffix in {'.json','.geojson'} and hashlib.sha256(raw.replace(b'\r\n',b'\n')).hexdigest()==expected
check('source snapshot digests',all(source_hash_ok(k,v) for k,v in quality['sourceHashes'].items()))
check('all 110 source confidence fields remain missing',len(selected)==110 and all(f['properties']['sourceConfidence'] is None for f in selected))
out=R/'test-results';out.mkdir(exist_ok=True);(out/'spatial-report.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'note':'Software geometry QA, NOT field accuracy validation.'},indent=2),encoding='utf-8');print(json.dumps({'passed':len(checks),'checks':checks}))
