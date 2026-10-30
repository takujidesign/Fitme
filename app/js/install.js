// Install guidance: one-tap install on Chromium, illustrated steps on iPhone, and a way out of in-app browsers (LINE, Facebook...).
import {getState} from './store.js';
import {L,esc,sheet,closeSheet,icon,toast} from './ui.js';
import {featureUsed} from './telemetry.js';

const KEY='fitme:install';
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{};}catch{return {};}};
const save=patch=>{try{localStorage.setItem(KEY,JSON.stringify({...read(),...patch}));}catch{}};
let deferred=null;

export function installPlatform(ua=navigator.userAgent,standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true){
 if(standalone||window.Capacitor?.isNativePlatform?.())return 'installed';
 const ios=/iphone|ipad|ipod/i.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);
 const app=/\bLine\//i.test(ua)?'line':/FBAN|FBAV|FB_IAB|Instagram|Messenger|TikTok|musical_ly|Twitter/i.test(ua)?'social':null;
 if(app)return (ios?'ios-':'android-')+app;
 if(ios)return 'ios';
 if(deferred)return 'prompt';
 return /android/i.test(ua)?'android':'desktop';
}

const shareIcon='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg>';
const plusIcon='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
const step=(n,text,glyph='')=>`<li class="inst-step"><span class="inst-n">${n}</span><span>${text}</span>${glyph?`<span class="inst-g">${glyph}</span>`:''}</li>`;

function body(platform){
 if(platform==='prompt')return `<button class="btn primary block" id="inst-go">${icon('download',18)} ${L('ติดตั้งเลย','Install now')}</button><p class="note">${L('กดครั้งเดียว ไอคอน Fixmee จะอยู่บนหน้าจอโฮม','One tap and Fixmee appears on your home screen')}</p>`;
 if(platform==='ios')return `<ol class="inst-steps">${step(1,L('แตะปุ่ม <b>แชร์</b> ที่แถบด้านล่างของ Safari','Tap <b>Share</b> in the Safari toolbar'),shareIcon)}${step(2,L('เลื่อนลง แล้วแตะ <b>เพิ่มไปยังหน้าจอโฮม</b>','Scroll down and tap <b>Add to Home Screen</b>'),plusIcon)}${step(3,L('แตะ <b>เพิ่ม</b> แล้วเปิด Fixmee จากไอคอนบนหน้าจอโฮม','Tap <b>Add</b>, then open Fixmee from the home screen icon'))}</ol><p class="note">${L('บน iPhone ข้อมูลที่กรอกใน Safari อาจไม่ย้ายไปแอปบนหน้าจอโฮม ถ้าติดตั้งตอนนี้จะไม่ต้องกรอกซ้ำ หรือสร้างบัญชีเพื่อซิงก์ข้อมูลไปด้วย','On iPhone, data entered in Safari may not move to the home screen app. Install now to avoid entering it twice, or create an account to sync it.')}</p>`;
 if(platform.endsWith('-line')||platform.endsWith('-social')){
  const ios=platform.startsWith('ios'),line=platform.endsWith('-line');
  const open=line||!ios?`<button class="btn primary block" id="inst-open">${ios?L('เปิดใน Safari','Open in Safari'):L('เปิดใน Chrome','Open in Chrome')}</button>`:'';
  return `<p>${ios?L('แอปที่คุณใช้เปิดลิงก์นี้ (เช่น LINE หรือ Facebook) ติดตั้ง Fixmee ไม่ได้ ต้องเปิดใน Safari ก่อน','The app you opened this link in (like LINE or Facebook) cannot install Fixmee. Open it in Safari first.'):L('แอปที่คุณใช้เปิดลิงก์นี้ (เช่น LINE หรือ Facebook) ติดตั้ง Fixmee ไม่ได้ ต้องเปิดใน Chrome ก่อน','The app you opened this link in (like LINE or Facebook) cannot install Fixmee. Open it in Chrome first.')}</p>${open}${line?'':`<ol class="inst-steps">${step(1,L('แตะปุ่ม <b>⋯</b> หรือ <b>⋮</b> ที่มุมจอ','Tap <b>⋯</b> or <b>⋮</b> in the corner'))}${step(2,L('เลือก <b>เปิดในเบราว์เซอร์</b>','Choose <b>Open in browser</b>'))}</ol>`}<button class="btn ghost block" id="inst-copy">${L('คัดลอกลิงก์','Copy link')}</button>`;
 }
 if(platform==='android')return `<ol class="inst-steps">${step(1,L('แตะเมนู <b>⋮</b> ของ Chrome','Tap the Chrome <b>⋮</b> menu'))}${step(2,L('เลือก <b>ติดตั้งแอป</b> หรือ <b>เพิ่มไปยังหน้าจอหลัก</b>','Choose <b>Install app</b> or <b>Add to Home screen</b>'))}</ol>`;
 return `<p>${L('ใน Chrome หรือ Edge กดไอคอนติดตั้งที่แถบที่อยู่ หรือเปิด fixmee.app บนมือถือเพื่อติดตั้งบนหน้าจอโฮม','In Chrome or Edge, click the install icon in the address bar, or open fixmee.app on your phone to add it to the home screen.')}</p>`;
}

