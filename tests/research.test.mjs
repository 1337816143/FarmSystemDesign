import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {REGIONAL_EVIDENCE_VERSION,OFFICIAL_SNAPSHOT,NUTRIENT_BOUNDARY_STUDY,AUDIT,assessStages,auditCsvRows} from '../src/research.js';

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

test('Dong nutrient thresholds retain island-scale literature status',()=>{
  assert.equal(NUTRIENT_BOUNDARY_STUDY.geography,'海南岛整体');
  assert.equal(NUTRIENT_BOUNDARY_STUDY.evidence.find(x=>x.label.startsWith('磷：')).value,'25／44／70');
  const row=AUDIT.find(x=>x.id==='dong-nutrient-boundaries');
  assert.equal(row.status,'source-confirmed');
  assert.equal(row.track,'province');
  assert.ok(row.gap.includes('不能直接下推'));
  assert.ok(assessStages('province').every(x=>!x.ready));
  assert.ok(!auditCsvRows('farm').some(x=>x.includes('dong-nutrient-boundaries')));
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

test('main-island cover summary preserves its source, mask and area accounting',()=>{
  const summary=JSON.parse(fs.readFileSync(new URL('../data/hainan/landcover-main-island-summary.json',import.meta.url)));
  assert.equal(summary.product,'ESA WorldCover 2021 v200');
  assert.equal(summary.mask_overview_m,100);
  assert.equal(summary.source_urls.length,2);
  assert.ok(summary.source_urls.every(url=>url.startsWith('https://esa-worldcover.s3.eu-central-1.amazonaws.com/')));
  assert.ok(Object.values(summary.source_sha256).every(hash=>/^[0-9a-f]{64}$/.test(hash)));
  assert.ok(Math.abs(summary.classes.reduce((sum,row)=>sum+row.km2,0)-summary.total_classified_km2)<0.05);
  assert.ok(Math.abs(summary.classes.reduce((sum,row)=>sum+row.percent,0)-100)<0.05);
  assert.ok(Math.abs(summary.mask_area_100m_km2-summary.total_classified_km2)<0.05);
  assert.ok(summary.mask_sampling_difference_percent<0.2);
  assert.ok(summary.geography.includes('main island') && summary.not_for.includes('Official cultivated-land'));
  assert.equal(AUDIT.find(row=>row.id==='land-eligibility').status,'display-only');
});
