import {validEndpoint,encryptPush,vapidJWT} from './push.js';
import {z} from 'zod/v4';
import {input,fail,hash,random,getSecret,admin,encrypt,equal} from './security.js';
import {query as q,user,passwordHash} from './accounts.js';
import {verifyTOTP} from './totp.js';
const email=z.string().trim().toLowerCase().email().max(254),password=z.string().min(10).max(256);
export const genericMessage='Check your email for the next step.';
export async function cap(env,scope,value,max,window){
 const now=Date.now(),key=scope+':'+await hash(value)+':'+Math.floor(now/window);
 await q(env,'DELETE FROM security_limits WHERE expires<?',now).run();
 await q(env,'DELETE FROM auth_tokens WHERE expires<=?',now).run();
 const r=await q(env,'INSERT INTO security_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<?',key,now+window,max).run();
 if(!r.meta.changes)throw fail('Too many attempts; try again later',429);
}
export const ip=req=>req.headers.get('CF-Connecting-IP')||'local';
export async function mailReady(env){return !!await getSecret(env,'resendApiKey');}
export async function sendMail(env,to,subject,text){
 const key=await getSecret(env,'resendApiKey'),s=await env.CONFIG?.get('growth','json')||{};
 if(!key||!s.emailFrom)throw fail('Email sender is not configured',503);
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from:s.emailFrom,to:[to],subject,text}),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw fail('Email delivery unavailable',503);
}
export async function sendToken(env,u,kind){
 const token=random(32),expires=Date.now()+(kind==='reset'?1800000:86400000),settings=await env.CONFIG?.get('growth','json')||{};
 await env.DB.batch([q(env,'DELETE FROM auth_tokens WHERE user_id=? AND kind=?',u.id,kind),q(env,'INSERT INTO auth_tokens VALUES(?,?,?,?)',await hash(token),u.id,kind,expires)]);
 await sendMail(env,u.email,kind==='reset'?'Reset your Fixmee password':'Verify your Fixmee email',`${settings.appUrl||'https://fixmee.app'}/#/${kind}/${token}\nThis link is single-use.`);
}
export async function verified(env,u){
 if(await mailReady(env)&&!(await q(env,'SELECT verified FROM email_verifications WHERE user_id=?',u.id).first())?.verified)throw fail('Verify your email first',403);
}
export async function turnstile(req,env){
 const settings=await env.CONFIG?.get('launch','json')||{},secret=await getSecret(env,'turnstileSecret');
 if(!settings.turnstileSiteKey||!secret)return;
 const response=req.headers.get('X-Turnstile-Token');if(!response||response.length>2048)throw fail('Complete the security check',403);
 const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret,response,remoteip:ip(req)}),signal:AbortSignal.timeout(10000)});
 if(!r.ok||!(await r.json()).success)throw fail('Security check failed',403);
}
export async function authSecurity(req,env,path){
 if(path==='/api/auth/forgot'){
  if(req.method!=='POST')throw fail('Method not allowed',405);
  const b=await input(req,z.object({email}).strict());await turnstile(req,env);
  await cap(env,'forgot-ip',ip(req),10,3600000);await cap(env,'forgot-email',b.email,3,3600000);
  const u=await q(env,'SELECT id,email FROM users WHERE email=?',b.email).first();
  if(u&&await mailReady(env))try{await sendToken(env,u,'reset');}catch{/* Same response on delivery failure, without exposing existence. */}
  return {message:genericMessage};
 }
 if(['/api/auth/reset','/api/auth/verify'].includes(path)){
  if(req.method!=='POST')throw fail('Method not allowed',405);
  await cap(env,'token-ip',ip(req),20,900000);
  const reset=path.endsWith('/reset'),b=await input(req,z.object({token:z.string().regex(/^[a-f0-9]{64}$/),...(reset?{password}:{})}).strict()),digest=await hash(b.token);
  // All mutations and token consumption are in one D1 transaction. Concurrent replays cannot change a password twice.
  const kind=reset?'reset':'verify',now=Date.now(),lookup='SELECT user_id FROM auth_tokens WHERE token_hash=? AND kind=? AND expires>?';
  let ops;
  if(reset){const salt=random(16);ops=[q(env,`UPDATE users SET pass_hash=?,pass_salt=? WHERE id=(${lookup})`,await passwordHash(b.password,salt),salt,digest,kind,now),q(env,`DELETE FROM sessions WHERE user_id=(${lookup})`,digest,kind,now)];}
  else ops=[q(env,`INSERT INTO email_verifications SELECT user_id,1 FROM auth_tokens WHERE token_hash=? AND kind=? AND expires>? ON CONFLICT(user_id) DO UPDATE SET verified=1`,digest,kind,now)];
  ops.push(q(env,'DELETE FROM auth_tokens WHERE token_hash=? AND kind=? AND expires>?',digest,kind,now));
  const results=await env.DB.batch(ops);if(!results[0].meta.changes)throw fail('Link expired or already used',400);
  return {message:reset?'Password changed. Please log in.':'Email verified.'};
 }
 const u=await user(req,env),tokenHash=await hash((req.headers.get('Authorization')||'').slice(7));
 if(path==='/api/auth/resend'&&req.method==='POST'){
  await input(req,z.object({}).strict());await cap(env,'verify-email',u.id,3,3600000);
  if(await mailReady(env))await sendToken(env,u,'verify');return {message:genericMessage};
 }
 if(path==='/api/auth/sessions'&&req.method==='GET')return {sessions:(await q(env,'SELECT s.token_hash,a.created,a.last_used,a.family,s.expires_at FROM sessions s LEFT JOIN session_activity a ON a.token_hash=s.token_hash WHERE s.user_id=? AND s.expires_at>?',u.id,Date.now()).all()).results.map(({token_hash,...s})=>({...s,current:token_hash===tokenHash}))};
 if(path==='/api/auth/logout-all'&&req.method==='POST'){await input(req,z.object({}).strict());await q(env,'DELETE FROM sessions WHERE user_id=?',u.id).run();return {};}
 if(path==='/api/auth/password'&&req.method==='POST'){
  const b=await input(req,z.object({currentPassword:password,password}).strict());await cap(env,'password',u.id,5,900000);
  const row=await q(env,'SELECT pass_hash,pass_salt FROM users WHERE id=?',u.id).first();
  if(!await equal(await passwordHash(b.currentPassword,row.pass_salt),row.pass_hash))throw fail('Current password is incorrect',403);
  const salt=random(16);await env.DB.batch([q(env,'UPDATE users SET pass_hash=?,pass_salt=? WHERE id=?',await passwordHash(b.password,salt),salt,u.id),q(env,'DELETE FROM sessions WHERE user_id=? AND token_hash<>?',u.id,tokenHash)]);return {};
 }
 throw fail('Not found',404);
}
export async function adminLaunch(req,env,path){
 await admin(req,env);
 if(path==='/api/admin/launch'){
  if(req.method==='PUT'){
   const b=await input(req,z.object({turnstileSiteKey:z.string().max(200).regex(/^[a-zA-Z0-9_-]*$/),languages:z.object({zh:z.boolean(),ja:z.boolean(),vi:z.boolean()}).strict()}).strict());await env.CONFIG.put('launch',JSON.stringify(b));
  }else if(req.method!=='GET')throw fail('Method not allowed',405);
  return {...await env.CONFIG.get('launch','json'),verification:await mailReady(env),turnstile:!!await getSecret(env,'turnstileSecret'),totp:!!await getSecret(env,'adminTotpSecret'),envTotp:!!env.ADMIN_TOTP_SECRET};
 }
 if(path==='/api/admin/2fa'){
  if(req.method!=='POST')throw fail('Method not allowed',405);
  await cap(env,'admin-2fa',ip(req),5,900000);
  const b=await input(req,z.object({secret:z.string().regex(/^[A-Z2-7]{32}$/).optional(),code:z.string().regex(/^\d{6}$/),disable:z.boolean().optional()}).strict());
  const existing=await getSecret(env,'adminTotpSecret');
  if(env.ADMIN_TOTP_SECRET)throw fail('Environment 2FA overrides browser settings',409);
  if(existing&&!b.disable)throw fail('Disable existing 2FA before enrolling again',409);
  if(!await verifyTOTP(existing||b.secret||'',b.code))throw fail('Invalid code',403);
  if(!existing&&!b.secret)throw fail('Secret required');
  const saved=await env.CONFIG.get('secrets','json')||{},codes=b.disable?[]:Array.from({length:8},()=>random(10));
  if(b.disable)delete saved.adminTotpSecret;else saved.adminTotpSecret=await encrypt(env,'adminTotpSecret',b.secret);
  await env.DB.batch([q(env,'DELETE FROM admin_recovery'),...await Promise.all(codes.map(async c=>q(env,'INSERT INTO admin_recovery VALUES(?)',await hash(c))))]);
  await env.CONFIG.put('secrets',JSON.stringify(saved));await env.CONFIG.put('admin-revoked-before',String(Date.now()));return {recoveryCodes:codes};
 }
 if(path==='/api/admin/test-push'&&req.method==='POST'){
  await cap(env,'test-push',ip(req),3,3600000);
  const {subscription}=await input(req,z.object({subscription:z.object({endpoint:z.string().url().max(4096),expirationTime:z.number().nullable().optional(),keys:z.object({p256dh:z.string().max(200),auth:z.string().max(100)}).strict()}).strict()}).strict());
  if(!validEndpoint(subscription.endpoint))throw fail('Invalid push endpoint');
  const response=await fetch(subscription.endpoint,{method:'POST',redirect:'error',headers:{TTL:'60','Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',Authorization:`vapid t=${await vapidJWT(subscription.endpoint,env)}, k=${await getSecret(env,'vapidPublicKey')}`},body:await encryptPush(subscription,{title:'Fixmee',body:'Test notification',route:'#/me'}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw fail('Push delivery unavailable',503);return {};
 }
 if(path==='/api/admin/test-email'&&req.method==='POST'){
  await cap(env,'test-email',ip(req),3,3600000);const biz=await env.CONFIG.get('business','json')||{};
  if(!biz.contactEmail)throw fail('Set a contact email first');await sendMail(env,biz.contactEmail,'Fixmee test email','Your Fixmee email configuration works.');return {};
 }
 throw fail('Not found',404);
}
export async function health(env){
 const probe=async fn=>{let timer;try{return await Promise.race([Promise.resolve().then(fn).then(()=>true),new Promise(resolve=>{timer=setTimeout(()=>resolve(false),1000);})]);}catch{return false;}finally{clearTimeout(timer);}};
 const [db,kv,r2]=await Promise.all([probe(()=>env.DB.prepare('SELECT 1').first()),probe(()=>env.CONFIG.get('health-probe')),probe(()=>env.MEDIA.head('health-probe'))]);return {ok:db&&kv&&r2,version:'round12',db,kv,r2};
}
