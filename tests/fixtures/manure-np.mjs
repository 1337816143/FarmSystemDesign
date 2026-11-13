import {defaultConfig,baselineAllocation,areaHa} from '../../src/data.js';
const binding=(id,p,cap)=>({farmId:id,recoveredManureP:p,remainingApplicationCapacityP:cap,provenance:'synthetic',source:'explicit hand-constructed counterexample, not a Hainan observation'});
const contract=bindings=>({schema:'FarmSystemDesign.ManurePhosphorusContract',schemaVersion:1,period:'2025-Q1',unit:'kg elemental P',bindings});
export function fixture(){
  const square=(id,farmId,crop,targetArea,x)=>{
    const y=18,width=targetArea/areaHa([[x,y],[x+1,y],[x+1,y+.001],[x,y+.001],[x,y]]);
    const geometry={type:'Polygon',coordinates:[[[x,y],[x+width,y],[x+width,y+.001],[x,y+.001],[x,y]]]};
    return {id,name:id,farmId,crop,areaHa:areaHa(geometry.coordinates[0]),soilFactor:1,locked:false,geometry,geometrySource:'synthetic',provenance:'synthetic'};
  };
  const farms=['donor','receiver'].map((id,i)=>({id,name:id,center:[109+i*.01,18],villageId:'V',water:[1e6,1e6,1e6],labour:[1e6,1e6,1e6],poultry:i===0?400:0,provenance:'synthetic'}));
  const data={schemaVersion:1,crs:'EPSG:4326',version:'synthetic-np-counterexample-1',center:[109,18],extent:[108.9,17.9,109.1,18.1],villages:[{id:'V',name:'synthetic',center:[109,18]}],farms,
    plots:[square('D','donor','cover',1,109),square('R','receiver','legume',.45,109.01)]};
  const manurePhosphorus=contract([binding('donor',28.6,0),binding('receiver',0,10)]);
  return {data,ids:farms.map(f=>f.id),allocation:baselineAllocation(data.plots),config:{...defaultConfig(),mode:'cooperative',manurePhosphorus}};
}

