import { views, actions, rerender } from '../core.js';
import { getState } from '../store.js';
import { api } from '../account.js';
import { locale, L, esc, toast } from '../ui.js';
views.trainer=()=>`<header class="top"><h1>${L('เทรนเนอร์','Trainer')}</h1></header>${getState().account.user?.role==='trainer'?`<section class="card"><label class="field">${L('รหัสเชิญจากลูกค้า','Client invite code')}<input id="trainer-code" maxlength="6" autocomplete="off"></label><button class="btn primary" data-act="trainer-link">${L('เชื่อมต่อ','Link')}</button></section><div id="trainer-content" role="status">${L('กำลังโหลด…','Loading…')}</div>`:`<a class="btn ghost" href="#/account">${L('เข้าสู่ระบบและเปลี่ยนบทบาทเป็นเทรนเนอร์','Log in and switch to trainer')}</a>`}`;
function chart(weights) {
 if(weights.length<2)return `<p>${L('ยังไม่มีข้อมูลแนวโน้ม','Not enough trend data')}</p>`;
 const min=Math.min(...weights.map(w=>w.kg))-1,max=Math.max(...weights.map(w=>w.kg))+1;
 return `<svg class="spark" viewBox="0 0 300 80" role="img" aria-label="${L('แนวโน้มน้ำหนัก','Weight trend')}"><polyline fill="none" stroke="currentColor" stroke-width="3" points="${weights.map((w,i)=>`${10+i/(weights.length-1)*280},${70-(w.kg-min)/(max-min)*60}`).join(' ')}"/></svg>`;
}
views.trainer.mount=async root=>{
 const el=root.querySelector('#trainer-content');if(!el)return;
 try {const id=location.hash.split('/')[2];
 if(!id){const r=await api('trainer/clients');el.innerHTML=r.clients.map(c=>`<a class="card block" href="#/trainer/${esc(c.id)}"><h2>${esc(c.name||L('ลูกค้า','Client'))}</h2><p>${esc(c.goal||'')} · ${c.workouts7}/${c.workouts28} ${L('ครั้งใน 7/28 วัน','workouts in 7/28 days')}</p><p>${c.adherence}% · ${c.weightTrend===null?'—':c.weightTrend.toFixed(1)+' kg'}</p><small>${L('ซิงก์ล่าสุด','Last sync')}: ${c.lastSync?esc(new Date(c.lastSync).toLocaleString(locale())):'—'}</small></a>`).join('')||`<p>${L('ยังไม่มีลูกค้า','No clients yet')}</p>`;return;}
 const {client:c,notes}=await api('trainer/clients/'+encodeURIComponent(id));
 el.innerHTML=`<section class="card"><h2>${esc(c.name)}</h2><p>${esc(JSON.stringify(c.profile))}</p><p>${esc(JSON.stringify(c.plan))}</p>${chart(c.weights)}<p>${c.adherence}% · ${c.workouts28} ${L('ครั้งใน 4 สัปดาห์','workouts in 4 weeks')}</p><details><summary>${L('บันทึกและสัดส่วน','Logs & measurements')}</summary><pre>${esc(JSON.stringify({logs:c.logs,measurements:c.measurements},null,2))}</pre></details><button class="btn ghost" data-act="trainer-unlink" data-id="${esc(id)}">${L('ยกเลิกการเชื่อมต่อ','Unlink')}</button></section><section class="card"><h2>${L('บันทึกและคำแนะนำ','Notes & suggestions')}</h2>${notes.map(n=>`<article><small>${esc(new Date(n.created_at).toLocaleString(locale()))}</small><p>${esc(n.text)}</p>${n.suggestions?`<p>${esc(JSON.stringify(n.suggestions))}</p>`:''}</article>`).join('')}<label class="field">${L('ข้อความ','Note')}<textarea id="trainer-note" maxlength="4000"></textarea></label><label class="field">${L('เป้าหมาย (ไม่บังคับ)','Goal (optional)')}<select id="trainer-goal"><option value="">—</option>${['cut','bulk','recomp','maintain','strength'].map(g=>`<option>${g}</option>`).join('')}</select></label><label class="field">${L('เวลาฝึก (นาที)','Session minutes')}<input id="trainer-min" type="number" min="15" max="120"></label><label class="field">${L('วันฝึก 0–6 คั่นด้วย ,','Training weekdays 0–6, comma separated')}<input id="trainer-days"></label><label class="field">${L('ท่าที่หลีกเลี่ยง (ID คั่นด้วย ,)','Avoid exercise IDs, comma separated')}<input id="trainer-avoid"></label><button class="btn primary" data-act="trainer-note" data-id="${esc(id)}">${L('ส่งคำแนะนำให้ลูกค้าเลือกใช้','Send suggestions for client approval')}</button></section>`;
 }catch(e){el.textContent=e.message;}
};
actions['trainer-link']=async el=>{el.disabled=true;try{await api('trainer/link',{code:document.getElementById('trainer-code').value.trim().toUpperCase()});rerender();}catch(e){toast(e.message,'warn');}finally{el.disabled=false;}};
actions['trainer-note']=async el=>{el.disabled=true;try{
 const value=id=>document.getElementById('trainer-'+id).value.trim(),suggestions={};
 if(value('goal'))suggestions.goal=value('goal');if(value('min'))suggestions.sessionMin=Number(value('min'));if(value('days'))suggestions.trainDays=value('days').split(',').map(Number);if(value('avoid'))suggestions.avoidEx=value('avoid').split(',').map(v=>v.trim());
 await api('trainer/clients/'+encodeURIComponent(el.dataset.id)+'/notes',{text:value('note'),...(Object.keys(suggestions).length?{suggestions}:{})});rerender();
 }catch(e){toast(e.message,'warn');}finally{el.disabled=false;}};
