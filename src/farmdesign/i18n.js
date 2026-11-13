// Presentation only. Native identifiers, data values, units and calculations are unchanged.
const parse = text => Object.fromEntries(text.trim().split('\n').map(line => line.split('|')));
export const FIELD_ZH = Object.freeze(parse(`
ActiveIngredients|有效成分含量
ActiveOM|活性有机质比例
Age|年龄
Amount|数量
AnimalCosts|畜牧成本
AnmID|畜群编号
AnmNumber|畜群数量
ApplicationLoss|施用损失率
ApplicationRate|施用量
AppliedNitrogen_N2O_EF|施氮氧化亚氮排放因子
AprID|畜产品编号
Area|面积
ArrID|畜群替换关系编号
AshContent|灰分含量
BeddingSupplied|垫料供应量
BioEnergyMicrobialCtoN|生物能微生物碳氮比
BioEnergyMicrobialEff|生物能微生物转化效率
BirthYear|出生年份
BldID|建筑编号
BldNumber|建筑数量
BodyWeight|体重
Breed|品种
BulkDensity|土壤容重
CPMaintenance|维持需要的粗蛋白
Calcium|钙
CalculateDMD|计算干物质消化率
Carbohydrates|碳水化合物
Carcass|胴体产量
CarcassPrice|胴体价格
CasualLaborInput|临时劳动投入
CasualLaborString|临时劳动时间分配
CasualLabour|临时劳动
CasualLabourPrice|临时劳动单价
CfrID|作物肥料关系编号
CmrID|作物粪肥关系编号
ConsumerUnits|消费当量
ContractWorkCosts|外包作业费用
Copper|铜
Costs|成本
CprID|作物农药关系编号
Crop_CH4_EF|作物甲烷排放因子
CrpID|作物编号
Currenc|货币
DMContent|干物质含量
DVE|小肠可消化蛋白
DegradationRateAnoxic|缺氧条件下降解率
DegradationRateEP|能源生产降解率
DegradationRateOxic|有氧条件下降解率
Deposition_N2O_EF|沉降氮氧化亚氮排放因子
Depreciation|折旧
Description|说明
DietaryEnergy|膳食能量
DietaryFiber|膳食纤维
DigestateHumifCoeff|沼液沼渣腐殖化系数
DrfID|膳食食物组参考编号
DriID|膳食营养素参考编号
EDMFactor|有效干物质系数
EcnID|经济参数编号
EffOrganicMatter|有效有机质
EnergyFireWood|薪柴能量
EnergyRequirement|能量需要量
EnergySystem|能量评价体系
EnergyUnit|能量单位
Enteric_CH4_EF|肠道甲烷排放因子
EnvID|环境参数编号
ErosionAmount|侵蚀量
ErosionCFactor|侵蚀碳系数
ErosionKContent|侵蚀物钾含量
ErosionNContent|侵蚀物氮含量
ErosionOmContent|侵蚀物有机质含量
ErosionPContent|侵蚀物磷含量
ExcretionLoss|排泄损失率
Expenditures|支出
FarmLaborString|农场劳动时间分配
FarmManagementString|农场管理时间分配
Fat|脂肪
FatContent|脂肪含量
FeedEvaluationSystem|饲料评价体系
FeedLoss|饲料损失
Fixation_N2O_EF|固氮氧化亚氮排放因子
Folate|叶酸
FoodGroup|食物组
FoodGroups|食物组
FractionBeddingMaterial|垫料比例
FractionMineralNitrogen|矿质氮比例
FractionNonGrazPeriod|非放牧期比例
FractionNonShootNfixation|非地上部固氮比例
FractionOxic|有氧分解比例
FractionShootNfixation|地上部固氮比例
FractionToBiogas|用于沼气的比例
FractionToFirewood|用作薪柴的比例
FractionToSoil|还田比例
FreshPrice|鲜重单价
FreshYield|鲜重产量
FrmID|农场编号
FrtID|肥料编号
FullSelfSupply|完全自给
GcrID|分组作物关系编号
Gender|性别
GeneralCosts|一般经营费用
GrazingPeriodString|放牧期时间分配
GrpID|作物组编号
HerdLaborString|畜群劳动时间分配
HhdID|家庭编号
HiredCasualLabor|雇用临时劳动
HiredRegularLabor|雇用固定劳动
HmrID|家庭成员编号
HumificationCoeff|腐殖化系数
InPastureString|在牧场时间分配
InYardString|在畜舍时间分配
IntakeSystem|采食量评价体系
InterestRate|利率
Iron|铁
IrrigationWater|可用灌溉水量
KContent|钾含量
KDeposition|钾沉降量
KValue|土壤供钾指标
LabourFarmConstant|农场固定劳动量
LabourHerdConstant|畜群固定劳动量
LandCostsPerHa|每公顷土地费用
Length|长度
LengthGrazingPeriod|放牧期长度
Lime|石灰用量
LivestockUnits|标准牲畜单位
LowerBoundaryDDS|膳食多样性计分下限
LowerBoundaryNFD|营养功能多样性计分下限
LowerHeatingValueCH4|甲烷低位热值
MEMaintenance|维持需要的代谢能
Magnesium|镁
ManID|粪肥编号
Manganese|锰
ManureNitrogen_N2O_EF|粪肥氮氧化亚氮排放因子
Manure_CH4_EF|粪肥甲烷排放因子
MarketableProportion|可销售比例
MchID|机械编号
MchNumber|机械数量
MeanTemperature|平均温度
MethaneEmissionString|甲烷排放时间分配
MicrobialCNAnoxic|缺氧微生物碳氮比
MicrobialCNOxic|有氧微生物碳氮比
MicrobialEffAnoxic|缺氧微生物转化效率
MicrobialEffOxic|有氧微生物转化效率
MineralNLossAnoxic|缺氧条件下矿质氮损失率
MineralNLossOxic|有氧条件下矿质氮损失率
Modules|启用模块
MoistPeriodPf35|湿润期长度
NContent|氮含量
NDeposition|氮沉降量
NFixation|固氮量
NLossDigestateAppl|消化产物施用氮损失率
NLossDigestionEP|厌氧消化氮损失率
Name|名称
Niacin|烟酸
NonSymbFixation|非共生固氮量
OEB|瘤胃降解蛋白平衡
OEB2|瘤胃降解蛋白平衡第二指标
OMContent|有机质含量
OffFarmLaborInput|非农劳动投入
OffFarmLabourPrice|非农劳动单价
OffFarmString|非农劳动时间分配
OmDegradationRate|有机质降解率
OperationalCosts|运行费用
OtherAnimalCosts|其他畜牧费用
OtherLabourCosts|其他劳动费用
PContent|磷含量
PDeposition|磷沉降量
Pension|养老金
Phosphorus|磷
Potassium|钾
PrdID|作物产品编号
Price|价格
ProducedAtSite|场内生产
ProductType|产品类型
Production|产量
ProportionAtSite|场内停留比例
ProportionCH4inBiogas|沼气甲烷比例
Protein|蛋白质
ProteinContent|蛋白质含量
ProteinRequirement|蛋白质需要量
ProteinSystem|蛋白质评价体系
PstID|农药编号
Pw|土壤供磷指标
RcrID|轮作作物关系编号
RegularLaborInput|固定劳动投入
RegularLaborString|固定劳动时间分配
RegularLabour|固定劳动
RegularLabourPrice|固定劳动单价
Remittances|汇款收入
RepID|替换畜群编号
ReplacementRate|畜群替换率
Residue_N2O_EF|残体氮氧化亚氮排放因子
Riboflavin|核黄素
RootShootRatio|根冠比
RotID|轮作编号
STRFactor|结构系数
SaturationValue|饱和值
ScoreComplexity|复杂程度评分
ScoreEffort|劳动强度评分
ScoreRisk|风险评分
ScoreSatisfaction|满意度评分
Sex|性别
Sodium|钠
SoilDepth|土层深度
SoilPh|土壤酸碱度
SoilType|土壤类型
SpeciesNumber|物种数量
SpeciesProportions|物种比例
Status|状态
StructureValue|饲料结构值
Subsidies|补贴
Sulfur|硫
TDN|干物质消化率
TextureFactor|质地系数
Tiamin|硫胺素
ToAnimals|用于饲喂
ToBedding|用作垫料
ToBurning|用于焚烧
ToEnergyProduction|用于能源生产
ToFireWood|用作薪柴
ToHomeUse|供家庭使用
ToSoil|用于还田
VEM|乳牛净能单位
VEVI|育肥牛净能单位
VitaminA|维生素A
VitaminB12|维生素B12
VitaminB6|维生素B6
VitaminC|维生素C
VitaminD|维生素D
VitaminE|维生素E
Volatilization_N2O_EF|挥发氮氧化亚氮排放因子
WaterDemand|需水量
Weight|重量
Whereabouts|所在位置
Zinc|锌
_Number|数量
`));

