"""Directory selection must survive restart and portable relocation without stale inputs."""
from pathlib import Path
import base64,copy,io,json,shutil,sys,tempfile,unittest,xml.etree.ElementTree as ET,zipfile
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from farmdesign.native_ui import NativeUiSessions
from farmdesign.service import validate_document

class Directories(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
  self.base=self.root/'sessions'/('a'*32);self.base.mkdir(parents=True)
  self.external=self.root/'external';self.external.mkdir()
  for area in ['Bin','Input','Output','Docs','Bin/Photos']:(self.base/area).mkdir(parents=True,exist_ok=True)
  self.document=json.loads((ROOT/'data/farmdesign/author-cases-2019.json').read_text(encoding='utf-8'))['cases'][0]
  (self.base/'source-project.json').write_text(json.dumps(self.document),encoding='utf-8')
  self.config=self.base/'Bin/applConfig.FarmDESIGN.ini';self.config.write_text('<init>'+''.join('<element><name>'+name+'</name><value>'+str(value)+'</value></element>' for name,value in [('InputDirectoryPath',self.external),('OutputDirectoryPath',self.external),('CurrentFarm',79),('NetworkMetrics','Simple')])+'</init>',encoding='utf-8')
  self.manager=NativeUiSessions(self.root,None,validate_document,self.root/'sessions')
  document=self.document;directory=self.external
  class Process:
   def poll(self):return None
  class Adapter:
   process=Process()
   def command(self,operation,**kw):
    if operation=='snapshot':return copy.deepcopy(document)
    if operation=='directories':return {'Input':str(directory),'Output':str(directory),'networkMetrics':'None'}
    raise AssertionError(operation)
  self.manager.sessions[self.base.name]={'base':self.base,'id':self.base.name,'process':Adapter()}
 def tearDown(self):self.temp.cleanup()
 def test_reopen_keeps_selected_external_directories(self):
  self.manager._rebase(self.base)
  values={row.findtext('name'):row.findtext('value') for row in ET.parse(self.config).getroot().findall('element')}
  self.assertEqual(Path(values['InputDirectoryPath'].rstrip('\\')),self.external)
  self.assertEqual(Path(values['OutputDirectoryPath'].rstrip('\\')),self.external)
 def test_current_output_is_listed_and_downloadable(self):
  (self.external/'actual-report.txt').write_text('actual original report',encoding='utf-8')
  self.assertIn('Output/actual-report.txt',[r['path'] for r in self.manager.files(self.base.name)['files']])
  self.assertEqual(self.manager.read_file(self.base.name,'Output/actual-report.txt')['filename'],'actual-report.txt')
 def test_snapshot_uses_current_runtime_settings(self):
  self.assertEqual(self.manager.snapshot(self.base.name)['document']['runtimeOptions']['networkMetrics'],'None')
 def test_moved_session_uses_portable_directory_copies(self):
  (self.external/'retained.txt').write_text('portable file',encoding='utf-8');self.manager.snapshot(self.base.name)
  moved=self.root/'moved'/self.base.name;shutil.copytree(self.base,moved);self.manager._rebase(moved)
  values={row.findtext('name'):row.findtext('value') for row in ET.parse(moved/'Bin/applConfig.FarmDESIGN.ini').getroot().findall('element')}
  for area in ['Input','Output']:
   path=Path(values[area+'DirectoryPath'].rstrip('\\'))
   self.assertTrue(path.is_relative_to(moved));self.assertEqual((path/'retained.txt').read_text(),'portable file')
 def test_missing_external_directory_uses_saved_copy(self):
  (self.external/'retained.txt').write_text('retained',encoding='utf-8');self.manager.snapshot(self.base.name);shutil.rmtree(self.external);self.manager._rebase(self.base)
  values={row.findtext('name'):row.findtext('value') for row in ET.parse(self.config).getroot().findall('element')}
  self.assertEqual((Path(values['InputDirectoryPath'].rstrip('\\'))/'retained.txt').read_text(),'retained')
 def test_unchanged_external_files_reuse_saved_copy(self):
  (self.external/'file.txt').write_text('first');self.manager.snapshot(self.base.name);self.manager.snapshot(self.base.name)
  self.assertEqual(len(list((self.base/'DirectoryCopies').iterdir())),2)
  (self.external/'file.txt').write_text('other');self.manager.snapshot(self.base.name)
  self.assertEqual(len(list((self.base/'DirectoryCopies').iterdir())),4)
 def test_missing_uncaptured_input_is_reported(self):
  shutil.rmtree(self.external)
  with self.assertRaisesRegex(ValueError,'Original Input directory is unavailable'):self.manager._rebase(self.base)
 def test_read_cannot_escape_selected_directory(self):
  (self.root/'unrelated.txt').write_text('keep private')
  with self.assertRaises(ValueError):self.manager.read_file(self.base.name,'Output/../unrelated.txt')
 def test_database_lock_files_are_never_listed_or_downloaded(self):
  (self.external/'FarmDB.ldb').write_text('lock')
  self.assertFalse(self.manager.files(self.base.name)['files'])
  with self.assertRaises(ValueError):self.manager.read_file(self.base.name,'Input/FarmDB.ldb')
 def test_export_includes_selected_files_without_an_optional_before_pull_backup(self):
  (self.external/'actual-report.txt').write_text('actual report',encoding='utf-8');(self.base/'session.json').write_text('{}')
  result=self.manager.export(self.base.name);archive=zipfile.ZipFile(io.BytesIO(base64.b64decode(result['base64'])))
  self.assertEqual(archive.read('Output/actual-report.txt').decode(),'actual report');self.assertIn('Input/actual-report.txt',archive.namelist());self.assertIn('directories.json',archive.namelist())
 @unittest.skipUnless(sys.platform=='win32','Original process identity requires Windows')
 def test_restart_reports_saved_session_closed_without_launching_it(self):
  self.manager.sessions.clear();(self.base/'session.json').write_text(json.dumps({'pid':0,'mode':'browser','sourceDigest':'saved-input-digest'}))
  result=self.manager.status(self.base.name)
  self.assertFalse(result['running']);self.assertEqual(result['sourceDigest'],'saved-input-digest');self.assertFalse(self.manager.sessions)

if __name__=='__main__':unittest.main()
