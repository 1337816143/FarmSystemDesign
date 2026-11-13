"""Actual original-engine integration tests. Requires the prepared Windows author runtime.

No mock model, synthetic expected optimizer front or skipped-engine success.
"""
from pathlib import Path
import base64
import copy
import hashlib
import io
import json
import sys
import time
import unittest
import zipfile

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from farmdesign.service import FarmDesignService,validate_document,document_with_values,nondominated
CATALOG=json.loads((ROOT/'data/farmdesign/author-cases-2019.json').read_text(encoding='utf-8'))


class NativeEngineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.service=FarmDesignService()
        capability=cls.service.capabilities()
        if not capability['ready']:raise RuntimeError(capability.get('error','Native engine unavailable'))
        cls.identity=capability['identity']
        cls.base=copy.deepcopy(CATALOG['cases'][0])
        cls.reference=cls.service.evaluate(cls.base)

    @classmethod
    def tearDownClass(cls):cls.service.close()

    def test_original_dk_golden_outputs_and_real_flow_network(self):
        r=self.reference
        self.assertEqual(r['engineVersion'],'4.21.5.0')
        self.assertEqual(len(r['modules']),20)
        self.assertAlmostEqual(r['modules']['Budget']['FreeBudget'],61895117.19154998,places=5)
        self.assertAlmostEqual(r['modules']['OmBalance']['Balance'],.328029642750721,places=10)
        self.assertAlmostEqual(r['modules']['Labour']['HouseholdLeisureTime'],76.41691,places=5)
        self.assertAlmostEqual(r['modules']['GHGs']['TotalEmissionCO2eq'],7.55532112945941,places=10)
        self.assertGreater(r['modules']['NutrientFlowMatrix']['FlowMetrics'][0]['TotalSystemThroughput'],20000)
        self.assertEqual(len([m for m in r['metrics'] if m.get('native')]),708)

    def test_editing_real_input_propagates_and_reset_restores(self):
        d=copy.deepcopy(self.base);d['tables']['ECN'][0]['GeneralCosts']+=1000
        after=self.service.evaluate(d)
        self.assertAlmostEqual(self.reference['modules']['Budget']['FreeBudget']-after['modules']['Budget']['FreeBudget'],1000,places=6)
        self.assertEqual(self.service.evaluate(self.base)['modules']['Budget'],self.reference['modules']['Budget'])

    def test_second_author_case_and_new_farm_identity(self):
        self.assertEqual(self.service.evaluate(CATALOG['cases'][1])['farmId'],80)
        d=copy.deepcopy(self.base);d['farmId']=10079
        for rows in {**d['tables'],**d.get('auxiliaryTables',{})}.values():
            for row in rows:
                if 'FrmID' in row:row['FrmID']=10079
        for rows in [d['optimization']['variables'],d['optimization']['indicators']]:
            for row in rows:row['CasID']=10079
        d['tables']['FRM'][0]['Name']='New_native_farm_test'
        r=self.service.evaluate(d)
        self.assertAlmostEqual(r['modules']['Budget']['FreeBudget'],self.reference['modules']['Budget']['FreeBudget'],places=5)

    def test_native_xml_roundtrip_recomputes_all_module_numbers(self):
        xml=self.service.export_xml(self.base)['xml']
        imported=self.service.import_xml(xml)['document']
        r=self.service.evaluate(imported)
        def compare(a,b):
            if isinstance(a,dict):
                for key,value in a.items():compare(value,b[key])
            elif isinstance(a,list):
                self.assertEqual(len(a),len(b))
                for left,right in zip(a,b):compare(left,right)
            elif isinstance(a,(float,int)) and not isinstance(a,bool):self.assertAlmostEqual(a,b,delta=1e-8+abs(a)*1e-12)
        compare(self.reference['modules'],r['modules'])

    def test_water_ghg_bioenergy_and_both_network_modes(self):
        d=copy.deepcopy(self.base)
        changes=[('ENV','EnvID',77,{'IrrigationWater':2000}),('CRP','CrpID',1192,{'WaterDemand':200,'Crop_CH4_EF':.5}),('ANM','AnmID',444,{'Enteric_CH4_EF':40,'Manure_CH4_EF':.2}),('FRM','FrmID',79,{'ProportionCH4inBiogas':.6,'LowerHeatingValueCH4':35.8,'BioEnergyMicrobialEff':.35,'BioEnergyMicrobialCtoN':12,'NLossDigestionEP':.015,'NLossDigestateAppl':.05,'DigestateHumifCoeff':.3,'Residue_N2O_EF':.01,'Fixation_N2O_EF':.01,'Deposition_N2O_EF':.01}),('PRD','PrdID',3189,{'ToEnergyProduction':100,'DegradationRateEP':.5})]
        for table,key,identifier,values in changes:next(row for row in d['tables'][table] if row[key]==identifier).update(values)
        for mode in ['Simple','Complex']:
            d['runtimeOptions']={'networkMetrics':mode};r=self.service.evaluate(d)
            self.assertAlmostEqual(r['modules']['WaterUse']['WaterRequired'],140,places=8)
            self.assertEqual(r['modules']['WaterUse']['WaterAvailable'],2000)
            self.assertAlmostEqual(r['modules']['GHGs']['TotalEmissionCO2eq'],7.861201548306375,places=9)
            self.assertAlmostEqual(r['modules']['Energy']['TotalEnergyProduced'],4357.281569400713,places=8)
            self.assertEqual(next(m['unit'] for m in r['metrics'] if m['key']=='GHGs.TotalEmissionCO2eq'),'t CO2eq/year')
            flow=r['modules']['NutrientFlowMatrix']['FlowMetrics']
            self.assertAlmostEqual(flow[0]['TotalSystemThroughput'],22637.77776367958 if mode=='Simple' else 20289.500010859076,places=5)

    def test_nfd_missing_is_unknown_and_three_real_native_attachments_activate_it(self):
        self.assertEqual(self.reference['functionalDiversity']['status'],'not-configured')
        score=next(m for m in self.reference['metrics'] if m['key']=='Nutrition.FunctionalDiversityProduced')
        self.assertIsNone(score['value'])
        d=copy.deepcopy(self.base);d['tables']['FRM'][0]['LowerBoundaryNFD']=0
        d['functionalDiversity']={'dendrogram':'1\t1\t1\n1\t0\t0\n0\t1\t0\n0\t0\t1','mapping':'103183\t0\n103186\t1\n103188\t2','products':'banana\nmango\nonion','source':'Synthetic software mechanism fixture; not real trait evidence'}
        r=self.service.evaluate(d)
        self.assertEqual(r['modules']['Nutrition']['FunctionalDiversityProduced'],1)
        self.assertEqual(r['modules']['Nutrition']['FunctionalDiversityConsumed'],1)
        bad=copy.deepcopy(d);bad['functionalDiversity']['mapping']='103183\t99'
        with self.assertRaises(ValueError):self.service.evaluate(bad)

    def test_native_project_export_has_readable_databases_full_reports_and_exact_project(self):
        artifact=self.service.export_package(self.base)
        data=base64.b64decode(artifact['base64'])
        self.assertEqual(hashlib.sha256(data).hexdigest(),artifact['sha256'])
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            self.assertIsNone(archive.testzip())
            self.assertEqual(json.loads(archive.read('project.json')),self.base)
            self.assertEqual(len([p for p in archive.namelist() if p.startswith('Reports/')]),20)
            self.assertGreater(len(archive.read('Input/FarmDB.mdb')),500000)
            restored=self.service.import_xml(archive.read('FarmDESIGN.xml').decode())['document']
            r=self.service.evaluate(restored)
            self.assertAlmostEqual(r['modules']['Budget']['FreeBudget'],61895117.19154998,places=5)

    def test_original_de_search_candidate_recomputation_and_cancel(self):
        objectives=[{'key':':'.join([v['EntityType'],v['ObjName'],v['Variable']]),'direction':'max' if v['Direction']==1 else 'min'} for v in self.base['optimization']['indicators'] if v['Objective']]
        body={'document':self.base,'variables':self.base['optimization']['variables'],'objectives':objectives,'constraints':[],'settings':{'population':24,'generations':8,'F':.15,'CR':.85}}
        job=self.service.start_job(body)
        deadline=time.monotonic()+60
        while time.monotonic()<deadline:
            report=self.service.get_job(job['id'])
            if report['status'] in {'completed','failed','cancelled'}:break
            time.sleep(.1)
        self.assertEqual(report['status'],'completed',report.get('error'))
        self.assertGreater(report['generation'],0)
        self.assertTrue(report['native'])
        self.assertIsNone(report['evaluations'])
        self.assertEqual(nondominated(report['frontier'],objectives),report['frontier'])
        for candidate in report['frontier']:
            r=self.service.evaluate(candidate['document'])
            metrics={m['key']:m['value'] for m in r['metrics']}
            self.assertFalse(r['violations'])
            for key,value in candidate['scores'].items():self.assertAlmostEqual(metrics[key],value,delta=abs(value)*1e-10+1e-7)
        body['settings']['generations']=1000
        second=self.service.start_job(body);self.service.cancel_job(second['id'])
        deadline=time.monotonic()+30
        while time.monotonic()<deadline:
            report=self.service.get_job(second['id'])
            if report['status'] in {'cancelled','failed','completed'}:break
            time.sleep(.1)
        self.assertEqual(report['status'],'cancelled',report.get('error'))

    def test_invalid_values_and_metadata_are_not_executed(self):
        for value in [float('nan'),float('inf'),{'command':'x'}]:
            doc=copy.deepcopy(self.base);doc['tables']['ECN'][0]['GeneralCosts']=value
            with self.assertRaises(ValueError):validate_document(doc)
        xml='<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///C:/Windows/win.ini">]><FarmData>&xxe;</FarmData>'
        with self.assertRaises(RuntimeError):self.service.import_xml(xml)

    def test_original_author_sources_and_native_binaries_remain_unchanged(self):
        source=Path(self.identity['source'])
        for path,expected in self.identity['hashes'].items():
            self.assertEqual(hashlib.sha256((source/path).read_bytes()).hexdigest(),expected,path)
        for path in ['Bin/FarmDESIGN.exe','Bin/DAL.dll','Bin/DE.dll','Bin/NetworkMetrics.dll','Bin/ParetoDE.dll']:
            self.assertEqual(hashlib.sha256((self.service.runtime/path).read_bytes()).hexdigest(),self.identity['hashes'][path])


if __name__=='__main__':unittest.main(verbosity=2)
