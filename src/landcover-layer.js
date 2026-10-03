/** Pinned 2025 class product, rendered on demand. No local invented polygons. */
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
      const tile = document.createElement('img');
      tile.alt = ''; tile.setAttribute('role','presentation');
      const size = this.getTileSize();
      const nw = this._map.unproject(L.point(coords.x*size.x,coords.y*size.y),coords.z);
      const se = this._map.unproject(L.point((coords.x+1)*size.x,(coords.y+1)*size.y),coords.z);
      const a = L.CRS.EPSG3857.project(nw), b = L.CRS.EPSG3857.project(se);
      tile.onload = () => done(null,tile);
      tile.onerror = () => done(new Error('2025 land-cover tile unavailable'),tile);
      tile.src = landcoverTileUrl([a.x,b.y,b.x,a.y],cropsOnly);
      return tile;
    },
    _removeTile(key) {
      const tile = this._tiles[key]?.el;
      if (tile) { tile.onload = null; tile.onerror = null; tile.removeAttribute('src'); }
      L.GridLayer.prototype._removeTile.call(this,key);
    }
  });
  return new Layer({tileSize:256,keepBuffer:1,updateWhenIdle:true,updateWhenZooming:false,maxNativeZoom:16,maxZoom:18,
    attribution:'Impact Observatory, Microsoft, Esri · 2025 · source CC BY 4.0',...options});
}
