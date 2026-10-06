/** Full published-site cache. It never touches workspace/notes or another site scope. */
export const SCHEMA = 1;
export const manifestPath = 'offline-manifest.json';
export const activePath = version => `offline-active-v${encodeURIComponent(version)}.json`;
const encoder = new TextEncoder();
export async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function scopeKey(scope) { return encodeURIComponent(new URL(scope).pathname); }
export function names(scope, id) {
  const prefix = `farmsystem-full-v1-${scopeKey(scope)}-`;
  return {prefix, bundle: prefix + id, meta: `farmsystem-full-meta-v1-${scopeKey(scope)}`};
}
export async function validateManifest(manifest, scope) {
  if(manifest?.schema!==SCHEMA || !Array.isArray(manifest.entries) || !manifest.entries.length ||
     !/^[a-f\d]{64}$/.test(manifest.id||'') || typeof manifest.version!=='string') throw Error('Invalid offline manifest');
  const base=new URL(scope), seen=new Set(); let bytes=0;
  for(const row of manifest.entries) {
    if(!row || typeof row.path!=='string' || !row.path || row.path.startsWith('/') || row.path.includes('\\') ||
       row.path.split('/').some(x=>x==='.'||x==='..'||!x) || /[?#%]/.test(row.path) ||
       !Number.isSafeInteger(row.bytes) || row.bytes<0 || !/^[a-f\d]{64}$/.test(row.sha256||'')) throw Error('Invalid manifest entry');
    const url=new URL(row.path,base);
    if(url.origin!==base.origin || !url.pathname.startsWith(base.pathname) || seen.has(row.path)) throw Error('Out-of-scope or duplicate manifest entry');
    seen.add(row.path);bytes+=row.bytes;
  }
  if(bytes!==manifest.totalBytes || manifest.entries.length!==manifest.totalFiles ||
     await sha256(encoder.encode(JSON.stringify(manifest.entries)))!==manifest.id) throw Error('Manifest integrity mismatch');
  return manifest;
}
export class OfflineBundle {
  constructor({scope=new URL('../',import.meta.url).href,cacheStorage=globalThis.caches,fetcher=globalThis.fetch,
    estimate=()=>navigator.storage?.estimate?.()||Promise.resolve({}),onProgress=()=>{},concurrency=3,retries=2}={}) {
    this.scope=new URL(scope).href;this.caches=cacheStorage;this.fetcher=fetcher;this.estimate=estimate;
    this.onProgress=onProgress;this.concurrency=concurrency;this.retries=retries;this.running=false;this.loading=false;this.inspecting=false;this.cancelled=false;
    this.state={status:'unchecked',completeFiles:0,completeBytes:0,totalFiles:0,totalBytes:0,failed:[]};
  }
  emit(patch={}) { Object.assign(this.state,patch);this.onProgress({...this.state,failed:[...this.state.failed]}); }
  async load() {
    if(this.running||this.loading||this.inspecting)return this.state;
    this.loading=true;
    try { return await this._load(); } finally {this.loading=false;}
  }
  async _load() {
    let manifest,fromNetwork=true;
    const meta=await this.caches.open(names(this.scope,'').meta);
    try {
      const r=await this.fetcher(new URL(manifestPath,this.scope),{cache:'reload',signal:AbortSignal.timeout(20000)});
      if(!r.ok)throw Error(`Manifest HTTP ${r.status}`);
      manifest=await validateManifest(await r.json(),this.scope);
      await meta.put(new URL(manifestPath,this.scope),new Response(JSON.stringify(manifest),{headers:{'Content-Type':'application/json'}}));
    } catch(error) {
      fromNetwork=false;
      const r=await meta.match(new URL(manifestPath,this.scope));
      if(!r)throw error;
      manifest=await validateManifest(await r.json(),this.scope);
    }
    this.manifest=manifest;this.cache=await this.caches.open(names(this.scope,manifest.id).bundle);
    this.emit({status:'checking',totalFiles:manifest.totalFiles,totalBytes:manifest.totalBytes,version:manifest.version,fromNetwork,failed:[],error:null});
    return this._inspect();
  }
  async validResponse(response,row) {
    if(!response || response.status!==200 || response.type==='opaque')return false;
    const bytes=await response.arrayBuffer();
    return bytes.byteLength===row.bytes && await sha256(bytes)===row.sha256;
  }
  async inspect() {
    if(this.running||this.loading||this.inspecting)return this.state;
    this.inspecting=true;
    try {return await this._inspect();} finally {this.inspecting=false;}
  }
  async _inspect() {
    if(!this.manifest)throw Error('Load manifest first');
    this.cancelled=false;this.valid=new Set();let bytes=0;
    const meta=await this.caches.open(names(this.scope,'').meta),key=new URL(activePath(this.manifest.version),this.scope);
    const beforeResponse=await meta.match(key),before=beforeResponse?await beforeResponse.json():null;
    this.emit({status:'checking',completeFiles:0,completeBytes:0,failed:[],error:null});
    for(const row of this.manifest.entries) {
      if(await this.validResponse(await this.cache.match(new URL(row.path,this.scope)),row)) {
        this.valid.add(row.path);bytes+=row.bytes;
      }
      this.emit({completeFiles:this.valid.size,completeBytes:bytes});
    }
    const complete=this.valid.size===this.manifest.totalFiles;
    if(complete)await this.activate();
    else await this.markerLock(async()=>{
      const response=await meta.match(key),active=response?await response.json():null;
      // A different tab may have completed a new verification during this scan.
      const unchanged=active?.id===before?.id && active?.generation===before?.generation;
      if(unchanged && (!active || active.id===this.manifest.id)){
        if(active)await meta.delete(key);
        await this.cache.delete(new URL(manifestPath,this.scope));
      }
    });
    this.emit({status:complete?'complete':'incomplete'});return this.state;
  }
  markerLock(action) {
    const lock=globalThis.navigator?.locks;
    return lock?lock.request(`farmsystem-marker-${scopeKey(this.scope)}`,action):action();
  }
  async activate() {
    return this.markerLock(async()=>{
      // The version-specific marker is written last. Older tabs cannot replace it.
      await this.cache.put(new URL(manifestPath,this.scope),new Response(JSON.stringify(this.manifest),{headers:{'Content-Type':'application/json'}}));
      const meta=await this.caches.open(names(this.scope,'').meta);
      await meta.put(new URL(activePath(this.manifest.version),this.scope),new Response(JSON.stringify({id:this.manifest.id,version:this.manifest.version,generation:crypto.randomUUID(),totalFiles:this.manifest.totalFiles,totalBytes:this.manifest.totalBytes}),{headers:{'Content-Type':'application/json'}}));
    });
  }
  pause() { this.cancelled=true;this.emit({status:'pausing'}); }
  async start() {
    if(this.running||this.loading||this.inspecting)return this.state;
    this.running=true;this.cancelled=false;
    try {
      if(!this.manifest)await this._load();
      // Revalidate retained bytes on every resume, including after an interrupted page.
      await this._inspect();
      if(this.state.status==='complete')return this.state;
      const capacity=await this.estimate().catch(()=>({}));
      const required=this.manifest.totalBytes-this.state.completeBytes;
      if(Number.isFinite(capacity.quota)&&Number.isFinite(capacity.usage)&&capacity.quota-capacity.usage<required*1.1) {
        this.emit({status:'insufficient-space',freeBytes:Math.max(0,capacity.quota-capacity.usage),requiredBytes:required});return this.state;
      }
      this.emit({status:'downloading',failed:[]});
      const pending=this.manifest.entries.filter(x=>!this.valid.has(x.path));let cursor=0;
      const worker=async()=>{
        while(cursor<pending.length && !this.cancelled) {
          const row=pending[cursor++];let error;
          this.emit({currentPath:row.path});
          for(let attempt=0;attempt<=this.retries&&!this.cancelled;attempt++) {
            try {
              const response=await this.fetcher(new URL(row.path,this.scope),{cache:'reload',headers:{'X-Farm-Offline-Bundle':'1'},signal:AbortSignal.timeout(45000)});
              if(!await this.validResponse(response.clone(),row))throw Error('HTTP / size / SHA-256 mismatch');
              await this.cache.put(new URL(row.path,this.scope),response);
              this.valid.add(row.path);
              this.emit({completeFiles:this.valid.size,completeBytes:this.state.completeBytes+row.bytes});error=null;break;
            } catch(e) { error=e;if(e?.name==='QuotaExceededError'){this.cancelled=true;break;} }
          }
          if(error)this.emit({failed:[...this.state.failed,{path:row.path,error:error.name==='QuotaExceededError'?'Browser storage quota exceeded':String(error.message||error)}]});
        }
      };
      await Promise.all(Array.from({length:this.concurrency},worker));
      if(this.valid.size===this.manifest.totalFiles){await this._inspect();this.emit({currentPath:''});}
      else this.emit({status:this.cancelled?'paused':'incomplete',currentPath:''});
      return this.state;
    } catch(error) {this.emit({status:'error',error:String(error.message||error)});throw error;}
    finally {this.running=false;}
  }
}
