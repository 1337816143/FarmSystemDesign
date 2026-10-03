import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {regionalConfig,inspectRegional} from '../src/regional-atlas-layers.js';
const base=new URL('../data/hainan/regional/climate/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('climate-manifest.json',base)));
test('monthly climate contains twelve separate periods per variable with exact decoded asset identities',()=>{
 for(const [name,variable] of Object.entries(manifest.variables)){
  assert.equal(variable.records.length,60);assert.equal(new Set(variable.records.map(r=>r.period+'|'+r.group)).size,60);
  for(let month=1;month<=12;month++)assert.equal(variable.records.filter(r=>r.period===`2025-${String(month).padStart(2,'0')}`).length,5);
  for(const r of variable.records){assert.equal(r.decode.scale,name==='precipitation'?.1:.01);assert.equal(r.decode.offset,name==='precipitation'?0:-100);assert.equal(r.decode.units,name==='precipitation'?'mm/month':'°C');
   for(const [kind,path] of [['preview',r.preview],['values',r.values]]){const b=fs.readFileSync(new URL(path,base));assert.equal(b.readUInt32BE(16),r.width);assert.equal(b.readUInt32BE(20),r.height);assert.equal(createHash('sha256').update(b).digest('hex'),r.sha256[kind]);}
  }
 }
 assert.deepEqual(manifest.variables.temperature.native_resolution_degrees,[.625,.5]);
});
test('runtime never mosaics different climate months into one map',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>({ok:true,json:async()=>manifest});
 try{for(const kind of ['monthlyRain','temperature'])for(const period of ['2025-01','2025-07','2025-12']){const config=await regionalConfig(kind,period);assert.equal(config.records.length,5);assert.ok(config.records.every(r=>r.period===period));assert.equal(config.period,period);}await assert.rejects(regionalConfig('temperature','2026-01'),/Unsupported/);}
 finally{globalThis.fetch=original;}
});
