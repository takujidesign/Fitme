import { z } from 'zod/v4';
import {verifyTOTP} from './totp.js';
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
export async function adminLogin(req, env) {
  await limit(req, env, 'admin', false);
  const {password,totp} = await input(req, z.object({password:z.string().max(4096),totp:z.string().regex(/^(?:\d{6}|[a-f0-9]{20})$/).optional()}).strict());
  const secret=await getSecret(env,'adminTotpSecret');
  let secondFactor=!secret;
  if(env.ADMIN_PASSWORD&&await equal(password,env.ADMIN_PASSWORD)&&secret){secondFactor=await verifyTOTP(secret,totp);if(!secondFactor&&!env.ADMIN_TOTP_SECRET&&/^[a-f0-9]{20}$/.test(totp||'')){secondFactor=!!(await env.DB.prepare('DELETE FROM admin_recovery WHERE code_hash=? RETURNING code_hash').bind(await hash(totp)).first());}}
  if (!env.ADMIN_PASSWORD || !await equal(password, env.ADMIN_PASSWORD) || !secondFactor) {
    await limit.fail(req, env);
    throw fail('Unauthorized', 401);
  }
  const token = random(), expires = Date.now() + 7200000;
    await env.CONFIG.put('admin-session:' + await hash(token), JSON.stringify({expires,created:Date.now()}), {expirationTtl:7200});
  return {token, expires};
}
export async function admin(req, env) {
  const token = (req.headers.get('Authorization') || '').match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  const session = token && await env.CONFIG?.get('admin-session:' + await hash(token), 'json');
  if (!session || !Number.isFinite(session.expires) || session.expires <= Date.now()) throw fail('Unauthorized', 401);
    const revoked=Number(await env.CONFIG.get('admin-revoked-before'))||0;
    if((session.created??session.expires-7200000)<=revoked)throw fail('Session revoked',401);
}
export async function adminLogout(req, env) {
  await admin(req, env);
  await env.CONFIG.delete('admin-session:' + await hash(req.headers.get('Authorization').slice(7)));
  return {ok:true};
}
export const secretNames = { adminTotpSecret:'ADMIN_TOTP_SECRET',turnstileSecret:'TURNSTILE_SECRET', stripeWebhookSecret:'STRIPE_WEBHOOK_SECRET',resendApiKey:'RESEND_API_KEY', lineChannelSecret: 'LINE_CHANNEL_SECRET', lineMessagingToken: 'LINE_MESSAGING_TOKEN', thunderApiKey: 'THUNDER_API_KEY', stripeSecretKey: 'STRIPE_SECRET_KEY', anthropicApiKey: 'ANTHROPIC_API_KEY', vapidPublicKey: 'VAPID_PUBLIC_KEY', vapidPrivateKey: 'VAPID_PRIVATE_KEY' };
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
  return Object.fromEntries(await Promise.all(Object.keys(secretNames).map(async name => { const value = await getSecret(env, name); if(name==='adminTotpSecret')return [name,{set:!!value}]; return [name, { set: !!value, last4: value ? value.slice(-4) : '' }]; })));
}
export async function saveSecrets(req, env) {
  await admin(req, env);
  const body = await input(req, z.object(Object.fromEntries(Object.keys(secretNames).map(k => [k, z.string().max(4096).optional()]))).strict(), 25000);
  if(Object.hasOwn(body,'adminTotpSecret'))throw fail('Use the 2FA enrolment endpoint',403);
  const saved = await env.CONFIG.get('secrets', 'json') || {};
  for (const [name, value] of Object.entries(body)) { if (value) saved[name] = await encrypt(env, name, value); else delete saved[name]; }
  await env.CONFIG.put('secrets', JSON.stringify(saved));
  return { secrets: await secretStatus(env) };
}
export async function testSecret(req, env) {
  await admin(req, env);
  const { service } = await input(req, z.object({ service: z.enum(['stripe', 'anthropic', 'thunder', 'vapid', 'line', 'resend']) }).strict());
  if (service === 'vapid') {
    const pub = await getSecret(env, 'vapidPublicKey'), priv = await getSecret(env, 'vapidPrivateKey');
    const bytes = Uint8Array.from(atob(pub.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const b64 = a => btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    try { await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: b64(bytes.slice(1,33)), y: b64(bytes.slice(33)), d: priv }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']); return { connected: true }; } catch { return { connected: false, message: 'Invalid VAPID key pair' }; }
  }
  const value = await getSecret(env, { stripe:'stripeSecretKey', anthropic:'anthropicApiKey', thunder:'thunderApiKey',line:'lineMessagingToken',resend:'resendApiKey' }[service]);
  if (!value) return { connected: false, message: 'Key not configured' };
  const urls = { stripe:'https://api.stripe.com/v1/balance', anthropic:'https://api.anthropic.com/v1/models', thunder:'https://api.thunder.in.th/v2/info',line:'https://api.line.me/v2/bot/info',resend:'https://api.resend.com/domains' };
  const res = await fetch(urls[service], { headers: service === 'anthropic' ? { 'x-api-key': value, 'anthropic-version': '2023-06-01' } : { Authorization: 'Bearer ' + value }, signal: AbortSignal.timeout(10000) });
  return { connected: res.ok, message: res.ok ? 'OK' : 'Service returned HTTP ' + res.status };
}
