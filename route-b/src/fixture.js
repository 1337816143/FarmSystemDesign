/** Entire fixture is deliberately synthetic. No county, farm or crop-database row is located or weighted. */
export const FIXTURE_VERSION='synthetic-two-strata-v1';
const menu=(id,label,landClass,labor,water,margin,grain,vegetable,n,p,outputN,outputP)=>({id,label,landClass,areaHa:1,laborHours:labor,waterM3:water,grossMarginCny:margin,productsKg:{grain,vegetable},externalN:n,externalP:p,harvestN:outputN,harvestP:outputP,origin:'synthetic',source:'Hand-constructed software verification case; no coefficients borrowed from Hainan or the 198-row crop catalogue',phd1CandidateId:null,agronomicStatus:'synthetic-prescreened',commitment:'uncommitted'});
export function defaultInput(){return {
 schema:'FarmSystemDesign.HainanMenus',schemaVersion:1,datasetVersion:FIXTURE_VERSION,evidence:'synthetic',
 periods:['模拟期1','模拟期2'],inferenceScope:'hypothetical-systems',representativeness:{status:'absent',source:null},
 accounting:{currency:'CNY synthetic price-year 2026',nutrients:'kg elemental N / kg elemental P',margin:'revenue minus synthetic included variable costs; excludes fixed assets, household welfare and transition costs',time:'Two synthetic resource windows; not an empirical Hainan calendar'},
 strata:[
  {id:'alpha',label:'合成层 α · 第一季劳力紧',landClass:'alpha-land',count:1,areaHa:1,laborCapacity:[80,80],waterAccess:[100,100],waterSourceId:'shared',origin:'synthetic',
  menus:[menu('a-peak','旺季集中','alpha-land',[120,20],[90,30],2400,600,1200,80,20,45,12),menu('a-balanced','时段均衡','alpha-land',[70,70],[65,65],2100,800,800,55,13,40,9),menu('a-low','低投入','alpha-land',[55,60],[35,40],1500,500,600,35,9,25,6)]},
  {id:'beta',label:'合成层 β · 共用水源',landClass:'beta-land',count:1,areaHa:1,laborCapacity:[80,80],waterAccess:[100,100],waterSourceId:'shared',origin:'synthetic',
  menus:[menu('b-water','用水集中','beta-land',[60,65],[80,50],2300,900,400,65,16,42,10),menu('b-balanced','均衡配置','beta-land',[65,60],[45,65],1800,700,400,45,11,32,7),menu('b-low','低投入','beta-land',[50,50],[25,35],1400,500,300,30,8,22,5)]}
 ],
 waterSources:[{id:'shared',label:'合成共享水源',capacity:[130,160],origin:'synthetic'},{id:'independent',label:'第二个合成水源',capacity:[100,100],origin:'synthetic'}],
 constraints:{minProductsKg:{grain:1000,vegetable:0},maxExternalN:130,maxExternalP:35},
 social:{status:'not-measured',statement:'No stakeholder acceptance has been measured. User-defined bounds are scenario assumptions, not elicited preferences.'},
 objectives:[{key:'grossMarginCny',direction:'max'},{key:'externalN',direction:'min'},{key:'waterTotal',direction:'min'}]
};}
