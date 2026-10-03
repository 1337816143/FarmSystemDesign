import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {METRIC_CONTRACTS,EVIDENCE_REFS,metricBasesCompatible} from '../src/metric-contracts.js';
import {CROPS,defaultConfig,METRICS} from '../src/data.js';
import {evaluate,dominates,rankResults} from '../src/model.js';

const byId=Object.fromEntries(METRIC_CONTRACTS.map(contract=>[contract.id,contract]));
const evidenceById=Object.fromEntries(EVIDENCE_REFS.map(ref=>[ref.id,ref]));
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
const fixture=()=>({
  farms:[{id:'A',name:'A',villageId:'V',poultry:10,water:[1e6,1e6,1e6],labour:[1e6,1e6,1e6]},
    {id:'B',name:'B',villageId:'V',poultry:10000,water:[1e6,1e6,1e6],labour:[1e6,1e6,1e6]}],
  plots:[{id:'P',farmId:'A',crop:'rice',areaHa:2,soilFactor:1,locked:false},
    {id:'Q',farmId:'B',crop:'rice',areaHa:20,soilFactor:1,locked:false}]
});
const config=()=>({...defaultConfig(),shock:0,price:1,rain:1,quarter:0});
const rainfall=amounts=>({records:amounts.map((precipitationMmMonth,i)=>({month:`2025-${String(i+1).padStart(2,'0')}`,precipitationMmMonth}))});
const run=(data=fixture(),climate=rainfall([0,0,0]),cfg=config())=>evaluate(data,['A'],{P:'rice',Q:'rice'},cfg,climate);

test('five current totals have complete bilingual, serializable, D/uncalibrated contracts',()=>{
  assert.deepEqual(METRIC_CONTRACTS.map(x=>x.id),METRICS.map(x=>x[0]));
  assert.deepEqual(JSON.parse(JSON.stringify(METRIC_CONTRACTS)),METRIC_CONTRACTS);
  assert.deepEqual(JSON.parse(JSON.stringify(EVIDENCE_REFS)),EVIDENCE_REFS);
  const translated=value=>assert.ok(typeof value.zh==='string'&&value.zh.length&&typeof value.en==='string'&&value.en.length);
  for(const contract of METRIC_CONTRACTS){
    assert.equal(contract.field,`totals.${contract.id}`);
    for(const field of ['label','unit','period','definition','boundary'])translated(contract[field]);
    [...contract.exclusions,...contract.missingHandling,contract.execution.summary,contract.science.summary,contract.ranking.summary].forEach(translated);
    assert.equal(contract.execution.status,'implemented');
    assert.equal(contract.science.grade,'D');
    assert.equal(contract.science.status,'implemented-simplified-screening');
    assert.equal(contract.science.calibration,'uncalibrated');
    assert.equal(contract.science.coefficientOrigin,'synthetic');
    assert.equal(contract.science.literatureParameterAdoption,false);
    assert.equal(contract.science.literatureFormulaAdoption,false);
    assert.equal(contract.basis.periodMonths,3);
    assert.equal(contract.basis.aggregation,'sum');
    assert.equal(contract.basis.spatial,'selected-actors');
    assert.equal(contract.basis.normalization,'none');
    assert.equal(contract.basis.coefficientTreatment,'applied-directly-to-window');
    assert.ok(contract.execution.codeRefs.some(ref=>ref.includes('src/model.js')));
    assert.ok(contract.evidenceRefs.every(id=>evidenceById[id]));
  }
});

test('margin is selected-window accounting in CNY, with synthetic labour charges and no annual division',()=>{
  const result=run(),actor=result.farms[0];
  close(result.totals.revenue,CROPS.rice.revenue*2+10*28);
  close(result.totals.cost,CROPS.rice.cost*2+10*16+actor.chemicalN*8+actor.water*.35+actor.labour*100+actor.transferCost);
  close(result.totals.margin,result.totals.revenue-result.totals.cost);
  assert.equal(result.farms.length,1);
  assert.equal(byId.margin.basis.unit,'CNY');
  assert.match(byId.margin.exclusions[0].en,/Not household net income/);
  assert.equal(byId.margin.ranking.direction,'max');
});

