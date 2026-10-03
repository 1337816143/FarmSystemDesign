import {BASE_TRANSLATIONS} from './translations.generated.js';
import {VERSION} from './version.js';

export const LANGUAGE_KEY = 'farmsystem-language-v1';
export const LANGUAGES = ['zh', 'en', 'both'];
const HAN = /[\u3400-\u9fff]/;
const ORIGINAL_TEXT = new WeakMap();
const ORIGINAL_ATTRIBUTES = new WeakMap();
const ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'alt'];

// Reviewed research terms take precedence over the generated draft catalog.
const REVIEWED = {
  "保留已保存的输入、范围和版本；参数来源以各快照记录为准": "Retain saved inputs, scope and versions; parameter provenance depends on each snapshot record",
  "指标定义与论文证据": "Metric definitions and paper evidence",
  "运行记录与内容摘要": "Run record and content digests",
  "来源记录": "Provenance record",
  "构建信息加载中": "Loading build information",
  "暂未取得一致的构建信息": "Consistent build information is currently unavailable",
  "版本状态独立于地图加载；构建身份一致不代表科学模型已校准。": "Version status loads independently of map resources. Consistent build identity does not mean the scientific model is calibrated.",
  "输入已变化或快照正在准备，请稍后重试。": "Inputs have changed or the snapshot is being prepared. Try again shortly.",
  "输入或候选结果已变化，请重新选择并保存。": "Inputs or candidate results changed. Select a candidate again before saving.",
  "输入或候选结果已变化，请关闭后重新运行。": "Inputs or candidate results changed. Close this dialog and run again.",
  "完整计算包含原始输入、几何和备注，仅下载到本地；分享前请检查私人信息。": "The full calculation includes original inputs, geometry and notes, downloaded locally only. Check private information before sharing.",
  "为五项现有指标添加单位、统计边界与论文证据说明，保持假设筛选与科学验证分开": "Added units, accounting boundaries and paper evidence for the five existing metrics, separating hypothetical screening from scientific validation",
  "运行记录冻结实际参数、输入、输出及声明的引擎源码身份，计算与解释分别保存SHA256摘要": "Run records capture actual parameters, inputs, outputs and declared engine-source identity, with separate computational and explanatory SHA256 digests",
  "完整前沿只存一份；历史方案保持原记录，不补入当前参数": "The complete frontier is stored once; historical plans retain their original records without current-parameter backfilling",
  "版本信息独立加载，明确显示加载中、身份一致或暂不可用": "Version information loads independently and explicitly shows pending, consistent identity or unavailable states",

  "本岛114个连续近10m卫星显示细块与56个分级预览，按视野加载": "114 continuous near-10m mainland display blocks and 56 overview blocks load by viewport",
  "14级起显示最细图格，质量透明区保留；来源日期、覆盖CSV和方法可查": "Finest display cells start at zoom14. Quality gaps stay transparent; source dates, coverage CSV and methods are available",
  "本岛不再实时拼接远程COG，离岸区域仍保留原来源读取": "Precomputed mainland imagery replaces live COG mosaicking; offshore views retain original-source reads",
  "原FTW预测边界与农场假设模型保持原有行为": "Original FTW predicted boundaries and hypothetical farm-model behavior are preserved",
  "本岛连续约30m；低缩放247m概览": "Continuous mainland ~30m; 247m overview at low zoom",
  "本岛已接入连续110块约30m地表高程，包含植被/建筑；源零值与缺测分别保留，三沙仍有缺口。": "110 continuous ~30m mainland elevation tiles are available, including vegetation/buildings. Source zeros and missing values remain separate; Sansha gaps remain.",

  "首页直接打开海南数据地图，提供全岛与来源细节入口、当前显示尺度和逐层加载状态": "The homepage opens the Hainan data map with island/detail views, current display resolution and per-layer loading status",
  "本岛2025分类与30m地表高程按连续本地分块显示，保留来源零值和预测缺口": "Local continuous tiles display 2025 mainland classification and 30 m surface elevation, preserving source zeros and prediction gaps",
  "卫星读取逐步显示有效像元，超时保留已读成果，失败可原位重试": "Satellite reads progressively display accepted pixels, retain partial results on timeout and retry in place",
  "原FTW预测边界、研究路线和农场假设模型继续保留": "Original FTW predictions, research routes and hypothetical farm model remain available",

  "海南数据地图": "Hainan data map",
  "案例区空间与资源": "Case spatial resources",
  "卫星影像、土地覆盖、行政参照与环境图层；从海南本岛开始浏览。": "Satellite imagery, land cover, boundary references and environmental layers; start with Hainan Island.",
  "打开案例农场地图": "Open the case farm map",
  "打开海南数据地图": "Open the Hainan data map",
  "当前是崖州案例窗口；海南本岛与离岛图层在数据地图。": "This is the local Yazhou case window. Hainan Island and offshore layers are in the data map.",

  "按172真实源图幅、11预览与137具名OSM对象分列覆盖证据，保留无值/排云/未核状态": "Coverage evidence separates172 true raster footprints,11 previews and137 named OSM objects, retaining no-value, cloud-screened and unverified states",
  "地图实时区分无概览、目录外、质量排除、源无值与请求/解码失败，并支持重试；定向补充两处原查询框遗漏和6处质量缺口": "Live map diagnostics separate absent overviews, catalog limits, quality rejection, no-value and read failures, with retry; targeted dates address two query omissions and six quality gaps",
  "新增真实三沙OSM父关系部分范围参考；不作为官方完整行政界或陆地掩膜": "Adds the actual Sansha OSM parent as a partial reference, not an official complete boundary or land mask",
  "模型、FTW田块和经营情景未改动": "The model, FTW field geometries and operating scenarios remain unchanged",

  "2025全域影像按视窗读取，保留云与缺测": "2025 regional imagery uses viewport reads and preserves clouds and missing observations",
  "接入30m地形来源、5.5km降水和250m土壤，分别注明网页概览精度": "30 m terrain source, 5.5 km rainfall and 250 m soil retain separate web overview resolutions",
  "加入本岛18单元OSM社区参考界；三沙完整聚合面仍缺失": "Added18 main-island OSM community reference units; complete Sansha aggregate geometry remains missing",
  "原FTW田块、虚拟经营参数和农场模型保持不变": "Original FTW fields, hypothetical operating parameters and farm model remain unchanged",
  "2025全域Sentinel-2影像": "2025 regional Sentinel-2 imagery",
  "RGB10m / SCL20m；网页概览另标": "Native RGB10m / SCL20m; web overview stated separately",
  "2025多日期": "2025 multi-date",
  "空间证据浏览": "Spatial evidence browsing",
  "已按视窗接入候选COG与真实拼图；SCL不保证完全无云，离岛仍按像元报告缺口。": "Candidate COG viewport reads and actual mosaics are integrated. SCL does not guarantee cloud-free imagery; offshore gaps remain explicit.",
  "2025 Esri作物类别": "2025 Esri source Crops class",
  "10m原始分类": "Native10m classification",
  "来源分类对照": "Source classification comparison",
  "Crops=5不是法定耕地；与WorldCover不同产品面积不得作为时序变化。": "Crops=5 is not statutory cultivated land. Areas from different products such as WorldCover must not be interpreted as temporal change.",
  "Copernicus地表高程": "Copernicus surface elevation",
  "约30m来源；总览247m/989m": "Approx.30m source; overviews247m/989m",
  "主体2011–2015": "Mainly2011\u20132015",
  "地形背景": "Terrain context",
  "地表模型包含植被/建筑；细窗与全域概览分开，小岛零值不冒充现势地形。": "The surface model includes vegetation/buildings. Detail windows and regional overviews are distinct; island source zeros do not imply present-day terrain.",
  "CHIRPS2025年降水": "CHIRPS2025 annual rainfall",
  "0.05°约5.5km": "0.05\u00b0, about5.5km",
  "气候背景": "Climate context",
  "真实年降水格网；海域和部分小岛无值，不是10m气候，也不是地块观测。": "Actual annual rainfall grid; ocean and some small islands have no values. Not10m climate or parcel observations.",
  "OSM本岛18单元社区边界": "OSM18 main-island community reference units",
  "WGS84社区几何": "WGS84 community geometry",
  "2026-10-03下载快照": "Snapshot downloaded2026-10-03",
  "非官方位置参照": "Non-authoritative orientation",
  "含五指山，未混入琼山区；三沙完整面缺失，不代表权威现势界或可直接用于县域统计。": "Includes Wuzhishan without mixing in Qiongshan district. Complete Sansha polygon missing; not authoritative current boundaries or ready for county statistics.",

  "全域 Sentinel-2 · 10 m": "Regional Sentinel-2 \u00b7 10 m",
  "2025-03-22 原快照": "2025-03-22 original snapshot",
  "影像2025多日期 · SCL排云": "2025 multi-date imagery \u00b7 SCL cloud masking",
  "影像2025-03-22 · 历史快照": "2025-03-22 historical snapshot",
  "参考底图": "Reference basemap",
  "2025 多日期影像加载中 · 云区保留缺口": "Loading 2025 multi-date imagery \u00b7 cloud gaps retained",
  "影像服务暂不可用；可在海南图谱查看同源整岛概览": "Imagery service unavailable; same-origin island overview is available in the atlas",
  "2025多日期 · RGB原生10m · WGS84 · 无数据透明": "2025 multi-date \u00b7 native RGB 10 m \u00b7 WGS84 \u00b7 no data transparent",
  "全域影像暂不可用，请重试": "Regional imagery unavailable; please retry",

  '10 m 原生；17/18级仅放大': 'Native 10 m; zoom 17/18 enlarged only',
  '空间数据模式 / Spatial data': 'Spatial data mode',
  '空间数据模式': 'Spatial data mode',
  '原版 FTW 2025 田块预测': 'Original FTW 2025 field prediction',
  '新版 2025 Crops 分类=5': 'New 2025 Crops class=5',
  '2025 完整分类（含云类）': '2025 All classes (including clouds)',
  '依据与覆盖范围': 'Basis and coverage',
  'FTW 2025 预测边界；非地籍 / Predicted field boundaries': 'FTW 2025 predicted field boundaries; not cadastral',
  '2025 Crops=5；透明区可能是其他类别、云或无数据，切换完整分类核查 / Crops class only': '2025 Crops=5; transparent may be other classes, cloud or no data. Check all classes.',
  '2025 分类：云=10；透明=无数据 / Clouds=10; transparent=no data': '2025 classes: clouds=10; transparent=no data',

  '10 m 原始分类 · 约 300 m 地图预览': '10 m native classes · about 300 m map preview',
  '海南主岛空间背景与探索性面积': 'Hainan main-island context and exploratory area',
  '已按原始像元汇总产品派生主岛掩膜的类别面积；掩膜约 100 m 采样。尚无现势市县面积和海南本地分类精度验证。覆被不是法定土地用途或经营权。': 'Native class pixels were summarized for a product-derived main-island mask sampled at about 100 m. Current county areas and local Hainan classification accuracy remain unverified. Cover is not legal land use or management rights.',
  '从 ESA WorldCover 2021 两幅原始 10 m 分类瓦片计算海南主岛探索性覆被面积': 'Calculated exploratory Hainan main-island cover areas from two native ESA WorldCover 2021 10 m tiles',
  '地图侧栏增加类别面积条形图，明确产品派生掩膜与官方土地统计的区别': 'Added class-area bars to the map, distinguishing the product-derived mask from official land statistics',
  '复核 100 m 与 200 m 掩膜采样的面积敏感性，记录处理脚本和源文件哈希': 'Checked area sensitivity to 100 m and 200 m mask sampling and recorded the processing script and source hashes',
  '现势市县面积、本地分类精度验证与区域优化仍未完成': 'Current county areas, local classification accuracy validation and regional optimization remain incomplete',
  '2023 年单表已核读；时序待核对': 'One 2023 table reviewed; time series pending',
  '2024 版年鉴表 12-1 已核读 2023 年 18 个岛内农业行；最新年鉴、逐年口径和可再发布范围仍待核对。': 'Table 12-1 in the 2024 yearbook was reviewed for 18 island agricultural rows in 2023. The latest yearbook, year-by-year definitions and republication rights still need checking.',
  '历史 18 面含琼山市、缺五指山市；2023 年鉴行政表有 19 行（含三沙），农业表有 18 行。不能按行数把旧面与现势统计量连接。': 'The 18 historic shapes include Qiongshan but omit Wuzhishan. The 2023 yearbook has 19 administrative rows including Sansha and 18 agricultural rows. Equal counts do not permit joining old shapes to current statistics.',
  '核对 2023 年海南行政统计行、农业统计行与历史边界，标明琼山和五指山不匹配': 'Checked Hainan 2023 administrative and agricultural rows against historic borders, identifying the Qiongshan–Wuzhishan mismatch',
  '图谱显式展示统计单元差异与核对文档，禁止旧边界直接承载现势填色图': 'The atlas now shows unit differences and an audit link; old borders cannot directly support a current county choropleth',
  '提高研究页文字和地图可读性，调整桌面与移动端布局': 'Improved readability of research text and maps on desktop and mobile',
  '保持空间图层仅供背景展示，区域优化继续等待参数和独立验证': 'Spatial layers remain background evidence; regional optimization still awaits parameters and independent validation',
  '切换地图图层时显示加载状态，避免旧图像配新图例': 'Show a loading state while switching map layers so the old image is never paired with the new legend',
  '研究预览 · 2026-10-01': 'Research preview · 01-10-2026',
  '接入 ESA WorldCover 2021 海南土地覆被预览与 ISRIC SoilGrids 0–5 cm pH 预测栅格': 'Added an ESA WorldCover 2021 Hainan land-cover preview and ISRIC SoilGrids 0–5 cm pH prediction raster',
  '接入 ESA WorldCover 2021 海南土地覆被预览与 ISRIC SoilGrids 0–5 cm pH 与 SOC 预测栅格': 'Added ESA WorldCover 2021 Hainan land cover and ISRIC SoilGrids 0–5 cm pH and SOC prediction rasters',
  '增加可交互的双语海南图谱、像元查询、图例和来源说明': 'Added a bilingual interactive Hainan atlas with pixel queries, legends and source details',
  '历史县级参考边界与现势统计单元隔离，区域模型仍未就绪': 'Kept historical county borders separate from current statistical units; the regional model remains unready',
  '可追溯的现势市县边界与代码': 'Traceable current county boundaries and codes',
  '2017 年第三方参考边界已作位置示意，但名称明显过时，不能对应现势 19 个统计单元。须核对法定统计单元与边界版本。': 'A 2017 third-party boundary is available for orientation, but its names are clearly outdated and cannot match the 19 current statistical units. Official statistical units and boundary versions must be reconciled.',
  'geoBoundaries 历史县级位置参考': 'geoBoundaries historical county reference',
  '海南岛 · 历史县级几何': 'Hainan Island · historical county geometry',
  '标称 2017；部分名称更早': 'Labeled 2017; some names are older',
  '地图定位参考': 'Map orientation reference',
  '已提取 18 个岛内要素；仅供叠加查看，默认关闭。不能用于现势市县数据连接或面积计算。': 'Eighteen island features were extracted. The optional overlay is off by default and cannot be used to join current county data or calculate areas.',
  'ESA WorldCover 土地覆被': 'ESA WorldCover land cover',
  '10 m 源数据 · 约 300 m 网页预览': '10 m source · about 300 m web preview',
  '2021 v200': '2021 v200',
  '海南岛空间背景': 'Hainan Island spatial context',
  '已接入真实分类图层；尚未核算市县面积。覆被不是法定土地用途、经营权或作物结构。': 'A real classified layer is displayed. County areas have not been calculated. Cover is not legal land use, operating rights or crop structure.',
  'ISRIC SoilGrids 表层 pH 预测': 'ISRIC SoilGrids topsoil pH prediction',
  'ISRIC SoilGrids 表层 pH 与 SOC 预测': 'ISRIC SoilGrids topsoil pH and SOC predictions',
  '250 m 源数据 · 0–5 cm': '250 m source · 0–5 cm',
  'SoilGrids 2.0': 'SoilGrids 2.0',
  '海南岛土壤差异背景': 'Hainan Island soil variation context',
  '已接入 WCS 栅格及可查询像元；仍需本地样点和不确定性核对，不能标成田块实测或优化参数。': 'A WCS raster and queryable pixels are displayed. Local samples and uncertainty checks remain needed; these are not field measurements or optimization parameters.',
  '已接入两项 WCS 栅格及可查询像元；仍需本地样点和不确定性核对，不能标成田块实测或优化参数。': 'Two WCS rasters and queryable pixels are displayed. Local samples and uncertainty checks remain needed; these are not field measurements or optimization parameters.',
  '方案如何接受检验': 'How the proposal will be tested',
  '三个研究问题，以及可能推翻方案的证据': 'Three research questions and evidence that could overturn the proposal',
  '先完成可重复的市县时序与分型；措施效应和适应性优势都需要响应参数与独立验证。': 'First build reproducible county time series and typologies. Intervention effects and adaptive gains require response parameters and independent validation.',
  '拟检验 · 无结果': 'Proposed tests · no results',
  'Q1 · 类型是否有用？': 'Q1 · Are the types useful?',
  '用留出年份或地区比较区域分型与统一基准；分型不稳就报告连续差异。': 'Compare regional types with a common baseline using held-out years or areas. If types are unstable, report continuous differences.',
  'Q2 · 分区措施有何不同？': 'Q2 · Do regional packages differ?',
  '在相同预算与资源边界下比较分区和统一措施；差异小于不确定性就不宣称优越。': 'Compare tailored and uniform measures under the same budget and resource limits. Do not claim superiority if differences are within uncertainty.',
  'Q3 · 何时值得调整？': 'Q3 · When is adaptation worthwhile?',
  '固定与分阶段策略使用相同情景、信息到达时点和转换成本，检验较差情景表现。': 'Test fixed and staged strategies using the same scenarios, information timing and switching costs, including performance in poor outcomes.',
  '第一步：核对官方年鉴中的市县农业表与统计修订；目录存在不等于数据已接入。': 'First, check county agricultural tables and statistical revisions in the official yearbooks. A listed table is not integrated data.',
  '阅读完整研究协议 ↗': 'Read the full research protocol ↗',
  '查看方法与数据来源 ↗': 'Review methods and data sources ↗',
  '查看平台对象与迁移顺序 ↗': 'Review platform entities and migration steps ↗',
  '路线二补充可证伪的三个研究问题与研究协议': 'Route 2 now includes three falsifiable questions and a research protocol.',
  '明确四级尺度的权限、跨尺度连接条件及资料不足时的结论边界': 'Defined decision rights at four scales, cross-scale linking conditions and conclusions supported when evidence is limited.',
  '核对区域农场分型方法及海南年鉴市县农业表目录；尚未提取表内数值': 'Checked regional farm-typology methods and the Hainan yearbook contents for county agricultural tables; table values have not been extracted.',
  '已核读文献 · 尚未接入模型': 'Full-text literature reviewed · not integrated into the model',
  '海南农业增产目标与氮磷环境边界': 'Hainan production targets and nitrogen–phosphorus boundaries',
  'NUFER 作物—畜牧氮磷物质流与生产／环境阈值；历史 1988–2020，情景 2030 BAU、S1–S5。': 'NUFER crop–livestock N and P flows with production and environmental thresholds; history 1988–2020, scenarios 2030 BAU and S1–S5.',
  '海南岛整体': 'Hainan Island as a whole',
  '氮：生产所需最低投入': 'N: minimum input for production',
  '氮：不同环境终点的投入上界': 'N: input upper bounds for different environmental endpoints',
  '磷：生产下界／径流环境上界／2020 投入': 'P: production lower bound / runoff upper bound / 2020 input',
  'S5：相对 2020 减少氮／磷投入': 'S5: reduction in N / P inputs relative to 2020',
  'S5：目标产量需氮达成': 'S5: N demand met for the target yield',
  'Gg N／年': 'Gg N/year',
  'Gg P／年': 'Gg P/year',
  '模型情景': 'Model scenario',
  '摘要；§3.2': 'Abstract; §3.2',
  '阈值和情景均为全岛模型结果；不能直接分配到市县或地块，也不能充当本平台的实测参数。需取得补充材料、NUFER 配置和分区损失系数，先核对各项投入的系统边界。': 'Thresholds and scenarios are island-wide model results. They cannot be allocated directly to counties or fields or treated as measured inputs for this platform. Supplementary material, NUFER settings and zone-specific loss factors are needed, along with checks of each input system boundary.',
  'Dong 等（2026）海南氮磷边界研究': 'Dong et al. (2026) study of Hainan N and P boundaries',
  '全岛模型 · 年度／2030 情景': 'Island-wide model · annual / 2030 scenarios',
  '1988–2020；2030 情景': '1988–2020; 2030 scenarios',
  '营养约束候选与跨尺度问题定义': 'Candidate nutrient constraints and cross-scale question framing',
  '已核读论文；补充材料、原始数据及模型参数未接入。全岛阈值不能直接下推市县或农场。': 'The paper has been reviewed; supplementary material, original data and model parameters have not been integrated. Island-wide thresholds cannot be directly downscaled to counties or farms.',
  '加入 Dong 等（2026）海南氮磷边界文献证据及来源口径': 'Added Dong et al. (2026) evidence on Hainan nutrient boundaries and source definitions',
  '阈值仅作为全岛模型结果与研究问题背景；未进入农场或区域模型': 'Thresholds are island-wide model results used to frame research questions; they are not inputs to the farm or regional model',
  '市县／农业生态分区；省域汇总与协调': 'County or agroecological zones; provincial synthesis and coordination',
  '面对海南各地生产条件与风险差异，哪些分区措施组合能改善食物供给、经营收益和资源表现，并能随新信息调整？': 'Given differences in production conditions and risks across Hainan, which regional packages can improve food supply, farm returns and resource outcomes while adapting to new information?',
  '市县时序与农业系统分型': 'County time series and farming system typology',
  '区域措施组合及固定／分阶段策略比较': 'Regional packages and comparison of fixed and staged strategies',
  '典型农户、农场的可实施性检验': 'Feasibility checks with representative households and farms',
  '区域情景与典型系统检验': 'Regional scenarios and representative system checks',
  '典型农户／农场与区域分型连接': 'Link representative households or farms to regional types',
  '经营主体 · 类型 · 分区': 'Operator · type · zone',
  '待抽样': 'Sampling pending',
  '措施可实施性与跨尺度检验': 'Intervention feasibility and cross-scale checks',
  '需定义选样、类型、经营权限及权重；少数案例不能直接代表全省。': 'Sampling, types, management rights and weights need to be defined. A few cases cannot directly represent the province.',
  '路线二 / 讨论版方案': 'Route 2 / discussion draft',
  '海南农业系统的跨尺度适应性规划': 'Cross-scale adaptive planning for Hainan farming systems',
  '研究主张：先识别区域差异，再连接典型经营系统，最后比较有权限与资源边界的分区措施组合。': 'Proposed approach: identify regional differences, connect representative farm systems, then compare packages within decision rights and resource limits.',
  '构思草案 · 未实施': 'Concept draft · not implemented',
  '01 / 空间与时间识别': '01 / Spatial and temporal mapping',
  '按市县年份建立同口径生产与资源资料，再依据证据划分农业系统类型，识别变化和风险。': 'Build comparable county-by-year production and resource records, then classify farming systems to identify change and risk.',
  '02 / 跨尺度建模': '02 / Cross-scale modelling',
  '建立区域活动与资源核算；用有抽样依据的典型农户、农场检查区域措施的经营可行性。': 'Account for regional activities and resources, then use sampled representative households and farms to check operational feasibility.',
  '03 / 方案与适应': '03 / Options and adaptation',
  '比较分区措施组合、固定策略和可更新策略；先做情景评估，参数与验证充分后再谈优化。': 'Compare regional packages, fixed strategies and strategies that can be updated. Assess scenarios first; optimize only when parameters and validation support it.',
  '示例情景：旱季水资源约束': 'Illustrative scenario: dry-season water constraint',
  '在适宜地区比较现状、节水管理与种植组合调整；保持不可即时改变的多年生作物和经营权边界。比较产出、收益、水需求及主体参与条件，并在典型农场检查措施是否可做。此处是待检验设计，没有计算结果。': 'In suitable areas, compare current practice, water-saving management and changes to crop mixes. Respect perennial crops and management rights that cannot change immediately. Compare output, returns, water demand and participation conditions; check feasibility on representative farms. This is a design for testing, with no computed results.',
  '通用平台：四级尺度，同一证据链': 'General platform: four scales, one evidence chain',
  '地理范围、实际决策者、数据粒度和模型适用范围分别记录；海南是区域汇总与协调层，不是一个经营主体。': 'Record geographic extent, actual decision-maker, data granularity and model scope separately. Hainan is a level for regional synthesis and coordination, not a single farm operator.',
  '农户': 'Household',
  '决定劳动、投入和参与条件；记录家庭目标与经营权限。': 'Decides labour, inputs and participation; records household goals and management rights.',
  '农场': 'Farm',
  '组合地块与生产活动，核算水、养分、劳动和收益。': 'Combines fields and activities, accounting for water, nutrients, labour and returns.',
  '村落': 'Village',
  '只在明确参与、共享规则与设施边界时比较协作方案。': 'Compares cooperation only when participation, sharing rules and facility limits are explicit.',
  '海南': 'Hainan',
  '以市县／分区为分析单元，汇总差异、比较政策与资源情景。': 'Uses counties or zones to synthesize differences and compare policy and resource scenarios.',
  '连接规则：地块关联经营主体与行政单元；典型主体只有在选样、类型和权重明确后才参与区域推断。各尺度共用活动、资源、情景和结果词典，模型与验证仍按尺度分别管理。': 'Linking rule: fields relate to operators and administrative units. Representative operators support regional inference only when sampling, types and weights are defined. Scales share vocabularies for activities, resources, scenarios and outcomes, while models and validation remain scale-specific.',
  '阅读完整研究与平台设计 ↗': 'Read the full research and platform design ↗',
  '路线二加入可讨论的海南尺度研究方案：区域分型、跨尺度建模与适应性情景': 'Route 2 now includes a discussion draft for Hainan: regional typology, cross-scale modelling and adaptive scenarios.',
  '通用平台加入农户、农场、村落、海南四级视角设计；科研模型及数据状态不变': 'The general platform now describes household, farm, village and Hainan views; research models and data statuses are unchanged.',
  '待导师组确认': 'Pending supervisor team confirmation',
  '课题尺度尚待 导师组确认': 'The research scale is pending supervisor team confirmation',
  '两条研究路线，一套证据边界。': 'Two research routes, each with a clear evidence boundary.',
  '保留 Topic 6 的农场系统设计主线，同时准备海南全域的区域研究方案；研究尺度和模型结论分别核验。': 'Retain the Topic 6 farm-system proposal while developing a Hainan-wide regional option. The proposed scale and any model findings require separate review.',
  '研究问题': 'Research question',
  '预期研究产出': 'Expected research outputs',
  '决策单元：': 'Decision unit: ',
  '来源：': 'Source: ',
  '海南省年度背景': 'Hainan province-level background',
  '当前案例原型': 'Current case prototype',
  '数据就绪关口': 'Data readiness gates',
  '逐项数据审计': 'Item-level data audit',
  '数据主题': 'Data topic',
  '时空粒度 / 时期': 'Spatial and temporal scale / period',
  '用于回答': 'Research use',
  '需要导师组明确的三项决定': 'Three decisions for the supervisor team',
  'PhD2 的主要决策单元：农场系统、市县／分区，或两者如何连接？': 'What should the main PhD2 decision unit be: the farm system, a county or zone, or a defined link between these scales?',
  '原 proposal 中的农场模型、数字孪生与 PhD1 协作保留到什么程度？': 'Which parts of the original proposal—farm model, digital twin and PhD1 collaboration—should be retained?',
  '全域路线的目标是诊断、情景评估，还是有独立参数与验证支撑的优化？': 'Should the Hainan-wide route deliver diagnosis, scenario assessment, or optimization supported by independent parameters and validation?',
  '海南全域方向仍在讨论中。这里并列保留两条研究路线；路线二是讨论方案，尚非已经批准的正式课题变更。': 'The Hainan-wide direction is still under discussion. Both research routes are retained here. Route 2 is a proposal for discussion, not an approved change to the PhD topic.',
  '省级统计值用于认识总体规模，不进入当前农场模型，也不拆分成市县估计。': 'Province-level statistics describe the overall scale. They are not inputs to the current farm model and are not disaggregated into county estimates.',
  '只有数据已接入并核验，阶段才显示就绪。确认来源、拥有地图或通过软件测试均不算科学验证。': 'A stage is ready only when its data have been integrated and checked. Confirming a source, having a map, or passing software tests does not establish scientific validity.',
  '公开预测几何与历史气候；经营主体、作物、资源和生产系数仍是假设。未地面核验，不用于确权或实际生产决策。': 'Public predicted geometries and historical climate data; operators, crops, resources and production coefficients remain assumptions. No field validation has been completed. Do not use this preview for land rights or real production decisions.',
  '公开预测边界 · 未地面核验': 'Public predicted boundary · not field validated',
  '未核验': 'Unverified',
  '虚拟演示': 'Synthetic demonstration',
  '模型估计': 'Model estimate',
  '公开网格': 'Public gridded data',
  '经营主体': 'Farm operator',
  '空间单元': 'Spatial unit',
  '地块': 'Field unit',
  '农场系统': 'Farm system',
  '海南省总体': 'Hainan Province total',
  '研究路线': 'Research routes',
  '案例区总览': 'Case overview',
  '空间与资源': 'Spatial resources',
  '系统分析': 'System analysis',
  '情景规划': 'Scenario lab',
  '方案与反馈': 'Plans & feedback',
  '数据中心': 'Data & provenance',
  '证据与质控': 'Evidence & quality',
  '研究说明': 'Research notes',
  '水稻': 'Rice',
  '露地蔬菜': 'Open-field vegetables',
  '豆科作物': 'Legumes',
  '覆盖 / 休养': 'Cover / fallow',
  '多年生果园': 'Perennial orchard',
  '水产塘': 'Aquaculture pond',
  '万亩': '10,000 mu',
  '万吨': '10,000 tonnes',
  '亩': 'mu',
  '万': '×10,000',
  '未获取': 'Not retrieved',
  '获取 未获取': 'Retrieval date unavailable',
  '公顷': 'hectares',
  '工日': 'person-days',
  '核算收益': 'Accounting margin',
  '收益': 'Margin',
  '灌溉 / 补水量': 'Irrigation / water replenishment',
  '氮收支余量（排序用绝对值）': 'Nitrogen balance (absolute value for ranking)',
  '可食能量代理': 'Food energy proxy',
  '基准条件': 'Baseline conditions',
  '蔬菜价格下跌': 'Vegetable price decline',
  '劳动力短缺': 'Labour shortage',
  '路线一 · 案例农场系统': 'Route 1 · Case farm system',
  'Proposal 主线': 'Original proposal route',
  '农户／农场及其经营地块': 'Farm households or farms and the fields they manage',
  '在地块、季节和经营约束下，种植与其他活动怎样组合，获得新信息后如何调整？': 'How can crop and other activities be combined under field, seasonal and management constraints, and adjusted when new information becomes available?',
  '经营系统现状与资源流': 'Baseline farm systems and resource flows',
  '可解释的农场模型': 'An interpretable farm model',
  '方案权衡、适应性调整及现场验证': 'Trade-offs, adaptive adjustment and field validation',
  '现有崖州窗口只有公开预测几何与虚拟经营资料；不能据此提出真实农户方案。': 'The current Yazhou case window contains public predicted geometries and synthetic operator data only. It cannot support recommendations for real farms.',
  '重建真实基准': 'Establish a real baseline',
  '检验模型响应': 'Test model responses',
  '比较适应性策略': 'Compare adaptive strategies',
  '路线二 · 海南全域': 'Route 2 · Hainan-wide regional study',
  '市县／经论证的农业生态分区': 'Counties or justified agroecological zones',
  '海南各地生产结构、资源压力和气候风险如何变化；哪些区域调整方向值得进一步检验？': 'How do production patterns, resource pressures and climate risks vary across Hainan, and which regional adjustments warrant further testing?',
  '同口径的区域差异与变化诊断': 'Comparable diagnosis of regional differences and change',
  '明确决策权限的区域情景比较': 'Regional scenarios with explicit decision authority',
  '由典型经营系统检验参数和可实施性': 'Test parameters and feasibility in representative farm systems',
  '省级汇总数不能拆成市县或地块；区域情景不能假定全省土地由单一主体自由调配。': 'Province-level totals cannot be treated as county or field data. Regional scenarios cannot assume that one actor can freely allocate all land in Hainan.',
  '市县时序诊断': 'County-level time-series diagnosis',
  '空间情景比较': 'Compare spatial scenarios',
  '可验证的区域优化': 'Regional optimization with independent validation',
  '2025 年全省农业总量': '2025 province-level agricultural totals',
  '已在平台展示；未进入分析模型。不能反推市县或农场。': 'Displayed as background only. These figures are not used in the model and cannot be used to infer county or farm values.',
  '市县农业生产时序': 'County-level agricultural time series',
  '市县 · 年度': 'County · annual',
  '年鉴入口已确认；表格、年份、行政区划变动和统计口径尚未提取核对。': 'The yearbook source has been identified. Tables, years, boundary changes and statistical definitions still require extraction and review.',
  '可追溯的市县边界与代码': 'Traceable county boundaries and codes',
  '市县 · 版本化': 'County · versioned',
  '须确定法定统计单元及边界版本，不能用演示地块拼成全省地图。': 'The official statistical units and boundary version must be established. Demonstration fields cannot be assembled into a province-wide map.',
  '10 m · 分类栅格': '10 m · classified raster',
  '250 m · 预测栅格': '250 m · predicted raster',
  '1950 年至今，按需选取': '1950 onward; period to be selected',
  '不是作物经营权或每年种植结构；需另行核对分类精度和适用年份。': 'Land cover does not identify crop management rights or annual cropping patterns. Classification accuracy and suitable years require separate checks.',
  '尚未取数与本地样点验证，不能标成逐田块实测。': 'Data have not been retrieved or checked against local samples. These predictions must not be labelled as field measurements.',
  '需要来源、迁移范围和不确定性；不能复用虚拟农场系数。': 'Sources, transferability and uncertainty must be established. Synthetic farm coefficients cannot be reused as regional parameters.',
  '需与建模输入分离；不能用优化得分验证优化本身。': 'Validation data must be independent of model inputs. An optimization score cannot validate the optimization itself.',
  'PhD1 的田间试验不能自动验证整个农场结果。': 'PhD1 field trials do not, by themselves, validate whole-farm outcomes.',
  '不能把村庄全部资源视作一个主体，或令已实施投资无成本逆转。': 'Village resources cannot automatically be pooled under one decision maker, and implemented investments cannot be reversed without cost.',
  '区域水、劳动力和成本约束': 'Regional water, labour and cost constraints',
  '经营权、实际作物、投入和产出均未核验。': 'Management rights, actual crops, inputs and outputs are all unverified.',
  '当前配额、价格和生产系数均为演示假设。': 'Current quotas, prices and production coefficients are demonstration assumptions.',
  '公开地图和省级总量都不能替代可分配资源、机会成本或水权。': 'Public maps and province-level totals do not establish allocable resources, opportunity costs or water rights.',
  '区域独立验证资料': 'Independent regional validation data',
  '农户—地块—活动管理资料': 'Farm household–field–activity management data',
  '逐期水、养分、劳动力与成本': 'Period-specific water, nutrients, labour and costs',
  '经营权限、共享规则和调整时点': 'Decision authority, sharing rules and timing of adjustments',
  '区域模拟': 'Regional simulation',
  '检验情景结论': 'Test scenario conclusions',
  '模型与策略检验': 'Model and strategy validation',
  '情景可行性': 'Scenario feasibility',
  '空间汇总': 'Spatial aggregation',
  '粮食播种面积': 'Area sown to grain',
  '粮食总产量': 'Total grain production',
  '蔬菜产量': 'Vegetable production',
  '水果总产量': 'Total fruit production',
  '海南省统计局《全年农业经济稳健运行》': 'Hainan Provincial Bureau of Statistics, “Steady Agricultural Economic Performance Throughout the Year”',
  '候选来源 · 未接入': 'Candidate source · not integrated',
  '已核对来源 · 未接入': 'Source checked · not integrated',
  '仅背景展示 · 不进模型': 'Background only · excluded from model',
  '已接入并核验': 'Integrated and checked',
  '关键缺口': 'Critical gap',
  '拟采用 · 非实施证明': 'Proposed adoption · not evidence of implementation',
  '候选快照': 'Candidate snapshot',
  '新增中文、英文与中英双语显示；语言偏好单独保存在浏览器': 'Added Chinese, English and bilingual display. Language preference is stored separately in this browser.',
  '覆盖页面、地图、图表、弹窗与动态提示；项目数据及农场模型不变': 'Localization covers pages, maps, charts, dialogs and dynamic notices. Project data and the farm model are unchanged.',
  '源几何逐坐标一致': 'Source geometry matches coordinate by coordinate',
  '保留原始顶点与孔洞，不进行平滑、切分或挪动': 'Original vertices and holes retained without smoothing, splitting or moving',
  'Polygon有效性与环闭合': 'Polygon validity and ring closure',
  '110 个入选单元': '110 selected units',
  '相互重叠检查': 'Overlap check',
  '容差0.01m²；0 对重叠': 'Tolerance 0.01 m²; no overlapping pairs',
  '影像完整覆盖': 'Complete image coverage',
  '入选几何完全位于本地Sentinel-2影像范围': 'Selected geometries lie entirely within the local Sentinel-2 image',
  '关联完整性': 'Relationship completeness',
  '每个单元关联一个明确标记的假设主体': 'Each unit is linked to an explicitly labelled hypothetical operator',
  '面积口径': 'Area calculation',
  'WGS84椭球面积，含孔洞；ha与亩通过1ha=15亩换算': 'WGS84 ellipsoidal area including holes; 1 ha = 15 mu',
  '未知属性保留缺失': 'Unknown attributes remain missing',
  '不从RGB编造作物、权属、土壤氮或NDVI': 'Crops, land rights, soil nitrogen and NDVI are not inferred from RGB imagery',
  '影像文件校验': 'Image file verification',
  'SHA-256与获取元数据一致': 'SHA-256 matches the retrieval metadata',
  '原始降水单位 mm/day；月总量 = 月平均日降水 × 当月天数。': 'Original precipitation unit: mm/day. Monthly total = mean daily precipitation × number of days in the month.',
  '公开数据不等于地面实测，地图细节不等于逐地块精度，未知的信息不伪装成已知。': 'Public data are not field measurements. Map detail does not establish field-level accuracy. Unknown attributes remain unknown.',
  '从已下载1170个空间单元中，按统一条件保留110个完整源几何。不是地籍，不保证逐地块准确。': 'Of 1,170 downloaded spatial units, 110 complete source geometries met the same selection rules. They are not cadastral parcels, and field-level accuracy is not established.',
  'OSM斑块与FTW可能共享影像信息；两者叠合不是独立真值验证。筛选会排除未被OSM覆盖的小农田，因此不用于区域总量估计或代表性抽样。': 'OSM patches and FTW predictions may share imagery. Their overlap is not independent ground-truth validation. Screening excludes small farms absent from OSM, so this sample cannot estimate regional totals or represent all farmland.',
  'SCL 的4、5、6、7类按本次规则计为可用；不是无云概率，也不是每个单元观测准确率。FTW 的质量字段来自500m区域层，不解释为逐块正确概率；本窗口字段全部缺失，显示“—”。': 'SCL classes 4, 5, 6 and 7 count as usable under this selection rule. This is neither a cloud-free probability nor observation accuracy for each unit. The FTW quality field comes from a 500 m regional layer and is not a probability that an individual field is correct; it is missing for every unit in this window.',
  '1 mm降水落在1 ha上为10 m³。有效降水比例：种植0.35、水产0.15（示意）。每个月都检查资源需求 ≤ 对应边界内可用配额，不把季度总量可行当成每月可行。': 'One millimetre of rain over one hectare equals 10 m³. Assumed effective rainfall fractions are 0.35 for crops and 0.15 for aquaculture. Resource demand is checked against available capacity each month; quarterly totals alone do not establish monthly feasibility.',
  '未施用粪肥及土壤 / 储存变化未被独立分解；负余量可能表示土壤消耗或参数不一致，不能解释为环境负担为零。当前排序使用氮余量绝对值，是可修改的示意偏好。': 'Unused manure and changes in soil or storage stocks are not resolved separately. A negative nitrogen balance may indicate soil depletion or inconsistent parameters, and does not imply zero environmental burden. Ranking uses the absolute nitrogen balance as an adjustable illustrative preference.',
  '家禽粪肥回收率0.65，当窗口有效率0.45；不足部分用矿质肥补齐。粪肥先自用，再在允许的组内转移。转移是内部流，不再计入整体外部输入。': 'The assumed poultry manure recovery fraction is 0.65, with 0.45 of recovered nitrogen available in the accounting window. Mineral fertilizer fills any remaining need. Manure is used on the source farm first, then transferred within an allowed group. Transfers are internal flows and are not counted twice as external inputs.',
  '系统氮余量 = 矿质肥 + 外购饲料氮 + 生物固氮 − 产品氮输出': 'System nitrogen balance = mineral fertilizer + nitrogen in purchased feed + biological nitrogen fixation − nitrogen exported in products',
  '范围可选单主体、假设典型案例、多主体、假设协作组及演示窗口。独立模式按户限制资源；协作模式只共享所选同组成员资源；集中情景合并所选主体。没有纳入的主体不会贡献配额。协作是假设，不代表真实水权、经营权或参与同意。': 'Analysis can cover one operator, a hypothetical typical case, several operators, a hypothetical collaboration group, or the demonstration window. Independent planning limits resources by operator; cooperation pools only selected members of the same group; centralized scenarios pool selected operators. Unselected operators contribute no capacity. Cooperation is an assumption, not evidence of water rights, management rights or consent.',
  '可把经校准的Python/R模型放到未来后端，以版本化JSON作为输入输出接口，不必将全部科研计算重写进网页。PhD1提供的种植系统、作物序列与实验响应需经过口径对齐后接入，而非当作现成已接入的数据。': 'A calibrated Python or R model could run in a future backend with versioned JSON inputs and outputs; research calculations need not all be rewritten for the browser. Any PhD1 cropping-system, crop-sequence or experimental response data would require aligned variables and units before integration. They are not currently integrated.',
  '可调整地块≤5时完整枚举当前离散集；更大问题采用固定种子的随机候选与局部邻域探索。显示的非支配集只相对于已检验候选，不宣称真实全局最优。最多展示排序后的36个候选。': 'With at most five adjustable fields, the current discrete choices are fully enumerated. Larger problems use seeded random candidates and local neighbourhood search. The displayed non-dominated set applies only to tested candidates; global optimality is not claimed. Up to 36 ranked candidates are shown.',
  '核算收益、资源需求和氮收支已有原型。平衡偏好按候选集归一化：收益0.45、节水0.20、氮收支余量绝对值0.15、食物能量0.20；这是显式偏好，非科学结论。可食能量仅为食物保障代理；劳动与参与底线仅反映部分社会条件；氮余量不是完整环境评价。无法把这些代理量直接称作已验证的全部五类绩效。': 'The prototype calculates accounting margin, resource demand and nitrogen balance. The balanced preference normalizes candidates using weights of 0.45 for margin, 0.20 for water saving, 0.15 for absolute nitrogen balance and 0.20 for food energy. These are stated preferences, not scientific findings. Food energy is only a food-security proxy; labour and participation thresholds cover only part of the social dimension; nitrogen balance is not a complete environmental assessment. The proxies do not establish five validated performance dimensions.',
  "研究预览": "Research preview",
  "候选方案分页": "Candidate pages",
  "候选页码": "Candidate page number",
  "上一页": "Previous page",
  "下一页": "Next page",
  "页码": "Page",
  "当前显示": "Showing",
  "完整非支配候选仅保留在当前会话中；刷新或重新搜索会替换本次结果。导出本次计算包含全部候选；方案库及项目包只保存已选方案快照。": "The complete non-dominated set is kept only in this session; reloading or running another search replaces it. Export this calculation to retain every candidate. The plan library and project package store only selected plan snapshots.",
  "保存当前选中方案及完整输入、边界与模型版本，不保存本次搜索的全部候选。不更新地块现状，也不代表已采用。最多保留30个快照，建议定期导出。": "Save the selected plan with its complete inputs, boundaries and model version; this does not save the entire search collection. It does not update current fields or indicate adoption. Up to 30 snapshots can be stored; export regularly.",
  "可调整地块≤5时完整枚举当前离散集；更大问题采用固定种子的随机候选与局部邻域探索。完整非支配集只相对于已检验候选，不宣称真实全局最优。每页展示36个排序后的候选；可翻页查看全部结果。": "With at most five adjustable fields, the current discrete choices are fully enumerated. Larger problems use seeded random candidates and local neighbourhood search. The complete non-dominated set applies only to tested candidates; global optimality is not claimed. Ranked candidates are shown in pages of 36; every result is accessible.",
  "图中仅画出当前页的两个指标，坐标范围涵盖完整非支配集；非支配筛选同时考虑收益、水、氮收支余量绝对值、能量与劳动。每页最多36个方案，可翻页查看全部候选。": "The chart shows two indicators for the current page, with axes covering the complete frontier. Non-dominated screening considers margin, water, absolute nitrogen balance, energy and labour. Each page shows up to 36 plans; all candidates are accessible across pages.",
  "完整保留本次搜索的全部非支配候选，导出与方案选择不再受36条展示限制": "Retains every non-dominated candidate from the search; export and selection are no longer limited to 36 displayed results",
  "图表与表格每页最多36个方案，可翻页或输入页码查看": "Charts and tables show up to 36 plans per page, with page buttons and direct page-number access",
  "切换偏好即时重排完整候选集，保留候选ID、原搜索输入与指纹": "Preference changes rerank the complete collection while preserving candidate IDs, original search inputs and fingerprints",
  "完整搜索仅在当前会话保留；方案库与项目包仍只持久保存已选快照": "The complete search stays in the current session; the plan library and project package persist only selected snapshots",
};

