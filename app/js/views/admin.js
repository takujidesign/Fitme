import { views, actions } from '../core.js';
import { CONFIG, currentConfig, mergeConfig } from '../config.js';
import { L, esc, toast } from '../ui.js';

const labels = { promptpayId: ['พร้อมเพย์', 'PromptPay ID'], promptpayName: ['ชื่อพร้อมเพย์', 'PromptPay name'], receiverName: ['ชื่อผู้รับในสลิป (คั่นด้วย |)', 'Slip receiver name (separate alternatives with |)'], freePlanDays: ['จำนวนวันฟรี', 'Free plan days'], freeSupplements: ['อาหารเสริมฟรี', 'Free supplements'] };
views.admin = () => {
  const c = currentConfig();
  return `<header class="top"><h1>${L('ผู้ดูแลระบบ', 'Admin')}</h1></header>
    <section class="card"><label class="field">${L('รหัสผ่านผู้ดูแล', 'Admin password')}<input id="admin-password" type="password" autocomplete="off"></label>
    <p class="muted sm">${L('รหัสผ่านเก็บเฉพาะในเซสชันแท็บนี้', 'Password is kept only in this tab session.')}</p>
    <div id="admin-secrets" class="chips">${L('กำลังโหลดสถานะ', 'Loading status')}</div></section>
    <form id="admin-form" class="card">
    ${Object.entries(labels).map(([k, label]) => `<label class="field">${L(...label)}<input name="${k}" value="${esc(c[k])}" ${k.startsWith('free') ? 'type="number" min="0" step="1"' : ''}></label>`).join('')}
    ${Object.entries(c.products).map(([id, p]) => `<fieldset><legend>${esc(id)}</legend>${['thb', 'usd', 'days', 'exports', 'th', 'en', 'descTh', 'descEn'].map((k) => `<label class="field">${esc(k)}<input name="${id}.${k}" value="${esc(p[k])}" ${['thb', 'usd', 'days', 'exports'].includes(k) ? 'type="number" min="0" step="' + (['thb', 'usd'].includes(k) ? '0.01' : '1') + '"' : ''} required></label>`).join('')}</fieldset>`).join('')}
    <button class="btn primary block" data-act="admin-save" ${CONFIG.API_BASE ? '' : 'disabled'}>${L('บันทึก', 'Save')}</button></form>
    <section class="card"><p>${L('API keys เก็บเป็น Wrangler secrets เท่านั้น ไม่เก็บในหน้านี้หรือ KV ตั้ง API_BASE และ CONFIG KV ก่อนใช้งาน', 'API keys remain Wrangler secrets, never stored here or in KV. Configure API_BASE and CONFIG KV first.')}</p><pre>${['ADMIN_PASSWORD', 'TOKEN_SECRET', 'THUNDER_API_KEY', 'STRIPE_SECRET_KEY', 'ANTHROPIC_API_KEY'].map((k) => 'npx wrangler secret put ' + k).join('\n')}</pre></section>`;
};
views.admin.mount = async (root) => {
  const password = root.querySelector('#admin-password');
  try { password.value = sessionStorage.getItem('fitme:admin-password') || ''; } catch {}
  password.addEventListener('input', () => { try { sessionStorage.setItem('fitme:admin-password', password.value); } catch {} });
  const status = root.querySelector('#admin-secrets');
  if (!CONFIG.API_BASE) { status.textContent = L('โหมดทดลอง: ยังไม่ได้ตั้ง API_BASE', 'Demo: API_BASE is not configured'); return; }
  try {
    const res = await fetch(CONFIG.API_BASE.replace(/\/$/, '') + '/api/config');
    const data = await res.json();
    if (!res.ok || !data.secrets) throw new Error('Could not load status');
    status.innerHTML = Object.entries(data.secrets).map(([k, v]) => `<span class="chip ${v ? 'on' : ''}">${esc(k)}: ${v ? L('พร้อม', 'set') : L('ยังไม่ตั้ง', 'missing')}</span>`).join('');
  } catch (e) { status.textContent = e.message; }
};
actions['admin-save'] = async (el) => {
  const form = document.getElementById('admin-form');
  if (!form.reportValidity()) return;
  const config = structuredClone(currentConfig());
  for (const [key, value] of new FormData(form)) {
    const [id, field] = key.split('.');
    if (field) config.products[id][field] = ['thb', 'usd', 'days', 'exports'].includes(field) ? Number(value) : value;
    else config[id] = id.startsWith('free') ? Number(value) : value;
  }
  el.disabled = true;
  try {
    const res = await fetch(CONFIG.API_BASE.replace(/\/$/, '') + '/api/admin/config', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + document.getElementById('admin-password').value }, body: JSON.stringify(config) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');
    mergeConfig(data.config);
    try { localStorage.setItem('fitme:config:' + CONFIG.API_BASE, JSON.stringify(data.config)); } catch {}
    toast(L('บันทึกแล้ว', 'Saved'));
  } catch (e) { toast(e.message, 'warn'); } finally { el.disabled = false; }
};
