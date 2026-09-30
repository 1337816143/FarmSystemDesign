import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {REGIONAL_EVIDENCE_VERSION,OFFICIAL_SNAPSHOT,AUDIT,assessStages,auditCsvRows} from '../src/research.js';

test('the provincial snapshot retains its source, year, units and province-only scale',()=>{
  assert.equal(OFFICIAL_SNAPSHOT.year,2025);
  assert.equal(OFFICIAL_SNAPSHOT.geography,'海南省总体');
  assert.ok(OFFICIAL_SNAPSHOT.url.startsWith('https://stats.hainan.gov.cn/'));
  assert.deepEqual(OFFICIAL_SNAPSHOT.values.map(x=>[x.label,x.value,x.unit]),[
    ['粮食播种面积',412.37,'万亩'],['粮食总产量',142.74,'万吨'],
    ['蔬菜产量',662.22,'万吨'],['水果总产量',656.54,'万吨']
  ]);
});

test('confirmed sources cannot open a regional analysis or optimization gate',()=>{
  const stages=assessStages('province');
  assert.ok(stages.every(stage=>!stage.ready));
  assert.ok(stages[0].missing.includes('county-series'));
  const withCountySource=AUDIT.map(row=>row.id==='county-series'?{...row,status:'integrated-verified'}:row);
  assert.equal(assessStages('province',withCountySource)[0].ready,false);
  const withUnits=withCountySource.map(row=>row.id==='admin-units'?{...row,status:'integrated-verified'}:row);
  assert.equal(assessStages('province',withUnits)[0].ready,true);
  assert.equal(assessStages('province',withUnits)[1].ready,false);
  const validationOnly=AUDIT.map(row=>row.id==='farm-validation'?{...row,status:'integrated-verified'}:row);
  assert.equal(assessStages('farm',validationOnly)[1].ready,false);
});

test('regional evidence remains outside the farm model and export is route-specific',()=>{
  const farmModule=fs.readFileSync(new URL('../src/model.js',import.meta.url),'utf8');
  assert.ok(!farmModule.includes('research.js'));
  assert.ok(assessStages('farm').every(stage=>!stage.ready));
  assert.ok(auditCsvRows('farm').slice(1).every(row=>row[0]==='farm'));
  assert.ok(auditCsvRows('province').slice(1).every(row=>row[0]==='province'));
  const version=JSON.parse(fs.readFileSync(new URL('../version.json',import.meta.url)));
  assert.equal(version.regionalEvidenceVersion,REGIONAL_EVIDENCE_VERSION);
  assert.equal(version.modelVersion,'screening-0.2.0');
});
