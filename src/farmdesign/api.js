export const PORTABLE_DOWNLOAD='https://github.com/1337816143/FarmSystemDesign/releases/download/v0.3.26/FarmSystemDesign-Windows-v0.3.26.zip';
export const PORTABLE_RELEASE='https://github.com/1337816143/FarmSystemDesign/releases/tag/v0.3.26';
export function usesStaticHosting(host=globalThis.location?.hostname||''){return String(host).toLowerCase().endsWith('.github.io');}
export async function request(path,{signal,...body}={}){
 if(usesStaticHosting()){
  if(path==='capabilities')return {ready:false,static:true,engineVersion:'4.21.5.0'};
  throw Error('Hosted FarmDESIGN requires the Windows portable app');
 }
 const options={signal,cache:'no-store'};
 if(Object.keys(body).length){options.method='POST';options.headers={'Content-Type':'application/json'};options.body=JSON.stringify(body);}
 let response;try{response=await fetch(`./api/farmdesign/${path}`,options);}catch(e){if(e.name==='AbortError')throw e;throw Error('本地计算服务未连接。请运行“启动本地Farm”，并保持服务器开启。 / Local calculation service is unavailable. Start the local Farm server.');}
 let result;try{result=await response.json();}catch{throw Error('当前服务器不支持 FarmDESIGN。请使用更新后的 tools/serve.py 启动。 / This server does not support FarmDESIGN. Use the updated tools/serve.py.');}
 if(!response.ok||result.error)throw Error(result.error||`HTTP ${response.status}`);
 return result;
}
