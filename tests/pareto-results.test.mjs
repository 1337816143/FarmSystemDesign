import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeDemo,defaultConfig,baselineAllocation,ANNUALS,hash} from '../src/data.js';
import {evaluate,search,rankResults} from '../src/model.js';
import {candidatePage,selectedPage,searchIsStale,CANDIDATES_PER_PAGE} from '../src/results.js';
import {paretoChart} from '../src/charts.js';

const data=makeDemo(),config=defaultConfig(),ids=['F01'];
const climate=JSON.parse(fs.readFileSync(new URL('../data/public/climate.json',import.meta.url)));
const result=search(data,ids,config,climate);
const allocations=()=>result.candidates.map(c=>c.id).sort();

test('complete small search equals an independently enumerated five-objective frontier',()=>{
  const plots=data.plots.filter(p=>ids.includes(p.farmId)),base=baselineAllocation(plots);
  assert.equal(plots.length,4);
  const feasible=[];
  for(const a of ANNUALS)for(const b of ANNUALS)for(const c of ANNUALS)for(const d of ANNUALS){
    const allocation=Object.fromEntries(plots.map((p,i)=>[p.id,[a,b,c,d][i]]));
    const candidate=evaluate(data,ids,allocation,config,climate);
    if(candidate.feasible)feasible.push(candidate);
  }
  const vector=c=>[c.totals.margin,-c.totals.water,-Math.abs(c.totals.nSurplus),c.totals.energy,-c.totals.labour];
  const oracle=feasible.filter(a=>!feasible.some(b=>{
    const av=vector(a),bv=vector(b);
    return bv.every((v,i)=>v>=av[i]-1e-6)&&bv.some((v,i)=>v>av[i]+1e-6);
  }));
  const key=c=>plots.map(p=>c.allocation[p.id]).join('|');
  assert.equal(result.evaluated,256);assert.equal(feasible.length,199);assert.equal(oracle.length,191);
  assert.equal(result.frontierCount,oracle.length);
  assert.deepEqual(result.candidates.map(key).sort(),oracle.map(key).sort());
  for(const key of ['margin','water','nSurplus','energy']){
    const values=feasible.map(c=>key==='nSurplus'?Math.abs(c.totals[key]):c.totals[key]);
    assert.deepEqual(result.ranking.range[key],[Math.min(...values),Math.max(...values)]);
  }
  assert.deepEqual(result.baseline.allocation,base);
});

test('preference changes preserve all IDs, accounting, normalization and original provenance',()=>{
  const original=JSON.stringify(result),expectedIds=allocations();
  let ranked=result;
  for(const objective of ['water','income','environment','food','balanced']){
    ranked=rankResults(ranked,objective);
    assert.deepEqual(ranked.candidates.map(c=>c.id).sort(),expectedIds);
    assert.equal(ranked.candidates.length,ranked.frontierCount);
    assert.equal(ranked.inputHash,result.inputHash);assert.strictEqual(ranked.config,result.config);
    assert.strictEqual(ranked.ranking.range,result.ranking.range);
    for(const c of ranked.candidates){
      const before=result.candidates.find(b=>b.id===c.id);
      assert.strictEqual(c.totals,before.totals);assert.strictEqual(c.allocation,before.allocation);
      assert.equal(c.fingerprint,before.fingerprint);
    }
    assert.ok(ranked.candidates.every((c,i,a)=>!i||a[i-1].score>=c.score));
    const metric={income:['margin',false],water:['water',true],environment:['nSurplus',true],food:['energy',false]}[objective];
    if(metric){
      const [key,lower]=metric,values=result.candidates.map(c=>key==='nSurplus'?Math.abs(c.totals[key]):c.totals[key]);
      const actual=key==='nSurplus'?Math.abs(ranked.candidates[0].totals[key]):ranked.candidates[0].totals[key];
      assert.equal(actual,lower?Math.min(...values):Math.max(...values));
      const [lo,hi]=result.ranking.range[key];
      for(const c of ranked.candidates){
        const value=key==='nSurplus'?Math.abs(c.totals[key]):c.totals[key],normalized=hi-lo>1e-6?(value-lo)/(hi-lo):.5;
        assert.equal(c.score,lower?1-normalized:normalized);
      }
    }
  }
  assert.deepEqual(ranked.candidates.map(c=>[c.id,c.score]),result.candidates.map(c=>[c.id,c.score]));
  assert.equal(JSON.stringify(result),original);
});

test('pagination visits every ID once, clamps invalid pages, and bounds SVG elements',()=>{
  const first=candidatePage(result.candidates),pages=Array.from({length:first.pageCount},(_,i)=>candidatePage(result.candidates,i));
  assert.equal(first.candidates.length,36);assert.equal(pages.at(-1).candidates.length,11);
  assert.deepEqual(pages.flatMap(p=>p.candidates.map(c=>c.id)),result.candidates.map(c=>c.id));
  for(const p of pages){
    const selected=p.candidates.at(-1);
    assert.equal(selectedPage(result.candidates,selected.id),p.page);
    const svg=paretoChart(result,selected.id,p.candidates);
    assert.equal((svg.match(/<circle data-candidate=/g)||[]).length,p.candidates.length);
    assert.ok(p.candidates.length<=CANDIDATES_PER_PAGE);
    assert.ok(svg.includes(`data-candidate="${selected.id}"`));
  }
  assert.equal(candidatePage(result.candidates,-9).page,0);
  assert.equal(candidatePage(result.candidates,Infinity).page,0);
  assert.equal(candidatePage(result.candidates,999).page,first.pageCount-1);
  assert.deepEqual(candidatePage([],8),{page:0,pageCount:1,offset:0,total:0,candidates:[]});
});

test('presentation preferences are not stale, but real input changes remain stale after reranking',()=>{
  assert.equal(searchIsStale(result,data,ids,{...config,objective:'water'},climate),false);
  const ranked=rankResults(result,'water');
  assert.equal(searchIsStale(ranked,data,ids,{...config,objective:'food',water:.9},climate),true);
  assert.equal(searchIsStale(ranked,data,['F02'],config,climate),true);
  assert.equal(searchIsStale(ranked,{...data,version:'changed'},ids,config,climate),true);
  assert.equal(searchIsStale(ranked,data,ids,config,null),true);
  assert.equal(result.inputHash,hash({data,farmIds:ids,config,climate}));
});

test('JSON retains every candidate and a late-page selection with original accounting fields',()=>{
  const exported=JSON.parse(JSON.stringify(rankResults(result,'food')));
  assert.equal(exported.candidates.length,191);
  assert.equal(exported.candidates.length,exported.frontierCount);
  assert.deepEqual(exported.candidates.map(c=>c.id).sort(),allocations());
  const last=candidatePage(exported.candidates,5).candidates.at(-1);
  assert.deepEqual(last.totals,result.candidates.find(c=>c.id===last.id).totals);
  assert.equal(exported.ranking.objective,'food');assert.equal(exported.config.objective,'balanced');
  const empty=search(data,ids,{...config,water:0,labour:0},climate);
  assert.deepEqual(rankResults(empty,'water').candidates,[]);
  assert.deepEqual(JSON.parse(JSON.stringify(empty)).ranking.range,empty.ranking.range);
});

test('release cache includes the pagination module and old cache is replaced',()=>{
  const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  assert.match(sw,/farmsystem-v0\.3\.13-/);assert.match(sw,/'\.\/src\/results\.js'/);
  assert.match(sw,/k!==CACHE/);
});
