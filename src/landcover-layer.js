/** Pinned 2025 product: verified local mainland grids, public service elsewhere. */
import {classificationCatalog,classificationRecords,drawClassification} from './local-classification.js';
import {tileBounds,intersects,waitForRaster} from './regional-raster.js';
export const LANDCOVER_SERVICE = 'https://ic.imagery1.arcgis.com/arcgis/rest/services/Sentinel2_10m_LandCover/ImageServer';
export const LANDCOVER_YEAR = 2025;
export function landcoverTileUrl(bounds, cropsOnly = false) {
  const params = new URLSearchParams({f:'image', bbox:bounds.join(','), bboxSR:'3857', imageSR:'3857', size:'256,256', format:'png32', interpolation:'RSP_NearestNeighbor',
    mosaicRule:JSON.stringify({mosaicMethod:'esriMosaicAttribute',where:`Year = ${LANDCOVER_YEAR}`}),
    renderingRule:JSON.stringify({rasterFunction:cropsOnly ? 'Isolate Crops for Visualization and Analysis' : 'Cartographic Renderer for Visualization and Analysis'})});
  return `${LANDCOVER_SERVICE}/exportImage?${params}`;
}
export function createLandcoverLayer(L, {cropsOnly = false, ...options} = {}) {
  const Layer = L.GridLayer.extend({
    createTile(coords, done) {
      const tile=document.createElement('canvas');tile.width=tile.height=256;tile.setAttribute('role','presentation');tile._classBounds=tileBounds(coords);tile._classController=new AbortController();tile._classRetry=()=>this._queueClass(tile,coords,done);tile.dataset.coverageStatus='loading';tile._classRetry();return tile;
    },
    _queueClass(tile,coords,done){
      if(tile._classController.signal.aborted||tile._classPending)return;tile._classPending=true;tile.dataset.coverageStatus='loading';tile._classCoverage={status:'loading',pending:true};this.fire('coverage');
      this._classQueue??=[];this._classQueue.push({tile,coords,done});this._drainClass();
    },
    _drainClass(){
      this._classActive??=0;while(this._classActive<2&&this._classQueue?.length){const task=this._classQueue.shift();if(task.tile._classController.signal.aborted)continue;this._classActive++;this._renderClass(task).finally(()=>{this._classActive--;this._drainClass();});}
    },
    async _renderClass({tile,coords,done}){
      const controller=tile._classController,attempt=new AbortController(),abort=()=>attempt.abort();controller.signal.addEventListener('abort',abort,{once:true});const timer=setTimeout(()=>attempt.abort(),35000);let result;
      try{
        this._classCatalogPromise??=classificationCatalog();const m=await waitForRaster(this._classCatalogPromise,attempt.signal);this.classificationMetadata=m;
        const records=classificationRecords(m,coords);
        if(records.length){
          result=await drawClassification(coords,records,cropsOnly,attempt.signal,tile._classPixels);if(controller.signal.aborted)return;
          const ctx=tile.getContext('2d'),im=ctx.createImageData(256,256);im.data.set(result.rgba);ctx.putImageData(im,0,0);tile._classPixels=result.rgba;tile.dataset.mode='local-classification';tile.dataset.validPixels=String(result.filled);
        }else if(globalThis.navigator?.onLine===false){
          // There are no retained local classification records for this tile.
          // Do not turn an offline service dependency into a source-no-data claim.
          result={status:'offline-unavailable',transport:'online-only',message:'Remote classification needs a network connection; retained local tiles remain available'};
          tile.dataset.mode='offline-unavailable';
        }else{
          const size=this.getTileSize(),nw=this._map.unproject(L.point(coords.x*size.x,coords.y*size.y),coords.z),se=this._map.unproject(L.point((coords.x+1)*size.x,(coords.y+1)*size.y),coords.z),a=L.CRS.EPSG3857.project(nw),b=L.CRS.EPSG3857.project(se);
          const image=new Image();image.crossOrigin='anonymous';const promise=new Promise((yes,no)=>{image.onload=()=>yes(image);image.onerror=()=>no(new Error('2025 land-cover service unavailable'));image.src=landcoverTileUrl([a.x,b.y,b.x,a.y],cropsOnly);});
          try{await waitForRaster(promise,attempt.signal);if(controller.signal.aborted)return;tile.getContext('2d').drawImage(image,0,0);result={status:'displayed',transport:'public-service'};tile.dataset.mode='remote-classification';}finally{image.onload=null;image.onerror=null;image.removeAttribute('src');}
        }
      }catch(error){if(controller.signal.aborted)return;result={status:attempt.signal.aborted?'timeout':'read-error',message:error.message};}
      finally{clearTimeout(timer);controller.signal.removeEventListener('abort',abort);tile._classPending=false;}
      if(controller.signal.aborted||!result)return;delete result.rgba;if(result.filled>0||result.status==='displayed'||result.status==='filtered'||result.status==='source-nodata'){tile.classList.add('leaflet-tile-loaded');tile.style.opacity='1';}tile._classCoverage={...result,pending:false};tile.dataset.coverageStatus=result.status;
      if(!tile._classReady){tile._classReady=true;done(result.status==='read-error'||result.status==='timeout'?new Error('Classification read failed'):null,tile);}this.fire('coverage');
    },
    coverageForBounds(bounds){return Object.values(this._tiles||{}).map(t=>t.el).filter(t=>t._classBounds&&intersects(t._classBounds,bounds)).map(t=>t._classCoverage||{status:'loading',pending:true});},
    retryFailedTiles(){this._classCatalogPromise=null;let n=0;for(const {el} of Object.values(this._tiles||{})){if(!el._classPending&&['read-error','partial-read','timeout','offline-unavailable'].includes(el._classCoverage?.status)){el._classRetry();n++;}}return n;},
    _removeTile(key){const tile=this._tiles[key]?.el;if(tile){tile._classController.abort();this._classQueue=this._classQueue?.filter(t=>t.tile!==tile);}L.GridLayer.prototype._removeTile.call(this,key);}
  });
  return new Layer({tileSize:256,keepBuffer:1,updateWhenIdle:true,updateWhenZooming:false,maxNativeZoom:16,maxZoom:18,
    attribution:'Impact Observatory, Microsoft, Esri · 2025 · source CC BY 4.0',...options});
}
