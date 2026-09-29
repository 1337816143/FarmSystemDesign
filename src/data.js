/** Deterministic, explicitly synthetic data. Never use these values as farm measurements. */
export const VERSION = '0.1.0';
export const DATA_VERSION = 'demo-2026-09-29-v1';
export const MODEL_VERSION = 'screening-0.1.0';
export const ORIGIN = [109.17,18.38];
export const SOURCES = {
  power: 'https://power.larc.nasa.gov/docs/services/api/temporal/monthly/',
  osm: 'https://www.openstreetmap.org/copyright',
  gibs: 'https://nasa-gibs.github.io/gibs-api-docs/',
  repository: 'https://github.com/1337816143/FarmSystemDesign'
};
export const CROPS = {
  rice:{name:'水稻',color:'#83ae78',revenue:23500,cost:8500,water:9200,labour:55,nNeed:145,nHarvest:80,nFix:0,energy:65,yield:5.5,risk:.16,waterCurve:[.36,.43,.21],labourCurve:[.32,.21,.47],annual:true},
  vegetable:{name:'露地蔬菜',color:'#d7aa5e',revenue:64000,cost:28500,water:5200,labour:105,nNeed:230,nHarvest:115,nFix:0,energy:25,yield:23,risk:.32,waterCurve:[.22,.43,.35],labourCurve:[.22,.34,.44],annual:true},
  legume:{name:'豆科作物',color:'#a698c2',revenue:17500,cost:6100,water:3100,labour:40,nNeed:40,nHarvest:65,nFix:70,energy:34,yield:2.4,risk:.10,waterCurve:[.25,.45,.30],labourCurve:[.25,.25,.50],annual:true},
  cover:{name:'覆盖 / 休养',color:'#bdc7a1',revenue:0,cost:1800,water:900,labour:10,nNeed:0,nHarvest:0,nFix:15,energy:0,yield:0,risk:0,waterCurve:[.4,.4,.2],labourCurve:[.6,.1,.3],annual:true},
  orchard:{name:'多年生果园',color:'#5b9980',revenue:48000,cost:21000,water:4000,labour:72,nNeed:165,nHarvest:72,nFix:0,energy:32,yield:11,risk:.24,waterCurve:[.3,.4,.3],labourCurve:[.2,.35,.45],annual:false},
  pond:{name:'水产塘',color:'#76a9c2',revenue:58000,cost:34500,water:6200,labour:48,nNeed:0,nHarvest:80,nFix:0,feedN:200,energy:22,yield:2.8,risk:.2,waterCurve:[.34,.33,.33],labourCurve:[.25,.25,.50],annual:false}
};
export const ANNUALS = ['rice','vegetable','legume','cover'];
export const METRICS = [
  ['margin','核算收益','元','max'],['water','灌溉 / 补水量','m³','min'],['labour','劳动需求','工日','min'],
  ['nSurplus','系统氮盈余代理','kg N','min'],['energy','可食能量代理','GJ','max']
];
export const SCENARIOS = {
  normal:{name:'基准条件',water:1,labour:1,rain:1,price:1,shock:0},
  drought:{name:'供水受限',water:.68,labour:1,rain:.55,price:1,shock:.15},
  market:{name:'蔬菜价格下跌',water:1,labour:1,rain:1,price:.65,shock:0},
  labour:{name:'劳动力短缺',water:1,labour:.70,rain:1,price:1,shock:0}
};
export function rng(seed=20260929){return ()=>{seed|=0;seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export const round=(x,d=2)=>Number(x.toFixed(d));
export function areaHa(ring){
  // Chamberlain–Duquette spherical polygon area, appropriate for small demo polygons; WGS84 coordinates.
  let sum=0; const r=Math.PI/180;
  for(let i=0;i<ring.length-1;i++){const [a,b]=ring[i],[c,d]=ring[i+1];sum+=(c-a)*r*(2+Math.sin(b*r)+Math.sin(d*r));}
  return Math.abs(sum*6371008.8**2/2)/10000;
}
export function centroid(plot){const p=plot.geometry.coordinates[0].slice(0,-1);return [p.reduce((s,x)=>s+x[0],0)/p.length,p.reduce((s,x)=>s+x[1],0)/p.length];}
export function makeDemo(){
  const rand=rng(),farms=[],plots=[],villages=[
    {id:'V01',name:'示例村落 A',center:[109.154,18.369]},
    {id:'V02',name:'示例村落 B',center:[109.173,18.386]},
    {id:'V03',name:'示例村落 C',center:[109.195,18.374]}
  ];
  for(let v=0;v<3;v++) for(let f=0;f<4;f++){
    const i=v*4+f,id=`F${String(i+1).padStart(2,'0')}`,x=villages[v].center[0]+(f%2)*.0055,y=villages[v].center[1]+Math.floor(f/2)*.0045;
    const farm={id,name:`示例${i%4===0?'农场':'农户'} ${String(i+1).padStart(2,'0')}`,villageId:villages[v].id,kind:i%4===0?'farm':'household',representative:i===1,provenance:'synthetic',poultry:i%3===0?180: i%3===1?80:0,water:[],labour:[],center:[x,y],note:'虚拟经营主体，不对应现实居民；所有资源禀赋为演示假设。'};
    let totalArea=0;
    for(let j=0;j<3;j++){
      const lon=x+j*.00135,lat=y+(j%2)*.00165,dx=.00105+rand()*.00018,dy=.0011+rand()*.00016;
      const ring=[[lon,lat],[lon+dx,lat+.00008],[lon+dx*.96,lat+dy],[lon-.00007,lat+dy*.9],[lon,lat]];
      const fixed=j===2&&i%3!==2, crop=fixed?(i%3===0?'orchard':'pond'):ANNUALS[(i+j)%3];
      const area=areaHa(ring);totalArea+=area;
      plots.push({id:`P${String(i*3+j+1).padStart(2,'0')}`,farmId:id,name:`地块 ${String(i*3+j+1).padStart(2,'0')}`,geometry:{type:'Polygon',coordinates:[ring]},areaHa:round(area,4),crop,locked:fixed,soilFactor:round(.84+rand()*.28),slopeDeg:round(1+rand()*12),soilN:round(.6+rand()*.65),provenance:'synthetic',geometrySource:'synthetic',updatedAt:'2025-01-01',note:fixed?'多年生 / 水产单元固定，搜索中不允许零成本转为年生作物。':'地块位置与边界为虚拟演示，不是实际地籍或遥感解译。'});
    }
    farm.water=[.33,.34,.33].map(w=>round(totalArea*6900*(.83+rand()*.38)*w));
    farm.labour=[.3,.28,.42].map(w=>round(totalArea*85*(.78+rand()*.44)*w));
    farms.push(farm);
  }
  return {schemaVersion:1,version:DATA_VERSION,crs:'EPSG:4326',provenance:'synthetic',studyLabel:'海南 · 崖州附近演示窗口（非已确认研究区）',center:ORIGIN,extent:[109.13,18.345,109.235,18.407],villages,farms,plots,updatedAt:'2026-09-29',notes:'地理背景真实；示例经营主体、村落分组、地块、土壤和经营参数全部虚拟。'};
}
export function defaultConfig(){return {mode:'independent',quarter:0,scenario:'normal',water:1,labour:1,rain:1,price:1,shock:0,minIncomeRatio:0,objective:'balanced',samples:1600,seed:20260929};}
export function baselineAllocation(plots){return Object.fromEntries(plots.map(p=>[p.id,p.crop]));}
export function selectedFarms(data,scope,ids=[]){
  if(scope==='region')return data.farms;
  if(scope==='village')return data.farms.filter(f=>ids.includes(f.villageId));
  if(scope==='typical')return [data.farms.find(f=>f.representative)||data.farms[0]].filter(Boolean);
  return data.farms.filter(f=>ids.includes(f.id));
}
export function validateDataset(d){
  const errors=[];
  if(!d||d.schemaVersion!==1||d.crs!=='EPSG:4326')return ['需要 schemaVersion=1、crs=EPSG:4326 的项目数据。'];
  if(!Array.isArray(d.farms)||!Array.isArray(d.plots)||!Array.isArray(d.villages))return ['缺少 farms / plots / villages 数组。'];
  if(!d.farms.length||!d.plots.length||d.farms.length>300||d.plots.length>600)return ['本原型支持 1–300 个主体、1–600 个地块。'];
  const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=85;
  if(!validPoint(d.center))errors.push('研究窗口 center 应为有效WGS84经纬度');
  if(!Array.isArray(d.extent)||d.extent.length!==4||!d.extent.every(Number.isFinite)||d.extent[0]>=d.extent[2]||d.extent[1]>=d.extent[3])errors.push('研究窗口 extent 无效');
  if(!d.villages.length||new Set(d.villages.map(v=>v.id)).size!==d.villages.length)errors.push('村落 ID 缺失或重复');
  for(const v of d.villages)if(typeof v.id!=='string'||!v.id||typeof v.name!=='string'||!validPoint(v.center))errors.push('村落名称、ID或中心点无效');
  const ids=new Set(),pids=new Set(),vids=new Set(d.villages.map(v=>v.id));
  for(const f of d.farms){
    if(typeof f.id!=='string'||!f.id||ids.has(f.id))errors.push('经营主体 ID 缺失或重复');ids.add(f.id);
    if(typeof f.name!=='string'||f.name.length>120||!validPoint(f.center))errors.push(`${f.id} 名称或中心点无效`);
    if(!vids.has(f.villageId))errors.push(`${f.id} 村落关联不存在`);
    for(const field of ['water','labour'])if(!Array.isArray(f[field])||f[field].length!==3||f[field].some(v=>!Number.isFinite(v)||v<0))errors.push(`${f.id} ${field} 应为3个月的非负数数组`);
    if(!Number.isFinite(f.poultry)||f.poultry<0||f.poultry>1e7)errors.push(`${f.id} poultry 无效`);
    if(!['synthetic','user-unverified','observed'].includes(f.provenance))errors.push(`${f.id} 缺少数据身份`);
  }
  for(const p of d.plots){
    if(typeof p.id!=='string'||!p.id||pids.has(p.id))errors.push('地块 ID 缺失或重复');pids.add(p.id);
    if(typeof p.name!=='string'||p.name.length>120)errors.push(`${p.id} 名称无效`);
    if(!['synthetic','user-unverified','observed'].includes(p.provenance)||!['synthetic','user-unverified','observed'].includes(p.geometrySource))errors.push(`${p.id} 缺少数据或几何身份`);
    if(!ids.has(p.farmId))errors.push(`${p.id} 经营主体不存在`);
    if(!CROPS[p.crop])errors.push(`${p.id} 不支持的活动类型`);
    if(!Number.isFinite(p.areaHa)||p.areaHa<=0||p.areaHa>1e5)errors.push(`${p.id} 面积无效`);
    if(!Number.isFinite(p.soilFactor)||p.soilFactor<.1||p.soilFactor>3)errors.push(`${p.id} soilFactor 应为0.1–3`);
    if(typeof p.locked!=='boolean')errors.push(`${p.id} 缺少 locked`);
    const rings=p.geometry?.coordinates, r=rings?.[0];
    if(p.geometry?.type!=='Polygon'||rings?.length!==1||!Array.isArray(r)||r.length<4||r.length>2000){errors.push(`${p.id} 仅支持无洞的简单 Polygon`);continue;}
    if(r.some(c=>!Array.isArray(c)||c.length!==2||!c.every(Number.isFinite)||Math.abs(c[0])>180||Math.abs(c[1])>85)||r[0][0]!==r.at(-1)[0]||r[0][1]!==r.at(-1)[1])errors.push(`${p.id} WGS84坐标无效或环未闭合`);
    else if(Math.abs(areaHa(r)-p.areaHa)/p.areaHa>.12)errors.push(`${p.id} 属性面积与几何面积差异超过12%`);
  }
  for(const f of d.farms)if(!d.plots.some(p=>p.farmId===f.id))errors.push(`${f.id} 没有地块（当前原型要求每个主体至少一块地）`);
  return [...new Set(errors)];
}
export function toGeoJSON(data){return {type:'FeatureCollection',name:'FarmSystemDesign plots',metadata:{crs:'EPSG:4326',dataVersion:data.version,disclaimer:data.notes},features:data.plots.map(({geometry,...properties})=>({type:'Feature',id:properties.id,properties,geometry}))};}
export function hash(obj){let h=2166136261;for(const c of JSON.stringify(obj)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
export function climateForQuarter(climate,quarter){
  const records=climate?.records||[], result=[];
  for(let m=quarter*3;m<quarter*3+3;m++){
    const row=records.find(r=>r.month===`2025-${String(m+1).padStart(2,'0')}`);
    result.push(row&&Number.isFinite(row.precipitationMmMonth)?row.precipitationMmMonth:null);
  }
  return result;
}
