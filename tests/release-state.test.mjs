import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateReleaseMetadata,loadReleaseMetadata} from '../src/release-state.js';

const release=JSON.parse(fs.readFileSync(new URL('../version.json',import.meta.url)));
test('release consistency validates the complete application/model/data/engine identity',()=>{
  assert.equal(validateReleaseMetadata(release),null);
  for(const field of ['version','modelVersion','dataVersion','engineDigest']){
    assert.ok(validateReleaseMetadata({...release,[field]:'unexpected'}),field);
  }
  assert.equal(validateReleaseMetadata({...release,commit:'a'.repeat(40)}),null);
  assert.ok(validateReleaseMetadata({...release,commit:null}));
  assert.ok(validateReleaseMetadata({...release,changes:{malformed:true}}));
});
test('metadata loading is bounded and fails explicitly without inventing local-preview',async()=>{
  const success=await loadReleaseMetadata({fetcher:async()=>({ok:true,json:async()=>release})});
  assert.equal(success.status,'verified');assert.notStrictEqual(success.metadata,release);
  const failure=await loadReleaseMetadata({fetcher:async()=>{throw new Error('network');}});
  assert.equal(failure.status,'unavailable');assert.equal(failure.metadata,null);
  const mismatch=await loadReleaseMetadata({fetcher:async()=>({ok:true,json:async()=>({...release,version:'old'})})});
  assert.equal(mismatch.status,'unavailable');assert.equal(mismatch.reason,'version-mismatch');
  const timeout=await loadReleaseMetadata({fetcher:async()=>new Promise(()=>{}),timeoutMs:5});
  assert.equal(timeout.status,'unavailable');assert.equal(timeout.reason,'metadata-timeout');
});
