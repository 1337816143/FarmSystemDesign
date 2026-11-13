import {defaultConfig,selectedFarms} from './data.js';
import {validateConfig} from './model.js';
import {prepareSpatialRainfall} from './spatial-inputs.js';
const MODES=['region','single','village','group','typical'];
export function captureWorkingContext(state){
 const config=structuredClone(state.config);delete config.manurePhosphorus;
 return {schema:'FarmSystemDesign.WorkingContext',schemaVersion:1,scope:state.scope,scopeIds:[...state.scopeIds],config,
  selectedPlot:state.selectedPlot};
}
export function restoreWorkingContext(value,dataset){
 const defaults={scope:'region',scopeIds:[],config:defaultConfig(),selectedPlot:dataset.plots[0]?.id||null};
 if(value==null)return {...defaults,restored:false,issues:[]};
 const issues=[];
 if(value.schema!=='FarmSystemDesign.WorkingContext'||value.schemaVersion!==1)return {...defaults,restored:false,issues:['WORKING_SCHEMA_INVALID']};
 const result={...defaults,restored:true,issues};
 if(MODES.includes(value.scope))result.scope=value.scope;else issues.push('WORKING_SCOPE_INVALID');
 const allowed=result.scope==='village'?new Set(dataset.villages.map(v=>v.id)):new Set(dataset.farms.map(f=>f.id));
 if(Array.isArray(value.scopeIds)&&value.scopeIds.every(id=>typeof id==='string'&&allowed.has(id))&&new Set(value.scopeIds).size===value.scopeIds.length)result.scopeIds=[...value.scopeIds];
 else issues.push('WORKING_IDS_INVALID');
 if(['single','village','group'].includes(result.scope)&&!result.scopeIds.length){result.scope='region';issues.push('WORKING_SCOPE_EMPTY');}
 if(['single','village'].includes(result.scope)&&result.scopeIds.length!==1){result.scope='region';result.scopeIds=[];issues.push('WORKING_SCOPE_CARDINALITY');}
 try{
  const candidate={...defaultConfig(),...value.config};delete candidate.manurePhosphorus;
  validateConfig(candidate);
  if(!['balanced','income','water','environment','food'].includes(candidate.objective))throw Error('objective');
  if(candidate.spatialRainfall){const selected=new Set(selectedFarms(dataset,result.scope,result.scopeIds).map(f=>f.id));prepareSpatialRainfall(candidate.spatialRainfall,dataset.plots.filter(p=>selected.has(p.farmId)));}
  result.config=candidate;
 }catch{issues.push('WORKING_CONFIG_INVALID');}
 if(dataset.plots.some(plot=>plot.id===value.selectedPlot))result.selectedPlot=value.selectedPlot;
 return result;
}
