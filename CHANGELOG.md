## 0.3.14 · 2026-10-03 — Metric evidence and frozen run records

- Explain the five existing screening metrics with units, selected-actor boundaries, independent three-month periods, exclusions and stable Paper evidence links. All remain synthetic, uncalibrated grade-D implementations; literature definitions and parameters are not adopted into calculation.
- Capture actual crop coefficients, original run inputs, declared engine-source hashes and complete output accounting once per search. Separate computational and explanatory SHA256 digests; keep legacy input markers and ranking views unchanged.
- Selected snapshots retain only their selected output and baseline with compact provenance. Historical snapshots receive no current-parameter backfill. Content digests are not signatures, runtime attestations or scientific validation.
- Load release metadata independently, distinguish pending/consistent/unavailable states, and update only an already-open version dialog. Missing build identity leaves an explicitly incomplete record without suppressing numerical results.

## v0.3.13 — Complete Pareto Results (2026-10-03)

- 完整保留已检验候选中的非支配集，36条限制仅用于图表和表格分页；完整计算导出包含全部候选。
- 排序偏好使用原可行集归一化范围即时重排，保留候选身份、原搜索输入及指纹；已保存快照不变。
- 完整搜索仅留在当前会话内存，项目包和本地方案库仍只保存已选方案；新增分页、跨页选择、快照、地图预览、导出及偏好回归测试。
- 科学核算、支配规则、候选生成、数据版本与地图不变，模型版本保持 screening-0.2.0。

## v0.3.12 — Continuous Hainan Imagery (2026-10-03)

- 本岛连续卫星图按五档缩放加载，14级起使用约9.5×10m显示格，保留质量透明区和跨日期接缝
- 114个细块、56个分级图经过完整产物与原源控制核验；来源日期、覆盖与限制可下载
- 本岛显示优先同源预处理图块，离岸继续使用原COG来源；农场模型参数和FTW几何不变

## v0.3.11 — Hainan Data Map (2026-10-03)

- Opens the provincial data map directly, with full-island/detail controls and explicit source versus display resolution.
- Displays continuous mainland classification and surface-elevation tiles locally; preserves cloud, source-zero and prediction-gap semantics.
- Retains accepted satellite pixels during slow or failed reads and retries missing work in place.
- Preserves the research routes, FTW geometries and farm model.

## v0.3.10 — Hainan Coverage Register (2026-10-03)

- Adds a browsable register of selected source grids, verified preview windows and named OSM objects, with sparse sample evidence kept distinct from whole-island coverage.
- Explains current raster blank areas and source read failures with a retry action.
- Adds the source Sansha OSM relation as a separately labeled partial community reference, including sea and preserving unresolved official-boundary status.
- Preserves the farm model, 110 original FTW geometries and scenario inputs.

# 0.3.9 · 2026-10-03

- Regional2025 imagery, source-class crops, terrain, rainfall and soil display with explicit resolution and coverage records
- Main-island18-unit OSM community reference, including Wuzhishan; Sansha geometry and official-current status remain unresolved
- Cancellable viewport COG renderer with correct UTM/WGS84/WebMercator sampling, clear no-data handling and source-only model boundary

# 更新日志

## v0.3.8 — 海南主岛覆被面积探索性汇总 · 2026-10-01

- 下载第二幅 ESA WorldCover 2021 v200 原始瓦片，使用两幅 10 m 分类 COG 计算海南主岛的探索性类别面积；处理脚本和源文件哈希可追溯。
- 主岛掩膜由产品的 100 m 概览推得，100 m 与 200 m 采样的掩膜面积相差约 0.16%；地图侧栏用双语条形图展示类别比例与面积。
- 图表明确区分分类覆被、官方耕地统计与现势市县面积；本地精度验证和区域模型就绪状态不变。

## v0.3.7 — 海南统计单元审计与研究页易读性 · 2026-10-01

- 核读 2023 年海南行政及农业统计表，指出 18 个历史边界面含琼山市却缺五指山市，不能与 18 个农业统计行直接连接。
- 图谱旁加入统计单元核对卡片及来源文档，研究数据审计同步修正县域资料状态。
- 放大研究页文字、图谱及交互控件，优化桌面与手机布局；保留中英及双语显示。

## v0.3.6 — 图层切换状态修复 · 2026-10-01

- 切换海南土地覆被、pH 和 SOC 图层时先隐藏旧图，明确显示加载状态；只有新图像完成加载才显示对应图层，避免图例与地图短暂错配。加载失败时显示错误并允许重试。
- 浏览器回归增加图像加载完成检查。

## v0.3.5 — 海南空间证据图谱 · 2026-10-01

- 路线二加入可切换的真实空间图层：ESA WorldCover 2021 土地覆被预览及 ISRIC SoilGrids 0–5 cm pH、SOC 模型预测；地图点击可读取所选土壤图层的预测像元。
- 新增 11 类土地覆被图例、pH 色标、比例尺、透明度、来源与年份说明，以及中英双语布局。
- 2017 年 geoBoundaries 县级几何仅作默认关闭的历史定位参考；与现势市县统计单元保持隔离。
- 处理脚本、衍生文件元数据与来源审计入库。农场模型参数和区域研究就绪状态均未因地图接入而变更。
- 修复点击地图空白区域被语言状态误判、导致整页重渲染的问题。

## v0.3.4 — 路线二可检验研究协议 · 2026-09-30