test('water is rainfall-adjusted supplemental demand; absent rainfall is explicit and capacity is separate',()=>{
  const missing=run(fixture(),null),dry=run(),wet=run(fixture(),rainfall([100,200,300]));
  close(dry.totals.water,CROPS.rice.water*2+10*.07);
  close(wet.totals.water,CROPS.rice.waterCurve.reduce((n,w,m)=>n+Math.max(0,CROPS.rice.water*w-[100,200,300][m]*10*.35)*2,0)+10*.07);
  close(missing.totals.water,dry.totals.water);
  assert.deepEqual(missing.rainMonths,[null,null,null]);
  assert.ok(missing.warnings.some(w=>w.includes('缺失')));
  close(run(fixture(),rainfall([0,0,0]),{...config(),water:.5}).totals.water,dry.totals.water);
  assert.equal(byId.water.basis.quantity,'supplemental-water-demand');
  assert.match(byId.water.exclusions[0].en,/Not groundwater depletion/);
  const pond=fixture();pond.plots[0].crop='pond';
  const pondResult=evaluate(pond,['A'],{P:'pond'},config(),rainfall([100,200,300]));
  close(pondResult.totals.water,CROPS.pond.waterCurve.reduce((n,w,m)=>n+Math.max(0,CROPS.pond.water*w-[100,200,300][m]*10*.15)*2,0)+10*.07);
});

test('labour reports workdays and monthly demand without inventing hours per day',()=>{
  const result=run();
  close(result.totals.labour,CROPS.rice.labour*2+10*.04);
  result.farms[0].labourMonths.forEach((value,m)=>close(value,CROPS.rice.labour*CROPS.rice.labourCurve[m]*2+10*.04/3));
  close(run(fixture(),rainfall([0,0,0]),{...config(),labour:.5}).totals.labour,result.totals.labour);
  assert.equal(byId.labour.basis.unit,'workday');
  assert.equal(byId.labour.basis.hoursPerWorkday,null);
  assert.match(byId.labour.exclusions[0].en,/Do not assume eight hours/);
  assert.match(byId.labour.ranking.summary.en,/no separate labour weight/);
});

test('nitrogen retains signed external balance; absolute value is only a comparison transform',()=>{
  const data=fixture();data.farms[0].poultry=0;data.plots[0].soilFactor=2;
  const result=run(data);
  close(result.totals.nSurplus,-30);
  close(result.totals.nSurplus,result.totals.nInput-result.totals.nOutput);
  assert.ok(result.warnings.some(w=>w.includes('氮收支为负')));
  assert.equal(byId.nSurplus.basis.valueTransform,'identity');
  assert.equal(byId.nSurplus.ranking.transform,'absolute-value');
  assert.match(byId.nSurplus.exclusions[0].en,/Not nitrogen loss/);
  const candidate=n=>({id:`candidate-${n===-10?1:2}`,totals:{margin:10,water:10,labour:10,energy:10,nSurplus:n}});
  assert.equal(dominates(candidate(-10),candidate(20)),true);
  const ranked=rankResults({candidates:[candidate(20),candidate(-10)],ranking:{range:{margin:[10,10],water:[10,10],nSurplus:[10,20],energy:[10,10]}}},'environment');
  assert.equal(ranked.candidates[0].totals.nSurplus,-10);
  const transferred=fixture();transferred.farms[0].poultry=10000;transferred.farms[1].poultry=0;
  const flow=evaluate(transferred,['A','B'],{P:'cover',Q:'rice'},{...config(),mode:'cooperative'},rainfall([0,0,0]));
  assert.ok(flow.transfers.length>0);
  close(flow.totals.nInput,flow.farms.reduce((n,f)=>n+f.externalNInput,0));
  close(flow.totals.nOutput,flow.farms.reduce((n,f)=>n+f.externalNOutput,0));
  close(flow.totals.nSurplus,flow.totals.nInput-flow.totals.nOutput);
});

test('energy is direct synthetic GJ proxy, with no food-security or annualization claim',()=>{
  const data=fixture();data.plots[0].soilFactor=1.3;
  const result=run(data);
  close(result.totals.energy,CROPS.rice.energy*2*1.3+10*.008);
  assert.equal(byId.energy.basis.unit,'GJ');
  assert.equal(byId.energy.basis.quantity,'edible-energy-production-proxy');
  assert.match(byId.energy.exclusions[0].en,/Not household food security/);
  const repeatedRain=rainfall(Array(12).fill(0));
  assert.deepEqual(run(data,repeatedRain,{...config(),quarter:3}).totals,run(data,repeatedRain).totals);
});

