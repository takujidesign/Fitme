import {CONFIG} from './config.js';
import {sheet,closeSheet,L} from './ui.js';
let loading;
export async function challenge(){
 const sitekey=CONFIG.launch?.turnstileSiteKey;if(!sitekey)return '';
 if(!globalThis.turnstile){loading??=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.onload=resolve;script.onerror=()=>{loading=null;reject(Error('Security check unavailable'));};document.head.append(script);});await loading;}
 return new Promise((resolve,reject)=>{
  let widget,done=false;const finish=(token,error)=>{if(done)return;done=true;clearTimeout(timer);if(widget!==undefined)globalThis.turnstile.remove(widget);closeSheet();error?reject(Error(error)):resolve(token);};
  const timer=setTimeout(()=>finish(null,'Security check timed out'),120000);
  sheet(`<h2>${L('ยืนยันความปลอดภัย','Security check')}</h2><div id="turnstile-widget"></div>`,{onMount(root){root.parentElement.addEventListener('click',e=>{if(e.target.closest('[data-close]'))finish(null,'Cancelled');});widget=globalThis.turnstile.render(root.querySelector('#turnstile-widget'),{sitekey,callback:token=>finish(token),'error-callback':()=>finish(null,'Security check failed'),'expired-callback':()=>finish(null,'Security check expired')});}});
 });
}
