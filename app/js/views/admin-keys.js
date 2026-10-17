import { actions } from '../core.js';
import { L, esc, toast } from '../ui.js';
import { api } from '../account.js';
const keys={stripeWebhookSecret:'Stripe webhook signing secret',resendApiKey:'Resend (optional)',lineChannelSecret:'LINE Login channel secret',lineMessagingToken:'LINE Messaging token',thunderApiKey:'Thunder',stripeSecretKey:'Stripe',anthropicApiKey:'Claude',vapidPublicKey:'VAPID public',vapidPrivateKey:'VAPID private'};
export function keySettings(status={}) {
 return `<h2>${L('คีย์ API','API keys')}</h2><p class="note">${L('ตั้ง ADMIN_PASSWORD, TOKEN_SECRET, MASTER_KEY ด้วย wrangler secret put ครั้งแรกเท่านั้น คีย์บริการบันทึกแบบเข้ารหัสได้ที่นี่ Wrangler secret เดิมมีลำดับความสำคัญสูงกว่า การลบที่นี่ลบเฉพาะค่าใน KV','Only ADMIN_PASSWORD, TOKEN_SECRET and MASTER_KEY need wrangler secret put at first setup. Service keys entered here are encrypted. Existing Wrangler secrets take precedence; Delete removes only the KV value.')}</p>${Object.entries(keys).map(([key,label])=>`<div class="card"><label class="field">${label} · ${status[key]?.set?'•••• '+esc(status[key].last4):L('ยังไม่ตั้งค่า','Not set')}<input id="key-${key}" type="password" autocomplete="new-password" maxlength="4096"></label><button class="btn primary xs" data-act="key-save" data-key="${key}">${L('บันทึก','Save')}</button><button class="btn ghost xs" data-act="key-delete" data-key="${key}">${L('ลบ','Delete')}</button><button ${(key.startsWith('line')||['stripeWebhookSecret','resendApiKey'].includes(key))?'hidden':''} class="btn ghost xs" data-act="key-test" data-service="${key.startsWith('vapid')?'vapid':key==='anthropicApiKey'?'anthropic':key==='stripeSecretKey'?'stripe':'thunder'}">${L('ทดสอบการเชื่อมต่อ','Test connection')}</button></div>`).join('')}<button class="btn ghost" data-act="key-random">${L('สร้างค่าสุ่ม','Generate random string')}</button><input id="key-random-value" readonly aria-label="${L('ค่าสุ่มสำหรับคัดลอก','Random string to copy')}"><p role="status" id="key-status"></p>`;
}
for(const action of ['save','delete','test'])actions['key-'+action]=async el=>{
 el.disabled=true;
 try {
  const token=document.getElementById('admin-password').value;
  if(action==='test'){const r=await api('admin/test',{service:el.dataset.service},'POST',token);document.getElementById('key-status').textContent=(r.connected?'✓ ':'✕ ')+(r.message||'OK');}
  else{const value=action==='delete'?'':document.getElementById('key-'+el.dataset.key).value;if(action==='save'&&!value)return;const r=await api('admin/secrets',{[el.dataset.key]:value},'PUT',token);document.getElementById('admin-key-settings').innerHTML=keySettings(r.secrets);toast(L('บันทึกแล้ว','Saved'));}
 }catch(e){toast(e.message,'warn');}finally{el.disabled=false;}
};
actions['key-random']=()=>{const value=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');const el=document.getElementById('key-random-value');el.value=value;el.select();};
