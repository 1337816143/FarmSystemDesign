// Research route register. Source confirmation is deliberately separate from
// integration and scientific validation; no regional record enters the farm model.
export const REGIONAL_EVIDENCE_VERSION = 'hainan-audit-2026-09-30-r1';

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
    unit: '市县／经论证的农业生态分区',
    question: '海南各地生产结构、资源压力和气候风险如何变化；哪些区域调整方向值得进一步检验？',
    outputs: ['同口径的区域差异与变化诊断', '明确决策权限的区域情景比较', '由典型经营系统检验参数和可实施性'],
    boundary: '省级汇总数不能拆成市县或地块；区域情景不能假定全省土地由单一主体自由调配。',
    stages: [
      {name:'市县时序诊断', needs:['county-series','admin-units']},
      {name:'空间情景比较', needs:['county-series','admin-units','land-eligibility','regional-resources']},
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

// "source-confirmed" means a source and its stated grain were checked. It does
// not mean the underlying county/time series was acquired, harmonized or tested.
export const AUDIT = [
  {id:'province-snapshot',track:'province',name:'2025 年全省农业总量',status:'display-only',grain:'省级 · 年度',period:'2025',use:'描述性背景',gap:'已在平台展示；未进入分析模型。不能反推市县或农场。',url:OFFICIAL_SNAPSHOT.url},
  {id:'county-series',track:'province',name:'市县农业生产时序',status:'source-confirmed',grain:'市县 · 年度',period:'逐年核对',use:'区域诊断',gap:'年鉴入口已确认；表格、年份、行政区划变动和统计口径尚未提取核对。',url:'https://stats.hainan.gov.cn/tjj/tjsu/ndsj/2025/18gb_list.html'},
  {id:'admin-units',track:'province',name:'可追溯的市县边界与代码',status:'missing',grain:'市县 · 版本化',period:'待定',use:'空间汇总',gap:'须确定法定统计单元及边界版本，不能用演示地块拼成全省地图。',url:''},
  {id:'climate-grid',track:'province',name:'ERA5-Land 气候重分析',status:'candidate',grain:'约 0.1° · 小时',period:'1950 年至今，按需选取',use:'气候暴露候选',gap:'未下载海南子集，尚未与行政单元匹配或本地观测交叉检验。',url:'https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land'},
  {id:'land-eligibility',track:'province',name:'ESA WorldCover 土地覆盖',status:'candidate',grain:'10 m · 分类栅格',period:'2020 / 2021',use:'土地背景候选',gap:'不是作物经营权或每年种植结构；需另行核对分类精度和适用年份。',url:'https://esa-worldcover.org/en'},
  {id:'soil-grid',track:'province',name:'ISRIC SoilGrids 土壤预测',status:'candidate',grain:'250 m · 预测栅格',period:'产品版本待核对',use:'土壤差异候选',gap:'尚未取数与本地样点验证，不能标成逐田块实测。',url:'https://docs.isric.org/globaldata/soilgrids/'},
  {id:'regional-resources',track:'province',name:'区域水、劳动力和成本约束',status:'missing',grain:'需与分析单元和年份一致',period:'待定',use:'情景可行性',gap:'公开地图和省级总量都不能替代可分配资源、机会成本或水权。',url:''},
  {id:'regional-response',track:'province',name:'活动响应与跨尺度参数',status:'missing',grain:'分区／活动／季节',period:'待定',use:'区域模拟',gap:'需要来源、迁移范围和不确定性；不能复用虚拟农场系数。',url:''},
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
