import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {
  CLEAR_SCL, acceptedSclPixel, createRegionalRasterLayer, intersects, pixelIndex, rasterPriority,
  sourceProjection, tileBounds, tileLonLat, waitForRaster,
} from '../src/regional-raster.js';

const regional = new URL('../data/hainan/regional/', import.meta.url);
const readJson = path => JSON.parse(fs.readFileSync(new URL(path, regional), 'utf8'));
const environment = readJson('environment/environment-manifest.json');
const close = (actual, expected, tolerance = 1e-10) => assert.ok(
  Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`,
);
const mappedRecord = r => ({...r, bounds_wsen:r.bbox, pixel_size_degrees:r.display_resolution.degrees});

test('regional Web Mercator tile coordinates retain WGS84 axis order and adjacency', () => {
  assert.deepEqual(tileLonLat(1, 1, 1), [0, 0]);
  const world = tileBounds({x:0, y:0, z:0});
  assert.equal(world[0], -180);
  assert.equal(world[2], 180);
  close(world[1], -85.0511287798066);
  close(world[3], 85.0511287798066);
  const tile = tileBounds({x:3303, y:1815, z:12});
  assert.ok(tile[0] < 110.35 && tile[2] > 110.35);
  assert.ok(tile[1] < 20.02 && tile[3] > 20.02);
  assert.equal(tile[2], tileBounds({x:3304, y:1815, z:12})[0]);
  assert.equal(tile[1], tileBounds({x:3303, y:1816, z:12})[3]);
  assert.equal(intersects(tile, tileBounds({x:3304, y:1815, z:12})), false);
  assert.equal(intersects(tile, [110.34, 20.01, 110.36, 20.03]), true);
});

test('geographic PNG lookup is north-up with half-open east and south edges', () => {
  const bounds = [108, 18, 110, 20];
  assert.equal(pixelIndex(108, 20, bounds, 4, 4), 0);
  assert.equal(pixelIndex(108.25, 19.75, bounds, 4, 4), 0);
  assert.equal(pixelIndex(109.75, 19.75, bounds, 4, 4), 3);
  assert.equal(pixelIndex(108.25, 18.25, bounds, 4, 4), 12);
  assert.equal(pixelIndex(109.75, 18.25, bounds, 4, 4), 15);
  for (const point of [[110, 19], [109, 18], [107.99, 19], [109, 20.01]]) {
    assert.equal(pixelIndex(...point, bounds, 4, 4), -1, point.join(','));
  }
});

test('source CRS supports geographic and both UTM hemispheres without guessing unknown CRSs', () => {
  assert.equal(sourceProjection(4326), 'EPSG:4326');
  assert.match(sourceProjection(32649), /\+proj=utm \+zone=49 /);
  assert.doesNotMatch(sourceProjection(32649), /\+south/);
  assert.match(sourceProjection('32749'), /\+zone=49 \+south /);
  assert.match(sourceProjection(32601), /\+zone=1 /);
  assert.match(sourceProjection(32760), /\+zone=60 /);
  for (const code of [3857, 32600, 32661, 32700, 32761, NaN]) {
    assert.throws(() => sourceProjection(code), /Unsupported source CRS/);
  }
});

test('raster priority prefers native detail, then the smaller equal-resolution named window', () => {
  const group = {id:'group', pixel_size_degrees:[.05, .05], bounds_wsen:[108, 18, 111, 21]};
  const named = {id:'named', pixel_size_degrees:[.05 + 1e-14, .05], bounds_wsen:[109, 19, 109.05, 19.05]};
  const detail = {id:'detail', pixel_size_degrees:[.0003, .0003], bounds_wsen:[108, 18, 111, 21]};
  assert.deepEqual([group, named, detail].sort(rasterPriority).map(r => r.id), ['detail', 'named', 'group']);
  for (const id of ['xidao', 'huangyan']) {
    const records = environment.layers.rain.previews.map(mappedRecord);
    const namedRecord = records.find(r => r.id === id);
    const b = namedRecord.bounds_wsen, lon = (b[0] + b[2]) / 2, lat = (b[1] + b[3]) / 2;
    const candidates = records.filter(r => pixelIndex(lon, lat, r.bounds_wsen, r.width, r.height) >= 0).sort(rasterPriority);
    assert.equal(candidates[0].id, id);
    assert.equal(candidates[0].status, 'coarse-context-only');
  }
});

test('SCL accepts only 2/4/5/6 and preserves all other classes as rejected', () => {
  assert.deepEqual([...CLEAR_SCL].sort((a,b) => a-b), [2,4,5,6]);
  for (let value = 0; value <= 11; value++) {
    const scl = {width:9, height:9, data:new Uint8Array(81).fill(value)};
    assert.equal(acceptedSclPixel(scl, 40), [2,4,5,6].includes(value), `SCL=${value}`);
  }
  assert.equal(acceptedSclPixel({width:1, height:1, data:Uint8Array.of(4)}, -1), false);
  assert.equal(acceptedSclPixel({width:1, height:1, data:Uint8Array.of(4)}, 1), false);
});

test('SCL rejects shadow/cloud/cirrus within a three-source-pixel square halo', () => {
  const width = 11, center = 5 * width + 5;
  for (const contaminant of [3,8,9,10]) {
    for (const [dx,dy] of [[0,0], [3,0], [-3,0], [0,3], [0,-3], [3,3], [-3,-3]]) {
      const scl = {width, height:11, data:new Uint8Array(121).fill(4)};
      scl.data[(5+dy)*width+5+dx] = contaminant;
      assert.equal(acceptedSclPixel(scl, center), false, `SCL=${contaminant}, offset=${dx},${dy}`);
    }
    for (const [dx,dy] of [[4,0], [-4,0], [0,4], [0,-4]]) {
      const scl = {width, height:11, data:new Uint8Array(121).fill(4)};
      scl.data[(5+dy)*width+5+dx] = contaminant;
      assert.equal(acceptedSclPixel(scl, center), true, `outside halo: ${dx},${dy}`);
    }
  }
  const edge = {width:11, height:11, data:new Uint8Array(121).fill(4)};
  edge.data[10] = 9;
  assert.equal(acceptedSclPixel(edge, 11), true, 'the halo must not wrap across image rows');
  edge.data[0] = 9;
  assert.equal(acceptedSclPixel(edge, 11), false, 'the halo clips safely at image edges');
});

test('waitForRaster abort settles a permanently pending operation immediately', {timeout:1000}, async () => {
  const controller = new AbortController();
  const waiting = waitForRaster(new Promise(() => {}), controller.signal);
  const rejected = assert.rejects(waiting, {name:'AbortError'});
  controller.abort();
  await rejected;
  const alreadyAborted = new AbortController();
  alreadyAborted.abort();
  await assert.rejects(waitForRaster(new Promise(() => {}), alreadyAborted.signal), {name:'AbortError'});
});

test('waitForRaster retains ordinary results/errors and ignores late completion after abort', {timeout:1000}, async () => {
  assert.equal(await waitForRaster(Promise.resolve(42), new AbortController().signal), 42);
  const error = new Error('source unavailable');
  await assert.rejects(waitForRaster(Promise.reject(error), new AbortController().signal), e => e === error);
  let finish;
  const controller = new AbortController();
  const waiting = waitForRaster(new Promise(resolve => { finish = resolve; }), controller.signal);
  const rejected = assert.rejects(waiting, {name:'AbortError'});
  controller.abort();
  finish('too late');
  await rejected;
});

function mockRasterRuntime() {
  class GridLayer {
    constructor(options) { this.events = []; this._tiles = {}; this.initialize(options); }
    initialize(options) { this.options = options; }
    fire(name, detail) { this.events.push({name, detail}); }
    onRemove() {}
    _removeTile() {}
    static extend(methods) { class Layer extends this {} Object.assign(Layer.prototype, methods); return Layer; }
  }
  const originals = Object.fromEntries(['document','ImageData','GeoTIFF','proj4'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis,k)]));
  globalThis.document = {createElement:() => ({dataset:{}, setAttribute(){}, getContext:() => ({putImageData(){}})})};
  globalThis.ImageData = class { constructor(data,width,height) { Object.assign(this,{data,width,height}); } };
  globalThis.GeoTIFF = {fromUrl:async () => { throw new Error('simulated source outage'); }};
  globalThis.proj4 = () => ({forward:p => p});
  return {L:{GridLayer}, restore:() => {
    for (const [key,descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis,key,descriptor); else delete globalThis[key];
    }
  }};
}

test('overview setup does not request the catalog, and a failed native request can retry', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async url => {
    requests.push(url);
    if (url.endsWith('preview-manifest.json')) return {ok:true,json:async () => ({records:[]})};
    throw new Error('catalog network unavailable');
  };
  try {
    const {regionalConfig} = await import('../src/regional-atlas-layers.js');
    const config = await regionalConfig('imagery');
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(requests, ['./data/hainan/regional/imagery/preview-manifest.json']);
    assert.equal(typeof config.catalog, 'function');
    await assert.rejects(config.catalog(), /catalog network unavailable/);
    globalThis.fetch = async url => {
      requests.push(url);
      return {ok:true,json:async () => ({scenes:[]})};
    };
    assert.deepEqual(await config.catalog(), {scenes:[]});
    assert.equal(requests.filter(url => url.endsWith('scene-catalog.json')).length, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test('a failed lazy native catalog settles the tile with a visible error', {timeout:1000}, async () => {
  const runtime = mockRasterRuntime();
  let layer;
  try {
    layer = createRegionalRasterLayer(runtime.L, {kind:'imagery',records:[],nativeZoom:12,
      catalog:async () => { throw new Error('catalog network unavailable'); }});
    const result = await new Promise(resolve => layer.createTile({x:3303,y:1815,z:12},
      (error,tile) => resolve({error,tile})));
    assert.match(result.error?.message || '', /catalog network unavailable/);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(layer.active, 0);
  } finally { layer?.onRemove(); runtime.restore(); }
});

test('native COG source cap counts actual failures and emits an error instead of successful blank output', {timeout:1000}, async () => {
  const runtime = mockRasterRuntime();
  let layer;
  try {
    const coords = {x:3303,y:1815,z:12}, bbox = tileBounds(coords);
    const scenes = Array.from({length:13}, (_,i) => ({id:`failure-${i}`,bbox_wgs84:bbox,epsg:32649,
      assets:{visual:{href:`https://example.invalid/regional-test-${i}.tif`},scl:{href:`https://example.invalid/quality-test-${i}.tif`}}}));
    layer = createRegionalRasterLayer(runtime.L, {kind:'imagery',catalog:Promise.resolve({scenes}),records:[],nativeZoom:12});
    const result = await new Promise(resolve => layer.createTile(coords, (error,tile) => resolve({error,tile})));
    assert.match(result.error?.message || '', /All raster sources unavailable/);
    assert.equal(result.tile.dataset.validPixels, '0');
    const coverage = layer.events.find(event => event.name === 'coverage').detail;
    assert.equal(coverage.attempts, 12);
    assert.equal(coverage.failures, 12);
    assert.equal(coverage.filled, 0);
  } finally { layer?.onRemove(); runtime.restore(); }
});

