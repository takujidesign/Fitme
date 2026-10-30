import {getState,todayISO} from './store.js';
import {CONFIG} from './config.js';
import {reminderPlan,reminderTime} from './reminders.js';
import {pushStorage} from './push-storage.js';
const KEY='fitme:reminder-acks',PENDING='fitme:reminder-ack-pending';
const owner=()=>getState().account?.user?.id||getState().notifications.deviceId||'local';
const pendingAcks=()=>{try{return JSON.parse(localStorage.getItem(PENDING))||[];}catch{return [];}};
const localKey=()=>KEY+':'+(getState().account?.user?.id||'local');
export const localAcks=()=>{try{return JSON.parse(localStorage.getItem(localKey()))||{};}catch{return {};}};
const headers=()=>({'Content-Type':'application/json',...(getState().account?.token?{Authorization:'Bearer '+getState().account.token}:{}),...(getState().notifications.deviceId?{'X-Push-Device':getState().notifications.deviceId}:{})});
export async function updateBadge(now=Date.now()){
 const acks=localAcks(),today=todayISO(),done=getState().logs[today]?.done||{};for(const r of reminderPlan(today,undefined,1,true))if(done[r.eventKey])acks[r.id]=now;const count=getState().notifications.badge===false?0:reminderPlan(todayISO(),undefined,1).filter(r=>reminderTime(r)<=now&&!acks[r.id]).length;
 if(navigator.setAppBadge)try{if(count)await navigator.setAppBadge(count);else await navigator.clearAppBadge?.();}catch{}
 try{const saved=await pushStorage();if(saved)await pushStorage({...saved,acks,prefs:{...saved.prefs,badge:getState().notifications.badge}});}catch{}return count;
}
export async function acknowledge(id,action='done',send=true){
 const now=Date.now(),acks=Object.fromEntries(Object.entries({...localAcks(),[id]:now}).filter(([,at])=>at>now-172800000));localStorage.setItem(localKey(),JSON.stringify(acks));
 const reg=await navigator.serviceWorker?.getRegistration?.();for(const n of await reg?.getNotifications?.({tag:id})||[])n.close();await updateBadge();
 if(send){const pending=pendingAcks().filter(a=>a.at>now-172800000&&!(a.id===id&&a.owner===owner()));pending.push({id,action,at:now,owner:owner()});localStorage.setItem(PENDING,JSON.stringify(pending));await flushAcks();}
}
async function flushAcks(){if(!CONFIG.API_BASE||!getState().notifications.deviceId&&!getState().account?.token)return;for(const a of pendingAcks().filter(a=>a.owner===owner()))try{const {id,action,at}=a,r=await fetch(CONFIG.API_BASE.replace(/\/$/,'')+'/api/push/ack',{method:'POST',headers:headers(),body:JSON.stringify({id,action,at})});if(r.ok)localStorage.setItem(PENDING,JSON.stringify(pendingAcks().filter(p=>p.id!==id||p.owner!==a.owner)));}catch{}}
export async function syncAcks(){
 await flushAcks();
 if(!CONFIG.API_BASE||!getState().notifications.deviceId&&!getState().account?.token)return;
 try{const r=await fetch(CONFIG.API_BASE.replace(/\/$/,'')+'/api/push/ack?since='+(Date.now()-172800000),{headers:headers()});if(!r.ok)return;for(const a of (await r.json()).items)await acknowledge(a.id,a.action,false);}catch{}
}
