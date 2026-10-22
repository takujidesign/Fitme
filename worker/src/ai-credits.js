import { user, query as q } from './accounts.js';
import { entitlementUntil } from './growth.js';
import { fail } from './security.js';
const DAY=86400000, PERIOD=30*DAY;
const iso=n=>new Date(n).toISOString();
const rows=async(e,s,...a)=>(await q(e,s,...a).all()).results;
export async function creditOwner(req,env,verifyToken,config,now=Date.now()) {
 if(!env.DB)throw fail('DB binding is required',503);
 const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
 let owner,account=false,until=0,start=now;
 if(/^[a-f0-9]{64}$/.test(token)) {
  const u=await user(req,env);owner=u.id;account=true;until=await entitlementUntil(env,u.id);
  const paid=await q(env,"SELECT min(created_at) AS start FROM payments WHERE user_id=? AND product IN ('pro30','pro90','monthly')",owner).first();
  start=paid?.start||now;
 } else {
  let ent;try{ent=await verifyToken(env,token);}catch{}
  if(!ent?.ref)throw fail('Sign in or provide a purchase token',402);
  // An account entitlement is not an account login. Prevent trial claims via shareable tokens.
  if(ent.ref.startsWith('account:'))throw fail('Please sign in to use account credits',401);
  const payment=await q(env,'SELECT payments.*,orders.days,orders.ai_owner FROM payments JOIN orders ON orders.id=payments.id WHERE payments.ref=?',ent.ref).first();
  if(!payment||payment.user_id)throw fail('Please sign in to use account credits',401);
  owner=payment.ai_owner||'purchase:'+payment.id;start=payment.created_at;until=Date.parse(ent.until)||0;
 }
 if(account)await q(env,"INSERT OR IGNORE INTO ai_credits VALUES(?,'trial',?,0)",owner,config.credits.trial).run();
 let period=null,reset=null;
 if(until>now){
  await q(env,'INSERT OR IGNORE INTO ai_periods VALUES(?,?)',owner,start).run();
  start=(await q(env,'SELECT start FROM ai_periods WHERE owner=?',owner).first()).start;
  const n=start+Math.max(0,Math.floor((now-start)/PERIOD))*PERIOD;period=iso(n);reset=iso(Math.min(n+PERIOD,until));
  await q(env,'INSERT OR IGNORE INTO ai_credits VALUES(?,?,?,0)',owner,period,config.credits.period).run();
 }
 return {owner,account,pro:until>now,period,reset,config};
}
export async function credits(env,c,now=Date.now()) {
 const allowances=await rows(env,"SELECT * FROM ai_credits WHERE owner=? AND (period_start=? OR period_start='trial')",c.owner,c.period||'');
 const topups=await rows(env,'SELECT id,credits,used,expires FROM ai_topups WHERE owner=? AND expires>? ORDER BY expires,id',c.owner,iso(now));
 const remaining=allowances.reduce((n,v)=>n+v.granted-v.used,0)+topups.reduce((n,v)=>n+v.credits-v.used,0);
 return {remaining,creditsLeft:remaining,reset:c.reset,topups,prices:c.config.prices,recent:await rows(env,'SELECT feature,credits,created FROM ai_usage WHERE owner=? ORDER BY created DESC,id DESC LIMIT 20',c.owner)};
}
export async function reserve(env,c,amount,now=Date.now()) {
 const id=crypto.randomUUID();
 // One SQLite statement and its triggers share a write transaction. Read balance,
 // choose buckets and debit them without a JS read/update race across isolates.
 const result=await q(env,`INSERT INTO ai_reservations(id,owner,allocations,created)
 WITH pools AS (
 SELECT 'period' kind,period_start id,granted-used available,CASE WHEN period_start='trial' THEN 1 ELSE 0 END priority,period_start expiry FROM ai_credits WHERE owner=? AND (period_start=? OR period_start='trial') AND granted>used
 UNION ALL SELECT 'topup',id,credits-used,2,expires FROM ai_topups WHERE owner=? AND expires>? AND credits>used
 ), ordered AS (SELECT *,COALESCE(sum(available) OVER(ORDER BY priority,expiry,id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) before FROM pools)
 SELECT ?,?,COALESCE((SELECT json_group_array(json_object('kind',kind,'id',id,'amount',MIN(available,MAX(0,?-before)))) FROM ordered WHERE before<?),'[]'),?
 WHERE COALESCE((SELECT sum(available) FROM pools),0)>=?`,c.owner,c.period||'',c.owner,iso(now),id,c.owner,amount,amount,iso(now),amount).run();
 if(!result.meta.changes){await event(env,c.owner,'empty',now);throw Object.assign(fail('No AI credits remaining',402),{code:'no_credits'});}
 return id;
}
export const refund=(env,id)=>q(env,'UPDATE ai_reservations SET refunded=1 WHERE id=? AND refunded=0',id).run();
export const event=(env,owner,kind,now=Date.now())=>q(env,'INSERT INTO ai_events VALUES(?,?,?,?)',crypto.randomUUID(),owner,kind,iso(now)).run();
export async function runAI(req,env,feature,verifyToken,config,fn){
 if((await env.CONFIG?.get('social-settings','json'))?.aiEnabled===false)throw fail('AI is disabled',503);
 const c=await creditOwner(req,env,verifyToken,config);
 const n=await q(env,'INSERT INTO ai_limits VALUES(?,?,1) ON CONFLICT(owner,bucket) DO UPDATE SET count=count+1 RETURNING count',c.owner,Math.floor(Date.now()/3600000)).first();
 if(n.count>30)throw fail('AI limit: 30 calls per hour',429);
 const amount=config.prices[feature],id=await reserve(env,c,amount);
 const scoped={...env,aiSession:{...c,amount,feature,id}};
 try{const result=await fn(scoped);const balance=await credits(env,c);if(balance.remaining===0)await event(env,c.owner,'empty');return {...result,creditsLeft:balance.remaining};}
 catch(e){await refund(env,id);await q(env,'UPDATE ai_usage SET credits=0 WHERE id=?',id).run();throw e;}
}