test('incompatible dimensions, normalization, semantics and workday duration are rejected without conversion',()=>{
  for(const contract of METRIC_CONTRACTS)assert.equal(metricBasesCompatible(contract.basis,structuredClone(contract.basis)),true);
  const reject=(original,change)=>assert.equal(metricBasesCompatible(original,{...original,...change}),false);
  reject(byId.margin.basis,{unit:'USD'});
  reject(byId.margin.basis,{normalization:'per-hectare',periodMonths:12,periodKind:'year'});
  reject(byId.water.basis,{unit:'mm',quantity:'groundwater-depletion'});
  reject(byId.water.basis,{spatial:'one-hectare'});
  reject(byId.labour.basis,{unit:'h',hoursPerWorkday:8});
  reject(byId.labour.basis,{hoursPerWorkday:8});
  reject(byId.nSurplus.basis,{quantity:'nitrogen-emissions'});
  reject(byId.nSurplus.basis,{valueTransform:'absolute-value'});
  reject(byId.energy.basis,{unit:'GCal',normalization:'per-hectare',periodMonths:12});
  reject(byId.energy.basis,{coefficientTreatment:'annual-divided-by-four'});
  assert.equal(metricBasesCompatible({},{}),false);
  assert.equal(metricBasesCompatible(null,byId.margin.basis),false);
  assert.equal(metricBasesCompatible({...byId.margin.basis,periodMonths:NaN},{...byId.margin.basis,periodMonths:NaN}),false);
  const missing={...byId.labour.basis};delete missing.hoursPerWorkday;
  assert.equal(metricBasesCompatible(missing,missing),false);
});

test('source identity, current definitions, executed code and literature background stay separate',()=>{
  assert.equal(new Set(EVIDENCE_REFS.map(x=>x.id)).size,EVIDENCE_REFS.length);
  assert.ok(EVIDENCE_REFS.every(ref=>/^https:\/\/(1337816143\.github\.io|github\.com)\//.test(ref.url)));
  const papers=EVIDENCE_REFS.filter(x=>x.kind==='background');
  assert.equal(papers.length,5);
  assert.equal(EVIDENCE_REFS.filter(x=>x.kind==='definition').length,1);
  assert.ok(EVIDENCE_REFS.some(x=>x.kind==='executed-code'));
  const sections={margin:'s2',energy:'s3',labour:'s4',water:'s5',nSurplus:'s6'};
  for(const ref of papers){
    const metric=ref.metricIds[0],section=sections[metric];
    assert.equal(ref.id,`paper-liang-indicator-audit-${section}`);
    assert.equal(ref.sourceId,'liang-indicator-audit');
    assert.equal(ref.originalSource.id,'liang-2022');
    assert.equal(ref.sourceIdentity.version,'5.5.2');
    assert.equal(ref.sourceIdentity.commit,'d949f4dce1d7d867e7fae41fabb6734e75cdb831');
    assert.equal(ref.sourceIdentity.gitBlob,'939dc6ba198a91e0abcbf976a509d64d9cb22ebb');
    assert.equal(ref.sourceIdentity.sha256,'a82e8b59fdaca3466cfdfdb95a8a3a75928f4d55b720cb8735c5f64d19dfb020');
    assert.equal(ref.originalSource.sha256,'bfbde3ef50d61598c5aa73a5ff6d02141f1d7473ae446b0f73f88e6bbef0ef47');
    assert.notEqual(ref.originalSource.sha256,ref.sourceIdentity.sha256);
    assert.equal(ref.relationship,'background-not-adopted');
    assert.equal(ref.url,`https://1337816143.github.io/Paper/#/liang-indicator-audit/${section}`);
    assert.equal(ref.fallbackUrl,`https://1337816143.github.io/Paper/read/liang-indicator-audit.html#${section}`);
    assert.equal(ref.verification.route,'source-checked-not-live-browser-checked');
    assert.ok(ref.locator.includes('p4-'));
  }
});

test('registry contributes no parameters or formulas to the optimizer and evidence edits cannot change accounting',()=>{
  EVIDENCE_REFS.forEach(ref=>assert.deepEqual(ref.adoption,{parameters:false,formulas:false,optimizerInputs:false}));
  const moduleSource=fs.readFileSync(new URL('../src/metric-contracts.js',import.meta.url),'utf8');
  assert.doesNotMatch(moduleSource,/^\s*import\s/m);
  for(const name of ['model.js','data.js']){
    const source=fs.readFileSync(new URL(`../src/${name}`,import.meta.url),'utf8');
    assert.doesNotMatch(source,/metric-contracts|METRIC_CONTRACTS|EVIDENCE_REFS/);
  }
  const before=run();
  const paper=EVIDENCE_REFS.find(ref=>ref.kind==='background'),oldTitle=paper.title.en;
  const contract=byId.energy,oldEquation=contract.execution.equations[0];
  try{
    paper.title.en='Changed explanatory evidence only';
    contract.execution.equations[0]='explanatory text is not an executable coefficient';
    assert.deepEqual(run(),before);
  }finally{
    paper.title.en=oldTitle;
    contract.execution.equations[0]=oldEquation;
  }
});
