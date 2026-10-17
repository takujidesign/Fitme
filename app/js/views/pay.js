import { legalLinks } from '../legal.js';
import { createQuote, claimQuote } from '../pay.js';
import { actions, views, go, rerender, pickFiles } from '../core.js';
import { getState } from '../store.js';
import { L, esc, icon, toast } from '../ui.js';
import { CONFIG, isDemo } from '../config.js';
import { hasPro, verifySlip, stripeCheckout, promptPayPayload, qrSVG } from '../pay.js';
import { compressImage } from '../store.js';

let sel = 'pro30', method = null, quote=null, promo='';

views.pay = () => {
  const th = getState().lang === 'th';
  const prods = Object.entries(CONFIG.PRODUCTS);
  const pr = {...CONFIG.PRODUCTS[sel]};if(quote && quote.expiresAt>Date.now())pr[quote.currency]=quote.amount;
  return `<header class="top"><button class="icon-btn" data-act="pay-back">${icon('back')}</button><div class="grow"><small class="muted">Fix me Pro</small><h1>${L('เลือกแพ็กเกจ', 'Choose a plan')}</h1></div></header>
    ${isDemo() ? `<p class="note warn">${icon('info', 16)} ${L('โหมดทดลอง: ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์ชำระเงิน การจ่ายจะเป็นการจำลอง', 'Demo mode: no payment server configured, payments are simulated')}</p>` : ''}
    ${hasPro() ? `<p class="note">${icon('check', 16)} ${L('คุณเป็นสมาชิก Pro อยู่แล้ว ซื้อเพิ่มเพื่อต่ออายุ', 'You are already Pro; buying again extends it')}</p>` : ''}
    <ul class="perks">${[
      ['cal', L('แผนออกกำลังกาย + อาหาร ครบทุกวัน 7-90 วัน', 'Full training + meal plan, 7-90 days')],
      ['pill', L('อาหารเสริมไม่จำกัด + AI อ่านฉลากให้', 'Unlimited supplements + AI label reading')],
      ['download', L('ดาวน์โหลด PDF และปฏิทินแจ้งเตือน', 'PDF + calendar reminder downloads')],
      ['refresh', L('ปรับแผนอัตโนมัติเมื่อน้ำหนักเปลี่ยน', 'Plan auto-adjusts as your weight changes')],
    ].map(([i, t]) => `<li>${icon(i, 18)} ${t}</li>`).join('')}</ul>
    <div class="plans">${prods.map(([id, p]) => `<button class="plan ${sel === id ? 'on' : ''}" data-act="pay-sel" data-v="${id}">
      ${p.best ? `<span class="best">${L('คุ้มสุด', 'Best value')}</span>` : ''}<b>${L(p.th, p.en)}</b><small>${L(p.descTh, p.descEn)}</small>
      <em>${th ? `฿${p.thb}` : `$${p.usd}`}</em></button>`).join('')}</div>
    ${legalLinks()}<label class="field">${L('โค้ดส่วนลด','Promo code')}<input id="pay-promo" maxlength="32" value="${esc(promo)}"></label><button class="btn ghost" data-act="pay-quote">${L('ใช้โค้ด / ยืนยันราคา','Apply code / confirm price')}</button>
    <h3>${L('ชำระเงินด้วย', 'Pay with')}</h3>
    <div class="methods">
      <button class="method ${method === 'pp' ? 'on' : ''}" data-act="pay-method" data-v="pp">${icon('qr', 24)}<b>PromptPay</b><small>${L('สแกนจ่าย + แนบสลิป', 'Scan + upload slip')} · ฿${pr.thb}</small></button>
      <button class="method ${method === 'card' ? 'on' : ''}" data-act="pay-method" data-v="card">${icon('card', 24)}<b>${L('บัตร / Apple Pay / Google Pay', 'Card / Apple Pay / Google Pay')}</b><small>Stripe · ${L('รองรับทั่วโลก', 'worldwide')} · ${th ? '฿' + pr.thb : '$' + pr.usd}</small></button>
    </div>
    <div id="pay-area">${quote?.amount===0?`<p>${L('ยอดชำระ 0','Total due: 0')}</p><button class="btn primary" data-act="pay-free">${L('ยืนยันใช้ส่วนลดเต็มจำนวน','Confirm fully discounted order')}</button>`:method === 'pp' && (isDemo()||quote) ? `<div class="pp-box"><div class="qr" id="qr"><span class="spin"></span></div>
        <b>฿${pr.thb.toFixed(2)}</b><small>PromptPay · ${esc(CONFIG.PROMPTPAY_NAME)}</small>
        <ol class="muted sm"><li>${L('สแกน QR ด้วยแอปธนาคาร (หรือบันทึกภาพหน้าจอแล้วอัปโหลดในแอปธนาคาร)', 'Scan with your banking app (or screenshot and upload it there)')}</li><li>${L('โอนตามยอดที่แสดง', 'Pay the exact amount')}</li><li>${L('แนบสลิป ระบบตรวจสอบอัตโนมัติภายในไม่กี่วินาที', 'Upload the slip — verified automatically in seconds')}</li></ol>
        <button class="btn primary block" data-act="pay-slip">${icon('image', 18)} ${L('แนบสลิปการโอน', 'Upload transfer slip')}</button></div>`
      : method === 'card' ? `<button class="btn primary block lg" data-act="pay-stripe">${icon('card', 18)} ${L('ไปหน้าชำระเงิน Stripe', 'Continue to Stripe checkout')}</button>
        <p class="muted sm center">${L('ข้อมูลบัตรถูกกรอกบนหน้า Stripe ที่ปลอดภัย แอปไม่เห็นข้อมูลบัตร', 'Card details are entered on Stripe\'s secure page; the app never sees them')}</p>` : ''}</div>
    <p class="muted sm center">${L('ชำระครั้งเดียว ไม่ต่ออายุอัตโนมัติ', 'One-time payment, no auto-renewal')}</p>`;
};
views.pay.mount = async (root) => {
  const q = root.querySelector('#qr');
  if (!q) return;
  try { q.innerHTML = await qrSVG(promptPayPayload(CONFIG.PROMPTPAY_ID, quote?.currency==='thb'?quote.amount:CONFIG.PRODUCTS[sel].thb)); }
  catch { q.innerHTML = `<small class="muted">${L('โหลด QR ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ต', 'Could not load QR, check your connection')}</small>`; }
};