test('cancelling a tile with stalled catalog releases its render slot without a late tile callback', {timeout:1000}, async () => {
  const runtime = mockRasterRuntime();
  let layer;
  try {
    layer = createRegionalRasterLayer(runtime.L, {kind:'imagery',catalog:new Promise(() => {}),records:[],nativeZoom:12});
    let callbacks = 0;
    const tile = layer.createTile({x:3303,y:1815,z:12}, () => { callbacks++; });
    assert.equal(layer.active, 1);
    tile._abort.abort();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(layer.active, 0);
    assert.equal(layer.controllers.size, 0);
    assert.equal(callbacks, 0);
    assert.equal(layer.events.length, 0);
  } finally { layer?.onRemove(); runtime.restore(); }
});

test('all 50 environmental records have hash-verified, correctly georeferenced actual PNGs', () => {
  const records = Object.values(environment.layers).flatMap(layer => layer.previews);
  assert.equal(records.length, 50);
  assert.equal(new Set(records.map(r => r.file)).size, 50);
  const checksums = readJson('environment/asset-checksums.json').files;
  for (const record of records) {
    assert.equal(record.preview_epsg, 4326, record.file);
    assert.equal(record.values_epsg, 4326, record.file);
    assert.ok(record.width > 0 && record.height > 0);
    const [west,south,east,north] = record.bbox;
    assert.ok(west < east && south < north);
    close((east-west)/record.width, record.display_resolution.degrees[0]);
    close((north-south)/record.height, record.display_resolution.degrees[1]);
    assert.equal(record.coverage.grid_cells, record.width * record.height);
    assert.equal(record.coverage.valid_cells + record.coverage.nodata_cells, record.coverage.grid_cells);
    assert.equal(record.coverage.cloud_cells, null, 'cloud screening is inapplicable to environmental products');
    for (const [key,file] of [['preview',record.file], ['values',record.values_file]]) {
      const bytes = fs.readFileSync(new URL(`environment/${file}`, regional));
      assert.equal(bytes.subarray(0,8).toString('hex'), '89504e470d0a1a0a', file);
      assert.equal(bytes.subarray(12,16).toString(), 'IHDR', file);
      assert.equal(bytes.readUInt32BE(16), record.width, file);
      assert.equal(bytes.readUInt32BE(20), record.height, file);
      const hash = createHash('sha256').update(bytes).digest('hex');
      assert.equal(hash, record.sha256[key], file);
      assert.equal(hash, checksums[file].sha256, file);
      assert.equal(bytes.length, checksums[file].bytes, file);
    }
  }
});

