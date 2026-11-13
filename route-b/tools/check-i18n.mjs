import fs from 'node:fs';import assert from 'node:assert/strict';
import {TRANSLATIONS,translateHTML,translateText} from '../src/i18n.js';
import {EVIDENCE,COVERAGE} from '../src/research.js';
import {EVIDENCE_EN,COVERAGE_EN} from '../src/research.en.js';
import {defaultInput} from '../src/fixture.js';
const han=/[\u3400-\u9fff]/u;
const untranslated=[];
const inspect=(label,value)=>{const translated=translateText(value,'en');if(han.test(translated))untranslated.push({label,source:value,translated});};
const html=translateHTML(fs.readFileSync('index.html','utf8'),'en');
assert.ok(!han.test(html),'Static HTML English coverage has untranslated Chinese');
for(const row of EVIDENCE)for(const [key,value]of Object.entries(row))inspect(`${row.id}.${key}`,value);
inspect('coverage',COVERAGE.boundary);
const walk=(x,path='fixture')=>{if(typeof x==='string')inspect(path,x);else if(x&&typeof x==='object')for(const[k,v]of Object.entries(x))walk(v,`${path}.${k}`);};walk(defaultInput());
assert.deepEqual(EVIDENCE.map(r=>r.id),EVIDENCE_EN.map(r=>r.id));
for(let i=0;i<EVIDENCE.length;i++){
 const a=EVIDENCE[i],b=EVIDENCE_EN[i];assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort());
 for(const key of ['id','title','url'])assert.equal(a[key],b[key]);
 for(const key of Object.keys(a))assert.deepEqual(a[key].match(/\d+(?:\.\d+)?/g),b[key].match(/\d+(?:\.\d+)?/g),`${a.id}.${key}: numerical tokens`);
}
assert.deepEqual(COVERAGE.counts,COVERAGE_EN.counts);assert.equal(COVERAGE.date,COVERAGE_EN.date);
// Every Chinese lexical run in UI, fixture, engine and evidence must have an explicit
// dictionary or dynamic-template home. The runtime tests additionally exercise interpolation.
const translatorSource=JSON.stringify(Object.keys(TRANSLATIONS))+fs.readFileSync('src/i18n.js','utf8');
const sources=['src/dated-errors.js','src/dated-ui.js','src/app.js','src/recovery.js','src/engine.js','src/fixture.js','src/research.js'];
let lexicalRuns=0;
for(const file of sources){
 const source=fs.readFileSync(file,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
 for(const run of new Set(source.match(/[\u3400-\u9fff]+/gu)||[])){
  lexicalRuns++;if(!translatorSource.includes(run))untranslated.push({file,lexicalRun:run});
 }
}
const report={passed:untranslated.length===0,staticHTML:'complete English text/attribute coverage',researchRows:EVIDENCE.length,fixtureStrings:'all covered',lexicalRuns,untranslated,exclusions:'JSON data and imported custom labels remain source data; metadata identifiers, URLs, units and citations are preserved. This is a static/Node check, not a browser attestation.'};
fs.writeFileSync('evidence/i18n-coverage.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));assert.equal(untranslated.length,0);
