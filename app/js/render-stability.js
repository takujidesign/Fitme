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
export function offerUpdate(reg){
 const show=()=>{if(!reg.waiting||document.getElementById('sw-update'))return;const b=document.createElement('button');b.id='sw-update';b.className='install btn';b.textContent=L('มีเวอร์ชันใหม่ — แตะเพื่ออัปเดต','New version — tap to update');b.onclick=()=>{navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});reg.waiting?.postMessage({type:'APPLY_UPDATE'});b.remove();};document.body.append(b);};
 show();reg.addEventListener('updatefound',()=>reg.installing?.addEventListener('statechange',show));
}
