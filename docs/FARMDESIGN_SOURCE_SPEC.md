# FarmDESIGN 原始模型与本地接入规格

核查日期：2026-10-27。本文件记录实际核查到的原始资料、原生软件接口和验证结果；功能集成的最终状态由应用验收记录另行证明。

## 1. 本次应接入的具体模型

**可核验、可调用的完整原始版本是作者 2019 年案例归档中的 FarmDESIGN 4.21.5.0。**本机已经有这一归档，不应继续沿用早先“软件未取得”的历史结论。它含原版 EXE、DAL/DE/NetworkMetrics/ParetoDE、数据库、手册和版本说明。2026-10-27 已在隔离副本中成功调用其实际年度核算、实际 Pareto Differential Evolution、实际结果导出和原生 XML 往返；没有启动原桌面 GUI，没有安装软件，没有改写原始资料，也没有上传 GitHub。

完整接入采用这些原生模型，而不是根据论文重新写一套近似公式后称为原版。这个版本对应的是静态年度农场/家庭模型；跨年度的土壤、作物阶段、现金库存与适应反馈仍是 FarmSystemDesign 的另外一个开发议题，不能冒充 FarmDESIGN 自带的动态过程。[S1 §2.2、§5.3；S2 §3、§6]

### 直接核验的来源

