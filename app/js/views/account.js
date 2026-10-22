import { slot } from '../slots.js';
import { views, actions, rerender } from '../core.js';
import { getState, setState } from '../store.js';
import { api, signIn, signOut, syncNow } from '../account.js';
import { locale, L, esc, toast } from '../ui.js';
export function accountCard() {
  const a=getState().account;
  return `<section class="card"><h2>${L('บัญชีและซิงก์','Account & sync')}</h2><a class="btn ghost" href="#/account">${esc(a.user?.email||L('สมัคร / เข้าสู่ระบบ','Sign up / log in'))}</a><a class="btn ghost" href="#/coach">${L('AI โค้ช','AI coach')}</a>${a.user?.role==='trainer'?`<a class="btn ghost" href="#/trainer">${L('ลูกค้าของฉัน','My clients')}</a>`:''}<p class="muted sm">${L('รูปถ่ายอยู่ในอุปกรณ์นี้เท่านั้น ไม่ซิงก์','Photos stay on this device and are not synced.')}</p>${a.token?'<div id="my-trainer"></div>':''}</section>`;
}
views.account=()=>{
 const a=getState().account;
 return `<header class="top"><h1>${L('บัญชีและซิงก์','Account & sync')}</h1></header><section class="card"><p>${L('ใช้งานแบบไม่สมัครบัญชีได้เสมอ รูปร่างกายและรูปอาหารไม่ซิงก์','You can always use this app without an account. Body and food photos are not synced.')}</p>${a.token?`<p>${esc(a.user.email)}</p><p>${L('ซิงก์ล่าสุด เมื่อ','Last synced at')} ${a.lastSync?esc(new Date(a.lastSync).toLocaleString(locale())):'—'}</p><p role="status">${esc(a.error||'')}</p><button class="btn primary" data-act="account-sync">${L('ซิงก์ตอนนี้','Sync now')}</button><button class="btn ghost" data-act="account-logout">${L('ออกจากระบบ','Log out')}</button><button class="btn ghost" data-act="account-role">${a.user.role==='trainer'?L('เปลี่ยนเป็นผู้ใช้','Switch to user'):L('เปลี่ยนเป็นเทรนเนอร์','Switch to trainer')}</button>${a.user.role==='trainer'?`<a class="btn ghost" href="#/trainer">${L('ลูกค้าของฉัน','My clients')}</a>`:''}`:`<label class="field">${L('อีเมล','Email')}<input id="account-email" type="email" autocomplete="username" maxlength="254"></label><label class="field">${L('รหัสผ่านอย่างน้อย 10 ตัว','Password (at least 10 characters)')}<input id="account-pass" type="password" autocomplete="current-password" minlength="10" maxlength="256"></label><button class="btn primary" data-act="account-login">${L('เข้าสู่ระบบ','Log in')}</button><label class="list-row"><input id="account-age16" type="checkbox">${L('ฉันอายุ 16 ปีขึ้นไป','I am 16 or older')}</label><button class="btn ghost" data-act="account-register">${L('สมัครบัญชี','Sign up')}</button>`}</section>${a.token?`<section class="card"><h2>${L('เทรนเนอร์ของฉัน','My trainer')}</h2><button class="btn ghost" data-act="trainer-invite">${L('สร้างรหัสเชิญ (48 ชม.)','Create invite (48 h)')}</button><p id="invite-code"></p><div id="my-trainer"></div></section>`:''}${slot('account.secondary')}${slot('account.footer')}`;
};
const guard=fn=>async el=>{el.disabled=true;try{await fn(el);}catch(e){toast(e.message,'warn');}finally{el.disabled=false;}};
for(const mode of ['login','register'])actions['account-'+mode]=guard(async()=>{if(mode==='register'&&!document.getElementById('account-age16')?.checked)throw Error(L('ยืนยันว่าอายุ 16 ปีขึ้นไป','Confirm you are 16 or older'));await signIn(mode,document.getElementById('account-email').value.trim(),document.getElementById('account-pass').value);rerender();});
actions['account-logout']=guard(async()=>{await signOut();rerender();});
actions['account-sync']=guard(async()=>{await syncNow();rerender();});
actions['account-role']=guard(async()=>{const r=await api('auth/role',{role:getState().account.user.role==='trainer'?'user':'trainer'},'PUT');setState(s=>{s.account.user=r.user;});rerender();});
actions['trainer-invite']=guard(async()=>{const r=await api('trainer/invite',{});document.getElementById('invite-code').textContent=r.code;});
let notes=[];
export const mountTrainerNotes=async root=>{
 if(!getState().account.token)return;
 try{const r=await api('trainer/mine');notes=r.notes;const el=root.querySelector('#my-trainer');if(!el)return;
 el.innerHTML=r.links.map(l=>`<button class="btn ghost" data-act="trainer-unlink" data-id="${esc(l.id)}">${L('ยกเลิกการเชื่อมต่อ','Unlink trainer')}</button>`).join('')+r.notes.map(n=>`<article class="card"><small>${esc(new Date(n.created_at).toLocaleString(locale()))}</small><p>${esc(n.text)}</p>${n.suggestions?`<p>${esc(JSON.stringify(n.suggestions))}</p>${getState().suggestionDecisions?.[n.id]?`<small>${L('จัดการแล้ว','Handled')}</small>`:`<button class="btn primary" data-act="trainer-accept" data-id="${esc(n.id)}">${L('ใช้คำแนะนำ','Apply suggestions')}</button><button class="btn ghost" data-act="trainer-dismiss" data-id="${esc(n.id)}">${L('ไม่ใช้','Dismiss')}</button>`}`:''}</article>`).join('');
 }catch(e){const el=root.querySelector('#my-trainer');if(el)el.textContent=e.message;}
};
views.account.mount=mountTrainerNotes;
actions['trainer-unlink']=guard(async el=>{await api('trainer/unlink',{id:el.dataset.id});rerender();});
actions['trainer-accept']=el=>{const n=notes.find(n=>n.id===el.dataset.id);if(!n?.suggestions)return;setState(s=>{Object.assign(s.profile,n.suggestions);s.suggestionDecisions[n.id]='accepted';});rerender();};
actions['trainer-dismiss']=el=>{setState(s=>{s.suggestionDecisions[el.dataset.id]='dismissed';});rerender();};
