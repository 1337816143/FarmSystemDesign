// Research route register. Source confirmation is deliberately separate from
// integration and scientific validation; no regional record enters the farm model.
export const REGIONAL_EVIDENCE_VERSION = 'hainan-regional-2026-10-03-r1';

export const ROUTES = {
  farm: {
    title: '路线一 · 案例农场系统',
    status: 'Proposal 主线',
    unit: '农户／农场及其经营地块',
    question: '在地块、季节和经营约束下，种植与其他活动怎样组合，获得新信息后如何调整？',
    outputs: ['经营系统现状与资源流', '可解释的农场模型', '方案权衡、适应性调整及现场验证'],
    boundary: '现有崖州窗口只有公开预测几何与虚拟经营资料；不能据此提出真实农户方案。',
    stages: [
      {name:'重建真实基准', needs:['farm-management','farm-resources','crop-response']},
      {name:'检验模型响应', needs:['farm-validation']},
      {name:'比较适应性策略', needs:['farm-validation','decision-rules']}
    ]
  },
  province: {
    title: '路线二 · 海南全域',
    status: '待导师组确认',
    unit: '市县／农业生态分区；省域汇总与协调',
    question: '面对海南各地生产条件与风险差异，哪些分区措施组合能改善食物供给、经营收益和资源表现，并能随新信息调整？',
    outputs: ['市县时序与农业系统分型', '区域措施组合及固定／分阶段策略比较', '典型农户、农场的可实施性检验'],
    boundary: '省级汇总数不能拆成市县或地块；区域情景不能假定全省土地由单一主体自由调配。',
    stages: [
      {name:'市县时序诊断', needs:['county-series','admin-units']},
      {name:'区域情景与典型系统检验', needs:['county-series','admin-units','land-eligibility','regional-resources','farm-bridge']},
      {name:'可验证的区域优化', needs:['county-series','admin-units','land-eligibility','regional-resources','regional-response','regional-validation']}
    ]
  }
};

export const OFFICIAL_SNAPSHOT = {
  year: 2025,
  geography: '海南省总体',
  published: '2026-01-23',
  source: '海南省统计局《全年农业经济稳健运行》',
  url: 'https://stats.hainan.gov.cn/tjj/ywdt/xwfb/202601/t20260123_4016316.html',
  values: [
    {label:'粮食播种面积', value:412.37, unit:'万亩'},
    {label:'粮食总产量', value:142.74, unit:'万吨'},
    {label:'蔬菜产量', value:662.22, unit:'万吨'},
    {label:'水果总产量', value:656.54, unit:'万吨'}
  ]
};

// Literature evidence at island scale. These published model results are not
// observations for a county, farm, or the current demonstration model.
export const NUTRIENT_BOUNDARY_STUDY = {
  title: '海南农业增产目标与氮磷环境边界',
  citation: 'Dong et al., Agricultural Systems 234 (2026), 104695',
  url: 'https://doi.org/10.1016/j.agsy.2026.104695',
  geography: '海南岛整体',
  history: '1988–2020',
  scenarios: '2030 BAU、S1–S5',
  method: 'NUFER 作物—畜牧氮磷物质流与生产／环境阈值',
  evidence: [
    {label:'氮：生产所需最低投入',value:'135',unit:'Gg N／年',source:'§3.2；Table S6'},
    {label:'氮：不同环境终点的投入上界',value:'174–262',unit:'Gg N／年',source:'§3.2；Fig. 5a；Table S6'},
    {label:'磷：生产下界／径流环境上界／2020 投入',value:'25／44／70',unit:'Gg P／年',source:'§3.2；Fig. 5b；Table S9'},
    {label:'S5：相对 2020 减少氮／磷投入',value:'45%／37%',unit:'模型情景',source:'摘要；§3.2'},
    {label:'S5：目标产量需氮达成',value:'96%',unit:'模型情景',source:'摘要；§3.2'}
  ],
  boundary: '阈值和情景均为全岛模型结果；不能直接分配到市县或地块，也不能充当本平台的实测参数。需取得补充材料、NUFER 配置和分区损失系数，先核对各项投入的系统边界。'
};

