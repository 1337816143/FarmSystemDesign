/** Explanatory metadata only. The accounting engine must not import this module. */
const bilingual=(zh,en)=>({zh,en});
const allMetrics=['margin','water','labour','nSurplus','energy'];
const period=bilingual(
  '所选经营主体合计；单次合成三个月窗口。合成系数直接用于该窗口，并非把年度系数除以4。季度仅选择2025年相应三个月的降雨；没有跨期状态结转。',
  'Total across selected actors in one synthetic three-month window. Synthetic coefficients are applied directly to that window, not divided from annual coefficients. Quarter selects the corresponding three rainfall months of 2025; there is no state carryover between windows.'
);
const science=()=>({
  grade:'D',status:'implemented-simplified-screening',calibration:'uncalibrated',
  coefficientOrigin:'synthetic',literatureParameterAdoption:false,literatureFormulaAdoption:false,
  summary:bilingual('D：已实现的简化筛选核算；生产系数为合成、未经校准。代码可执行不等于实测有效、论文模型复现或科学验证。',
    'D: implemented simplified screening accounting with synthetic, uncalibrated production coefficients. Executable code does not establish empirical validity, reproduction of a published model, or scientific validation.')
});
const basis=(unit,quantity)=>({unit,quantity,aggregation:'sum',spatial:'selected-actors',periodMonths:3,
  periodKind:'synthetic-model-window',normalization:'none',coefficientTreatment:'applied-directly-to-window',
  hoursPerWorkday:null,valueTransform:'identity'});
const commonMissing=bilingual(
  '不从文献或缺失观测自动补入生产系数。无效活动、重复/不存在的主体会报错；非有限核算总值会报错。已提供的合成假设不因此变成观测数据。',
  'No production coefficients are filled from literature or missing observations. Invalid activities and duplicate/unknown actors raise errors; non-finite accounting totals raise errors. Supplied synthetic assumptions do not become observations.'
);
const noSpatialState=bilingual('主体选择与共享分组定义核算边界；不计算距离、邻接、径流连通或土壤/存量跨期变化。',
  'Actor selection and sharing groups define the accounting boundary; distance, adjacency, runoff connectivity, and soil/stock changes across periods are not calculated.');
const refs=section=>['farm-current-metric-definitions','farm-screening-evaluate','farm-screening-coefficients','farm-screening-ranking',`paper-liang-indicator-audit-${section}`];

