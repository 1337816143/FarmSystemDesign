// Hainan evidence atlas. The geospatial products never enter the farm model.
const BOX = [[17.8, 108.5], [20.5, 111.5]];
const COVER_CLASSES = [
  ['#006400','树木覆盖','Tree cover'],['#ffbb22','灌丛','Shrubland'],
  ['#ffff4c','草地','Grassland'],['#f096ff','耕地覆被','Cropland cover'],
  ['#fa0000','建成区','Built-up'],['#b4b4b4','裸地','Bare/sparse'],
  ['#f0f0f0','冰雪','Snow/ice'],['#0064c8','永久水体','Permanent water'],
  ['#0096a0','草本湿地','Herbaceous wetland'],['#00cf75','红树林','Mangroves'],
  ['#fae6a0','苔藓地衣','Moss/lichen'],
];
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
    </div><div id="hainan-atlas-map" class="atlas-map" role="img" aria-label="Hainan spatial evidence map"></div><div class="atlas-map-foot"><span id="atlas-inspect">${label('click')}</span><strong id="atlas-load-label" hidden>${label('loading')}</strong><strong id="atlas-error-label" hidden>${label('loadError')}</strong><label>${label('overlay')} <input id="atlas-opacity" type="range" min="30" max="100" value="95"></label></div></div>
    <aside class="atlas-aside"><div class="atlas-layer-id"><b id="atlas-current-title">${label('land')}</b><p id="atlas-current-type">${label('landType')}</p></div>
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
