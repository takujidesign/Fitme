// Load optional provider/support screens only when opened.
import {views,actions,rerender} from '../core.js';
import {registerSlot} from '../slots.js';
import {getState} from '../store.js';
import {installId} from '../install-id.js';
import {integrationEnabled} from '../beta.js';
import {L} from '../ui.js';
const link=(path,th,en)=>`<a class="btn ghost" href="#/${path}">${L(th,en)}</a>`;
const button=(act,th,en)=>`<button class="btn ghost" data-act="${act}">${L(th,en)}</button>`;
const isSupporter=()=>!!localStorage.getItem('fitme:supporter:'+(getState().account?.user?.id||installId()));
registerSlot('me.footer',()=>`<section class="card">${link('ai-settings','AI','AI')}${link('support','สนับสนุน Fixmee','Support Fixmee')}${link('ideas','เสนอฟีเจอร์','Ideas board')}${isSupporter()?`<span class="tag">♥ ${L('ผู้สนับสนุน','Supporter')}</span>`:''}</section>`);
registerSlot('today.footer',()=>!integrationEnabled('donations')?'':Date.now()-Number(localStorage.getItem('fitme:support-dismiss')||0)<7*86400000?'':`<section class="card">${link('support','สนับสนุน Fixmee','Support Fixmee')}${button('support-dismiss','ไว้คราวหน้า','Maybe later')}</section>`);
actions['support-dismiss']=()=>{localStorage.setItem('fitme:support-dismiss',Date.now());rerender();};

let loading;
for(const name of ['ai-settings','ai-summary','support','ideas'])if(!views[name])views[name]=()=>{loading??=import('./round10.js').then(()=>rerender());return `<p role="status">${L('กำลังโหลด…','Loading…')}</p>`;};

views['byok-guide']??=()=>{import('./byok.js').then(()=>rerender());return `<p>${L('กำลังโหลด…','Loading…')}</p>`;};
