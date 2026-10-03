import {CoveragePanel,coverageMarkup,runtimeCoverageText} from './coverage-panel.js';
import {REGIONAL_INFO,regionalLayer,regionInventory,inspectRegional} from './regional-atlas-layers.js';
import {createLandcoverLayer} from './landcover-layer.js';
// Hainan evidence atlas. The geospatial products never enter the farm model.
import {validCoverSummary, coverSummaryCsv} from './cover-summary.js';
const BOX = [[17.8, 108.5], [20.5, 111.5]];
const COVER_CLASSES = [
  ['#006400','树木覆盖','Tree cover'],['#ffbb22','灌丛','Shrubland'],
  ['#ffff4c','草地','Grassland'],['#f096ff','耕地覆被','Cropland cover'],
  ['#fa0000','建成区','Built-up'],['#b4b4b4','裸地','Bare/sparse'],
  ['#f0f0f0','冰雪','Snow/ice'],['#0064c8','永久水体','Permanent water'],
  ['#0096a0','草本湿地','Herbaceous wetland'],['#00cf75','红树林','Mangroves'],
  ['#fae6a0','苔藓地衣','Moss/lichen'],
];
const SUMMARY_CODES = [10, 40, 30, 50, 80];
const CODE_LABELS = new Map([[10,COVER_CLASSES[0]],[30,COVER_CLASSES[2]],[40,COVER_CLASSES[3]],[50,COVER_CLASSES[4]],[80,COVER_CLASSES[7]]]);
const WORDS = {
  zh: {
    eyebrow: '海南空间证据 / 分层核验', title: '海南与离岛：影像、分类及环境资料',
    intro: '新增2025 Sentinel-2影像、2025土地覆盖、地形和降水。每层分别注明原始分辨率、时间与缺口；地图资料不进入原农场假设模型。',
    land: '2021 土地覆被', soil: '表层土壤 pH', soc: '表层土壤有机碳', borders: '2017 历史边界',
    landType: '分类产品 · 10 m 原始分辨率 · 网页预览约 300 m/像素',
    soilType: '模型预测 · 0–5 cm · 250 m 原始分辨率',
    socType: '模型预测 · 0–5 cm · 250 m 原始分辨率 · g/kg',
    borderType: 'geoBoundaries 来源标称 2017 年，部分名称更早；仅供定位，不能直接对应现势统计单元。',
    soilLegend: '预测 pH (H₂O)', socLegend: '预测 SOC (g/kg)', click: '点击地图查看坐标；土壤图层可查询预测像元。',
    noSoil: '该位置没有土壤预测值或在裁剪范围外。', ph: '预测 pH', socValue: '预测 SOC',
    loading: '正在加载所选图层…', loadError: '图层加载失败，请重试。',
    noCounty: '县级参考边界暂未加载；不绘制猜测边界。',
    county: '历史县级参考单元', unknown: '边界名称未核定',
    sources: '数据说明与处理记录', landSource: 'ESA WorldCover 2021 v200', soilSource: 'ISRIC SoilGrids 2.0',
    caution: '尚无按市县核验的土地面积、土壤均值或作物经营资料；不据此进行分区优化。',
    unitTitle: '统计单元核对 · 暂不能制作市县填色图',
    unitHistorical: '历史参考面', unitOfficial: '2023 行政行', unitAgriculture: '2023 农业行',
    unitMismatch: '历史图层含琼山市、缺五指山市；2023 年官方农业表恰有五指山市、无琼山市。行数相同不代表单元相同。',
    unitSource: '查看边界与统计单元核对',
    areaTitle: '2021 主岛覆被面积 · 探索性估计', areaTotal: '分类总面积', areaOther: '其他类别',
    areaMethod: '10 m 原始分类值汇总；主岛掩膜由产品约 100 m 概览推得。不是官方耕地面积，未作海南本地精度验证。',
    areaUnavailable: '分类面积暂不可用。', areaSource: '计算方法与来源',
    areaExport: '导出完整分类 CSV', areaJson: '下载来源快照 JSON',
    areaSensitivity: '掩膜采样敏感性：100 m 与 200 m 的总面积差',
    areaBoundary: '仅反映掩膜采样差异，不是置信区间、分类误差或海南本地精度。百分比分母为分类总面积，含永久水体；不是耕地占行政面积比例。',
    mapExtent: '可浏览本岛及西沙、中沙、南沙地理查询窗；查询窗不是行政边界，包含海域及其他陆地。完整岛礁清单与现势可转载县界仍未完成。',
    coords: '坐标', overlay: '图层透明度',
  },
  en: {
    eyebrow: 'HAINAN SPATIAL EVIDENCE / LAYER AUDIT', title: 'Hainan and offshore islands: imagery, classes and environment',
    intro: '2025 Sentinel-2 imagery, 2025 land cover, terrain and rainfall. Each layer retains its native resolution, period and gaps. These products do not enter the original illustrative farm model.',
    land: '2021 land cover', soil: 'Topsoil pH', soc: 'Topsoil organic carbon', borders: '2017 historic borders',
    landType: 'Classified product · native 10 m · web preview about 300 m/pixel',
    soilType: 'Model prediction · 0–5 cm · native 250 m',
    socType: 'Model prediction · 0–5 cm · native 250 m · g/kg',
    borderType: 'geoBoundaries is labeled 2017, but some names are older. For orientation only; it cannot be joined directly to current statistical units.',
    soilLegend: 'Predicted pH (H₂O)', socLegend: 'Predicted SOC (g/kg)', click: 'Click for coordinates; soil layers also report a predicted pixel.',
    noSoil: 'No soil prediction here, or the point is outside the crop.', ph: 'Predicted pH', socValue: 'Predicted SOC',
    loading: 'Loading the selected layer…', loadError: 'The layer could not be loaded. Please retry.',
    noCounty: 'County reference borders are unavailable; no guessed borders are drawn.',
    county: 'Historical county reference unit', unknown: 'Boundary name unverified',
    sources: 'Source and processing record', landSource: 'ESA WorldCover 2021 v200', soilSource: 'ISRIC SoilGrids 2.0',
    caution: 'Verified county land area, soil means and operating data are still missing; no regional optimization is supported.',
    unitTitle: 'Unit check · county choropleth unavailable',
    unitHistorical: 'historic shapes', unitOfficial: '2023 admin rows', unitAgriculture: '2023 farm rows',
    unitMismatch: 'The historic layer includes Qiongshan but omits Wuzhishan. The official 2023 agricultural table has Wuzhishan and no Qiongshan. Equal counts do not mean matching units.',
    unitSource: 'Read the boundary and statistical unit audit',
    areaTitle: '2021 main-island cover · exploratory estimate', areaTotal: 'Classified area', areaOther: 'Other classes',
    areaMethod: 'Summed native 10 m classes with an island mask derived from an about 100 m product overview. This is not official cultivated-land area and has no local Hainan accuracy validation.',
    areaUnavailable: 'Cover area summary unavailable.', areaSource: 'Method and source',
    areaExport: 'Export all classes as CSV', areaJson: 'Download source snapshot JSON',
    areaSensitivity: 'Mask sampling sensitivity: total-area difference between 100 m and 200 m',
    areaBoundary: 'Only mask sampling sensitivity; not a confidence interval, classification error or local Hainan accuracy. Percentages use classified area including permanent water, not administrative or cultivated-land area.',
    mapExtent: 'Browse main-island, Xisha, Zhongsha and Nansha geographic query windows. These are not administrative boundaries and include sea and other land. An exhaustive island inventory and current reusable county polygons remain unresolved.',
    coords: 'Coordinates', overlay: 'Layer opacity',
  },
};