export const METRIC_CONTRACTS=[
  {
    id:'margin',field:'totals.margin',label:bilingual('核算收益','Accounting margin'),
    unit:{symbol:'CNY',...bilingual('元','CNY')},basis:basis('CNY','accounting-margin'),period,
    definition:bilingual('所选主体在合成三个月窗口内的收入减模型计入的成本，单位元；不按公顷、人或年度归一化。',
      'Revenue minus model-accounted costs across selected actors in the synthetic three-month window, in CNY; not normalized by hectare, person, or year.'),
    boundary:bilingual('收入含地块活动与家禽合成收入。成本含活动基础成本、家禽基础成本、化肥氮、水、劳动与内部粪肥运输费。每个主体先核算，再合计。',
      'Revenue includes synthetic plot-activity and poultry revenue. Costs include activity and poultry base costs, chemical N, water, labour, and internal manure-transfer charges. Actor accounts are calculated first, then summed.'),
    exclusions:[
      bilingual('不等于家庭净收入、会计净利润或论文的年度每公顷毛利；不含非农收入、家庭消费以及未定义的固定资本折旧、税费和融资账项。',
        'Not household net income, accounting net profit, or the paper’s annual per-hectare gross margin. Off-farm income, household consumption, and undefined fixed-capital depreciation, tax, and financing accounts are absent.'),
      bilingual('劳动按统一合成费率计价，未区分家庭/雇佣劳动；活动基础成本没有逐项凭证，不能据此确认与另加投入成本不存在重叠。',
        'Labour is priced at one synthetic rate without distinguishing family from hired labour. Activity base costs have no itemized evidence, so overlap with separately charged inputs has not been ruled out.'),noSpatialState
    ],
    missingHandling:[commonMissing,bilingual('缺失降雨按0 mm核算补水，并通过水费影响收益；该替代有警示，不代表真实天气。',
      'Missing rainfall is treated as 0 mm for supplemental water accounting and therefore affects water costs and margin; a warning identifies this assumption, which is not actual weather.')],
    execution:{status:'implemented',codeRefs:['src/model.js:evaluate (L36, L43–59, L75–77)','src/data.js:CROPS'],
      equations:['plotRevenue = c.revenue * areaHa * yieldFactor * priceFactor','plotBaseCost = c.cost * areaHa','poultryRevenue = poultry * 28; poultryBaseCost = poultry * 16','actorCost += chemicalN * 8 + water * 0.35 + labour * 100 + transferCost','actorMargin = actorRevenue - actorCost; totals.margin = sum(actorMargin)'],
      summary:bilingual('产出因子为soilFactor × max(0.35, 1 − shock × risk × 2)；仅蔬菜收入乘价格情景因子。化肥、水和劳动等成本按当前代码追加。',
        'The output factor is soilFactor × max(0.35, 1 − shock × risk × 2); only vegetable revenue receives the price-scenario factor. Chemical N, water, and labour costs are added as implemented in the current code.')},
    science:science(),evidenceRefs:refs('s2'),ranking:{direction:'max',transform:'identity',
      summary:bilingual('Pareto比较与收益偏好排序使用核算收益；参与底线也比较主体核算收益，不代表家庭福利约束。',
        'Pareto comparison and income-preference ranking use accounting margin. Participation floors also compare actor accounting margin, not household welfare.')}
  },
  {
    id:'water',field:'totals.water',label:bilingual('灌溉 / 补水量','Irrigation / supplemental water'),
    unit:{symbol:'m³',...bilingual('立方米','cubic metres')},basis:basis('m3','supplemental-water-demand'),period,
    definition:bilingual('三个月内经简化降雨折减后的地块补水需求，加家禽用水，再对所选主体求和，单位m³。',
      'Plot supplemental-water demand after a simplified rainfall reduction over three months, plus poultry water use, summed across selected actors in m³.'),
    boundary:bilingual('每月按活动需水曲线分配合成需水量，减降雨×情景因子×10×简化有效系数，最低截为0，再乘公顷面积；水产塘系数为0.15，其他活动为0.35。',
      'Each month allocates synthetic activity demand with its water curve, subtracts rainfall × scenario factor × 10 × a simplified effective fraction, clips at zero, then multiplies by hectares. The fraction is 0.15 for ponds and 0.35 for other activities.'),
    exclusions:[bilingual('不等于地下水净消耗、取水实测、蒸散发或完整水量平衡；没有识别水源，也没有地下水补给、深层渗漏、回流水或输水损失核算。',
      'Not groundwater depletion, measured withdrawals, evapotranspiration, or a complete water balance. Water sources, groundwater recharge, deep percolation, return flows, and conveyance losses are not accounted for.'),
      bilingual('供水情景因子config.water只缩放供水约束；降雨因子config.rain改变该需求。总量可满足仍可能存在月度超限。',
        'The supply scenario config.water scales capacity constraints only; config.rain changes this demand. A sufficient window-total capacity can still conceal a monthly constraint violation.'),noSpatialState],
    missingHandling:[commonMissing,bilingual('climateForQuarter找不到月份或月降雨非有限时返回null；核算用0 mm并保留警示。负有限降雨未在该提取函数内单独筛除，不应视为已通过气象质控。',
      'climateForQuarter returns null for an absent month or non-finite monthly rainfall; accounting uses 0 mm with a warning. Finite negative rainfall is not separately filtered by that extractor, so extraction is not meteorological quality control.')],
    execution:{status:'implemented',codeRefs:['src/model.js:evaluate (L34–35, L45, L49, L53–55, L70–78)','src/data.js:CROPS; climateForQuarter'],
      equations:['plotWaterMonth = max(0, c.water * c.waterCurve[m] - (rain[m] ?? 0) * config.rain * 10 * (activity === "pond" ? 0.15 : 0.35)) * areaHa','poultryWaterMonth = poultry * 0.07 / 3','totals.water = sum(selected actors, three waterMonths)'],
      summary:bilingual('10用于mm·ha到m³的量纲换算；0.15/0.35是当前代码的合成简化系数，未从论文的地下水补给关系采纳。家禽三个月总用水为每单位家禽0.07 m³。',
        'The factor 10 converts mm·ha to m³. The current code’s synthetic simplification factors 0.15/0.35 are not adopted from the paper’s groundwater-recharge relationship. Poultry demand totals 0.07 m³ per poultry unit over the three months.')},
    science:science(),evidenceRefs:refs('s5'),ranking:{direction:'min',transform:'identity',
      summary:bilingual('Pareto比较与节水偏好排序最小化补水需求；不据此声称地下水消耗下降。',
        'Pareto comparison and water-preference ranking minimize supplemental demand; this does not establish reduced groundwater depletion.')}
  },
  {
    id:'labour',field:'totals.labour',label:bilingual('劳动需求','Labour demand'),
    unit:{symbol:'workdays',...bilingual('工日','workdays')},basis:basis('workday','labour-demand'),period,
    definition:bilingual('地块活动的合成工日需求按三个月劳动曲线分配，加家禽工日，再对所选主体求和。每工日小时数未定义。',
      'Synthetic plot-activity workdays distributed by a three-month labour curve, plus poultry workdays, summed across selected actors. Hours per workday are undefined.'),
    boundary:bilingual('劳动需求由活动系数×面积决定；家禽窗口需求为每单位家禽0.04工日、平均分到三个月。劳动情景只缩放月度供给能力，不缩放需求。',
      'Activity coefficients × area determine demand. Poultry demand is 0.04 workdays per poultry unit per window, split evenly over three months. The labour scenario scales monthly capacity, not demand.'),
    exclusions:[bilingual('不得默认8小时/工日，也不得直接与h/ha/year相加或比较；未区分家庭、雇佣、性别、技能、具体工序或日/周劳动峰值。',
      'Do not assume eight hours per workday or directly add/compare this with h/ha/year. Family/hired work, gender, skills, specific operations, and daily/weekly peaks are not distinguished.'),
      bilingual('少用工不直接代表更高就业、可接受性或社会福利；模型只检验月度资源约束。',
        'Less labour does not directly establish better employment, acceptability, or social welfare; the model checks monthly resource constraints only.'),noSpatialState],
    missingHandling:[commonMissing,bilingual('工日时长保持未定义，不从论文平均工时补齐。月度能力数组来自输入；缺失值不会自动变成可用劳力。',
      'Workday duration remains undefined and is not filled from the paper’s average working times. Monthly capacity arrays come from inputs; missing values are not automatically available labour.')],
    execution:{status:'implemented',codeRefs:['src/model.js:evaluate (L36, L46, L49, L53–56, L70–78)','src/data.js:CROPS'],
      equations:['plotLabourMonth = c.labour * c.labourCurve[m] * areaHa','poultryLabourMonth = poultry * 0.04 / 3','totals.labour = sum(selected actors, three labourMonths)'],
      summary:bilingual('当前输出是工日总量，且以每工日100元的合成费率计入成本；不执行小时换算。',
        'The output is total workdays, also charged to costs at a synthetic CNY 100 per workday; no conversion to hours is executed.')},
    science:science(),evidenceRefs:refs('s4'),ranking:{direction:'min',transform:'identity',
      summary:bilingual('劳动需求参与五指标Pareto支配比较及月度约束；当前偏好加权分数不单列劳动权重。',
        'Labour demand participates in five-metric Pareto dominance and monthly constraints; the current preference-weighted score has no separate labour weight.')}
  },
  {
    id:'nSurplus',field:'totals.nSurplus',label:bilingual('氮收支余量（保留正负）','Nitrogen balance (signed)'),
    unit:{symbol:'kg N',...bilingual('千克氮','kilograms of nitrogen')},basis:basis('kg N','external-boundary-nitrogen-balance'),period,
    definition:bilingual('所选主体外部边界的氮投入减氮带出，单位kg N，保留正负。内部主体之间的粪肥转移在总边界相消；只在决策比较中使用余量绝对值。',
      'Nitrogen entering minus nitrogen leaving the external boundary of selected actors, in kg N, preserving sign. Manure transfers among selected actors cancel at the total boundary; only decision comparisons use absolute balance.'),
    boundary:bilingual('外部投入含化肥氮、饲料氮和固氮；外部带出为作物/水产与家禽的合成收获氮。主体账含转入/转出，总nInput/nOutput改用外部流量。回收粪肥的内部循环通过有效率抵减化肥需求。',
      'External inputs are chemical N, feed N, and fixation; outputs are synthetic harvest N from crops/aquaculture and poultry. Actor accounts include transfers; total nInput/nOutput use external flows. Internal recovered manure offsets chemical-N demand through an availability factor.'),
    exclusions:[bilingual('不是氮损失、NH₃挥发、NO₃淋溶、N₂O排放或温室效应；未估算各损失路径。负值可能表示土壤存量消耗或参数不一致，不能解释为零环境负担。',
      'Not nitrogen loss, NH₃ volatilization, NO₃ leaching, N₂O emissions, or climate impact; individual loss pathways are not estimated. A negative value can indicate soil-stock depletion or parameter inconsistency, not zero environmental burden.'),
      bilingual('未建模外购粪肥、沉降、完整土壤氮库与实际损失。kg N不能与kg NH₃或kg N₂O未经元素换算直接混加。',
        'Imported manure, deposition, complete soil-N stocks, and actual losses are not modeled. Do not add kg N to kg NH₃ or kg N₂O without elemental conversion.'),noSpatialState],
    missingHandling:[commonMissing,bilingual('活动未定义feedN时按0计入；这是现有代码的缺省值，不是零饲料氮观测。负余量被保留并给出警示，不截为0。',
      'An activity without feedN contributes zero through the existing code default; this is not an observation of zero feed N. Negative balances are retained and warned about, not clipped to zero.')],
    execution:{status:'implemented',codeRefs:['src/model.js:distributeManure (L11–27)','src/model.js:evaluate (L36, L48, L52–61, L75–76)','src/model.js:dominates; rankResults; search (L86–97, L129)','src/data.js:CROPS'],
      equations:['chemicalN = max(0, nNeed - manureApplied * 0.45)','externalNInput = chemicalN + nFeed + nFix; externalNOutput = nHarvest','actorNSurplus = externalNInput + nTransferIn - externalNOutput - nTransferOut','totals.nSurplus = sum(actorNSurplus) = totals.nInput - totals.nOutput','comparisonValue = abs(totals.nSurplus); storedValue = totals.nSurplus'],
      summary:bilingual('家禽合成系数：饲料氮0.4、收获氮0.12、产粪氮0.22 kg N/单位家禽，回收率0.65；粪肥有效率0.45。它们是当前实现中的合成假设。',
        'Synthetic poultry coefficients are 0.4 feed N, 0.12 harvest N, and 0.22 manure N kg per poultry unit, with recovery 0.65 and manure availability 0.45. These are assumptions of the current implementation.')},
    science:science(),evidenceRefs:refs('s6'),ranking:{direction:'min',transform:'absolute-value',
      summary:bilingual('Pareto支配、范围归一化和环境偏好排序使用abs(nSurplus)；总值、导出和科学解释仍必须保留正负。绝对值接近0不是排放验证。',
        'Pareto dominance, range normalization, and environment-preference ranking use abs(nSurplus). Totals, exports, and scientific interpretation must preserve sign. Near-zero absolute balance is not emissions validation.')}
  },
  {
    id:'energy',field:'totals.energy',label:bilingual('可食能量代理','Edible-energy proxy'),
    unit:{symbol:'GJ',...bilingual('吉焦','gigajoules')},basis:basis('GJ','edible-energy-production-proxy'),period,
    definition:bilingual('活动能量合成系数×面积×产出因子，加家禽合成能量，再对所选主体求和，单位GJ；属于生产侧可食能量代理。',
      'Synthetic activity energy coefficient × area × output factor, plus synthetic poultry energy, summed across selected actors in GJ; a production-side edible-energy proxy.'),
    boundary:bilingual('产出因子为soilFactor × max(0.35, 1 − shock × risk × 2)。当前代码直接使用活动energy系数，不用yieldTonnes乘已验证食物成分表。',
      'The output factor is soilFactor × max(0.35, 1 − shock × risk × 2). The current code uses activity energy coefficients directly, not yieldTonnes multiplied by a verified food-composition table.'),
    exclusions:[bilingual('不等于家庭食物安全、实际膳食摄入、营养均衡、可负担性或可获得性；未扣损耗、非食用份额、销售/饲用分流或加工差异。',
      'Not household food security, actual dietary intake, nutritional balance, affordability, or access. Losses, inedible fractions, sale/feed diversions, and processing differences are not deducted.'),
      bilingual('不按人口、面积或年度归一化；不能直接等同论文的GCal/ha/year膳食能量产出。',
        'Not normalized by population, area, or year; not directly equivalent to the paper’s dietary-energy yield in GCal/ha/year.'),noSpatialState],
    missingHandling:[commonMissing,bilingual('没有实测食物能量时仍明确保留合成代理身份；不从论文谷物能量值给其他活动补参数。',
      'Without measured food-energy data, the output retains its synthetic-proxy status; the paper’s cereal energy values do not fill coefficients for other activities.')],
    execution:{status:'implemented',codeRefs:['src/model.js:evaluate (L36, L43–50, L75)','src/data.js:CROPS'],
      equations:['plotEnergy = c.energy * areaHa * yieldFactor','poultryEnergy = poultry * 0.008','totals.energy = sum(selected plotEnergy) + sum(selected poultryEnergy)'],
      summary:bilingual('合成energy系数直接用于三个月窗口，家禽系数为0.008 GJ/单位家禽；不做年度系数除以4处理。',
        'Synthetic energy coefficients apply directly to the three-month window, with poultry at 0.008 GJ per poultry unit; annual coefficients are not divided by four.')},
    science:science(),evidenceRefs:refs('s3'),ranking:{direction:'max',transform:'identity',
      summary:bilingual('Pareto比较和内部名为food的偏好最大化此代理；该偏好名不构成食物安全指标。',
        'Pareto comparison and the preference internally named food maximize this proxy; that preference name does not make it a food-security indicator.')}
  }
];

