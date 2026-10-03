import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {landcoverTileUrl,LANDCOVER_YEAR} from '../src/landcover-layer.js';
test('pinned annual classification and crop isolation use categorical nearest neighbour',()=>{
 const u=new URL(landcoverTileUrl([1,2,3,4],true));
 assert.equal(LANDCOVER_YEAR,2025);
 assert.equal(JSON.parse(u.searchParams.get('mosaicRule')).where,'Year = 2025');
 assert.equal(JSON.parse(u.searchParams.get('renderingRule')).rasterFunction,'Isolate Crops for Visualization and Analysis');
 assert.equal(u.searchParams.get('interpolation'),'RSP_NearestNeighbor');
 assert.equal(u.searchParams.get('size'),'256,256');
 assert.equal(u.searchParams.get('bbox'),'1,2,3,4');
});
test('full classification is distinct from isolated Crops and preserves cloud class visualization',()=>{
 const u=new URL(landcoverTileUrl([0,0,10,10]));
 assert.equal(JSON.parse(u.searchParams.get('renderingRule')).rasterFunction,'Cartographic Renderer for Visualization and Analysis');
});
test('source hashes and class sample totals agree with verified crop isolation',()=>{
 const root=new URL('../data/hainan/landcover-2025/',import.meta.url);
 const report=JSON.parse(fs.readFileSync(new URL('verification.json',root)));
 for(const [name,hash] of Object.entries(report.hashes))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(name,root))).digest('hex'),hash,name);
 assert.equal(Object.values(report.classSample.counts).reduce((sum,n)=>sum+n,0),report.classSample.total);
 const mask=JSON.parse(fs.readFileSync(new URL('crop-class-consistency.json',root)));
 assert.equal(mask.rawClassPixels,report.classSample.counts['5']);
 assert.equal(mask.renderedNontransparentPixels,mask.rawClassPixels);
 assert.equal(mask.passed,true);
});
