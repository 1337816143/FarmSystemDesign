import {installOfflineDownloads,downloadFile} from './offline-downloads.js';
import {OfflineBundle} from './offline-bundle.js';
const $=id=>document.getElementById(id),format=bytes=>`${(bytes/1024/1024).toFixed(1)} MiB`;
const labels={unchecked:'尚未核验 / Not checked',checking:'逐项核验已保存文件 / Verifying retained files',incomplete:'尚不完整，继续下载或重试 / Incomplete: resume or retry',downloading:'正在下载并校验 / Downloading and verifying',pausing:'完成当前文件后暂停 / Pausing after current files',paused:'已暂停，可断点继续 / Paused: resume anytime',complete:'完整：所有文件已核验 / Complete: every file verified',error:'发生错误，尚不能确认离线可用 / Error: offline readiness unconfirmed','insufficient-space':'空间不足，离线包尚不完整 / Insufficient storage: bundle incomplete'};
let fileDownloadBusy=false,fileDownloadError='',fileDownloadStage='';
let latest,scheduled=false,workerReady=false,verifyService=async()=>{throw Error('Offline service not initialized');};
function render(state) {
  latest=state;if(scheduled)return;scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;const s=latest;
    $('status').textContent=s.status==='complete'&&!workerReady?'文件已校验；当前离线服务尚未就绪 / Files verified; current offline service not ready':labels[s.status]||s.status;
    $('status').classList.toggle('complete',s.status==='complete'&&workerReady);
    $('progress').max=s.totalBytes||1;$('progress').value=s.completeBytes;
    $('count').textContent=`${s.completeFiles.toLocaleString()} / ${s.totalFiles.toLocaleString()} 文件 / files`;
    $('bytes').textContent=`${format(s.completeBytes)} / ${format(s.totalBytes)}`;
    $('current').textContent=s.currentPath||'';
    $('identity').textContent=bundle.manifest?`v${bundle.manifest.version} · manifest SHA-256 ${bundle.manifest.id}`:'';
    $('capacity').textContent=s.status==='insufficient-space'?`需要约 ${format(s.requiredBytes)}，估计可用 ${format(s.freeBytes)} / Required vs. estimated available storage`:'';
    const busy=fileDownloadBusy||bundle.running||bundle.loading||bundle.inspecting||['checking','downloading','pausing'].includes(s.status);
    $('start').disabled=busy||!workerReady||s.status==='complete';$('asset-download').disabled=busy||!workerReady||s.status!=='complete'||!$('asset-file').value;$('asset-download').setAttribute('aria-busy',String(fileDownloadBusy));$('verify').disabled=busy;$('pause').disabled=!['downloading','checking'].includes(s.status);
    $('asset-download-status').textContent=fileDownloadStage==='preparing'?'正在准备本地文件 / Preparing local file':fileDownloadStage==='dispatched'?'已交给浏览器保存 / Passed to the browser for saving':fileDownloadStage==='error'?'文件尚未保存，请检查错误 / File not saved; check the error':'';
    $('errors').replaceChildren();
    for(const item of [...s.failed,...(s.error?[{path:'',error:s.error}]:[]),...(fileDownloadError?[{path:'',error:fileDownloadError}]:[])]) {const p=document.createElement('p');p.textContent=`${item.path}: ${item.error}`;$('errors').append(p);}
  });
}
const bundle=new OfflineBundle({onProgress:render});
const downloadState=state=>{fileDownloadBusy=state.busy;fileDownloadStage=state.state;fileDownloadError=state.error?'下载失败 / Download failed: '+state.error.message:'';render(bundle.state);};
installOfflineDownloads({onState:downloadState});
const fail=error=>render({...bundle.state,status:'error',error:String(error.message||error)});
function showFiles(){
 const query=$('asset-filter').value.toLowerCase(),rows=(bundle.manifest?.entries||[]).filter(x=>x.path.toLowerCase().includes(query));
 $('asset-file').replaceChildren();for(const row of rows.slice(0,100)){const option=document.createElement('option');option.value=row.path;option.textContent=row.path;$('asset-file').append(option);}
 $('asset-count').textContent=`${rows.length} 匹配 / matches · 最多显示前100项 / first 100 shown`;
 if($('asset-file').options.length)$('asset-file').selectedIndex=0;render(bundle.state);
}
$('asset-filter').oninput=showFiles;$('asset-file').onchange=()=>render(bundle.state);
$('asset-download').onclick=()=>downloadFile($('asset-file').value,{scope:bundle.scope,retainedOnly:true,onState:downloadState}).catch(()=>{});
$('start').onclick=()=>bundle.start().catch(fail);$('pause').onclick=()=>bundle.pause();
$('verify').onclick=async()=>{workerReady=false;render(bundle.state);try{await bundle.load();showFiles();await verifyService();}catch(error){fail(error);}};
try {
  if(!('serviceWorker'in navigator)||!globalThis.caches||!crypto.subtle)throw Error('此浏览器不支持安全离线缓存 / Secure offline caching is not supported');
  const registration=await navigator.serviceWorker.register(new URL('../sw.js',import.meta.url),{updateViaCache:'none'});
  async function currentWorker() {
    const expected=`farmsystem-shell-${encodeURIComponent(new URL(bundle.scope).pathname)}-v${bundle.manifest.version}`;
    const r=await navigator.serviceWorker.getRegistration(),controller=navigator.serviceWorker.controller;
    if(!controller||!r?.active||controller!==r.active||r.installing||r.waiting)return false;
    return new Promise(resolve=>{
      const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(false);},400);
      channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data?.cache===expected);};
      controller.postMessage({type:'FARM_SHELL_IDENTITY'},[channel.port2]);
    });
  }
  verifyService=async()=>{
    workerReady=false;render(bundle.state);
    $('worker').textContent='等待当前版本的离线服务接管 / Waiting for the current offline service';
    registration.update().catch(()=>{});
    const deadline=Date.now()+60000;
    while(!await currentWorker()) {
      if(Date.now()>deadline)throw Error('当前离线服务与下载清单尚不匹配；请联网重新打开此页后重试 / Offline service and manifest do not match; reopen online and retry');
      await new Promise(resolve=>setTimeout(resolve,200));
    }
    workerReady=true;
    $('worker').textContent='当前离线控制器与 v'+bundle.manifest.version+' 清单一致 / Current controller matches the bundle version';
    render(bundle.state);
  };
  await bundle.load();showFiles();
  await verifyService();
  navigator.serviceWorker.addEventListener('controllerchange',async()=>{
    workerReady=await currentWorker();
    if(!workerReady){bundle.pause();$('worker').textContent='离线服务版本已变化，请重新打开此页核验 / Offline service version changed; reopen and verify';}
    render(bundle.state);
  });
} catch(error) {fail(error);}
