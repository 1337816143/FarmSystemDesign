import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeDemo,defaultConfig} from '../src/data.js';
import {search,evaluate} from '../src/model.js';
import {infeasibleDetails} from '../src/results.js';
import {esc} from '../src/utils.js';

const data=makeDemo(),climate=JSON.parse(fs.readFileSync(new URL('../data/public/climate.json',import.meta.url)));
const config={...defaultConfig(),water:0,labour:0,samples:100};
const result=search(data,data.farms.map(f=>f.id),config,climate);

test('no-feasible UI exposes all 78 reasons instead of silently dropping 70',()=>{
  assert.equal(result.evaluated,435);assert.equal(result.feasibleCount,0);
  assert.equal(result.bestInfeasible.violations.length,78);
  const html=infeasibleDetails(result);
  assert.equal((html.match(/<li>/g)||[]).length,78);
  assert.equal((html.match(/<tr>/g)||[]).length,79);
  for(const reason of result.bestInfeasible.violations)assert.ok(html.includes(esc(reason)));
  assert.match(html,/candidate-1/);assert.match(html,/违反项数少不等于资源缺口最小/);
  assert.match(html,/只解释该候选/);assert.match(html,/不是整个问题无解的证明/);
  assert.match(html,/合成、未校准/);assert.match(html,/未选主体/);
});

test('presentation preserves complete accounting, search and snapshot inputs',()=>{
  const before=JSON.stringify(result);
  for(const lang of ['zh','en','both'])infeasibleDetails(result,lang);
  assert.equal(JSON.stringify(result),before);
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.match(app,/infeasibleDetails\(r,language\)/);
  assert.doesNotMatch(app,/bestInfeasible\?\.violations\?\.slice/);
});

test('table uses actual monthly balances, resource units and nonzero small deficits',()=>{
  const copy=structuredClone(result);
  copy.bestInfeasible.balances=[
    {group:'A',month:4,resource:'水',demand:5,capacity:10},
    {group:'B',month:5,resource:'劳动',demand:4.25,capacity:3},
    {group:'C',month:6,resource:'水',demand:0.000002,capacity:0},
    {group:'D',month:6,resource:'水',demand:0.0000005,capacity:0},
  ];
  const html=infeasibleDetails(copy,'en');
  assert.equal((html.match(/<tr>/g)||[]).length,3);
  assert.match(html,/<td>B<\/td><td>5<\/td><td>Labour \/ workdays<\/td><td>4.25<\/td><td>3<\/td><td>1.25<\/td>/);
  assert.match(html,/<td>C<\/td><td>6<\/td><td>Water \/ m³<\/td><td>0.000002<\/td><td>0<\/td><td>0.000002<\/td>/);
  assert.doesNotMatch(html,/<td>A<\/td>|<td>D<\/td>/);
});

test('Chinese, English and bilingual explanations retain scope and uncalibrated status',()=>{
  const en=infeasibleDetails(result,'en'),both=infeasibleDetails(result,'both');
  assert.doesNotMatch(en,/[\u3400-\u9fff]/);
  assert.match(en,/fewest failed constraints/);assert.match(en,/synthetic, uncalibrated/);
  assert.match(en,/F01 · month 1: water capacity exceeded/);
  assert.match(both,/合成、未校准/);assert.match(both,/synthetic, uncalibrated/);
  for(const [mode,label]of [['independent','Each selected farm separately'],['cooperative','Only selected members of the same group'],['centralized','All selected farms pooled']]){
    assert.ok(infeasibleDetails({...result,config:{...config,mode}},'en').includes(label));
  }
});

test('income-floor and fixed-activity violations remain available with no resource shortfall',()=>{
  const sample=structuredClone(data),plot=sample.plots.find(p=>p.farmId==='F01');plot.locked=true;
  const allocation=Object.fromEntries(sample.plots.map(p=>[p.id,p.crop]));allocation[plot.id]=plot.crop==='cover'?'rice':'cover';
  const cfg={...defaultConfig(),water:2,labour:2,minIncomeRatio:1};
  const candidate=evaluate(sample,['F01'],allocation,cfg,climate,[{id:'F01',margin:1e9}]);
  candidate.id='candidate-test';assert.ok(candidate.violations.some(v=>v.includes('固定活动')));
  assert.ok(candidate.violations.some(v=>v.includes('参与收益底线')));
  const html=infeasibleDetails({...result,config:cfg,bestInfeasible:candidate});
  for(const reason of candidate.violations)assert.ok(html.includes(esc(reason)));
  assert.doesNotMatch(html,/class="infeasible-balances"/);
});

test('untrusted identifiers/reasons are escaped and absent diagnostics remain honest',()=>{
  const copy=structuredClone(result);copy.bestInfeasible.id='<img src=x onerror=alert(1)>';
  copy.bestInfeasible.violations=['<script>alert(1)</script>'];
  copy.bestInfeasible.balances[0].group='<svg onload=alert(1)>';
  const html=infeasibleDetails(copy);
  assert.doesNotMatch(html,/<img|<script|<svg/);assert.match(html,/&lt;script&gt;/);
  assert.match(infeasibleDetails({...result,bestInfeasible:null},'en'),/No candidate-level diagnostic was retained/);
});
