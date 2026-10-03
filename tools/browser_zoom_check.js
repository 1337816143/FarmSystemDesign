async (page) => {
 page=await page.context().browser().newPage();
 await page.addInitScript(()=>{
  window.__qaMaps=[];let library;
  Object.defineProperty(window,'L',{configurable:true,get:()=>library,set:value=>{library=value;const wrap=fn=>(...args)=>{const map=fn(...args);window.__qaMaps.push(map);return map;};let factory=typeof value.map==='function'?wrap(value.map):undefined;Object.defineProperty(value,'map',{configurable:true,get:()=>factory,set:fn=>{factory=wrap(fn);}});}});
 });
 await page.setViewportSize({width:1440,height:1050});await page.goto('http://127.0.0.1:4173/#overview');
 await page.waitForSelector('#spatial-data-mode');const checks=[];
 const check=(name,ok)=>{if(!ok)throw new Error(name);checks.push(name);};
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.locator('button[data-language="en"]').click();
 for(const mode of ['crops2025','classes2025']){
  await page.locator('#spatial-data-mode').selectOption(mode);
  for(const zoom of [16,17,18]){
   await page.evaluate(z=>{const m=[...window.__qaMaps].reverse().find(m=>m.getContainer().isConnected&&m.getContainer().closest('#farm-map'));m.stop();m.setView([18.37,109.13],z,{animate:false});},zoom);
   await page.waitForFunction(()=>Array.from(document.querySelectorAll('#farm-map .leaflet-tile-loaded')).some(i=>i.complete&&i.naturalWidth===256),null,{timeout:45000});
   const state=await page.evaluate(()=>{const m=[...window.__qaMaps].reverse().find(m=>m.getContainer().isConnected&&m.getContainer().closest('#farm-map'));const layers=[];m.eachLayer(l=>{if(l instanceof L.GridLayer)layers.push({native:l.options.maxNativeZoom,max:l.options.maxZoom,tileZoom:l._tileZoom});});return {zoom:m.getZoom(),layers};});
   check(`${mode} renders at zoom${zoom} using native16`,state.zoom===zoom&&state.layers.some(l=>l.native===16&&l.max===18&&l.tileZoom===16));
  }
 }
 check('overscaling meaning visible',(await page.locator('.map-mini-legend').innerText()).includes('zoom 17/18 enlarged only'));
 await page.screenshot({path:'output/playwright/phase1-classification-zoom18.png',fullPage:true});
 await page.locator('#spatial-data-mode').selectOption('prediction');
 check('original110 polygons restore',await page.locator('.parcel').count()===110&&await page.locator('#farm-map .leaflet-parcels-pane').evaluate(el=>getComputedStyle(el).display!=='none'));
 check('no browser exceptions',errors.length===0);
 return {checks,errors};
}
