/* Installed only in the portable build, before the application's module scripts. */
(() => {
  const methods = Object.fromEntries(['setItem', 'removeItem', 'clear'].map(key => [key, Storage.prototype[key]]));
  const allowed = key => String(key).startsWith('farmsystem-');
  let ready = false, failed = false, message = 'connecting';
  const statusPairs={connecting:['正在连接文件夹存档','Connecting folder storage'],folder:['项目随文件夹保存','Projects travel with this folder'],saved:['已保存到本文件夹','Saved to this folder'],failed:['存档失败，请检查本地服务与文件夹写入权限','Save failed. Check the local service and folder write permissions']};
  const language=()=>{try{const mode=localStorage.getItem('farmsystem-language-v1');if(['zh','en','both'].includes(mode))return mode;}catch{}return document.body?.dataset.language||'zh';};
  const text=(zh,en)=>language()==='en'?en:language()==='both'?zh+' / '+en:zh;
  function call(value) {
    const xhr = new XMLHttpRequest();
    xhr.open(value ? 'POST' : 'GET', '/api/portable/storage', false);
    if (value) xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(value ? JSON.stringify(value) : null);
    if (xhr.status !== 200) throw Error(text(...statusPairs.failed));
    return JSON.parse(xhr.responseText);
  }
  function banner() {
    if(!document.body)return;
    let element = document.querySelector('#portable-save-state');
    if (!element) {
      element = document.createElement('div'); element.id = 'portable-save-state';element.dataset.i18nSkip='';element.dataset.i18nPreserve='';
      element.style.cssText = 'position:fixed;bottom:6px;right:8px;z-index:99999;padding:5px 9px;border-radius:5px;font:12px system-ui;background:#e9f4ed;color:#184d36;max-width:90vw;box-shadow:0 1px 5px #0002';
      document.body.append(element);
    }
    element.textContent = text('便携版','Portable') + ' · ' + text(...(statusPairs[message]||statusPairs.failed));
    element.style.background = ready && !failed ? '#e9f4ed' : '#ffe8df';
    element.setAttribute('role', ready && !failed ? 'status' : 'alert');
  }
  try {
    const saved = call();
    for (const key of Object.keys(localStorage)) if (allowed(key)) methods.removeItem.call(localStorage, key);
    for (const [key, value] of Object.entries(saved.storage)) if (allowed(key)) methods.setItem.call(localStorage, key, value);
    ready = true; message = 'folder';
  } catch (error) { failed = true; message = 'failed'; }
  Storage.prototype.setItem = function(key, value) {
    if (this !== localStorage || !allowed(key)) return methods.setItem.call(this, key, value);
    const previous = this.getItem(key);
    try {
      if (!ready) throw Error(text(...(statusPairs[message]||statusPairs.failed)));
      methods.setItem.call(this, key, value);
      call({operation: 'set', key: String(key), value: String(value)});
      failed = false; message = 'saved'; banner();
    } catch (error) {
      if (previous === null) methods.removeItem.call(this, key); else methods.setItem.call(this, key, previous);
      failed = true; message = 'failed'; banner(); throw error;
    }
  };
  Storage.prototype.removeItem = function(key) {
    if (this !== localStorage || !allowed(key)) return methods.removeItem.call(this, key);
    if (!ready) throw Error(text(...(statusPairs[message]||statusPairs.failed)));
    call({operation: 'remove', key: String(key)});
    return methods.removeItem.call(this, key);
  };
  Storage.prototype.clear = function() {
    if (this !== localStorage) return methods.clear.call(this);
    if (!ready) throw Error(text(...(statusPairs[message]||statusPairs.failed)));
    call({operation: 'clear'});
    return methods.clear.call(this);
  };
  document.addEventListener('DOMContentLoaded', banner, {once: true});
  window.addEventListener('farmsystem-languagechange',banner);
  window.addEventListener('storage',event=>{if(event.key==='farmsystem-language-v1')banner();});
  window.FarmPortable = Object.freeze({get ready() {return ready;}, dataMode: 'folder'});
})();