const CATALOG = {...BASE_TRANSLATIONS, ...REVIEWED};
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const entries = Object.keys(CATALOG).filter(key => HAN.test(key) && CATALOG[key] && !HAN.test(CATALOG[key]));
entries.sort((a, b) => b.length - a.length);
const PHRASES = new RegExp(entries.map(escapeRegex).join('|'), 'g');

export function getLanguage() {
  try { const saved = localStorage.getItem(LANGUAGE_KEY); return LANGUAGES.includes(saved) ? saved : 'zh'; }
  catch { return 'zh'; }
}

export function english(source) {
  const value = String(source);
  if (!HAN.test(value)) return value;
  const trimmed = value.trim();
  const missing = trimmed.match(/^缺少 (\d+) 项已核验前置资料：(.+)。$/);
  if (missing) return value.replace(trimmed, `Missing ${missing[1]} verified prerequisites: ${english(missing[2]).replaceAll('、', ', ')}.`);
  const ready = trimmed.match(/^(\d+) 项来源已核对 · (\d+)\/(\d+) 阶段就绪$/);
  if (ready) return value.replace(trimmed, `${ready[1]} sources checked · ${ready[2]}/${ready[3]} stages ready`);
  if (CATALOG[trimmed]) return value.replace(trimmed, CATALOG[trimmed]);
  const translated = value.replace(PHRASES, match => CATALOG[match]);
  return HAN.test(translated) ? value : translated;
}

