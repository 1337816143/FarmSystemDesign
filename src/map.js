/** Dependency-free Web Mercator map. Vector snapshots work offline; OSM tiles only on human selection. */
import {CROPS,centroid} from './data.js';
import {esc,fmt} from './utils.js';
export function project([lon,lat],z){const n=256*2**z,s=Math.sin(Math.max(-85,Math.min(85,lat))*Math.PI/180);return [(lon+180)/360*n,(.5-Math.log((1+s)/(1-s))/(4*Math.PI))*n];}
export function unproject([x,y],z){const n=256*2**z;return [x/n*360-180,Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI];}
export class FarmMap{
 constructor(el,{data,context,imagery,selectedIds=[],selectedPlot=null,onSelect=()=>{},onView=()=>{},allocation=null,theme='activity',basemap='context',showResources=true,view=null}){
  Object.assign(this,{el,data,context,imagery,selectedIds,selectedPlot,onSelect,onView,allocation,theme,basemap,showResources});
  this.center=view?.center||data.center;this.zoom=view?.zoom||14;this.destroyed=false;this.tiles=new Map();
  el.innerHTML='<div class="map-raster"></div><svg class="map-svg" role="img" aria-label="研究区交互地图，虚拟地块以虚线标识"></svg><div class="map-zoom"><button data-map="plus" title="放大" aria-label="放大地图">+</button><button data-map="minus" title="缩小" aria-label="缩小地图">−</button><button data-map="fit" title="适配所选范围" aria-label="适配所选范围">⌖</button></div><div class="map-north">N<span>↑</span></div><div class="map-scale"></div><div class="map-attribution"></div><div class="map-errors" hidden></div>';
  this.svg=el.querySelector('svg');this.raster=el.querySelector('.map-raster');
  this.ro=new ResizeObserver(()=>this.draw());this.ro.observe(el);
  this.handlers={wheel:e=>{e.preventDefault();this.changeZoom(e.deltaY>0?-1:1);},pointerdown:e=>{if(e.target.closest('button,a'))return;this.drag={x:e.clientX,y:e.clientY,center:project(this.center,this.zoom),moved:false};},pointermove:e=>{if(!this.drag)return;const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;if(Math.abs(dx)+Math.abs(dy)>4)this.drag.moved=true;this.center=unproject([this.drag.center[0]-dx,this.drag.center[1]-dy],this.zoom);this.schedule(false);},pointerup:()=>{if(this.drag){this.wasDragged=this.drag.moved;this.drag=null;this.draw();setTimeout(()=>this.wasDragged=false,30);}},click:e=>{const action=e.target.closest('[data-map]')?.dataset.map;if(action==='plus')this.changeZoom(1);if(action==='minus')this.changeZoom(-1);if(action==='fit')this.fit();const id=e.target.closest('[data-plot]')?.dataset.plot;if(id&&!this.wasDragged)this.onSelect(id);},keydown:e=>{const id=e.target.closest('[data-plot]')?.dataset.plot;if(id&&(e.key==='Enter'||e.key===' ')){e.preventDefault();this.onSelect(id);}}};
  for(const [k,f]of Object.entries(this.handlers))el.addEventListener(k,f,k==='wheel'?{passive:false}:undefined);
  this.up=this.handlers.pointerup;window.addEventListener('pointerup',this.up);this.draw();if(!view)this.fit();
 }
 schedule(tiles=true){if(this.raf)return;this.raf=requestAnimationFrame(()=>{this.raf=null;this.draw(tiles);});}
 changeZoom(d){this.zoom=Math.max(10,Math.min(18,this.zoom+d));this.draw();}
 fit(){const ids=new Set(this.selectedIds),plots=this.data.plots.filter(p=>ids.has(p.farmId));if(!plots.length)return;const pts=plots.flatMap(p=>p.geometry.coordinates[0]).map(c=>project(c,0)),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);this.center=unproject([(minx+maxx)/2,(miny+maxy)/2],0);this.zoom=Math.min(18,Math.max(10,Math.floor(Math.log2(Math.min((this.el.clientWidth-120)/(maxx-minx),(this.el.clientHeight-120)/(maxy-miny))))));this.draw();}
 point(c){const p=project(c,this.zoom),center=project(this.center,this.zoom);return [p[0]-center[0]+this.w/2,p[1]-center[1]+this.h/2];}
 path(coords,closed=false){return coords.map((c,i)=>{const [x,y]=this.point(c);return `${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`;}).join(' ')+(closed?'Z':'');}
 draw(updateTiles=true){
  if(this.destroyed)return;this.w=this.el.clientWidth||900;this.h=this.el.clientHeight||450;this.svg.setAttribute('viewBox',`0 0 ${this.w} ${this.h}`);
  const [west,south]=unproject([project(this.center,this.zoom)[0]-this.w/2,project(this.center,this.zoom)[1]+this.h/2],this.zoom),[east,north]=unproject([project(this.center,this.zoom)[0]+this.w/2,project(this.center,this.zoom)[1]-this.h/2],this.zoom);
  let grid='';const step=this.zoom>=16?.002:this.zoom>=14?.01:.04;
  for(let x=Math.ceil(west/step)*step;x<east;x+=step){const [px]=this.point([x,this.center[1]]);grid+=`<path d="M${px} 0V${this.h}"/><text x="${px+4}" y="${this.h-30}">${x.toFixed(3)}°E</text>`;}
  for(let y=Math.ceil(south/step)*step;y<north;y+=step){const [,py]=this.point([this.center[0],y]);grid+=`<path d="M0 ${py}H${this.w}"/><text x="8" y="${py-4}">${y.toFixed(3)}°N</text>`;}
  let context='';if(this.basemap==='context')for(const f of this.context?.features||[]){const p=f.properties,g=f.geometry,water=Boolean(p.waterway||p.natural==='water'),closed=g.type==='Polygon',c=closed?g.coordinates[0]:g.coordinates;if(!c?.length)continue;context+=`<path d="${this.path(c,closed)}" class="context-${water?'water':closed?'land':'road'}" ${closed?'':'fill="none"'}><title>${esc(p.name||p.highway||p.waterway||p.landuse||'OSM地理要素')}</title></path>`;}
  const selected=new Set(this.selectedIds);let parcels='',labels='',resources='';
  for(const p of this.data.plots){const active=selected.has(p.farmId),c=CROPS[this.allocation?.[p.id]||p.crop];let color=c.color;
    if(this.theme==='owner'){const i=this.data.farms.findIndex(f=>f.id===p.farmId);color=['#729b7a','#c4a260','#8f8fb0','#6f9dac'][i%4];}
    if(this.theme==='soil')color=(p.soilFactor||1)>1.02?'#578c68':(p.soilFactor||1)>.93?'#acc18c':'#d4b16e';
    parcels+=`<path d="${this.path(p.geometry.coordinates[0],true)}" data-plot="${esc(p.id)}" tabindex="0" role="button" aria-label="${esc(p.name)}, ${esc(c.name)}, ${fmt(p.areaHa,2)}公顷, ${p.provenance==='synthetic'?'虚拟演示':'用户数据未核验'}" class="parcel ${p.id===this.selectedPlot?'selected':''} ${active?'':'muted'}" fill="${color}" stroke-dasharray="${p.geometrySource==='synthetic'?'5 3':'none'}"><title>${esc(p.id)} · ${esc(c.name)} · ${fmt(p.areaHa,2)} ha · ${p.geometrySource==='synthetic'?'虚拟地块':'用户几何'}</title></path>`;
    const [x,y]=this.point(centroid(p));if(this.zoom>=14)labels+=`<text x="${x}" y="${y+3}" class="plot-label" opacity="${active?1:.3}">${esc(p.id)}</text>`;
  }
  for(const v of this.data.villages){const farms=this.data.farms.filter(f=>f.villageId===v.id),center=v.center||farms[0]?.center;if(!center)continue;const [x,y]=this.point([center[0]+.003,center[1]+.003]);
    labels+=`<g class="village-label"><rect x="${x-64}" y="${y-82}" width="128" height="27" rx="13"/><text x="${x}" y="${y-64}">${esc(v.name)}</text></g>`;
    if(this.showResources){for(const f of farms.filter(f=>selected.has(f.id))){const ps=this.data.plots.filter(p=>p.farmId===f.id);if(!ps.length)continue;const [a,b]=this.point(centroid(ps[0]));resources+=`<path class="resource-link" d="M${x} ${y}Q${x} ${b} ${a} ${b}"/>`;}
      resources+=`<circle class="resource-node" cx="${x}" cy="${y}" r="9"/><text x="${x}" y="${y+3}" class="resource-glyph">水</text>`;
    }
  }
  const b=this.data.extent||[west,south,east,north],boundary=this.path([[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]],[b[0],b[1]]],true);
  this.svg.innerHTML=`<g class="map-grid">${grid}</g><g>${context}</g><path class="study-boundary" d="${boundary}"/><g>${resources}</g><g>${parcels}</g><g pointer-events="none">${labels}</g>`;
  const metersPerPx=40075016.686*Math.cos(this.center[1]*Math.PI/180)/(256*2**this.zoom),distance=this.zoom>=16?100:this.zoom>=14?500:2000;
  this.el.querySelector('.map-scale').innerHTML=`<span style="width:${distance/metersPerPx}px"></span>${distance>=1000?distance/1000+' km':distance+' m'} · EPSG:4326`;
  this.el.querySelector('.map-attribution').innerHTML=this.basemap==='satellite'?`NASA GIBS / MODIS · ${esc(this.imagery?.date||"日期未知")} · 250 m浏览影像`:`© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>${this.basemap==='context'?' · 本地矢量快照':''}`;
  if(updateTiles)this.drawRaster();this.onView({center:[...this.center],zoom:this.zoom});
 }
 drawRaster(){
  const errors=this.el.querySelector('.map-errors');errors.hidden=true;
  if(this.basemap==='context'){this.raster.innerHTML='';this.tiles.clear();if(!this.context?.features?.length){errors.hidden=false;errors.textContent='公开矢量快照未加载，可切换 OSM 在线地图；下方仅显示虚拟对象与坐标网格。';}return;}
  if(this.basemap==='satellite'){
    if(!this.imagery){this.raster.innerHTML='';errors.hidden=false;errors.textContent='卫星快照尚未获取，未使用虚拟影像替代。';return;}
    const b=this.imagery.bbox,[x,y]=this.point([b[0],b[3]]),[right,bottom]=this.point([b[2],b[1]]);this.raster.innerHTML=`<img class="satellite-snapshot" alt="NASA MODIS ${esc(this.imagery.date)}公开浏览影像，250米分辨率，不是地块实测" src="./data/public/${esc(this.imagery.filename||"modis-2025-03-15.jpg")}" style="left:${x}px;top:${y}px;width:${right-x}px;height:${bottom-y}px">`;return;
  }
  const cp=project(this.center,this.zoom),ox=cp[0]-this.w/2,oy=cp[1]-this.h/2,minx=Math.floor(ox/256),maxx=Math.floor((ox+this.w)/256),miny=Math.floor(oy/256),maxy=Math.floor((oy+this.h)/256),active=new Set();
  for(let x=minx;x<=maxx;x++)for(let y=miny;y<=maxy;y++){if(x<0||y<0||x>=2**this.zoom||y>=2**this.zoom)continue;const key=`${this.zoom}/${x}/${y}`;active.add(key);let img=this.tiles.get(key);if(!img){img=document.createElement('img');img.alt='';img.draggable=false;img.referrerPolicy='strict-origin-when-cross-origin';img.src=`https://tile.openstreetmap.org/${key}.png`;img.onerror=()=>{if(this.destroyed)return;errors.hidden=false;errors.textContent='在线底图连接失败，请切换本地矢量 / 卫星快照。';};this.tiles.set(key,img);}
    img.style.cssText=`position:absolute;left:${x*256-ox}px;top:${y*256-oy}px;width:256px;height:256px;max-width:none;`;this.raster.append(img);
  }
  for(const [key,img]of this.tiles)if(!active.has(key)){img.remove();if(this.tiles.size>70)this.tiles.delete(key);}
  for(const img of this.raster.querySelectorAll('.satellite-snapshot'))img.remove();
 }
 destroy(){this.destroyed=true;this.ro.disconnect();cancelAnimationFrame(this.raf);window.removeEventListener('pointerup',this.up);for(const [k,f]of Object.entries(this.handlers))this.el.removeEventListener(k,f);}
}
