import {z} from 'zod/v4';
import {user,query as q} from './accounts.js';
import {admin,input,fail,hash,random,limit} from './security.js';
const visible="('approved','planned','in_progress','done')";
export async function owner(req,env){if(req.headers.has('Authorization'))return (await user(req,env)).id;const id=new URL(req.url).searchParams.get('installId');if(!id||!/^[-a-zA-Z0-9]{16,80}$/.test(id))throw fail('Valid install ID required',401);return 'install:'+id;}
export async function supporterToken(env,record){
 if(!env.TOKEN_SECRET)throw fail('Token signing unavailable',503);
 const enc=new TextEncoder(),body=btoa(JSON.stringify({type:'supporter',...record})).replace(/=/g,'');
 const key=await crypto.subtle.importKey('raw',enc.encode(env.TOKEN_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(body))))).replace(/=/g,'');return body+'.'+sig;
}
async function badge(env,id){const s=await q(env,'SELECT * FROM supporters WHERE owner=?',id).first();return s?{supporter:s,token:await supporterToken(env,s)}:{supporter:null};}
export async function round10(req,env,path,readConfig,verifyAmount){
 if(!env.DB)throw fail('Database unavailable',503);
 if(path.startsWith('/api/admin/')){
  await admin(req,env);
  if(path==='/api/admin/ideas'){
   if(req.method==='GET')return {ideas:(await q(env,'SELECT * FROM ideas ORDER BY created DESC LIMIT 300').all()).results};
   if(req.method!=='PUT')throw fail('Method not allowed',405);
   const b=await input(req,z.object({id:z.string().uuid(),status:z.enum(['approved','rejected','planned','in_progress','done','merged']),mergeInto:z.string().uuid().optional()}).strict());
   if(b.status==='merged'){
    if(!b.mergeInto||b.mergeInto===b.id||!await q(env,`SELECT id FROM ideas WHERE id=? AND status IN ${visible}`,b.mergeInto).first())throw fail('Choose a public merge target');
    await env.DB.batch([q(env,'INSERT INTO idea_votes SELECT ?,owner,weight FROM idea_votes WHERE idea_id=? ON CONFLICT(idea_id,owner) DO UPDATE SET weight=MAX(weight,excluded.weight)',b.mergeInto,b.id),q(env,'DELETE FROM idea_votes WHERE idea_id=?',b.id),q(env,"UPDATE ideas SET status='merged',merged_into=? WHERE id=?",b.mergeInto,b.id)]);
   }else await q(env,'UPDATE ideas SET status=? WHERE id=?',b.status,b.id).run();return {ok:true};
  }
  if(path==='/api/admin/donations'){
   if(req.method==='GET')return {donations:(await q(env,'SELECT * FROM donations ORDER BY created DESC LIMIT 300').all()).results,months:(await q(env,"SELECT strftime('%Y-%m',created/1000,'unixepoch') AS month,currency,sum(amount) AS amount,count(*) AS count FROM donations GROUP BY month,currency ORDER BY month DESC").all()).results};
   if(req.method!=='POST')throw fail('Method not allowed',405);
   const b=await input(req,z.object({email:z.string().email().optional(),amount:z.number().min(1).max(1000000),currency:z.enum(['THB','USD']).default('THB'),note:z.string().max(1000).default('')}).strict());
   const now=Date.now();let id,code;
   if(b.email){const u=await q(env,'SELECT id FROM users WHERE email=?',b.email.trim().toLowerCase()).first();if(!u)throw fail('Account not found',404);id=u.id;}
   else {code=random(16);id='code:'+await hash(code);}
   const statements=[q(env,'INSERT INTO donations(id,owner,amount,currency,method,created,note) VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),id,b.amount,b.currency,'manual',now,b.note)];
   if(code)statements.push(q(env,'INSERT INTO supporter_codes(code_hash,amount,created) VALUES(?,?,?)',await hash(code),b.amount,now));
   else statements.push(q(env,'INSERT INTO supporters VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET amount=amount+excluded.amount,created=excluded.created',id,b.amount,now));
   if(!code)statements.push(q(env,'UPDATE idea_votes SET weight=2 WHERE owner=?',id));
   await env.DB.batch(statements);return {ok:true,...(code?{code}:{})};
  }
 }
 const id=await owner(req,env);
 if(path==='/api/supporter'&&req.method==='GET')return badge(env,id);
 if(path==='/api/supporter/claim'&&req.method==='POST'){
  const b=await input(req,z.object({code:z.string().regex(/^[a-f0-9]{32}$/)}).strict()),h=await hash(b.code);
  const result=await env.DB.batch([q(env,'INSERT INTO supporters SELECT ?,amount,created FROM supporter_codes WHERE code_hash=? AND claimed_by IS NULL ON CONFLICT(owner) DO UPDATE SET amount=amount+excluded.amount,created=excluded.created',id,h),q(env,'UPDATE supporter_codes SET claimed_by=? WHERE code_hash=? AND claimed_by IS NULL',id,h),q(env,'UPDATE idea_votes SET weight=2 WHERE owner=? AND EXISTS(SELECT 1 FROM supporters WHERE owner=?)',id,id)]);
  if(!result[1].meta.changes)throw fail('Code invalid or already claimed',409);return badge(env,id);
 }
 if(path==='/api/donate/slip'&&req.method==='POST'){
  const b=await input(req,z.object({amount:z.number().min(1).max(1000000).refine(v=>Math.abs(v*100-Math.round(v*100))<1e-6),image:z.string().min(1).max(8000000),note:z.string().max(1000).default('')}).strict(),8100000);
  if(!(await readConfig(env)).receiverName?.trim())throw fail('Donation receiver is not configured',503);
  if(!env.TOKEN_SECRET)throw fail('Token signing unavailable',503);
  await limit(req,env,'donate:'+id);
  const ref=await verifyAmount(b.amount,b.image,env),now=Date.now();
  try{await env.DB.batch([q(env,'INSERT INTO donations VALUES(?,?,?,?,?,?,?,?)',crypto.randomUUID(),id,b.amount,'THB','promptpay',now,b.note,ref),q(env,'INSERT INTO supporters VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET amount=amount+excluded.amount,created=excluded.created',id,b.amount,now),q(env,'UPDATE idea_votes SET weight=2 WHERE owner=?',id)]);}catch{throw fail('Slip already used or donation could not be recorded',409);}
  return badge(env,id);
 }
 if(path==='/api/ideas'&&req.method==='GET')return {ideas:(await q(env,`SELECT i.*,COALESCE(SUM(v.weight),0) AS votes,MAX(CASE WHEN v.owner=? THEN 1 ELSE 0 END) AS voted FROM ideas i LEFT JOIN idea_votes v ON i.id=v.idea_id WHERE i.status IN ${visible} GROUP BY i.id ORDER BY votes DESC,i.created DESC LIMIT 300`,id).all()).results};
 if(path==='/api/ideas'&&req.method==='POST'){
  const b=await input(req,z.object({title:z.string().trim().min(1).max(80),detail:z.string().trim().min(1).max(1000),category:z.enum(['training','food','supplements','ai','other'])}).strict()),now=Date.now();
  const result=await q(env,"INSERT INTO ideas(id,owner,title,detail,category,created) SELECT ?,?,?,?,?,? WHERE (SELECT count(*) FROM ideas WHERE owner=? AND created>=?)<3",crypto.randomUUID(),id,b.title,b.detail,b.category,now,id,Math.floor(now/86400000)*86400000).run();
  if(!result.meta.changes)throw fail('Three ideas per day',429);return {status:'pending'};
 }
 const m=path.match(/^\/api\/ideas\/([a-f0-9-]{36})\/vote$/);
 if(m&&req.method==='POST'){
  const b=await input(req,z.object({voted:z.boolean()}).strict());
  if(!await q(env,`SELECT id FROM ideas WHERE id=? AND status IN ${visible}`,m[1]).first())throw fail('Idea not found',404);
  if(b.voted)await q(env,'INSERT INTO idea_votes VALUES(?,?,CASE WHEN EXISTS(SELECT 1 FROM supporters WHERE owner=?) THEN 2 ELSE 1 END) ON CONFLICT(idea_id,owner) DO NOTHING',m[1],id,id).run();else await q(env,'DELETE FROM idea_votes WHERE idea_id=? AND owner=?',m[1],id).run();return {voted:b.voted};
 }
 throw fail('Not found',404);
}
