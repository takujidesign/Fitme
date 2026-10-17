import { getState, setState, subscribe, todayISO, addDays } from './store.js';
import { planDay } from './day.js';
import { L, toMin, toHHMM, sheet, toast } from './ui.js';
import { CONFIG } from './config.js';
import { actions } from './core.js';

export function reminderPlan(start=todayISO()) {
  const s=getState(),prefs=s.notifications,p=s.profile,out=[];
  const add=(iso,min,title,body,route)=>out.push({date:addDays(iso,Math.floor(min/1440)),time:toHHMM(min),title:title.slice(0,120),body:body.slice(0,500),route});
  for(let i=0;i<7;i++){
    const iso=addDays(start,i),d=planDay(iso);
    for(const e of d.events){
      const kind={meal:'meals',supp:'supplements',workout:'workout',fasting:'fasting'}[e.type];
      if(!kind||!prefs[kind])continue;
      if(e.type==='meal')add(iso,e.min,L('ถึงเวลาทานอาหาร','Meal time'),L(e.meal.name),'#/food');
      if(e.type==='supp')add(iso,e.min,L('อาหารเสริม','Supplements'),e.list.map(x=>L(x.prod.name)).join(', ').slice(0,500),'#/supps');
      if(e.type==='workout')add(iso,e.min,L('เวลาออกกำลังกาย','Workout time'),'Fix me','#/workout');
      if(e.type==='fasting')add(iso,e.min,e.eating?L('เริ่มกินได้','Eating window starts'):L('เริ่ม IF','Fasting starts'),'Fix me','#/today');
    }
    let bed=toMin(p.bed),wake=toMin(p.wake);if(bed<=wake)bed+=1440;
    if(prefs.water)for(let min=wake;min<bed;min+=120)add(iso,min,L('ดื่มน้ำ','Drink water'),'Fix me','#/today');
    if(prefs.sleep)add(iso,bed-30,L('เตรียมนอน','Prepare for sleep'),'Fix me','#/me');
  }return out;
}
async function post(path,body){const r=await fetch(CONFIG.API_BASE.replace(/\/$/,'')+'/api/push/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(getState().account?.token?{Authorization:'Bearer '+getState().account.token}:{})},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error||L('บันทึกไม่ได้','Could not save')),{status:r.status});return data;}
let syncing=false,again=false;
export async function syncPush(){
  if(syncing){again=true;return;}if(window.Capacitor?.isNativePlatform?.()||!getState().notifications.enabled||!CONFIG.API_BASE||!navigator.serviceWorker)return;
  syncing=true;
  try{
    const reg=await navigator.serviceWorker.ready,subscription=await reg.pushManager.getSubscription();if(!subscription)return;
    const body={deviceId:getState().notifications.deviceId,subscription:subscription.toJSON(),tz:Intl.DateTimeFormat().resolvedOptions().timeZone,reminders:reminderPlan()};
    let result;try{result=await post('subscribe',body);}catch(e){if(e.status!==404)throw e;result=await post('subscribe',{...body,deviceId:null});}
    if(result.deviceId!==getState().notifications.deviceId)setState(s=>s.notifications.deviceId=result.deviceId);
  }finally{syncing=false;if(again){again=false;syncPush().catch(()=>{});}}
}
export function startPushSync(){
  let signature='',timer;
  const changed=()=>{const s=getState(),next=JSON.stringify([s.profile,s.supplements,s.mealSeed,s.dayOverrides,s.customFoods,s.notifications,s.lang]);if(next===signature)return;signature=next;clearTimeout(timer);timer=setTimeout(()=>syncPush().catch(()=>{}),1000);};
  subscribe(changed);changed();window.addEventListener('online',()=>syncPush().catch(()=>{}));document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncPush().catch(()=>{});});
}
actions.notifications=()=>{
  const prefs=getState().notifications;
  sheet(`<h2>${L('การแจ้งเตือน','Notifications')}</h2><p class="note">${L('iPhone: เพิ่มไปยังหน้าจอโฮมก่อน ต้องใช้ iOS 16.4 ขึ้นไป เปิดแอปอย่างน้อยสัปดาห์ละครั้งเพื่ออัปเดตตาราง','iPhone: Add to Home Screen first; iOS 16.4+ required. Open the app weekly to refresh reminders.')}</p>${!CONFIG.API_BASE?`<p>${L('โหมดทดลอง: ต้องมีเซิร์ฟเวอร์','Demo mode: a server is required')}</p>`:''}${[['meals','มื้ออาหาร','Meals'],['supplements','อาหารเสริม','Supplements'],['workout','ออกกำลังกาย','Workout'],['water','น้ำทุก 2 ชั่วโมง','Water every 2 hours'],['sleep','ก่อนนอน 30 นาที','30 minutes before bedtime'],['fasting','เริ่ม/จบช่วงกิน IF','IF eating window boundaries']].map(([k,th,en])=>`<label class="field"><span><input type="checkbox" data-reminder="${k}" ${prefs[k]?'checked':''}> ${L(th,en)}</span></label>`).join('')}<button class="btn primary block" id="push-enable">${L('เปิดการแจ้งเตือน','Enable notifications')}</button><button class="btn ghost block" id="push-disable">${L('ปิดการแจ้งเตือน','Disable notifications')}</button><p id="push-status" role="status"></p>`,{onMount(root){
    root.querySelectorAll('[data-reminder]').forEach(el=>el.onchange=()=>setState(s=>s.notifications[el.dataset.reminder]=el.checked));
    const status=msg=>root.querySelector('#push-status').textContent=msg;
    root.querySelector('#push-enable').onclick=async()=>{try{
      if(!CONFIG.API_BASE)throw Error(L('ต้องมีเซิร์ฟเวอร์','A server is required'));
      if(!('Notification' in window)||!navigator.serviceWorker||!('PushManager' in window))throw Error(L('อุปกรณ์นี้ยังไม่รองรับ Web Push','Web Push is unavailable on this device'));
      const keyResponse=await fetch(CONFIG.API_BASE.replace(/\/$/,'')+'/api/push/key');
      if(keyResponse.ok)CONFIG.VAPID_PUBLIC_KEY=(await keyResponse.json()).publicKey;
      if(!CONFIG.VAPID_PUBLIC_KEY)throw Error(L('เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า Push','Push is not configured on the server'));
      if(await Notification.requestPermission()!=='granted')throw Error(L('ไม่ได้รับอนุญาตแจ้งเตือน','Notification permission was not granted'));
      const reg=await navigator.serviceWorker.ready,key=Uint8Array.from(atob(CONFIG.VAPID_PUBLIC_KEY.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
      await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
      setState(s=>s.notifications.enabled=true);await syncPush();status(L('เปิดแล้ว อัปเดตตาราง 7 วันแล้ว','Enabled; 7-day schedule updated'));
    }catch(e){status(e.message);}};
    root.querySelector('#push-disable').onclick=async()=>{try{const id=getState().notifications.deviceId;if(id)await post('unsubscribe',{deviceId:id});if(navigator.serviceWorker){const reg=await navigator.serviceWorker.ready;await (await reg.pushManager.getSubscription())?.unsubscribe();}setState(s=>{s.notifications.enabled=false;s.notifications.deviceId=null;});status(L('ปิดแล้ว','Disabled'));}catch(e){toast(e.message,'warn');}};
  }});
};
