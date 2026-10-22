import {views,actions} from '../core.js';
import {getState} from '../store.js';
import {L,esc,icon,sheet} from '../ui.js';
import {CONFIG} from '../config.js';
import {initials,showAvatar,badgeLabel} from './social.js';
import {api} from '../account.js';
// Preserve the existing progress widgets and handlers on their own destination.
views['body-progress']=views.me;
const groups=[
 ['ความคืบหน้า','Progress',[['!me-weight','น้ำหนัก','Weight'],['body-progress','รูปและความคืบหน้า','Body photos and progress'],['!measurements','สัดส่วน','Measurements'],['records','สถิติส่วนตัว','Personal records'],['muscles','กล้ามเนื้อ','Muscles'],['weekly-recap','สรุปประจำสัปดาห์','Weekly recap']]],
 ['แผนของฉัน','My plan',[['training-settings','ตั้งค่าการฝึก','Training settings'],['!food-prefs','ตั้งค่าอาหาร','Food preferences'],['supps','อาหารเสริม','Supplements'],['!plan-length','ความยาวแผน','Plan length'],['!me-edit','ข้อมูลและเป้าหมาย','Profile and goals'],['!me-restart','เริ่มแผนใหม่','Restart plan']]],
 ['เพื่อนและชุมชน','Friends and community',[['friends','เพื่อน','Friends'],['messages','แชต','Chat'],['groups','กลุ่มและชาเลนจ์','Groups and challenges'],['checkin','เช็กอินยิม','Gym check-in']]],
 ['AI','AI',[['ai-settings','เครื่องมือ AI','AI engine'],['ai-usage','การใช้ AI','AI usage'],['ai-summary','หน้าสรุปให้ AI','AI summary']]],
 ['แอป','App',[['!me-lang','ภาษา','Language'],['!theme','ธีมและสี','Theme and colours'],['!notifications','การแจ้งเตือน','Notifications'],['!offline','โหมดออฟไลน์','Offline mode'],['help','ช่วยเหลือและทัวร์','Help and tour']]],
 ['สุขภาพ','Health',[['!medical','โรคประจำตัว','Medical conditions'],['!medications','ยา','Medications'],['wellbeing','ความเป็นอยู่','Wellbeing'],['!consent-withdraw','ถอนความยินยอมสุขภาพ','Withdraw health consent']]],
 ['บัญชีและข้อมูล','Account and data',[['account','บัญชีและซิงก์','Account and sync'],['!me-backup','สำรองข้อมูล','Back up data'],['!me-restore','กู้คืนข้อมูล','Restore backup'],['!me-pdf','ส่งออก PDF','Export PDF'],['!me-ics','ส่งออก ICS','Export ICS'],['!me-reset','ลบข้อมูลทั้งหมด','Delete all data']]],
 ['สนับสนุน','Support',[['support','สนับสนุน Fixmee','Support Fixmee'],['ideas','เสนอไอเดีย','Ideas'],['credits','เครดิต','Credits'],['privacy','ความเป็นส่วนตัว','Privacy'],['terms','เงื่อนไข','Terms']]]
];
export const settingsRows=groups.flatMap(g=>g[2]);
views.me=()=>{const s=getState(),p=s.socialProfile,engine=localStorage.getItem('fitme:ai-engine')||'gemini';const value=key=>key==='!me-lang'?s.lang:key==='!theme'?s.theme:key==='!plan-length'?s.profile.planDays:key==='ai-settings'?engine:'';return `<header class="top"><h1>${L('ฉัน','Me')}</h1></header><section class="card"><div class="profile-avatar">${esc(initials(p?.display_name||s.profile.name))}</div><h2>${esc(p?.display_name||s.profile.name)}</h2><p>${p?.handle?'@'+esc(p.handle):''}</p><a class="btn primary" href="#/profile">${L('แก้ไขโปรไฟล์','Edit profile')}</a>${p?.handle?`<button class="btn ghost" data-act="profile-share" data-handle="${esc(p.handle)}">${L('แชร์โปรไฟล์','Share profile')}</button>`:''}</section>${groups.map(([th,en,rows])=>`<section class="card settings-list"><h2>${L(th,en)}</h2><div class="list">${rows.filter(([key])=>key!=='ai-usage'||engine==='claude'&&CONFIG.aiEngines?.claude!==false).map(([key,th,en])=>{const tag=key[0]==='!'?'button':'a',attr=tag==='button'?`data-act="${key.slice(1)}"`:`href="#/${key}"`;return `<${tag} class="list-row" ${attr}>${icon('chev',16)}<span>${L(th,en)}</span><small>${esc(String(value(key)))}</small>${icon('chev',16)}</${tag}>`;}).join('')}</div></section>`).join('')}${CONFIG.freeMode?'':`<a class="list-row" href="#/pay">${L('แพ็กเกจ','Packages')}</a>`}`;};
actions['plan-length']=()=>sheet(`<h2>${L('ความยาวแผน','Plan length')}</h2><div class="seg">${[7,30,60,90].map(n=>`<button class="chip ${getState().profile.planDays===n?'on':''}" data-act="me-days" data-v="${n}">${n} ${L('วัน','days')}</button>`).join('')}</div>`);

views.me.mount=async root=>{const handle=getState().socialProfile?.handle;showAvatar(root.querySelector('.profile-avatar'),handle);if(handle)try{const {profile:p}=await api('profiles/'+encodeURIComponent(handle));if(!root.isConnected)return;const badges=document.createElement('p');badges.innerHTML=(p.badges||[]).map(b=>`<span class="tag">${esc(badgeLabel(b))}</span>`).join('');root.querySelector('.profile-avatar')?.parentElement.append(badges);}catch{}};