// "source-confirmed" means a source and its stated grain were checked. It does
// not mean the underlying county/time series was acquired, harmonized or tested.
export const AUDIT = [
  {"id":"sentinel-regional","track":"province","name":"2025全域Sentinel-2影像","status":"display-only","grain":"RGB10m / SCL20m；网页概览另标","period":"2025多日期","use":"空间证据浏览","gap":"已按视窗接入候选COG与真实拼图；SCL不保证完全无云，离岛仍按像元报告缺口。","url":"https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a"},
  {"id":"esri2025-crops","track":"province","name":"2025 Esri作物类别","status":"display-only","grain":"10m原始分类","period":"2025 v003","use":"来源分类对照","gap":"Crops=5不是法定耕地；与WorldCover不同产品面积不得作为时序变化。","url":"https://livingatlas.arcgis.com/landcover/"},
  {"id":"copernicus-dsm","track":"province","name":"Copernicus地表高程","status":"display-only","grain":"约30m来源；总览247m/989m","period":"主体2011–2015","use":"地形背景","gap":"地表模型包含植被/建筑；细窗与全域概览分开，小岛零值不冒充现势地形。","url":"https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model"},
  {"id":"chirps2025","track":"province","name":"CHIRPS2025年降水","status":"display-only","grain":"0.05°约5.5km","period":"2025 final","use":"气候背景","gap":"真实年降水格网；海域和部分小岛无值，不是10m气候，也不是地块观测。","url":"https://chc.ucsb.edu/data/chirps3"},
  {"id":"osm-boundaries","track":"province","name":"OSM本岛18单元社区边界","status":"display-only","grain":"WGS84社区几何","period":"2026-10-03下载快照","use":"非官方位置参照","gap":"含五指山，未混入琼山区；三沙完整面缺失，不代表权威现势界或可直接用于县域统计。","url":"https://download.geofabrik.de/asia/china/hainan.html"},

  {id:'province-snapshot',track:'province',name:'2025 年全省农业总量',status:'display-only',grain:'省级 · 年度',period:'2025',use:'描述性背景',gap:'已在平台展示；未进入分析模型。不能反推市县或农场。',url:OFFICIAL_SNAPSHOT.url},
  {id:'dong-nutrient-boundaries',track:'province',name:'Dong 等（2026）海南氮磷边界研究',status:'source-confirmed',grain:'全岛模型 · 年度／2030 情景',period:'1988–2020；2030 情景',use:'营养约束候选与跨尺度问题定义',gap:'已核读论文；补充材料、原始数据及模型参数未接入。全岛阈值不能直接下推市县或农场。',url:NUTRIENT_BOUNDARY_STUDY.url},
  {id:'county-series',track:'province',name:'市县农业生产时序',status:'source-confirmed',grain:'市县 · 年度',period:'2023 年单表已核读；时序待核对',use:'区域诊断',gap:'2024 版年鉴表 12-1 已核读 2023 年 18 个岛内农业行；最新年鉴、逐年口径和可再发布范围仍待核对。',url:'https://stats.hainan.gov.cn/tjj/tjsu/ndsj/2024/202412/P020250116308974141111.pdf'},
  {id:'admin-units',track:'province',name:'可追溯的现势市县边界与代码',status:'missing',grain:'市县 · 版本化',period:'待定',use:'空间汇总',gap:'历史 18 面含琼山市、缺五指山市；2023 年鉴行政表有 19 行（含三沙），农业表有 18 行。不能按行数把旧面与现势统计量连接。',url:'https://stats.hainan.gov.cn/tjj/tjsu/ndsj/2024/202412/P020250116308974141111.pdf'},
  {id:'historic-boundaries',track:'province',name:'geoBoundaries 历史县级位置参考',status:'display-only',grain:'海南岛 · 历史县级几何',period:'标称 2017；部分名称更早',use:'地图定位参考',gap:'已提取 18 个岛内要素；仅供叠加查看，默认关闭。不能用于现势市县数据连接或面积计算。',url:'https://www.geoboundaries.org/api/current/gbOpen/CHN/ADM2/'},
  {id:'climate-grid',track:'province',name:'ERA5-Land 气候重分析',status:'candidate',grain:'约 0.1° · 小时',period:'1950 年至今，按需选取',use:'气候暴露候选',gap:'未下载海南子集，尚未与行政单元匹配或本地观测交叉检验。',url:'https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land'},
  {id:'land-eligibility',track:'province',name:'ESA WorldCover 土地覆被',status:'display-only',grain:'10 m 原始分类 · 约 300 m 地图预览',period:'2021 v200',use:'海南主岛空间背景与探索性面积',gap:'已按原始像元汇总产品派生主岛掩膜的类别面积；掩膜约 100 m 采样。尚无现势市县面积和海南本地分类精度验证。覆被不是法定土地用途或经营权。',url:'https://esa-worldcover.org/en/data-access'},
  {id:'soil-grid',track:'province',name:'ISRIC SoilGrids 表层 pH 与 SOC 预测',status:'display-only',grain:'250 m 源数据 · 0–5 cm',period:'SoilGrids 2.0',use:'海南岛土壤差异背景',gap:'已接入两项 WCS 栅格及可查询像元；仍需本地样点和不确定性核对，不能标成田块实测或优化参数。',url:'https://docs.isric.org/globaldata/soilgrids/'},
  {id:'regional-resources',track:'province',name:'区域水、劳动力和成本约束',status:'missing',grain:'需与分析单元和年份一致',period:'待定',use:'情景可行性',gap:'公开地图和省级总量都不能替代可分配资源、机会成本或水权。',url:''},
  {id:'regional-response',track:'province',name:'活动响应与跨尺度参数',status:'missing',grain:'分区／活动／季节',period:'待定',use:'区域模拟',gap:'需要来源、迁移范围和不确定性；不能复用虚拟农场系数。',url:''},
  {id:'farm-bridge',track:'province',name:'典型农户／农场与区域分型连接',status:'missing',grain:'经营主体 · 类型 · 分区',period:'待抽样',use:'措施可实施性与跨尺度检验',gap:'需定义选样、类型、经营权限及权重；少数案例不能直接代表全省。',url:''},
  {id:'regional-validation',track:'province',name:'区域独立验证资料',status:'missing',grain:'与目标结果匹配',period:'待定',use:'检验情景结论',gap:'需与建模输入分离；不能用优化得分验证优化本身。',url:''},
  {id:'farm-management',track:'farm',name:'农户—地块—活动管理资料',status:'missing',grain:'经营主体 · 地块 · 季节',period:'待调查',use:'真实基准',gap:'经营权、实际作物、投入和产出均未核验。',url:''},
  {id:'farm-resources',track:'farm',name:'逐期水、养分、劳动力与成本',status:'missing',grain:'经营主体 · 时段',period:'待调查',use:'资源约束',gap:'当前配额、价格和生产系数均为演示假设。',url:''},
  {id:'crop-response',track:'farm',name:'PhD1 种植方案响应接口',status:'missing',grain:'方案 · 条件 · 季节',period:'待团队明确',use:'种植与农场系统连接',gap:'需明确变量、单位、适用条件及独立检验责任。',url:''},
  {id:'farm-validation',track:'farm',name:'独立的农场系统验证',status:'missing',grain:'经营主体 · 结果',period:'待调查',use:'模型与策略检验',gap:'PhD1 的田间试验不能自动验证整个农场结果。',url:''},
  {id:'decision-rules',track:'farm',name:'经营权限、共享规则和调整时点',status:'missing',grain:'主体 · 决策 · 时段',period:'待调查',use:'适应性策略',gap:'不能把村庄全部资源视作一个主体，或令已实施投资无成本逆转。',url:''}
];

export const STATUS = {
  'display-only':'仅背景展示 · 不进模型',
  'source-confirmed':'已核对来源 · 未接入',
  candidate:'候选来源 · 未接入',
  missing:'关键缺口',
  'integrated-verified':'已接入并核验'
};

export function assessStages(route, audit=AUDIT) {
  if (!ROUTES[route]) throw new Error(`Unknown research route: ${route}`);
  const byId = new Map(audit.map(row=>[row.id,row]));
  const cumulative = new Set();
  return ROUTES[route].stages.map(stage=>{
    for (const id of stage.needs) cumulative.add(id);
    const missing=[...cumulative].filter(id=>byId.get(id)?.status!=='integrated-verified');
    return {...stage,ready:missing.length===0,missing};
  });
}

export function auditCsvRows(route, audit=AUDIT) {
  if (!ROUTES[route]) throw new Error(`Unknown research route: ${route}`);
  return [
    ['route','dataset_id','dataset','status','spatial_temporal_grain','period','research_use','gap_or_limit','source_url'],
    ...audit.filter(row=>row.track===route).map(row=>[route,row.id,row.name,STATUS[row.status]||row.status,row.grain,row.period,row.use,row.gap,row.url])
  ];
}
