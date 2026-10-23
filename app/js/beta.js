import {CONFIG} from './config.js';
import {adminToken} from './admin-session.js';
import {allowed,endpointIntegration} from './beta-policy.js';
import {L} from './ui.js';
export const integrationEnabled=key=>!!adminToken()||(allowed(CONFIG.beta,key)&&(!['mealPhoto','labelScan','bodyPhoto'].includes(key)||allowed(CONFIG.beta,'ai')));
export const betaCard=()=>`<section class="card">${L('ฟีเจอร์นี้เปิดเร็วๆ นี้ (ช่วงทดสอบ)','Coming soon during beta testing')}</section>`;
export function requireIntegration(key){if(key&&!integrationEnabled(key))throw Object.assign(Error('beta_disabled'),{code:'beta_disabled',status:403});}
export {endpointIntegration};
export function entryIntegration(el){
 const route=(el.getAttribute('href')||el.dataset.to||'').replace(/^#\//,'').split(/[/?]/)[0],act=el.dataset.act||'';
 if(['coach','ai-settings','ai-usage','ai-guide','ai-summary'].includes(route))return 'ai';
 if(route==='pay'||/^(pay-|plan-buy|plan-free|trainer-connect|subscription-)/.test(act))return 'payments';
 if(route==='support'||/^(donate-|supporter-claim)/.test(act))return 'donations';
 if(/^(line-|.*-line)/.test(act)||route==='line-return')return 'line';
 if(/^(food-photo|meal-photo)/.test(act))return 'mealPhoto';
 if(/^(sp-photo|sp-ai|supp-scan|supp-photo|label-scan)/.test(act))return 'labelScan';
 if(/^(ai-body|body-ai|body-review)/.test(act))return 'bodyPhoto';
 if(/^(ai-|coach-)/.test(act))return 'ai';
 if(['forgot','resend-verification'].includes(route)||act==='verification-resend')return 'email';
 return null;
}
export function filterBeta(root){for(const el of root.querySelectorAll('[href],[data-act],[data-to]')){const k=entryIntegration(el);if(k&&!integrationEnabled(k))el.remove();}}