export const OUTPUT_ZH = Object.freeze({...FIELD_ZH, ...parse(`
OrganicMatterBalance|有机质平衡
PerFarm|每农场
PerHa|每公顷
Per1000m3|每千立方米
Inputs|输入
Outputs|输出
Balance|收支平衡
CropResidues|作物残体
GreenManure|绿肥
Manure|粪肥
AddedManure|投入粪肥
ManureBreakdown|粪肥分解
SomBreakdown|土壤有机质分解
Erosion|侵蚀
Cfactor|碳系数
CFactor|碳系数
OverviewRotations|轮作总览
WholeFarmCropAreas|全场作物面积
CropProdUse|作物产品用途
DMYield|干物质产量
FeedGrazing|放牧期饲料
FeedNonGraz|非放牧期饲料
LeftOnField|田间保留
Bedding|垫料
BeddingSupply|垫料供应
BeddingRequired|垫料需要
BeddingBalance|垫料平衡
HomeUse|家庭使用
Burning|焚烧
FireWood|薪柴
SelfSupply|自给
Correction|修正
FeedBalance|饲料平衡
GrazingPeriod|放牧期
NonGrazingPeriod|非放牧期
DryMatter|干物质
Intake|采食量
Energy|能量
Structure|饲料结构
Available|可用量
Required|需要量
Deviation|供需偏差
Total|合计
LabourBalance|劳动平衡
RequiredLabour|劳动需要
AvailableLabour|可用劳动
BalanceLabour|劳动余量
FarmLabour|农场劳动
HerdLabour|畜群劳动
CropLabour|作物劳动
OwnLabour|自有劳动
FamilyLabor|家庭劳动
HiredLabor|雇用劳动
HouseholdAvailableTime|家庭可用时间
HouseholdAvailableWorkTime|家庭可用劳动时间
HouseholdFarmLabor|家庭农场劳动
HouseholdOffFarmLabor|家庭非农劳动
HouseholdLeisureTime|家庭休闲时间
ManureProductionLosses|粪肥生产与损失
CompositionAfterApplication|施用后组成
StorageBreakdownLosses|储存分解损失
DM|干物质
OM|有机质
C|碳
N|氮
P|磷
K|钾
MineralN|矿质氮
OrganicN|有机氮
NLossExcretion|排泄氮损失
NReleaseStor|储存氮释放
NLossStorage|储存氮损失
CLossStorage|储存碳损失
ProportionOfTotal|占总量比例
NLossFirewood|薪柴氮损失
CLossFirewood|薪柴碳损失
AmountBedding|垫料数量
ToBiogas|用于沼气
ToFirewood|用作薪柴
ToExport|用于输出
AmountSold|销售量
AvailableForSoil|可还田量
RequiredForSoil|还田需要量
DeviationForSoil|还田供需偏差
TotalDM|干物质总量
DmPerHa|每公顷干物质
NPerHa|每公顷氮
PPerHa|每公顷磷
KPerHa|每公顷钾
NLossApplic|施用氮损失
CLossField|田间碳损失
NutrientBalanceAndFlows|养分平衡与流量
Ckgha|每公顷碳千克数
Nkgha|每公顷氮千克数
Pkgha|每公顷磷千克数
Kkgha|每公顷钾千克数
InputsKgHa|每公顷输入量
OutputsKgHa|每公顷输出量
BalanceKgHa|每公顷收支差
AllFlowsKgHa|每公顷全部流量
CropReturns|作物收入
AmountUsed|使用量
AmountProduced|生产量
PurchaseSaleBalance|购销平衡
SelfSupplyRate|自给率
Returns|收入
CropMargins|作物毛利
CropName|作物名称
Margin|毛利
AnimalReturns|畜牧收入
AnimalMargins|畜牧毛利
FeedCosts|饲料费用
BeddingCosts|垫料费用
InterestCosts|利息费用
OtherCosts|其他费用
MarginsCostsProfit|毛利成本与利润
Totals|合计
GrossMarginCrops|作物总毛利
GrossMarginAnimals|畜牧总毛利
EquipmentCosts|机械设备费用
BuildingCosts|建筑费用
CasualLabourCosts|临时劳动费用
RegularLabourCosts|固定劳动费用
HomeConsumption|家庭自用价值
OperatingProfit|经营利润
OperatingProfitPerHa|每公顷经营利润
OwnLabourCosts|自有劳动费用
ReturnToLabour|劳动报酬
Interest|利息
CheckDecisionVariables|决策变量检查
Minimum|下限
Maximum|上限
Value|数值
CheckObjectivesConstraints|目标与约束检查
OverviewDecisionVariables|决策变量总览
OverviewObjConstraints|目标与约束总览
ImportCrops|作物产品输入
Fixation|固氮
ImportManure|粪肥输入
ExportCropProducts|作物产品输出
ExportAnimalProducts|畜产品输出
UptakeCrops|作物吸收
CropProductsToAnimals|作物产品用于饲喂
AnimalProductsToAnimals|畜产品用于饲喂
FeedToAnimals|饲料进入畜群
AnimalIntake|动物采食
AnimalRespiration|动物呼吸
AnimalsToManure|畜群形成粪肥
OwnManure|场内粪肥
Importmanure|粪肥输入
TotalManure|粪肥总量
SoilLosses|土壤损失
Volatilization|挥发
Immobilization|固持
WaterBalance|水供需偏差
WaterPerCrop|分作物用水
RequiredWater|需水量
AvailableWater|可用水量
Digestibility|消化率
ExportManure|粪肥输出
TotalLosses|损失总量
BeddingToManure|垫料进入粪肥
ManureBalance|粪肥平衡
TotalApplied|施用总量
GrossMarginCropsRisk|作物总毛利风险
ManurePerCrop|分作物粪肥
ManureName|粪肥名称
GreenManureCosts|绿肥费用
MarginPerHa|每公顷毛利
ReturnsPerHa|每公顷收入
PesticideUsage|农药使用
AmountPesticide|农药用量
PricePesticide|农药价格
PesticideBalance|农药平衡
PesticideName|农药名称
AppliedPesticide|农药施用量
AppliedActiveIngredients|有效成分施用量
TotalActiveIngredients|有效成分总量
CropArea|作物面积
PerCropPesticide|分作物农药
ManureCosts|粪肥费用
PesticideCosts|农药费用
LandCosts|土地费用
EnergyProduction|能源生产
EnergyCropResidues|作物残体能源
CropProductName|作物产品名称
CarbonAmount|碳量
ResidueC|残体碳
CH4Produced|甲烷产量
Manures|粪肥
TotalEnergy|总能量
CropsToFermentation|作物用于发酵
GreenhouseGasEmissions|温室气体排放
TotalEmissionCO2eq|温室气体总排放
GhgEmissionCrops|作物温室气体排放
GhgEmissionsAnimals|畜群温室气体排放
GhgEmissionsManures|粪肥温室气体排放
GhgEmissionsFertilizers|肥料温室气体排放
GhgEmissionsBurning|焚烧温室气体排放
EntericCH4|肠道甲烷
ManureCH4|粪肥甲烷
ManureN2OApplied|粪肥施用氧化亚氮
ManureN2ODirect|粪肥直接氧化亚氮
ManureN2OVolatiliz|粪肥挥发间接氧化亚氮
FertilizerN2OApplic|肥料施用氧化亚氮
CropCH4|作物甲烷
CO2eq|二氧化碳当量
N2OEmission|氧化亚氮排放
ResidueEmissionCO2eq|残体排放二氧化碳当量
FixationEmissionCO2eq|固氮排放二氧化碳当量
DepositionEmissionCO2eq|沉降排放二氧化碳当量
AnimalProductImportToHousehold|购入畜产品供家庭使用
ExportAnimalManure|畜群粪肥输出
ExportHouseholdManure|家庭粪肥输出
CropProductsToManure|作物产品进入粪肥
CropProductsToFermentation|作物产品用于发酵
CropProductsToHousehold|作物产品供家庭使用
AnimalProductsToHousehold|畜产品供家庭使用
HouseholdToManure|家庭进入粪肥
HouseholdRespiration|家庭呼吸
HumanNutritionIndicators|家庭营养指标
DietaryDiversityScore|膳食多样性评分
FoodGroupDeviations|食物组供需偏差
NutrientDeviations|营养素供需偏差
MagnesiumRatio|镁比例
Demand|需要量
Supply|供应量
FoodGroupDemand|食物组需要
FoodGroupSupply|食物组供应
NutrientDemand|营养素需要
NutrientSupply|营养素供应
HouseholdSize|家庭规模
NumberHouseholdMembers|家庭成员数量
TotalIncome|总收入
TotalExpenditures|总支出
ProportionFoodCosts|食物支出比例
HouseholdBudget|家庭预算
FreeBudget|可支配预算
FarmIncome|农场收入
OffFarmIncome|非农收入
FoodCosts|食物费用
Result|结果
OtherExpenditures|其他支出
DiversityHyperVolume|多样性超体积
FunctionalDiversity|功能多样性
Produced|生产
Consumed|消费
NutrientYield|营养素产量
NutrYield|营养素产量
CropBurningLoss|作物焚烧损失
AnimalDensity|畜群密度
LivestockNumber|牲畜数量
LivestockDensity|牲畜密度
LaborHoursClasses|分组劳动小时
LaborFractionsClasses|分组劳动比例
Male|男性
Female|女性
SpeciesIndices|物种多样性指标
Efficiencies|效率
AnimalEfficiency|畜群效率
ManureEfficiency|粪肥效率
SoilCropEfficiency|土壤作物效率
FarmEfficiency|农场效率
Areas|土地与轮作
FeedBalances|分季饲料平衡
FeedSelfSupply|饲料自给
OmBalance|有机质平衡
OmBalancePerHa|每公顷有机质平衡
NutrientFlows|养分流量
NutrientFlowsPerHa|每公顷养分流量
Labour|劳动
GHGs|温室气体
WaterUse|用水
EconResults|农场经济核算
ProductAmounts|产品用途
BeddingUse|垫料使用
ManureProd|粪肥生产
Nutrition|家庭营养
Budget|经营与家庭预算
NutrientFlowMatrix|养分流网络
Pesticides|农药
FlowMetrics|流网络指标
FarmSize|农场面积
RotationSize|轮作面积
GroupArea|作物组面积
CropID|作物编号
ManureID|粪肥编号
Yield|产量
YieldPerHa|每公顷产量
YieldPer1000m3|每千立方米产量
WaterRequired|需水量
WaterRequiredPerHa|每公顷需水量
WaterAvailable|可用水量
WaterAvailablePerHa|每公顷可用水量
FertilizerUses|肥料用途
FertilizerPools|肥料库
FertilizerData|肥料资料
PriceFertilizer|肥料价格
AmountFertilizer|肥料数量
ManureUses|粪肥用途
ManurePools|粪肥库
ManureData|粪肥资料
PriceManure|粪肥价格
CropManures|作物粪肥
CropMarginDict|作物毛利明细
CropReturnsDict|作物收入明细
CropNames|作物名称
CropRequirements|作物需要
AnimalReturn|畜牧收入
AmountCarbon|碳量
CarbonLossField|田间碳损失
AnimalDays|动物饲养天数
SiteDays|场内饲养天数
SelfSupplyBalances|自给平衡
SelfSupplyCorrection|自给修正
SelfSupplyTotal|自给总量
AvailableDict|可用量明细
RequiredDict|需要量明细
ToAnimalsGrazPer|放牧期饲喂量
ToAnimalsNonGraz|非放牧期饲喂量
EnergyProduced|产能量
EnergyCropProds|作物产品能源
EnergyManure|粪肥能源
TotalEnergyProduced|总产能量
ToEnergy|用于能源
Digestate|消化产物
AnimalEmissions|畜群排放
CropEmissions|作物排放
ManureEmissions|粪肥排放
FertilizerEmissions|肥料排放
SumAnimalEmission|畜群排放合计
SumCropEmission|作物排放合计
SumManureEmission|粪肥排放合计
SumFertilizerEmission|肥料排放合计
SumBurningEmission|焚烧排放合计
TotalEmissionCO2eqPerHa|每公顷温室气体总排放
DirectN2O|直接氧化亚氮
IndirectN2O|间接氧化亚氮
AppliedN2O|施用氧化亚氮
ApplicationN2O|施用氧化亚氮
DepositionEmission|沉降排放
FixationEmission|固氮排放
ResidueEmission|残体排放
ManureNitrogen_N2O_EmissionFactor|粪肥氮氧化亚氮排放因子
AppliedNitrogen_N2O_EmissionFactor|施氮氧化亚氮排放因子
Volatilization_N2O_EmissionFactor|挥发氮氧化亚氮排放因子
FarmCFactor|农场碳系数
TotalActiveIngrPerHa|每公顷有效成分总量
PesticideUses|农药用途
MaximumFoodGroupDeviation|食物组供需偏差最大值
MinimumFoodGroupDeviation|食物组供需偏差最小值
MaximumNutrientDeviation|营养素供需偏差最大值
MinimumNutrientDeviation|营养素供需偏差最小值
MaximumNutrientYield|营养素产量最大值
MinimumNutrientYield|营养素产量最小值
NutrientYields|营养素产量
FunctionalDiversityProduced|生产营养功能多样性
FunctionalDiversityConsumed|消费营养功能多样性
HyperVolumeProduced|生产多样性超体积
HyperVolumeConsumed|消费多样性超体积
TotalHouseholdIncome|家庭总收入
TotalHouseholdExpenditures|家庭总支出
LivestockUnitsPerHa|每公顷标准牲畜单位
LivestockWeight|牲畜总重量
LivestockWeightPerHa|每公顷牲畜重量
MaleAgeClassFractions|男性年龄组比例
MaleAgeClassHours|男性年龄组劳动小时
FemaleAgeClassFractions|女性年龄组比例
FemaleAgeClassHours|女性年龄组劳动小时
ShannonIndex|香农多样性指数
MargalefIndex|马加莱夫丰富度指数
HDDS|家庭膳食多样性评分
WDDS|女性膳食多样性评分
FDDS|食物组膳食多样性评分
MDDW|女性最低膳食多样性
DMD|干物质消化率
CP|粗蛋白
EDM|有效干物质
STR|饲料结构
CH4|甲烷
CO2|二氧化碳
CO|一氧化碳
N2O|氧化亚氮
NOx|氮氧化物
None|无
Regular|固定劳动
Casual|临时劳动
Period|时期
Supplied|供应量
Products|产品
Frequency|频率
Mass|质量
CheckSum|校验合计
DoShow|显示
producedFoods|生产食物
consumedFoods|消费食物
orgmatter|有机质
area|面积
values|数值
NumberCompartments|网络组分数量
NumberLinks|网络连接数量
TotalSystemThroughput|系统总通量
TotalSystemThroughflow|系统总通过流量
LinkDensity|连接密度
AvgLinkWeight|平均连接权重
AvgCompartmentThroughflow|组分平均通过流量
ConnectanceIndex_C|连接度指数
CompartimentationIndex_Cbar|分隔度指数
AvgMutualInformation_AMI|平均互信息
MaxUncert_Hmax|最大不确定性
StatUncert_Hr|统计不确定性
SystemUncert_Hsys|系统不确定性
ConditionalUncert_Dr|条件不确定性
RealizedStatUncert_AMIHr|已实现统计不确定性
ConstraintInfo_Hc|约束信息
ConstraintEfficiency_CE|约束效率
FinnCycling|芬恩循环
FinnCyclingIndex_1980|芬恩循环指数
TSTc_1976|循环总通量（1976口径）
TSTc_1980|循环总通量（1980口径）
TSTs_1976|非循环总通量（1976口径）
TSTs_1980|非循环总通量（1980口径）
APL_1980|平均路径长度（1980口径）
APLc_1976|循环平均路径长度（1976口径）
APLc_1980|循环平均路径长度（1980口径）
APLs_1976|非循环平均路径长度（1976口径）
APLs_1980|非循环平均路径长度（1980口径）
RelativeAPL_1976|相对平均路径长度（1976口径）
RelativeAPL_1980|相对平均路径长度（1980口径）
Ulanowicz|乌拉诺维茨网络指标
Patten_Higashi_1984|帕滕东氏网络指标（1984）
CapacitySystem|系统容量
CapacityInternal|内部容量
CapacityImports|输入容量
CapacityExports|输出容量
CapacityDissipations|耗散容量
AscendencySystem|系统有序度
AscendencyInternal|内部有序度
AscendencyImports|输入有序度
AscendencyExports|输出有序度
AscendencyDissipations|耗散有序度
AscCapSystem|系统有序度容量比
AscCapInternal|内部有序度容量比
AscCapImports|输入有序度容量比
AscCapExports|输出有序度容量比
AscCapDissipation|耗散有序度容量比
OverheadSystem|系统冗余
OverheadInternal|内部冗余
OverheadImports|输入冗余
OverheadExports|输出冗余
OverheadDissipations|耗散冗余
Cereals|谷物
White roots and tubers|白色根茎类
Vit. A rich vegetables and tubers|富含维生素A的蔬菜与块茎
Dark green leafy vegetables|深绿色叶菜
Other vegetables|其他蔬菜
Vitamin A rich fruits|富含维生素A的水果
Other fruits|其他水果
Organ meat|动物内脏
Flesh meats|畜禽肉
Eggs|蛋类
Fish and other seafood|鱼与其他水产品
Beans and peas|豆类
Nuts and seeds|坚果与种子
Milk and milk products|奶与奶制品
Oils and fats|油脂
Red palm oil|红棕榈油
Sweets|糖果甜食
Spices, condiments, beverages|香辛料调味品与饮料
`)});

