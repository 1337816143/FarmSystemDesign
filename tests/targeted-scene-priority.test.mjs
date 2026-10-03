import test from 'node:test';
import assert from 'node:assert/strict';
import {hasTargetedScenePriority,compareCogScenes} from '../src/regional-raster.js';

test('point-validated dates take priority only near their explicitly scoped query window',()=>{
 const area=[113.00,19.53,113.05,19.56],target={id:'targeted',cloud_cover:35,nodata_percent:10,datetime:'2025-08-01T00:00:00Z',verified_target_bounds:[{object_id:'way/example',bbox_wgs84:area,quality_guard_m:60,status:'rgb-and-scl-guard-accepted'}]};
 const original={id:'original',cloud_cover:0,nodata_percent:0,datetime:'2025-12-01T00:00:00Z'};
 assert.equal(hasTargetedScenePriority(target,[113.01,19.54,113.03,19.55]),true);
 assert.deepEqual([original,target].sort((a,b)=>compareCogScenes(a,b,area)).map(r=>r.id),['targeted','original']);
 assert.deepEqual([target,original].sort((a,b)=>compareCogScenes(a,b,[110,18,111,19])).map(r=>r.id),['original','targeted']);
 assert.equal(hasTargetedScenePriority({...target,verified_target_bounds:[{...target.verified_target_bounds[0],status:'quality-rejected'}]},area),false);
 assert.equal(hasTargetedScenePriority({...target,verified_target_bounds:[{...target.verified_target_bounds[0],quality_guard_m:0}]},area),false);
 assert.equal(hasTargetedScenePriority({...target,verified_target_bounds:[{...target.verified_target_bounds[0],bbox_wgs84:[113,19,113,19]}]},area),false);
});
test('ordinary ranking retains cloud plus nodata score and newest-date tie break',()=>{
 const bounds=[0,0,1,1],a={cloud_cover:1,nodata_percent:10,datetime:'2025-03-01'},b={cloud_cover:4,nodata_percent:0,datetime:'2025-01-01'};
 assert.ok(compareCogScenes(a,b,bounds)>0);
 assert.ok(compareCogScenes({...a,cloud_cover:4,nodata_percent:0},b,bounds)<0);
});