test('environmental native resolution, physical decode and display resolution stay distinct', () => {
  const expected = {dsm:[30,1,-500,'m'], rain:[5500,.1,0,'mm/year'], soilPh:[250,.1,0,'pH'], soilSoc:[250,.1,0,'g/kg']};
  for (const [key,[resolution,scale,offset,units]] of Object.entries(expected)) {
    const layer = environment.layers[key];
    assert.equal(layer.native_resolution_m, resolution);
    for (const record of layer.previews) {
      assert.equal(record.native_resolution_m, resolution);
      assert.equal(record.decode.scale, scale);
      assert.equal(record.decode.offset, offset);
      assert.equal(record.decode.units, units);
      assert.match(record.decode.nodata, /alpha/);
      if (key === 'rain') close(record.display_resolution.degrees[0], .05, 1e-8);
    }
  }
  const dsm = environment.layers.dsm;
  assert.equal(dsm.assets.length, 57);
  close(dsm.previews.find(r => r.id === 'main').display_resolution.degrees[0], 8/3600);
  close(dsm.previews.find(r => r.id === 'nansha').display_resolution.degrees[0], 32/3600);
  for (const id of ['haikou','sanya','danzhou','wuzhishan','wenchang','xidao','yongxing']) {
    close(dsm.previews.find(r => r.id === id).display_resolution.degrees[0], 1/3600);
  }
});

