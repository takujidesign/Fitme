import { z } from 'zod/v4';
export const fail = (message, status = 400, copy) => Object.assign(new Error(message), { status, copy, safe: true });
export const enc = new TextEncoder();
export const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
export const random = (n = 32) => hex(crypto.getRandomValues(new Uint8Array(n)));
export const hash = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
export async function equal(a, b) {
  const x = await hash(String(a)), y = await hash(String(b)); let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
export async function input(req, schema, max = 1048576) {
  const reader = req.body?.getReader(); if (!reader) throw fail('Missing body');
  const chunks = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > max) { await reader.cancel(); throw fail('Request too large', 413); } chunks.push(value); }
  const bytes = new Uint8Array(size); let at = 0; for (const c of chunks) { bytes.set(c, at); at += c.length; }
  try { return schema.parse(JSON.parse(new TextDecoder().decode(bytes))); } catch { throw fail('Invalid request'); }
}
const limitKey = async (req, email) => 'auth:' + await hash((req.headers.get('CF-Connecting-IP') || 'local') + ':' + email.toLowerCase()) + ':' + Math.floor(Date.now() / 900000);
// countAll=false: only failed attempts count (call limit.fail() on failure), so a busy admin is never locked out.
export async function limit(req, env, email = 'admin', countAll = true) {
  if (!env.CONFIG) throw fail('CONFIG KV is required', 503);
  const key = await limitKey(req, email);
  const n = Number(await env.CONFIG.get(key)) || 0;
  if (n >= 10) throw fail('Too many attempts; try again in 15 minutes', 429);
  if (countAll) await env.CONFIG.put(key, String(n + 1), { expirationTtl: 900 });
}
limit.fail = async (req, env, email = 'admin') => {
  const key = await limitKey(req, email);
  const n = Number(await env.CONFIG.get(key)) || 0;
  await env.CONFIG.put(key, String(n + 1), { expirationTtl: 900 });
};
export async function admin(req, env) {
  await limit(req, env, 'admin', false);
  if (!env.ADMIN_PASSWORD || !await equal(req.headers.get('Authorization') || '', 'Bearer ' + env.ADMIN_PASSWORD)) {
    await limit.fail(req, env);
    throw fail('Unauthorized', 401);
  }
}
export const secretNames = { stripeWebhookSecret:'STRIPE_WEBHOOK_SECRET',resendApiKey:'RESEND_API_KEY', lineChannelSecret: 'LINE_CHANNEL_SECRET', lineMessagingToken: 'LINE_MESSAGING_TOKEN', thunderApiKey: 'THUNDER_API_KEY', stripeSecretKey: 'STRIPE_SECRET_KEY', anthropicApiKey: 'ANTHROPIC_API_KEY', vapidPublicKey: 'VAPID_PUBLIC_KEY', vapidPrivateKey: 'VAPID_PRIVATE_KEY' };
async function key(env) {
  if (!env.MASTER_KEY || env.MASTER_KEY.length < 32) throw fail('MASTER_KEY must have at least 32 characters', 503);
  const material = await crypto.subtle.importKey('raw', enc.encode(env.MASTER_KEY), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('fitme-secrets-v1'), info: enc.encode('CONFIG/secrets') }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encrypt(env, name, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(name) }, await key(env), enc.encode(value)));
  return btoa(String.fromCharCode(...iv, ...cipher));
}
export async function decrypt(env, name, value) {
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData: enc.encode(name) }, await key(env), bytes.slice(12)));
}
export async function getSecret(env, name) {
  const binding = secretNames[name]; if (!binding) throw fail('Unknown secret');
  if (env[binding]) return env[binding];
  const saved = await env.CONFIG?.get('secrets', 'json');
  return saved?.[name] ? decrypt(env, name, saved[name]) : '';
}
export async function secretStatus(env) {
  return Object.fromEntries(await Promise.all(Object.keys(secretNames).map(async name => { const value = await getSecret(env, name); return [name, { set: !!value, last4: value ? value.slice(-4) : '' }]; })));
}
export async function saveSecrets(req, env) {
  await admin(req, env);
  const body = await input(req, z.object(Object.fromEntries(Object.keys(secretNames).map(k => [k, z.string().max(4096).optional()]))).strict(), 25000);
  const saved = await env.CONFIG.get('secrets', 'json') || {};
  for (const [name, value] of Object.entries(body)) { if (value) saved[name] = await encrypt(env, name, value); else delete saved[name]; }
  await env.CONFIG.put('secrets', JSON.stringify(saved));
  return { secrets: await secretStatus(env) };
}
export async function testSecret(req, env) {
  await admin(req, env);
  const { service } = await input(req, z.object({ service: z.enum(['stripe', 'anthropic', 'thunder', 'vapid']) }).strict());
  if (service === 'vapid') {
    const pub = await getSecret(env, 'vapidPublicKey'), priv = await getSecret(env, 'vapidPrivateKey');
    const bytes = Uint8Array.from(atob(pub.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const b64 = a => btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    try { await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: b64(bytes.slice(1,33)), y: b64(bytes.slice(33)), d: priv }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']); return { connected: true }; } catch { return { connected: false, message: 'Invalid VAPID key pair' }; }
  }
  const value = await getSecret(env, { stripe:'stripeSecretKey', anthropic:'anthropicApiKey', thunder:'thunderApiKey' }[service]);
  if (!value) return { connected: false, message: 'Key not configured' };
  const urls = { stripe:'https://api.stripe.com/v1/balance', anthropic:'https://api.anthropic.com/v1/models', thunder:'https://api.thunder.in.th/v2/info' };
  const res = await fetch(urls[service], { headers: service === 'anthropic' ? { 'x-api-key': value, 'anthropic-version': '2023-06-01' } : { Authorization: 'Bearer ' + value }, signal: AbortSignal.timeout(10000) });
  return { connected: res.ok, message: res.ok ? 'OK' : 'Service returned HTTP ' + res.status };
}