|编号|来源与定位|此次可核实内容|
|---|---|---|
|S1|Groot, Oomen & Rossing (2012), [DOI: 10.1016/j.agsy.2012.03.012](https://doi.org/10.1016/j.agsy.2012.03.012)；本地 `C:/Users/Lee13/Documents/ChatGPT/博士论文 2/FarmDESIGN/Groot_etal_2012.pdf`|年度核算原理、36 个核心方程、约束、Pareto DE、稳态与目标产量边界。文内页码 63–77；PDF 页码 1–15。|
|S2|作者归档 `Docs/Farm DESIGN Manual.pdf`，标题页明示 Version 4.21.5, 19 November 2018，83 页|完整 GUI 工作流程、计算模块、输入字段、原生文件、优化设置。下文 p. 均指 PDF/印刷一致的手册页码。|
|S3|同归档 `Docs/FarmDESIGN_ReleaseNotes.pdf`，7 页|4.21.5 发行记录及此前功能修正。更新后的软件行为不能只由 2012 方程推定。|
|S4|Ditzler et al. (2019), [WUR 论文记录](https://research.wur.nl/en/publications/a-model-to-examine-farm-household-trade-offs-and-synergies-with-a/)，[DOI: 10.1016/j.agsy.2019.02.008](https://doi.org/10.1016/j.agsy.2019.02.008)|家庭预算、家庭劳动、营养三个扩展模块，农场位于家庭系统内。官方记录核对作者、期刊、2019 年、173 卷、49–63 页。|
|S5|[作者 Mendeley Data 归档 v1](https://data.mendeley.com/datasets/n3sk27ggwf/1)，DOI `10.17632/n3sk27ggwf.1`，2019-02-15|公开说明为该论文的 FarmDESIGN 软件与案例数据；页面许可为 CC BY 4.0。|
|S6|[Alliance Bioversity–CIAT 的 FarmDESIGN 页面](https://alliancebioversityciat.org/tools-innovations/farmdesign)|年度混合作物/畜牧模型、方案云与权衡，以及 household/free budget/leisure/nutrition 的官方说明。|
|S7|本地实际软件、数据库与本次隔离运行|具体程序集版本、真实字段、真实模型输出、真实 DE/CSV/XML 操作证据。|

S2/S3/S7 的共同归档根目录：

`C:/Users/Lee13/Documents/ChatGPT/博士论文 2/FarmDESIGN/downloads/Ditzler_etal_2019/FarmDESIGN.Ditzler_etal_2019/`

身份核验：

|文件|字节数（已读取项）|SHA-256|
|---|---:|---|
|`downloads/FarmDESIGN.Ditzler_etal_2019.zip`|3,290,919|`eb1df6b8c72c109c97891d58be811d22f8fd74cba5257e8c1dd57b4adc69c391`|
|`Docs/Farm DESIGN Manual.pdf`|2,436,788|`458a00ae0166bf1fc9996577f4306c311aec9b93de326c257f47227fae2d63f9`|
|`Docs/FarmDESIGN_ReleaseNotes.pdf`|226,610|`88fa2859c94e7a4373b007742b5345619f5e09a95386b31b2f2d69487d6fb62a`|
|`Input/FarmDB.mdb`|1,064,960|`78999631d35dbe9c280a0616240add94f36aa489dfef1c0ea19ecb8c1e7bf55d`|
|`Input/de.mdb`|512,000|`ad313759b4391585ddece543c5b2057215eeaeda774ce0bdbea13d3a580afa04`|

当前 Google Sites 下载入口和 FSE/COMPASS 项目页未通过此次工具访问；这不影响已取得的作者归档。不能把该 4.21.5 归档称为最新 5.x 版本，也不能把文献所报告的版本号等同于本机实际软件版本。[S2/S3/S5/S7]

## 2. 不能遗漏的功能清单

下表是对手册和实际原生模块的功能归纳，不是“每个模块都已完成网站验收”的声明。原生模块计算结果必须真正显示、可追溯到输入、可比较并可导出。

|功能|完整接入要求|原始定位|
|---|---|---|
|Describe / Explain / Evaluate / Explore|编辑农场及共享资料库；解释全模块；核对决策变量、约束与目标；浏览方案、选择方案、重新核算|S2 §§3–4，pp.6–19|
|农场/环境/经济设置|土壤 OM、土层与容重、温度、湿润日、质地、N/P/K 沉降、非共生固氮、侵蚀、可用水、币种、利率、土地及管理费用|S2 §§9.1–9.3，pp.66–68|
|作物/年度生产活动|每活动可有多个主产品和副产品；产量、劳动、外包费用、补贴、固氮、有效有机质、供水需求、CH4、覆盖因子及活动评分|S2 §§5、6.1、9.6–9.7；S3 4.21.0|
|轮作/作物组|一作物可出现在多个轮作；按 rotation-crop 关系汇总面积；约束总面积、轮作面积和作物组频率；展示 Margalef/Shannon 多样性|S2 §6.1 pp.22–23，§§9.8–9.11|
|全部产品用途|作物 DM 可去土壤、动物、垫料、家庭、田间焚烧、燃料、厌氧消化；动物鲜产品可去动物/家庭；核对自产、使用、净进口或净出口|S2 §§6.2、7.4b、9.7、9.13|
|FullSelfSupply|保持用途之间给定比例、把总用途随自产量联动；其他产品允许用途独立于产量；进口和出口限制应能单独约束|S2 pp.60–62|
|畜群及产品|动物类型、头数、体重、生产水平、替代关系、动物单位、在场/放牧/院落/场外时间、日产品、饲养成本与劳动|S2 §§5.1–5.2、6.3、7.4c、9.12–9.14|
|饲喂系统与两期饲料平衡|支持原生 intake/energy/protein system；饲料能量推算 DMD；分别核算两期 DM/饱和、能量、蛋白、结构供需、偏差、饲料自供及每项饲料贡献|S2 §6.3 pp.23–28，§7.5b；S3 4.18.7、4.21.2|
|粪尿与垫料|从真实饲料摄入和动物产品推算粪尿 DM/OM/C/N/P/K；动物地点分配与各粪肥类型比例；垫料分配；供给不足和用途校验|S2 §6.5 pp.30–37|
|粪肥处理与去向|排泄、好氧/厌氧储存、微生物固持/矿化、矿质 N 损失、施用挥发、腐殖化；土壤/消化/燃料/出口分配及 checksum|S2 §6.5；S3 4.11.0|
|肥料/作物施用关系|各种肥料、矿质 N 比例、施用损失、N/P/K/OM 含量、价格及施用排放；逐作物施用关系决定实际使用量|S2 §§9.15–9.18|
|完整 CNPK 流与效率|全农场/家庭、作物、动物、粪肥、土壤流；进口、出口、内部转移、沉降、固氮、损失、固持；农场/各环节效率；同时展示每农场与每 ha|S2 §6.6 pp.37–40|
|有机质收支|根茬/EOM、绿肥、饲料损失、自产及进口粪肥、原土 OM 降解、粪肥降解、侵蚀；避免同一残体既计 EOM 又计绿肥|S2 §6.4 pp.29–30|
|农场与家庭劳动|regular/casual 的作物、畜群、固定管理劳动、家庭供给、雇工、缺口/盈余；家庭农内/农外劳动、休闲；保留 24 个时段资料与性别/年龄分类|S2 §6.7 pp.40–42；S3 4.11.0、4.15.2、4.18.0；S7 数据/枚举|
|水|需求、可用灌溉水、供需偏差百分比及每面积值；与作物目标产量一致，不能当作过程型水文或水分胁迫产量模型|S2 §6.10 p.46，ENV.IrrigationWater、CRP.WaterDemand；S7 IrrigationWater|
|温室气体|作物 CH4、动物肠道/粪肥 CH4、粪肥产生/施用 N2O、挥发间接 N2O、肥料、固氮/沉降/残体、焚烧和 CO2eq|S2 §6.8 pp.42–43|
|生物能/消化物|作物残体与粪肥去厌氧消化、CH4 和能量产量、剩余消化物 C/N/P/K、N 矿化/固持及损失、土壤归还；与其他用途争用同一物料|S2 §6.9 pp.43–46|
|农场经济|作物和动物毛利、饲料/垫料、利息、动物成本、肥料/农药、土地、机器/建筑运维折旧、管理、劳动；经营利润、每 ha 利润、劳动回报、自产消费价值|S2 §6.12 pp.51–54；S3 4.21.1；S7 EconomicResults|
|家庭预算|农业收入、农外收入、养老金和汇款、食物成本、其他支出、总收入、自由预算|S2 §6.13 p.54；S4/S6；S7 HouseholdBudget|
|家庭营养|按年龄/性别/状态和人数/消费单位读 DRI，按食物组读 DRF；产出与消费分开；食物组/营养素供需和偏差、NSY、HDDS/WDDS/MDD-W、NFD|S2 §6.11 pp.46–51，DRI/DRF 原生表；S3 4.20.0、4.21.5|
|农药|农药产品、有效成分、单位、价格、逐作物施用、每农场/ha 总量|S2 §§9.19–9.20，p.76；S3 4.17.0、4.17.2、4.21.1|
|流网络指标|C/N/P/K 流矩阵及原生 Ulanowicz/Finn 指标；应保留其原始网络边界、单位和空网络行为|S2 §6.14 p.54；S3 4.20.1；S7 NetworkMetrics + FlowMatrix|
|原版多目标优化|直接调用原版 DE/Pareto 库；可编辑实体字段的上下界/精确值、输出目标/方向/约束；逐候选原生复算和约束解释；保留原输入和算法设置|S2 §7 pp.56–62；S3 4.21.0；S7 GenDE|
|分析与导出|原输入/完整农场与优化设置、Reporter、决策变量、目标、约束失败次数、Pareto rank、相关系数、相对原方案的标准化距离；完整原生 XML 往返|S2 §§8、10 pp.63–64、78–79；S7 已调用 WriteResults/WriteXML/XML Deserialize|

## 3. 数学、单位与解释合同

### 3.1 年度面积、产品和边界

- 总农场/轮作面积按相关 `RCR.Area` 汇总；某作物面积跨其全部 rotation-crop 关系汇总。作物组频率为组面积/农场或轮作面积。年度复合活动如 `maize+maize` 已是一个有年度产品参数的活动，不能再因为名称中有两次 maize 而把实体面积翻倍。原作者 DK 的 `Field` 是 1.07 ha，连同 Yard 和 Fish pond 后总农场 1.165 ha；NP 的 Field 为 0.61 ha、总农场 0.636 ha。[S2 p.22；S7 ROT/RCR]
- Shannon 为 `-Σ p_i ln(p_i)`；Margalef 为 `(S-1)/ln(A_m2)`，不是把 ha 直接放入对数。零面积/单物种等边界保持原版结果并解释未定义值。[S2 pp.22–23]
- 作物产品量基准是 kg DM；动物产品分配量基准是 kg 鲜重。`DMContent`、N/P/K、ash 等数据库百分数不能直接当 0–1 分数。`freshKg = dryKg/(DMContent/100)`；化学含量 N/P/K 用于 DM，营养表成分多为每 100 g 鲜重。价格基准亦须区分 kg 和 tonne。[S2 pp.69–75]
- 普通用途独立于生产量：使用多于自产为净进口；自产多于使用为净出口。FullSelfSupply 才把用途比例归一至自产量。其余进口料、外购食物与内部自产产品不可合并后重复计收入/成本/养分。[S2 pp.23、60–62]

### 3.2 饲料和畜群

- 两饲喂期分别累计需求和供给；动物在场/场外及所在地点影响需求和排泄，不能仅把全年分成相等两半。[S2 pp.25–28、31；S3 4.21.4]
- 手册推荐每期：饱和度利用不超过 100%；能量供给 95–105% 需求；蛋白供给 100–130%；结构供给至少 100%。这些是用户可调整的建模约束，并非所有农业系统的固定生理常数。[S2 p.61]
- `MW = LW^0.75`。通用维护需求以 MW 乘输入系数；通用产品需求由动物日产品量乘产品的 `EnergyRequirement/ProteinRequirement`；VEM/DVE 有其专用公式。原生 DLL 应处理这些体系选择，不要由前端再重复加 grazing correction。[S2 pp.26–28；S7 原始字段]
- 手册给出 VEM 推算 DMD `(E+210)/1.563`，单位 g/kg；ME(MJ) 为 `1000E/15`，TDN(%) 为 `10E`。S3 4.18.7 明确 DMD 上限改为 0.95。实际 DTO 可以使用与表名不同的字段/单位，应交给原 DAO 转换。[S2 pp.24–25；S3 p.2]
- 原生 `ANM.MEMaintenance` 等字段不是手册中重新命名的 `EnergyMaintenance`。原案例已有 50.88 = 42.4×1.2 之类参数，不能额外无条件再乘一次活动系数。保留原库及原 DAO 解释，而不是按名称自行推断“缺项”。[S7 ANM；S2 §§6.3、9.12]

### 3.3 粪肥、土壤与 CNPK

- 手册明确粪便 DM 为 `Σ feedDM * (1-feedLoss) * (1-DMD)`，再按实际垫料加至指定粪肥池；不能把已消化部分当粪便。粪肥 N/P/K 来自摄入减动物产品，且区分粪、尿、垫料和地点。[S2 pp.30–33]
- `DCP = 0.929 - 3.48/CP`（CP 以百分数输入，CP≈6.25N）；`N_faeces=(1-DCP)*N_intake`；`N_urine=N_intake-N_products-N_faeces`。矿质/有机 N 分别由 `0.03*N_faeces+N_urine`、`0.97*N_faeces+N_bedding` 构成。原版对全群求和，不能称逐动物消化过程模拟。[S2 pp.32–33]
- 按 pasture/stable/yard/off-farm 时间划分排泄，地点内粪肥比例之和为 1，垫料分配比例之和为 1。[S2 pp.31–34]
- 各好氧/厌氧部分分别计算 OM 降解、微生物 N 矿化/固持、矿质 N 储存损失，继而施用损失。原版采用 `degradedC/(1-efficiency) * (N/C-efficiency/microbialCN)` 类型的净 N 释放关系，负值表示固持；不能把所有负数直接截成 0。[S2 pp.34–37]
- 农场养分余额为输入减输出，环节效率为输出/输入；土壤 N/P/K 的 balancing item 不等同于已实测淋失，负值也可能表示养分开采。零输入导致的 NaN/Infinity 必须解释，不能替换为“0%效率”。[S2 pp.37–40、54–55]

### 3.4 劳动、经济、家庭和营养

- 每种技能劳动要求满足 `L=F+H`，家庭可供劳动 `T>=F`；家庭休闲为可用时间减农内家庭劳动与农外劳动。外包作业计成本，不重复计劳动小时。原案例 profile 为 24 个 `@` 分隔段，`DAL.General.LaborPeriod` 实际也枚举 PERIOD1–PERIOD24，不应硬编码 26 段。[S2 pp.40–42；S7 数据与枚举]
- 稳态固定资产成本包含折旧、运维与利息；原手册建筑利息折算为 0.5、机械为 0.6。更新版劳动、利息、家庭消费估值的具体行为使用原始二进制；不应将 2012 的家庭劳动估价与 2019 的现金自由预算混为一个指标。[S2 pp.51–54；S3 4.18.0、4.21.1；S4]
- 家庭自由预算区分农业收入、农外收入、食物成本和其他支出；经营利润和自由预算不是同一个值。自产食物既有价值又满足消费，不能既把全部产值当实际现金销售又不扣除家庭消费机会价值。[S4；S6；S7 HouseholdBudget]
- 食物的生产多样性、实际家庭供应、食物组需求、营养素 DRI/DRF、NSY 必须分别保留。NFD 需要对应农场的树图与映射文本，实际文件名必须依据原程序，见 §6 的附属文件合同。作者此次案例包未提供这些附属输入；原版返回的 NFD=0 在这种情况下应解释为未配置，不能作为真实零营养多样性的证据。此次已用明确标为人工测试的树图证明原版文件接入与计算通路可以正常工作。[S2 pp.46–51；S7 归档文件列表、HumanNutrition/FormFunctionalDiversity IL、NFD attachment probe]

### 3.5 GHG、生物能与水

- 4.21.5 手册的历史 GWP 参数为 CH4×21、N2O×310；N2O-N 变为 N2O 需乘 44/28。原版复现应明确历史口径，不静默替换成最新 IPCC 参数后仍称原版本结果。[S2 pp.42–43]
- 原版总 `TotalEmissionCO2eq` 为 **Mg CO2-eq/year，即吨/年**；单个 GenGHG 的 `CO2eq` 为 kg CO2-eq/year。总量 getter 将各项 kg 相加再除以 1000；`TotalEmissionCO2eqPerHa` 进一步除以面积。不能把基线 7.5553 标为 kg，也不能将吨值再无条件除以 1000。[S7 GreenHouseGases.get_TotalEmissionCO2eq IL；Bin/Files/Translations.E.EN.txt]
- 原版生物能使用物料 C 守恒：底物 C、降解 C、消化物剩余 C、CH4 比例及低位热值；消化物 N 释放/固持、挥发及归还土壤应一致核算。无生物能输入时 0 产能与缺输入不是同一状态。[S2 pp.43–46]
- `CH4Produced` 为 m³（STP），`EnergyProduced=CH4Produced*LowerHeatingValueCH4`，后者在热值取 MJ/m³ 时为 MJ。原版翻译文件误把 CH4Produced 标成 kg；手册 p.44 公式与实际原生能量计算均支持 m³，界面不应复刻这一标签错误。[S2 pp.44–45；S7 EnergySource/EnergyFlow、合成底物反事实测试]
- 手册水模块只有简短标题。原版 IL 可核实 `WaterRequired=Σ cropArea*WaterDemand`，若需求 >0，`WaterBalance=100*(WaterAvailable-WaterRequired)/WaterRequired`；无需求时原程序返回 0。水量为 m³，WaterBalance 是百分比；每 ha 输出为 m³/ha。不能将这个静态供需表当作水文或水分胁迫产量模型。[S2 p.46；S7 IrrigationWater.PerCrop/Calculate_1/CalcPerArea IL]

## 4. 原始资料中的不一致：不能靠猜测填补

1. **OM 环境因子。**2012 Eq.1 的排版/解释与 4.21.5 手册 p.29 的 `1/(texture*moistDays/365*2^((T-9.5)/10))` 不一致；手册又把该因子同时放在 EOM 与 SOM 降解方程。p.29 的公式已看图复核，不是纯 OCR 错误。本次直接调用原二进制解决“究竟程序算什么”的问题，不据手册公式自行校正后冒称原版。[S1 p.66；S2 pp.29–30]
2. **粪便 DM。**2012 Eq.8 的印刷形式可误解为乘 digestibility；手册 p.30 明确乘 `(1-DMD)`。[S1 p.67；S2 p.30]
3. **OM 中 C 比例。**S2 p.30 写 45%，p.35 写 50%；不得统一无证改写。
4. **经济。**2012 Eq.22 与手册 p.52 的补贴排版是减号；4.21.1 又调整利息/劳动费用。当前行为由原版 binary 验证；若要纠正研究方程，应另外标为模型修改并给出对照。[S1 p.68；S2 p.52；S3 p.1]
5. **原生表与 DTO。**例如数据库 `Carcass=100` 表示百分数，手册表却写 fraction；数据库 `Currenc`、`EDMFactor`、`STRFactor`、`MEMaintenance` 等并非 DTO 属性名。使用原 DAO 加载避免错误翻译。[S2 §9；S7]
6. **优化人口参数。**2012 的人口大小为决策维数×倍数，但 4.18.4 发布说明改为 MP 表示解数；实际 4.21.5 SetUp 直接用 MP 作 PopSize。原包 DEP.MultipFactor=600 不是再次乘决策维度。[S1 §2.3.2；S3 p.2；S7 SetUp IL]
7. **版本范围。**原作者 2019 归档可以证明 4.21.5；其他论文报告 5.x 不足以获得该版本完整内部程序。本次不能标称已接入最新 5.x。
8. **语言与单位元数据。**原版 EN 文本是 Windows-1252，含 µg、ºC 等字符。中文 Windows 的系统 ANSI 往往是 936，不可用 Encoding.Default 或不指定编码；应显式使用 1252 后转 UTF-8。输出字段名重复用于不同模块，必须结合对象上下文决定单位，不能按末尾字段名一概套用。[S7 Bin/Files/Translations.D.EN.txt、Translations.E.EN.txt]
9. **流网络资源与程序集未同步。**原版 Images/FlowMatrix.txt 的 I/J 索引数组各 35 项，而当前 NutrientFlow 有 39 个 sNPK 属性；末尾新加的是四个效率百分比。直接启用 Simple 网络会索引越界。适配只可对明确的四个 Efficiency 属性补 -1（原版含义为不进入物理流矩阵），不得把效率当养分流、不得压制异常并假报 0；详见 §6。[S7 FlowMatrixSimple.flows2Matrix IL 与实际隔离运行]

## 5. 原生数据与格式

### 原始 Access 表

实际 `FarmDB.mdb` 有 27 个公开表：

`ANM APR ARR BLD CFR CMR CPR CRP DRF DRI ECN ENV FRM FRT GCR GRP HHD HMR MAN MCH NTE PHO PRD PST RCR ROT VRS`。

数量用 `GetSchema('Tables')` 过滤 `TABLE_TYPE='TABLE'` 核对；不得把 Access 的系统表当农业输入表。

关键行数：FRM3（0=Repository，79=DK，80=NP）、ENV2、ECN2、CRP18、PRD66、ANM12、APR15、MAN6、FRT6、ROT5、RCR13、HMR10、DRI22、DRF19。库中 dummy/repository/外购食物实体有其原始用途，不应当作缺失农业观测补造。

`de.mdb` 有 `DEP/DVR/OUV/VAR/VRS` 五张公开表；DEP 为算法参数，DVR 为决策变量（23 行），OUV 为目标/约束（25 行），VAR 为绘图参数。DVR 支持 min/max、ExactUse、ExactValue、ExactDeviation；OUV 支持 EntityType/ObjName/Variable、目标方向、是否约束、min/max。当前原案例两农场的三个目标为自由预算、OM balance 和休闲，不是写死在引擎中的唯一目标。[S7]

格式层级：

- 原生二进制输入为 Access MDB；新版 JSON 表快照应明确其自身 schema，不能称 MDB 文件。
- 原生完整农场交换为 XML，包含 MixedFarm 和 HeuristicsData。已由原作者类真正生成并读回。
- 原生 console 文本协议为 TSV（手册 pp.63–64），但本归档没有提供 `FarmDESIGNConsole.exe`；不能声称它已安装/调用。
- 原始结果导出为原生 TXT/CSV、Reporter 与优化附属数据。自定义报告可以补充，不能把自定义字段名说成原 XML 的字段。

## 6. 可复用的实际原生调用路径

### 宿主与隔离

- FarmDESIGN.exe、DAL.dll、DE.dll、NetworkMetrics.dll 为 .NET 托管程序集；ParetoDE.dll 为非托管 32 位库。
- 必须使用 x86 .NET Framework 宿主。本次用 `C:/Windows/SysWOW64/WindowsPowerShell/v1.0/powershell.exe`；64 位 LoadFrom 会 BadImageFormat。
- 每次运行复制 Bin/Input 到独立工作目录，原始 MDB/INI 不写入。原程序集使用全局 singleton 和 DLL 状态；每个任务独立工作进程有利于隔离不同农场/输入/算法状态。
- 多数内部方法、构造和属性不是 public。反射使用 `Public|NonPublic|Instance|Static`；不能因为普通 PowerShell 成员调用返回 null 就断言该模块不存在。
- `ApplInit` 的非公开 `XmlNodeList` 构造器可装入运行副本的设置，随后设置静态 `_instance` 与 `parentAppName='FarmDESIGN'`。输入/输出目录必须以路径分隔符结尾，原 DAO 内部按字符串拼接数据库文件名。

### 计算流程（已运行）

1. 通过原 DAO `DAL.Domain.FarmDESIGN.DAO.MixedFarmDAO.SelectById(79)` 得到完整 `MixedFarm`。
2. 建立原 `DAL.General.DirectoryHolder(outputDirectory)`。
3. 建立 `Design.Model.FarmSimulation(directoryHolder)`。
4. 调用 `Init(mixedFarm,new object())`：第二参数为非空且不是 GUI InputForm，可初始化完整模块而不绑定界面。
5. 直接 `Calc()`。
6. 读取原模块：`Areas/FeedBalances/FeedSelfSupply/NutrientFlows/NutrientFlowsPerHa/OmBalance/OmBalancePerHa/Labour/Manures/Pesticides/Energy/GHGs/Nutrition/Budget/NutrientFlowMatrix`，以及字段 `EconResults/ProductAmounts/WaterUse/BeddingUse/ManureProd`。
7. 编辑 DTO 参数后再 `Calc()`。结构改变时可重新 Init；`StructureCalc()` 无条件触发 StructChanged 事件，headless 无订阅者时会 NullReference，不能直接照 GUI 的顺序调用。
8. `Close()` 并关闭 DAO 连接。

### 优化流程（已运行）

1. 建立 `Design.Model.FarmOptimization(directoryHolder)`，绑定原生 FarmSimulation。
2. 通过原生 `HeuristicsData.SelectByCase(object[]{farmId})` 载入输入决策变量、目标和约束，赋给优化对象的 HeurData。
3. `Init(model,null)` 绑定模型。其返回值在这一步可能为 0；目标数量是在 SetUp 中更新，不能误判为没有目标。
4. `SetUp(Rand1Bin,ParetoRank,binDirectory)`；读取 native PopSize/ObjNumber/LociNumber。
5. `SetPopulation()`；反复 `Run(1)`。实测 iteration 持续为 1、2、3，并保留种群。这支持逐代进度和在代际之间取消；不表示可安全中断本地 DLL 的任意一条指令。
6. `GetNumberOfSolutions()` 返回 N；`GetVariablesData/GetObjectivesData/GetRankingData` 返回的是 **2N 的工作数组**。仅前 N 行为当前结果，后 N 行是 trial/scratch，不可混入前沿。
7. 原版以 ±9e9 等哨兵惩罚不可行方案；rank 不是可行证明。逐候选 `DecisionVariablesToModel(index)` → 原 model `Calc()` → 原 `CheckConstraints()`，并读取原 conData/conPointers 解释违约。
8. `WriteResults()` 已输出原生 Constraints/Variables/Objectives/Ranks/Correlations/Distances 等 CSV。
9. 通过 `Close()` 关闭原 native 状态。

原算法字段包括 F/CR/MP/Generations/Population/MaxNoReplace/Enrichment/Relative。此次没有找到 seed 接口，不能声称按用户给定随机种子可复现；应保存实际输入、参数、种群和原始结果。

### 原生输出目录与目标目录

`FarmOptimization.FindOutcomeVariableInModel(EntityType,ObjName,Variable)` 能把原生目标描述解析到实际对象和 PropertyInfo。本次在运行中生成 **708 项非空原生指针** 的目录，覆盖面积/轮作、饲料供需、CNPK、OM、劳动、经济、GHG、水/能、家庭营养与预算。应由运行时按当前农场生成/核对，而不是前端随意把任何数字当成可优化目标。

明确的 dispatcher 类型还包括 `AnimalMargin/CropReturns/AnimalReturns/ManureUse/sNutrientYield/sBalance/MetricsUlanowicz/MetricsFinnCycling`。`OrganicMatter` 和 `sNPK` 原生指针自动解析到每 ha 值，单位必须按实际指针标明。无分母场景的非有限结果只能标未定义/未配置，不得补成 0。

### 原生 XML 往返（已运行）

`Design.Output.Writers.FarmDataTxtWriter(directoryHolder).WriteXML(mixedFarm,heuristicsData)` 可生成原版 XML。以原 `Design.Output.FarmData` 类型的 XmlSerializer 读回，再把 `MixedFarmData` 交给原 FarmSimulation Calc，已证明自由预算数值一致。输入接口仍需保留 XML 结构/版本信息及未知资料；不得仅凭扩展名接受任意对象反序列化。

### 原生 XML、SQL 表和全新 ID 的完整关系

农场 XML 的农业对象覆盖 24 张业务表：`FRM ENV ECN HHD HMR CRP PRD ROT RCR GRP GCR ANM APR ARR MAN FRT PST MCH BLD CMR CFR CPR NTE PHO`，再包括案例的 `DVR OUV VAR` 优化对象。DTO 的非公开 `getTableName()`、`getIdColumnName()` 和属性上的原 `MappingAttribute` 给出确切 SQL 映射；应按此反射，不能假定属性名等于 SQL 列。[S7 DAL MappingAttribute/Entity、FarmData XML]

已验证的典型别名包括：

|表|原 SQL 列|原 CLR 属性|
|---|---|---|
|ANM|AnmNumber|Number|
|ANM|EDMFactor / STRFactor|SaturationFactor / StructureFactor|
|ANM|MEMaintenance / CPMaintenance|EnergyMaint / ProteinMaint|
|ANM|RegularLabour / CasualLabour|RegularLabourAnimal / CasualLabourAnimal|
|ANM|Enteric_CH4_EF / Manure_CH4_EF|Enteric_CH4_EmissionFactor / Manure_CH4_EmissionFactor|
|PRD/APR|VEM / DVE / TDN|FeedEnergy / FeedProtein / DMD|
|PRD/APR|ProteinContent / FatContent|Protein / Fat|
|APR|ToAnimals / ToHomeUse|ToAnimalsAPR / ToHomeUseAPR|
|CRP|RegularLabour / CasualLabour|RegularLabourCrop / CasualLabourCrop|
|CRP|Crop_CH4_EF|Crop_CH4_EmissionFactor|
|CMR|Amount|AmountManure|
|FRT|Amount / Price|AmountFertilizer / PriceFertilizer|
|MAN|Price|PriceManure|
|PST|Amount / Price|AmountPesticide / PricePesticide|
|ECN|Currenc|Currency|
|HMR|_Number / Age|Number / PersonAge|
|FRM|ProportionCH4inBiogas|ProportionCH4|
|FRM|Residue_N2O_EF|AppliedResidue_N2O_EmissionFactor|
|BLD/MCH|BldNumber / MchNumber|Number|
|OUV|Constrain|Constraint|

完整映射证据在临时文件 `FarmDESIGN_native_SQL_CLR_mapping_20261027.json`、`FarmDESIGN_native_XML_tables_20261027.json`。全局 `DRI/DRF/DEP/VRS` 不全部包含于农场 XML；部分旧 SQL 列如 OEB2、VEVI 没有当前 DTO 映射。它们应从明确标识/散列的原版参考数据库保留，不应声称“农场 XML 单独提供了原 MDB 的每个字节”。XML → MappingAttribute 表对象 → 参数化 SQL 写入隔离副本 → 原 DAO 重新载入 → 原 Calc 的路径已比较 **20 个模块、4855 项数值，0 项差异**（绝对容差 1e-8 +相对容差 1e-12）。[S7 fd_xml_tables_20261027.ps1、FarmDESIGN_native_XML_tables_proof_20261027.json]

另已将作者案例的正农业主/外键、案例目标/决策键全部加 10000，把农场改为 `FrmID=10079`、名称 `New_farm_new_IDs_software_test`，保留 Repository 0 及显式全局参考表。这个全新 ID 农场经原 DAO 载入、原 Calc 和原 DE 24 个体/10 决策/3 目标 Run(1) 成功，自由预算仍为 61895117.19154998 VND/year；证明引擎不依赖写死 79/80 两个案例 ID。Access 实有外键约束，独立副本插入须父表在先，不能靠删除源数据库或随意关闭约束来解决。[S7 fd_new_ids_20261027.ps1、FarmDESIGN_native_new_ids_proof_20261027.json]

### 流网络初始化合同

原作者默认 INI 未指定 NetworkMetrics，原程序只创建基类 FlowMatrix，四项网络指标对象为 0；这不表示已计算网络。启用 `NetworkMetrics=Simple` 后仍需两项严格的运行兼容处理：[S7 FarmSimulation.GetModuleNutrientFlowMatrix、FlowMatrixSimple IL]

1. 原代码用 WinForms `Application.StartupPath` 找 Images 资源。PowerShell 宿主的 StartupPath 会指向系统目录；只在隔离工作进程内将其私有缓存 startupPath 指向复制的 Bin，不能向 Windows 系统目录写文件。
2. 校验 `NutrientFlow.GetProperties().Where(PropertyType==sNPK)` 的 39 项与资源前 35 项索引一致，并校验缺失末四项确为 AnimalEfficiency/ManureEfficiency/SoilCropEfficiency/FarmEfficiency；仅补四个 -1 到 I/J，保留原 35 个物理流映射。遇到任何其他缺项应明确报错。

原 Simple 矩阵 I 是接收方、J 是来源：进口0、土壤1、作物2、动物3、家庭4、粪肥5、出口6、损失7；空内部节点由原程序移除。合成参数测试已得到 C/N/P/K 四套非零 throughput 的原生 General/Ulanowicz/Finn 指标，并非在网页重新近似这些公式。**Complex 亦已单独运行成功**：保留同一隔离 StartupPath 修复，选择 `NetworkMetrics=Complex`，使用原资源，不对 Complex 应用 Simple 的 I/J 补位。Complex 按实际作物/动物/粪肥等细节点划分，和 Simple 的节点数及指标本就不同；C 的 FCI=0 是该测试的真实已算结果，不能因零值误判未初始化。[S7 fd_enabled_features_20261027.ps1、FarmDESIGN_native_enabled_features_proof_20261027.json、fd_complex_network_20261027.ps1、FarmDESIGN_native_Complex_network_proof_20261027.json]

### NFD 附属文件合同及已证明的接入

4.21.5 原程序读取以下 **三个完整后缀**。路径是 ApplInit 的 InputDirectoryPath；前缀为 `farm.Name.Replace(' ','_')`。手册 p.49 对后两者省写 `.txt`，实际运行必须采用程序读取的名字：[S2 pp.49–50；S7 HumanNutrition.readFunctionalDiversityMatrix、FormFunctionalDiversity.readMapping/readProducts IL]

- `<farm>.FD.Dendrogram.txt`：无表头的制表符数字矩阵；首行是 L 个 H2 分支长度，L>1；随后 S 行分别是物种的 H1 分支隶属 0/1，每行必须同为 L 列。
- `<farm>.FD.Mapping.txt`：无表头的两列制表符整数 `productKey speciesRow`；物种行号从 **0** 开始。作物产品键为 `100000+PrdID`，动物产品键为 `200000+AprID`。
- `<farm>.FD.Products.txt`：逐行物种/产品名称，顺序必须与 H1 行一致。原计算只需树图和映射；该名称表用于原始映射界面及核对。

载入发生在 HumanNutrition 构造时；更换附件后必须重新 Init，不能仅重算旧对象。文件接收层应先检查行列、有限数字、正总枝长、ID/零起点行号边界、重复键和一致的物种名称；然后只复制到工作副本 Input。没有真实食品性状/树图时，只能标 NFD 未配置，不能从已有 DDS 倒推 NFD。[S2 p.49；S7 构造器/计算器 IL]

原 `calcFD` 按已生产/已消费的映射物种取分支集合并除以总枝长；是否达到 `LowerBoundaryNFD` 会影响物种是否计入，产出与消费分别计算。此次用 **人工 API 测试数据**：H2=[1,1,1]、3×3 单位 H1、103183→0（banana）、103186→1（mango）、103188→2（onion）、阈值0，原 Calc 得到 Produced=1、Consumed=1。该证据仅证明上传文件到原模型的通路，不是论文中的真实树图、校准或田间营养结论。[S7 fd_nfd_attachments_20261027.ps1、FarmDESIGN_native_NFD_attachment_proof_20261027.json]

### 显示标签与单位的上下文

原版 `Bin/Files/Translations.D.EN.txt` 有 185 项输入标签，`Translations.E.EN.txt` 有 286 项输出标签，列是 `VarName/Description/Explanation/SIUnit`。此次以明确的 Windows-1252 解码并导出为 UTF-8 的 `FarmDESIGN_native_EN_metadata_20261027.json`。语言文件提供标签和原注释，实际单位还须结合模块和上述已核对的原标签错误。708 项只是某个农场的一次实际目标指针目录，后续应随实体和启用模块重新生成，不能当成固定总数量。[S7 原语言文件、实际目标解析]

|对象上下文|实际输出单位与注意事项|核查依据|
|---|---|---|
|SumArea.Area、各 crop/rotation area|ha|S2 p.22；原翻译|
|NutrientFlows 普通 C/N/P/K/DM/OM；PerHa 版本|kg/year；kg/ha/year|S2 pp.37–40；原模块|
|四项 *Efficiency|已经乘100的 %；不随 per-ha 再缩放|NutrientFlow.Calculate_3/CalcPerArea IL|
|原生目标 sNPK / OrganicMatter 指针|默认解析至 per-ha 对象，kg/ha/year；Efficiency仍%|FarmOptimization.FindOutcomeVariableInModel IL|
|FeedBalances 的普通 sFeed DM、EDM、STR、CP|kg DM/year、kg 饱和当量/year、kg 结构当量/year、kg 蛋白/year；DVE 模式为 kg DVE|S2 pp.25–28；FeedBalance.PerCropProduct/PerAnimal IL|
|FeedBalances 的 TDN 字段|`DM*FeedEnergy/1000`，即 10³ 个所选能量单位/year；原案例 VEM 时为 kVEM/year|FeedBalance.PerCropProduct/PerAnimalProduct IL|
|FeedBalances.AvailableDict[*].DMD|0–1 分数，输入/手册 g/kg 要除1000；不能把这里标 g/kg|FeedBalance.PerCropProduct IL|
|FeedBalances.Deviation、FeedSelfSupply.SelfSupplyBalances/Total|已经是 %；无需再乘100|原语言表；FeedBalance.Calculate_1、FeedSupply.Calculate_2 IL|
|FeedBalances[*].SelfSupply|是自产饲料原始量，仍是 kg/能量单位；与上一行 FeedSelfSupply 的百分比对象不同|原实际对象及 FeedSupply.Calculate_2|
|ProductUse.SelfSupply、Budget.ProportionFoodCosts|无量纲比值，1表示相等；不能按百分数原值直接附 %|原翻译；原 Calc/预算实际值|
|营养 sBalance.Deviation、SelfSupply|均已为 %；SelfSupply 的原代码为加权自产量除以 `(Supplied/100)`。原 Max/Min Required/Supplied 的 ±9e9 是哨兵，不能当成营养观察量|HumanNutrition.Calculate_1、sBalance.Reset IL|
|营养 Required/Supplied/Produced 及 nutrientDemand/Supply|年度总量：DietaryEnergy kcal，Carbohydrates/Fiber/Fat/Protein g，Phosphorus mg，Potassium g，Mg/Mn/Ca/Na/Fe/Zn/S/VitC/B族/VitE mg，VitA/Folate/B12/Copper/VitD µg；食物组为 kg 鲜重|原输入/DRI；HumanNutrition.PerCropProduct/PerAnimalProduct IL；K在 MgRatio 中另乘1000|
|sNutrientYield.Yield / YieldPerHa / YieldPer1000m3|可供营养人数当量 persons、persons/ha、persons/1000m³；Produced 仍依营养素单位|S2 pp.50–51；原 CalcPerArea|
|劳动与家庭时间|h/year；24段 profile 保持来源|S2 pp.40–42；原翻译|
|ManureUse 量及 CheckSum / DeviationForSoil|kg DM/year / %；CheckSum为物料分配残差|S2 pp.33–37；原翻译|
|WaterAvailable/Required、PerHa、Balance|m³/year、m³/ha/year、%|IrrigationWater IL；原翻译|
|EnergyProduced/TotalEnergyProduced；CH4Produced；C相关量|MJ/year；m³ STP/year；kg C/year|S2 pp.43–46；原运行/能量乘法|
|GHG 总量与 PerHa；子项 CO2eq；CH4/N2O|Mg CO2eq/year、Mg CO2eq/ha/year；kg CO2eq/year；kgCH4或kgN2O/year|原翻译；GHG getter IL|
|经济/家庭预算；OperatingProfitPerHa；ReturnToLabour|所选币种/year；币种/ha/year；币种/h；家庭规模为 persons|S2 pp.51–54；原翻译|
|Network General Throughput/Throughflow/Finn TST|相应 C/N/P/K 的 kg/year；平均值需附 per link/per compartment|原 NetworkMetrics.dll 计算/Write IL|
|Network Ascendency/Overhead/Capacity|kg(element)·bits/year；源 DLL 使用 log2|NetworkMetrics.MetricsUlanowicz.Indices/log2 IL|
|Network AMI/Hr/Dr/Hmax/Hsys/Hc；A/C、AMI/Hr、FCI等|前者 bits；后者无量纲比值，不能一概标 % 或 kg|同上；MetricsFinnCycling IL|

原生类还包含 `DietOptimization`、HyperVolume 等成员。它们的存在本身不证明是已公开且完整可用的原版功能：例如 DietOptimization.SetFoods 把选中食品用途固定为10，不能未经独立验收就当作通用连续膳食优化器；HyperVolume 在此次基线为0且没有本次已验证的性状/体积计算输入。应用若展示这些成员，须说明其来源与未验证状态，不能以界面有数字代替功能证据。[S7 DietOptimization.Init/SetFoods/Evaluate、HumanNutrition；本手册未描述这一类的完整用户工作流]

## 7. 本次原生运行证据与验收边界

运行原型（此次探索的临时文件，应用侧应另有受版本管理的宿主实现）：

- `C:/Users/Lee13/AppData/Local/Temp/fd_native_probe_20261027.ps1`
- `C:/Users/Lee13/AppData/Local/Temp/FarmDESIGN_native_results_20261027.json`
- `C:/Users/Lee13/AppData/Local/Temp/FarmDESIGN_native_optimization_20261027.json`
- `C:/Users/Lee13/AppData/Local/Temp/FarmDESIGN_native_outcome_catalog_20261027.json`
- `C:/Users/Lee13/AppData/Local/Temp/FarmDESIGN_native_tables_20261027.json`
- `C:/Users/Lee13/AppData/Local/Temp/FarmDESIGN_native_DE_tables_20261027.json`
- `C:/Users/Lee13/AppData/Local/Temp/FarmDESIGN_reflection_20261027.json`

已验证的 DK 原版输出（保留原案例 VND 币种）：

|指标|原版结果|
|---|---:|
|农场面积|1.165 ha|
|OM balance|0.328029642750721 kg/year|
|家庭可工作时间|5773.5932 h/year|
|家庭农业劳动|5377.17629 h/year|
|农外劳动|320 h/year|
|休闲时间|76.41691 h/year|
|农业收入|120430617.04155 VND/year|
|自由预算|61895117.19155 VND/year|
|HDDS / WDDS / MDD-W|9 / 8 / 7|
|GHG|7.55532112945941 Mg CO2eq/year（吨/年）|

已完成的关系验证：

- 同一模型的 GeneralCosts 增加 1000 → 自由预算精确减少 1000；还原输入再次核算，回到基线。
- 原生优化 24 个解、10 个决策变量、3 个目标，连续三次 Run(1) 推进；工作数组为 48×10、48×3，已区分有效结果和 scratch。三代只是接口测试，不是收敛结论。
- 选定候选用原模型重新计算并调用原 CheckConstraints。
- 原版 CSV 真实写出。
- 原版 XML 真实写出、原类型反序列化并重新核算；自由预算不变。
- 原 XML → MappingAttribute SQL表 → 隔离MDB → 原DAO → 原Calc，20模块4855数值0差异。
- 全新农场10079及正实体键+10000，经原DAO、Calc与原DE Run(1)通过，保留明确参考表。
- Simple网络以严格资源适配后原生计算，得到4个元素非零指标。
- Complex网络使用原资源及工作进程StartupPath修复亦通过，独立于Simple补位。
- 合成水/排放/生物能参数经原Calc联动，水140/2000m³、能量4357.2815694MJ、GHG7.861201548Mg；人工消化物矿质N为负值，不能称为物理可行/校准方案。
- 合成NFD树图/映射附件进入原模型，Produced/Consumed各为1，仅属API接入测试。
- 708 项目标描述经过实际原生指针解析。

合成反事实测试的精确输入差异保存在 `C:/Users/Lee13/AppData/Local/Temp/FarmDESIGN_native_counterfactual_patches_20261027.json`，使用原 SQL 列：

|表/选择键|输入改动|
|---|---|
|ENV.EnvID=77|IrrigationWater=2000|
|CRP.CrpID=1192|WaterDemand=200；Crop_CH4_EF=0.5|
|ANM.AnmID=444|Enteric_CH4_EF=40；Manure_CH4_EF=0.2|
|FRM.FrmID=79|ProportionCH4inBiogas=0.6；LowerHeatingValueCH4=35.8；BioEnergyMicrobialEff=0.35；BioEnergyMicrobialCtoN=12；NLossDigestionEP=0.015；NLossDigestateAppl=0.05；DigestateHumifCoeff=0.3；Residue_N2O_EF/Fixation_N2O_EF/Deposition_N2O_EF各0.01|
|PRD.PrdID=3189|ToEnergyProduction=100；DegradationRateEP=0.5|

原 `FullSelfSupply` 会联动实际物料量，不能假设 `ToEnergyProduction=100` 就是最终进入消化器100kg；该测试中底物 C=217.34245657425748kg、剩余 C=108.67122828712874kg、CH4=121.71177568158417m³、能量=4357.281569400713MJ。消化物矿质N=-5.042843011805027kg、有机N=8.104150037547601kg，总N=3.061307025742575kg；这是用来检查原算法固持行为的人工参数组合，不能称成可行农场。[S7 原反事实 probe/结果]

|网络模式/元素|内部节点|连接数|TotalSystemThroughput，kg元素/year|FinnCyclingIndex_1980（比值）|
|---|---:|---:|---:|---:|
|Simple C|5|18|22637.77776367958|0.10609140632367195|
|Simple N|5|17|1469.5171813144234|0.09693343155730949|
|Simple P|5|15|325.1791607698267|0.1076432362000694|
|Simple K|5|15|873.4722577999114|0.2836394564421175|
|Complex C|21|86|20289.500010859076|0|
|Complex N|25|115|1592.3356084597722|0.03399051986636336|
|Complex P|24|102|353.66798254621585|0.031842795981182864|
|Complex K|24|100|944.1119094098434|0.11797911373866173|

两个模式下水与能量/GHG均相同：需求140m³、可用2000m³，4357.281569400713MJ，7.861201548306375Mg CO2eq。网络指标随节点划分改变是原模型行为。完成这些运行后再次计算原作者 `Input/FarmDB.mdb`、`Input/de.mdb` 的 SHA-256，仍与 §1 所列哈希完全相同；所有写入仅发生于临时工作副本。[S7 合成测试JSON、原文件哈希复核]

这些结果证明原始引擎能以无 GUI 的本地方式调用，解决了“完整 FarmDESIGN 做进去”的核心软件来源问题。它们不证明网站已经把每项功能接通，也不证明原作者越南案例就是海南真实参数；两者必须在最终端到端验收中分别验证。缺少的 NFD 附属文件、未配置的生物能参数、原版历史 GHG 因子和目标产量假设应在界面中有具体可见的输入状态与说明。