export function showInstallSheet(reason='manual'){
 const platform=installPlatform();
 if(platform==='installed')return toast(L('ติดตั้งเป็นแอปแล้ว','Already installed'));
 featureUsed('install_guide');save({shownAt:Date.now(),reason});
 const later=reason==='start'?L('ลองในเบราว์เซอร์ก่อน','Try it in the browser first'):L('ไว้ทีหลัง','Maybe later');
 sheet(`<h2>${L('ติดตั้ง Fixmee เป็นแอป','Install Fixmee as an app')}</h2><ul class="inst-why"><li>🔔 ${L('แจ้งเตือนตรงเวลา ทั้งฝึก อาหาร วิตามิน','On-time reminders for workouts, meals and vitamins')}</li><li>⚡ ${L('เปิดเร็วจากหน้าจอโฮม เต็มจอเหมือนแอปทั่วไป','Opens fast from your home screen, full screen')}</li><li>📴 ${L('ใช้ได้แม้ไม่มีเน็ต','Works without internet')}</li></ul>${body(platform)}<button class="btn ghost block" data-close>${later}</button>`,{onMount(root){
  root.querySelector('#inst-go')?.addEventListener('click',async()=>{const e=deferred;deferred=window.fitmeInstallEvent=null;if(!e)return;e.prompt();const choice=await e.userChoice.catch(()=>null);if(choice?.outcome==='accepted'){save({installed:Date.now()});closeSheet();}});
  root.querySelector('#inst-open')?.addEventListener('click',()=>{const url=new URL(location.href);if(platform.endsWith('-line')){url.searchParams.set('openExternalBrowser','1');location.href=url.href;}else location.href='intent://'+url.host+url.pathname+url.search+url.hash+'#Intent;scheme=https;package=com.android.chrome;end';});
  root.querySelector('#inst-copy')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.origin+'/');toast(L('คัดลอกลิงก์แล้ว','Link copied'));}catch{toast(location.origin+'/');}});
 }});
}

// Called at the right moments: on the first onboarding screen (iPhone and in-app browsers, where waiting loses data or cannot install)
// and right after onboarding (everyone else, once they have seen their plan).
export function offerInstall(moment){
 const platform=installPlatform(),s=read();
 if(platform==='installed'||s.installed)return;
 const early=platform.startsWith('ios')||platform.includes('-line')||platform.includes('-social');
 if(moment==='start'&&early&&!s.start){save({start:Date.now()});return showInstallSheet('start');}
 if(moment==='onboarded'&&!s.onboarded&&!(early&&s.start)){save({onboarded:Date.now()});return setTimeout(()=>showInstallSheet('onboarded'),900);}
}

function banner(){
 const platform=installPlatform(),s=read();
 if(platform==='installed'||s.installed||s.dismissed||!getState().onboarded||document.getElementById('install'))return;
 if(platform==='desktop')return;
 if(s.shownAt&&Date.now()-s.shownAt<3*86400000)return;
 const b=document.createElement('div');b.id='install';b.className='install';
 b.innerHTML=`${icon('download',20)}<div><b>${esc(L('ติดตั้ง Fixmee เป็นแอป','Install Fixmee'))}</b><small>${esc(L('แจ้งเตือนตรงเวลา และใช้ได้ไม่มีเน็ต','On-time reminders, works offline'))}</small></div><button class="btn primary xs" id="inst-how">${esc(platform==='prompt'?L('ติดตั้ง','Install'):L('ดูวิธี','How'))}</button><button class="icon-btn" id="inst-x" aria-label="${esc(L('ปิด','Close'))}">${icon('x',18)}</button>`;
 document.body.appendChild(b);
 b.querySelector('#inst-how').addEventListener('click',()=>{b.remove();showInstallSheet('banner');});
 b.querySelector('#inst-x').addEventListener('click',()=>{save({dismissed:Date.now()});b.remove();});
}

export function startInstall(){
 deferred=window.fitmeInstallEvent||null;
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=window.fitmeInstallEvent=e;});
 window.addEventListener('appinstalled',()=>{featureUsed('app_installed');save({installed:Date.now()});document.getElementById('install')?.remove();});
 const check=()=>{if(/^#\/onboarding/.test(location.hash)&&!getState().onboarded)offerInstall('start');};
 window.addEventListener('hashchange',check);setTimeout(check,600);
 setTimeout(banner,4000);
}
