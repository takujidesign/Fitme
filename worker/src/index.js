// FitMe API — Cloudflare Worker
//   POST /api/slip/verify      PromptPay slip check via Thunder API → entitlement token
//   POST /api/stripe/checkout  create a Stripe Checkout session
//   GET  /api/stripe/confirm   confirm a paid session → entitlement token
//   POST /api/label/analyze    read a supplement label with Claude (Pro token required)
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

// Keep in sync with app/js/config.js
const PRODUCTS = {
  export1: { thb: 49, usd: 1.49, days: 0, name: 'FitMe – plan download' },
  pro30: { thb: 99, usd: 2.99, days: 30, name: 'FitMe Pro – 30 days' },
  pro90: { thb: 249, usd: 6.99, days: 90, name: 'FitMe Pro – 90 days' },
};

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(req.url);
    try {
      let out;
      if (req.method === 'POST' && url.pathname === '/api/slip/verify') out = await verifySlip(await req.json(), env);
      else if (req.method === 'POST' && url.pathname === '/api/stripe/checkout') out = await stripeCheckout(await req.json(), env);
      else if (req.method === 'GET' && url.pathname === '/api/stripe/confirm') out = await stripeConfirm(url.searchParams.get('session_id'), env);
      else if (req.method === 'POST' && url.pathname === '/api/label/analyze') out = await analyzeLabel(req, env);
      else return json({ ok: false, error: 'not found' }, 404, cors);
      return json({ ok: true, ...out }, 200, cors);
    } catch (e) {
      return json({ ok: false, error: e.message || 'error' }, e.status || 400, cors);
    }
  },
};

const json = (body, status, headers) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    'Access-Control-Allow-Origin': allowed.length === 0 || allowed.includes(origin) ? origin || '*' : allowed[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
}
const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });

// ---------- entitlement tokens (HMAC-SHA256) ----------
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
async function hmacKey(env) {
  if (!env.TOKEN_SECRET) throw fail('server not configured: TOKEN_SECRET', 500);
  return crypto.subtle.importKey('raw', new TextEncoder().encode(env.TOKEN_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function issue(env, pid, ref) {
  const prod = PRODUCTS[pid];
  const until = prod.days ? new Date(Date.now() + prod.days * 86400000).toISOString() : null;
  const payload = { pid, ref, until, iat: Date.now() };
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = b64url(await crypto.subtle.sign('HMAC', await hmacKey(env), new TextEncoder().encode(body)));
  return { token: `${body}.${sig}`, entitlement: { pid, ref, until } };
}
async function verifyToken(env, token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(env), fromB64url(sig), new TextEncoder().encode(body));
  return ok ? JSON.parse(new TextDecoder().decode(fromB64url(body))) : null;
}

// ---------- PromptPay slip via Thunder ----------
async function verifySlip({ productId, image }, env) {
  const prod = PRODUCTS[productId];
  if (!prod) throw fail('unknown product');
  if (!image || image.length > 8_000_000) throw fail('missing or oversized slip image');
  if (!env.THUNDER_API_KEY) throw fail('server not configured: THUNDER_API_KEY', 500);
  const res = await fetch(env.THUNDER_API_URL || 'https://api.thunder.in.th/v2/verify/bank', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.THUNDER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64: image, checkDuplicate: true, matchAmount: prod.thb }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw fail(data.error?.message || data.message || 'slip not verified');
  const slip = data.data?.rawSlip || {};
  if (data.data?.isDuplicate) throw fail('this slip has already been used');
  const amount = Number(slip.amount?.amount ?? 0);
  if (amount + 0.001 < prod.thb) throw fail(`amount ${amount} is less than ${prod.thb} THB`);
  if (env.RECEIVER_NAME) {
    const names = [slip.receiver?.account?.name?.th, slip.receiver?.account?.name?.en].filter(Boolean).join(' ').toLowerCase();
    const wanted = env.RECEIVER_NAME.toLowerCase().split('|');
    if (!wanted.some((w) => names.includes(w.trim()))) throw fail('receiver does not match');
  }
  // Optional extra replay guard when a KV namespace is bound.
  if (env.SLIPS && slip.transRef) {
    if (await env.SLIPS.get(slip.transRef)) throw fail('this slip has already been used');
    await env.SLIPS.put(slip.transRef, productId, { expirationTtl: 60 * 60 * 24 * 400 });
  }
  return issue(env, productId, slip.transRef || null);
}

// ---------- Stripe ----------
async function stripe(env, path, params, method = 'POST') {
  if (!env.STRIPE_SECRET_KEY) throw fail('server not configured: STRIPE_SECRET_KEY', 500);
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'POST' ? new URLSearchParams(params) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw fail(data.error?.message || 'stripe error');
  return data;
}
async function stripeCheckout({ productId, currency, returnUrl }, env) {
  const prod = PRODUCTS[productId];
  if (!prod) throw fail('unknown product');
  const cur = currency === 'thb' ? 'thb' : 'usd';
  const base = safeReturn(returnUrl, env);
  const sep = base.includes('?') ? '&' : '?';
  const session = await stripe(env, 'checkout/sessions', {
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': cur,
    'line_items[0][price_data][unit_amount]': String(Math.round((cur === 'thb' ? prod.thb : prod.usd) * 100)),
    'line_items[0][price_data][product_data][name]': prod.name,
    'metadata[pid]': productId,
    success_url: `${base}${sep}paid={CHECKOUT_SESSION_ID}`,
    cancel_url: base,
  });
  return { url: session.url };
}
function safeReturn(u, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const url = new URL(u);
  if (allowed.length && !allowed.includes(url.origin)) throw fail('return URL not allowed');
  return url.origin + url.pathname;
}
async function stripeConfirm(sessionId, env) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId || '')) throw fail('bad session id');
  const s = await stripe(env, `checkout/sessions/${sessionId}`, null, 'GET');
  if (s.payment_status !== 'paid') throw fail('payment not completed');
  const pid = s.metadata?.pid;
  if (!PRODUCTS[pid]) throw fail('unknown product');
  return issue(env, pid, sessionId);
}

