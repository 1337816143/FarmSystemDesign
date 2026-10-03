import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {imageryDisplayRecords} from '../src/regional-atlas-layers.js';
import {localRasterRecords,pixelIndex} from '../src/regional-raster.js';
import {atlasCoverageSummary} from '../src/hainan-atlas.js';
import {viewScaleText,mainlandImageryStatus} from '../src/atlas-status.js';
const root=new URL('../data/hainan/regional/',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root)));
const manifest=read('imagery-local/manifest.json'),legacy=read('imagery/preview-manifest.json');
const records=imageryDisplayRecords(manifest,legacy);
const coords=(lon,lat,z)=>({x:Math.floor((lon+180)/360*2**z),y:Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*2**z),z});
test('complete exact-transform mainland imagery supplies every published LOD and preserves offshore previews',()=>{
 assert.equal(manifest.method_version,'v2-exact-transform');assert.equal(manifest.native_grid_complete,true);
 assert.equal(manifest.records.length,170);assert.equal(manifest.records.filter(r=>r.level===0).length,114);
 assert.deepEqual(manifest.levels.map(l=>l.completed_tiles),[114,36,13,5,2]);
 assert.equal(records.filter(r=>r.local_native).length,170);
 assert.deepEqual(records.filter(r=>!r.local_native).map(r=>r.id),legacy.records.filter(r=>r.group!=='main').map(r=>r.id));
 assert.ok(records.filter(r=>r.local_native).every(r=>r.preview.startsWith('imagery-local/')&&r.status_preview.startsWith('imagery-local/')));
 assert.throws(()=>imageryDisplayRecords({...manifest,native_grid_complete:false},legacy),/not completely verified/);
 assert.throws(()=>imageryDisplayRecords({...manifest,method_version:'approximate'},legacy),/not completely verified/);
});
test('mainland arbitrary interior viewpoints use exactly one current LOD and never old named previews',()=>{
 for(const [lon,lat] of [[109.8,19.1],[109.05,19.15],[110.35,18.9],[110.33,19.65]])for(let z=8;z<=18;z++){
  const selected=localRasterRecords(records,coords(lon,lat,z)).filter(r=>r.local_native);
  const expected=z<=10?4:z===11?3:z===12?2:z===13?1:0;
  assert.ok(selected.length>0,`${lon},${lat},z${z}`);assert.ok(selected.every(r=>r.level===expected));
  assert.ok(selected.some(r=>pixelIndex(lon,lat,r.bounds_wsen,r.width,r.height)>=0));
  assert.ok(!selected.some(r=>['haikou','sanya','danzhou','wenchang'].includes(r.id)));
 }
 assert.equal(localRasterRecords(records,coords(112.34,16.83,14)).filter(r=>r.local_native).length,0);
});
test('all published RGB blocks match the frozen producer bytes and advertised geographic grid',()=>{
 for(const r of manifest.records){
  const bytes=fs.readFileSync(new URL('imagery-local/'+r.preview,root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),r.sha256,r.id);assert.equal(bytes.length,r.image_bytes);
  assert.equal(r.width,2048);assert.equal(r.height,2048);const b=r.bounds_wsen,d=r.pixel_size_degrees;
  assert.ok(Math.abs((b[2]-b[0])/r.width-d[0])<1e-12);assert.ok(Math.abs((b[3]-b[1])/r.height-d[1])<1e-12);
  const status=fs.readFileSync(new URL('imagery-local/'+r.status_preview,root));assert.equal(status.readUInt32BE(16),r.width);assert.equal(status.readUInt32BE(20),r.height);
 }
 const v=read('imagery-local/verification.json');assert.equal(v.checked_native_tiles,114);assert.equal(v.raw_rgb_and_guard_control_points,5360);
 assert.deepEqual(v.approx_main_island_mask_status_counts,{'0':0,'1':294847,'2':357545392,'3':0});
 assert.match(v.coverage_denominator,/Not surveyed land area or provincial completeness/);
});
test('imagery status reports actual local grid resolution at each display level',()=>{
 for(const [zoom,grid] of [[10,/15[01] m × 160 m/],[11,/7[56] m × 80 m/],[12,/38 m × 40 m/],[13,/19 m × 20 m/],[14,/9 m × 10 m/],[18,/9 m × 10 m/]]){
  const text=viewScaleText({records},{lng:109.8,lat:19.1},zoom,'imagery',true);assert.match(text,grid);assert.doesNotMatch(text,/reading original source windows/);
 }
 assert.match(viewScaleText({records},{lng:112.34,lat:16.83},14,'imagery',true),/reading original source windows/);
});

test('mainland selection summary describes current blocks without an obsolete no-overview claim',()=>{
 const zh=mainlandImageryStatus(manifest),en=mainlandImageryStatus(manifest,true);
 assert.match(zh,/114个连续细块与56个分级预览/);assert.match(zh,/14级/);assert.match(zh,/不是穷尽/);assert.doesNotMatch(zh,/尚无整组预览|12级.*COG/);
 assert.match(en,/114 continuous fine blocks and 56 overview blocks/);assert.match(en,/quality gaps/);assert.doesNotMatch(en,/No precomputed overview/);
});

test('current-layer summary retains continuous mainland imagery after state-isolation changes',()=>{
 const config={kind:'imagery',metadata:manifest,records};
 for(const [id,isMainlandSelection] of [['main',false],['county-2',false],['wuzhishan',true]]){
  const text=atlasCoverageSummary({layer:'imagery',config,id,isMainlandSelection,zoom:14});
  assert.match(text,/114个连续细块与56个分级预览/);assert.doesNotMatch(text,/尚无整组预览|原始COG/);
 }
 assert.match(atlasCoverageSummary({layer:'imagery',config,id:'xisha',zoom:8}),/尚无整组预览/);
});