function duo(zh, en, language) { return language === 'both' ? `${zh}<small>${en}</small>` : language === 'en' ? en : zh; }

export function atlasMarkup(language = 'zh') {
  const t = WORDS[language === 'en' ? 'en' : 'zh'];
  const e = WORDS.en;
  const label = key => duo(t[key], e[key], language);
  const coverLegend = COVER_CLASSES.map(([color,zh,en]) => `<span><i style="background:${color}"></i>${duo(zh,en,language)}</span>`).join('');
  return `<section class="hainan-atlas" data-i18n-skip>
    <div class="research-section-head atlas-heading"><div><span class="research-index">${label('eyebrow')}</span><h2>${label('title')}</h2><p>${label('intro')}</p></div><a href="./docs/Hainan_DATA_SOURCE_AUDIT.md" target="_blank" rel="noopener noreferrer">${label('sources')} ↗</a></div>
    <div class="atlas-layout"><div class="atlas-map-wrap"><div class="atlas-toolbar" role="group" aria-label="Hainan map layers">
      <button type="button" data-atlas="imagery" aria-pressed="false">${language==='en'?'2025 Satellite RGB':'2025 卫星影像'}</button>
      <button type="button" data-atlas="dsm" aria-pressed="false">${language==='en'?'Elevation · 30 m source':'地形 · 30 m原生'}</button>
      <button type="button" data-atlas="rain" aria-pressed="false">${language==='en'?'Rainfall · 5.5 km':'降水 · 5.5 km'}</button>
      <button type="button" data-atlas="landcover" aria-pressed="true">${label('land')}</button>
      <button type="button" data-atlas="crops2025" aria-pressed="false">${language==='en'?'2025 Crops class=5':'2025 Crops 分类=5'}</button>
      <button type="button" data-atlas="classes2025" aria-pressed="false">${language==='en'?'2025 All classes':'2025 完整分类 / All classes'}</button>
      <a href="./docs/SPATIAL_COVERAGE_PHASE1.md" target="_blank" rel="noreferrer">${language==='en'?'2025 Source and coverage':'2025 来源与覆盖 / Coverage'}</a>
      <button type="button" data-atlas="soil" aria-pressed="false">${label('soil')}</button>
      <button type="button" data-atlas="soc" aria-pressed="false">${label('soc')}</button>
      <label><input id="atlas-osm-boundaries" type="checkbox"> ${language==='en'?'2026 OSM reference':'2026 OSM社区参照'}</label>
      <label><input id="atlas-sansha-boundaries" type="checkbox"> ${language==='en'?'Sansha OSM partial reference':'三沙 OSM 部分范围参照'}</label>
      <label><input id="atlas-boundaries" type="checkbox"> ${label('borders')}</label>
    </div><div class="atlas-region-nav"><label>${language==='en'?'View region / sample':'浏览范围 / 核验样窗'} <select id="atlas-region" aria-label="Geographic view" disabled><option value="main">${language==='en'?'Hainan Island':'海南岛'}</option></select></label><span id="atlas-view-status" role="status"></span></div><div id="hainan-atlas-map" class="atlas-map" role="img" aria-label="Hainan spatial evidence map"></div><div class="atlas-map-foot"><span id="atlas-inspect" role="status" aria-live="polite">${label('click')}</span><strong id="atlas-load-label" hidden>${label('loading')}</strong><strong id="atlas-error-label" hidden>${label('loadError')}</strong><label>${label('overlay')} <input id="atlas-opacity" type="range" min="30" max="100" value="95"></label></div>
    <div class="atlas-runtime-status"><span id="atlas-runtime-coverage" role="status" aria-live="polite"></span><button type="button" id="atlas-retry-raster" hidden>${language==='en'?'Retry current layer':'重试当前图层'}</button></div>${coverageMarkup(language==='en')}
    <div class="atlas-area" id="atlas-cover-summary"><strong>${label('areaTitle')}</strong><div id="atlas-area-chart" role="group" aria-label="${t.areaTitle}">${label('areaUnavailable')}</div><p>${label('areaMethod')}</p><a href="./docs/Hainan_DATA_SOURCE_AUDIT.md" target="_blank" rel="noopener noreferrer">${label('areaSource')} ↗</a></div></div>
    <aside class="atlas-aside"><div class="atlas-layer-id"><b id="atlas-current-title">${label('land')}</b><p id="atlas-current-type">${label('landType')}</p></div>
      <div class="atlas-unit-check"><strong>${label('unitTitle')}</strong><div class="atlas-unit-counts"><span><b>18</b>${label('unitHistorical')}</span><span><b>19</b>${label('unitOfficial')}</span><span><b>18</b>${label('unitAgriculture')}</span></div><p>${label('unitMismatch')}</p><a href="./docs/HAINAN_ADMIN_STAT_UNITS_AUDIT.md" target="_blank" rel="noopener noreferrer">${label('unitSource')} ↗</a></div>
      <div class="atlas-regional-legend" id="atlas-regional-legend" hidden></div><div class="atlas-land-legend" id="atlas-land-legend">${coverLegend}</div>
      <div class="atlas-soil-legend" id="atlas-soil-legend" hidden><div class="atlas-gradient"></div><div><span>4.0</span><span>5.0</span><span>6.0</span><span>7.0</span></div><p>${label('soilLegend')}</p></div>
      <div class="atlas-soil-legend" id="atlas-soc-legend" hidden><div class="atlas-gradient soc"></div><div><span>0</span><span>25</span><span>50</span><span>75</span><span>100+</span></div><p>${label('socLegend')}</p></div>
      <p class="atlas-border-note">${language==='en'?'OSM snapshot downloaded 2026-10-03: 18 main-island aggregate polygons, including Wuzhishan. Sansha has a separate OSM partial reference, including sea. These are community records, not authoritative full current boundaries.':'OSM于2026-10-03下载快照：本岛18个聚合参考面，包含五指山；另列三沙OSM部分范围参考（含海域）。这些是社区记录，不能替代权威完整现势行政界。'} <a href="./data/hainan/regional/county-osm-audit.json" target="_blank" rel="noreferrer">${language==='en'?'Audit':'核验记录'}</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors · ODbL</a></p><p class="atlas-border-note">${language==='en'?'Sansha relation 2833102: source version 280, dated 2026-08-31; 12 polygon parts. The OSM child records describe limited areas under Chinese control; the Zhongsha child uses an older administrative label. Not a legal-jurisdiction claim or a land mask.':'三沙 relation 2833102：源版本280，日期2026-08-31，含12个面片。OSM子关系描述为中国控制的部分范围；中沙子对象沿用旧行政标签。不据此判定法定辖界，也不用作陆地掩膜。'} <a href="./data/hainan/regional/administrative/audit.json" target="_blank" rel="noreferrer">${language==='en'?'Source relation audit':'来源关系核验'}</a></p><p class="atlas-border-note" id="atlas-border-note">${label('noCounty')}</p><p class="atlas-extent">${label('mapExtent')}</p><p class="atlas-caution">${label('caution')}</p>
      <div class="atlas-regional-audit"><strong>${language==='en'?'Coverage and source audit':'覆盖与来源核验'}</strong><p id="atlas-regional-status">${language==='en'?'Metadata coverage is not visible-pixel coverage.':'目录覆盖不等于可见有效像元覆盖。'}</p><a href="./docs/SPATIAL_COVERAGE_PHASE2.md" target="_blank" rel="noreferrer">${language==='en'?'Read methods, resolution and gaps':'查看方法、分辨率与缺口'} ↗</a><p id="atlas-2025-area"></p></div><div class="atlas-source-links"><a href="https://esa-worldcover.org/en/data-access" target="_blank" rel="noopener noreferrer">${label('landSource')} ↗</a><a href="https://docs.isric.org/globaldata/soilgrids/" target="_blank" rel="noopener noreferrer">${label('soilSource')} ↗</a><a href="https://www.geoboundaries.org/api/current/gbOpen/CHN/ADM2/" target="_blank" rel="noopener noreferrer">geoBoundaries CHN ADM2 (2017) ↗</a></div>
      <p class="atlas-attribution">© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium. © ISRIC — World Soil Information. geoBoundaries CHN ADM2, 2017.</p>
    </aside></div></section>`;
}

