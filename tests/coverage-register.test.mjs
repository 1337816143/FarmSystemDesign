import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeRasterPixels,rasterOutcome} from '../src/regional-raster.js';
import {dateExtent,escapeCoverage,filterCoverageRows,runtimeCoverageText} from '../src/coverage-panel.js';

test('rendered pixels override earlier rejected scenes; blank causes remain distinct',()=>{
 const rgba=new Uint8ClampedArray(6*4);rgba[3]=255;rgba[7]=255;
 const observed=Uint8Array.of(1,1,1,1,0,1),quality=Uint8Array.of(1,0,1,0,0,0),nodata=Uint8Array.of(0,1,0,1,0,0);
 assert.deepEqual(summarizeRasterPixels(rgba,observed,quality,nodata),{filled:2,qualityRejected:1,sourceNoData:2,outsideRead:1});
});
test('blank images distinguish absent overview, absent catalog, rejection, nodata and read failures',()=>{
 assert.equal(rasterOutcome({filled:0,attempts:0},false),'no-overview');
 assert.equal(rasterOutcome({filled:0,attempts:0},true),'outside-index');
 assert.equal(rasterOutcome({filled:0,attempts:3,failures:0,qualityRejected:12},true),'quality-masked');
 assert.equal(rasterOutcome({filled:0,attempts:3,failures:0,sourceNoData:12},true),'source-nodata');
 assert.equal(rasterOutcome({filled:0,attempts:3,failures:3},true),'read-error');
 assert.equal(rasterOutcome({filled:0,attempts:3,failures:1,qualityRejected:12},true),'incomplete-read');
 assert.equal(rasterOutcome({filled:12,attempts:3,failures:1},true),'partial-read');
 assert.equal(rasterOutcome({filled:12,attempts:3,failures:0},true),'displayed');
 assert.equal(rasterOutcome({filled:0,timeout:true},true),'timeout');
 assert.equal(rasterOutcome({filled:0,error:true},false),'read-error');
});
test('runtime text does not turn read failure or tile count into a coverage claim',()=>{
 const text=runtimeCoverageText([{status:'partial-read',filled:19,qualityRejected:7,sourceNoData:3,limited:true}],true);
 assert.match(text,/19 displayed pixels/);assert.match(text,/request or decoder failed/);assert.match(text,/not confirmed no-data/);assert.match(text,/12-source/);assert.match(text,/not island or provincial coverage/);
 assert.match(runtimeCoverageText([{status:'no-overview'}],true),/zoom to level 12/);
 const mixed=runtimeCoverageText([{status:'displayed',filled:23},{status:'no-overview'}],false,{kind:'dsm'});
 assert.match(mixed,/部分边缘瓦片/);assert.doesNotMatch(mixed,/12级|原始来源影像/);
 const progressive=runtimeCoverageText([{status:'partial-loading',filled:23,pending:true}],true);
 assert.match(progressive,/23 displayed pixels/);assert.match(progressive,/still loading/);assert.doesNotMatch(progressive,/failed/);
 assert.match(runtimeCoverageText([{status:'outside-index'}],true),/outside this catalog/);
 assert.match(runtimeCoverageText([{status:'timeout'}],false),/45秒/);
 const partial={status:'displayed',filled:30000,outsideRead:35536,attempts:1,failures:0};
 assert.match(runtimeCoverageText([partial],true),/35,536 pixels lie outside the windows read/);
 assert.match(runtimeCoverageText([partial],false),/35,536 个像元不在已读窗口内/);
});
test('coverage filtering separates query groups and supports IDs and names',()=>{
 const rows=[{id:'a',name_zh:'永兴',name_en:'Woody Island',group:'xisha'},{mgrs:'MGRS-49ABC',query_groups:['main','xisha']},{id:'b',group:'nansha'}];
 assert.deepEqual(filterCoverageRows(rows,'xisha').map(r=>r.id||r.mgrs),['a','MGRS-49ABC']);
 assert.deepEqual(filterCoverageRows(rows,'all',' woody '),[rows[0]]);
 assert.deepEqual(filterCoverageRows(rows,'main','49a'),[rows[1]]);
 assert.deepEqual(filterCoverageRows(rows,'nansha','永兴'),[]);
});
test('coverage dates and source labels remain literal safe display data',()=>{
 assert.equal(dateExtent(['2025-12-01','2025-01-03','2025-12-01','bad']), '2025-01-03 – 2025-12-01');
 assert.equal(dateExtent([]),'—');assert.equal(escapeCoverage('<img onerror="x">&'), '&lt;img onerror=&quot;x&quot;&gt;&amp;');
});

