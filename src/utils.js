export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmt=(n,d=0)=>Number.isFinite(n)?n.toLocaleString('zh-CN',{maximumFractionDigits:d,minimumFractionDigits:d}):'—';
export const money=n=>Math.abs(n)>=10000?`${fmt(n/10000,2)} 万` :fmt(n,0);
export const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
export const now=()=>new Date().toISOString();
export const displayDate=s=>s?new Date(s).toLocaleString('zh-CN',{hour12:false}):'未获取';
export function download(name,content,type='application/json;charset=utf-8'){
 const blob=content instanceof Blob?content:new Blob([content],{type});const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function csv(rows){return '\uFEFF'+rows.map(row=>row.map(v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s)&&typeof v!=='number')s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');}
const paths={
 target:'<circle cx="12" cy="12" r="6"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/>',
 expand:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',

 map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15m6-12v15"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 chart:'<path d="M3 3v18h18M7 16v-5m5 5V7m5 9V4"/>',
 sliders:'<path d="M4 7h6m4 0h6M4 17h10m4 0h2"/><circle cx="12" cy="7" r="2"/><circle cx="16" cy="17" r="2"/>',
 compare:'<path d="M9 4v16M15 4v16M5 8l-3 4 3 4m14-8 3 4-3 4M2 12h6m8 0h6"/>',
 database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
 book:'<path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15"/>',
 leaf:'<path d="M20 3C10 1 2 7 4 15c5 8 16 2 16-12ZM5 19l10-10"/>',
 arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6"/>',
 upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 15v6h16v-6"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
 drop:'<path d="M12 2C10 6 4 11 4 15a8 8 0 0 0 16 0c0-4-6-9-8-13Z"/>',
 people:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v3"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
 check:'<path d="m5 12 4 4L20 5"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
 refresh:'<path d="M20 7v5h-5M4 17v-5h5M5 7a8 8 0 0 1 14-2l1 3M4 16l1 3a8 8 0 0 0 14-2"/>',
 play:'<path d="m8 4 13 8-13 8Z"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
 pin:'<path d="M19 9c0 6-7 12-7 12S5 15 5 9a7 7 0 0 1 14 0Z"/><circle cx="12" cy="9" r="2"/>',
 search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
 layers:'<path d="m12 3 10 6-10 6L2 9Zm-9 11 9 5 9-5M3 18l9 5 9-5"/>',
 shield:'<path d="m12 2 9 4v7c0 5-9 9-9 9s-9-4-9-9V6Z"/><path d="m8 12 3 3 5-6"/>',
 edit:'<path d="m15 4 5 5M4 20l5-1L21 7a3 3 0 0 0-4-4L5 15Z"/>',
 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
 file:'<path d="M5 2h9l5 5v15H5Zm9 0v6h5M8 12h8m-8 4h8"/>',
 plus:'<path d="M12 4v16M4 12h16"/>',
 trash:'<path d="M3 6h18M5 6l1 15h12l1-15M9 6V3h6v3m-6 4v7m6-7v7"/>'
};
export const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.info}</svg>`;