const sourceAdoption=()=>({parameters:false,formulas:false,optimizerInputs:false});
const paperCommit='d949f4dce1d7d867e7fae41fabb6734e75cdb831';
const paperLedgerSha256='a82e8b59fdaca3466cfdfdb95a8a3a75928f4d55b720cb8735c5f64d19dfb020';
const paperSections=[
  ['margin','s2','毛利：定义与成本边界','Gross margin: definition and cost boundary','§2.4.1；式1；p4-b8-037e5d5、p4-b12-83a7f4d；价格需Table S2','USD/ha/year'],
  ['water','s5','地下水消耗：不等同补水需求','Groundwater depletion: distinct from supplemental demand','§2.4.3.1；式4–5；p4-b27-e569563、p4-b31-e43de45、p4-b39-58315bf','mm/year'],
  ['labour','s4','劳动工时：时长与活动边界','Labour hours: duration and activity boundary','§2.4.2.2；式3；p4-b19-a1da0a3、p4-b25-bebef67；工时参数需Table S3','h/ha/year'],
  ['nSurplus','s6','氮损失：不等同氮收支余量','Nitrogen loss: distinct from nitrogen balance','§2.4.3.2；式6；p4-b40-1a79b71、p4-b45-8e951a2','kg N/ha/year'],
  ['energy','s3','膳食能量产出：代理与边界','Dietary-energy yield: proxy and boundary','§2.4.2.1；式2；p4-b14-f9e0859、p4-b18-814df8a','GCal/ha/year']
];