test('a local tile reads preview QA to separate quality rejection from no observation',async()=>{
 const {createRegionalRasterLayer}=await import('../src/regional-raster.js');
 const old=Object.fromEntries(['document','Image','ImageData'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const images={
  'test-preview-rgb':Uint8ClampedArray.of(0,0,0,0,0,0,0,0,20,40,60,255),
  'test-preview-status':Uint8ClampedArray.of(0,0,0,255,1,1,1,255,2,2,2,255),
 };
 class GridLayer{constructor(opts){this.events=[];this._tiles={};this.initialize(opts);}initialize(opts){this.options=opts;}fire(name,detail){this.events.push({name,detail});}onRemove(){}static extend(methods){class Layer extends this{}Object.assign(Layer.prototype,methods);return Layer;}}
 globalThis.Image=class{constructor(){this.naturalWidth=3;this.naturalHeight=1;}set src(v){this._src=v;queueMicrotask(()=>this.onload());}removeAttribute(){}};
 globalThis.document={createElement:()=>{let im;return {dataset:{},setAttribute(){},getContext:()=>({drawImage(v){im=v;},getImageData:()=>({data:images[im._src]}),putImageData(){}})};}};
 globalThis.ImageData=class{constructor(data,width,height){Object.assign(this,{data,width,height});}};
 let layer;
 try{
  layer=createRegionalRasterLayer({GridLayer},{kind:'imagery',base:'test-',records:[{preview:'preview-rgb',status_preview:'preview-status',bounds_wsen:[-180,-86,180,86],pixel_size_degrees:[120,172]}]});
  const result=await new Promise(resolve=>layer.createTile({x:0,y:0,z:0},(error,tile)=>resolve({error,tile})));
  assert.equal(result.error,null);assert.equal(result.tile._coverage.filled,21760);assert.equal(result.tile._coverage.qualityRejected,22016);assert.equal(result.tile._coverage.sourceNoData,21760);assert.equal(result.tile._coverage.unknownTransparent,0);
 }finally{layer?.onRemove();for(const[k,d]of Object.entries(old)){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}
});

test('released coverage register remains traceable to actual raw read records and preserves gaps',async()=>{
 const fs=await import('node:fs');const base=new URL('../data/hainan/regional/',import.meta.url);const read=f=>JSON.parse(fs.readFileSync(new URL(f,base),'utf8'));
 const full=read('coverage/coverage-audit.json'),small=read('coverage/coverage-register.json'),shapes=read('coverage/grid-footprints.geojson');
 assert.equal(small.grids.length,172);assert.equal(small.previews.length,11);assert.equal(small.objects.length,137);assert.equal(shapes.features.length,172);
 assert.equal(small.summary.exhaustive_island_inventory,false);assert.equal(small.summary.province_wide_land_completeness_percent,null);
 assert.equal(small.objects.filter(o=>o.geometry_valid).length,135);assert.equal(small.objects.filter(o=>o.status==='representative_point_quality_rejected').length,1);
 for(const r of small.objects){
  const source=full.objects.find(o=>o.object_id===r.object_id);assert.ok(source);assert.equal(r.status,source.status);assert.equal(r.is_full_object_coverage_verified,false);
  const attempts=[...source.sample_attempts,...(source.targeted_repair_attempts||[])];
  assert.deepEqual(r.attempted_sample_dates,[...new Set(attempts.map(a=>a.date))].sort());
  assert.deepEqual(r.successful_sample_dates,[...new Set(attempts.filter(a=>(a.read_output_rgb_pixels??a.rgb_output_pixels??0)>0&&(a.read_output_scl_pixels??a.scl_output_pixels??0)>0).map(a=>a.date))].sort());
  if(r.sample_evidence){const evidence=source.sample_attempts.find(a=>a.scene_id===r.sample_evidence.scene_id&&a.status===r.sample_evidence.status);assert.ok(evidence);assert.equal(r.sample_evidence.status,r.status);assert.deepEqual(r.sample_evidence.rgb,evidence.rgb);assert.equal(r.sample_evidence.scl,evidence.scl);}
  if(!r.geometry_valid)assert.equal(r.representative_point_wgs84,null);
 }
 const grid=small.grids.find(g=>g.mgrs==='MGRS-49PDL');assert.equal(grid.rgb_sample_status,'sampled_rgb_quality_rejected');
 assert.equal(small.grids.find(g=>g.mgrs==='MGRS-50NPN').rgb_sample_status,'sampled_rgb_zero');
 const parent=read('administrative/sansha-osm-reference-20261003.geojson').features[0];assert.equal(parent.properties.osm_relation_id,2833102);assert.equal(parent.properties.official_complete_boundary,false);assert.equal(parent.properties.is_land_mask,false);assert.equal(parent.geometry.coordinates.length,12);
});

test('mixed coastal samples carry the same warning in table and map text',async()=>{
 const {objectEvidenceText,objectSampleDates,hasMixedSampleCenter}=await import('../src/coverage-panel.js');
 const r={status:'representative_point_value',sample_evidence:{pixel_centers_inside_object:{rgb:false,scl:true}},successful_sample_dates:['2025-12-31'],accepted_sample_dates:[]};
 assert.equal(hasMixedSampleCenter(r),true);assert.match(objectEvidenceText(r,true),/possible coastal mixing/);assert.match(objectEvidenceText(r,false),/面外值/);assert.deepEqual(objectSampleDates(r),['2025-12-31']);
});
