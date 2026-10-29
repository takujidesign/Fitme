import { getState, setState, subscribe } from './store.js';
import { L } from './ui.js';
import { CONFIG } from './config.js';
import { actions } from './core.js';

import {reminderPlan} from './reminders.js';
export {reminderPlan} from './reminders.js';
export async function post(path,body){const r=await fetch(CONFIG.API_BASE.replace(/\/$/,'')+'/api/push/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(getState().notifications.deviceId?{'X-Push-Device':getState().notifications.deviceId}:{}),...(getState().account?.token?{Authorization:'Bearer '+getState().account.token}:{})},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error||L('บันทึกไม่ได้','Could not save')),{status:r.status,retryAfter:data.retryAfter});return data;}
let syncing=false,again=false;
export async function syncPush(){
  if(syncing){again=true;return;}if(window.Capacitor?.isNativePlatform?.()||!getState().notifications.enabled||!CONFIG.API_BASE||!navigator.serviceWorker)return;
  syncing=true;
  try{
    if(globalThis.Notification?.permission!=='granted')return;
    const response=await fetch(CONFIG.API_BASE.replace(/\/$/,'')+'/api/push/key');if(!response.ok)throw Error('Push server not ready');const publicKey=(await response.json()).publicKey;if(!publicKey)throw Error('Push server not ready');
    const reg=await navigator.serviceWorker.ready,subscription=await ensureSubscription(reg,publicKey);CONFIG.VAPID_PUBLIC_KEY=publicKey;
    const body={...(getState().notifications.deviceId?{deviceId:getState().notifications.deviceId}:{}),subscription:subscription.toJSON(),tz:Intl.DateTimeFormat().resolvedOptions().timeZone,reminders:reminderPlan()};
    let result;try{result=await post('subscribe',body);}catch(e){if(e.status!==404)throw e;result=await post('subscribe',{...body,deviceId:undefined});}
    pushRegistration={registeredAt:result.registeredAt||Date.now(),error:''};if(result.deviceId!==getState().notifications.deviceId)setState(s=>s.notifications.deviceId=result.deviceId);
  }catch(e){pushRegistration.error=e.message;throw e;}finally{syncing=false;if(again){again=false;syncPush().catch(()=>{});}}
}
export function startPushSync(){
  let signature='',timer;
  const changed=()=>{const s=getState(),next=JSON.stringify([Intl.DateTimeFormat().resolvedOptions().timeZone,s.dailyMenus,s.profile,s.supplements,s.mealSeed,s.dayOverrides,s.customFoods,s.notifications,s.lang,s.blocks,s.exSwaps,s.logs,s.account?.token]);if(next===signature)return;signature=next;clearTimeout(timer);timer=setTimeout(()=>syncPush().catch(()=>{}),1000);};
  subscribe(changed);changed();window.addEventListener('online',()=>syncPush().catch(()=>{}));document.addEventListener('visibilitychange',()=>{if(!document.hidden){changed();syncPush().catch(()=>{});}});
}
export function notificationState({supported,ios,standalone,permission,publicKey,subscribed}){
 if(!supported||(ios&&!standalone))return 'unsupported';if(permission==='denied')return 'denied';if(!publicKey)return 'unconfigured';return permission==='granted'&&subscribed?'active':'inactive';
}
export async function currentNotificationState(){
 const supported='Notification' in window&&!!navigator.serviceWorker&&'PushManager' in window,ios=/iphone|ipad|ipod/i.test(navigator.userAgent),standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
 let publicKey='',subscribed=false;
 if(CONFIG.API_BASE){const r=await fetch(CONFIG.API_BASE.replace(/\/$/,'')+'/api/push/key');if(!r.ok)throw Error('Push status unavailable');publicKey=(await r.json()).publicKey||'';CONFIG.VAPID_PUBLIC_KEY=publicKey;}
 if(supported){const reg=await navigator.serviceWorker.getRegistration();subscribed=!!await reg?.pushManager?.getSubscription();}
 if(ios&&!standalone)return 'install';
 if(subscribed){try{const data=await serverReminders();pushRegistration.registeredAt=data.registeredAt;}catch{subscribed=false;}}
 return notificationState({supported,ios,standalone,permission:globalThis.Notification?.permission,publicKey,subscribed});
}
actions.notifications=async()=>{const {showNotifications}=await import('./notifications-ui.js');showNotifications();};

export let pushRegistration={registeredAt:null,error:''};
export async function ensureSubscription(reg,publicKey){
 const bytes=Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));let sub=await reg.pushManager.getSubscription();
 if(sub){const old=sub.options?.applicationServerKey;const array=old?new Uint8Array(old):null;if(sub.expirationTime&&sub.expirationTime<=Date.now()||!array||array.length!==bytes.length||array.some((v,i)=>v!==bytes[i])){await sub.unsubscribe();sub=null;}}
 return sub||reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
}
export async function serverReminders(){const id=getState().notifications.deviceId;if(!id)throw Error('Device not registered');const r=await fetch(CONFIG.API_BASE.replace(/\/$/,'')+'/api/push/reminders?deviceId='+encodeURIComponent(id),{headers:{'X-Push-Device':id}});const data=await r.json();if(!r.ok)throw Error(data.error||'Device not registered');return data;}
