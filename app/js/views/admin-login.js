import { views, actions, rerender, route } from '../core.js';
import { CONFIG } from '../config.js';
import { adminToken, adminVerified, setAdminSession, adminFetch } from '../admin-session.js';
import { L, toast } from '../ui.js';
const dashboard=views.admin;
const endpoint=path=>CONFIG.API_BASE.replace(/\/$/,'')+'/api/admin/'+path;
views.admin=r=>adminVerified ? `<button class="btn ghost" data-act="admin-logout">${L('ออกจากระบบ','Log out')}</button>`+dashboard(r) : `<section class="card"><h1>${L('เข้าสู่ระบบ','Login')}</h1><form id="admin-login"><label class="field">${L('รหัสผ่านผู้ดูแล','Admin password')}<input name="password" type="password" autocomplete="current-password" required maxlength="4096"></label><label class="field">${L('รหัสยืนยันสองขั้นตอน (ถ้าตั้งไว้)','Two-factor code (if enabled)')}<input name="totp" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code"></label><button class="btn primary">${L('เข้าสู่ระบบ','Login')}</button></form></section>`;
views.admin.mount=async root=>{
 if(adminVerified){dashboard.mount?.(root);return;}
 root.querySelector('#admin-login').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{const res=await fetch(endpoint('login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:e.target.elements.password.value,...(e.target.elements.totp.value?{totp:e.target.elements.totp.value}:{})})});const data=await res.json();if(!res.ok)throw Error(data.error);setAdminSession(data.token,true);if(route().name==='admin')rerender();}catch(err){toast(err.message,'warn');}finally{button.disabled=false;}};
 if(adminToken())try{const res=await adminFetch(endpoint('status'));if(res.ok){setAdminSession(adminToken(),true);if(route().name==='admin')rerender();}}catch{}
};
actions['admin-logout']=async()=>{try{const res=await adminFetch(endpoint('logout'),{method:'POST'});if(!res.ok&&res.status!==401)throw Error('Logout failed');setAdminSession('');rerender();}catch(err){toast(err.message,'warn');}};
