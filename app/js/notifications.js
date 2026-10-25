import { getState, setState, subscribe, todayISO, addDays } from './store.js';
import { planDay } from './day.js';
import { L, toMin, toHHMM } from './ui.js';
import { CONFIG } from './config.js';
import { actions } from './core.js';

export function reminderPlan(start=todayISO(),preferences) {
  const s=getState(),prefs=preferences||s.notifications,p=s.profile,out=[];
  const add=(iso,min,title,body,route,category='general')=>{const time=toHHMM(min),a=prefs.quietStart,b=prefs.quietEnd;if(a&&b&&(a<b?time>=a&&time<b:time>=a||time<b))return;out.push({date:addDays(iso,Math.floor(min/1440)),time,title:title.slice(0,120),body:body.slice(0,500),route,category});};
  for(let i=0;i<7;i++){
    const iso=addDays(start,i),d=planDay(iso);
    for(const e of d.events){
      const kind={meal:'meals',supp:'supplements',workout:'workout',fasting:'fasting',medication:'medications'}[e.type];
      if(!kind||!prefs[kind])continue;
      if(e.type==='medication')add(iso,e.min,L('เวลาทานยา','Medication reminder'),e.medication.name+' · '+e.medication.dose+' · '+L({th:{with:'พร้อมอาหาร',without:'ท้องว่าง',any:'ตามคำสั่งแพทย์'}[e.medication.food],en:{with:'With food',without:'Without food',any:'As prescribed'}[e.medication.food]}),'#/me','medications');
      if(e.type==='meal')add(iso,e.min,L('ถึงเวลาทานอาหาร','Meal time'),L(e.meal.name),'#/food','meals');
      if(e.type==='supp')add(iso,e.min,L('อาหารเสริม','Supplements'),e.list.map(x=>L(x.prod.name)).join(', ').slice(0,500),'#/supps','supplements');
      if(e.type==='workout'&&d.train&&d.sess?.type!=='rest')add(iso,e.min,L('เวลาออกกำลังกาย','Workout time'),'Fixmee','#/player/'+iso,'workout');
      if(e.type==='fasting')add(iso,e.min,e.eating?L('เริ่มกินได้','Eating window starts'):L('เริ่ม IF','Fasting starts'),'Fixmee','#/today','fasting');
    }
    let bed=toMin(p.bed),wake=toMin(p.wake);if(bed<=wake)bed+=1440;
    if(prefs.wake)add(iso,wake,L('ตื่นนอน','Wake up'),'Fixmee','#/today','wake');
    if(prefs.water)for(let min=wake;min<bed;min+=120)add(iso,min,L('ดื่มน้ำ','Drink water'),'Fixmee','#/today','water');
    if(prefs.sleep){add(iso,bed-30,L('เตรียมนอน','Prepare for sleep'),'Fixmee','#/today','sleep');add(iso,bed,L('เวลานอน','Bedtime'),'Fixmee','#/today','sleep');}
  }
  if(s.premium?.until){const expires=new Date(s.premium.until);if(Number.isFinite(expires.getTime())){const day=addDays(expires.toISOString().slice(0,10),-1);if(day>=start&&day<=addDays(start,6))add(day,9*60,L('สมาชิกใกล้หมดอายุ','Membership expires soon'),L('ตรวจสอบสถานะสมาชิกและการต่ออายุ','Check your membership and renewal status'),'#/me');}}
  return out;
}
export async function post(path,body){const r=await fetch(CONFIG.API_BASE.replace(/\/$/,'')+'/api/push/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(getState().notifications.deviceId?{'X-Push-Device':getState().notifications.deviceId}:{}),...(getState().account?.token?{Authorization:'Bearer '+getState().account.token}:{})},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error||L('บันทึกไม่ได้','Could not save')),{status:r.status});return data;}
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
  const changed=()=>{const s=getState(),next=JSON.stringify([s.profile,s.supplements,s.mealSeed,s.dayOverrides,s.customFoods,s.notifications,s.lang,s.blocks,s.exSwaps,s.logs,s.account?.token]);if(next===signature)return;signature=next;clearTimeout(timer);timer=setTimeout(()=>syncPush().catch(()=>{}),1000);};
  subscribe(changed);changed();window.addEventListener('online',()=>syncPush().catch(()=>{}));document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncPush().catch(()=>{});});
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
