"""Real browser regional regression. Public project data only; no deployment.
Run on candidate CI; external COG success is required and failures remain visible.
"""
from pathlib import Path
import argparse,json,os,re,time
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:4173');parser.add_argument('--output',default='test-results/regional');a=parser.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
report={'checks':[],'errors':[],'cog_responses':[],'local_rgb_responses':[],'source_requests':[],'view_generations':[],'views':[],'navigation':[],'execution':'cloud CI browser; not mainland-China connection'}
# These frozen reference cells were checked against the delivered RGB alpha and
# lossless QA PNGs: alpha255 and status2. This is a small repeatable display test,
# not an assertion that arbitrary centers or the whole island are cloud-free.
MAINLAND_CONTROLS={
 'haikou':([110.33,20.02],'0-598-108'),
 'sanya':([109.495,18.28],'0-594-99'),
 'danzhou':([109.55,19.535],'0-594-105'),
 'wuzhishan':([109.545,18.8],'0-594-101'),
 'wenchang':([110.765,19.615],'0-600-106'),
 '昌江黎族自治县':([108.9652676,19.202481],'0-591-104'),
 '琼中黎族苗族自治县':([109.83695325,19.07214605],'0-595-103'),
 '万宁市':([110.30369205,18.84279405],'0-598-102'),
 '定安县':([110.3332569,19.47286545],'0-598-105'),
}
def check(name,condition):
 if not condition:raise AssertionError(name)
 report['checks'].append(name)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'));context=browser.new_context(viewport={'width':1440,'height':1050});page=context.new_page()
 context.add_init_script("""(() => {
  const review=window.__regionalReview={generation:0,nextId:0,canvases:new WeakMap()};
  new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes){
   if(node.nodeType!==1)continue;
   const canvases=[...(node.matches('canvas')?[node]:[]),...node.querySelectorAll('canvas')];
   for(const canvas of canvases)if(!review.canvases.has(canvas))review.canvases.set(canvas,{id:++review.nextId,generation:review.generation});
  }}).observe(document,{childList:true,subtree:true});
 })();""")
 context.route('**/tile.openstreetmap.org/**',lambda r:r.abort())
 page.on('pageerror',lambda e:report['errors'].append(str(e)))
 generation=0;request_ids={}
 def request(r):
  if '/imagery-local/tiles/' in r.url or ('e84-earth-search-sentinel-data' in r.url and '.tif' in r.url):
   entry={'id':len(report['source_requests'])+1,'generation':generation,'url':r.url,'resource_type':r.resource_type}
   request_ids[r]=entry;report['source_requests'].append(entry)
 def response(r):
  requested=request_ids.get(r.request,{})
  common={'url':r.url,'status':r.status,'request_id':requested.get('id'),'request_generation':requested.get('generation'),'response_generation':generation,'from_service_worker':r.from_service_worker}
  if 'e84-earth-search-sentinel-data' in r.url and '.tif' in r.url:
   h=r.headers;report['cog_responses'].append({**common,'range':h.get('content-range'),'cors':h.get('access-control-allow-origin')})
  match=re.search(r'/imagery-local/tiles/(\d+-\d+-\d+)\.webp$',urlparse(r.url).path)
  if match:report['local_rgb_responses'].append({**common,'record_id':match.group(1),'content_type':r.headers.get('content-type','')})
 def request_failed(r):
  if r in request_ids:request_ids[r].update({'failure':r.failure,'failed_generation':generation})
 page.on('request',request)
 page.on('response',response)
 page.on('requestfailed',request_failed)
 try:
  page.goto(a.url+'/#research',wait_until='domcontentloaded');page.wait_for_selector('#atlas-region:not([disabled])',timeout=30000)
  inventory=page.request.get(a.url+'/data/hainan/regional/aoi-inventory.json').json()
  bounds={r['id']:r['bbox'] for r in inventory['groups']+inventory['places']}
  source_catalog=page.request.get(a.url+'/data/hainan/regional/imagery/scene-catalog.json').json()
  scenes={r['id']:r for r in source_catalog['scenes']}
  settled_view="""layer=>{
   const host=document.querySelector('.hainan-atlas'),map=document.querySelector('#hainan-atlas-map'),selected=document.querySelector('[data-atlas="'+layer+'"]');
   if(!host||!map||selected?.getAttribute('aria-pressed')!=='true'||host.classList.contains('atlas-loading')||host.classList.contains('atlas-error')||!document.querySelector('#atlas-load-label').hidden||!document.querySelector('#atlas-error-label').hidden||map.classList.contains('leaflet-zoom-anim'))return false;
   const b=map.getBoundingClientRect(),tiles=[...map.querySelectorAll('canvas.leaflet-tile')].filter(c=>{const r=c.getBoundingClientRect(),controller=c._abort||c._classController;return controller&&!controller.signal.aborted&&r.width>0&&r.height>0&&r.right>b.left&&r.left<b.right&&r.bottom>b.top&&r.top<b.bottom;});
   if(!tiles.length)return false;
   let visiblePixels=0;
   for(const c of tiles){
    const state=c._coverage||c._classCoverage,style=getComputedStyle(c);
    if(!state||state.pending||c._classPending||['loading','partial-loading','read-error','incomplete-read','partial-read','quality-unavailable','timeout'].includes(state.status))return false;
    if(!c.classList.contains('leaflet-tile-loaded')||style.visibility!=='visible'||Number(style.opacity)<.99)return false;
    const pixels=c.getContext('2d').getImageData(0,0,256,256).data;for(let i=3;i<pixels.length;i+=4)if(pixels[i])visiblePixels++;
   }
   return visiblePixels>1000;
  }"""
  def wait_for_settled(layer,target=page):
   target.wait_for_function(settled_view,arg=layer,timeout=120000)
   # Leaflet fades for200ms and prunes old zoom levels after250ms. Verify again
   # after that transition so screenshots cannot capture a transient first tile.
   target.wait_for_timeout(350)
   target.wait_for_function(settled_view,arg=layer,timeout=120000)
  def coverage_matches(label):
   text=page.locator('#atlas-regional-status').inner_text()
   return label in text and all(old not in text for old in ['1,316,924','1,640,250','80.29'])
  native_evidence="""({point:[lon,lat],local,generation,requirePoint=false,minPixels=1000})=>{
   const map=document.querySelector('#hainan-atlas-map'),review=window.__regionalReview;
   if(!map||!review||review.generation!==generation||map.classList.contains('leaflet-zoom-anim')||document.querySelector('[data-atlas="imagery"]').getAttribute('aria-pressed')!=='true')return [];
   const bounds=map.getBoundingClientRect(),result=[];
   for(const c of map.querySelectorAll('canvas.leaflet-tile')){
    const q=c._regionalCoords,meta=review.canvases.get(c),style=getComputedStyle(c),rect=c.getBoundingClientRect(),coverage=c._coverage;
    if(!q||!meta||meta.generation!==generation||!c.isConnected||!c._abort||c._abort.signal.aborted||coverage?.pending||!c.classList.contains('leaflet-tile-loaded')||style.visibility!=='visible'||Number(style.opacity)<=0||rect.width<=0||rect.height<=0)continue;
    let hidden=false;for(let parent=c.parentElement;parent;parent=parent.parentElement){const s=getComputedStyle(parent);if(s.display==='none'||s.visibility!=='visible'||Number(s.opacity)<=0){hidden=true;break;}}if(hidden)continue;
    if(local?(c.dataset.mode!=='local-source-tiles'||q.z!==14):(c.dataset.mode!=='native-cog-window'||q.z<12||q.z>14))continue;
    const n=2**q.z,x=(lon+180)/360*n,y=(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n;
    if(Math.floor(x)!==q.x||Math.floor(y)!==q.y)continue;
    const left=Math.max(rect.left,bounds.left),right=Math.min(rect.right,bounds.right),top=Math.max(rect.top,bounds.top),bottom=Math.min(rect.bottom,bounds.bottom);if(right<=left||bottom<=top)continue;
    const sx=Math.max(0,Math.floor((left-rect.left)/rect.width*256)),sy=Math.max(0,Math.floor((top-rect.top)/rect.height*256)),ex=Math.min(256,Math.ceil((right-rect.left)/rect.width*256)),ey=Math.min(256,Math.ceil((bottom-rect.top)/rect.height*256));
    const ctx=c.getContext('2d'),rgba=ctx.getImageData(sx,sy,ex-sx,ey-sy).data;let visiblePixels=0;for(let i=3;i<rgba.length;i+=4)if(rgba[i])visiblePixels++;
    if(visiblePixels<=minPixels)continue;
    const col=Math.min(253,Math.max(0,Math.floor((x-q.x)*256)-1)),row=Math.min(253,Math.max(0,Math.floor((y-q.y)*256)-1)),near=ctx.getImageData(col,row,3,3).data;
    const pointAlpha=Array.from({length:9},(_,i)=>near[i*4+3]);if(requirePoint&&!pointAlpha.some(v=>v>0))continue;
    let recordIds;try{recordIds=JSON.parse(c.dataset.recordIds||'[]');}catch{continue;}
    if(local&&(!recordIds.length||recordIds.some(id=>!/^0-\\d+-\\d+$/.test(id))))continue;
    result.push({canvasId:meta.id,generation:meta.generation,mode:c.dataset.mode,coords:{x:q.x,y:q.y,z:q.z},visiblePixels,pointAlpha,recordIds,sourceIds:coverage?.sourceIds||[],status:coverage?.status,qualityRejected:coverage?.qualityRejected||0,sourceNoData:coverage?.sourceNoData||0});
   }
   return result;
  }"""
  native_at_point='arg=>('+native_evidence+')(arg).length>0'
  def begin_view(layer,place):
   global generation
   generation+=1
   report['view_generations'].append({'generation':generation,'layer':layer,'place':place,'request_start':len(report['source_requests'])})
   page.evaluate('(g)=>{window.__regionalReview.generation=g}',generation)
   # A fresh imagery layer makes old retained canvases ineligible. Cached source
   # bytes may still be reused, but must match the records actually painted now.
   if layer=='imagery' and page.locator('[data-atlas="imagery"]').get_attribute('aria-pressed')=='true':page.locator('[data-atlas="landcover"]').click()
   return generation
  def assert_native(point,local,gen,label,require_point=False,expected_record=None,min_pixels=1000):
   page.locator('#hainan-atlas-map').scroll_into_view_if_needed()
   argument={'point':point,'local':local,'generation':gen,'requirePoint':require_point,'minPixels':min_pixels}
   page.wait_for_function(native_at_point,arg=argument,timeout=120000)
   evidence=page.evaluate(native_evidence,argument)
   check('current visible native pixels '+label,bool(evidence))
   matched=[]
   if local:
    ids={rid for tile in evidence for rid in tile['recordIds']}
    check('current mainland record is verified level0 '+label,bool(ids) and all(rid.startswith('0-') for rid in ids) and (expected_record is None or expected_record in ids))
    for rid in sorted(ids):
     responses=[r for r in report['local_rgb_responses'] if r['record_id']==rid and r['status']==200 and r['request_id'] is not None and r['request_generation']<=gen and 'image/webp' in r['content_type']]
     check('actual WebP response for current record '+rid,bool(responses));matched.append(responses[-1])
   else:
    for sid in {sid for tile in evidence for sid in tile['sourceIds']}:
     scene=scenes.get(sid,{})
     pair=[]
     for asset in ['visual','scl']:
      href=scene.get('assets',{}).get(asset,{}).get('href')
      reads=[r for r in report['cog_responses'] if r['url']==href and r['status']==206 and r['range'] and r['request_id'] is not None and r['request_generation']<=gen]
      if reads:pair.append(reads[-1])
     if len(pair)==2:matched.extend(pair)
    check('current offshore contributor has real RGB and SCL range responses '+label,bool(matched))
   report['views'].append({'generation':gen,'layer':'imagery','place':label,'reference_point':point,'point_requirement':'frozen QA2 mainland control' if local else 'validated target point' if require_point else 'visible pixels in center-containing tile; transparent center allowed, exact point cause not inferred','native_evidence':evidence,'source_responses':matched,'reused_source_responses':any(r['request_generation']<gen for r in matched)})
   return evidence
  def choose(layer,place=None,native=False):
   gen=begin_view(layer,place)
   if place:
    page.locator('#atlas-region').select_option(place);page.wait_for_timeout(800)
   page.locator(f'[data-atlas="{layer}"]').click()
   # Wait for the selected view before examining tile mode. Leaflet can retain
   # a previous native zoom's tiles while the new lower-zoom overview is loading.
   page.wait_for_function("document.querySelector('#atlas-load-label').hidden && !document.querySelector('#hainan-atlas-map').classList.contains('leaflet-zoom-anim')",timeout=120000)
   if native:
    local=place in MAINLAND_CONTROLS
    b=bounds[place];center=MAINLAND_CONTROLS[place][0] if local else [(b[0]+b[2])/2,(b[1]+b[3])/2]
    argument={'point':center,'local':local,'generation':gen,'requirePoint':local}
    if local:
     page.locator('#atlas-native-view').click()
     page.wait_for_function("document.querySelector('#atlas-load-label').hidden && !document.querySelector('#hainan-atlas-map').classList.contains('leaflet-zoom-anim')",timeout=120000)
    # Geographic source windows are entered through the same controls as a user.
    for _ in range(4):
     if page.evaluate(native_at_point,argument):break
     if local:break
     page.locator('#hainan-atlas-map .leaflet-control-zoom-in').click();page.wait_for_timeout(300)
     page.wait_for_function("document.querySelector('#atlas-load-label').hidden && !document.querySelector('#hainan-atlas-map').classList.contains('leaflet-zoom-anim')",timeout=120000)
   if native:assert_native(center,local,gen,place,require_point=local,expected_record=MAINLAND_CONTROLS[place][1] if local else None)
   else:page.wait_for_function("() => Array.from(document.querySelectorAll('#hainan-atlas-map canvas.leaflet-tile')).some(c=>Number(c.dataset.validPixels)>1000)",timeout=120000)
   page.wait_for_function("!document.querySelector('.hainan-atlas').classList.contains('atlas-loading')",timeout=120000)
   if native:check('native source pixels visible at selected window '+place,page.evaluate(native_at_point,argument))
   canvases=page.locator('#hainan-atlas-map canvas.leaflet-tile').evaluate_all("els=>els.map(c=>({mode:c.dataset.mode,pixels:Number(c.dataset.validPixels||0)}))")
   check('actual raster pixels '+layer+' '+str(place),any(c['pixels']>1000 for c in canvases));report['views'].append({'generation':gen,'layer':layer,'place':place,'tiles':canvases})
   if layer in ['dsm','classes2025','crops2025']:wait_for_settled(layer)
   page.screenshot(path=str(out/f'{layer}-{place or "view"}.png'),full_page=True)
  choose('imagery','main')
  check('whole island overview is present',page.locator('#hainan-atlas-map canvas[data-mode="local-source-tiles"]').count()>0)
  # Exercise real visible controls without any transition wait between actions.
  # The old county fitBounds animation silently swallowed the immediate detail
  # click. A later retry or a sleep here would hide that regression.
  page.wait_for_function("document.querySelectorAll('#atlas-region [data-county-views] option').length===18")
  home_scale=page.locator('#atlas-scale-status').inner_text().split(' · ')[0]
  home_zoom=float(re.search(r'[\d.]+',home_scale).group())
  def assert_detail(county,gen,label,english=False):
   expected='Zoom 14.0' if english else '缩放 14.0 级'
   page.wait_for_function("text=>document.querySelector('#atlas-scale-status').textContent.startsWith(text)",arg=expected,timeout=5000)
   selected=page.locator('#atlas-region option:checked').inner_text()
   check('latest navigation selects zoom14 and '+label,selected==county)
   point,record=MAINLAND_CONTROLS["定安县" if english else county]
   assert_native(point,True,gen,label,require_point=True,expected_record=record)
   report['navigation'].append({'case':label,'selected':selected,'scale':page.locator('#atlas-scale-status').inner_text()})
  gen=begin_view('imagery','immediate county detail')
  page.locator('[data-atlas="imagery"]').click()
  page.locator('#atlas-region').select_option(label='定安县')
  page.locator('#atlas-native-view').click()
  assert_detail('定安县',gen,'immediate Dingan detail')
  gen=begin_view('imagery','rapid controls final Wanning')
  page.locator('[data-atlas="imagery"]').click()
  page.locator('#atlas-home-view').click()
  page.locator('#hainan-atlas-map .leaflet-control-zoom-in').click()
  page.locator('#atlas-region').select_option(label='定安县')
  page.locator('#atlas-native-view').click()
  page.locator('#atlas-region').select_option(label='万宁市')
  page.locator('#atlas-native-view').click()
  assert_detail('万宁市',gen,'rapid zoom county detail county detail')
  gen=begin_view('imagery','rapid controls final whole island')
  page.locator('[data-atlas="imagery"]').click()
  page.locator('#atlas-region').select_option(label='定安县')
  page.locator('#atlas-native-view').click()
  page.locator('#atlas-region').select_option(label='万宁市')
  page.locator('#atlas-native-view').click()
  page.locator('#atlas-home-view').click()
  page.wait_for_function("text=>document.querySelector('#atlas-scale-status').textContent.startsWith(text)",arg=home_scale,timeout=5000)
  wait_for_settled('imagery')
  # Require newly rendered overview canvases at the final zoom, not retained
  # native tiles. Locate their map-center coordinates from visible tile bounds.
  overview=page.evaluate("""({zoom,generation})=>{
   const map=document.querySelector('#hainan-atlas-map'),b=map.getBoundingClientRect(),cx=(b.left+b.right)/2,cy=(b.top+b.bottom)/2,result=[];
   for(const c of map.querySelectorAll('canvas.leaflet-tile')){
    const q=c._regionalCoords,r=c.getBoundingClientRect(),meta=window.__regionalReview.canvases.get(c);
    if(!q||q.z!==Math.round(zoom)||meta?.generation!==generation||c.dataset.mode!=='local-source-tiles'||!c._abort||c._abort.signal.aborted||c._coverage?.pending||!c.classList.contains('leaflet-tile-loaded')||getComputedStyle(c).visibility!=='visible'||Number(getComputedStyle(c).opacity)<=0||r.width<=0||r.height<=0||r.right<=b.left||r.left>=b.right||r.bottom<=b.top||r.top>=b.bottom)continue;
    const sx=Math.max(0,Math.floor((Math.max(r.left,b.left)-r.left)/r.width*256)),sy=Math.max(0,Math.floor((Math.max(r.top,b.top)-r.top)/r.height*256)),ex=Math.min(256,Math.ceil((Math.min(r.right,b.right)-r.left)/r.width*256)),ey=Math.min(256,Math.ceil((Math.min(r.bottom,b.bottom)-r.top)/r.height*256));
    const data=c.getContext('2d').getImageData(sx,sy,ex-sx,ey-sy).data;let pixels=0;for(let i=3;i<data.length;i+=4)if(data[i])pixels++;
    if(!pixels)continue;
    const n=2**q.z,x=q.x+(cx-r.left)/r.width,y=q.y+(cy-r.top)/r.height;
    result.push({coords:q,pixels,center:[x/n*360-180,Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI]});
   }return result;
  }""",{'zoom':home_zoom,'generation':gen})
  check('latest whole-island action restores region zoom and actual overview pixels',page.locator('#atlas-region').input_value()=='main' and page.locator('#atlas-view-status').inner_text()=='' and bool(overview) and all(abs(t['center'][0]-110)<.01 and abs(t['center'][1]-19.1555)<.01 for t in overview))
  report['navigation'].append({'case':'whole island wins rapid controls','scale':home_scale,'overview':overview})
  page.screenshot(path=str(out/'mainland-navigation-home-restored.png'),full_page=True)
  # Re-rendering the atlas while zoom/detail work was just requested must not
  # let an old map callback alter the new language or the next application page.
  page.locator('#atlas-region').select_option(label='定安县')
  page.locator('#atlas-native-view').click()
  page.locator('#hainan-atlas-map .leaflet-control-zoom-in').click()
  page.locator('button[data-language="en"]').click()
  page.wait_for_function("document.querySelectorAll('#atlas-region [data-county-views] option').length===18")
  gen=begin_view('imagery','English after interrupted navigation')
  page.locator('[data-atlas="imagery"]').click()
  page.locator('#atlas-region').select_option(label="Ding'an")
  page.locator('#atlas-native-view').click()
  assert_detail("Ding'an",gen,'English detail after map disposal',english=True)
  page.locator('#hainan-atlas-map .leaflet-control-zoom-in').click()
  page.locator('[data-nav="overview"]').click()
  page.wait_for_selector('.parcel')
  check('immediate navigation disposes the atlas and preserves110 FTW plots',page.locator('.parcel').count()==110 and page.locator('#hainan-atlas-map').count()==0 and not report['errors'])
  page.locator('button[data-language="zh"]').click()
  page.locator('[data-nav="research"]').click()
  page.wait_for_selector('#atlas-region:not([disabled])')
  choose('imagery','main')
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
  page.locator('#atlas-region').select_option('xisha')
  page.wait_for_function("document.querySelector('#atlas-load-label').hidden && !document.querySelector('#hainan-atlas-map').classList.contains('leaflet-zoom-anim') && Array.from(document.querySelectorAll('#hainan-atlas-map canvas')).some(c=>c.dataset.coverageStatus==='no-overview' && c._abort && !c._abort.signal.aborted)",timeout=30000)
  xisha_status=page.locator('#atlas-runtime-coverage').inner_text()
  check('missing edge overviews are explained separately from source completeness','12级' in xisha_status and any(text in xisha_status for text in ['没有本地预览','没有本地概览']) and '不是岛屿或全省覆盖率' in xisha_status)
  # Users reach near10m mainland tiles and native offshore COGs through the same zoom controls.
  for place in ['haikou','sanya','danzhou','wuzhishan','wenchang','yongxing','yongshu','zhubi','huangyan']:
   choose('imagery',place,native=True)
  # Mainland requests remain local even if every remote source window is unavailable.
  page.route('**/*e84-earth-search-sentinel-data*/**',lambda r:r.abort())
  for county in ['昌江黎族自治县','琼中黎族苗族自治县','万宁市','定安县']:
   gen=begin_view('imagery',county)
   page.locator('#atlas-region').select_option(label=county);page.wait_for_timeout(500)
   page.locator('[data-atlas="imagery"]').click();page.locator('#atlas-native-view').click()
   page.wait_for_function("document.querySelector('#atlas-load-label').hidden && !document.querySelector('#hainan-atlas-map').classList.contains('leaflet-zoom-anim')",timeout=60000)
   point,record=MAINLAND_CONTROLS[county]
   assert_native(point,True,gen,county,require_point=True,expected_record=record)
  page.unroute('**/*e84-earth-search-sentinel-data*/**')
  page.screenshot(path=str(out/'mainland-continuous-rgb-detail.png'),full_page=True)
  check('mainland native tiles use the verified local delivery',any(t['mode']=='local-source-tiles' and t['coords']['z']==14 and t['recordIds'] for v in report['views'] if v['layer']=='imagery' and v['place']=='wuzhishan' for t in v.get('native_evidence',[])))
  targeted=page.request.get(a.url+'/data/hainan/regional/coverage/targeted-audit.json').json()
  for obj in targeted['objects']:
   if obj['status']!='targeted-point-closed':continue
   gen=begin_view('imagery',obj['object_id'])
   if page.locator('#atlas-coverage-panel').get_attribute('open') is None:page.locator('#atlas-coverage-panel summary').click()
   page.wait_for_selector('#coverage-kind');page.locator('#coverage-kind').select_option('objects');page.locator('#coverage-group').select_option('all');page.locator('#coverage-search').fill(obj['object_id'])
   page.locator('#coverage-rows [data-coverage-locate]').click();page.wait_for_timeout(800)
   page.locator('[data-atlas="imagery"]').click()
   point=obj['representative_point_wgs84']
   # Canvas center coordinates are rounded to display pixels; a3x3 neighborhood allows the
   # at-most-one-display-pixel reprojection offset without accepting unrelated distant imagery.
   page.wait_for_function("!document.querySelector('.hainan-atlas').classList.contains('atlas-loading')",timeout=120000)
   # Tiny audited objects require their accepted point, not an arbitrary minimum
   # island area. Visibility, source responses and the current generation still apply.
   assert_native(point,False,gen,obj['object_id'],require_point=True,min_pixels=0)
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
  choose('dsm','main')
  check('DSM overview statistics are explicitly labeled with their own layer','地表高程 DSM' in page.locator('#atlas-regional-status').inner_text() and '80.29' in page.locator('#atlas-regional-status').inner_text())
  page.locator('#atlas-native-view').click()
  page.wait_for_function("document.querySelector('#atlas-load-label').hidden && Array.from(document.querySelectorAll('#hainan-atlas-map canvas')).some(c=>c._regionalCoords?.z>=11&&Number(c.dataset.validPixels)>1000)",timeout=60000)
  check('mainland elevation detail button loads continuous source-scale data','来源 30 m' in page.locator('#atlas-scale-status').inner_text())
  wait_for_settled('dsm')
  check('DSM detail replaces the old overview denominator',coverage_matches('连续约30m分块') and 'SCL' not in page.locator('#atlas-regional-status').inner_text())
  page.screenshot(path=str(out/'mainland-elevation-detail.png'),full_page=True)
  choose('classes2025','main');check('mainland2025 classification uses local class-code tiles',page.locator('canvas[data-mode=local-classification]').count()>0)
  page.locator('#atlas-native-view').click();page.wait_for_function("document.querySelector('#atlas-load-label').hidden && Array.from(document.querySelectorAll('canvas[data-mode=local-classification]')).some(c=>Number(c.dataset.validPixels)>1000)",timeout=60000)
  check('2025 detail classification remains local at close zoom',page.locator('#atlas-scale-status').inner_text().find('来源 10 m')>=0)
  wait_for_settled('classes2025')
  check('classification coverage never retains DSM statistics',coverage_matches('2025完整土地覆盖') and 'DSM' not in page.locator('#atlas-regional-status').inner_text())
  page.screenshot(path=str(out/'mainland-landcover-detail.png'),full_page=True)
  choose('crops2025','main');check('crop-only transparency is explained','仅显示类别5' in page.locator('#atlas-runtime-coverage').inner_text())
  check('crop-only coverage has its own label and no prior denominator',coverage_matches('2025仅作物类别'))
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
  check('historical2021 coverage replaces the previous layer statistics',coverage_matches('2021 WorldCover') and 'SCL' not in page.locator('#atlas-regional-status').inner_text())
  page.locator('#hainan-atlas-map .leaflet-control-zoom-in').click()
  page.locator('[data-nav="overview"]').click();page.wait_for_selector('.parcel');page.wait_for_timeout(500);check('zoom then navigation has no disposal exception',not report['errors']);check('FTW110 original geometries preserved',page.locator('.parcel').count()==110)
  for mode in ['crops2025','classes2025','prediction']:page.locator('#spatial-data-mode').select_option(mode)
  check('source mode round trip preserves110 plots',page.locator('.parcel').count()==110)
  page.set_viewport_size({'width':390,'height':844});page.locator('[data-action="menu"]').click();page.locator('nav [data-nav="atlas"]').click();page.wait_for_selector('#atlas-region:not([disabled])');check('mobile directly opens the Hainan data map',page.locator('.atlas-workspace').count()==1);check('mobile map begins within the first screen',page.locator('#hainan-atlas-map').evaluate('e=>e.getBoundingClientRect().top<innerHeight'))
  wait_for_settled('imagery');check('mobile homepage imagery fully settles without tile errors before capture',page.evaluate(settled_view,'imagery'));page.screenshot(path=str(out/'mainland-home-mobile.png'),full_page=True)
  page.locator('[data-action="menu"]').click();page.locator('[data-nav="research"]').click();page.wait_for_selector('#atlas-region:not([disabled])');wait_for_settled('imagery');check('mobile page has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'));page.screenshot(path=str(out/'regional-mobile.png'),full_page=True)
  page.locator('button[data-language="en"]').click();page.wait_for_timeout(1000);check('regional English UI contains no untranslated Chinese',not page.evaluate("/[\\u3400-\\u9fff]/.test(document.querySelector('main').innerText)"))
  # An isolated context has no prior preview cache. A failed image request must be recoverable.
  failed_context=browser.new_context(viewport={'width':1200,'height':1000},service_workers='block')
  failed_context.route('**/tile.openstreetmap.org/**',lambda r:r.abort())
  failed_context.route('**/imagery-local/tiles/*.webp',lambda r:r.abort())
  failed=failed_context.new_page();failed.on('pageerror',lambda e:report['errors'].append(str(e)))
  failed.goto(a.url+'/#research',wait_until='domcontentloaded');failed.wait_for_selector('#atlas-region:not([disabled])')
  failed.wait_for_selector('#atlas-retry-raster:not([hidden])',timeout=60000)
  check('request failure is not mislabeled as source no-data','请求或解码失败' in failed.locator('#atlas-runtime-coverage').inner_text())
  failed_context.unroute('**/imagery-local/tiles/*.webp');failed.locator('#atlas-retry-raster').click()
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
  cp=class_context.new_page();cp.goto(a.url+'/#atlas',wait_until='domcontentloaded');cp.wait_for_selector('#atlas-region:not([disabled])');cp.locator('[data-atlas="dsm"]').click();wait_for_settled('dsm',cp)
  check('failure regression starts from a real DSM overview denominator','80.29' in cp.locator('#atlas-regional-status').inner_text())
  cp.locator('[data-atlas="classes2025"]').click();cp.wait_for_selector('#atlas-retry-raster:not([hidden])',timeout=60000)
  check('classification request failure has visible retry feedback','请求失败' in cp.locator('#atlas-runtime-coverage').inner_text())
  failed_coverage=cp.locator('#atlas-regional-status').inner_text()
  check('failed classification cannot retain prior DSM coverage','2025完整土地覆盖' in failed_coverage and all(old not in failed_coverage for old in ['1,316,924','1,640,250','80.29','DSM']))
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
