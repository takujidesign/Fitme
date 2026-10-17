import { consentCurrent } from './legal.js';
import { getState, setState, subscribe } from './store.js';
import { syncCopy, mergeState } from './sync-data.js';
import { CONFIG } from './config.js';
import { L, toast } from './ui.js';
export async function api(path, body, method = body === undefined ? 'GET' : 'POST', token = getState().account?.token) {
  if (!CONFIG.API_BASE) throw Error(L('ต้องตั้งค่าเซิร์ฟเวอร์ก่อน ใช้งานในเครื่องได้ตามปกติ','Configure a server first. Local use remains available.'));
  const res = await fetch(CONFIG.API_BASE.replace(/\/$/,'') + '/api/' + path, { method, headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})}, body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000) });
  const data = await res.json();
  if(!res.ok) throw Object.assign(Error(data.error || 'Request failed'),{status:res.status,server:data.server});
  return data;
}
let running=false, timer, applying=false;
export async function syncNow() {
  if(!consentCurrent() || running || !getState().account?.token || !CONFIG.API_BASE || globalThis.navigator?.onLine===false)return;
  running=true;
  const token=getState().account.token;
  try {
    const remote=await api('sync',undefined,'GET',token);
    let data=mergeState(syncCopy(getState()),remote.json),saved;
    try { saved=await api('sync',{json:data,baseVersion:remote.version},'PUT',token); }
    catch(e) { if(e.status!==409)throw e;data=mergeState(syncCopy(getState()),e.server.json);saved=await api('sync',{json:data,baseVersion:e.server.version},'PUT',token); }
    if(getState().account.token!==token)return;
    // Preserve edits made while the network was in flight, and all device-only images.
    const merged=mergeState(syncCopy(getState()),saved.json);
    applying=true;
    setState(s=>{
      const photoIds=new Map(s.supplements.map(v=>[v.uid,v.photoId]));
      const foodPhotos=new Map(Object.entries(s.logs).flatMap(([date,l])=>(l.foodLog||[]).map(v=>[date+':'+v.time,v.photoId])));
      Object.assign(s,merged);
      s.supplements.forEach(v=>{if(photoIds.get(v.uid))v.photoId=photoIds.get(v.uid);});
      Object.entries(s.logs).forEach(([date,l])=>(l.foodLog||[]).forEach(v=>{if(foodPhotos.get(date+':'+v.time))v.photoId=foodPhotos.get(date+':'+v.time);}));
      s.account={...s.account,version:saved.version,lastSync:Date.now(),error:''};
    },{remote:true});
    if(JSON.stringify(merged)!==JSON.stringify(saved.json)){clearTimeout(timer);timer=setTimeout(syncNow,5000);}
  } catch(e) {
    if(getState().account.token===token){applying=true;setState(s=>{s.account.error=e.message;if(e.status===401)s.account.token=null;},{remote:true});}
  } finally { applying=false;running=false; }
}
export function startAccountSync() {
  subscribe(()=>{if(applying)return;clearTimeout(timer);timer=setTimeout(syncNow,5000);});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncNow();});
  window.addEventListener('online',syncNow);
  if(getState().account.token)api('auth/me').then(r=>setState(s=>{s.account.user=r.user;},{remote:true})).catch(()=>{});
  syncNow();
}
export async function signIn(mode,email,password) {
  const ref=localStorage.getItem('fitme:ref');
  const result=await api('auth/'+mode,{email,password,...(mode==='register' && ref?{ref}:{})});
  if(mode==='register')localStorage.removeItem('fitme:ref');
  setState(s=>{s.account={token:result.token,user:result.user,version:0,lastSync:0,error:''};},{remote:true});
  await syncNow();
  await refreshEntitlement();
}
export async function refreshEntitlement(){
  if(!getState().account?.token||!CONFIG.API_BASE)return;
  const token=getState().account.token;
  try{const r=await api('entitlement');if(r.entitlement&&getState().account.token===token)setState(s=>{s.premium={...s.premium,until:r.entitlement.until,token:r.token,ref:r.entitlement.ref};});else if(!r.entitlement&&getState().account.token===token&&getState().premium.ref?.startsWith('account:'))setState(s=>{s.premium={...s.premium,until:null,token:null,ref:null};});}catch{}
}
export async function signOut() {
  // Clear the local bearer even when the device is offline.
  try{await api('auth/logout',{});}catch(e){toast(e.message,'warn');}
  setState(s=>{s.account={token:null,user:null,version:0,lastSync:0,error:''};},{remote:true});
}

if(typeof location!=='undefined'){const ref=new URLSearchParams(location.search).get('ref');if(/^[A-Z0-9]{16}$/.test(ref||''))localStorage.setItem('fitme:ref',ref);}