test('offshore absent, zero-only and coarse-context values cannot masquerade as island measurements', () => {
  const dsm = environment.layers.dsm.previews;
  for (const id of ['zhongsha','zhubi','huangyan']) {
    const record = dsm.find(r => r.id === id);
    assert.equal(record.status, 'unresolved-source-zero-surface');
    assert.equal(record.coverage.positive_surface_cells, 0);
    assert.equal(record.coverage.zero_height_cells, record.coverage.valid_cells);
  }
  assert.equal(dsm.find(r => r.id === 'yongshu').status, 'unavailable-no-source-tile');
  for (const id of ['xidao','huangyan']) {
    const record = environment.layers.rain.previews.find(r => r.id === id);
    assert.equal(record.status, 'coarse-context-only');
    assert.match(record.coverage_note, /does not resolve|no island-specific/);
  }
  for (const key of ['soilPh','soilSoc']) {
    assert.deepEqual(environment.layers[key].groups.map(r => r.id), ['main']);
    for (const id of ['yongxing','yongshu','zhubi','huangyan']) {
      const record = environment.layers[key].previews.find(r => r.id === id);
      assert.equal(record.status, 'unavailable-no-prediction');
      assert.equal(record.coverage.valid_cells, 0);
    }
  }
});

test('2025 source-native areas reconcile with the independent counts and exclude clouds from valid area', () => {
  const summary = readJson('landcover2025-main-island-summary.json');
  const crosscheck = readJson('landcover2025-crosscheck.json');
  assert.equal(summary.native_resolution_m, 10);
  assert.equal(summary.source_crs, 'EPSG:32649');
  assert.match(summary.source_sha256, /^[0-9a-f]{64}$/);
  assert.equal(crosscheck.all_native_counts_match, true);
  for (const row of summary.classes) {
    assert.equal(row.pixels, crosscheck.independent_native_counts[row.code]);
    assert.equal(row.km2, row.pixels / 10000);
    close(row.percent, row.pixels / summary.classified_pixels * 100, .000051);
  }
  assert.equal(summary.classes.filter(r => r.valid_class).reduce((n,r) => n+r.pixels, 0), summary.classified_pixels);
  assert.equal(summary.classes.find(r => r.code === 10).valid_class, false);
  assert.equal(summary.cloud_pixels, summary.classes.find(r => r.code === 10).pixels);
  assert.equal(summary.mask_area_100m_km2 * 10000, summary.classified_pixels + summary.cloud_pixels + summary.masked_nodata_pixels);
  close(summary.total_classified_km2, summary.classified_pixels / 10000, .005);
  close(summary.mask_sampling_difference_percent, Math.abs(summary.mask_area_100m_km2-summary.mask_area_200m_km2)/summary.mask_area_100m_km2*100, .000051);
  assert.match(summary.method, /UTM grid areas.*not equal-area\/geodesic/);
  assert.match(summary.not_for, /Official cultivated-land|direct cross-product change/);
});

