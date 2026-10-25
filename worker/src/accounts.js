import {overlayHealth} from './health-data.js';
import {cap,ip,mailReady,sendToken,genericMessage,turnstile} from './launch-security.js';
import { z } from 'zod/v4';
import { enc, hex, random, hash, equal, fail, input, limit } from './security.js';
import { syncCopy } from '../../app/js/sync-data.js';
import { CONFIG } from '../../app/js/config.js';
import {publishWorkouts} from './social-activity.js';
const credentials = z.object({ email:z.string().trim().toLowerCase().email().max(254), password:z.string().min(10).max(256), age16:z.boolean().optional(), ref:z.string().regex(/^[A-Z0-9]{16}$/).optional() }).strict();
export async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:Uint8Array.from(salt.match(/../g),v=>parseInt(v,16)),iterations:100000},key,256));
}
export const query = (env, sql, ...args) => env.DB.prepare(sql).bind(...args);
export async function user(req,env) {
  if (!env.DB) throw fail('DB binding is required',503);
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer /,'');
  if (!/^[a-f0-9]{64}$/.test(token)) throw fail('Please log in',401);
  const u = await query(env,'SELECT users.id, users.email, users.role FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?',await hash(token),Date.now()).first();
  if (!u) throw fail('Session expired',401);
  if((await query(env,'SELECT suspended FROM profiles WHERE user_id=?',u.id).first())?.suspended)throw fail('Account suspended',403);
  const activityHash=await hash(token);await query(env,'UPDATE session_activity SET last_used=? WHERE token_hash=?',Date.now(),activityHash).run();
  u.verified=!!(await query(env,'SELECT verified FROM email_verifications WHERE user_id=?',u.id).first())?.verified;
  return u;
}
export async function auth(req,env,path) {
  if (!env.DB) throw fail('DB binding is required',503);
  if (path.endsWith('/register') || path.endsWith('/login')) {
    if (req.method !== 'POST') throw fail('Method not allowed',405);
    // Validate separately so the app can tell the user which field is wrong.
    const parsed = credentials.safeParse(await input(req,z.json(),2000));
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path?.[0];
      if (field === 'password') throw Object.assign(fail('Password must be 10 to 256 characters',400),{code:'password_length'});
      if (field === 'email') throw Object.assign(fail('Enter a valid email address',400),{code:'invalid_email'});
      throw fail('Invalid request');
    }
    const b = parsed.data; await limit(req,env,b.email);
    await cap(env,path.endsWith('/register')?'register-ip':'login-ip',ip(req),path.endsWith('/register')?5:20,path.endsWith('/register')?86400000:900000);
    let u = await query(env,'SELECT * FROM users WHERE email=?',b.email).first();
    if (path.endsWith('/register')) {
      if(b.age16!==true)throw fail('Minimum age is 16',400);
      await turnstile(req,env);
      if(u){if(await mailReady(env)){try{await sendToken(env,u,'verify');}catch{}return {message:genericMessage};}throw fail('Unable to register this email',409);}
      const salt=random(16),id=crypto.randomUUID();
      try { await query(env,'INSERT INTO users(id,email,pass_hash,pass_salt,created_at) VALUES(?,?,?,?,?)',id,b.email,await passwordHash(b.password,salt),salt,Date.now()).run(); } catch { throw fail('Unable to register this email',409); }
      u={id,email:b.email,role:'user'};
      if(b.age16===true)await query(env,'INSERT INTO profiles(user_id,age16,created) VALUES(?,1,?)',id,Date.now()).run();
      if(b.ref){const referrer=await query(env,'SELECT id FROM users WHERE referral_code=?',b.ref).first();if(referrer && referrer.id!==id)await query(env,'INSERT INTO referrals(user_id,referrer_id) VALUES(?,?)',id,referrer.id).run();}
    } else {
      const computed=await passwordHash(b.password,u?.pass_salt || '00000000000000000000000000000000');
      if (!await equal(computed,u?.pass_hash || '') || !u) throw fail('Invalid email or password',401);
    }
    if((await query(env,'SELECT suspended FROM profiles WHERE user_id=?',u.id).first())?.suspended)throw fail('Account suspended',403);
    if(path.endsWith('/register')&&await mailReady(env)){try{await sendToken(env,u,'verify');}catch{}return {message:genericMessage};}
    const token=random(); await query(env,'INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',await hash(token),u.id,Date.now()+30*86400000).run();
    await query(env,'INSERT INTO session_activity VALUES(?,?,?,?)',await hash(token),Date.now(),Date.now(),(/Edg|Firefox|Chrome|Safari/.exec(req.headers.get('User-Agent')||'')||['Other'])[0]).run();
    return {token,user:{id:u.id,email:u.email,role:u.role,verified:!!(await query(env,'SELECT verified FROM email_verifications WHERE user_id=?',u.id).first())?.verified}};
  }
  const u=await user(req,env);
  if(path.endsWith('/me') && req.method==='GET') return {user:u};
  if(path.endsWith('/role') && req.method==='PUT') { const b=await input(req,z.object({role:z.enum(['user','trainer'])}).strict()); await query(env,'UPDATE users SET role=? WHERE id=?',b.role,u.id).run();return {user:{...u,role:b.role}}; }
  if(path.endsWith('/logout') && req.method==='POST') { await input(req,z.object({}).strict());await query(env,'DELETE FROM sessions WHERE token_hash=?',await hash(req.headers.get('Authorization').slice(7))).run();return {}; }
  throw fail('Not found',404);
}
export async function serverState(env,id) { const row=await query(env,'SELECT json,updated_at,version FROM user_state WHERE user_id=?',id).first();return row ? {...row,json:await overlayHealth(env,id,JSON.parse(row.json))} : {json:await overlayHealth(env,id,{}),updated_at:0,version:0}; }
export async function sync(req,env,verifyToken) {
  const u=await user(req,env);
  if(req.method==='GET') return serverState(env,u.id);
  if(req.method!=='PUT') throw fail('Method not allowed',405);
  const b=await input(req,z.object({json:z.record(z.string(),z.json()),baseVersion:z.number().int().nonnegative()}).strict());
  const data=await overlayHealth(env,u.id,syncCopy(b.json));
  const before=(await serverState(env,u.id)).json;
  if(data.premium?.token) {
    let ent;try{ent=await verifyToken(env,data.premium.token);}catch{}
    if(!ent || !['export1','pro30','pro90','trial7'].includes(ent.pid) || (ent.pid!=='export1' && !(Date.parse(ent.until)>Date.now()))) throw fail('Invalid premium entitlement',403);
    const settings=await env.CONFIG?.get('settings','json');
    const maxExports=(settings?.products||CONFIG.PRODUCTS)[ent.pid]?.exports||0;
    data.premium={token:data.premium.token,until:ent.until||null,ref:ent.ref||null,exportsLeft:Math.max(0,Math.min(maxExports,Number(data.premium.exportsLeft)||0))};
  } else if (data.premium) data.premium={token:null,until:null,exportsLeft:0,ref:null};
  const now=Date.now();
  const result=b.baseVersion===0
    ? await query(env,'INSERT INTO user_state(user_id,json,updated_at,version) VALUES(?,?,?,1) ON CONFLICT(user_id) DO NOTHING',u.id,JSON.stringify(data),now).run()
    : await query(env,'UPDATE user_state SET json=?,updated_at=?,version=version+1 WHERE user_id=? AND version=?',JSON.stringify(data),now,u.id,b.baseVersion).run();
  if(!result.meta.changes) throw fail('Sync conflict',409,await serverState(env,u.id));
  await publishWorkouts(env,u.id,before,data);
  return {json:data,updated_at:now,version:b.baseVersion+1};
}
const suggestions=z.object({goal:z.enum(['cut','bulk','recomp','maintain','strength']).optional(),avoidEx:z.array(z.string().max(80)).max(100).optional(),trainDays:z.array(z.number().int().min(0).max(6)).max(7).optional(),sessionMin:z.number().int().min(15).max(120).optional()}).strict();
export function summary(s,now=Date.now()) {
  const p=s.profile||{},today=new Date(now).toISOString().slice(0,10),since=new Date(now-27*86400000).toISOString().slice(0,10);
  const logs=Object.fromEntries(Object.entries(s.logs||{}).filter(([d])=>d>=since&&d<=today).map(([d,l])=>[d,{done:l.done||{},sets:l.sets||[],sleep:l.sleep,water:l.water}]));
  const done=n=>Object.entries(logs).filter(([d,l])=>Date.parse(d)>=Date.parse(today)-(n-1)*86400000&&l.done?.workout).length;
  const weights=(s.weights||[]).filter(w=>w.date>=since&&w.date<=today).sort((a,b)=>a.date.localeCompare(b.date));
  let scheduled=0,completed=0;for(let i=0;i<28;i++){const d=new Date(Date.parse(today)-i*86400000),iso=d.toISOString().slice(0,10);if(iso>=(p.startDate||'')&&(s.dayOverrides?.[iso]==='train'||s.dayOverrides?.[iso]!=='off'&&(p.trainDays||[]).includes(d.getUTCDay()))){scheduled++;if(logs[iso]?.done?.workout)completed++;}}
  return {name:p.name||'',goal:p.goal,profile:Object.fromEntries(['name','age','sex','height','weight','goal'].map(k=>[k,p[k]])),plan:Object.fromEntries(['trainDays','sessionMin','avoidEx','startDate','location','level'].map(k=>[k,p[k]])),logs,measurements:s.measurements||[],weights,workouts7:done(7),workouts28:done(28),weightTrend:weights.length>1?weights.at(-1).kg-weights[0].kg:null,adherence:scheduled?Math.round(completed/scheduled*100):0};
}
async function linked(env,trainer,client) { if(!await query(env,"SELECT 1 AS yes FROM trainer_links WHERE trainer_id=? AND client_id=? AND status='active'",trainer,client).first())throw fail('Not linked',403); }
export async function trainer(req,env,path) {
  const u=await user(req,env);
  if(path==='/api/trainer/invite' && req.method==='POST') {
    await input(req,z.object({}).strict());await limit(req,env,u.id);
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=crypto.getRandomValues(new Uint8Array(6)),code=Array.from(bytes,b=>alphabet[b%32]).join('');
    await query(env,'INSERT INTO invites(code,client_id,expires_at) VALUES(?,?,?)',code,u.id,Date.now()+48*3600000).run();return {code};
  }
  if(path==='/api/trainer/link' && req.method==='POST') {
    if(u.role!=='trainer')throw fail('Trainer role required',403);
    await limit(req,env,u.id);const {code}=await input(req,z.object({code:z.string().regex(/^[A-Z2-9]{6}$/)}).strict());
    const invite=await query(env,'SELECT * FROM invites WHERE code=? AND expires_at>?',code,Date.now()).first();
    if(!invite||invite.client_id===u.id)throw fail('Invalid invite');
    await env.DB.batch([query(env,"INSERT INTO trainer_links(trainer_id,client_id,status,created_at) SELECT ?,client_id,'active',? FROM invites WHERE code=? AND expires_at>? ON CONFLICT(trainer_id,client_id) DO UPDATE SET status='active'",u.id,Date.now(),code,Date.now()),query(env,'DELETE FROM invites WHERE code=?',code)]);return {};
  }
  if(path==='/api/trainer/unlink' && req.method==='POST') {
    const b=await input(req,z.object({id:z.string().uuid()}).strict());
    await query(env,'DELETE FROM trainer_links WHERE (trainer_id=? AND client_id=?) OR (trainer_id=? AND client_id=?)',u.id,b.id,b.id,u.id).run();return {};
  }
  if(path==='/api/trainer/mine' && req.method==='GET') {
    const links=(await query(env,"SELECT trainer_id AS id FROM trainer_links WHERE client_id=? AND status='active'",u.id).all()).results;
    const notes=(await query(env,"SELECT notes.* FROM notes JOIN trainer_links ON trainer_links.client_id=notes.client_id AND trainer_links.trainer_id=notes.trainer_id WHERE notes.client_id=? AND trainer_links.status='active' ORDER BY notes.created_at DESC LIMIT 100",u.id).all()).results;
    return {links,notes:notes.map(n=>({...n,...JSON.parse(n.text)}))};
  }
  if(u.role!=='trainer') throw fail('Trainer role required',403);
  if(path==='/api/trainer/clients'&&req.method==='GET') {
    const links=(await query(env,"SELECT client_id FROM trainer_links WHERE trainer_id=? AND status='active'",u.id).all()).results;
    return {clients:await Promise.all(links.map(async l=>{const s=await serverState(env,l.client_id);return {id:l.client_id,lastSync:s.updated_at,...summary(s.json)};}))};
  }
  const match=path.match(/^\/api\/trainer\/clients\/([^/]+)(\/notes)?$/);if(!match)throw fail('Not found',404);
  const id=z.string().uuid().parse(match[1]);await linked(env,u.id,id);
  if(match[2]&&req.method==='POST') {
    const b=await input(req,z.object({text:z.string().max(4000),suggestions:suggestions.optional()}).strict(),10000);
    await query(env,'INSERT INTO notes(id,trainer_id,client_id,text,created_at) VALUES(?,?,?,?,?)',crypto.randomUUID(),u.id,id,JSON.stringify(b),Date.now()).run();return {};
  }
  if(!match[2]&&req.method==='GET') {const s=await serverState(env,id);const notes=(await query(env,'SELECT * FROM notes WHERE trainer_id=? AND client_id=? ORDER BY created_at DESC LIMIT 100',u.id,id).all()).results;return {client:{id,lastSync:s.updated_at,...summary(s.json)},notes:notes.map(n=>({...n,...JSON.parse(n.text)}))};}
  throw fail('Method not allowed',405);
}
