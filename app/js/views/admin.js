import {adminCommunity} from './admin-round10.js';
import { adminToken, adminFetch } from '../admin-session.js';
import { keySettings } from './admin-keys.js';
import { views, actions } from '../core.js';
import { CONFIG, currentConfig, mergeConfig } from '../config.js';
import { L, esc, toast } from '../ui.js';
let baseline = '';
const snapshot = form => JSON.stringify([...new FormData(form)]);
const labels = {promptpayId:['หมายเลขพร้อมเพย์', 'PromptPay number'],promptpayName:['ชื่อพร้อมเพย์', 'PromptPay display name'],receiverName:['ชื่อผู้รับเงิน', 'Receiver names'],freePlanDays:['จำนวนวันฟรี', 'Free plan days'],freeSupplements:['อาหารเสริมฟรี', 'Free supplements'],th:['ชื่อแพ็กเกจ (ไทย)', 'Package name (Thai)'],en:['ชื่อแพ็กเกจ (อังกฤษ)', 'Package name (English)'],thb:['ราคา (บาท)', 'Price (THB)'],usd:['ราคา (USD)', 'Price (USD)'],days:['จำนวนวัน (0 = ซื้อครั้งเดียว)', 'Days (0 = one-time purchase)'],exports:['จำนวนครั้งดาวน์โหลด', 'Downloads'],descTh:['คำอธิบาย (ไทย)', 'Description (Thai)'],descEn:['คำอธิบาย (อังกฤษ)', 'Description (English)']};
const numeric = ['freePlanDays','freeSupplements','thb','usd','days','exports'];
function field(name,value) {
 const k=name.split('.').at(-1),price=['thb','usd'].includes(k);
 const max={thb:1000000,usd:1000000,days:3650,exports:100000,freePlanDays:365,freeSupplements:100};
 return `<label class="field"><span>${L(...labels[k])}</span><div class="input-wrap"><input name="${name}" value="${esc(value)}" ${numeric.includes(k)?`type="number" min="${price?'.01':'0'}" max="${max[k]}" step="${price?'.01':'1'}"`:`maxlength="${k.startsWith('desc')?1000:k==='receiverName'?300:200}"`} ${['receiverName','descTh','descEn'].includes(k)?'':'required'}></div><small class="field-error" data-error="${name}" aria-live="polite"></small></label>`;
}
const commands=[];
function statuses(flags={}) {return [['api',L('เซิร์ฟเวอร์ API', 'API server')],['token','Token secret'],['thunder','Thunder'],['stripe','Stripe'],['anthropic','Claude'],['config','CONFIG KV']].map(([k,label])=>`<div class="status-row"><span>${label}</span><span class="${flags[k]?'ok':'muted'}">${flags[k]?'✓':'—'} ${flags[k]?L('พร้อมใช้งาน', 'Ready'):L('ยังไม่ได้ตั้งค่า', 'Not configured')}</span></div>`).join('');}
views.admin=()=>{const c=currentConfig();return `<header class="top"><h1>${L('ตั้งค่าระบบ', 'Admin settings')}</h1></header><p class="muted">${L('จัดการการรับเงิน แพ็กเกจ และสิทธิ์ฟรีของ Fixmee', 'Manage payments, packages and free access for Fixmee.')}</p><section class="card" id="admin-secrets">${statuses()}</section>
<section class="card" id="admin-key-settings">${keySettings()}</section>${adminCommunity()}<form id="admin-form"><section class="card"><label><input type="checkbox" name="freeMode" ${c.freeMode?'checked':''}>${L('โหมดฟรี','Free mode')}</label><label><input type="checkbox" name="claudeEnabled" ${c.aiEngines.claude?'checked':''}>${L('เอนจิน Claude','Claude engine')}</label>${['wiseUrl','stripeUrl'].map(k=>`<label class="field">${k==='wiseUrl'?'Wise URL':'Stripe URL'}<input name="${k}" type="url" value="${esc(c.donate[k])}"></label>`).join('')}</section><section class="card"><h2>${L('การรับเงิน', 'Payments')}</h2>${field('promptpayId',c.promptpayId)}<p class="muted sm">${L('เบอร์โทร 10 หลักขึ้นต้น 0 หรือเลขประจำตัว 13 หลัก', '10-digit phone starting with 0, or 13-digit national/tax ID')}</p>${field('promptpayName',c.promptpayName)}${field('receiverName',c.receiverName)}<p class="muted sm">${L('ชื่อบัญชีตามสลิป คั่นชื่อทางเลือกด้วย | เพื่อให้ตรวจผู้รับเงินได้', 'Use account names shown on slips. Separate alternatives with | for receiver matching.')}</p></section>
<h2>${L('แพ็กเกจ', 'Packages')}</h2>${Object.entries(c.products).map(([id,p])=>`<section class="card"><div class="product-preview" data-preview="${id}"></div><div class="grid2">${['th','en','thb','usd','days','exports','descTh','descEn'].map(k=>field(id+'.'+k,p[k])).join('')}</div><label class="shopping-row"><input type="checkbox" name="${id}.best" ${p.best?'checked':''}>${L('แสดงป้ายคุ้มสุด', 'Show best value badge')}</label></section>`).join('')}
<section class="card"><h2>${L('แผนฟรี', 'Free plan')}</h2>${['freePlanDays','freeSupplements'].map(k=>`<div class="stepper"><button type="button" class="btn ghost" data-act="admin-step" data-key="${k}" data-n="-1">−</button>${field(k,c[k])}<button type="button" class="btn ghost" data-act="admin-step" data-key="${k}" data-n="1">+</button></div>`).join('')}</section>
<div class="admin-save"><small id="admin-dirty" role="status"></small><button type="submit" class="btn primary" data-act="admin-save" ${CONFIG.API_BASE?'':'disabled'}>${L('บันทึก', 'Save')}</button></div></form>
<section class="card"><p>${L('deploy อัตโนมัติผ่าน GitHub Actions','Automatic deployment through GitHub Actions')}</p></section>`;};
function validate(form) {
 let valid=true;
 for(const el of form.querySelectorAll('input:not([type=checkbox])')) {
  el.setCustomValidity('');
  if(el.name==='promptpayId' && !/^(0\d{9}|\d{13})$/.test(el.value.replace(/[ -]/g,'')))el.setCustomValidity(L('กรอกหมายเลขพร้อมเพย์ 10 หรือ 13 หลัก', 'Enter a valid 10- or 13-digit PromptPay number'));
  const error=form.querySelector(`[data-error="${el.name}"]`);if(error)error.textContent=el.validity.valid?'':el.validationMessage;
  valid=el.validity.valid&&valid;
 }
 return valid;
}
function updateDirty(form) {
 document.getElementById('admin-dirty').textContent=snapshot(form)!==baseline?L('มีการเปลี่ยนแปลงที่ยังไม่บันทึก', 'Unsaved changes'):L('บันทึกครบแล้ว', 'All changes saved');
 for(const el of form.querySelectorAll('[data-preview]')){const id=el.dataset.preview,read=k=>form.elements[id+'.'+k].value;el.textContent=`${read(getStateLang())} · ฿${read('thb')} / $${read('usd')} · ${Number(read('days'))===0?L('ซื้อครั้งเดียว', 'One time'):read('days')+' '+L('วัน', 'days')}`;}
}
const getStateLang=()=>L('th','en');
views.admin.mount=async root=>{
 const form=root.querySelector('#admin-form');
 baseline=snapshot(form);updateDirty(form);
 form.addEventListener('input',()=>{validate(form);updateDirty(form);});form.addEventListener('submit',e=>e.preventDefault());
 if(!CONFIG.API_BASE)return;
 try{const res=await adminFetch(CONFIG.API_BASE.replace(/\/$/,'')+'/api/admin/status');const data=await res.json();if(!res.ok)throw Error();root.querySelector('#admin-secrets').innerHTML=statuses({api:true,...data.secrets,thunder:data.secrets.thunderApiKey?.set,stripe:data.secrets.stripeSecretKey?.set,anthropic:data.secrets.anthropicApiKey?.set});root.querySelector('#admin-key-settings').innerHTML=keySettings(data.secrets);}catch{const host=root.querySelector('#admin-secrets');if(host)host.innerHTML=statuses();}
};
actions['admin-step']=el=>{const form=document.getElementById('admin-form'),input=form.elements[el.dataset.key];input.value=Math.max(0,Number(input.value)+Number(el.dataset.n));validate(form);updateDirty(form);};
actions['admin-copy']=async el=>{try{await navigator.clipboard.writeText(commands[Number(el.dataset.i)]);toast(L('คัดลอกแล้ว', 'Copied'));}catch{toast(L('เลือกคำสั่งเพื่อคัดลอก', 'Select the command to copy'));}};
actions['admin-save'] = async (el) => {
  const form = document.getElementById('admin-form');
  if (!validate(form) || !form.reportValidity()) return;
  const config = structuredClone(currentConfig());
  for (const [key, value] of new FormData(form)) {
    if(['freeMode','claudeEnabled','wiseUrl','stripeUrl'].includes(key))continue;
    const [id, field] = key.split('.');
    if (field) config.products[id][field] = ['thb', 'usd', 'days', 'exports'].includes(field) ? Number(value) : value;
    else config[id] = id.startsWith('free') ? Number(value) : id === 'promptpayId' ? value.replace(/[ -]/g, '') : value;
  }
  for (const id of Object.keys(config.products)) config.products[id].best = form.elements[`${id}.best`].checked;
  config.freeMode=form.elements.freeMode.checked;config.aiEngines={claude:form.elements.claudeEnabled.checked};config.donate={wiseUrl:form.elements.wiseUrl.value,stripeUrl:form.elements.stripeUrl.value};
  el.disabled = true;
  try {
    const res = await adminFetch(CONFIG.API_BASE.replace(/\/$/, '') + '/api/admin/config', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken() }, body: JSON.stringify(config) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');
    mergeConfig(data.config);
    try { localStorage.setItem('fitme:config:' + CONFIG.API_BASE, JSON.stringify(data.config)); } catch {}
    baseline = snapshot(form); updateDirty(form); toast(L('บันทึกแล้ว', 'Saved'));
  } catch (e) { toast(e.message, 'warn'); } finally { el.disabled = false; }
};
