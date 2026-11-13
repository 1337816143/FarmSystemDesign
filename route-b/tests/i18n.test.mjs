import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {translateText,translateHTML,languageFromSearch,errorSource} from '../src/i18n.js';
import {EVIDENCE,COVERAGE} from '../src/research.js';import {EVIDENCE_EN,COVERAGE_EN} from '../src/research.en.js';
import {defaultInput} from '../src/fixture.js';import {run,validateInput,compositions} from '../src/engine.js';
const sha=path=>crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const han=/[\u3400-\u9fff]/u;
test('Frozen B0.1.3 engine/fixture/NP/research bytes are unchanged',()=>{
 const baseline=JSON.parse(fs.readFileSync(new URL('./fixtures/frozen-base.json',import.meta.url),'utf8'));
 for(const file of ['engine.js','fixture.js','np-interface.js','research.js'])assert.equal(sha(new URL(`../src/${file}`,import.meta.url)),baseline.sourceHashes[`src/${file}`]);
 assert.equal(sha(new URL('../src/engine.js',import.meta.url)),'a23a7363e759dad4c97ad639f205685bb5c75942b93b5929efb10bde4837e8b0');
});
test('Language is explicit URL or memory state, with safe Chinese fallback',()=>{
 for(const lang of ['zh','en','both'])assert.equal(languageFromSearch(`?lang=${lang}`),lang);
 for(const search of ['', '?lang=EN','?lang=<script>','?language=en'])assert.equal(languageFromSearch(search),'zh');
});
test('English static HTML contains no untranslated Chinese and keeps IDs/URLs/form values',()=>{
 const raw=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),en=translateHTML(raw,'en');assert.ok(!han.test(en));
 for(const attr of ['id','href','src','value','min','max','step'])assert.deepEqual(en.match(new RegExp(`\\b${attr}="[^"]*"`,'g')),raw.match(new RegExp(`\\b${attr}="[^"]*"`,'g')));
 assert.match(en,/Not empirically calibrated/);assert.match(en,/No Hainan-wide prediction/);assert.match(en,/no calculated strategy benefits yet/);
});
test('Research translations retain IDs, DOI links, exact titles and every numerical token',()=>{
 assert.equal(EVIDENCE_EN.length,15);
 EVIDENCE.forEach((row,i)=>{const en=EVIDENCE_EN[i];for(const key of ['id','title','url'])assert.equal(en[key],row[key]);for(const key of Object.keys(row)){assert.ok(!han.test(en[key]));assert.deepEqual(en[key].match(/\d+(?:\.\d+)?/g),row[key].match(/\d+(?:\.\d+)?/g),`${row.id}.${key}`);assert.equal(translateText(row[key],'en'),en[key]);}});
 assert.deepEqual(COVERAGE_EN.counts,COVERAGE.counts);
});
test('Bilingual mode includes complete Chinese and complete English scientific boundary',()=>{
 const source='无海南经营记录、地理绑定、覆盖权重和独立验证；即使数值放大也不能省域推断';const both=translateText(source,'both');assert.ok(both.includes(source));assert.ok(both.includes(translateText(source,'en')));assert.match(both,/cannot justify provincial inference/);
});
test('Dynamic annual/period comparison is a diagnostic, not adaptation benefits',()=>{
 assert.equal(translateText('年度总量通过 8 个；逐期通过 5 个','en'),'Annual totals: 8 pass; period-specific: 5 pass');
 assert.match(translateText('其中 3 个组合被年度平均误判为可行。此为约束分辨率诊断，不是自适应策略效果。','en'),/3 combinations.*not the effect of an adaptive strategy/);
});
test('NP translated example preserves the independent material-split limitation and numbers',()=>{
 const source='合成手算基准：N40/P20，接收可用N40/P10，最大份额 min(1, 1, 0.5)=0.5，接收N20/P10，保留N20/P10。N可利用比例当前为1。';const en=translateText(source,'en');assert.ok(!han.test(en));assert.match(en,/receiving available-N capacity 40 \/ P capacity 10/);assert.match(en,/min\(1, 1, 0.5\)=0.5/);
 assert.match(translateText('可利用 N 为 20 kg；总 N/P 成分比在两份中保持。剩余物料仍在来源端，未默认为无害处置或污染消失。','en'),/Remaining material stays at the source/);
});
test('Negative gross margin and violations retain signs, units and directions',()=>{
 const source='个体劳动 · 模拟期1：120 h，上限 80，超出 40 h';assert.equal(translateText(source,'en'),'Individual labor · Synthetic period 1: 120 h, cap 80, excess 40 h');
 assert.match(translateHTML('<td>¥-200</td><td>粮食产出底线：0 kg，最低 1，缺口 1 kg</td>','en'),/¥-200.*Grain output floor: 0 kg, minimum 1, shortfall 1 kg/);
});
test('Every reachable input-contract error class has meaningful English',()=>{
 const changes=[x=>x.schema='wrong',x=>x.evidence='observed',x=>x.representativeness.status='present',x=>x.accounting.nutrients='P2O5',x=>x.social.status='accepted',x=>x.datasetVersion='',x=>x.periods=[],x=>delete x.periods[0],x=>x.periods=['same','same'],x=>x.waterSources[0].origin='real',x=>x.strata[0].origin='real',x=>x.strata[0].count=0,x=>x.strata[0].areaHa=0,x=>x.strata[0].waterSourceId='missing',x=>x.strata[0].laborCapacity=[1],x=>x.strata[0].menus[0].origin='real',x=>x.strata[0].menus[0].grossMarginCny=null,x=>x.strata[0].menus[0].areaHa=0,x=>x.strata[0].menus[0].waterM3[0]=null,x=>x.objectives.reverse()];
 for(const change of changes){const x=defaultInput();change(x);let error;try{validateInput(x)}catch(e){error=e}assert.ok(error);const en=translateText(error.message,'en');assert.ok(!han.test(en),en);assert.match(en,/B input contract: /);}
 for(const action of [()=>compositions(-1,2),()=>compositions(1,9),()=>compositions(8,8),()=>run(defaultInput(),null),()=>run(defaultInput(),{annual:2}),()=>run(defaultInput(),{maxCombinations:NaN}),()=>run(defaultInput(),{maxCombinations:1})])assert.throws(action,e=>!han.test(translateText(e.message,'en')));
});
test('NP English errors also have a Chinese and bilingual rendering',()=>{
 const error='Manure N/P contract: availableNFraction must be in (0,1]';assert.match(translateText(error,'zh'),/必须在 \(0,1\] 内/);assert.equal(translateText(error,'en'),error);assert.match(translateText(error,'both'),/必须在.*Manure N\/P contract/);
});
test('JSON and unknown I/O errors have localized context while retaining diagnostic details',()=>{
 const source=errorSource(new SyntaxError('Unexpected token'));assert.match(translateText(source,'en'),/^JSON parsing failed: Unexpected token/);assert.match(translateText(source,'both'),/JSON解析失败/);
 assert.match(translateText(errorSource(new Error('read failed')),'en'),/^Operation could not be completed: read failed/);
});
test('Imported markup stays escaped in localized HTML and user data stays source text',()=>{
 const source='<label>&lt;img src=x onerror=alert(1)&gt;<input value="123" data-input="x"></label>';assert.equal(translateHTML(source,'en'),source);assert.equal(translateText('自定义标签甲','en'),'自定义标签甲');
});
test('Translation never modifies numerical model inputs, results or inference gate',()=>{
 const input=defaultInput(),before=JSON.stringify(input),result=run(input);for(const mode of ['zh','en','both'])translateText(JSON.stringify(result),mode);assert.equal(JSON.stringify(input),before);assert.deepEqual(run(input),result);assert.equal(result.search.feasible,5);assert.equal(result.inferenceGate.allowed,false);
});
test('Language layer has no storage, network, history mutations or A imports',()=>{
 const source=fs.readFileSync(new URL('../src/i18n.js',import.meta.url),'utf8');assert.doesNotMatch(source,/localStorage|sessionStorage|indexedDB|fetch\s*\(|XMLHttpRequest|pushState|replaceState|from\s+['"]\.\.\//);
});