test('15 of 15 spatially distributed 2025 source/service samples match without claiming accuracy validation', () => {
  const crosscheck = readJson('landcover2025-crosscheck.json');
  assert.equal(crosscheck.checked, 15);
  assert.equal(crosscheck.matched, 15);
  assert.equal(crosscheck.samples.length, 15);
  assert.equal(new Set(crosscheck.samples.map(r => r.place)).size, 8);
  for (const sample of crosscheck.samples) {
    assert.equal(sample.status, 'ok');
    assert.equal(sample.same_class, true);
    assert.equal(Number(sample.service_value), sample.class);
    assert.ok(sample.lon >= 108.5 && sample.lon <= 111.5);
    assert.ok(sample.lat >= 17.8 && sample.lat <= 20.5);
  }
  assert.match(crosscheck.sample_design, /not classification accuracy/);
  assert.match(crosscheck.method, /not independent coastline validation/);
});

test('OSM community references have 18 main-island aggregates including Wuzhishan and explicitly omit Sansha', () => {
  const geo = readJson('county-osm-reference-20261003.geojson');
  const audit = readJson('county-osm-audit.json');
  const names = geo.features.map(f => f.properties.name);
  assert.equal(geo.type, 'FeatureCollection');
  assert.equal(geo.features.length, 18);
  assert.equal(new Set(names).size, 18);
  assert.ok(names.includes('五指山市'));
  assert.ok(names.includes('海口市'));
  for (const name of ['琼山区','琼山市','三沙市']) assert.ok(!names.includes(name));
  assert.equal(audit.features, 18);
  assert.equal(audit.units.length, 19);
  assert.equal(audit.units.find(r => r.name === '三沙市').geometry_status, 'missing-complete-aggregate-polygon');
  assert.deepEqual(audit.units.filter(r => r.geometry_status === 'available-community-reference').map(r => r.name).sort(), [...names].sort());
  assert.equal(audit.all_geometries_valid, true);
  assert.deepEqual(audit.overlaps_above_1m2, []);
  assert.equal(audit.geometry_crs, 'EPSG:4326 (WGS84)');
  assert.match(audit.limitations.join(' '), /not authoritative current surveyed boundary/);
  assert.match(audit.limitations.join(' '), /No completeness claim/);
  for (const feature of geo.features) {
    assert.match(feature.properties.reference_kind, /not official/);
    assert.match(feature.properties.source_url, /^https:\/\/www\.openstreetmap\.org\/relation\/\d+$/);
    assert.ok(['Polygon','MultiPolygon'].includes(feature.geometry.type));
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const polygon of polygons) for (const ring of polygon) {
      assert.ok(ring.length >= 4);
      assert.deepEqual(ring[0], ring.at(-1));
      for (const [lon,lat] of ring) assert.ok(Number.isFinite(lon) && lon >= -180 && lon <= 180 && Number.isFinite(lat) && lat >= -90 && lat <= 90);
    }
  }
});
