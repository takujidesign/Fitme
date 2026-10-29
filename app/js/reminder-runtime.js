import {getState,subscribe,todayISO,addDays} from './store.js';
import {reminderPlan,reminderTime,deviceZone} from './reminders.js';
import {L,esc,sheet} from './ui.js';
const KEY='fitme:local-reminders';
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{};}catch{return {};}};
const save=s=>localStorage.setItem(KEY,JSON.stringify(s));
export const nativePlugin=()=>globalThis.Capacitor?.isNativePlatform?.()?(Capacitor.Plugins?.LocalNotifications||Capacitor.registerPlugin?.('LocalNotifications')):null;
export function missedReminders(list,last,now=Date.now(),delivered={}){return list.filter(r=>reminderTime(r)>Math.max(last,now-86400000)&&reminderTime(r)<=now&&!delivered[r.id]);}
export function markDelivered(id,at=Date.now()){const s=read();s.delivered=Object.fromEntries(Object.entries({...s.delivered,[id]:at}).filter(([,t])=>t>at-2*86400000));save(s);if(globalThis.caches)caches.open('fitme-reminder-delivery-v1').then(c=>c.put(new URL('./__reminder/'+encodeURIComponent(id),location.href),Response.json({at}))).catch(()=>{});}
export function showMissed(list){if(!list.length)return;sheet(`<h2>${L('ที่พลาดไป','Missed reminders')}</h2>${list.map((r,i)=>`<section class="card"><b>${esc(r.title)}</b><p>${esc(r.date+' '+r.time)}</p><button class="btn primary" data-done="${i}">${L('ทำแล้ว','Done')}</button><button class="btn ghost" data-snooze="${i}">${L('เลื่อน 10 นาที','Snooze 10 minutes')}</button></section>`).join('')}`,{onMount(root){root.querySelectorAll('[data-done]').forEach(el=>el.onclick=()=>{markDelivered(list[el.dataset.done].id);el.closest('section').remove();});root.querySelectorAll('[data-snooze]').forEach(el=>el.onclick=async()=>{await snooze(list[el.dataset.snooze]);el.closest('section').remove();});}});}
export function quietAt(at,prefs=getState().notifications){const d=new Date(at),time=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'),a=prefs.quietStart,b=prefs.quietEnd;return !!(a&&b&&(a<b?time>=a&&time<b:time>=a||time<b));}
export async function snooze(r,now=Date.now()){markDelivered(r.id);const at=now+600000;if(quietAt(at))return;const s=read();s.snoozed=[...(s.snoozed||[]),{...r,id:r.id+':snooze:'+now,at}];save(s);if(nativePlugin())await replanNative();}
export async function scheduleNative(plugin,list,{now=Date.now(),ask=false}={}){
 let permission=await plugin.checkPermissions();if(permission.display!=='granted'&&ask)permission=await plugin.requestPermissions();
 if(permission.display!=='granted')return false;
 const pending=await plugin.getPending();if(pending.notifications.length)await plugin.cancel({notifications:pending.notifications.map(n=>({id:n.id}))});
 const next=list.filter(r=>(r.at||reminderTime(r))>now&&!quietAt(r.at||reminderTime(r))).sort((a,b)=>(a.at||reminderTime(a))-(b.at||reminderTime(b))).slice(0,64);
 await plugin.registerActionTypes({types:[{id:'reminder',actions:[{id:'done',title:L('ทำแล้ว','Done')},{id:'snooze',title:L('เลื่อน 10 นาที','Snooze 10 minutes')}]}]});
 if(next.length)await plugin.schedule({notifications:next.map((r,i)=>({id:i+1,title:r.title,body:r.title,schedule:{at:new Date(r.at||reminderTime(r)),allowWhileIdle:true},actionTypeId:'reminder',extra:{reminder:r}}))});return true;
}
let nativeWork=Promise.resolve();
export function replanNative(ask=false){nativeWork=nativeWork.catch(()=>{}).then(async()=>{const plugin=nativePlugin();if(!plugin)return;const s=read();if(!s.enabled)return;const reminders=[...reminderPlan(todayISO(),undefined,7),...(s.snoozed||[])].filter(r=>!s.delivered?.[r.id]);return scheduleNative(plugin,reminders,{ask});});return nativeWork;}
export async function enableLocal(enabled=true){const s=read();s.enabled=enabled;save(s);if(nativePlugin()){if(enabled)return replanNative(true);const p=nativePlugin(),pending=await p.getPending();await p.cancel({notifications:pending.notifications.map(n=>({id:n.id}))});}return true;}
export const localEnabled=()=>!!read().enabled;
async function pushDelivered(){const s=read();if(!globalThis.caches)return s.delivered||{};try{const cache=await caches.open('fitme-reminder-delivery-v1');for(const key of await cache.keys()){const record=await (await cache.match(key)).json(),{at}=record;if(new URL(key.url).pathname.includes('/__snooze/')){s.snoozed=[...(s.snoozed||[]),{...record.reminder,id:record.reminder.id+':snooze:'+at,at}];await cache.delete(key);continue;}if(at<Date.now()-2*86400000){await cache.delete(key);continue;}s.delivered||={};s.delivered[decodeURIComponent(new URL(key.url).pathname.split('/__reminder/')[1])]=at;}save(s);}catch{}return s.delivered||{};}
let tickBusy=false;
export async function tickReminders(now=Date.now(),opening=false){
 if(tickBusy||document.hidden)return;tickBusy=true;
 try{await pushDelivered();const s=read(),last=s.lastOpen||now;s.lastOpen=now;save(s);if(!s.enabled)return;
 const list=reminderPlan(addDays(todayISO(),-1),undefined,3),missed=missedReminders(list,last,now,s.delivered);
 const snoozed=(s.snoozed||[]).filter(r=>r.at<=now&&r.at>now-86400000&&!s.delivered?.[r.id]);
 if(opening){showMissed([...missed,...snoozed]);return;}
 if(nativePlugin())return;
 const fallback=[];for(const r of [...missed,...snoozed]){if(quietAt(now))continue;if(globalThis.Notification?.permission==='granted'){try{const reg=await navigator.serviceWorker?.getRegistration();if(reg){await notifyWorker(reg,r);markDelivered(r.id);continue;}}catch{}}
 fallback.push(r);markDelivered(r.id);}showMissed(fallback);
 }finally{tickBusy=false;}
}
export function startLocalReminders(){
 let signature='',timer;const changed=()=>{const s=getState(),next=JSON.stringify([deviceZone(),s.profile,s.notifications,s.dailyMenus,s.supplements,s.lang,s.mealSeed,s.dayOverrides,s.logs,s.blocks,s.exSwaps]);if(next!==signature){signature=next;clearTimeout(timer);timer=setTimeout(()=>replanNative().catch(()=>{}),300);}};
 subscribe(changed);changed();tickReminders(Date.now(),true);
 const interval=setInterval(()=>{changed();tickReminders();},15000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){changed();replanNative().catch(()=>{});tickReminders(Date.now(),true);}});
 navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='REMINDER_DELIVERED')markDelivered(e.data.id);});
 const plugin=nativePlugin();if(plugin){plugin.addListener('localNotificationReceived',e=>{if(e.extra?.reminder)markDelivered(e.extra.reminder.id);});plugin.addListener('localNotificationActionPerformed',async e=>{const r=e.notification.extra?.reminder;if(!r)return;if(e.actionId==='snooze')await snooze(r);else{markDelivered(r.id);if(e.actionId!=='done'&&/^#\/(today|food|supps|me|player\/\d{4}-\d{2}-\d{2})$/.test(r.route))location.hash=r.route;}await replanNative();});}
 return ()=>{clearInterval(interval);clearTimeout(timer);};
}

async function notifyWorker(reg,r){if(!reg.active)throw Error('No active worker');return new Promise((resolve,reject)=>{const c=new MessageChannel(),timer=setTimeout(()=>{c.port1.close();reject(Error('Notification timeout'));},2000);c.port1.onmessage=e=>{clearTimeout(timer);c.port1.close();e.data.ok?resolve():reject(Error('Notification failed'));};reg.active.postMessage({type:'LOCAL_REMINDER',payload:{title:r.title,tag:r.id,route:r.route,reminder:r}},[c.port2]);});}
