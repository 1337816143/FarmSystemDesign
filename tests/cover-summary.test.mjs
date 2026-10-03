import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validCoverSummary,coverSummaryCsv} from '../src/cover-summary.js';
const snapshot = JSON.parse(fs.readFileSync(new URL('../data/hainan/landcover-main-island-summary.json',import.meta.url)));
test('full summary rejects corrupt minor classes, duplicate codes and inconsistent denominator', () => {
  assert.equal(validCoverSummary(snapshot),true);
  for (const mutate of [d => d.classes[1].km2 = NaN,d => d.classes[1].code = 10,d => d.total_classified_km2 *= 2,d => d.classes[1].percent = 90,d => d.total_classified_km2 = 0]) {
    const data = structuredClone(snapshot); mutate(data);
    assert.equal(validCoverSummary(data),false);
    assert.throws(() => coverSummaryCsv(data));
  }
});
test('CSV keeps every class and provenance with uncertainty boundary on every data row', () => {
  const csv = coverSummaryCsv(snapshot);
  assert.equal(csv.trim().split('\r\n').length,snapshot.classes.length + 1);
  for (const row of csv.trim().split('\r\n').slice(1)) {
    assert.ok(row.includes('33856.7'));
    assert.ok(row.includes(snapshot.source_sha256.N18E108));
    assert.ok(row.includes('not a confidence interval'));
    assert.ok(row.includes('CC BY 4.0'));
    assert.ok(row.includes('ESA WorldCover project 2021'));
    assert.ok(row.includes('10.5281/zenodo.7254221'));
  }
  const injected = structuredClone(snapshot); injected.classes[0].name = '=1+1';
  assert.ok(coverSummaryCsv(injected).includes('"\'=1+1"'));
});
test('missing or malformed source, attribution and mask metadata cannot render or export', () => {
  const mutations = [
    d => delete d.source_urls, d => d.source_urls = [], d => d.source_urls[0] = 'https://example.org/fake.tif',
    d => delete d.source_sha256, d => delete d.source_sha256.N18E108, d => d.source_sha256.N18E111 = 'not-a-hash',
    d => d.mask_area_100m_km2 = -1, d => d.mask_area_200m_km2 = -1, d => d.mask_area_200m_km2 = Infinity,
    d => d.masked_nodata_pixels = -1, d => d.masked_nodata_pixels = .5, d => delete d.masked_nodata_pixels,
    d => d.mask_overview_m = 200, d => d.mask_sampling_difference_percent = -1,
    d => d.mask_sampling_difference_percent = .2, d => d.mask_sampling_difference_percent = NaN,
    d => d.mask_area_100m_km2 = 100, d => d.geography = '', d => delete d.method, d => delete d.not_for,
    d => delete d.license, d => d.license_url = '', d => d.attribution = '', d => delete d.citation, d => d.citation_url = '',
    d => d.classes[1] = null,
  ];
  for (const mutate of mutations) {
    const data = structuredClone(snapshot); mutate(data);
    assert.equal(validCoverSummary(data),false);
    assert.throws(() => coverSummaryCsv(data),{message:'Invalid cover summary'});
  }
});
test('sensitivity uses absolute area difference over the 100 m mask and allows declared rounding only', () => {
  const data = structuredClone(snapshot);
  const exact = Math.abs(data.mask_area_200m_km2-data.mask_area_100m_km2)/data.mask_area_100m_km2*100;
  assert.ok(Math.abs(exact-.1643397)<.000001);
  data.mask_sampling_difference_percent=exact;
  assert.equal(validCoverSummary(data),true);
  data.mask_sampling_difference_percent=exact+.0006;
  assert.equal(validCoverSummary(data),false);
});
