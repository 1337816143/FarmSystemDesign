import {pixelIndex,rasterPriority} from './regional-raster.js';

export function viewScaleText(config,center,zoom,kind,en=false){
 const screen=40075016.686*Math.cos(center.lat*Math.PI/180)/(256*2**zoom);
 const source={imagery:10,classes2025:10,crops2025:10,dsm:30,rain:5500,monthlyRain:5500,soil:250,soc:250,landcover:10}[kind];
 const records=(config?.records||[]).filter(r=>Math.round(zoom)>=(r.min_zoom??0)&&Math.round(zoom)<=(r.max_zoom??24)&&pixelIndex(center.lng,center.lat,r.bounds_wsen,r.width,r.height)>=0).sort(rasterPriority);
 const record=records[0];
 let display=record?.pixel_size_m;
 if(!display&&record){const b=record.bounds_wsen;display=[(b[2]-b[0])/record.width*111320*Math.cos(center.lat*Math.PI/180),(b[3]-b[1])/record.height*111320];}
 if(kind==='imagery'&&zoom>=12&&!record?.local_native)display=null;
 const fmt=n=>n>=1000?(n/1000).toFixed(1)+' km':Math.round(n)+' m';
 const text=[en?`Zoom ${zoom.toFixed(1)}`:`缩放 ${zoom.toFixed(1)} 级`];
 if(kind==='temperature')text.push(en?'source0.625° ×0.5°':'来源0.625° ×0.5°');
 if(source)text.push(en?`source ${fmt(source)}`:`来源 ${fmt(source)}`);
 if(display?.every(Number.isFinite))text.push(en?`current local grid about ${display.map(fmt).join(' × ')}`:`当前本地图格约 ${display.map(fmt).join(' × ')}`);
 else if(kind==='imagery')text.push(en?(zoom<12?'local overview; detail needs zoom':'reading original source windows'):(zoom<12?'本地概览；查看细节可放大':'按视窗读取原始来源'));
 else if(kind==='landcover')text.push(en?'2021 preview about 300 m':'2021预览约300 m');
 text.push(en?`screen about ${fmt(screen)}/pixel; zoom does not add source detail`:`屏幕约 ${fmt(screen)}/像素；放大不增加来源精度`);
 return text.join(' · ');
}

export function classifiedTileText(rows,cropsOnly,en=false){
 const pending=rows.filter(r=>r.pending||r.status==='loading').length,failed=rows.filter(r=>r.status==='read-error'||r.status==='partial-read'||r.status==='timeout').length,loaded=rows.filter(r=>r.status==='displayed'||r.status==='partial-read'||r.status==='source-nodata'||r.status==='filtered').length;
 const parts=[en?`${loaded} classification tiles loaded`:`${loaded} 块分类瓦片已加载`];
 if(pending)parts.push(en?`${pending} loading`:`${pending} 块正在读取`);
 if(failed)parts.push(en?`${failed} requests failed; retry; blank is not confirmed source no-data`:`${failed} 块请求失败，可重试；空白不能认定为无数据`);
 const offline=rows.filter(r=>r.status==='offline-unavailable').length;if(offline)parts.push(en?`${offline} online-only tiles are unavailable offline; retained local classification remains available`:`${offline} 块仅在线图块离线不可用；已缓存的本地分类仍可显示`);
 const hidden=rows.reduce((n,r)=>n+(Number(r.hiddenClasses)||0),0);if(cropsOnly&&hidden)parts.push(en?`${hidden.toLocaleString('en-US')} non-Crops display pixels hidden`:`${hidden.toLocaleString('zh-CN')} 个非作物显示像元已隐藏`);
 parts.push(cropsOnly?(en?'Crops-only hides all classes except 5; switch to full classification to inspect transparent areas':'作物模式仅显示类别5；透明区请切完整分类核查'):(en?'Class 10 is cloud; source code 0 is no-data':'类别10为云，来源码0为无数据'));
 return parts.join(en?'. ':'；');
}

export function mainlandImageryStatus(metadata,en=false){
 const fine=metadata.records.filter(r=>r.level===0).length,coarse=metadata.records.length-fine;
 return en?`Main-island display grid: ${fine} continuous fine blocks and ${coarse} overview blocks. Current zoom chooses one local level; zoom14 uses about9.5×10m cells. Mask-derived mainland selection with300m coastal buffer, not exhaustive nearby-island or county coverage. Multi-date imagery; quality gaps, haze, colour differences and seams remain.`:`本岛显示格网：${fine}个连续细块与${coarse}个分级预览。按当前缩放选择一档本地图，14级起约9.5×10m。范围来自推测本岛掩膜及300m沿岸选块缓冲，不是穷尽近岸岛屿或市县覆盖。多日期影像仍有质量空白、薄雾、色差和接缝。`;
}
