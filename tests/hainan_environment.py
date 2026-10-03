#!/usr/bin/python3
from pathlib import Path
import os
import json,hashlib,unittest,math
import numpy as np
from PIL import Image
from osgeo import gdal
gdal.UseExceptions()
REPO=Path(__file__).resolve().parents[1]
ROOT=Path(os.environ.get('HAINAN_ENV_WORKDIR',str(REPO/'.data-cache/hainan-environment'))).resolve();OUT=Path(os.environ.get('HAINAN_ENV_ASSET_DIR',str(REPO/'data/hainan/regional/environment'))).resolve();m=json.loads((OUT/'environment-manifest.json').read_text())
class EnvironmentTests(unittest.TestCase):
 def test_groups_native_resolutions(self):
  self.assertEqual(set(m['layers']),{'dsm','rain','soilPh','soilSoc'})
  self.assertEqual([m['layers'][k]['native_resolution_m'] for k in ['dsm','rain','soilPh','soilSoc']],[30,5500,250,250])
  for k in ['dsm','rain']:self.assertEqual({r['id'] for r in m['layers'][k]['groups']},{'main','xisha','zhongsha','nansha'})
 def test_payload_budget_and_checksums(self):
  checks=json.loads((OUT/'asset-checksums.json').read_text())
  self.assertLess(sum(p.stat().st_size for p in OUT.iterdir() if p.is_file()),20_000_000)
  for name,c in checks['files'].items():
   with self.subTest(file=name):
    b=(OUT/name).read_bytes();self.assertEqual(hashlib.sha256(b).hexdigest(),c['sha256']);self.assertEqual(len(b),c['bytes'])
 def test_every_raster_window(self):
  count=0
  for key,layer in m['layers'].items():
   for r in layer['previews']:
    with self.subTest(layer=key,window=r['id']):
     a=np.array(Image.open(OUT/r['values_file']));p=np.array(Image.open(OUT/r['file']));valid=a[:,:,3]>0
     self.assertEqual(a.shape,(r['height'],r['width'],4));self.assertEqual(a.shape,p.shape)
     self.assertEqual(r['coverage']['valid_cells'],int(valid.sum()))
     self.assertEqual(r['coverage']['grid_cells'],int(valid.size));self.assertEqual(r['coverage']['nodata_cells'],int((~valid).sum()))
     self.assertIsNone(r['coverage']['cloud_cells']);self.assertEqual(r['epsg'],4326)
     decoded=(a[:,:,0].astype('uint16')+256*a[:,:,1].astype('uint16')).astype('float64')*r['decode']['scale']+r['decode']['offset']
     if valid.any():
      tol=r['decode']['scale']/2+1e-3
      self.assertAlmostEqual(decoded[valid].min(),r['statistics']['min'],delta=tol)
      self.assertAlmostEqual(decoded[valid].max(),r['statistics']['max'],delta=tol)
     metadata=json.loads((OUT/r['metadata_file']).read_text())
     tif=metadata.get('geotiff')
     if tif:
      ds=gdal.Open(str(OUT/tif));values=ds.ReadAsArray();good=np.isfinite(values)&(values!=-9999)
      np.testing.assert_array_equal(good,valid)
      if valid.any():np.testing.assert_allclose(decoded[valid],values[valid]*metadata['raster_scale'],rtol=0,atol=r['decode']['scale']/2+1e-3)
      self.assertEqual(ds.GetRasterBand(1).GetNoDataValue(),-9999)
     # Preview alpha must not paint values where the numeric grid is missing.
     self.assertFalse(np.any((p[:,:,3]>0)&~valid))
     count+=1
  self.assertEqual(count,50)
 def test_offshore_gap_semantics(self):
  rec=lambda key,a:next(x for x in m['layers'][key]['previews'] if x['id']==a)
  for k in ['soilPh','soilSoc']:
   for a in ['yongxing','yongshu','zhubi','huangyan']:self.assertEqual(rec(k,a)['coverage']['valid_cells'],0)
  for a in ['yongxing','yongshu','zhubi']:self.assertEqual(rec('rain',a)['coverage']['valid_cells'],0)
  self.assertEqual(rec('rain','huangyan')['status'],'coarse-context-only')
  self.assertEqual(rec('rain','xidao')['status'],'coarse-context-only')
  self.assertEqual(rec('dsm','yongshu')['status'],'unavailable-no-source-tile')
  for a in ['zhubi','huangyan']:self.assertEqual(rec('dsm',a)['status'],'unresolved-source-zero-surface')
 def test_dsm_asset_catalog_and_native_alignment(self):
  self.assertEqual(len(m['layers']['dsm']['assets']),57)
  for a in m['layers']['dsm']['assets']:
   self.assertTrue(a['href'].startswith('https://copernicus-dem-30m.s3.eu-central-1.amazonaws.com/'));self.assertEqual(a['native_resolution_m'],30);self.assertIsNone(a['nodata'])
  for r in m['layers']['dsm']['previews']:
   if r['id'] in ['main','xisha','zhongsha','nansha']:continue
   ds=gdal.Open(str(OUT/r['native_window_geotiff']));gt=ds.GetGeoTransform();res=1/3600
   self.assertAlmostEqual(gt[1],res,places=12);self.assertAlmostEqual(-gt[5],res,places=12)
   self.assertAlmostEqual((gt[0]+res/2)/res,round((gt[0]+res/2)/res),places=6)
   self.assertAlmostEqual((gt[3]+res/2)/res,round((gt[3]+res/2)/res),places=6)
if __name__=='__main__':unittest.main(verbosity=2)
