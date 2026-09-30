const PAIRS = {
  title:['海南区域空间资料','Hainan regional spatial data'],
  description:['本地网站已接入土地覆被与两项土壤预测图层。它们属于路线二背景资料，未进入崖州演示农场模型。','The site includes land cover and two soil prediction layers. They support Route 2 context and are not inputs to the Yazhou farm demonstration model.'],
  cover:['ESA WorldCover 2021 · 土地覆被分类','ESA WorldCover 2021 · land-cover classification'],
  soil:['ISRIC SoilGrids 2.0 · 0–5 cm pH 与 SOC 预测','ISRIC SoilGrids 2.0 · 0–5 cm pH and SOC predictions'],
  border:['geoBoundaries · 标称 2017 的历史县级参考边界','geoBoundaries · historical county reference, labeled 2017'],
  warning:['现势市县边界、统计单元匹配和本地土壤实测尚未完成。','Current county boundaries, statistical-unit matching and local soil measurements remain missing.'],
  open:['打开海南图谱','Open Hainan atlas'],
  audit:['查看来源与处理记录','View sources and processing'],
};
export function regionalDataCard(language='zh') {
  const t=key=>language==='both'?`${PAIRS[key][0]}<small>${PAIRS[key][1]}</small>`:PAIRS[key][language==='en'?1:0];
  return `<section class="card regional-data-card" data-i18n-skip><div><span class="eyebrow">REGIONAL DATA / ROUTE 2</span><h2>${t('title')}</h2><p>${t('description')}</p><ul><li>${t('cover')}</li><li>${t('soil')}</li><li>${t('border')}</li></ul><p class="regional-data-warning">${t('warning')}</p></div><div class="regional-data-links"><a href="#research">${t('open')} ↗</a><a href="./docs/Hainan_DATA_SOURCE_AUDIT.md" target="_blank" rel="noopener noreferrer">${t('audit')} ↗</a></div></section>`;
}
