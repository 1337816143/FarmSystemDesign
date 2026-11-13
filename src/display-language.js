export const DISPLAY_LANGUAGE_KEY='farmsystem-language-v1';
export const DISPLAY_LANGUAGE_EVENT='farmsystem-languagechange';
export const validLanguage=value=>['zh','en','both'].includes(value);
export function storedLanguage(fallback='zh'){
 try{const mode=globalThis.localStorage?.getItem(DISPLAY_LANGUAGE_KEY);return validLanguage(mode)?mode:fallback;}catch{return fallback;}
}
export function saveLanguage(mode){
 if(!validLanguage(mode))return false;
 let changed=false;
 try{changed=globalThis.localStorage?.getItem(DISPLAY_LANGUAGE_KEY)!==mode;if(changed)globalThis.localStorage?.setItem(DISPLAY_LANGUAGE_KEY,mode);}catch{}
 if(changed&&globalThis.dispatchEvent&&globalThis.CustomEvent)globalThis.dispatchEvent(new CustomEvent(DISPLAY_LANGUAGE_EVENT,{detail:{language:mode}}));
 return true;
}
export function watchLanguage(callback,target=globalThis){
 const local=event=>{if(validLanguage(event.detail?.language))callback(event.detail.language);};
 const storage=event=>{if(event.key===DISPLAY_LANGUAGE_KEY&&validLanguage(event.newValue))callback(event.newValue);};
 target.addEventListener?.(DISPLAY_LANGUAGE_EVENT,local);target.addEventListener?.('storage',storage);
 return ()=>{target.removeEventListener?.(DISPLAY_LANGUAGE_EVENT,local);target.removeEventListener?.('storage',storage);};
}
