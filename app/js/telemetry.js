import {getState,setState} from './store.js';
import {CONFIG} from './config.js';
import {validEvent,ROUTES} from './usage-policy.js';
let queue=[],sending=false,version='dev';const seen=new Set();
try{for(const route of JSON.parse(sessionStorage.getItem('fitme:usage-routes')||'[]'))if(ROUTES.includes(route))seen.add(route);}catch{}
try{queue=JSON.parse(localStorage.getItem('fitme:telemetry-queue')||'[]').filter(validEvent).slice(-100);}catch{}
const persist=()=>{try{localStorage.setItem('fitme:telemetry-queue',JSON.stringify(queue));}catch{}};
export function telemetryEnabled(value){setState(s=>s.telemetry=value);if(!value){queue=[];seen.clear();persist();localStorage.removeItem('fitme:install-id');localStorage.removeItem('fitme:usage-open');try{sessionStorage.removeItem('fitme:usage-routes');}catch{}}}
export function track(name,dims={}){const e={kind:name==='error'?'error':'event',name,dims};if(getState().telemetry===false||!validEvent(e))return;queue.push(e);queue=queue.slice(-100);persist();if(name==='workout_done')track('feature_used',{feature:'workout_done'});}
export const featureUsed=feature=>track('feature_used',{feature});
export function screenView(route){route=ROUTES.includes(route)?route:'other';if(getState().telemetry===false||seen.has(route))return;seen.add(route);try{sessionStorage.setItem('fitme:usage-routes',JSON.stringify([...seen]));}catch{}track('screen_view',{route});}
export const captureError=()=>track('error');
export function appOpen(){
 if(getState().telemetry===false)return;const date=new Date().toISOString().slice(0,10);if(localStorage.getItem('fitme:usage-open')===date)return;
 const s=getState(),ua=navigator.userAgent,standalone=navigator.standalone||globalThis.matchMedia?.('(display-mode: standalone)').matches,ios=/iPad|iPhone|iPod/.test(ua)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
 track('app_open',{platform:ios?(standalone?'ios-pwa':'ios-safari'):/Android/.test(ua)?(standalone?'android-pwa':'android-browser'):'desktop',lang:['th','en','zh','ja','vi'].includes(s.lang)?s.lang:'en',theme:s.theme==='light'||s.theme==='auto'&&globalThis.matchMedia?.('(prefers-color-scheme: light)').matches?'light':'dark',account:s.account?.token?'yes':'no',version});localStorage.setItem('fitme:usage-open',date);
}
export async function flushTelemetry(beacon=false){
 if(sending||!queue.length||!CONFIG.API_BASE||getState().telemetry===false||navigator.onLine===false)return;sending=true;
 const batch=queue.splice(0,20);try{let id=localStorage.getItem('fitme:install-id');if(!id){id=crypto.randomUUID();localStorage.setItem('fitme:install-id',id);}const body=JSON.stringify({installId:id,events:batch}),url=CONFIG.API_BASE.replace(/\/$/,'')+'/api/telemetry';
 if(beacon===true&&navigator.sendBeacon?.(url,new Blob([body],{type:'text/plain'}))){persist();return;}
 const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:beacon===true});if(!r.ok)throw Error();
 }catch{if(getState().telemetry!==false)queue.unshift(...batch);queue=queue.slice(-100);}finally{sending=false;persist();}
}
export function startTelemetry(){
 window.addEventListener('online',()=>flushTelemetry());window.addEventListener('error',captureError);window.addEventListener('unhandledrejection',captureError);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushTelemetry(true);else appOpen();});setInterval(()=>{appOpen();flushTelemetry();},30000);
 const fallback=async()=>{if(getState().telemetry===false)return;try{const r=await fetch(new URL('./sw.js',location.href),{cache:'no-store'});version=/const VERSION = ['"]fitme-([a-f0-9]{7,12})['"]/.exec(await r.text())?.[1]||'dev';}catch{}appOpen();};
 const sw=navigator.serviceWorker?.controller;if(sw){const c=new MessageChannel();const timer=setTimeout(()=>{c.port1.close();fallback();},1500);c.port1.onmessage=e=>{clearTimeout(timer);version=/^fitme-([a-f0-9]{7,12})$/.exec(e.data?.version)?.[1]||'dev';c.port1.close();appOpen();};sw.postMessage({type:'GET_VERSION'},[c.port2]);}else fallback();
}
