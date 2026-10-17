import { z } from 'zod/v4';
import { admin, input, fail, random, hash, getSecret, limit } from './security.js';
import { user, query as q } from './accounts.js';
import { dueReminders, b64 } from './push.js';

const token = z.string().regex(/^[a-f0-9]{64}$/);
const challenge = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const pkce = async value => b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
const Settings = z.object({lineChannelId:z.string().regex(/^\d{1,30}$/),appUrl:z.string().url().max(2048),dailyCap:z.number().int().min(0).max(100)}).strict();
export const lineSettings = async env => ({dailyCap:3,...await env.CONFIG?.get('line','json')});
function appURL(value, env) {
  const u=new URL(value),allowed=(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim());
  if(u.protocol!=='https:'||u.username||u.password||!allowed.includes(u.origin))throw fail('App URL must use an allowed HTTPS origin');
  u.search='';u.hash='';return u.href;
}
const redirect = url => new Response(null,{status:302,headers:{Location:url,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
async function linePost(path, params) {
  const r=await fetch('https://api.line.me/oauth2/v2.1/'+path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw fail('LINE authentication failed',401);return r.json();
}
// https://developers.line.biz/en/docs/line-login/integrate-pkce/
// Browser PKCE binds the one-time app code; provider PKCE and nonce bind the LINE exchange.
export async function lineAuth(req,env,path) {
  const url=new URL(req.url),settings=await lineSettings(env),now=Date.now();
  if(path==='/api/admin/line') {
    await admin(req,env);
    if(req.method==='GET')return {settings,usage:(await q(env,'SELECT day,count(*) AS count FROM line_deliveries GROUP BY day ORDER BY day DESC LIMIT 30').all()).results};
    if(req.method!=='PUT')throw fail('Method not allowed',405);
    const b=await input(req,Settings);b.appUrl=appURL(b.appUrl,env);await env.CONFIG.put('line',JSON.stringify(b));return {};
  }
  if(path.endsWith('/exchange')&&req.method==='POST') {
    const b=await input(req,z.object({code:token,verifier:token}).strict());
    const row=await q(env,'DELETE FROM line_codes WHERE code_hash=? AND challenge=? AND expires_at>? RETURNING user_id,line_user_id',await hash(b.code),await pkce(b.verifier),now).first();
    if(!row)throw fail('Invalid or expired LINE code',401);
    if(row.line_user_id){const linked=await q(env,'UPDATE users SET line_user_id=? WHERE id=? AND (line_user_id IS NULL OR line_user_id=?)',row.line_user_id,row.user_id,row.line_user_id).run();if(!linked.meta.changes)throw fail('Account already linked',409);}
    const u=await q(env,'SELECT id,email,role,line_user_id FROM users WHERE id=?',row.user_id).first(),session=random();
    await q(env,'INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',await hash(session),u.id,now+30*86400000).run();return {token:session,user:u};
  }
  if(!settings.lineChannelId||!settings.appUrl)throw fail('LINE Login is not configured',503);
  if(path.endsWith('/link')&&req.method==='POST') {
    const u=await user(req,env),b=await input(req,z.object({challenge}).strict()),ticket=random();
    await q(env,'INSERT INTO line_flows VALUES(?,?,?)',ticket,JSON.stringify({userId:u.id,challenge:b.challenge}),now+300000).run();
    return {url:url.origin+'/api/auth/line/start?ticket='+ticket};
  }
  if(path.endsWith('/start')&&req.method==='GET') {
    await limit(req,env,'line');
    const b=z.object({challenge:challenge.optional(),ticket:token.optional()}).strict().parse(Object.fromEntries(url.searchParams));
    let link=null;
    if(b.ticket){const row=await q(env,'DELETE FROM line_flows WHERE state=? AND expires_at>? RETURNING json',b.ticket,now).first();if(!row)throw fail('Expired link');link=JSON.parse(row.json);}
    const clientChallenge=link?.challenge||b.challenge;if(!clientChallenge)throw fail('PKCE challenge required');
    const state=random(),verifier=random(),nonce=random(),callback=(env.API_URL||url.origin).replace(/\/$/,'')+'/api/auth/line/callback';
    await q(env,'INSERT INTO line_flows VALUES(?,?,?)',state,JSON.stringify({verifier,nonce,callback,challenge:clientChallenge,userId:link?.userId||null}),now+600000).run();
    const target=new URL('https://access.line.me/oauth2/v2.1/authorize');target.search=new URLSearchParams({response_type:'code',client_id:settings.lineChannelId,redirect_uri:callback,state,scope:'openid profile',nonce,code_challenge:await pkce(verifier),code_challenge_method:'S256',bot_prompt:'aggressive'}).toString();return redirect(target.href);
  }
  if(path.endsWith('/callback')&&req.method==='GET') {
    const b=z.object({state:token,code:z.string().min(1).max(2048)}).parse(Object.fromEntries(url.searchParams));
    const row=await q(env,'DELETE FROM line_flows WHERE state=? AND expires_at>? RETURNING json',b.state,now).first();if(!row)throw fail('Invalid OAuth state',401);
    const flow=JSON.parse(row.json),result=await linePost('token',{grant_type:'authorization_code',code:b.code,redirect_uri:flow.callback,client_id:settings.lineChannelId,client_secret:await getSecret(env,'lineChannelSecret'),code_verifier:flow.verifier});
    const identity=await linePost('verify',{id_token:result.id_token,client_id:settings.lineChannelId,nonce:flow.nonce});
    if(identity.iss!=='https://access.line.me'||identity.aud!==settings.lineChannelId||identity.nonce!==flow.nonce||identity.exp*1000<=now||!/^U[a-f0-9]{32}$/.test(identity.sub))throw fail('Invalid LINE identity',401);
    let u=await q(env,'SELECT id FROM users WHERE line_user_id=?',identity.sub).first();
    if(flow.userId){if(u&&u.id!==flow.userId)throw fail('LINE is already linked to another account',409);u=await q(env,'SELECT id FROM users WHERE id=? AND (line_user_id IS NULL OR line_user_id=?)',flow.userId,identity.sub).first();if(!u)throw fail('Account already linked',409);}
    if(!u){u={id:crypto.randomUUID()};await q(env,'INSERT INTO users(id,email,pass_hash,pass_salt,created_at,line_user_id) VALUES(?,?,?,?,?,?)',u.id,identity.sub+'@line.invalid',random(),random(16),now,identity.sub).run();}
    const code=random();await q(env,'INSERT INTO line_codes VALUES(?,?,?,?,?)',await hash(code),u.id,flow.challenge,flow.userId?identity.sub:null,now+60000).run();
    return redirect(appURL(env.APP_URL||settings.appUrl,env)+'#/line-return?code='+code);
  }
  throw fail('Not found',404);
}
const Reminder=z.object({date:z.string().date(),time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),title:z.string().max(120),body:z.string().max(500),route:z.enum(['#/today','#/food','#/workout','#/supps','#/me'])}).strict();
export async function lineReminders(req,env) {
  const u=await user(req,env);if(req.method!=='PUT')throw fail('Method not allowed',405);
  const b=await input(req,z.object({tz:z.string().max(100),reminders:z.array(Reminder).max(300)}).strict(),200000);
  try{new Intl.DateTimeFormat('en',{timeZone:b.tz}).format();}catch{throw fail('Invalid timezone');}
  if(!await q(env,'SELECT id FROM users WHERE id=? AND line_user_id IS NOT NULL',u.id).first())throw fail('Link LINE first');
  await q(env,'INSERT INTO line_reminders VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET json=excluded.json,expires_at=excluded.expires_at',u.id,JSON.stringify(b),Date.now()+8*86400000).run();return {};
}
export async function sendLine(env,now=Date.now()) {
  if(!env.DB)return;const messaging=await getSecret(env,'lineMessagingToken');if(!messaging)return;
  const settings=await lineSettings(env);if(!settings.dailyCap)return;
  const records=(await q(env,'SELECT line_reminders.*,users.line_user_id FROM line_reminders JOIN users ON users.id=user_id WHERE expires_at>? AND line_user_id IS NOT NULL',now).all()).results;
  for(const record of records){const plan=JSON.parse(record.json);for(const {r} of dueReminders(plan,now)){
    const key=await hash(JSON.stringify(r));
    // Reserve before sending: retries/crons cannot exceed the paid-message cap or duplicate an ambiguous send.
    const reserved=await q(env,'INSERT OR IGNORE INTO line_deliveries(user_id,day,event) SELECT ?,?,? WHERE (SELECT count(*) FROM line_deliveries WHERE user_id=? AND day=?)<?',record.user_id,r.date,key,record.user_id,r.date,settings.dailyCap).run();
    if(!reserved.meta.changes)continue;
    try{await fetch('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{Authorization:'Bearer '+messaging,'Content-Type':'application/json'},body:JSON.stringify({to:record.line_user_id,messages:[{type:'text',text:r.title+'\n'+r.body}]}),signal:AbortSignal.timeout(10000)});}catch{}
  }}
  await q(env,'DELETE FROM line_deliveries WHERE day<?',new Date(now-31*86400000).toISOString().slice(0,10)).run();
  await q(env,'DELETE FROM line_flows WHERE expires_at<?',now).run();await q(env,'DELETE FROM line_codes WHERE expires_at<?',now).run();
}