export class HainanAtlas {
  constructor(element, language = 'zh') {
    this.host = element;
    this.language = language;
    this.layer = 'landcover';
    this.map = L.map(element.querySelector('#hainan-atlas-map'), {scrollWheelZoom: false, attributionControl: false, zoomSnap: 0.25, minZoom: 3, maxZoom:18});
    this.map.fitBounds(BOX);
    L.control.scale({imperial:false,position:'bottomleft'}).addTo(this.map);
    this.map.getContainer().style.background = '#dcecf0';
    this.overlay = L.imageOverlay('./data/hainan/landcover-preview.png', BOX, {opacity: .95}).addTo(this.map);
    this.borderLayer = null;
    this.valueCanvases = {};
    this.switchToken = 0;
    this.loadValues('soil', './data/hainan/soil-ph-values.png');
    this.loadValues('soc', './data/hainan/soil-soc-values.png');
    this.loadLandcoverSummary();
    this.loadBorders();
    this.loadOsmBorders();
    this.loadSanshaBorders();
    this.loadRegionalInventory();
    this.coveragePanel=new CoveragePanel(element,()=>this.map,language);
    this.map.on('moveend',()=>this.updateRasterViewStatus());
    this.clickHandler = event => this.handleClick(event);
    element.addEventListener('click', this.clickHandler);
    this.inputHandler = event => this.handleInput(event);
    element.addEventListener('input', this.inputHandler);
    this.map.on('click', event => this.inspect(event.latlng));
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  loadValues(key, path) {
    const image = new Image();
    image.onload = () => {
      if (!this.map) return;
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      canvas.getContext('2d', {willReadFrequently: true}).drawImage(image, 0, 0);
      this.valueCanvases[key] = canvas;
    };
    image.src = path;
  }

  async loadLandcoverSummary() {
    try {
      const response = await fetch('./data/hainan/landcover-main-island-summary.json');
      if (!response.ok) return;
      const data = await response.json();
      if (!this.map || !validCoverSummary(data)) return;
      const classes = new Map(data.classes.map(row => [row.code,row]));
      const values = SUMMARY_CODES.map(code => classes.get(code));
      if (values.some(row => !row || !Number.isFinite(row.km2) || !Number.isFinite(row.percent) || row.percent < 0 || row.percent > 100)) return;
      const other = data.classes.filter(row => !SUMMARY_CODES.includes(row.code)).reduce((sum,row) => sum + row.km2, 0);
      const t = WORDS[this.language === 'en' ? 'en' : 'zh'];
      const rows = values.map((row,index) => {
        const [color,zh,en] = CODE_LABELS.get(SUMMARY_CODES[index]);
        return `<div class="atlas-area-row"><span>${duo(zh,en,this.language)}</span><b>${row.percent.toFixed(1)}%</b><i><em style="width:${row.percent}%;background:${color}"></em></i><small>${row.km2.toLocaleString(this.language === 'en' ? 'en-US' : 'zh-CN',{maximumFractionDigits:0})} km²</small></div>`;
      });
      rows.push(`<div class="atlas-area-row"><span>${duo(t.areaOther,WORDS.en.areaOther,this.language)}</span><b>${(other / data.total_classified_km2 * 100).toFixed(1)}%</b><i><em style="width:${other / data.total_classified_km2 * 100}%;background:#aab4aa"></em></i><small>${other.toFixed(0)} km²</small></div>`);
      const chart = this.host.querySelector('#atlas-area-chart');
      chart.innerHTML = `<div class="atlas-area-total"><span>${duo(t.areaTotal,WORDS.en.areaTotal,this.language)}</span><b>${data.total_classified_km2.toLocaleString(this.language === 'en' ? 'en-US' : 'zh-CN',{maximumFractionDigits:0})} km²</b></div>${rows.join('')}`;
      chart.setAttribute('aria-label',`${t.areaTitle}: ${data.total_classified_km2.toFixed(0)} km²`);
      const detail = document.createElement('div');
      detail.className = 'atlas-summary-detail';
      detail.innerHTML = `<p>${duo(t.areaBoundary,WORDS.en.areaBoundary,this.language)}</p>`;
      if ([data.mask_area_100m_km2,data.mask_area_200m_km2,data.mask_sampling_difference_percent].every(Number.isFinite)) {
        const sensitivity = document.createElement('p');
        sensitivity.innerHTML = `${duo(t.areaSensitivity,WORDS.en.areaSensitivity,this.language)}: <b>${data.mask_sampling_difference_percent}%</b> (${data.mask_area_100m_km2} / ${data.mask_area_200m_km2} km²)`;
        detail.append(sensitivity);
      }
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.atlasExport = 'csv';
      button.innerHTML = duo(t.areaExport,WORDS.en.areaExport,this.language);
      button.addEventListener('click', () => {
        const url = URL.createObjectURL(new Blob([coverSummaryCsv(data)], {type:'text/csv;charset=utf-8'}));
        const link = document.createElement('a'); link.href = url; link.download = 'hainan-worldcover-2021-exploratory.csv';
        link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
      });
      const source = document.createElement('a');
      source.href = './data/hainan/landcover-main-island-summary.json'; source.download = 'hainan-worldcover-2021-source.json';
      source.innerHTML = duo(t.areaJson,WORDS.en.areaJson,this.language);
      detail.append(button,document.createTextNode(' · '),source);
      chart.append(detail);
    } catch { /* the declared unavailable state remains visible */ }
  }

  async loadBorders() {
    try {
      const response = await fetch('./data/hainan/county-reference-2017.geojson');
      if (!response.ok) return;
      const geojson = await response.json();
      if (!this.map || !Array.isArray(geojson.features) || !geojson.features.length) return;
      const t = WORDS[this.language === 'en' ? 'en' : 'zh'];
      this.borderLayer = L.geoJSON(geojson, {style: {color:'#fff', weight:1.3, opacity:.9, fillOpacity:0}, onEachFeature:(feature, layer) => {
        layer.bindTooltip(`${t.county}: ${feature.properties?.shapeName || t.unknown}`, {sticky:true});
      }});
      this.host.querySelector('#atlas-border-note').textContent = t.borderType;
    } catch { /* keep the explicit unavailable state */ }
  }

  async loadOsmBorders(){try{const r=await fetch('./data/hainan/regional/county-osm-reference-20261003.geojson');if(!r.ok)return;const data=await r.json();if(!this.map||data.features?.length!==18)return;this.osmBorders=L.geoJSON(data,{style:{color:'#244b57',weight:1.2,opacity:.9,fillOpacity:0,dashArray:'5 3'},onEachFeature:(f,l)=>l.bindTooltip(`${f.properties.name} · OSM 2026-10-03 · ${this.language==='en'?'community reference':'社区参考'}`,{sticky:true})});}catch{/* no guessed boundaries */}}

  async loadSanshaBorders(){
    try{const response=await fetch('./data/hainan/regional/administrative/sansha-osm-reference-20261003.geojson');if(!response.ok)return;const data=await response.json();if(!this.map||data.features?.length!==1||data.features[0].properties.osm_relation_id!==2833102)return;
      this.sanshaBorders=L.geoJSON(data,{style:{color:'#aa773e',weight:1.5,opacity:.9,fillOpacity:0,dashArray:'2 5'},onEachFeature:(_f,layer)=>{const content=document.createElement('span');content.textContent=this.language==='en'?'Sansha · OSM partial reference including sea · not official full jurisdiction':'三沙 · OSM部分范围参考，含海域 · 非官方完整辖界';layer.bindTooltip(content,{sticky:true});}});
      if(this.host.querySelector('#atlas-sansha-boundaries').checked)this.sanshaBorders.addTo(this.map);
    }catch{/* Keep the source unavailable rather than construct a boundary. */}
  }

  handleClick(event) {
    if(event.target.closest('#atlas-retry-raster')){if(REGIONAL_INFO[this.layer]){this.host.classList.add('atlas-error');this.host.querySelector(`[data-atlas="${this.layer}"]`).click();}return;}
    const button = event.target.closest('[data-atlas]');
    if (!button || !this.host.contains(button)) return;
    if (button.dataset.atlas === this.layer && !this.host.classList.contains('atlas-error')) return;
    if(this.remoteLayer){this.map.removeLayer(this.remoteLayer);this.remoteLayer=null;}
    this.host.querySelector('#atlas-regional-legend').hidden=true;
    this.host.querySelector('#atlas-runtime-coverage').textContent='';this.host.querySelector('#atlas-retry-raster').hidden=true;
    this.hasChosenLayer=true;
    this.layer = button.dataset.atlas;
    if(REGIONAL_INFO[this.layer]){this.selectRegional(button);return;}
    if(this.layer==='crops2025'||this.layer==='classes2025'){
      ++this.switchToken;
      this.overlay.setOpacity(0);
      this.host.classList.remove('atlas-loading','atlas-error');
      this.host.querySelector('#atlas-load-label').hidden=true;
      this.host.querySelector('#atlas-error-label').hidden=true;
      this.remoteLayer=createLandcoverLayer(L,{cropsOnly:this.layer==='crops2025',opacity:Number(this.host.querySelector('#atlas-opacity').value)/100}).addTo(this.map);
      this.remoteLayer.on('tileerror',()=>{if(!this.map)return;this.host.querySelector('#atlas-error-label').hidden=false;});
      this.host.querySelector('#atlas-current-title').textContent=this.layer==='crops2025'?'2025 Crops=5':'2025 All classes';
      this.host.querySelector('#atlas-current-type').textContent=this.language==='en'?'Impact Observatory / Microsoft / Esri · 10 m native · on demand. Annual model classification; not cadastral or statutory cultivated land.':'Impact Observatory / Microsoft / Esri · 10 m 原生 · 按视野加载。年度模型分类；非地籍或法定耕地。';
      this.host.querySelector('#atlas-inspect').textContent=this.language==='en'?'Clouds=10; transparent may be no data or hidden non-Crops classes. Main island/outlying islands/Sansha coverage not fully validated.':'云=10；透明可能是无数据（Crops 模式也隐藏其他类别）。本岛/离岛/三沙覆盖未逐像元核验。';
      for(const key of ['soil','soc'])this.host.querySelector(`#atlas-${key}-legend`).hidden=true;
      const legend=this.host.querySelector('#atlas-land-legend');legend.hidden=false;
      const attribution=this.host.querySelector('.atlas-attribution');
      if(!this.originalAttribution)this.originalAttribution=attribution.textContent;
      attribution.textContent='Impact Observatory, Microsoft, Esri · 2025 · source CC BY 4.0; online service Esri terms. Metadata: data/hainan/landcover-2025/item.json';
      if(!this.oldLandLegend)this.oldLandLegend=legend.innerHTML;
      legend.textContent=this.language==='en'?'1 Water · 2 Trees · 4 Flooded vegetation · 5 Crops · 7 Built area · 8 Bare ground · 9 Snow/ice · 10 Clouds · 11 Rangeland':'1 水体 · 2 树木 · 4 淹水植被 · 5 作物 · 7 建成区 · 8 裸地 · 9 冰雪 · 10 云（无有效分类） · 11 草灌地';
      this.host.querySelector('#atlas-cover-summary').hidden=true;
      for(const el of this.host.querySelectorAll('[data-atlas]'))el.setAttribute('aria-pressed',String(el===button));
      return;
    }
    if(this.oldLandLegend)this.host.querySelector('#atlas-land-legend').innerHTML=this.oldLandLegend;
    if(this.originalAttribution)this.host.querySelector('.atlas-attribution').textContent=this.originalAttribution;
    const soil = this.layer === 'soil', soc = this.layer === 'soc';
    const token = ++this.switchToken;
    const t = WORDS[this.language === 'en' ? 'en' : 'zh'];
    this.host.classList.remove('atlas-error');
    this.host.classList.add('atlas-loading');
    this.host.querySelector('#atlas-load-label').hidden = false;
    this.host.querySelector('#atlas-error-label').hidden = true;
    this.overlay.setOpacity(0);
    this.overlay.once('load', () => {
      if (token !== this.switchToken || !this.map) return;
      this.host.classList.remove('atlas-loading');
      this.host.classList.remove('atlas-error');
      this.host.querySelector('#atlas-load-label').hidden = true;
      this.overlay.setOpacity(Number(this.host.querySelector('#atlas-opacity').value) / 100);
      this.host.querySelector('#atlas-inspect').textContent = t.click;
    });
    this.overlay.once('error', () => {
      if (token !== this.switchToken || !this.map) return;
      this.host.classList.remove('atlas-loading');
      this.host.classList.add('atlas-error');
      this.host.querySelector('#atlas-load-label').hidden = true;
      this.host.querySelector('#atlas-error-label').hidden = false;
    });
    this.overlay.setUrl(`./data/hainan/${soil ? 'soil-ph' : soc ? 'soil-soc' : 'landcover'}-preview.png`);
    for (const el of this.host.querySelectorAll('[data-atlas]')) el.setAttribute('aria-pressed', String(el === button));
    const titleKey = soil ? 'soil' : soc ? 'soc' : 'land';
    const typeKey = soil ? 'soilType' : soc ? 'socType' : 'landType';
    this.host.querySelector('#atlas-current-title').innerHTML = duo(t[titleKey], WORDS.en[titleKey], this.language);
    this.host.querySelector('#atlas-current-type').innerHTML = duo(t[typeKey], WORDS.en[typeKey], this.language);
    this.host.querySelector('#atlas-land-legend').hidden = soil || soc;
    this.host.querySelector('#atlas-cover-summary').hidden = soil || soc;
    this.host.querySelector('#atlas-soil-legend').hidden = !soil;
    this.host.querySelector('#atlas-soc-legend').hidden = !soc;
  }

  handleInput(event) {
    if(event.target.id==='atlas-region'&&this.inventory){const scope=[...this.inventory.groups,...this.inventory.places].find(r=>r.id===event.target.value);if(scope){const b=scope.bbox;this.map.fitBounds([[b[1],b[0]],[b[3],b[2]]],{maxZoom:14});this.host.querySelector('#atlas-view-status').textContent=this.language==='en'?'Geographic query/sample; not an administrative boundary':'地理查询/样窗，非行政界';this.updateCoverage();}return;}
    if (event.target.id === 'atlas-opacity' && !this.host.classList.contains('atlas-loading')) (this.remoteLayer||this.overlay).setOpacity(Number(event.target.value) / 100);
    if(event.target.id==='atlas-sansha-boundaries'&&this.sanshaBorders){if(event.target.checked)this.sanshaBorders.addTo(this.map);else this.map.removeLayer(this.sanshaBorders);}
    if(event.target.id==='atlas-osm-boundaries'&&this.osmBorders){if(event.target.checked)this.osmBorders.addTo(this.map);else this.map.removeLayer(this.osmBorders);}
    if (event.target.id === 'atlas-boundaries' && this.borderLayer) {
      if (event.target.checked) this.borderLayer.addTo(this.map); else this.map.removeLayer(this.borderLayer);
    }
  }

  async inspect(latlng) {
    const inspectToken=this.inspectToken=(this.inspectToken||0)+1;
    if(this.remoteLayer?.regionalConfig){const layer=this.remoteLayer,config=layer.regionalConfig;const lead=`${latlng.lat.toFixed(5)}°N, ${latlng.lng.toFixed(5)}°E · `;const el=this.host.querySelector('#atlas-inspect');if(config.kind==='imagery'){el.textContent=lead+(this.language==='en'?'2025 multi-date display; source dates and cloud QA in coverage record. No crop or ownership inference.':'2025多日期影像；日期/排云详见覆盖记录。不据影像推断实际作物或权属。');return;}try{const v=await inspectRegional(config,latlng);if(this.remoteLayer!==layer||this.inspectToken!==inspectToken)return;el.textContent=lead+(v&&!v.unavailable?`${config.kind==='soil'?(this.language==='en'?'Predicted pH: ':'预测 pH: '):config.kind==='soc'?(this.language==='en'?'Predicted SOC: ':'预测 SOC: '):''}${v.value.toFixed(1)} ${v.units} · ${v.record.status==='coarse-context-only'?(this.language==='en'?'coarse context only; does not resolve this island':'仅粗格网背景，不解析该岛'):this.language==='en'?'source model/grid; not field observation':'来源模型/格网，非田间实测'}`:this.language==='en'?'No reliable source value at this point; no nearby-land substitution':'该点无可靠来源值，不用附近陆地值代替');}catch{if(this.remoteLayer===layer&&this.inspectToken===inspectToken)el.textContent=lead+(this.language==='en'?'Value unavailable':'数值读取失败');}return;}

    const t = WORDS[this.language === 'en' ? 'en' : 'zh'];
    if (this.host.classList.contains('atlas-loading') || this.host.classList.contains('atlas-error')) return;
    let value = this.remoteLayer ? (this.language==='en'?'2025 classes; native pixel not queried; clouds=10, transparent may be no data':'2025 分类；此处未查询原始像元；云=10，透明可能是无数据') : this.layer === 'landcover' ? '' : t.noSoil;
    const canvas = this.valueCanvases[this.layer];
    if (canvas && latlng.lng >= BOX[0][1] && latlng.lng <= BOX[1][1] && latlng.lat >= BOX[0][0] && latlng.lat <= BOX[1][0]) {
      const x = Math.min(canvas.width-1, Math.max(0, Math.floor((latlng.lng-BOX[0][1])/(BOX[1][1]-BOX[0][1])*canvas.width)));
      const y = Math.min(canvas.height-1, Math.max(0, Math.floor((BOX[1][0]-latlng.lat)/(BOX[1][0]-BOX[0][0])*canvas.height)));
      const pixel = canvas.getContext('2d').getImageData(x,y,1,1).data;
      const code = this.layer === 'soc' ? pixel[0]+256*pixel[1] : pixel[0];
      if (code) value = `${this.layer === 'soc' ? t.socValue : t.ph}: ${(code/10).toFixed(1)}${this.layer === 'soc' ? ' g/kg' : ''}`;
    }
    this.host.querySelector('#atlas-inspect').textContent = `${t.coords} ${latlng.lat.toFixed(3)}°N, ${latlng.lng.toFixed(3)}°E${value ? ` · ${value}` : ''}`;
  }



  updateCoverage(){
    const config=this.remoteLayer?.regionalConfig;if(!config)return;const id=this.host.querySelector('#atlas-region').value||'main';const r=config.records.find(x=>x.id===id||x.id.endsWith('-'+id));const target=this.host.querySelector('#atlas-regional-status');const en=this.language==='en';
    if(!r){target.textContent=en?'No precomputed overview for this geographic group. Imagery loads original COG windows from zoom12; absence of an overview is not proof of native-source completeness.':'该地理分组尚无整组预览。影像12级起按任意视窗读取原始COG；没有预览不能解释为原始源完整。';return;}
    const c=r.coverage||{},accepted=c.accepted_pixels??c.valid_cells,total=c.total_bbox_pixels??c.grid_cells;let text=Number.isFinite(accepted)&&total?`${en?'Window accepted/valid cells':'窗口接受/有效格'}: ${accepted.toLocaleString()} / ${total.toLocaleString()} (${(100*accepted/total).toFixed(2)}%). `:'';
    text=(en?'Selected-window record (does not follow panning). ':'所选样窗记录（不随平移改变）。')+text;
    text+=en?'Rectangle includes sea; not administrative land completeness. ':'矩形分母含海域，不是行政陆地完整率。';
    if(r.approx_main_island_land_audit){const a=r.approx_main_island_land_audit;text+=(en?'Inferred main-island mask display acceptance':'推测主岛掩膜内显示格接受率')+`: ${a.accepted_land_percent}%. `;}
    if(r.actual_contributing_dates?.length)text+=(en?'Contributing dates':'实际贡献日期')+`: ${r.actual_contributing_dates[0]} – ${r.actual_contributing_dates.at(-1)}. `;
    if(r.status==='coarse-context-only')text+=en?'Coarse context only; this small island is not spatially resolved. ':'仅粗格网背景，不能单独解析这个小岛。';
    if(r.status?.startsWith('unresolved'))text+=en?'Source-zero surface remains unresolved; no measured terrain claim. ':'来源零值尚未解析，不作为已知地形。';
    if(r.status?.startsWith('unavailable'))text+=en?'No supported prediction/source at this window. ':'该窗口无受支持来源/预测。';
    text+=en?'Native and overview support differ. SCL is not a cloud-free guarantee; mainland-China access untested.':'原始与概览尺度不同。SCL不保证无云；中国大陆网络未测。';target.textContent=text;
  }

  async loadRegionalInventory(){
    try{this.inventory=await regionInventory();if(!this.map)return;const select=this.host.querySelector('#atlas-region');select.innerHTML='';for(const r of [...this.inventory.groups,...this.inventory.places]){const option=document.createElement('option');option.value=r.id;option.textContent=this.language==='en'?r.name_en:r.name_zh;select.append(option);}select.disabled=false;
      if(!this.hasChosenLayer)this.host.querySelector('[data-atlas="imagery"]').click();
      const res=await fetch('./data/hainan/regional/landcover2025-main-island-summary.json');if(!res.ok)return;const data=await res.json();if(!this.map)return;const crop=data.classes.find(r=>r.code===5);this.host.querySelector('#atlas-2025-area').textContent=this.language==='en'?`2025 source Crops=5: ${crop.km2.toLocaleString('en-US',{maximumFractionDigits:2})} km² in an inferred main-island mask. Not official cultivated land. Different from WorldCover definitions; not a growth comparison.`:`2025原始Crops=5：推测主岛掩膜内 ${crop.km2.toLocaleString('zh-CN',{maximumFractionDigits:2})} km²。非官方耕地；与WorldCover分类体系不同，不能作为增长比较。`;
    }catch{if(this.map)this.host.querySelector('#atlas-view-status').textContent=this.language==='en'?'Regional manifest unavailable':'区域清单暂不可用';}
  }

  async selectRegional(button){
    const key=this.layer,info=REGIONAL_INFO[key],token=++this.switchToken;this.overlay.setOpacity(0);this.host.classList.add('atlas-loading');this.host.classList.remove('atlas-error');this.host.querySelector('#atlas-load-label').hidden=false;this.host.querySelector('#atlas-error-label').hidden=true;
    for(const el of this.host.querySelectorAll('[data-atlas]'))el.setAttribute('aria-pressed',String(el===button));
    this.host.querySelector('#atlas-current-title').textContent=this.language==='en'?info.en:info.zh;
    this.host.querySelector('#atlas-current-type').textContent=this.language==='en'?info.detailEn:info.detailZh;
    this.host.querySelector('#atlas-inspect').textContent=this.language==='en'?'Click for coordinates and source-grid values; transparent means unavailable.':'点击查询坐标和来源格网值；透明表示未取得有效值。';
    for(const id of ['atlas-cover-summary','atlas-land-legend','atlas-soil-legend','atlas-soc-legend'])this.host.querySelector('#'+id).hidden=true;
    const scales={dsm:{colors:['#e0efc1','#82b479','#b3a76f','#a67559','#faf3e6'],stops:[0,5.263,26.316,52.632,100],ticks:['0','100','500','1000','1900 m']},rain:{colors:['#f6e9ae','#9cca96','#409ba0','#2e64a6','#48337d'],stops:[0,25,50,75,100],ticks:['0','1000','2000','3000','4000 mm/yr']},soil:{colors:['#a13e34','#cc6740','#e1c16b','#539779'],stops:[0,28.571,57.143,100],ticks:['4.0','5.0','6.0','7.5 pH']},soc:{colors:['#f7eab3','#dcd282','#77a772','#216d70','#25395b'],stops:[0,20,40,65,100],ticks:['0','20','40','65','100 g/kg']}};
    const legend=this.host.querySelector('#atlas-regional-legend'),scale=scales[key];if(scale){legend.hidden=false;legend.innerHTML=`<div class="regional-gradient" style="background:linear-gradient(to right,${scale.colors.map((c,i)=>c+' '+scale.stops[i]+'%').join(',')})"></div><div class="regional-scale">${scale.ticks.map((t,i)=>key==='dsm'&&i===1?'':`<span style="left:${scale.stops[i]}%;transform:translateX(${i===0?'0':i===scale.ticks.length-1?'-100%':'-50%'})">${t}</span>`).join('')}</div><small>${this.language==='en'?'Transparent: no displayed source value; raster cells retain native support.':'透明：无可显示来源值；粗网格仍按原始空间支撑解释。'}</small>`;}
    const attribution=this.host.querySelector('.atlas-attribution');if(!this.originalAttribution)this.originalAttribution=attribution.textContent;attribution.textContent=info.attribution;
    try{
      const layer=await regionalLayer(L,key,{opacity:Number(this.host.querySelector('#atlas-opacity').value)/100});if(token!==this.switchToken||!this.map)return;
      this.remoteLayer=layer;this.updateCoverage();
      layer.on('loading',()=>{if(this.remoteLayer!==layer)return;this.host.querySelector('#atlas-load-label').hidden=false;this.updateRasterViewStatus();});
      layer.on('load',()=>{if(this.remoteLayer!==layer)return;this.host.classList.remove('atlas-loading');this.host.querySelector('#atlas-load-label').hidden=true;this.updateRasterViewStatus();});
      layer.on('coverage',()=>{if(this.remoteLayer===layer)this.updateRasterViewStatus();});
      layer.on('tileerror',()=>{if(this.remoteLayer===layer)this.updateRasterViewStatus();});
      layer.addTo(this.map);this.updateRasterViewStatus();
    }catch{
      if(token!==this.switchToken||!this.map)return;this.host.classList.remove('atlas-loading');this.host.classList.add('atlas-error');this.host.querySelector('#atlas-load-label').hidden=true;this.host.querySelector('#atlas-error-label').hidden=false;
      this.host.querySelector('#atlas-runtime-coverage').textContent=this.language==='en'?'Layer metadata request failed. Source coverage is unknown; retry.':'图层目录请求失败；不能由此判断源覆盖，可重试。';this.host.querySelector('#atlas-retry-raster').hidden=false;
    }
  }

  updateRasterViewStatus(){
    if(!this.map||!this.remoteLayer?.coverageForBounds)return;
    const b=this.map.getBounds(),rows=this.remoteLayer.coverageForBounds([b.getWest(),b.getSouth(),b.getEast(),b.getNorth()]);
    const overview=this.remoteLayer.regionalConfig?.kind==='imagery'&&this.map.getZoom()<12&&rows.some(r=>r.native===false&&r.status!=='loading');
    const hint=overview?(this.language==='en'?'Overview at this scale; use the map + control to reach zoom 12 for native-source windows. ':'当前为概览显示；点击地图“＋”放大到12级可读取原始视窗。'):'';
    this.host.querySelector('#atlas-runtime-coverage').textContent=hint+runtimeCoverageText(rows,this.language==='en');
    const failed=rows.some(r=>['read-error','incomplete-read','partial-read','quality-unavailable','timeout'].includes(r.status));
    this.host.querySelector('#atlas-retry-raster').hidden=!failed;this.host.querySelector('#atlas-error-label').hidden=!failed;this.host.classList.toggle('atlas-error',failed);
  }

  destroy() {
    this.coveragePanel?.destroy();
    this.host.removeEventListener('click', this.clickHandler);
    this.host.removeEventListener('input', this.inputHandler);
    ++this.switchToken;
    this.inspectToken=(this.inspectToken||0)+1;
    if(this.map){this.map._animatingZoom=false;this.map.stop();this.map.off();this.map.remove();}
    this.map=null;this.remoteLayer=null;
  }
}
