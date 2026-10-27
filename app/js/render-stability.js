import {featureUsed} from './telemetry.js';
import {L} from './ui.js';
export function preserveView(root, enabled=true) {
 if(!enabled)return ()=>{};
 const x=window.scrollX,y=window.scrollY,active=document.activeElement;
 const controls=[...root.querySelectorAll('input,textarea,select,button,a')];
 const index=controls.indexOf(active),id=active?.id,start=active?.selectionStart,end=active?.selectionEnd,value=active?.value;
 const details=[...root.querySelectorAll('details')].map((d,i)=>({id:d.id,i,open:d.open}));
 return ()=>{
  details.forEach(d=>{const el=d.id?root.querySelector('#'+CSS.escape(d.id)):root.querySelectorAll('details')[d.i];if(el)el.open=d.open;});
  const el=id?root.querySelector('#'+CSS.escape(id)):root.querySelectorAll('input,textarea,select,button,a')[index];
  if(el&&index>=0){if(['INPUT','TEXTAREA'].includes(el.tagName)&&el.type!=='file')el.value=value;el.focus({preventScroll:true});if(start!=null)try{el.setSelectionRange(start,end);}catch{}}
  window.scrollTo(x,y);
 };
}
export function enterView(el){el.dataset.enter='';const clear=()=>delete el.dataset.enter;el.addEventListener('animationend',clear,{once:true});setTimeout(clear,400);}
let registration,reloading=false,applying=false;
export let appVersion='fitme-v1';
export async function checkUpdate(){
 if(!registration)return;
 await registration.update?.();
 const controller=navigator.serviceWorker.controller;
 if(controller&&typeof MessageChannel!=='undefined'){
  const channel=new MessageChannel();
  const version=await new Promise(resolve=>{const timer=setTimeout(()=>{channel.port1.close();resolve(null);},1500);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data?.version);};controller.postMessage({type:'GET_VERSION'},[channel.port2]);});
  if(version){appVersion=version;try{const r=await fetch('./sw.js',{cache:'no-store'});const latest=(await r.text()).match(/const VERSION = ['"]([^'"]+)/)?.[1];if(latest&&latest!==version){await registration.update?.();registration.waiting&&applyUpdate();}}catch{}}
 }
}
export function applyUpdate(){featureUsed('update_applied');if(!registration?.waiting)return;applying=true;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(applying&&!reloading){reloading=true;location.reload();}},{once:true});registration.waiting.postMessage({type:'SKIP_WAITING'});document.getElementById('sw-update')?.remove();}
export function offerUpdate(reg){
 registration=reg;
 const show=()=>{if(!reg.waiting||document.getElementById('sw-update'))return;const b=document.createElement('button');b.id='sw-update';b.className='install btn';b.textContent=L('มีเวอร์ชันใหม่ — แตะเพื่ออัปเดต','New version — tap to update');b.onclick=applyUpdate;document.body.append(b);};
 if(reg.waiting&&navigator.serviceWorker.controller)applyUpdate();else show();
 reg.addEventListener('updatefound',()=>reg.installing?.addEventListener('statechange',show));
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkUpdate().catch(()=>{});});
 checkUpdate().catch(()=>{});
}
