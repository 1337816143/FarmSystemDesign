import {intersects,tileBounds,tileLonLat,pixelIndex,loadRasterImage,waitForRaster} from './regional-raster.js';

export const CLASS_COLORS={1:[65,155,223],2:[57,125,73],4:[122,135,198],5:[228,150,53],7:[196,40,27],8:[165,155,143],9:[179,159,225],10:[255,255,255],11:[227,226,195]};
export function classificationColor(code,cropsOnly=false){return (!cropsOnly||code===5)&&CLASS_COLORS[code]?[...CLASS_COLORS[code],255]:[0,0,0,0];}
export const CLASSIFICATION_BASE='./data/hainan/regional/landcover-local/';
let catalog;
export function classificationCatalog(){
 if(!catalog){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);catalog=fetch(CLASSIFICATION_BASE+'landcover-local-manifest.json',{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error('Local classification manifest unavailable');return r.json();}).then(m=>{
  if(!Array.isArray(m.records)||!m.records.length)throw new Error('Invalid local classification manifest');
  for(const r of m.records)if(r.crs!=='EPSG:4326'||!Array.isArray(r.bounds_wsen)||!Number.isFinite(r.width)||!Number.isFinite(r.height))throw new Error('Unsupported local classification grid');
  return m;
 }).catch(e=>{catalog=null;throw e;}).finally(()=>clearTimeout(timer));}return catalog;
}
export function classificationRecords(m,coords){return m.records.filter(r=>coords.z>=(r.min_zoom??0)&&coords.z<=(r.max_zoom??18)&&intersects(tileBounds(coords),r.bounds_wsen));}
export async function drawClassification(coords,records,cropsOnly,signal,previous){
 const rgba=new Uint8ClampedArray(previous||256*256*4),visited=new Uint8Array(256*256),counts={filled:0,sourceNoData:0,hiddenClasses:0,cloudPixels:0,readFailures:0};
 for(let i=3;i<rgba.length;i+=4)if(rgba[i])counts.filled++;counts.retainedPixels=counts.filled;
 for(const r of records){
  if(signal.aborted)throw new DOMException('Aborted','AbortError');
  let im=null;const file=r.preview||r.url;
  if(file){try{im=await waitForRaster(loadRasterImage(CLASSIFICATION_BASE+file),signal);if(im.width!==r.width||im.height!==r.height)throw new Error('Classification image dimensions do not match manifest');}catch(e){if(signal.aborted)throw e;counts.readFailures++;continue;}}
  for(let y=0;y<256;y++){const lat=tileLonLat(0,coords.y+(y+.5)/256,coords.z)[1];for(let x=0;x<256;x++){
   const i=y*256+x;if(visited[i])continue;const lon=tileLonLat(coords.x+(x+.5)/256,0,coords.z)[0];const at=pixelIndex(lon,lat,r.bounds_wsen,r.width,r.height);if(at<0)continue;visited[i]=1;
   const code=im?.data[at*4]||0;if(!code){if(!rgba[i*4+3])counts.sourceNoData++;continue;}if(code===10)counts.cloudPixels++;if(cropsOnly&&code!==5){counts.hiddenClasses++;continue;}
   const color=classificationColor(code,cropsOnly);if(color[3]){if(!rgba[i*4+3])counts.filled++;rgba.set(color,i*4);}else counts.sourceNoData++;
  }}
 }
 return {rgba,...counts,status:counts.readFailures?(counts.filled?'partial-read':'read-error'):counts.filled?'displayed':counts.hiddenClasses?'filtered':'source-nodata',outsideRead:visited.reduce((n,v)=>n+(v?0:1),0)};
}
