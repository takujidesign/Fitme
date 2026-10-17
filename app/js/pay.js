import { api as accountAPI } from './account.js';
import { track } from './telemetry.js';
// Payments (PromptPay slip via Thunder API, Stripe Checkout) and entitlements.
import { CONFIG, isDemo } from './config.js';
import { getState, setState, blobToBase64 } from './store.js';

export const hasPro = () => { const u = getState().premium.until; return !!u && new Date(u) > new Date(); };
export const canExport = () => hasPro() || getState().premium.exportsLeft > 0;
export function useExport() {
  if (hasPro()) return;
  setState((s) => { s.premium.exportsLeft = Math.max(0, s.premium.exportsLeft - 1); });
}

export function applyEntitlement(ent, token, method) {
  setState((s) => {
    const prod = CONFIG.PRODUCTS[ent.pid];
    if (prod.days) {
      const base = s.premium.until && new Date(s.premium.until) > new Date() ? new Date(s.premium.until) : new Date();
      base.setDate(base.getDate() + prod.days);
      s.premium.until = ent.until || base.toISOString();
    }
    if (!prod.days) s.premium.exportsLeft += prod.exports;
    s.premium.token = token || s.premium.token;
    s.payments.push({ pid: ent.pid, ref: ent.ref || null, method, at: new Date().toISOString() });
  });
}

async function api(path, opts = {}) {
  const res = await fetch(CONFIG.API_BASE.replace(/\/$/, '') + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(getState().premium.token ? { Authorization: 'Bearer ' + getState().premium.token } : {}), ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function verifySlip(pid, blob, quote) {
  if (isDemo()) {
    await new Promise((r) => setTimeout(r, 1200));
    applyEntitlement({ pid, ref: 'DEMO-' + Date.now() }, 'demo', 'promptpay-demo');
    return { demo: true };
  }
  const image = await blobToBase64(blob);
  quote ||= await createQuote(pid,'thb');
  const data = await accountAPI('slip/verify',{orderId:quote.orderId,image});
  if(data.entitlement)applyEntitlement(data.entitlement, data.token, 'promptpay');
  track('purchase_completed');
  return data;
}

export async function stripeCheckout(pid, quote) {
  if (isDemo()) {
    await new Promise((r) => setTimeout(r, 900));
    applyEntitlement({ pid, ref: 'DEMO-STRIPE' }, 'demo', 'stripe-demo');
    return { demo: true };
  }
  const returnUrl = location.href.split('#')[0];
  quote ||= await createQuote(pid,getState().lang === 'th' ? 'thb' : 'usd');
  const data = await accountAPI('stripe/checkout',{orderId:quote.orderId,returnUrl});
  location.href = data.url;
  return data;
}

// Called on load when Stripe redirects back with ?paid=<session_id>
export async function handleStripeReturn() {
  const q = new URLSearchParams(location.search);
  const sid = q.get('paid');
  if (!sid || isDemo()) return null;
  history.replaceState(null, '', location.pathname + location.hash);
  if (getState().payments.some((p) => p.ref === sid)) return null;
  const data = await accountAPI('stripe/confirm?session_id=' + encodeURIComponent(sid));
  if(data.entitlement)applyEntitlement({ ...data.entitlement, ref: sid }, data.token, 'stripe');
  if(data.planId)location.hash='#/plans';
  track('purchase_completed');
  return data;
}

export async function analyzeLabel(blobs) {
  if (isDemo()) throw new Error('demo');
  const images = await Promise.all(blobs.map(async (b) => ({ data: await blobToBase64(b), media_type: 'image/jpeg' })));
  const data = await api('/api/label/analyze', { method: 'POST', body: JSON.stringify({ images, lang: getState().lang }) });
  track('ai_used');
  return data.product;
}

// ---------- PromptPay QR (EMVCo) ----------
const f = (id, v) => id + String(v.length).padStart(2, '0') + v;
function crc16(s) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}
export function promptPayPayload(id, amount) {
  const digits = String(id).replace(/\D/g, '');
  const target = digits.length >= 13 ? f('02', digits) : f('01', ('0000000000000' + digits.replace(/^0/, '66')).slice(-13));
  let p = f('00', '01') + f('01', amount ? '12' : '11') + f('29', f('00', 'A000000677010111') + target) + f('53', '764') + f('58', 'TH');
  if (amount) p += f('54', Number(amount).toFixed(2));
  p += '6304';
  return p + crc16(p);
}

let qrLib;
export async function qrSVG(text) {
  if (!qrLib) {
    qrLib = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
      s.onload = () => res(window.qrcode);
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const qrcode = await qrLib;
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
}

export async function askCoach(kind, input) {
  if (isDemo()) throw new Error('AI requires a configured API');
  const data = await api('/api/ai/' + kind, { method: 'POST', body: JSON.stringify(input) });
  track('ai_used');
  return data.review;
}

export async function createQuote(productId,currency,promo=''){const r=await accountAPI('quote',{productId,currency,...(promo?{promo}: {})});track('purchase_started');return r;}
export async function claimQuote(quote){const r=await accountAPI('orders/claim',{orderId:quote.orderId});if(r.entitlement)applyEntitlement(r.entitlement,r.token,'promo');track('purchase_completed');return r;}