// ---------- Supplement label reading with Claude ----------
const Doses = z.object({
  morning: z.number(), breakfast: z.number(), lunch: z.number(), afternoon: z.number(),
  pre: z.number(), post: z.number(), dinner: z.number(), night: z.number(),
});
const Bi = z.object({ th: z.string(), en: z.string() });
const Product = z.object({
  isSupplement: z.boolean(),
  name: Bi,
  brand: z.string(),
  category: z.enum(['creatine', 'protein', 'carnitine', 'multi', 'bcomplex', 'collagen', 'antioxidant', 'other']),
  unit: Bi,
  perContainer: z.number(),
  nutrition: z.object({ k: z.number(), p: z.number(), c: z.number(), f: z.number() }),
  loadingDays: z.number(),
  note: Bi,
  rules: z.array(z.object({
    wMin: z.number().nullable(), wMax: z.number().nullable(),
    day: z.enum(['train', 'rest', 'any']), phase: z.enum(['loading', 'maint', 'any']),
    doses: Doses,
  })),
});

const SYSTEM = `You read photos of dietary-supplement labels (often Thai and English) and convert the printed directions into a dosing schedule for a fitness app.
Slots: morning (on waking), breakfast (after breakfast), lunch, afternoon, pre (pre-workout), post (post-workout), dinner (after dinner), night (before bed). Amounts are in the product's serving unit (scoop, capsule, tablet); use 0 for slots without a dose.
If the label has a chart by body weight and/or training vs non-training days and/or loading vs maintenance phase, output one rule per column/phase combination with wMin/wMax in kg (wMax inclusive, null when open-ended). "Non-training" maps to day "rest". If there is only a simple instruction such as "1 capsule daily after a meal", output a single rule with day "any" and phase "any" and pick the slot the label implies (after a meal → breakfast unless stated otherwise).
nutrition is per serving: k = kcal, p/c/f = grams of protein/carbs/fat (0 if not printed). perContainer = servings per pack. loadingDays = length of a loading phase, else 0.
note: one short sentence of the key directions and warnings, in Thai (th) and English (en). Report only what is printed on the label; never invent doses. If the photo is not a supplement label, set isSupplement to false.`;

async function analyzeLabel(req, env) {
  const auth = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const ent = await verifyToken(env, auth);
  if (!ent?.until || new Date(ent.until) < new Date()) throw fail('Pro membership required', 402);
  const { images } = await req.json();
  if (!Array.isArray(images) || !images.length || images.length > 3) throw fail('send 1-3 images');
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const response = await client.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: 'medium', format: zodOutputFormat(Product) },
    messages: [{
      role: 'user',
      content: [
        ...images.map((img) => ({ type: 'image', source: { type: 'base64', media_type: img.media_type || 'image/jpeg', data: img.data } })),
        { type: 'text', text: 'Read this supplement label and return the dosing schedule.' },
      ],
    }],
  });
  if (response.stop_reason === 'refusal') throw fail('could not read this label');
  const product = response.parsed_output;
  if (!product) throw fail('could not read this label');
  if (!product.isSupplement) throw fail('this does not look like a supplement label');
  // drop zero doses so the app's schedule stays clean
  product.rules = product.rules.map((r) => ({ ...r, doses: Object.fromEntries(Object.entries(r.doses).filter(([, v]) => v > 0)) })).filter((r) => Object.keys(r.doses).length);
  if (!product.rules.length) throw fail('no dosing directions found on the label');
  return { product: { ...product, color: '#19E3C4' } };
}