function display(source, mode, compact = false) {
  if (mode === 'zh' || !HAN.test(source)) return source;
  const translated = english(source);
  if (translated === source) return source;
  return mode === 'both' ? `${source}${compact ? ' / ' : '\n'}${translated}` : translated;
}

function skip(node) {
  const parent = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  return !parent || Boolean(parent.closest('script,style,noscript,textarea,[contenteditable],[data-i18n-skip]'));
}

function localizeText(node, mode) {
  if (skip(node)) return;
  const previous = ORIGINAL_TEXT.get(node);
  const actual = node.nodeValue;
  const source = previous && previous.rendered === actual ? previous.source : actual;
  if (!HAN.test(source)) return;
  const compact = Boolean(node.parentElement.closest('button,option,svg,.topbar,.nav,.tag,.map-toolbar,.map-mini-legend'));
  const rendered = display(source, mode, compact);
  ORIGINAL_TEXT.set(node, {source, rendered});
  if (actual !== rendered) node.nodeValue = rendered;
  if (mode === 'both' && !compact && rendered !== source) node.parentElement.classList.add('i18n-paired-text');
  else if (mode !== 'both') node.parentElement.classList.remove('i18n-paired-text');
}

function localizeAttributes(element, mode) {
  if (skip(element)) return;
  const prior = ORIGINAL_ATTRIBUTES.get(element) || {};
  for (const name of ATTRIBUTES) {
    if (!element.hasAttribute(name)) continue;
    const actual = element.getAttribute(name);
    const source = prior[name]?.rendered === actual ? prior[name].source : actual;
    if (!HAN.test(source)) continue;
    const rendered = display(source, mode, true);
    prior[name] = {source, rendered};
    if (actual !== rendered) element.setAttribute(name, rendered);
  }
  ORIGINAL_ATTRIBUTES.set(element, prior);
}

