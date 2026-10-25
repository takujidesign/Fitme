import {getState,todayISO} from './store.js';
import {views,rerender} from './core.js';
import {registerSlot} from './slots.js';
import {L} from './ui.js';
let loading;
for(const name of ['health','health-shortcut','health-providers','health-export']){const view=()=>`<section class="card" role="status">${L('ข้อมูลสุขภาพ','Health data')}…</section>`;view.mount=()=>{loading||=import('./views/health-data.js');return loading.then(rerender);};views[name]=view;}
registerSlot('today.secondary',()=>`<section class="card"><a class="list-row" href="#/health">${L('ข้อมูลสุขภาพ','Health data')} →</a><p>${getState().logs[todayISO()]?.health?.steps??'—'} ${L('ก้าววันนี้','steps today')}</p></section>`);
