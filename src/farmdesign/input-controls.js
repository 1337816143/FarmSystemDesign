/** Presentation contracts verified against the 4.21.5 author forms and manual.
 * Values are converted only on an explicit edit; untouched native strings stay intact.
 */
import {esc} from '../utils.js';
import {pair,fieldPair,fieldUnit,unitLabel,termPair} from './i18n.js';
export const NATIVE_MODULES=[
 ['作物面积与轮作','Crop areas and rotations'],['产品去向与进出口','Product destinations and trade'],['动物饲料平衡','Animal feed balance'],['有机质平衡','Organic matter balance'],['粪肥与化肥','Manures and fertilizers'],['农药','Pesticides'],['生物能','Bioenergy'],['农场养分收支','Farm nutrient balance'],['碳循环','Carbon cycle'],['氮循环','Nitrogen cycle'],['磷循环','Phosphorus cycle'],['钾循环','Potassium cycle'],['灌溉水供需','Irrigation water balance'],['劳动供需','Labour balance'],['经营收益与成本','Farm economics'],['家庭预算','Household budget'],['温室气体','Greenhouse gases'],['家庭营养','Human nutrition'],['物质流网络','Flow network metrics']
];
const FRACTIONS={FRM:new Set(['ProportionCH4inBiogas','BioEnergyMicrobialEff','NLossDigestionEP','NLossDigestateAppl','DigestateHumifCoeff','Residue_N2O_EF','Fixation_N2O_EF','Deposition_N2O_EF'])};
const HELP={
 Modules:['勾选决定原版 Explain 中显示的模块；上下箭头调整顺序。后台仍保留原版带正负号的模块编码。','Check the modules to display in the original Explain window; arrows change their order. Signed native module codes are retained.'],
 FoodGroups:['按食物组填写家庭食物消费模式。原版窗体单位为克鲜重/消费单位/天；0是当前设置值，不是实测结论。内部“None”占位项保留。','Set the household food-consumption pattern by group. The original form uses g fresh weight/consumer unit/day. Zero is a setting, not an observed conclusion. The internal None placeholder is retained.'],
 NLossDigestionEP:['进入厌氧消化过程的无机氮损失比例。此处显示百分比；例如1%在原版数据中保存为0.01。0%是核算假设。','Fraction of inorganic nitrogen lost during anaerobic digestion. This control shows percent: 1% is stored as native 0.01. Zero is an accounting assumption.'],
 IntakeSystem:['饲料采食量评价体系。SV 表示饱和采食值。体系对应不同需要量公式与参数；也可在原版“设置 → 计算 → 饲料评价”中选择。','Feed-intake evaluation system. SV means saturation value. Systems use different requirement equations and coefficients; they can also be chosen in original Settings → Calculations → Feed evaluation.'],
 EnergySystem:['饲料能量评价体系：NE 为净能，ME 为代谢能，TDN 为可消化养分总量或消化率。须与能量单位及饲养参数配套。','Feed-energy evaluation: NE means net energy, ME metabolizable energy, and TDN total digestible nutrients or digestibility. Keep the unit and feeding coefficients consistent.'],
 EnergyUnit:['能量单位。VEM 和 kVEM 为荷兰净能体系单位；kJ、MJ 为千焦、兆焦，kCal、MCal 为千卡、兆卡。相关能量参数须使用相同单位。','Energy unit. VEM and kVEM belong to the Dutch net-energy system; kJ/MJ are kilojoules/megajoules and kCal/MCal are kilocalories/megacalories. Related energy coefficients must use the same unit.'],
 ProteinSystem:['蛋白评价体系：DVE 为小肠可消化蛋白，CP 为粗蛋白。它们使用不同的营养需要量和饲料参数，不能只改代码。','Protein evaluation: DVE means intestinally digestible protein, CP crude protein. They use different requirements and feed coefficients; changing the code alone is insufficient.'],
 CalculateDMD:['选择是否由饲料能量推算干物质消化率；关闭时使用提供的消化率参数。','Choose whether dry-matter digestibility is derived from feed energy; otherwise the supplied digestibility is used.'],
 FullSelfSupply:['保持产品各用途比例，并随自产量联动。关闭时用途量可独立于产量，差额形成进出口。','Keep the proportions between product uses and scale them with own production. Otherwise uses are independent and balances determine trade.'],
};
export function inputDescription(table,key,catalog={}){
 const property=catalog.fieldMap?.[table]?.properties?.[key]||key;
 return HELP[key]||null;
}
export function isFraction(table,key,catalog={}){
 if(FRACTIONS[table]?.has(key))return true;
 const property=catalog.fieldMap?.[table]?.properties?.[key]||key,meta=catalog.labels?.describe?.[property];
 return meta?.SIUnit==='-'&&/\bfraction\b/i.test(meta.Explanation||'');
}
export function inputHelpMarkup(table,key,catalog,language){
 const custom=inputDescription(table,key,catalog),property=catalog.fieldMap?.[table]?.properties?.[key]||key,meta=catalog.labels?.describe?.[property];
 const known=custom?pair(...custom,language):null;
 return `${known?`<small class="fd-input-help">${esc(known)}</small>`:''}${meta?.Explanation?`<details class="fd-native-explanation"><summary>${pair('原作者字段说明','Author field definition',language)}</summary><p lang="en">${esc(meta.Explanation)}</p></details>`:''}`;
}
export function structuredKind(table,key,value){
 if(table==='FRM'&&key==='Modules')return 'modules';
 if(table==='FRM'&&key==='FoodGroups')return 'food';
 if(['FarmLaborString','HerdLaborString','MethaneEmissionString','RegularLaborString','CasualLaborString','InPastureString','InYardString','OffFarmString','GrazingPeriodString','FarmManagementString'].includes(key)&&typeof value==='string'&&value.includes('@'))return 'vector';
 return null;
}
export function structuredInput(table,key,raw,document,language){
 const t=(zh,en)=>pair(zh,en,language),parts=String(raw??'').split('@'),kind=structuredKind(table,key,raw);
 if(kind==='modules'){
  const rows=parts.map((v,index)=>({id:Number(v),raw:v,index})).filter(row=>row.raw!=='');
  return `<div class="fd-module-editor">${rows.map(({id,index})=>`<div class="fd-module-row"><label><input type="checkbox" data-fd-encoded="${key}" data-index="${index}" ${id>0?'checked':''}>${esc(NATIVE_MODULES[Math.abs(id)-1]?t(...NATIVE_MODULES[Math.abs(id)-1]):t('原版模块编号','Native module ID')+' '+Math.abs(id))}</label><button type="button" data-fd-reorder="${key}" data-index="${index}" data-offset="-1" ${index===0?'disabled':''} aria-label="${t('上移','Move up')}">↑</button><button type="button" data-fd-reorder="${key}" data-index="${index}" data-offset="1" ${index===rows.length-1?'disabled':''} aria-label="${t('下移','Move down')}">↓</button></div>`).join('')}</div>`;
 }
 if(kind==='food'){
  const groups=(document.tables.DRF||[]).filter(row=>row.DrfID>0).sort((a,b)=>a.DrfID-b.DrfID);
  return `<div class="fd-table-scroll"><table class="fd-food-editor"><thead><tr><th>${t('食物组','Food group')}</th><th>${t('每日食用量','Daily consumption')}<small>${t('克鲜重/消费单位/天','g fresh/consumer unit/day')}</small></th></tr></thead><tbody>${groups.map(row=>{const [zh,en]=foodName(row.FoodGroup);return `<tr><td>${esc(t(zh,en))}</td><td><input type="number" min="0" step="any" data-fd-encoded="${key}" data-index="${row.DrfID}" value="${esc(parts[row.DrfID]??'0')}"></td></tr>`;}).join('')}</tbody></table></div>`;
 }
 const values=parts.filter((v,index)=>index<parts.length-1||v!==''),boolean=values.every(v=>/^(true|false)$/i.test(v));
 return `<div class="fd-vector-editor"><p>${t('原版分时段输入','Native time-period inputs')} · ${values.length} ${t('个时段','periods')}</p><div class="fd-vector-grid">${values.map((value,index)=>`<label><span>${t('时段','Period')} ${index+1}</span><input ${boolean?`type="checkbox" ${/^true$/i.test(value)?'checked':''}`:`type="number" step="any" value="${esc(value)}"`} data-fd-encoded="${key}" data-index="${index}"></label>`).join('')}</div></div>`;
}
const FOOD_ZH={'Cereals':'谷物','White roots and tubers':'白色根茎类','Vitamin A rich vegetables and tubers':'富含维生素A的蔬菜与块茎','Dark green leafy vegetables':'深绿色叶菜','Other vegetables':'其他蔬菜','Vitamin A rich fruits':'富含维生素A的水果','Other fruits':'其他水果','Organ meat':'动物内脏','Flesh meats':'肉类','Eggs':'蛋类','Fish and seafood':'鱼和海产品','Legumes, nuts and seeds':'豆类、坚果与种子','Milk and milk products':'奶与奶制品','Oils and fats':'油脂','Red palm oil':'红棕榈油','Sweets':'糖果甜食','Spices, condiments, beverages':'香辛料、调味品与饮料','None':'未分类'};
function foodName(name){const native=termPair(name);return [FOOD_ZH[name]||FOOD_ZH[String(name).replaceAll('-',' ')]||(native[0]!==name?native[0]:name),name];}
export function editEncoded(raw,kind,index,value){
 const parts=String(raw??'').split('@');if(!Number.isInteger(index)||index<0||index>500)throw Error('Invalid native vector index');
 if(kind==='modules'){
  const id=Number(parts[index]);if(!Number.isInteger(id)||!id)throw Error('Invalid signed native module ID');parts[index]=String(Math.abs(id)*(value?1:-1));
 }else if(typeof value==='boolean'){parts[index]=value?'True':'False';}
 else{if(typeof value!=='number'||!Number.isFinite(value)||kind==='food'&&value<0)throw Error('Invalid native period or food value');while(parts.length<=index)parts.push('0');parts[index]=String(value);}
 return parts.join('@');
}
export function reorderModules(raw,index,offset){const parts=String(raw).split('@'),target=index+offset;if(!Number.isInteger(index)||![-1,1].includes(offset)||target<0||target>=parts.length||parts[target]==='')return raw;[parts[index],parts[target]]=[parts[target],parts[index]];return parts.join('@');}
