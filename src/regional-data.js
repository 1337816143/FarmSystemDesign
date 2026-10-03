const PAIRS = {
  title:['海南区域空间资料','Hainan regional spatial data'],
  description:['网站已接入2025全域影像、土地覆被、地形、降水与土壤预测图层。它们属于路线二背景资料，未进入崖州演示农场模型。','The site includes regional 2025 imagery, land cover, elevation, rainfall and soil layers. They support Route 2 context and are not inputs to the Yazhou farm demonstration model.'],
  cover:['Sentinel-2 2025 · Esri2025作物分类 · WorldCover2021历史基线','Sentinel-2 2025 · Esri2025 source Crops · WorldCover2021 baseline'],
  soil:['ISRIC SoilGrids 2.0 · 0–5 cm pH 与 SOC 预测','ISRIC SoilGrids 2.0 · 0–5 cm pH and SOC predictions'],
  border:['geoBoundaries · 标称 2017 的历史县级参考边界','geoBoundaries · historical county reference, labeled 2017'],
  warning:['现势县界和穷尽岛礁覆盖仍有缺口；原始分辨率与网页概览分辨率分别注明。','Current county geometry and exhaustive island coverage have gaps; native and display resolutions are distinct.'],
  open:['打开海南图谱','Open Hainan atlas'],
  audit:['查看来源与处理记录','View sources and processing'],
};
export function regionalDataCard(language='zh') {
  const t=key=>language==='both'?`${PAIRS[key][0]}<small>${PAIRS[key][1]}</small>`:PAIRS[key][language==='en'?1:0];
  return `<section class="card regional-data-card" data-i18n-skip><div><span class="eyebrow">REGIONAL DATA / ROUTE 2</span><h2>${t('title')}</h2><p>${t('description')}</p><ul><li>${t('cover')}</li><li>${t('soil')}</li><li>${t('border')}</li></ul><p class="regional-data-warning">${t('warning')}</p></div><div class="regional-data-links"><a href="#research">${t('open')} ↗</a><a href="./docs/Hainan_DATA_SOURCE_AUDIT.md" target="_blank" rel="noopener noreferrer">${t('audit')} ↗</a></div></section>`;
}
