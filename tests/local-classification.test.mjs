import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {classificationColor,classificationRecords,drawClassification} from '../src/local-classification.js';
import {tileBounds} from '../src/regional-raster.js';
import {viewScaleText,classifiedTileText} from '../src/atlas-status.js';

test('classification preserves distinct crop filtering, cloud and source no-data meanings',()=>{
 assert.equal(classificationColor(5,true)[3],255);assert.equal(classificationColor(2,true)[3],0);
 assert.deepEqual(classificationColor(10),[255,255,255,255]);assert.equal(classificationColor(0)[3],0);
 assert.match(classifiedTileText([{status:'partial-read',filled:2}],true,true),/requests failed/);
});
test('all delivered classification images retain exact hashes and one explicit zoom band',()=>{
 const base=new URL('../data/hainan/regional/landcover-local/',import.meta.url),m=JSON.parse(fs.readFileSync(new URL('landcover-local-manifest.json',base)));
 assert.equal(m.records.length,1064);let images=0;
 for(const r of m.records){assert.equal(r.crs,'EPSG:4326');assert.ok([[0,9],[10,11],[12,18]].some(([a,b])=>r.min_zoom===a&&r.max_zoom===b));
  assert.ok(Math.abs((r.bounds_wsen[2]-r.bounds_wsen[0])/r.width-r.pixel_size_degrees[0])<1e-11);
  if(!r.preview){assert.equal(r.status,'source-nodata');continue;}const b=fs.readFileSync(new URL(r.preview,base));assert.equal(b.readUInt32BE(16),r.width);assert.equal(b.readUInt32BE(20),r.height);assert.equal(createHash('sha256').update(b).digest('hex'),r.sha256);images++;
 }assert.equal(images,601);
 const coords={x:825,y:453,z:10};assert.ok(classificationRecords(m,coords).every(r=>r.min_zoom===10));
});
test('partial classification survives failed chunks and retry without silently accepting wrong dimensions',async()=>{
 const original={Image:globalThis.Image,document:globalThis.document};let failGood=false;
 globalThis.Image=class{set src(url){this.url=url;this.naturalWidth=url.includes('wrong')?2:1;this.naturalHeight=1;queueMicrotask(()=>url.includes('bad')||(url.includes('retry')&&failGood)?this.onerror?.():this.onload?.());}removeAttribute(){}};
 globalThis.document={createElement:()=>{let source;return {getContext:()=>({drawImage:im=>{source=im;},getImageData:()=>({data:new Uint8ClampedArray(source.naturalWidth*4).fill(5)})})};}};
 try{
  const coords={x:3303,y:1815,z:12},bounds=tileBounds(coords),r=file=>({bounds_wsen:bounds,width:1,height:1,preview:file});
  const result=await drawClassification(coords,[r('bad-classes.png'),r('good-classes.png')],true,new AbortController().signal);
  assert.equal(result.status,'partial-read');assert.equal(result.filled,65536);
  failGood=true;const retry=await drawClassification(coords,[r('retry-classes.png')],true,new AbortController().signal,result.rgba);
  assert.equal(retry.status,'partial-read');assert.equal(retry.filled,65536);assert.deepEqual(retry.rgba,result.rgba);
  const wrong=await drawClassification(coords,[r('wrong-classes.png')],false,new AbortController().signal);
  assert.equal(wrong.status,'read-error');assert.equal(wrong.sourceNoData,0);
 }finally{Object.assign(globalThis,original);}
});
test('actual local grid resolution remains visible at a native source zoom',()=>{
 const record={bounds_wsen:[108,18,112,21],width:100,height:100,pixel_size_m:[30,30],min_zoom:11,max_zoom:18,local_native:true};
 assert.match(viewScaleText({records:[record]},{lng:110,lat:19},14,'dsm',true),/current local grid about 30 m × 30 m/);
});
