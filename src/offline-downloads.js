/** Download retained bytes through a Blob, since native URL downloads can bypass offline fetch handling. */
import {VERSION} from './version.js';
import {names,activePath,manifestPath,validateManifest,sha256} from './offline-bundle.js';
const defaultScope=new URL('../',import.meta.url).href;
let fileDownloadBusy=false;
export function safeDownloadName(value){
 let name=String(value||'download').replace(/[\\/:*?"<>|\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,'_').replace(/[. ]+$/g,'').trim();
 if(!name||name==='.'||name==='..')name='download';
 if(/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))name='download_'+name;
 return Array.from(name).slice(0,180).join('');
}
export function downloadMime(path,header=''){
 if(/\.zip$/i.test(path))return 'application/zip';
 if(/\.tiff?$/i.test(path))return 'image/tiff';
 if(/\.npz$/i.test(path))return 'application/octet-stream';
 return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+(?:;[^\r\n]*)?$/i.test(header)?header:'application/octet-stream';
}
export async function verifiedCachedFile(input,{scope=defaultScope,cacheStorage=globalThis.caches,version=VERSION}={}){
 const base=new URL(scope),url=new URL(input,base);
 if(!/^https?:$/.test(url.protocol)||url.origin!==base.origin||!url.pathname.startsWith(base.pathname))return null;
 const path=decodeURIComponent(url.pathname.slice(base.pathname.length));
 const meta=await cacheStorage.open(names(scope,'').meta),active=await meta.match(new URL(activePath(version),base));
 if(!active)return null;
 const identity=await active.json();if(identity.version!==version||!/^[a-f0-9]{64}$/.test(identity.id))return null;
 const cache=await cacheStorage.open(names(scope,identity.id).bundle),marker=await cache.match(new URL(manifestPath,base));
 if(!marker)return null;
 const manifest=await validateManifest(await marker.json(),scope);
 if(manifest.id!==identity.id||manifest.version!==version)return null;
 const row=manifest.entries.find(x=>x.path===path);if(!row)return null;
 const response=await cache.match(new URL(row.path,base));if(!response||response.status!==200)throw Error('This file is missing from the retained bundle; verify and resume the download');
 const bytes=await response.arrayBuffer();
 if(bytes.byteLength!==row.bytes||await sha256(bytes)!==row.sha256)throw Error('Cached file integrity mismatch; verify and resume the download');
 return {blob:new Blob([bytes],{type:downloadMime(row.path,response.headers.get('Content-Type'))}),filename:safeDownloadName(row.path.split('/').pop()),sha256:row.sha256};
}
export function saveBlobFile(file,filename=file.filename){
 const url=URL.createObjectURL(file.blob),link=document.createElement('a');
 link.href=url;link.download=safeDownloadName(filename);link.hidden=true;document.body.append(link);link.click();link.remove();
 // Keep the body available while the browser creates its download, then release it.
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
// A missing complete-bundle marker does not authorize unverified response bytes.
// Online/partial-cache downloads use the same current-version manifest contract.
export async function verifiedDownloadFile(input,{scope=defaultScope,cacheStorage=globalThis.caches,version=VERSION,fetcher=(...args)=>globalThis.fetch(...args),signal=AbortSignal.timeout(30000)}={}){
 const base=new URL(scope),url=new URL(input,base);
 if(!/^https?:$/.test(url.protocol)||url.origin!==base.origin||!url.pathname.startsWith(base.pathname))throw Error('Download is outside this site scope');
 const cached=await verifiedCachedFile(url.href,{scope,cacheStorage,version});
 if(cached)return cached; // Integrity errors above fail closed; do not hide them with a network retry.
 const options={cache:'reload',headers:{'X-Farm-Offline-Bundle':'1'},signal};
 const manifestResponse=await fetcher(new URL(manifestPath,base),options);
 if(manifestResponse.status!==200||manifestResponse.type==='opaque')throw Error(`Manifest HTTP ${manifestResponse.status}`);
 const manifest=await validateManifest(await manifestResponse.json(),scope);
 if(manifest.version!==version)throw Error('Download manifest does not match the current app version');
 const path=decodeURIComponent(url.pathname.slice(base.pathname.length));
 const row=manifest.entries.find(entry=>entry.path===path);
 if(!row)throw Error('This file is not in the current verified download manifest');
 const response=await fetcher(new URL(row.path,base),options);
 if(response.status!==200||response.type==='opaque')throw Error(`Download HTTP ${response.status}`);
 const bytes=await response.arrayBuffer();
 if(bytes.byteLength!==row.bytes||await sha256(bytes)!==row.sha256)throw Error('Downloaded file integrity mismatch; verify and retry');
 return {blob:new Blob([bytes],{type:downloadMime(row.path,response.headers.get('Content-Type'))}),filename:safeDownloadName(row.path.split('/').pop()),sha256:row.sha256};
}
// Both the delegated link and the offline picker must enter the same preparation lock.
export async function downloadFile(input,{scope=defaultScope,filename,retainedOnly=false,onState=()=>{}}={}){
 if(fileDownloadBusy)return false;
 fileDownloadBusy=true;let state='error',error;
 try{
  onState({busy:true,state:'preparing'});
  const file=retainedOnly?await verifiedCachedFile(input,{scope}):await verifiedDownloadFile(input,{scope});
  if(!file)throw Error('Complete and verify the retained bundle before downloading this file');
  saveBlobFile(file,filename||file.filename);state='dispatched';return true;
 }catch(failure){error=failure;throw failure;}
 finally{fileDownloadBusy=false;onState({busy:false,state,error});}
}
export function installOfflineDownloads({scope=defaultScope,onError=()=>{},onState=()=>{}}={}){
 const listener=event=>{
  const link=event.target?.closest?.('a[href]');
  if(!link||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const base=new URL(scope),url=new URL(link.href,base);
  if(!/^https?:$/.test(url.protocol)||url.origin!==base.origin||!url.pathname.startsWith(base.pathname))return;
  if(!link.hasAttribute('download')&&!/\.(?:zip|tiff?|npz|tar\.xz(?:\.part\d+)?)$/i.test(url.pathname))return;
  event.preventDefault();
  void downloadFile(url.href,{scope,filename:link.getAttribute('download')||undefined,onState}).catch(onError);
 };
 document.addEventListener('click',listener,true);
 return ()=>document.removeEventListener('click',listener,true);
}
