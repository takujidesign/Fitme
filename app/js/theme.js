import { getState, setState } from './store.js';
import { actions } from './core.js';
import { L, sheet } from './ui.js';
export function applyTheme(){document.documentElement.dataset.theme=['auto','dark','light'].includes(getState().theme)?getState().theme:'auto';}
actions.theme=()=>sheet(`<h2>${L('ธีม','Theme')}</h2><div class="seg">${[['auto','อัตโนมัติ','Automatic'],['dark','มืด','Dark'],['light','สว่าง','Light']].map(([v,th,en])=>`<button class="chip ${getState().theme===v?'on':''}" data-theme-value="${v}">${L(th,en)}</button>`).join('')}</div>`,{onMount(root){root.querySelectorAll('[data-theme-value]').forEach(el=>el.onclick=()=>{setState(s=>s.theme=el.dataset.themeValue);applyTheme();root.querySelectorAll('.chip').forEach(b=>b.classList.toggle('on',b===el));});}});
