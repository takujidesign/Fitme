import {betaDefaults} from './beta-policy.js';
// Fixmee runtime configuration.
// API_BASE: URL of the deployed Cloudflare Worker (see /worker). Leave empty to run in demo mode:
// payments are simulated and AI label reading is disabled.
export const CONFIG = {
  beta: betaDefaults(),
  launch:{languages:{th:true,en:true,zh:false,ja:false,vi:false},turnstileSiteKey:'',verification:false},
  freeMode: true, aiEngines: {claude:true}, donate: {wiseUrl:'',stripeUrl:''},
  CONTACT_EMAIL: '', REFERRAL_DAYS: 7, TRAINER_SHARE: 70,
  API_BASE: 'https://api.fixmee.app',
  // PromptPay receiver (mobile number 0812345678 or 13-digit tax ID). Used to build the payment QR.
  PROMPTPAY_ID: '0812345678',
  PROMPTPAY_NAME: 'Fixmee',
  AI: { prices:{chat:1,labelRead:1,planReview:2,mealPhoto:3,bodyReview:3}, credits:{trial:10,period:60,topup:40,topupDays:90} },
  PRODUCTS: {
    credits40: {thb:49,usd:1.49,days:0,exports:0,th:'เติมเครดิต AI',en:'AI credit top-up',descTh:'เครดิต AI เพิ่มเติม',descEn:'Extra AI credits'},
    export1: { thb: 49, usd: 1.49, days: 0, exports: 1, th: 'ดาวน์โหลดแผน 1 ครั้ง', en: 'One plan download',
      descTh: 'PDF + ปฏิทินแจ้งเตือน (.ics) ของแผนปัจจุบัน', descEn: 'PDF + calendar reminders (.ics) of your current plan' },
    pro30: { thb: 99, usd: 2.99, days: 30, exports: 99, th: 'Fixmee Pro 30 วัน', en: 'Fixmee Pro · 30 days',
      descTh: 'แผนเต็มทุกวัน · อาหารเสริมไม่จำกัด · AI อ่านฉลาก · ดาวน์โหลดไม่จำกัด', descEn: 'Full plan · unlimited supplements · AI label reader · unlimited downloads' },
    pro90: { thb: 249, usd: 6.99, days: 90, exports: 999, th: 'Fixmee Pro 90 วัน', en: 'Fixmee Pro · 90 days',
      descTh: 'คุ้มที่สุด เฉลี่ย ฿2.7/วัน', descEn: 'Best value, about $0.08/day', best: true },
  },
  FREE_PLAN_DAYS: 3,
  FREE_SUPPLEMENTS: 2,
};

export const isDemo = () => !CONFIG.API_BASE;

const fields = { freeMode:'freeMode', aiEngines:'aiEngines', donate:'donate', promptpayId: 'PROMPTPAY_ID', promptpayName: 'PROMPTPAY_NAME', receiverName: 'RECEIVER_NAME', products: 'PRODUCTS', freePlanDays: 'FREE_PLAN_DAYS', freeSupplements: 'FREE_SUPPLEMENTS' };
export function mergeConfig(config) {
  if(config.beta)CONFIG.beta={...betaDefaults(),...config.beta};
  if(config.launch)CONFIG.launch=config.launch;
  if(config.ai)CONFIG.AI=config.ai;
  for(const [k,v] of Object.entries({contactEmail:'CONTACT_EMAIL',referralDays:'REFERRAL_DAYS',trainerShare:'TRAINER_SHARE'}))if(config[k]!==undefined)CONFIG[v]=config[k];
  if (config.vapidPublicKey !== undefined) CONFIG.VAPID_PUBLIC_KEY = config.vapidPublicKey;
  for (const [key, target] of Object.entries(fields)) if (config[key] !== undefined) CONFIG[target] = config[key];
}
export function currentConfig() {
  return Object.fromEntries(Object.entries(fields).map(([key, target]) => [key, CONFIG[target] ?? '']));
}
export async function loadConfig() {
  if (!CONFIG.API_BASE) return;
  const key = 'fitme:config:' + CONFIG.API_BASE;
  try { const cached = JSON.parse(localStorage.getItem(key)); if (cached) mergeConfig(cached); } catch {}
  try {
    const res = await fetch(CONFIG.API_BASE.replace(/\/$/, '') + '/api/config', { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (!res.ok || !data.config) return;
    mergeConfig(data.config);
    try { localStorage.setItem(key, JSON.stringify(data.config)); } catch {}
  } catch { /* Offline: keep cached settings or defaults. */ }
}
