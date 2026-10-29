import {getState,subscribe} from './store.js';
import {L} from './ui.js';
import {actions} from './core.js';
import {appVersion} from './render-stability.js';
export const BUDGET=40*1024*1024;
export const offlineState={done:0,total:0,bytes:0,persistent:false,error:''};
export const allowedAsset=url=>/^\.\/(data\/[^/]+\.json|img\/ex\/[^?#]+|js\/vendor\/three\/[^/]+\.js|js\/three-(?:viewer|motion)\.js)$/.test(url)&&!(/repdb|\.\./i.test(url));
export async function precache({manifest,cache,fetcher=fetch,estimate={},budget=BUDGET,onProgress=()=>{}}){
 const available=Number.isFinite(estimate.quota)?Math.max(0,(estimate.quota-(estimate.usage||0))*.8):budget;
 let bytes=0,added=0,done=0;const assets=manifest.filter(a=>allowedAsset(a.url));
 for(const asset of assets){
  let response=await cache.match(asset.url),size=response?Number(response.headers.get('X-Fixmee-Bytes')):0;
  if(response&&!size)size=(await response.clone().arrayBuffer()).byteLength;
  if(!response){
   if(bytes+asset.bytes>budget||added+asset.bytes>available){onProgress({done,total:assets.length,bytes,error:'storage'});continue;}
   try{response=await fetcher(asset.url);if(!response.ok||response.type==='opaque')throw Error('download');const body=await response.arrayBuffer();size=body.byteLength;
    if(bytes+size>budget||added+size>available){onProgress({done,total:assets.length,bytes,error:'storage'});continue;}
    const headers=new Headers(response.headers);headers.set('X-Fixmee-Bytes',String(size));await cache.put(asset.url,new Response(body,{headers}));added+=size;
   }catch{onProgress({done,total:assets.length,bytes,error:'download'});continue;}
  }
  bytes+=size;done++;onProgress({done,total:assets.length,bytes,error:''});
 }
 return {done,total:assets.length,bytes,error:done===assets.length?'':'incomplete'};
}
let downloading;
export async function downloadOffline(){
 if(downloading)return downloading;
 downloading=(async()=>{if(!globalThis.caches)return;const r=await fetch('./offline-manifest.json');if(!r.ok)throw Error('manifest');const manifest=await r.json();let version=appVersion;const worker=navigator.serviceWorker?.controller;if(worker&&globalThis.MessageChannel){version=await new Promise(resolve=>{const c=new MessageChannel(),timer=setTimeout(()=>{c.port1.close();resolve(version);},1500);c.port1.onmessage=e=>{clearTimeout(timer);c.port1.close();resolve(e.data.version||version);};worker.postMessage({type:'GET_VERSION'},[c.port2]);});}const cache=await caches.open(version+'-offline-r20');
  Object.assign(offlineState,await precache({manifest,cache,fetcher:url=>fetch(url,{headers:{'X-Fixmee-Precache':'1'}}),estimate:await navigator.storage?.estimate?.()||{},onProgress:p=>{Object.assign(offlineState,p);paintOffline();}}));paintOffline();
 })().catch(()=>{offlineState.error='download';paintOffline();}).finally(()=>downloading=null);return downloading;
}
export const pendingSync=()=>Object.entries(getState().updatedAt||{}).filter(([k,t])=>t>(getState().account?.syncedAt?(getState().account.syncedAt[k]||0):(getState().account?.lastSync||0))).length;
export const needsInternet=()=>L('ฟีเจอร์นี้ต้องใช้อินเทอร์เน็ต','This feature needs internet');
export function offlineCard(){const p=offlineState.total?Math.floor(100*offlineState.done/offlineState.total):0;return `<div id="offline-readiness"><p role="status">${L('พร้อมใช้ออฟไลน์','Offline ready')} ${p}% · ${(offlineState.bytes/1048576).toFixed(2)} MB</p><p>${L('การเก็บข้อมูลถาวร','Persistent storage')}: ${offlineState.persistent?L('อนุญาตแล้ว','Granted'):L('เบราว์เซอร์ยังไม่อนุญาต','Not granted by browser')}</p>${offlineState.error?`<p>${L('ดาวน์โหลดไม่ครบ ตรวจพื้นที่และลองอีกครั้ง','Download incomplete. Check storage and retry.')}</p>`:''}<button class="btn ghost block" data-act="offline-download">${L('ดาวน์โหลดสำหรับออฟไลน์','Download for offline')}</button><p>${L('รอซิงก์','Pending sync')} ${pendingSync()} ${L('รายการ','items')}</p></div>`;}
function paintOffline(){const el=document.getElementById('offline-readiness');if(el)el.outerHTML=offlineCard();}
actions['offline-download']=downloadOffline;
export function setConnectivity(online){let el=document.getElementById('offline-banner');if(!online&&!el){el=document.createElement('div');el.id='offline-banner';el.className='card';el.setAttribute('role','status');document.body.prepend(el);}if(online)el?.remove();else el.textContent=L('ออฟไลน์ — ข้อมูลจะซิงก์เมื่อกลับมาออนไลน์','Offline — changes will sync when you reconnect')+' · '+L('รอซิงก์','Pending sync')+' '+pendingSync();}
export function startOffline(){
 const original=globalThis.fetch.bind(globalThis);let failures=0;
 globalThis.fetch=async(...args)=>{const url=new URL(typeof args[0]==='string'?args[0]:args[0].url,location.href),remote=url.origin!==location.origin||url.pathname.includes('/api/');try{if(remote&&navigator.onLine===false)throw Error(needsInternet());const r=await original(...args);if(remote){failures=0;if(navigator.onLine!==false)setConnectivity(true);}return r;}catch(e){if(remote&&++failures>=2||navigator.onLine===false)setConnectivity(false);if(remote)e.message=needsInternet();throw e;}};
 const persist=async()=>{if(getState().onboarded){try{offlineState.persistent=await navigator.storage?.persist?.()||false;}catch{}paintOffline();}};
 let onboarded=getState().onboarded;subscribe(()=>{if(!onboarded&&getState().onboarded){onboarded=true;persist();}paintOffline();if(navigator.onLine===false)setConnectivity(false);});persist();
 window.addEventListener('offline',()=>setConnectivity(false));window.addEventListener('online',()=>{failures=0;setConnectivity(true);downloadOffline();});setConnectivity(navigator.onLine!==false);
 if(navigator.serviceWorker)navigator.serviceWorker.ready.then(()=>downloadOffline());
}
