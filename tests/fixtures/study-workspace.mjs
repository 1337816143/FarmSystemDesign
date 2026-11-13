import {fixture} from './manure-np.mjs';
import {defaultConfig,MODEL_VERSION} from '../../src/data.js';
import {search} from '../../src/model.js';
import {captureWorkingContext} from '../../src/working-context.js';
export function workspace(){
 const f=fixture(),config={...defaultConfig(),samples:100},result=search(f.data,f.ids,config,null);
 const p={id:'qa-plan-1',name:'Reference',status:'draft',createdAt:'2026-10-27T08:00:00Z',modelVersion:MODEL_VERSION,inputHash:result.inputHash,dataset:f.data,climate:null,config,farmIds:f.ids,candidate:result.candidates[0]};
 const q=structuredClone(p);q.id='qa-plan-2';q.name='Alternative';q.config.price=.9;q.candidate.totals.margin-=100;
 return {dataset:f.data,climate:null,plans:[p,q],planMeta:{},observations:[],audit:[],workingContext:captureWorkingContext({config,scope:'region',scopeIds:[],selectedPlot:'D'})};
}
