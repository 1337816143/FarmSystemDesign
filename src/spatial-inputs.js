/** Admission of an optional public rainfall input. Context is never a crop/rights/parameter inference. */
import {hash} from './data.js';
export const SPATIAL_INPUT_PATH='./data/derived/spatial-inputs-2025.json';
export const geometryFingerprint=plot=>hash({type:plot.geometry?.type,coordinates:plot.geometry?.coordinates});
const fail=reason=>{throw new Error(`Spatial rainfall unavailable: ${reason}`);};
const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-8;
const equalPoint=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===2&&b.length===2&&a.every((v,i)=>close(v,b[i]));
export function prepareSpatialRainfall(contract,plots){
  if(!contract||contract.schema!=='FarmSystemDesign.SpatialInputContract'||contract.schemaVersion!==1
    ||contract.version!=='spatial-inputs-2025-r1'||contract.periodYear!==2025||contract.geometryCRS!=='EPSG:4326'
    ||contract.admittedModelVariable!=='precipitationMmMonth'||contract.units!=='mm/month'
    ||!Array.isArray(contract.bindings)||!Array.isArray(contract.sources))fail('unsupported contract');
  const bindings=new Map(),sources=new Map();
  for(const b of contract.bindings){if(!b?.plotId||bindings.has(b.plotId))fail('duplicate or missing plot binding');bindings.set(b.plotId,b);}
  for(const s of contract.sources){if(!s?.path||sources.has(s.path)||!/^[a-f0-9]{64}$/.test(s.sha256||''))fail('invalid source identity');sources.set(s.path,s);}
  const rainByPlot=new Map(),cells=new Set();
  for(const p of plots){
    const b=bindings.get(p.id);
    if(!b||b.geometryFingerprint!==geometryFingerprint(p)||!equalPoint(b.representativePoint,p.representativePoint)||!close(b.areaHa,p.areaHa))fail(`binding mismatch for ${p.id}`);
    if(!Array.isArray(b.rainfall)||b.rainfall.length!==12)fail(`12 monthly observations required for ${p.id}`);
    for(let i=0;i<12;i++){
      const o=b.rainfall[i],s=sources.get(o?.sourceRef),m=sources.get(s?.metadataPath);
      if(o?.period!==`2025-${String(i+1).padStart(2,'0')}`||o.units!=='mm/month'||o.status!=='available'||!Number.isFinite(o.value)||o.value<0)fail(`missing, invalid or misaligned rainfall for ${p.id}`);
      if(!s||s.role!=='model-input'||s.crs!=='EPSG:4326'||m?.dataset!=='CHIRPS v3 final monthly precipitation'||m.period!==o.period||m.units!==o.units||!Array.isArray(s.bounds)||s.bounds.length!==4||!s.bounds.every(Number.isFinite)
        ||!Number.isSafeInteger(s.width)||!Number.isSafeInteger(s.height)||s.width<1||s.height<1)fail(`invalid spatial support for ${p.id}`);
      const [w,south,e,n]=s.bounds,[x,y]=b.representativePoint,dx=(e-w)/s.width,dy=(n-south)/s.height;
      if(!close(dx,.05)||!close(dy,.05)||x<w||x>=e||y<=south||y>n)fail(`outside native grid for ${p.id}`);
      const col=Math.floor((x-w)/dx),row=Math.floor((n-y)/dy),cell=[w+col*dx,n-(row+1)*dy,w+(col+1)*dx,n-row*dy];
      if(o.row!==row||o.column!==col||!Array.isArray(o.cellBounds)||o.cellBounds.length!==4||!o.cellBounds.every((v,j)=>close(v,cell[j])))fail(`cell mismatch for ${p.id}`);
      if(i===0)cells.add(`${o.sourceRef}:${row}:${col}`);
    }
    rainByPlot.set(p.id,b.rainfall.map(o=>o.value));
  }
  return {rainByPlot,summary:{version:contract.version,dataset:contract.rainfallDataset,units:contract.units,periodYear:2025,
    plotCount:plots.length,uniqueGridCells:cells.size,nativeResolutionDegrees:[.05,.05],sampling:contract.sampling,
    use:'optional historical sensitivity; no field calibration',contextModelUse:'none'}};
}
export function spatialInputStatus(contract,plots){
  if(!contract)return {ready:false,reason:'The public spatial input contract has not loaded'};
  try{return {ready:true,...prepareSpatialRainfall(contract,plots).summary};}
  catch(error){return {ready:false,reason:error.message};}
}
