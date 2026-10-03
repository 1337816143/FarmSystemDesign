import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {english} from '../src/i18n.js';
test('current release notes can all be rendered in the English version dialog',()=>{
 const version=JSON.parse(fs.readFileSync(new URL('../version.json',import.meta.url)));
 for(const text of [version.name,...version.changes])assert.doesNotMatch(english(text),/[\u3400-\u9fff]/,text);
});