const ENGLISH = {FrmID:'Farm ID',EnvID:'Environment ID',EcnID:'Economics ID',IntakeSystem:'Intake evaluation system',EnergySystem:'Energy evaluation system',ProteinSystem:'Protein evaluation system',CalculateDMD:'Calculate dry matter digestibility',TDN:'Dry matter digestibility',FreeBudget:'Disposable budget',MDDW:'Minimum dietary diversity for women',HDDS:'Household dietary diversity score',WDDS:'Women’s dietary diversity score',DMD:'Dry matter digestibility',CP:'Crude protein',OM:'Organic matter',DM:'Dry matter',C:'Carbon',N:'Nitrogen',P:'Phosphorus',K:'Potassium',VitaminA:'Vitamin A',VitaminB12:'Vitamin B12',VitaminB6:'Vitamin B6',VitaminC:'Vitamin C',VitaminD:'Vitamin D',VitaminE:'Vitamin E'};
export const humanize = key => ENGLISH[key] || String(key).replace(/([a-z\d])([A-Z])/g,'$1 $2').replace(/_/g,' ').trim().replace(/^./,c=>c.toUpperCase());
export function pair(zh,en,mode='zh'){return mode==='en'?en:mode==='both'&&zh!==en?`${zh} / ${en}`:zh;}
export function fieldPair(table,key,catalog={}){
 const property=catalog.fieldMap?.[table]?.properties?.[key]||key;
 const native=catalog.labels?.describe?.[property];
 return [FIELD_ZH[key]||OUTPUT_ZH[property]||`参数（${key}）`,ENGLISH[key]||native?.Description||humanize(key)];
}
export function fieldUnit(table,key,catalog={}){
 const units={Area:'ha',FreshYield:'kg fresh/ha',FreshPrice:'currency/kg fresh',DMContent:'%',NContent:'% DM',PContent:'% DM',KContent:'% DM',AshContent:'% DM',ToAnimals:'kg DM',ToSoil:'kg DM',ToHomeUse:'kg DM',ToBedding:'kg DM',ToBurning:'kg DM',ToFireWood:'kg DM',ToEnergyProduction:'kg DM',IrrigationWater:'m³/year',WaterDemand:'m³/ha',GeneralCosts:'currency/year',BodyWeight:'kg',TDN:'g/kg DM'};
 if(key in units)return table==='APR'&&key.startsWith('To')?'kg fresh':units[key];
 const property=catalog.fieldMap?.[table]?.properties?.[key]||key;
 return catalog.labels?.describe?.[property]?.SIUnit||'';
}
export function termPair(key,catalog={}){
 const native=catalog.labels?.describe?.[key];
 return [OUTPUT_ZH[key]||FIELD_ZH[key]||key,ENGLISH[key]||native?.Description||humanize(key)];
}
export function pathLabel(path,mode,catalog={}){
 const names=String(path).split('.').map(part=>{
  const match=part.match(/^([^[]+)(.*)$/);if(!match)return part;
  const [zh,en]=termPair(match[1],catalog);
  const index=match[2].replace(/\[(\d+)\]/g,(_,n)=>` [${Number(n)+1}]`);
  return {zh:zh+index,en:en+index};
 });
 const zh=names.map(n=>n.zh??n).join(' · '),en=names.map(n=>n.en??n).join(' · ');
 return pair(zh,en,mode);
}
export function metricLabel(metric,mode,catalog={}){
 const key=typeof metric==='string'?metric:String(metric.key||metric.label||'');
 if(!key.includes(':'))return pathLabel(key,mode,catalog);
 const parts=key.split(':'),property=parts.pop(),entity=parts.shift(),name=parts.join(':');
 const aliases={MixedFarm:'农场',Rotation:'轮作',Crop:'作物',CropProduct:'作物产品',Animal:'畜群',AnimalProduct:'畜产品',Economics:'经营经济',Environment:'环境',Household:'家庭',HouseholdMember:'家庭成员',Manure:'粪肥',Fertilizer:'肥料',RotationCrop:'轮作作物',BeddingBalance:'垫料平衡',CultivatedArea:'耕作面积',EconomicResults:'经济核算',EnergyFlow:'能量流',FeedBalance:'饲料平衡',GreenHouseGases:'温室气体',HouseholdBudget:'家庭预算',HumanNutrition:'家庭营养',IrrigationWater:'灌溉水核算',LabourBalance:'劳动平衡',ManureUse:'粪肥使用',OrganicMatter:'有机质',PesticideFlow:'农药流',SumArea:'面积合计',sBalance:'供需平衡',sFeed:'饲料营养量',sLabour:'劳动量',sNPK:'元素收支',sNutrientYield:'营养素产量'};
 const fixedNames={Farm:'农场',FarmArea:'农场面积',Field:'田地',Yard:'庭院','Fish pond':'鱼塘',Total:'合计',GrazingPeriod:'放牧期',NonGrazingPeriod:'非放牧期'};
 const [zh,en]=termPair(property,catalog);
 return pair(`${aliases[entity]||OUTPUT_ZH[entity]||entity}${name?' · '+(fixedNames[name]||OUTPUT_ZH[name]||name):''} · ${zh}`,`${humanize(entity)}${name?' · '+name:''} · ${en}`,mode);
}
export function unitLabel(unit,mode){
 const source=String(unit||'');
 const zh=source.replace(/year/g,'年').replace(/head/g,'头').replace(/person/g,'人').replace(/hour/g,'小时').replace(/day/g,'天').replace(/currency/g,'货币').replace(/VND/g,'越南盾').replace(/DM/g,'干物质').replace(/OM/g,'有机质').replace(/fresh/g,'鲜重');
 return pair(zh,source,mode);
}

const messages=new Map();
export function rememberPair(zh,en,mode){
 const value=[zh,en];for(const text of [zh,en,`${zh} / ${en}`])messages.set(text,value);
 return pair(zh,en,mode);
}
export function messageLabel(message,mode){
 if(!message)return '';
 const value=messages.get(message);if(value)return pair(...value,mode);
 const fixed={
  'Variable already selected':['该变量已添加','Variable already selected'],
  'Recalculate changed inputs':['输入已改变，请重新核算','Recalculate changed inputs'],
  'NFD attachment exceeds 1 MB':['营养功能多样性附件不能超过一兆字节','NFD attachment exceeds 1 MB'],
  'Project exceeds 8 MB':['项目文件不能超过八兆字节','Project exceeds 8 MB'],
  'Finite bound required':['变量边界必须为有限数值','Finite bound required'],
  'Package digest mismatch':['项目包内容摘要不匹配','Package digest mismatch'],
  'Author cases unavailable':['作者案例读取失败','Author cases unavailable'],
  'Hosted FarmDESIGN requires the Windows portable app':['原版计算和界面请使用 Windows 便携版。可从本页下载并导入项目 JSON 继续。','Use the Windows portable app for the original engine and interfaces. Download it here and import your project JSON to continue.'],
  'Select an alternative first':['请先选择方案','Select an alternative first'],
  'Search failed':['搜索失败','Search failed'],
 };
 if(fixed[message])return pair(...fixed[message],mode);
 const integer=String(message).match(/^(.+): integer required$/);
 if(integer)return pair(`${FIELD_ZH[integer[1]]||integer[1]}必须填写整数`,`${humanize(integer[1])} requires an integer`,mode);
 if(String(message).startsWith('Nutritional functional diversity is not configured'))return pair('营养功能多样性未配置：请在“来源与模型”载入三份性状树资料；原版返回的零不视为实际分数。','NFD is unconfigured. Load the three trait-tree files under Sources & model; the native zero is not an estimated score.',mode);
 if(String(message).includes('Local calculation service is unavailable'))return pair('本地计算服务未连接。请启动本地服务并保持运行。','Local calculation service is unavailable. Start the local server and keep it running.',mode);
 if(String(message).includes('This server does not support FarmDESIGN'))return pair('当前服务器不支持原版计算，请使用更新后的启动程序。','This server does not support FarmDESIGN. Use the updated launcher.',mode);
 return message;
}
