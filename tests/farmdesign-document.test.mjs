import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateDocument,parseDocument,describeFarm,canonical} from '../src/farmdesign/document.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../data/farmdesign/author-cases-2019.json',import.meta.url)));
const doc=()=>structuredClone(catalog.cases[0]);
test('both attributed author examples retain native references and full farm/household tables',()=>{
 for(const d of catalog.cases){const before=canonical(d);assert.deepEqual(validateDocument(d),[]);const parsed=parseDocument(JSON.stringify(d));assert.equal(canonical(parsed),before);assert.equal(parsed.tables.DRI.length,22);assert.equal(parsed.tables.DRF.length,19);assert.equal(parsed.provenance.kind,'author-example');}
 assert.ok(Math.abs(describeFarm(catalog.cases[0]).area-1.165)<1e-12);
 assert.ok(Math.abs(describeFarm(catalog.cases[1]).area-.636)<1e-12);
});
test('invalid mass percentages, duplicate IDs and broken activity references cannot enter the native model',()=>{
 const d=doc();d.tables.PRD[0].PContent=101;assert.ok(validateDocument(d).some(x=>x.includes('PContent')));
 const duplicate=doc();duplicate.tables.RCR.push(structuredClone(duplicate.tables.RCR[0]));assert.ok(validateDocument(duplicate).some(x=>x.includes('duplicate')));
 const broken=doc();broken.tables.CFR.push({CfrID:999,CrpID:-4,FrtID:-5,Amount:1});assert.ok(validateDocument(broken).some(x=>x.includes('references missing')));
});
test('numeric strings, nonfinite values, mismatched farm IDs and unsupported tables are rejected',()=>{
 for(const mutate of [d=>d.tables.RCR[0].Area='1',d=>d.tables.RCR[0].Area=NaN,d=>d.tables.ECN[0].FrmID=-1,d=>d.tables.EXEC=[{command:'x'}]]){const d=doc();mutate(d);assert.ok(validateDocument(d).length);}
});
test('canonical snapshots preserve custom data and include explanatory differences in their digest inputs',()=>{
 const a=doc(),b=doc();b.provenance.notice='Edited local input, not field verified';assert.notEqual(canonical(a),canonical(b));
 a.tables.FRM[0].Name='<img src=x onerror=alert(1)>';assert.equal(parseDocument(JSON.stringify(a)).tables.FRM[0].Name,a.tables.FRM[0].Name);
});
test('native mapping uses each entity primary key rather than a foreign-key collision',()=>{
 assert.equal(catalog.fieldMap.HMR.entityType,'HouseholdMember');assert.equal(catalog.fieldMap.FRM.entityType,'MixedFarm');
 assert.equal(catalog.fieldMap.ANM.properties.AnmNumber,'Number');assert.equal(catalog.fieldMap.PRD.properties.VEM,'FeedEnergy');
 assert.equal(catalog.fieldMap.ENV.properties.SoilPh,'SoilpH');
});