- 路线二新增三个可证伪的问题：区域分型是否有用、分区措施是否改变选择、适应性调整是否值得成本。
- 形成独立的研究协议、平台架构、方法证据笔记与术语表，明确主体权限、两层模型、样本上推条件、旱季水情景与资料不足时的降级规则。
- 核对海南年鉴的市县农业表目录，未把目录当作已提取的县域数据。
- 研究页提供协议与证据入口；保留 Dong 等（2026）全岛氮磷研究的独立证据身份。模型版本及区域数据就绪状态不变。

## v0.3.3 — 海南氮磷边界文献证据 · 2026-09-30

- 研究路线页加入 Dong 等（2026）全岛氮磷边界、2030 情景结果与原文位置，区分论文模型输出和本平台资料。
- 数据审计记录该论文已核读，但补充材料、参数、县域与农场资料未接入；模型和阶段就绪状态保持不变。
- 记录原文情景标注、磷输出合计及氮投入系统边界的待复核问题；新增双语文案。

## v0.3.2 — 海南路线二讨论方案 · 2026-09-30

- 路线二明确研究问题，并把 Topic 6 的识别差异、建模和多目标适应性设计目标迁移至海南尺度。
- 研究页加入旱季水约束示例和农户、农场、村落、海南四级平台设计；全部标为待讨论、未实施。
- 数据关口补充典型经营系统与区域分型连接的选样、权重和权限缺口；农场模型及区域数值结果不变。
- 更新中英文与双语文案，保留两个路线、数据审计和来源状态。

## v0.3.1 — 中英文显示 · 2026-09-30

- 顶栏新增中文、English、中英双语三种显示模式，切换后立即生效，刷新后保留选择。
- 九个页面及地图、图表、弹窗、动态提示均使用随网站打包的英文文案；不依赖在线翻译服务。
- 语言偏好使用独立的浏览器存储键，不写入项目备份；模型、默认数据和区域审计版本不变。
- 中英双语在内容区并列展示，移动端使用紧凑切换按钮；离线缓存包含翻译文件。

## v0.3.0 — Research Routes · 2026-09-30

- 新增“研究路线”首页，并列保留 proposal 农场系统主线与海南全域备选方案；后者标明待导师组确认。
- 加入海南省统计局公布的 2025 年省级粮食播种面积、粮食、蔬菜和水果产量，仅作全省背景展示。
- 建立农场与全域两套数据审计清单，写明来源状态、时空粒度、用途和缺口，并可导出 CSV。
- 三阶段数据就绪关口只接受已接入并核验的证据；禁止把确认有数据源误说成完成区域模型。
- 应用升至 0.3.0；农场模型 `screening-0.2.0` 和默认数据 `evidence-2025-r1+assumptions-r2` 未变。区域审计独立标为 `hainan-audit-2026-09-30-r1`；浏览器本地工作区沿用 v2，不覆盖已有方案。

## v0.2.0 — Spatial Evidence · 2026-09-30

研究预览版本；不是生产系统或经验证的数字孪生。

### 空间与可视化
- 移除默认数据中任意生成的36个几何图斑。以FTW/PRUE 2025公开预测几何建立证据底座。
- 在已下载1170个单元中，统一保留有效Polygon、WGS84椭球面积≥0.1ha、完全位于本地影像中、与OSM农业斑块的UTM投影面积重叠≥90%的全部单元。结果110个、70.7836409ha；保留源顶点、孔洞，不平滑、挪动、切分或追求规则外观。
- 默认地图使用2025-03-22 Sentinel-2 L2A 10m历史RGB快照。本地Leaflet 1.9.4支持平滑缩放、移动、源图对照、透明度、定位、全屏和辅助源图层。
- 重构研究工作台的导航、地图、对象检查器、证据页和移动端；真实缺失字段与建模假设分开。
- 保留原有核算、规划、反馈、资源编辑、导入导出功能。

### 科学边界与核算
- FTW单元为公开遥感预测，不是实测田界、确权地籍或土地经营权。筛选是演示规则，不是独立精度验证或代表性抽样。
- 全部110个单元的源质量字段为缺失，不填造置信度；真实作物、经营主体、土壤氮和坡度保留未知。
- 13个“假设主体”、3个“假设协作组”仅用于模拟资源边界；不是13个真实农户或3个真实村落。
- 修复跨主体粪肥转移：逐户氮输入/输出计入其跨界转入/转出，整体边界不重复计算内部转移。
- 禁止未计投资就将年生地块转为新建鱼塘/果园。拒绝不存在/重复的主体ID、非有限计算值。
- 数据来源、SHA-256、面积、完整性、相互重叠及影像覆盖形成可导出的质控报告。

### 版本与兼容
- 应用0.2.0、模型screening-0.2.0、数据evidence-2025-r1+assumptions-r2分开显示并在方案/项目导出中记录。
- 新本地工作区键为`farmsystem-workspace-v2`。旧v1数据不覆盖，可从版本面板导出。
- 导入旧项目仍保留旧图斑“虚拟”身份，不能将其自动认作FTW几何。
- 更新同源离线缓存版本，不缓存或批量预取OSM在线瓦片。

## v0.1.0 — 初始研究原型 · 2026-09-29

公开OSM背景、NASA POWER 2025月度气象、MODIS浏览影像及虚拟经营系统；提供多尺度资源核算、离散候选搜索、方案快照、反馈和本地数据工具。
该版本的36个虚拟地块不代表真实农业地块，已由v0.2.0默认数据替换，但Git历史保留。
