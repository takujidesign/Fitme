// FitMe runtime configuration.
// API_BASE: URL of the deployed Cloudflare Worker (see /worker). Leave empty to run in demo mode:
// payments are simulated and AI label reading is disabled.
export const CONFIG = {
  API_BASE: '',
  // PromptPay receiver (mobile number 0812345678 or 13-digit tax ID). Used to build the payment QR.
  PROMPTPAY_ID: '0812345678',
  PROMPTPAY_NAME: 'FitMe',
  PRODUCTS: {
    export1: { thb: 49, usd: 1.49, days: 0, exports: 1, th: 'ดาวน์โหลดแผน 1 ครั้ง', en: 'One plan download',
      descTh: 'PDF + ปฏิทินแจ้งเตือน (.ics) ของแผนปัจจุบัน', descEn: 'PDF + calendar reminders (.ics) of your current plan' },
    pro30: { thb: 99, usd: 2.99, days: 30, exports: 99, th: 'FitMe Pro 30 วัน', en: 'FitMe Pro · 30 days',
      descTh: 'แผนเต็มทุกวัน · อาหารเสริมไม่จำกัด · AI อ่านฉลาก · ดาวน์โหลดไม่จำกัด', descEn: 'Full plan · unlimited supplements · AI label reader · unlimited downloads' },
    pro90: { thb: 249, usd: 6.99, days: 90, exports: 999, th: 'FitMe Pro 90 วัน', en: 'FitMe Pro · 90 days',
      descTh: 'คุ้มที่สุด เฉลี่ย ฿2.7/วัน', descEn: 'Best value, about $0.08/day', best: true },
  },
  FREE_PLAN_DAYS: 3,
  FREE_SUPPLEMENTS: 2,
};

export const isDemo = () => !CONFIG.API_BASE;

const fields = { promptpayId: 'PROMPTPAY_ID', promptpayName: 'PROMPTPAY_NAME', receiverName: 'RECEIVER_NAME', products: 'PRODUCTS', freePlanDays: 'FREE_PLAN_DAYS', freeSupplements: 'FREE_SUPPLEMENTS' };
export function mergeConfig(config) {
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