export function applyLanguage(container = document.body, mode = getLanguage()) {
  if (!container) return;
  if (container.nodeType === Node.TEXT_NODE) return localizeText(container, mode);
  if (container.nodeType !== Node.ELEMENT_NODE || skip(container)) return;
  localizeAttributes(container, mode);
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === Node.TEXT_NODE) localizeText(node, mode);
    else localizeAttributes(node, mode);
  }
}

export function setLanguage(mode) {
  if (!LANGUAGES.includes(mode)) return;
  try { localStorage.setItem(LANGUAGE_KEY, mode); } catch {}
  document.documentElement.lang = mode === 'en' ? 'en' : 'zh-CN';
  document.body.dataset.language = mode;
  document.title = mode === 'zh' ? `FarmSystem Design v${VERSION} · 双路线研究台` : mode === 'en' ? `FarmSystem Design v${VERSION} · Research routes` : `FarmSystem Design v${VERSION} · 双路线研究台 / Research routes`;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = mode === 'zh' ? 'FarmSystem Design：连接地块、经营主体与区域的农业系统研究工作台。公开地图与气候，明确标记的演示数据，透明的多尺度资源核算和情景规划。' : mode === 'en' ? 'FarmSystem Design is an agricultural systems research workbench connecting fields, farm operators and regional evidence with explicit assumptions and scenario analysis.' : 'FarmSystem Design：农业系统研究工作台。Agricultural systems research workbench with explicit evidence and assumptions.';
  document.querySelectorAll('button[data-language]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === mode)));
  applyLanguage(document.body, mode);
}

export function observeLanguage() {
  const observer = new MutationObserver(records => {
    const nodes = new Set();
    for (const record of records) {
      if (record.type === 'characterData') nodes.add(record.target);
      for (const node of record.addedNodes) nodes.add(node);
    }
    for (const node of nodes) applyLanguage(node);
  });
  observer.observe(document.body, {subtree: true, childList: true, characterData: true});
  return observer;
}
