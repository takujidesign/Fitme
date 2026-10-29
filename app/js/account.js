import {featureUsed,track} from './telemetry.js';
import {adminToken} from './admin-session.js';
import {rerender} from './core.js';
import {challenge} from './turnstile.js';
import { adminFetch } from './admin-session.js';
import { consentCurrent } from './legal.js';
import { getState, setState, subscribe, replaceAccountState, clearImages, clearImageURLs } from './store.js';
import { syncCopy, mergeState, pristine, hasRealData, syncStats } from './sync-data.js';
import { CONFIG } from './config.js';
import { L, toast, sheet, closeSheet } from './ui.js';
import {friendlyError} from './errors.js';
export async function api(path, body, method = body === undefined ? 'GET' : 'POST', token = getState().account?.token) {
  if (!CONFIG.API_BASE) throw Error(L('ต้องตั้งค่าเซิร์ฟเวอร์ก่อน ใช้งานในเครื่องได้ตามปกติ','Configure a server first. Local use remains available.'));
  if(globalThis.navigator?.onLine===false)throw Error(L('ต้องใช้อินเทอร์เน็ต','Internet connection required'));
  const captcha=method==='POST'&&['auth/register','auth/forgot','ideas','reports'].includes(path)?await challenge():'';
  const res = await (path.startsWith('admin/') ? adminFetch : fetch)(CONFIG.API_BASE.replace(/\/$/,'') + '/api/' + path, { method, headers:{'Content-Type':body instanceof Blob?body.type:'application/json',...(adminToken()?{'X-Admin-Preview':adminToken()}:{}),...(captcha?{'X-Turnstile-Token':captcha}:{}),...(token?{Authorization:'Bearer '+token}:{})}, body:body===undefined?undefined:body instanceof Blob?body:JSON.stringify(body),signal:AbortSignal.timeout(30000) }).catch(error=>{error.message=friendlyError(error);throw error;});
  const data = await res.json();
  if(!res.ok) throw Object.assign(Error(res.status===401||res.status>=500?friendlyError({status:res.status,message:'server'}):data.error || 'Request failed'),{status:res.status,server:data.server,code:data.code});
  return data;
}
let running=false, timer, applying=false;
export async function syncNow() {
  if(!consentCurrent() || running || !getState().account?.token || !CONFIG.API_BASE || globalThis.navigator?.onLine===false)return;
  running=true;
  const token=getState().account.token;
  try {
    // Health integration is independent: its outage must not stop account backups.
    try{await (await import('./health-sync.js')).refreshHealth();}catch{}
    const remote=await api('sync',undefined,'GET',token);
    let data=mergeState(syncCopy(getState()),remote.json),saved;
    try { saved=await api('sync',{json:data,baseVersion:remote.version},'PUT',token); }
    catch(e) { if(e.status!==409)throw e;data=mergeState(syncCopy(getState()),e.server.json);saved=await api('sync',{json:data,baseVersion:e.server.version},'PUT',token); }
    if(getState().account.token!==token)return;
    // Preserve edits made while the network was in flight, and all device-only images.
    const merged=mergeState(syncCopy(getState()),saved.json);
    const changed=JSON.stringify(syncCopy(getState()))!==JSON.stringify(merged);
    applying=true;
    setState(s=>{
      const photoIds=new Map(s.supplements.map(v=>[v.uid,v.photoId]));
      const foodPhotos=new Map(Object.entries(s.logs).flatMap(([date,l])=>(l.foodLog||[]).map(v=>[date+':'+v.time,v.photoId])));
      Object.assign(s,merged);
      s.supplements.forEach(v=>{if(photoIds.get(v.uid))v.photoId=photoIds.get(v.uid);});
      Object.entries(s.logs).forEach(([date,l])=>(l.foodLog||[]).forEach(v=>{if(foodPhotos.get(date+':'+v.time))v.photoId=foodPhotos.get(date+':'+v.time);}));
      s.notifications={...s.notifications,...merged.notificationPrefs};
      s.account={...s.account,version:saved.version,lastSync:Date.now(),syncedAt:saved.json.updatedAt||{},stats:syncStats(saved.json),error:''};
    },{remote:true});
    if(changed)rerender();
    if(JSON.stringify(merged)!==JSON.stringify(saved.json)){clearTimeout(timer);timer=setTimeout(syncNow,5000);}
  } catch(e) {
    if(getState().account.token===token){applying=true;setState(s=>{s.account.error=e.message;if(e.status===401)s.account.token=null;},{remote:true});}
  } finally { applying=false;running=false; }
}
export function startAccountSync() {
  subscribe(()=>{if(applying)return;clearTimeout(timer);timer=setTimeout(syncNow,5000);});
  let lastWake=0;const wake=()=>{if(Date.now()-lastWake<60000)return;lastWake=Date.now();syncNow();};
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')wake();});
  window.addEventListener('online',()=>{lastWake=0;wake();});
  if(getState().account.token)api('auth/me').then(r=>setState(s=>{s.account.user=r.user;},{remote:true})).catch(()=>{});
  syncNow();
}
export async function signIn(mode,email,password) {
  const ref=localStorage.getItem('fitme:ref');
  const result=await api('auth/'+mode,{email,password,...(mode==='register'?{age16:true,...(ref?{ref}:{})}:{})});
  if(!result.token){toast(result.message);return;}
  if(mode==='register'){track('account_created');localStorage.removeItem('fitme:ref');}
  const deviceState=structuredClone(getState()),local=syncCopy(deviceState),previous=deviceState.account.user?.id||localStorage.getItem('fitme:last-account');
  const remote=await api('sync',undefined,'GET',result.token);
  const switched=previous&&previous!==result.user.id;
  let choice='merge';
  if(switched){if(confirm(L('สำรองข้อมูลบัญชีก่อนหน้าเป็น JSON ก่อนเปลี่ยนบัญชี?','Save the previous account as a JSON backup before switching?')))await (await import('./export.js')).exportJSON();choice='server';}
  else if(pristine(getState())&&remote.version)choice='server';
  else if(hasRealData(local)&&hasRealData(remote.json))choice=await chooseSync();
  if(!choice){await api('auth/logout',{},'POST',result.token).catch(()=>{});return;}
  if(switched){await unlinkPush();await clearImages();}
  const selected=choice==='server'?remote.json:choice==='local'?local:mergeState(local,remote.json);
  if(remote.version&&selected.profile&&selected.onboarded===undefined)selected.onboarded=true;
  replaceAccountState(selected);
  if(!switched)setState(s=>{s.photos=deviceState.photos||[];for(const v of s.supplements){const old=deviceState.supplements.find(x=>x.uid===v.uid);if(old?.photoId)v.photoId=old.photoId;}},{remote:true});
  setState(s=>{s.account={token:result.token,user:result.user,version:remote.version,lastSync:Date.now(),syncedAt:remote.json.updatedAt||{},stats:syncStats(remote.json),error:''};},{remote:true});
  localStorage.setItem('fitme:last-account',result.user.id);
  if(choice!=='server'){
    const saved=await api('sync',{json:selected,baseVersion:remote.version},'PUT',result.token);
    setState(s=>{s.account.version=saved.version;s.account.syncedAt=saved.json.updatedAt||{};s.account.stats=syncStats(saved.json);},{remote:true});
  }
  await refreshEntitlement();
}
export async function refreshEntitlement(){
  if(!getState().account?.token||!CONFIG.API_BASE)return;
  const token=getState().account.token;
  try{const r=await api('entitlement');if(r.entitlement&&getState().account.token===token)setState(s=>{s.premium={...s.premium,until:r.entitlement.until,token:r.token,ref:r.entitlement.ref};});else if(!r.entitlement&&getState().account.token===token&&getState().premium.ref?.startsWith('account:'))setState(s=>{s.premium={...s.premium,until:null,token:null,ref:null};});}catch{}
}
function chooseSync(){return new Promise(resolve=>{
 const cancel=()=>done(null);const done=value=>{window.removeEventListener('hashchange',cancel);closeSheet();resolve(value);};
 window.addEventListener('hashchange',cancel,{once:true});
 sheet(`<h2>${L('เลือกข้อมูลที่ต้องการเก็บ','Choose data to keep')}</h2>${[['server','เก็บข้อมูลเซิร์ฟเวอร์','Keep server'],['local','เก็บข้อมูลเครื่องนี้','Keep this device'],['merge','รวมข้อมูล','Merge']].map(([v,th,en])=>`<button class="btn primary" data-sync-choice="${v}">${L(th,en)}</button>`).join('')}`,{onMount(root){root.querySelectorAll('[data-sync-choice]').forEach(el=>el.onclick=()=>done(el.dataset.syncChoice));root.parentElement.addEventListener('click',e=>{if(e.target.closest('[data-close]'))done(null);});}});
});}
export async function signOut({clearLocal=false,clearKeys=true}={}) {featureUsed('logout');
  clearTimeout(timer);
  if(getState().account.user?.id)localStorage.setItem('fitme:last-account',getState().account.user.id);
  await unlinkPush();
  try{await api('auth/logout',{});}catch(e){toast(e.message,'warn');}
  if(clearLocal){replaceAccountState();await clearImages();}
  clearImageURLs();
  if(clearKeys)for(const p of ['gemini','openai','kie'])localStorage.removeItem('fitme:'+p+'-key');
  setState(s=>{delete s.healthImport;for(const log of Object.values(s.logs))if(log.health?.imported)delete log.health;s.socialProfile=null;s.notifications.enabled=false;s.notifications.deviceId=null;s.account={token:null,user:null,version:0,lastSync:0,error:''};},{remote:true});
}
async function unlinkPush(){
 const id=getState().notifications.deviceId;
 if(id)try{await (await import('./notifications.js')).post('unsubscribe',{deviceId:id});}catch{}
 try{const reg=await navigator.serviceWorker?.getRegistration?.();await (await reg?.pushManager?.getSubscription())?.unsubscribe();}catch{}
}

if(typeof location!=='undefined'){const ref=new URLSearchParams(location.search).get('ref');if(/^[A-Z0-9]{16}$/.test(ref||''))localStorage.setItem('fitme:ref',ref);}
