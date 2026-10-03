"""Real browser regional regression. Public project data only; no deployment.
Run on candidate CI; external COG success is required and failures remain visible.
"""
from pathlib import Path
import argparse,json,os,time
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:4173');parser.add_argument('--output',default='test-results/regional');a=parser.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
report={'checks':[],'errors':[],'cog_responses':[],'views':[],'execution':'cloud CI browser; not mainland-China connection'}
def check(name,condition):
 if not condition:raise AssertionError(name)
 report['checks'].append(name)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'));context=browser.new_context(viewport={'width':1440,'height':1050});page=context.new_page()
 context.route('**/tile.openstreetmap.org/**',lambda r:r.abort())
 page.on('pageerror',lambda e:report['errors'].append(str(e)))
 def response(r):
  if 'e84-earth-search-sentinel-data' in r.url and '.tif' in r.url:
   h=r.headers;report['cog_responses'].append({'url':r.url,'status':r.status,'range':h.get('content-range'),'cors':h.get('access-control-allow-origin')})
 page.on('response',response)
 try:
  page.goto(a.url+'/#research',wait_until='domcontentloaded');page.wait_for_selector('#atlas-region:not([disabled])',timeout=30000)
  inventory=page.request.get(a.url+'/data/hainan/regional/aoi-inventory.json').json()
  bounds={r['id']:r['bbox'] for r in inventory['groups']+inventory['places']}
  native_at_point="""([lon,lat])=>Array.from(document.querySelectorAll('#hainan-atlas-map canvas[data-mode="native-cog-window"]')).some(c=>{const q=c._regionalCoords;if(!q||q.z<12||Number(c.dataset.validPixels)<=1000)return false;const n=2**q.z,x=Math.floor((lon+180)/360*n),y=Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n);return q.x===x&&q.y===y;})"""
  def choose(layer,place=None,native=False):
   if place:
    page.locator('#atlas-region').select_option(place);page.wait_for_timeout(800)
   page.locator(f'[data-atlas="{layer}"]').click()
   # Wait for the selected view before examining tile mode. Leaflet can retain
   # a previous native zoom's tiles while the new lower-zoom overview is loading.
   page.wait_for_function("document.querySelector('#atlas-load-label').hidden && !document.querySelector('#hainan-atlas-map').classList.contains('leaflet-zoom-anim')",timeout=120000)
   if native:
    b=bounds[place];center=[(b[0]+b[2])/2,(b[1]+b[3])/2]
    # Geographic source windows are entered through the same controls as a user.
    for _ in range(4):
     if page.evaluate(native_at_point,center):break
     page.locator('#hainan-atlas-map .leaflet-control-zoom-in').click();page.wait_for_timeout(300)
     page.wait_for_function("document.querySelector('#atlas-load-label').hidden && !document.querySelector('#hainan-atlas-map').classList.contains('leaflet-zoom-anim')",timeout=120000)
   if native:page.wait_for_function(native_at_point,arg=center,timeout=120000)
   else:page.wait_for_function("() => Array.from(document.querySelectorAll('#hainan-atlas-map canvas.leaflet-tile')).some(c=>Number(c.dataset.validPixels)>1000)",timeout=120000)
   page.wait_for_function("!document.querySelector('.hainan-atlas').classList.contains('atlas-loading')",timeout=120000)
   if native:check('native COG pixels visible at selected window '+place,page.evaluate(native_at_point,center))
   canvases=page.locator('#hainan-atlas-map canvas.leaflet-tile').evaluate_all("els=>els.map(c=>({mode:c.dataset.mode,pixels:Number(c.dataset.validPixels||0)}))")
   check('actual raster pixels '+layer+' '+str(place),any(c['pixels']>1000 for c in canvases));report['views'].append({'layer':layer,'place':place,'tiles':canvases});page.screenshot(path=str(out/f'{layer}-{place or "view"}.png'),full_page=True)
  choose('imagery','main')
  check('whole island overview is present',page.locator('#hainan-atlas-map canvas[data-mode="local-overview"]').count()>0)
  panel=page.locator('#atlas-coverage-panel')
  panel.locator('summary').click();page.wait_for_selector('#coverage-rows tr')
  check('coverage register shows172 source grids and10 named windows','172' in panel.inner_text() and '10' in panel.inner_text())
  check('coverage table is paginated',page.locator('#coverage-rows tr').count()==10)
  page.locator('#coverage-kind').select_option('grids');page.locator('#coverage-search').fill('MGRS-49PDL')
  check('cloudy grid sample remains quality rejected','质量层排除' in page.locator('#coverage-rows').inner_text())
  page.locator('#coverage-search').fill('MGRS-50NPN');check('zero grid sample remains explicitly zero','全零' in page.locator('#coverage-rows').inner_text())
  page.locator('#coverage-search').fill('');page.locator('#coverage-footprints').check()
  page.wait_for_function("document.querySelectorAll('#hainan-atlas-map path.leaflet-interactive').length===172",timeout=30000)
  check('all172 actual source footprints are available',page.locator('#hainan-atlas-map path.leaflet-interactive').count()==172)
  page.locator('#coverage-footprints').uncheck();page.locator('#coverage-kind').select_option('objects')
  check('named object list retains137 records','137' in page.locator('#coverage-page-status').inner_text())
  page.locator('#coverage-object-points').check();page.wait_for_function("document.querySelectorAll('#hainan-atlas-map path.leaflet-interactive').length===135")
  check('invalid OSM shapes do not produce guessed points',page.locator('#hainan-atlas-map path.leaflet-interactive').count()==135)
  page.locator('#coverage-object-points').uncheck();panel.locator('summary').click()
  page.locator('#atlas-sansha-boundaries').check();page.wait_for_function("document.querySelectorAll('#hainan-atlas-map path.leaflet-interactive').length===1")
  check('Sansha is a separate partial reference','部分范围' in page.locator('.atlas-aside').inner_text());page.locator('#atlas-sansha-boundaries').uncheck()
  page.locator('#atlas-region').select_option('xisha');page.wait_for_function("document.querySelector('#atlas-runtime-coverage').textContent.includes('无本地概览')",timeout=30000)
  check('no overview is explained separately from source completeness','12级' in page.locator('#atlas-runtime-coverage').inner_text())
  # Independent native source windows around opposite sides and center of Hainan.
  for place in ['haikou','sanya','danzhou','wuzhishan','wenchang','yongxing','yongshu','zhubi','huangyan']:
   choose('imagery',place,native=True)
  targeted=page.request.get(a.url+'/data/hainan/regional/coverage/targeted-audit.json').json()
  for obj in targeted['objects']:
   if obj['status']!='targeted-point-closed':continue
   if page.locator('#atlas-coverage-panel').get_attribute('open') is None:page.locator('#atlas-coverage-panel summary').click()
   page.wait_for_selector('#coverage-kind');page.locator('#coverage-kind').select_option('objects');page.locator('#coverage-group').select_option('all');page.locator('#coverage-search').fill(obj['object_id'])
   page.locator('#coverage-rows [data-coverage-locate]').click();page.wait_for_timeout(800)
   page.locator('[data-atlas="imagery"]').click()
   point=obj['representative_point_wgs84']
   # Canvas center coordinates are rounded to display pixels; a3x3 neighborhood allows the
   # at-most-one-display-pixel reprojection offset without accepting unrelated distant imagery.
   page.wait_for_function("""([lon,lat])=>Array.from(document.querySelectorAll('#hainan-atlas-map canvas[data-mode="native-cog-window"]')).some(c=>{const q=c._regionalCoords;if(!q)return false;const n=2**q.z,x=(lon+180)/360*n,y=(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n;if(Math.floor(x)!==q.x||Math.floor(y)!==q.y)return false;const col=Math.min(253,Math.max(0,Math.floor((x-q.x)*256)-1)),row=Math.min(253,Math.max(0,Math.floor((y-q.y)*256)-1)),d=c.getContext('2d').getImageData(col,row,3,3).data;return Array.from({length:9},(_,i)=>d[i*4+3]).some(v=>v>0);})""",arg=point,timeout=120000)
   page.wait_for_function("!document.querySelector('.hainan-atlas').classList.contains('atlas-loading')",timeout=120000)
   check('targeted point has nearby native rendered pixels '+obj['object_id'],True)
   check('targeted validated scene was really requested '+obj['object_id'],any(obj['accepted_evidence']['scene_id'] in r['url'] and r['status']==206 for r in report['cog_responses']))
   page.screenshot(path=str(out/('targeted-'+obj['object_id'].replace('/','-')+'.png')),full_page=True)
  page.locator('#atlas-coverage-panel summary').click()
  # User keyboard pan moves away from the named sample, then loads fresh native windows.
  page.locator('#atlas-region').select_option('danzhou');page.locator('#hainan-atlas-map').press('ArrowRight');page.locator('#hainan-atlas-map').press('ArrowUp');page.wait_for_timeout(1000);choose('imagery',None,native=False)
  for layer,place in [('dsm','main'),('rain','main'),('soil','wuzhishan'),('soc','wuzhishan')]:
   choose(layer,place);check('quantitative layer has a visible legend '+layer,page.locator('#atlas-regional-legend').is_visible())
  page.locator('#atlas-region').select_option('wuzhishan');page.locator('[data-atlas="soil"]').click();page.wait_for_timeout(800);box=page.locator('#hainan-atlas-map').bounding_box();page.locator('#hainan-atlas-map').click(position={'x':box['width']/2,'y':box['height']/2});page.wait_for_function("document.querySelector('#atlas-inspect').textContent.includes('预测 pH:')")
  check('soil query retains model status','非田间实测' in page.locator('#atlas-inspect').inner_text())
  page.locator('[data-atlas="dsm"]').click();page.locator('#atlas-region').select_option('zhubi');page.wait_for_timeout(1000);page.locator('#hainan-atlas-map').click(position={'x':box['width']/2,'y':box['height']/2});page.wait_for_function("document.querySelector('#atlas-inspect').textContent.includes('无可靠来源值')")
  check('zero-only offshore DSM is not reported as measured zero','0.0 m' not in page.locator('#atlas-inspect').inner_text())
  page.locator('#atlas-osm-boundaries').check();check('OSM reference has18 aggregated features',page.locator('#hainan-atlas-map path.leaflet-interactive').count()==18);page.locator('#atlas-osm-boundaries').uncheck()
  # Current user-facing mainland layers must work through real controls, beyond named samples.
  page.locator('nav [data-nav="atlas"]').click();page.wait_for_selector('#atlas-region:not([disabled])')
  check('direct data map exposes18 county reference views',page.locator('#atlas-region option[value^="county-"]').count()==18)
  choose('dsm','main');page.locator('#atlas-native-view').click()
  page.wait_for_function("document.querySelector('#atlas-load-label').hidden && Array.from(document.querySelectorAll('#hainan-atlas-map canvas')).some(c=>c._regionalCoords?.z>=11&&Number(c.dataset.validPixels)>1000)",timeout=60000)
  check('mainland elevation detail button loads continuous source-scale data','来源 30 m' in page.locator('#atlas-scale-status').inner_text())
  page.screenshot(path=str(out/'mainland-elevation-detail.png'),full_page=True)
  choose('classes2025','main');check('mainland2025 classification uses local class-code tiles',page.locator('canvas[data-mode=local-classification]').count()>0)
  page.locator('#atlas-native-view').click();page.wait_for_function("document.querySelector('#atlas-load-label').hidden && Array.from(document.querySelectorAll('canvas[data-mode=local-classification]')).some(c=>Number(c.dataset.validPixels)>1000)",timeout=60000)
  check('2025 detail classification remains local at close zoom',page.locator('#atlas-scale-status').inner_text().find('来源 10 m')>=0)
  page.screenshot(path=str(out/'mainland-landcover-detail.png'),full_page=True)
  choose('crops2025','main');check('crop-only transparency is explained','仅显示类别5' in page.locator('#atlas-runtime-coverage').inner_text())
  choose('monthlyRain','main');page.locator('#atlas-month').select_option('2025-01');page.wait_for_function("document.querySelector('#atlas-load-label').hidden",timeout=60000)
  january=page.locator('#hainan-atlas-map canvas').evaluate_all("es=>es.reduce((n,c)=>n+c.getContext('2d').getImageData(0,0,256,256).data.reduce((a,v)=>a+v,0),0)")
  page.locator('#atlas-month').select_option('2025-07');page.wait_for_function("document.querySelector('#atlas-load-label').hidden",timeout=60000)
  july=page.locator('#hainan-atlas-map canvas').evaluate_all("es=>es.reduce((n,c)=>n+c.getContext('2d').getImageData(0,0,256,256).data.reduce((a,v)=>a+v,0),0)")
  check('monthly rainfall changes real raster values without mixing months',january!=july and '2025-07' in page.locator('#atlas-regional-status').inner_text())
  choose('temperature','main');check('monthly temperature retains coarse source scale','55–70km' in page.locator('#atlas-current-type').inner_text() and '°C' in page.locator('#atlas-regional-legend').inner_text())
  page.screenshot(path=str(out/'mainland-monthly-climate.png'),full_page=True)
  for layer in ['soil','imagery','rain','dsm','classes2025','soc','landcover']:
   page.locator(f'[data-atlas="{layer}"]').click()
  page.wait_for_timeout(1200);check('rapid switching retains final selected layer',page.locator('[data-atlas="landcover"]').get_attribute('aria-pressed')=='true')
  page.locator('#hainan-atlas-map .leaflet-control-zoom-in').click()
  page.locator('[data-nav="overview"]').click();page.wait_for_selector('.parcel');page.wait_for_timeout(500);check('zoom then navigation has no disposal exception',not report['errors']);check('FTW110 original geometries preserved',page.locator('.parcel').count()==110)
  for mode in ['crops2025','classes2025','prediction']:page.locator('#spatial-data-mode').select_option(mode)
  check('source mode round trip preserves110 plots',page.locator('.parcel').count()==110)
  page.set_viewport_size({'width':390,'height':844});page.locator('[data-action="menu"]').click();page.locator('nav [data-nav="atlas"]').click();page.wait_for_selector('#atlas-region:not([disabled])');check('mobile directly opens the Hainan data map',page.locator('.atlas-workspace').count()==1);check('mobile map begins within the first screen',page.locator('#hainan-atlas-map').evaluate('e=>e.getBoundingClientRect().top<innerHeight'));page.screenshot(path=str(out/'mainland-home-mobile.png'),full_page=True);page.locator('[data-action="menu"]').click();page.locator('[data-nav="research"]').click();page.wait_for_selector('#atlas-region:not([disabled])');page.wait_for_timeout(1200);check('mobile page has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'));page.screenshot(path=str(out/'regional-mobile.png'),full_page=True)
  page.locator('button[data-language="en"]').click();page.wait_for_timeout(1000);check('regional English UI contains no untranslated Chinese',not page.evaluate("/[\\u3400-\\u9fff]/.test(document.querySelector('main').innerText)"))
  # An isolated context has no prior preview cache. A failed image request must be recoverable.
  failed_context=browser.new_context(viewport={'width':1200,'height':1000},service_workers='block')
  failed_context.route('**/tile.openstreetmap.org/**',lambda r:r.abort())
  failed_context.route('**/imagery/previews/main.webp',lambda r:r.abort())
  failed=failed_context.new_page();failed.on('pageerror',lambda e:report['errors'].append(str(e)))
  failed.goto(a.url+'/#research',wait_until='domcontentloaded');failed.wait_for_selector('#atlas-region:not([disabled])')
  failed.wait_for_selector('#atlas-retry-raster:not([hidden])',timeout=60000)
  check('request failure is not mislabeled as source no-data','请求或解码失败' in failed.locator('#atlas-runtime-coverage').inner_text())
  failed_context.unroute('**/imagery/previews/main.webp');failed.locator('#atlas-retry-raster').click()
  failed.wait_for_function("Array.from(document.querySelectorAll('#hainan-atlas-map canvas')).some(c=>Number(c.dataset.validPixels)>1000)",timeout=60000)
  failed.wait_for_function("document.querySelector('#atlas-retry-raster').hidden",timeout=60000)
  check('explicit retry recovers actual preview pixels',not failed.locator('#atlas-retry-raster').is_visible())
  check('recovered canvas is visually visible after initial tile failure',failed.locator('#hainan-atlas-map canvas').evaluate_all("els=>els.some(c=>Number(c.dataset.validPixels)>1000&&c.classList.contains('leaflet-tile-loaded')&&getComputedStyle(c).visibility==='visible'&&Number(getComputedStyle(c).opacity)>0)"));failed_context.close()
  # A boundary enabled before its response arrives must appear once data is ready.
  boundary_context=browser.new_context(viewport={'width':1200,'height':1000},service_workers='block');pending=[]
  boundary_context.route('**/county-osm-reference-20261003.geojson',lambda r:pending.append(r))
  boundary=boundary_context.new_page();boundary.goto(a.url+'/#atlas',wait_until='domcontentloaded');boundary.locator('#atlas-osm-boundaries').check()
  boundary.wait_for_function("document.querySelector('#atlas-osm-status').dataset.status==='loading'")
  content=(Path(__file__).resolve().parents[1]/'data/hainan/regional/county-osm-reference-20261003.geojson').read_text()
  for route in pending:route.fulfill(status=200,content_type='application/json',body=content)
  boundary.wait_for_function("document.querySelectorAll('#hainan-atlas-map path.leaflet-interactive').length===18",timeout=30000)
  check('early county-boundary toggle survives asynchronous data loading',True);boundary_context.close()
  # Local classification failure and retry must recover visibly, not only alter counters.
  class_context=browser.new_context(viewport={'width':1200,'height':1000},service_workers='block');class_context.route('**/landcover-local-manifest.json',lambda r:r.abort())
  cp=class_context.new_page();cp.goto(a.url+'/#atlas',wait_until='domcontentloaded');cp.locator('[data-atlas="classes2025"]').click();cp.wait_for_selector('#atlas-retry-raster:not([hidden])',timeout=60000)
  check('classification request failure has visible retry feedback','请求失败' in cp.locator('#atlas-runtime-coverage').inner_text())
  class_context.unroute('**/landcover-local-manifest.json');cp.locator('#atlas-retry-raster').click()
  cp.wait_for_function("Array.from(document.querySelectorAll('canvas[data-mode=\"local-classification\"]')).some(c=>Number(c.dataset.validPixels)>1000&&c.classList.contains('leaflet-tile-loaded')&&getComputedStyle(c).visibility==='visible')",timeout=60000)
  check('classification retry restores visible source-backed pixels',True);class_context.close()
  check('range-supported source pixels were really requested',sum(r['status']==206 and bool(r['range']) for r in report['cog_responses'])>=4)
  check('no browser exceptions',not report['errors']);report['success']=True
 finally:
  if not report.get('success'):
   try:
    report['failure_state']={'selected':page.locator('#atlas-region').input_value(),'runtime':page.locator('#atlas-runtime-coverage').inner_text(),'tiles':page.locator('#hainan-atlas-map canvas.leaflet-tile').evaluate_all("els=>els.map(c=>({mode:c.dataset.mode,pixels:c.dataset.validPixels,status:c.dataset.coverageStatus}))")}
    page.screenshot(path=str(out/'failure.png'),full_page=True)
   except Exception:pass
  (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));browser.close()
print(json.dumps({'passed':len(report['checks']),'checks':report['checks'],'errors':report['errors'],'cog206':sum(r['status']==206 and bool(r['range']) for r in report['cog_responses'])},ensure_ascii=False))
