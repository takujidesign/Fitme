import {views,actions,rerender} from '../core.js';
import {L,esc} from '../ui.js';
import {integrationEnabled,betaCard} from '../beta.js';
import {models,saveKey} from '../ai-engines.js';
import {registerSlot} from '../slots.js';
import {CONFIG} from '../config.js';
export const geminiErrors=[
 [/API_KEY_INVALID|API key not valid|INVALID_ARGUMENT/i,'คีย์ไม่ถูกต้อง คัดลอกคีย์ใหม่ให้ครบ','Invalid key. Copy the complete key again.'],
 [/SERVICE_DISABLED|API has not been used|has not been used in project|API.*not enabled/i,'เปิด Generative Language API ในโปรเจกต์ที่สร้างคีย์ แล้วลองอีกครั้ง','Enable the Generative Language API in the key project and retry.'],
 [/429|RESOURCE_EXHAUSTED|quota exceeded/i,'โควตาหมด รอรอบใหม่ หรือตรวจโควตาและการเรียกเก็บเงินใน AI Studio','Quota exhausted. Wait or check quota and billing in AI Studio.'],
 [/User location is not supported|region.*not supported|FAILED_PRECONDITION/i,'ภูมิภาคไม่รองรับ ตรวจประเทศที่บริการเปิดใช้','Region unsupported. Check supported countries.'],
 [/Failed to fetch|NetworkError|network|blocked/i,'เครือข่ายบล็อก ตรวจการเชื่อมต่อ ไฟร์วอลล์ และลองใหม่','Network blocked. Check connectivity and firewall, then retry.']
];
export function geminiTrouble(message){const found=geminiErrors.find(([re])=>re.test(message));return found?L(found[1],found[2]):L('ตรวจข้อความผิดพลาดแล้วลองอีกครั้ง','Review the error and retry');}
let step=0;
const steps=[['เปิด AI Studio และลงชื่อเข้าใช้ Google','Open AI Studio and sign in with Google','Sign in → Google AI Studio'],['กด Create API key เลือกหรือสร้างโปรเจกต์','Choose Create API key and select or create a project','Create API key → Project'],['คัดลอกคีย์ อย่าแชร์กับผู้อื่น','Copy the key. Do not share it.','API key: •••••••• → Copy'],['วางคีย์ใน Fixmee แล้วกดทดสอบ','Paste the key into Fixmee and test','Fixmee → API key → Test'],['ตรวจขีดจำกัดการใช้และนโยบายข้อมูลของบริการฟรี','Review usage limits and free-tier data use','Usage → Quotas / Billing']];
views['ai-guide']=()=>{if(!integrationEnabled('byok'))return betaCard();const s=steps[step];return `<h1>Gemini · ${L('คู่มือตั้งค่า','Setup guide')}</h1><p>${step+1} / 5</p><h2>${L(s[0],s[1])}</h2><div class="guide-mock" role="img" aria-label="${L('ภาพจำลองที่วาดในแอป ไม่ใช่หน้าจอจริง','In-app illustration, not a real screenshot')}"><b>Google AI Studio / Fixmee</b><span>${esc(s[2])}</span></div>${step===0?'<a class="btn primary" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">Google AI Studio</a>':''}${step===3?`<label class="field">API key<input id="guide-key" type="password" autocomplete="off"></label><button class="btn primary" data-act="guide-test">${L('ทดสอบ','Test')}</button><p id="guide-status" role="status"></p>`:''}<div class="row gap"><button class="btn ghost" data-act="guide-prev" ${step===0?'disabled':''}>${L('ย้อนกลับ','Back')}</button><button class="btn primary" data-act="guide-next" ${step===4?'disabled':''}>${L('ถัดไป','Next')}</button></div><h2>${L('แก้ปัญหา','Troubleshooting')}</h2>${geminiErrors.map(([pattern,th,en])=>`<details><summary>${esc(pattern.source)}</summary><p>${L(th,en)}</p></details>`).join('')}<h2>FAQ</h2>${[
 ['ฟรีหรือไม่?','Is it free?','ขึ้นกับโมเดลและโควตาของ Google ตรวจ AI Studio ก่อนใช้งาน','Depends on Google model and quotas. Check AI Studio before use.'],
 ['ส่งอะไรบ้าง?','What is sent?','พรอมป์ โปรไฟล์และรูปที่เลือกตามตัวอย่างก่อนส่ง คีย์ฟรีอาจมีการใช้ข้อมูลเพื่อปรับปรุงบริการ','The previewed prompt, profile and selected images. Free-tier data may be used to improve services.'],
 ['คีย์เก็บที่ไหน?','Where is the key stored?','เฉพาะ localStorage ของอุปกรณ์นี้ ไม่สำรองหรือซิงก์ คีย์ในแล็บใช้ sessionStorage','Only in this device’s localStorage, outside backups and sync. Lab keys use sessionStorage.'],
 ['ลบหรือเพิกถอนอย่างไร?','How do I delete or revoke it?','กดลบคีย์ในตั้งค่า AI และลบคีย์ในหน้า API keys ของ AI Studio เพื่อเพิกถอน','Remove the key in AI settings; delete it in AI Studio API keys to revoke access.']
 ].map(([th,en,a,b])=>`<details><summary>${L(th,en)}</summary><p>${L(a,b)}</p></details>`).join('')}<a class="btn ghost" href="#/ai-settings">${L('ตั้งค่า AI','AI settings')}</a>`;};
actions['guide-prev']=()=>{step=Math.max(0,step-1);rerender();};actions['guide-next']=()=>{step=Math.min(4,step+1);rerender();};
actions['guide-test']=async()=>{const status=document.getElementById('guide-status');try{saveKey(document.getElementById('guide-key').value);document.getElementById('guide-key').value='';await models();status.textContent=L('คีย์ใช้งานได้','Key works');}catch(e){status.textContent=geminiTrouble(e.message);}};
registerSlot('today.footer',()=>CONFIG.beta?.enabled!==false&&!localStorage.getItem('fitme:beta-dismiss')?`<section class="card" id="beta-banner"><b>Beta tester</b><p>${L('กำลังทดสอบ — เจอปัญหากดเสนอ/รายงานได้ที่นี่','Beta testing — report problems or suggest ideas here')}</p><a class="btn ghost" href="#/ideas">${L('เสนอ / รายงาน','Ideas / report')}</a><button class="btn ghost" data-act="beta-dismiss">${L('ปิด','Dismiss')}</button></section>`:'');
actions['beta-dismiss']=()=>{localStorage.setItem('fitme:beta-dismiss','1');document.getElementById('beta-banner')?.remove();};