export const EVIDENCE_REFS=[
  {
    id:'farm-current-metric-definitions',sourceId:'farm-current-contracts',kind:'definition',relationship:'documents-current-code',
    title:bilingual('Farm当前指标口径说明','Farm current metric definitions'),url:'https://github.com/1337816143/FarmSystemDesign/blob/main/docs/METRIC_CONTRACTS.md',fallbackUrl:null,
    locator:'src/metric-contracts.js:METRIC_CONTRACTS; docs/METRIC_CONTRACTS.md',metricIds:[...allMetrics],
    verification:{identity:'repository-local',content:'checked-against-current-code',science:'not-validation'},
    summary:bilingual('说明现有代码实际核算什么；不提供新参数或新公式。实现身份以运行记录中的引擎清单为准。',
      'Describes what the existing code calculates; supplies no new parameters or formulas. The run’s engine manifest records implementation identity.'),adoption:sourceAdoption()
  },
  {
    id:'farm-screening-evaluate',sourceId:'farm-screening-model',kind:'executed-code',relationship:'implements-current-accounting',
    title:bilingual('Farm现有核算实现','Farm existing accounting implementation'),url:'https://github.com/1337816143/FarmSystemDesign/blob/7ca7d99927d307aef06f594d5d5fe28c552af26a/src/model.js',fallbackUrl:null,
    locator:'src/model.js:distributeManure (L11–27); evaluate (L29–84)',metricIds:[...allMetrics],
    verification:{identity:'run-engine-manifest',content:'code-inspected',science:'uncalibrated'},
    summary:bilingual('当前执行定义来自evaluate及粪肥分配；代码可复核不意味着田间有效性。',
      'The executed definitions come from evaluate and manure distribution; inspectable code does not establish field validity.'),adoption:sourceAdoption()
  },
  {
    id:'farm-screening-coefficients',sourceId:'farm-screening-data',kind:'executed-code',relationship:'supplies-synthetic-coefficients',
    title:bilingual('Farm合成活动系数与降雨提取','Farm synthetic activity coefficients and rainfall selection'),url:'https://github.com/1337816143/FarmSystemDesign/blob/7ca7d99927d307aef06f594d5d5fe28c552af26a/src/data.js',fallbackUrl:null,
    locator:'src/data.js:CROPS; ANNUALS; climateForQuarter; src/model.js:evaluate inline coefficients',metricIds:[...allMetrics],
    verification:{identity:'run-engine-manifest',content:'code-inspected',science:'synthetic-uncalibrated'},
    summary:bilingual('CROPS及model.js内联常数是当前执行参数；不是从下列论文账本读取。公开降雨的来源身份不会校准生产系数。',
      'CROPS and inline model.js constants are the current executed parameters; they are not read from the paper ledger below. Public-rainfall provenance does not calibrate production coefficients.'),adoption:sourceAdoption()
  },
  {
    id:'farm-screening-ranking',sourceId:'farm-screening-model',kind:'executed-code',relationship:'implements-current-decision-comparison',
    title:bilingual('Farm现有Pareto与偏好排序','Farm existing Pareto and preference ranking'),url:'https://github.com/1337816143/FarmSystemDesign/blob/7ca7d99927d307aef06f594d5d5fe28c552af26a/src/model.js',fallbackUrl:null,
    locator:'src/model.js:dominates (L86–89); rankResults (L92–102); search range (L129)',metricIds:[...allMetrics],
    verification:{identity:'run-engine-manifest',content:'code-inspected',science:'not-validation'},
    summary:bilingual('五指标参与支配比较；偏好分数另有显式权衡，氮使用绝对值。排序不能提升指标的科学等级。',
      'Five metrics enter dominance comparison; preference scores add explicit trade-offs and use absolute N balance. Ranking does not upgrade a metric’s scientific status.'),adoption:sourceAdoption()
  },
  ...paperSections.map(([metric,sectionId,zh,en,locator,literatureUnit])=>({
    id:`paper-liang-indicator-audit-${sectionId}`,sourceId:'liang-indicator-audit',kind:'background',relationship:'background-not-adopted',
    title:bilingual(zh,en),url:`https://1337816143.github.io/Paper/#/liang-indicator-audit/${sectionId}`,
    fallbackUrl:`https://1337816143.github.io/Paper/read/liang-indicator-audit.html#${sectionId}`,
    locator,locatorEn:locator.replaceAll('；','; ').replaceAll('工时参数需','labour parameters require ').replaceAll('价格需','prices require ').replaceAll('式','Eq. '),metricIds:[metric],literatureUnit,
    sourceIdentity:{site:'Paper',version:'5.5.2',commit:paperCommit,path:'content/indicator-audit-v53.json',
      ledgerId:'liang-indicator-audit',sectionId,gitBlob:'939dc6ba198a91e0abcbf976a509d64d9cb22ebb',sha256:paperLedgerSha256},
    originalSource:{id:'liang-2022',doi:'10.1016/j.agsy.2022.103471',url:'https://doi.org/10.1016/j.agsy.2022.103471',
      sha256:'bfbde3ef50d61598c5aa73a5ff6d02141f1d7473ae446b0f73f88e6bbef0ef47',pages:15,
      checksumEvidence:'existing-original-source-audit',scope:bilingual('仅原论文主文；不自动涵盖补充材料、全部公式或参数表。',
        'Main article only; supplementary material and all formula or parameter tables are not automatically covered.')},
    verifiedScope:{body:'previous-review-recorded-not-repeated-here',formulas:'locators-recorded-not-independently-reproduced',appendix:'not-covered-by-main-article-identity',parameters:'not-adopted-or-validated-for-Hainan',authorEngineRun:'not-performed'},
    verification:{identity:'matched-to-audited-paper-release',content:'ledger-section-and-locator-inspected',
      route:'source-checked-not-live-browser-checked',originalPageReview:'not-repeated-in-this-increment',science:'background-only'},
    summary:bilingual('文献背景与口径对照，未采纳到Farm计算。原论文的单位、边界和方法与当前合成三个月合计不同；原件或账本校验值证明字节身份，不证明模型已复现。',
      'Literature background and definition comparison, not adopted into Farm calculations. The paper’s units, boundaries, and methods differ from the current synthetic three-month totals. Original/ledger checksums identify bytes, not reproduction of the model.'),
    adoption:sourceAdoption()
  }))
];

/** Exact declared-basis comparison only: no conversion, empirical validation, or actor/date identity check. */
export function metricBasesCompatible(left,right){
  const fields=['unit','quantity','aggregation','spatial','periodMonths','periodKind','normalization','coefficientTreatment','hoursPerWorkday','valueTransform'];
  const valid=value=>value&&typeof value==='object'&&!Array.isArray(value)&&
    fields.every(key=>Object.hasOwn(value,key))&&
    fields.filter(key=>!['periodMonths','hoursPerWorkday'].includes(key)).every(key=>typeof value[key]==='string'&&value[key].length>0)&&
    Number.isFinite(value.periodMonths)&&value.periodMonths>0&&
    (value.hoursPerWorkday===null||(Number.isFinite(value.hoursPerWorkday)&&value.hoursPerWorkday>0));
  return Boolean(valid(left)&&valid(right)&&fields.every(key=>left[key]===right[key]));
}
