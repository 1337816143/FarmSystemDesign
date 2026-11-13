import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FIELD_ZH,OUTPUT_ZH,fieldPair,pair,pathLabel,metricLabel,unitLabel,rememberPair,messageLabel} from '../src/farmdesign/i18n.js';
import {originalDictionary,originalMessage,originalText} from '../src/farmdesign/original-language.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../data/farmdesign/author-cases-2019.json',import.meta.url)));
const labels=JSON.parse(fs.readFileSync(new URL('../data/farmdesign/native-labels.json',import.meta.url)));
const han=/[\u3400-\u9fff]/u;
test('every native input column has distinct Chinese and English interface labels',()=>{
 const found=new Set();
 for(const [table,columns]of Object.entries(catalog.columns))for(const column of columns){
  const key=column.name;found.add(key);assert.ok(FIELD_ZH[key],table+'.'+key);
  const [zh,en]=fieldPair(table,key,catalog);assert.match(zh,han,key);assert.doesNotMatch(en,han,key);assert.notEqual(zh,en,key);
 }
 assert.equal(found.size,235);
});
test('all original output-label properties have Chinese labels including nested periods',()=>{
 for(const row of labels.output)for(const part of row.VarName.split('.'))assert.ok(OUTPUT_ZH[part],row.VarName);
});
test('native property paths and metrics localize without changing identifiers or data names',()=>{
 assert.equal(pathLabel('Budget.FreeBudget','zh'),'经营与家庭预算 · 可支配预算');
 assert.match(pathLabel('Budget.FreeBudget','en'),/Disposable budget/);
 assert.match(pathLabel('Budget.FreeBudget','both'),/经营与家庭预算.*Disposable budget/);
 const metric={key:'MixedFarm:User farm 100079:WaterBalance'};const original=structuredClone(metric);
 assert.match(metricLabel(metric,'zh'),/农场 · User farm 100079 · 水供需偏差/);assert.deepEqual(metric,original);
});
test('retained messages follow later global language changes instead of retaining old rendered text',()=>{
 const saved=rememberPair('已重新核算','Recalculated','en');
 assert.equal(messageLabel(saved,'zh'),'已重新核算');assert.equal(messageLabel(saved,'both'),'已重新核算 / Recalculated');
 assert.equal(messageLabel('IntakeSystem: integer required','zh'),'采食量评价体系必须填写整数');
});
test('shared symbols remain single while textual units switch languages',()=>{
 assert.equal(pair('F','F','both'),'F');assert.equal(unitLabel('ha','both'),'ha');
 assert.equal(unitLabel('kg DM/year','zh'),'kg 干物质/年');assert.equal(unitLabel('kg DM/year','en'),'kg DM/year');
});
test('original directory and database errors follow the global language without showing a stack trace',()=>{
 const dictionary=originalDictionary(catalog),message='System.ArgumentException: Choose an existing absolute folder path\n   at FarmSystemNative.NativeUi.Handle(...)';
 assert.equal(originalMessage(message,'zh',dictionary),'请填写已存在文件夹的完整路径');
 assert.equal(originalMessage(message,'en',dictionary),'Choose an existing absolute folder path');
 assert.match(originalMessage(message,'both',dictionary),/请填写.*Choose an existing/);
 assert.match(originalMessage('Original Input directory is unavailable. Restore its saved folder before reopening this session: E:\\资料','zh',dictionary),/输入目录不可用.*E:\\资料/);
 assert.equal(originalText('| Selected: My farm','zh',dictionary),'| 已选：My farm');assert.equal(originalText('| Selected: My farm','en',dictionary),'| Selected: My farm');
});