actions['pay-back'] = () => (history.length > 1 ? history.back() : go('#/me'));
actions['pay-sel'] = (el) => { sel = el.dataset.v; quote=null; rerender(); };
actions['pay-method'] = (el) => { method = el.dataset.v; quote=null; rerender(); };
const done = () => {
  toast(L('ชำระเงินสำเร็จ ปลดล็อกแล้ว 🎉', 'Payment confirmed — unlocked 🎉'));
  method = null; quote=null;
  go('#/me');
};
actions['pay-slip'] = async (el) => {
  if(!isDemo()&&(!quote||quote.expiresAt<=Date.now()))return toast(L('ยืนยันราคาก่อนชำระ','Confirm the price before payment'),'warn');
  const [f] = await pickFiles({ accept: 'image/*' });
  if (!f) return;
  el.disabled = true;
  el.innerHTML = `<span class="spin"></span> ${L('กำลังตรวจสอบสลิป...', 'Verifying slip...')}`;
  try {
    await verifySlip(sel, await compressImage(f, 1600, 0.9), quote);
    done();
  } catch (e) {
    toast(L('ตรวจสอบสลิปไม่ผ่าน: ', 'Slip check failed: ') + e.message, 'warn');
    el.disabled = false;
    el.innerHTML = `${icon('image', 18)} ${L('แนบสลิปอีกครั้ง', 'Upload again')}`;
  }
};
actions['pay-stripe'] = async (el) => {
  if(!isDemo()&&(!quote||quote.expiresAt<=Date.now()))return toast(L('ยืนยันราคาก่อนชำระ','Confirm the price before payment'),'warn');
  el.disabled = true;
  el.innerHTML = `<span class="spin"></span> ${L('กำลังเปิด Stripe...', 'Opening Stripe...')}`;
  try {
    const r = await stripeCheckout(sel, quote);
    if (r.demo) done();
  } catch (e) {
    toast(e.message, 'warn');
    el.disabled = false;
  }
};

actions['pay-quote']=async el=>{el.disabled=true;try{promo=document.getElementById('pay-promo').value.trim().toUpperCase();quote=await createQuote(sel,method==='pp'?'thb':getState().lang==='th'?'thb':'usd',promo);rerender();}catch(e){toast(e.message,'warn');}finally{el.disabled=false;}};
actions['pay-free']=async el=>{el.disabled=true;try{await claimQuote(quote);done();}catch(e){toast(e.message,'warn');}finally{el.disabled=false;}};
