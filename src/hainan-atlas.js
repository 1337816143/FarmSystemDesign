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
    eyebrow: '海南空间证据 / 首批真实图层', title: '从全岛底图开始，逐层核对区域差异',
    intro: '土地覆被来自 ESA WorldCover；土壤酸碱度来自 ISRIC SoilGrids 预测。地图是研究线索，不是地籍、现势土地用途或田间实测。',
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
    mapExtent: '图幅包含海南岛及邻近大陆、海域；不覆盖海南省全部离岛与三沙。',
    coords: '坐标', overlay: '图层透明度',
  },
  en: {
    eyebrow: 'HAINAN SPATIAL EVIDENCE / FIRST REAL LAYERS', title: 'Map regional variation from traceable island-wide layers',
    intro: 'Land cover comes from ESA WorldCover. Soil pH comes from ISRIC SoilGrids predictions. This map is a research lead, not cadastral data, current legal land use or field measurements.',
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
    mapExtent: 'The map window includes Hainan Island and nearby mainland and sea; it does not cover all outlying islands or Sansha.',
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
      <button type="button" data-atlas="landcover" aria-pressed="true">${label('land')}</button>
      <button type="button" data-atlas="soil" aria-pressed="false">${label('soil')}</button>
      <button type="button" data-atlas="soc" aria-pressed="false">${label('soc')}</button>
      <label><input id="atlas-boundaries" type="checkbox"> ${label('borders')}</label>
    </div><div id="hainan-atlas-map" class="atlas-map" role="img" aria-label="Hainan spatial evidence map"></div><div class="atlas-map-foot"><span id="atlas-inspect" role="status" aria-live="polite">${label('click')}</span><strong id="atlas-load-label" hidden>${label('loading')}</strong><strong id="atlas-error-label" hidden>${label('loadError')}</strong><label>${label('overlay')} <input id="atlas-opacity" type="range" min="30" max="100" value="95"></label></div>
    <div class="atlas-area" id="atlas-cover-summary"><strong>${label('areaTitle')}</strong><div id="atlas-area-chart" role="group" aria-label="${t.areaTitle}">${label('areaUnavailable')}</div><p>${label('areaMethod')}</p><a href="./docs/Hainan_DATA_SOURCE_AUDIT.md" target="_blank" rel="noopener noreferrer">${label('areaSource')} ↗</a></div></div>
    <aside class="atlas-aside"><div class="atlas-layer-id"><b id="atlas-current-title">${label('land')}</b><p id="atlas-current-type">${label('landType')}</p></div>
      <div class="atlas-unit-check"><strong>${label('unitTitle')}</strong><div class="atlas-unit-counts"><span><b>18</b>${label('unitHistorical')}</span><span><b>19</b>${label('unitOfficial')}</span><span><b>18</b>${label('unitAgriculture')}</span></div><p>${label('unitMismatch')}</p><a href="./docs/HAINAN_ADMIN_STAT_UNITS_AUDIT.md" target="_blank" rel="noopener noreferrer">${label('unitSource')} ↗</a></div>
      <div class="atlas-land-legend" id="atlas-land-legend">${coverLegend}</div>
      <div class="atlas-soil-legend" id="atlas-soil-legend" hidden><div class="atlas-gradient"></div><div><span>4.0</span><span>5.0</span><span>6.0</span><span>7.0</span></div><p>${label('soilLegend')}</p></div>
      <div class="atlas-soil-legend" id="atlas-soc-legend" hidden><div class="atlas-gradient soc"></div><div><span>0</span><span>25</span><span>50</span><span>75</span><span>100+</span></div><p>${label('socLegend')}</p></div>
      <p class="atlas-border-note" id="atlas-border-note">${label('noCounty')}</p><p class="atlas-extent">${label('mapExtent')}</p><p class="atlas-caution">${label('caution')}</p>
      <div class="atlas-source-links"><a href="https://esa-worldcover.org/en/data-access" target="_blank" rel="noopener noreferrer">${label('landSource')} ↗</a><a href="https://docs.isric.org/globaldata/soilgrids/" target="_blank" rel="noopener noreferrer">${label('soilSource')} ↗</a><a href="https://www.geoboundaries.org/api/current/gbOpen/CHN/ADM2/" target="_blank" rel="noopener noreferrer">geoBoundaries CHN ADM2 (2017) ↗</a></div>
      <p class="atlas-attribution">© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium. © ISRIC — World Soil Information. geoBoundaries CHN ADM2, 2017.</p>
    </aside></div></section>`;
}

export class HainanAtlas {
  constructor(element, language = 'zh') {
    this.host = element;
    this.language = language;
    this.layer = 'landcover';
    this.map = L.map(element.querySelector('#hainan-atlas-map'), {scrollWheelZoom: false, attributionControl: false, zoomSnap: 0.25, minZoom: 6});
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

  handleClick(event) {
    const button = event.target.closest('[data-atlas]');
    if (!button || !this.host.contains(button)) return;
    if (button.dataset.atlas === this.layer && !this.host.classList.contains('atlas-error')) return;
    this.layer = button.dataset.atlas;
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
    if (event.target.id === 'atlas-opacity' && !this.host.classList.contains('atlas-loading')) this.overlay.setOpacity(Number(event.target.value) / 100);
    if (event.target.id === 'atlas-boundaries' && this.borderLayer) {
      if (event.target.checked) this.borderLayer.addTo(this.map); else this.map.removeLayer(this.borderLayer);
    }
  }

  inspect(latlng) {
    const t = WORDS[this.language === 'en' ? 'en' : 'zh'];
    if (this.host.classList.contains('atlas-loading') || this.host.classList.contains('atlas-error')) return;
    let value = this.layer === 'landcover' ? '' : t.noSoil;
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

  destroy() {
    this.host.removeEventListener('click', this.clickHandler);
    this.host.removeEventListener('input', this.inputHandler);
    this.map?.remove(); this.map = null;
  }
}
