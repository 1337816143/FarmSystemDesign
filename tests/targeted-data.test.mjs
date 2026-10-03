import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {hasTargetedScenePriority} from '../src/regional-raster.js';
const root=new URL('../data/hainan/regional/coverage/',import.meta.url);
const audit=JSON.parse(fs.readFileSync(new URL('targeted-audit.json',root),'utf8'));
const scenes=JSON.parse(fs.readFileSync(new URL('targeted-scenes.json',root),'utf8')).scenes;

test('only eight source-backed point reads enter localized display priority',()=>{
 assert.equal(audit.objects.length,9);assert.equal(scenes.length,8);
 const closed=audit.objects.filter(o=>o.status==='targeted-point-closed');assert.equal(closed.length,8);
 for(const obj of closed){
  const e=obj.accepted_evidence;assert.equal(e.representative_point_inside_geometry,true);assert.equal(e.scl_guard_accepted,true);assert.equal(e.quality_guard_m,60);assert.equal(e.scl_guard_values.flat().length,49);
  assert.ok([2,4,5,6].includes(e.scl));assert.ok(e.rgb.some(n=>n>0));assert.equal(e.scl_guard_values.flat().some(n=>[3,8,9,10].includes(n)),false);
  const scene=scenes.find(s=>s.id===e.scene_id);assert.ok(scene);assert.equal(scene.assets.visual.href,e.rgb_url);assert.equal(scene.assets.scl.href,e.scl_url);
  const route=scene.verified_target_bounds.find(r=>r.object_id===obj.object_id);assert.ok(route);assert.equal(route.status,'rgb-and-scl-guard-accepted');assert.equal(hasTargetedScenePriority(scene,route.bbox_wgs84),true);
  assert.equal(obj.full_object_coverage_verified,false);
 }
 const unresolved=audit.objects.find(o=>o.object_id==='relation/11201627');assert.equal(unresolved.status,'unresolved-after-bounded-candidates');assert.equal(unresolved.accepted_evidence,null);assert.equal(unresolved.attempted_scene_count,12);
 assert.equal(scenes.some(s=>s.verified_target_bounds.some(r=>r.object_id==='relation/11201627')),false);
});

test('saturation evidence remains visible without changing accepted source values',async()=>{
 const {hasSaturatedSample,objectEvidenceText}=await import('../src/coverage-panel.js');
 const register=JSON.parse(fs.readFileSync(new URL('coverage-register.json',root),'utf8'));
 const saturated=register.objects.filter(hasSaturatedSample);assert.equal(saturated.length,4);
 for(const record of saturated){assert.equal(record.status,'representative_point_value');assert.match(objectEvidenceText(record,true),/saturated.*clarity unverified/);assert.match(objectEvidenceText(record,false),/清晰度未核/);}
});
