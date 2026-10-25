import {getState,setState} from './store.js';
import {CONFIG} from './config.js';
import {L,esc,sheet,toast} from './ui.js';
import {currentNotificationState,serverReminders,post,ensureSubscription,syncPush} from './notifications.js';
const pushStateText=state=>({install:L('iPhone: เพิ่มแอปไปยังหน้าจอโฮมก่อน แล้วเปิดจากไอคอน ต้องใช้ iOS 16.4+','iPhone: install to Home Screen and open from its icon; iOS 16.4+ required'),unsupported:L('ไม่รองรับ: iPhone ต้องติดตั้งบนหน้าจอโฮมและใช้ iOS 16.4+; Android ใช้ Chrome','Unsupported: on iPhone install to Home Screen with iOS 16.4+; on Android use Chrome'),denied:L('ปฏิเสธสิทธิ์: เปิดการแจ้งเตือนในการตั้งค่าเว็บไซต์ของเบราว์เซอร์','Permission denied: enable notifications in browser site settings'),unconfigured:L('เซิร์ฟเวอร์ยังไม่พร้อม จนกว่าผู้ดูแลจะสร้างคีย์','Server not configured; an admin must generate keys'),active:L('เปิดใช้งานแล้ว','Active'),inactive:L('ยังไม่ได้สมัครการแจ้งเตือน','Not subscribed')}[state]);
export const showNotifications=()=>{
  const prefs=getState().notifications;
  sheet(`<h2>${L('การแจ้งเตือน','Notifications')}</h2><p class="note">${L('iPhone: เพิ่มไปยังหน้าจอโฮมก่อน ต้องใช้ iOS 16.4 ขึ้นไป เปิดแอปอย่างน้อยสัปดาห์ละครั้งเพื่ออัปเดตตาราง','iPhone: Add to Home Screen first; iOS 16.4+ required. Open the app weekly to refresh reminders.')}</p>${!CONFIG.API_BASE?`<p>${L('โหมดทดลอง: ต้องมีเซิร์ฟเวอร์','Demo mode: a server is required')}</p>`:''}${[['wake','ตื่นนอน','Wake up'],['medications','ยา','Medications'],['meals','มื้ออาหาร','Meals'],['supplements','อาหารเสริม','Supplements'],['workout','ออกกำลังกาย','Workout'],['water','น้ำทุก 2 ชั่วโมง','Water every 2 hours'],['sleep','ก่อนนอน 30 นาที','30 minutes before bedtime'],['fasting','เริ่ม/จบช่วงกิน IF','IF eating window boundaries']].map(([k,th,en])=>`<label class="field"><span><input type="checkbox" data-reminder="${k}" ${prefs[k]?'checked':''}> ${L(th,en)}</span></label>`).join('')}<label class="field">${L('เวลาเงียบเริ่ม','Quiet hours start')}<input id="push-quiet-start" type="time" value="${esc(prefs.quietStart||'')}"></label><label class="field">${L('เวลาเงียบสิ้นสุด','Quiet hours end')}<input id="push-quiet-end" type="time" value="${esc(prefs.quietEnd||'')}"></label><button class="btn primary block" id="push-enable">${L('เปิดการแจ้งเตือน','Enable notifications')}</button><button class="btn ghost block" id="push-disable">${L('ปิดการแจ้งเตือน','Disable notifications')}</button><button class="btn ghost block" id="push-self-test" hidden>${L('ส่งทดสอบถึงตัวเอง','Send test to myself')}</button><p id="push-status" role="status"></p><h3>${L('การแจ้งเตือนที่ตั้งไว้','Scheduled notifications')}</h3><div id="push-reminders"></div>`,{onMount(root){
    root.querySelectorAll('[data-reminder]').forEach(el=>el.onchange=()=>setState(s=>s.notifications[el.dataset.reminder]=el.checked));
    for(const [id,key] of [['push-quiet-start','quietStart'],['push-quiet-end','quietEnd']])root.querySelector('#'+id).onchange=e=>setState(s=>s.notifications[key]=e.target.value);
    const status=msg=>root.querySelector('#push-status').textContent=msg;
    const refresh=()=>currentNotificationState().then(async s=>{status(pushStateText(s));root.querySelector('#push-self-test').hidden=s!=='active';if(getState().notifications.deviceId){const data=await serverReminders();status(pushStateText(s)+' → '+L('ลงทะเบียนอุปกรณ์เมื่อ','Device registered at')+' '+new Date(data.registeredAt).toLocaleString());root.querySelector('#push-reminders').innerHTML=data.reminders.map(r=>`<p>${esc(r.date||'')} ${esc(r.time)} → ${esc(r.title)}<br><small>${esc(r.route||'')}</small></p>`).join('')||'?';}}).catch(e=>status(e.message));refresh();
    root.querySelector('#push-self-test').onclick=async()=>{try{await post('test',{deviceId:getState().notifications.deviceId});status(L('บริการ Push รับคำขอแล้ว','Push service accepted the request'));}catch(e){status(e.message);}};
    root.querySelector('#push-enable').onclick=async()=>{try{
      if(!CONFIG.API_BASE)throw Error(L('ต้องมีเซิร์ฟเวอร์','A server is required'));
      if(!('Notification' in window)||!navigator.serviceWorker||!('PushManager' in window))throw Error(L('อุปกรณ์นี้ยังไม่รองรับ Web Push','Web Push is unavailable on this device'));
      const keyResponse=await fetch(CONFIG.API_BASE.replace(/\/$/,'')+'/api/push/key');
      if(keyResponse.ok)CONFIG.VAPID_PUBLIC_KEY=(await keyResponse.json()).publicKey;
      if(!CONFIG.VAPID_PUBLIC_KEY)throw Error(L('เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า Push','Push is not configured on the server'));
      if(await Notification.requestPermission()!=='granted')throw Error(L('ไม่ได้รับอนุญาตแจ้งเตือน','Notification permission was not granted'));
      const reg=await navigator.serviceWorker.ready,key=Uint8Array.from(atob(CONFIG.VAPID_PUBLIC_KEY.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
      await ensureSubscription(reg,CONFIG.VAPID_PUBLIC_KEY);
      setState(s=>s.notifications.enabled=true);await syncPush();refresh();status(L('เปิดแล้ว อัปเดตตาราง 7 วันแล้ว','Enabled; 7-day schedule updated'));
    }catch(e){status(e.message);}};
    root.querySelector('#push-disable').onclick=async()=>{try{const id=getState().notifications.deviceId;if(id)await post('unsubscribe',{deviceId:id});if(navigator.serviceWorker){const reg=await navigator.serviceWorker.ready;await (await reg.pushManager.getSubscription())?.unsubscribe();}setState(s=>{s.notifications.enabled=false;s.notifications.deviceId=null;});status(L('ปิดแล้ว','Disabled'));}catch(e){toast(e.message,'warn');}};
  }});
};

