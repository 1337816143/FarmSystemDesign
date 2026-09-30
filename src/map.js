/** Local Leaflet engine, georeferenced historical imagery and untouched source polygons. */
import {CROPS,centroid} from './data.js';
import {esc,fmt,icon} from './utils.js';
export function project([lon,lat],z){const n=256*2**z,s=Math.sin(lat*Math.PI/180);return [(lon+180)/360*n,(.5-Math.log((1+s)/(1-s))/(4*Math.PI))*n];}
export function unproject([x,y],z){const n=256*2**z;return [x/n*360-180,Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI];}
const palette=['#82c9b0','#e4bd7a','#97bad0','#b7a0cb','#a9bf86','#e0a49a'];
const ll=p=>[p[1],p[0]];
export class FarmMap{
 constructor(el,options){
  this.el=el;this.o=options;this.layers={};this.plotLayers={};this.hidden=false;
  if(!globalThis.L){el.innerHTML='<div class="empty">地图引擎未加载，请刷新；未用虚构地图替代。</div>';return;}
  const L=globalThis.L;this.L=L;
  el.innerHTML='<div class="leaflet-host"></div><div class="map-location"><span class="map-dot"></span><div><b>YAZHOU · HAINAN</b><small>空间证据窗口 / 非已确认研究区</small></div></div><div class="map-north" aria-label="地图正北向上"><span>N</span>↑</div><div class="map-coordinate">WGS84 · EPSG:4326</div><div class="map-mini-legend"><span><i></i>公开预测边界 · 未地面核验</span><span><i class="sel"></i>选中单元</span></div>';
  const m=this.map=L.map(el.querySelector('.leaflet-host'),{zoomControl:false,attributionControl:true,zoomSnap:.25,zoomDelta:.5,minZoom:11,maxZoom:18,preferCanvas:false,fadeAnimation:true,zoomAnimation:true});
  m.attributionControl.setPrefix(false);
  m.attributionControl.addAttribution('<a href="https://source.coop/ftw/global-data" target="_blank" rel="noreferrer">FTW/PRUE · CC-BY-4.0</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap · ODbL</a>');
  m.createPane('imagery');m.getPane('imagery').style.zIndex=210;
  m.createPane('context');m.getPane('context').style.zIndex=240;
  m.createPane('source');m.getPane('source').style.zIndex=300;
  m.createPane('parcels');m.getPane('parcels').style.zIndex=450;
  m.getPane('imagery').style.pointerEvents='none';m.getPane('context').style.pointerEvents='none';
  this.plotGroup=L.featureGroup().addTo(m);this.connectionGroup=L.featureGroup().addTo(m);
  this.setBasemap(options.basemap||'satellite');
  this.setSourceLayers();
  const selected=new Set(options.selectedIds),owners=options.data.farms.map(f=>f.id);
  for(const p of options.data.plots){
    const active=selected.has(p.farmId),crop=CROPS[options.allocation?.[p.id]||p.crop];
    const color=options.theme==='activity'?crop.color:options.theme==='owner'?palette[owners.indexOf(p.farmId)%palette.length]:options.theme==='area'?(p.areaHa<.3?'#bdd9cc':p.areaHa<1?'#88c6ad':'#4ca481'):'#a5e5c7';
    const layer=L.geoJSON({type:'Feature',geometry:p.geometry,properties:{id:p.id}},{pane:'parcels',style:{color,weight:active?1.3:.7,opacity:active?.92:.20,fillColor:color,fillOpacity:active?(options.opacity??.12):.01,className:'parcel',lineJoin:'round'}}).addTo(this.plotGroup);
    layer._p=p;layer._color=color;layer._active=active;
    layer.bindTooltip(`<b>${esc(p.id)}</b><span>${fmt(p.areaHa,2)} ha</span><small>公开预测边界 · ${esc(p.sourceId||'用户资料')}</small>`,{className:'field-tooltip',direction:'top',sticky:true,opacity:1});
    layer.on('mouseover',()=>{if(p.id!==this.o.selectedPlot)layer.setStyle({weight:2.4,opacity:1,fillOpacity:.22});});
    layer.on('mouseout',()=>this.styleLayer(layer));
    layer.on('click',()=>{this.highlight(p.id);options.onSelect?.(p.id);});
    layer.eachLayer(l=>{const path=l.getElement?.();if(path){path.dataset.plotId=p.id;path.setAttribute('aria-label',`${p.id}，公开预测单元，${fmt(p.areaHa,2)}公顷，未核实经营者`);path.setAttribute('tabindex','0');path.setAttribute('role','button');path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.highlight(p.id);options.onSelect?.(p.id);}});}});
    this.plotLayers[p.id]=layer;
  }
  if(options.showResources){for(const f of options.data.farms.filter(f=>selected.has(f.id))){L.circleMarker(ll(f.center),{radius:5,color:'#f3cf8d',fillOpacity:1,weight:1}).bindTooltip(`${esc(f.name)} · 假设关系锚点，不是设施实测坐标`).addTo(this.connectionGroup);for(const p of options.data.plots.filter(p=>p.farmId===f.id)){L.polyline([ll(f.center),ll(centroid(p))],{color:'#ecd395',weight:1,opacity:.7,dashArray:'4 5',interactive:false}).addTo(this.connectionGroup);}}}
  const control=L.control({position:'topright'});control.onAdd=()=>{const d=L.DomUtil.create('div','map-control-stack');d.innerHTML=`<button data-map="plus" title="放大" aria-label="地图放大">＋</button><button data-map="minus" title="缩小" aria-label="地图缩小">−</button><button data-map="fit" title="适配所选范围" aria-label="适配所选范围">${icon('target')}</button><button data-map="compare" title="只看原始影像" aria-label="显示或隐藏边界">${icon('layers')}</button><button data-map="fullscreen" title="展开地图" aria-label="地图全屏">${icon('expand')}</button>`;L.DomEvent.disableClickPropagation(d);L.DomEvent.disableScrollPropagation(d);d.onclick=e=>{const a=e.target.closest('[data-map]')?.dataset.map;if(a==='plus')m.zoomIn();if(a==='minus')m.zoomOut();if(a==='fit')this.fit();if(a==='compare'){this.hidden=!this.hidden;m.getPane('parcels').style.opacity=this.hidden?'0':'1';m.getPane('source').style.opacity=this.hidden?'0':'1';d.querySelector('[data-map="compare"]').classList.toggle('active',this.hidden);d.querySelector('[data-map="compare"]').setAttribute('aria-pressed',this.hidden);}if(a==='fullscreen'){if(document.fullscreenElement)document.exitFullscreen?.();else el.requestFullscreen?.();}};return d;};control.addTo(m);
  L.control.scale({position:'bottomleft',imperial:false,maxWidth:110}).addTo(m);
  if(options.view)m.setView(ll(options.view.center),options.view.zoom,{animate:false});else this.fit(false);
  this.highlight(options.selectedPlot);
  Object.values(this.plotLayers).forEach(layer=>layer.eachLayer(l=>{const path=l.getElement?.();if(path&&!path.dataset.plotId){const p=layer._p;path.dataset.plotId=p.id;path.setAttribute('tabindex','0');path.setAttribute('role','button');path.setAttribute('aria-label',`${p.id}，${fmt(p.areaHa,2)}公顷，公开预测边界`);path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.highlight(p.id);options.onSelect?.(p.id);}});}}));
  m.on('moveend',()=>{const c=m.getCenter();this.o.onView?.({center:[c.lng,c.lat],zoom:m.getZoom()});});
  m.on('mousemove',e=>{el.querySelector('.map-coordinate').textContent=`${e.latlng.lng.toFixed(5)}° E  ${e.latlng.lat.toFixed(5)}° N · WGS84`;});
  this.resize=new ResizeObserver(()=>m.invalidateSize({pan:false}));this.resize.observe(el);
 }
 styleLayer(layer){const selected=layer._p.id===this.o.selectedPlot;layer.setStyle({color:selected?'#f6d18a':layer._color,weight:selected?2.5:layer._active?1.3:.7,opacity:selected?1:layer._active?.92:.2,fillColor:selected?'#eac16f':layer._color,fillOpacity:selected?.28:layer._active?(this.o.opacity??.12):.01});}
 highlight(id){this.o.selectedPlot=id;Object.values(this.plotLayers).forEach(l=>this.styleLayer(l));this.plotLayers[id]?.bringToFront();}
 setOpacity(v){this.o.opacity=v;Object.values(this.plotLayers).forEach(l=>this.styleLayer(l));}
 fit(animate=true){const {L,map:m,o}=this;const ps=o.data.plots.filter(p=>o.selectedIds.includes(p.farmId));const b=L.geoJSON({type:'FeatureCollection',features:ps.map(p=>({type:'Feature',geometry:p.geometry}))}).getBounds();if(b.isValid())m.fitBounds(b,{padding:[44,44],maxZoom:16,animate,duration:.6});}
 setSourceLayers(){const {o,L,map:m}=this;if(o.osmPatches&&o.showOSM)this.layers.osmEvidence=L.geoJSON(o.osmPatches,{pane:'source',interactive:false,style:{color:'#ffc775',weight:1.6,fill:false,dashArray:'6 5',opacity:.8}}).addTo(m);if(o.allFields&&o.showAllFields)this.layers.allFields=L.geoJSON(o.allFields,{pane:'source',interactive:false,style:{color:'#a9c6d9',weight:.7,fill:false,opacity:.48}}).addTo(m);}
 setBasemap(type){const {o,L,map:m}=this;this.o.basemap=type;if(this.base)m.removeLayer(this.base);if(this.contextLayer)m.removeLayer(this.contextLayer);this.base=null;this.el.classList.toggle('vector-mode',type==='context');
  if(type==='satellite'&&o.imagery){const im=o.imagery;this.base=L.imageOverlay('./data/evidence/'+im.filename,[[im.bbox[1],im.bbox[0]],[im.bbox[3],im.bbox[2]]],{pane:'imagery',className:'satellite-snapshot',opacity:1,attribution:'Contains modified Copernicus Sentinel data (2025) · 2025-03-22 · 10 m'}).addTo(m);this.base.on('error',()=>{this.el.querySelector('.map-coordinate').textContent='影像加载失败 · 边界不是影像替代';});}
  if(type==='osm')this.base=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'}).addTo(m);
  if(type==='context'||type==='satellite'&&!o.imagery){this.contextLayer=L.geoJSON(o.context||{type:'FeatureCollection',features:[]},{pane:'context',interactive:false,style:f=>{const t=f.properties?.tags||f.properties||{};const water=t.waterway||t.natural==='water';return {color:water?'#83aab5':t.highway?'#b2b9ad':'#7a9e88',weight:t.highway?1.8:1,fillColor:water?'#bad8df':t.landuse==='farmland'?'#dce8d8':'#ebeee7',fillOpacity:.75,opacity:.8};}}).addTo(m);}
 }
 destroy(){this.resize?.disconnect();if(this.map){
  // Leaflet 1.9.4 leaves a 250 ms zoom-transition timer after remove().
  // Disarm it before disposing the pane; otherwise rapid navigation dereferences a removed map.
  this.map._animatingZoom=false;this.map.stop();this.map.off();this.map.remove();this.map=null;
 }}
}
