import { z } from 'zod/v4';
import { admin, input, fail, hash } from './security.js';
import { user, query as q, serverState } from './accounts.js';
import { EX } from '../../app/js/exercises.js';

const code = z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,32}$/);
const pid = z.string().regex(/^(export1|pro30|pro90|plan_[a-f0-9-]{36})$/);
const uuid = z.string().uuid();
export const Promo = z.object({code, type:z.enum(['percent','fixed']), value:z.number().positive().max(100000), currency:z.enum(['thb','usd']), products:z.array(pid).min(1).max(100), maxUses:z.number().int().positive().max(1000000), expiry:z.number().int().positive(), active:z.boolean()}).strict().refine(p=>p.type!=='percent'||p.value<=100);
export function discounted(amount, promo, product, currency, now=Date.now()) {
  if (!promo) return amount;
  if (!promo.active || promo.expiry<=now || !promo.products.includes(product) || (promo.type==='fixed' && promo.currency!==currency)) throw fail('Promo is not valid for this purchase');
  // Prices and accounting use integer minor units; fully discounted orders need no provider call.
  return Math.max(0, amount-Math.round(promo.type==='percent'?amount*promo.value/100:promo.value*100));
}
export const connectFee = (amount,share=70) => amount-Math.round(amount*share/100);
const Settings = z.object({contactEmail:z.string().email().max(254),referralDays:z.number().int().min(0).max(90),trainerShare:z.number().int().min(0).max(100)}).strict();
export async function business(env) {return {contactEmail:'',referralDays:7,trainerShare:70,...await env.CONFIG?.get('business','json')};}
const rows = async (env,sql,...args)=>(await q(env,sql,...args).all()).results;
const optionalUser = async(req,env)=>/^Bearer\s+\S+/.test(req.headers.get('Authorization')||'')?user(req,env):null;

export async function accountData(req,env) {
  const u=await user(req,env);
  if(req.method==='GET') return {user:await q(env,'SELECT id,email,role,created_at,referral_code,pro_until FROM users WHERE id=?',u.id).first(),sessions:await rows(env,'SELECT expires_at FROM sessions WHERE user_id=?',u.id),invites:await rows(env,'SELECT * FROM invites WHERE client_id=?',u.id),trainerAccount:await q(env,'SELECT stripe_id FROM trainer_accounts WHERE user_id=?',u.id).first(),payables:await rows(env,'SELECT * FROM payables WHERE trainer_id=?',u.id),state:await serverState(env,u.id),payments:await rows(env,'SELECT * FROM payments WHERE user_id=?',u.id),links:await rows(env,'SELECT * FROM trainer_links WHERE trainer_id=? OR client_id=?',u.id,u.id),notes:await rows(env,'SELECT * FROM notes WHERE trainer_id=? OR client_id=?',u.id,u.id),referrals:await rows(env,'SELECT * FROM referrals WHERE user_id=? OR referrer_id=?',u.id,u.id),plans:await rows(env,'SELECT * FROM plans WHERE trainer_id=?',u.id),purchases:await rows(env,'SELECT * FROM plan_purchases WHERE user_id=?',u.id),push:await rows(env,'SELECT device_id FROM push_subscriptions WHERE user_id=?',u.id)};
  if(req.method!=='DELETE')throw fail('Method not allowed',405);
  const b=await input(req,z.object({email:z.string().email()}).strict());
  if(b.email.trim().toLowerCase()!==u.email)throw fail('Type your email to confirm');
  // Delete external push records first, so a failure is retryable without losing ownership.
  for(const d of await rows(env,'SELECT device_id FROM push_subscriptions WHERE user_id=?',u.id))await env.PUSH?.delete('device:'+d.device_id);
  const anon=await hash(crypto.randomUUID());
  await env.DB.batch([
    q(env,'UPDATE payments SET user_id=? WHERE user_id=?',anon,u.id),
    q(env,'UPDATE payables SET trainer_id=? WHERE trainer_id=?',anon,u.id),
    q(env,'DELETE FROM plan_purchases WHERE user_id=? OR plan_id IN (SELECT id FROM plans WHERE trainer_id=?)',u.id,u.id),
    q(env,'DELETE FROM orders WHERE user_id=? OR trainer_id=?',u.id,u.id),
    ...['plans','trainer_accounts','push_subscriptions','sessions','user_state'].map(t=>q(env,`DELETE FROM ${t} WHERE ${t==='plans'?'trainer_id':'user_id'}=?`,u.id)),
    q(env,'DELETE FROM referrals WHERE user_id=? OR referrer_id=?',u.id,u.id),
    q(env,'DELETE FROM notes WHERE trainer_id=? OR client_id=?',u.id,u.id),
    q(env,'DELETE FROM trainer_links WHERE trainer_id=? OR client_id=?',u.id,u.id),
    q(env,'DELETE FROM invites WHERE client_id=?',u.id),q(env,'DELETE FROM users WHERE id=?',u.id)
  ]);return {};
}

// Free-form exception messages can contain names, emails and user-entered health data.
// Keep only recognised error categories and allowlisted source filenames/routes.
export function safeError(e) {
  const category=/^(TypeError|ReferenceError|RangeError|SyntaxError)\b/.exec(e.message)?.[1]||'Error';
  const file=['app.js','account.js','calc.js','store.js','workout.js','pay.js','meals.js','supplements.js','figure.js','legal.js','telemetry.js','videos.js','round5.js','admin-round5.js','womens-health.js','programs.js'].includes(e.file)?e.file:'app';
  const route=['today','workout','food','supps','me','pay','admin','account','trainer','plans','onboarding','player','privacy','terms'].includes(e.route)?e.route:'other';
  return {message:`${category} ${file}:${e.line||0}`,route,version:e.version};
}
export async function telemetry(req,env) {
  const b=await input(req,z.object({installId:uuid,events:z.array(z.object({kind:z.enum(['event','error']),name:z.enum(['onboarding_done','workout_done','purchase_started','purchase_completed','ai_used','error']),message:z.string().max(500).optional(),file:z.string().max(100).optional(),line:z.number().int().min(0).max(100000).optional(),route:z.string().max(50).optional(),version:z.string().regex(/^[a-zA-Z0-9._-]{1,40}$/),ua:z.enum(['Firefox','Chromium','Safari','Other'])}).strict()).min(1).max(20)}).strict(),16000);
  const now=Date.now(),bucket=Math.floor(now/3600000),id=await hash(b.installId);
  const n=await q(env,'INSERT INTO telemetry_limits(id,bucket,count) VALUES(?,?,1) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN bucket=excluded.bucket THEN count+1 ELSE 1 END,bucket=excluded.bucket RETURNING count',id,bucket).first();
  if(n.count>30)throw fail('Too many telemetry batches',429);
  await q(env,'DELETE FROM telemetry_limits WHERE bucket<?',bucket-24).run();
  const statements=[];
  for(const e of b.events) {
    if(e.kind==='error') {const s=safeError(e);statements.push(q(env,'INSERT INTO errors(hash,message,route,version,count,first_seen,last_seen) VALUES(?,?,?,?,1,?,?) ON CONFLICT(hash) DO UPDATE SET count=count+1,last_seen=excluded.last_seen',await hash(JSON.stringify(s)),s.message,s.route,s.version,now,now));}
    else {if(e.name==='error')throw fail('Invalid event');statements.push(q(env,'INSERT INTO telemetry_daily(date,kind,name,count) VALUES(?,?,?,1) ON CONFLICT(date,kind,name) DO UPDATE SET count=count+1',new Date(now).toISOString().slice(0,10),'event',e.name));}
  }
  statements.push(q(env,'DELETE FROM errors WHERE last_seen<?',now-90*86400000),q(env,'DELETE FROM telemetry_daily WHERE date<?',new Date(now-90*86400000).toISOString().slice(0,10)));
  await env.DB.batch(statements);return {};
}

export async function referral(req,env) {
  const u=await user(req,env);
  await q(env,'UPDATE users SET referral_code=? WHERE id=? AND referral_code IS NULL',crypto.randomUUID().replaceAll('-','').slice(0,16).toUpperCase(),u.id).run();
  return {...await q(env,'SELECT referral_code AS code,pro_until FROM users WHERE id=?',u.id).first(),...await q(env,'SELECT count(*) AS count FROM referrals WHERE referrer_id=? AND rewarded=1',u.id).first()};
}

export async function quote(req,env,readConfig) {
  const b=await input(req,z.object({productId:pid,currency:z.enum(['thb','usd']),promo:code.optional()}).strict());
  const u=await optionalUser(req,env),settings=await readConfig(env),config=await business(env);
  let product=settings.products[b.productId],trainer=null;
  if(b.productId.startsWith('plan_')) {if(!u)throw fail('Please log in to buy a plan',401);const p=await q(env,"SELECT * FROM plans WHERE id=? AND status='approved'",b.productId).first();if(!p)throw fail('Plan unavailable');product=JSON.parse(p.json);trainer=p.trainer_id;if(trainer===u.id)throw fail('Cannot buy your own plan');}
  if(!product)throw fail('Unknown product');
  let promo=null;
  if(b.promo){const row=await q(env,'SELECT * FROM promos WHERE code=?',b.promo).first();if(!row)throw fail('Unknown promo');promo=JSON.parse(row.json);}
  const amount=discounted(Math.round(product[b.currency]*100),promo,b.productId,b.currency),id=crypto.randomUUID(),now=Date.now();
  // Atomic reservation prevents two buyers from taking the final promo use.
  const result=await q(env,`INSERT INTO orders(id,user_id,product,amount,currency,promo,trainer_id,share,days,created_at,expires_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE ? IS NULL OR (SELECT uses+(SELECT count(*) FROM orders WHERE promo=? AND paid=0 AND expires_at>?) FROM promos WHERE code=?) < ?`,id,u?.id||null,b.productId,amount,b.currency,b.promo||null,trainer,config.trainerShare,product.days||0,now,now+60*60000,b.promo||null,b.promo||null,now,b.promo||null,promo?.maxUses||0).run();
  if(!result.meta.changes)throw fail('Promo usage limit reached');
  return {orderId:id,amount:amount/100,currency:b.currency,expiresAt:now+60*60000};
}
async function orderFor(req,env,id) {
  const o=await q(env,'SELECT * FROM orders WHERE id=?',uuid.parse(id)).first();
  if(!o)throw fail('Order not found',404);
  if(o.user_id && (await user(req,env)).id!==o.user_id)throw fail('Order belongs to another account',403);
  return o;
}
export async function checkout(req,env,stripe,safeReturn) {
  const b=await input(req,z.object({orderId:uuid,returnUrl:z.string().url().max(2000)}).strict());
  const o=await orderFor(req,env,b.orderId);if(o.paid||o.expires_at<Date.now()+30*60000)throw fail('Please refresh the price quote');
  if(o.amount===0)throw fail('Use the fully discounted order confirmation');
  const base=safeReturn(b.returnUrl,env),params={mode:'payment','line_items[0][quantity]':'1','line_items[0][price_data][currency]':o.currency,'line_items[0][price_data][unit_amount]':String(o.amount),'line_items[0][price_data][product_data][name]':o.product,'metadata[order]':o.id,success_url:base+'?paid={CHECKOUT_SESSION_ID}',cancel_url:base,expires_at:String(Math.floor(o.expires_at/1000))};
  if(o.trainer_id){const a=await q(env,'SELECT stripe_id FROM trainer_accounts WHERE user_id=?',o.trainer_id).first();if(!a)throw fail('Trainer must complete Stripe onboarding');const status=await stripe(env,'accounts/'+a.stripe_id,null,'GET');if(!status.charges_enabled||!status.payouts_enabled)throw fail('Trainer Stripe account is not ready');params['payment_intent_data[transfer_data][destination]']=a.stripe_id;params['payment_intent_data[application_fee_amount]']=String(connectFee(o.amount,o.share));}
  const s=await stripe(env,'checkout/sessions',params,'POST','order-'+o.id);
  await q(env,'UPDATE orders SET stripe_id=? WHERE id=?',s.id,o.id).run();return {url:s.url};
}
export async function claimOrder(req,env,issue){
  const {orderId}=await input(req,z.object({orderId:uuid}).strict());
  const o=await orderFor(req,env,orderId);
  if(o.amount!==0||(!o.paid&&o.expires_at<=Date.now()))throw fail('Order is not eligible for free confirmation');
  return paymentResult(env,o,await recordPayment(env,o,'promo','free:'+o.id),issue);
}
export async function recordPayment(env,o,method,ref) {
  const now=Date.now(),config=await business(env),reward=config.referralDays*86400000;
  // All bookkeeping and reward transitions share one D1 transaction. Unique refs and
  // paid=0 conditions make repeated confirmations harmless, including concurrent calls.
  const statements=[q(env,'INSERT INTO payments(id,user_id,product,amount,currency,method,ref,promo,created_at) SELECT id,user_id,product,amount,currency,?,?,promo,? FROM orders WHERE id=? AND paid=0 ON CONFLICT DO NOTHING',method,ref,now,o.id)];
  const pending='EXISTS(SELECT 1 FROM payments JOIN orders ON payments.id=orders.id WHERE payments.id=? AND orders.paid=0)';
  statements.push(q(env,`UPDATE promos SET uses=uses+1 WHERE code=? AND ${pending}`,o.promo,o.id));
  if(o.user_id){
    statements.push(q(env,`UPDATE users SET pro_until=MAX(pro_until,?)+? WHERE id=? AND ${pending}`,now,o.days*86400000,o.user_id,o.id));
    // A referral is rewarded only at the referred user's first verified purchase.
    statements.push(q(env,`UPDATE users SET pro_until=MAX(pro_until,?)+? WHERE id IN (SELECT user_id FROM referrals WHERE user_id=? AND rewarded=0 UNION SELECT referrer_id FROM referrals WHERE user_id=? AND rewarded=0) AND (SELECT count(*) FROM payments WHERE user_id=?)=1 AND ${pending}`,now,reward,o.user_id,o.user_id,o.user_id,o.id));
    statements.push(q(env,`UPDATE referrals SET rewarded=1 WHERE user_id=? AND rewarded=0 AND ${pending}`,o.user_id,o.id));
    if(o.trainer_id)statements.push(q(env,`INSERT INTO plan_purchases(user_id,plan_id) SELECT ?,? WHERE ${pending} ON CONFLICT DO NOTHING`,o.user_id,o.product,o.id));
  }
  if(o.trainer_id&&method==='promptpay')statements.push(q(env,`INSERT INTO payables(payment_id,trainer_id,amount,currency) SELECT ?,?,?,? WHERE ${pending} ON CONFLICT DO NOTHING`,o.id,o.trainer_id,o.amount-connectFee(o.amount,o.share),o.currency,o.id));
  statements.push(q(env,'UPDATE orders SET paid=1 WHERE id=? AND EXISTS(SELECT 1 FROM payments WHERE id=?)',o.id,o.id));
  await env.DB.batch(statements);
  const payment=await q(env,'SELECT * FROM payments WHERE id=?',o.id).first();
  if(!payment||payment.ref!==ref)throw fail('Payment reference already used',409);
  return payment;
}
export async function confirmPayment(req,env,stripe,issue) {
  const sid=z.string().regex(/^cs_[A-Za-z0-9_]+$/).max(300).parse(new URL(req.url).searchParams.get('session_id'));
  const s=await stripe(env,'checkout/sessions/'+sid,null,'GET');
  const o=await orderFor(req,env,s.metadata?.order);
  if(s.payment_status!=='paid'||s.amount_total!==o.amount||s.currency!==o.currency||s.id!==o.stripe_id)throw fail('Payment does not match order');
  const payment=await recordPayment(env,o,'stripe',sid);return paymentResult(env,o,payment,issue);
}
export async function slipPayment(req,env,verify,issue) {
  const b=await input(req,z.object({orderId:uuid,image:z.string().min(1).max(8000000)}).strict(),8100000),o=await orderFor(req,env,b.orderId);
  if(o.currency!=='thb'||o.paid||o.expires_at<=Date.now())throw fail('Order expired or paid');
  const ref=await verify(o.amount/100,b.image,env);
  const payment=await recordPayment(env,o,'promptpay',ref);return paymentResult(env,o,payment,issue);
}
async function paymentResult(env,o,payment,issue) {
  if(o.trainer_id)return {planId:o.product};
  const u=o.user_id?await q(env,'SELECT pro_until FROM users WHERE id=?',o.user_id).first():null;
  return issue(env,o.product,payment.ref,{days:o.days,until:o.days?new Date(u?.pro_until||payment.created_at+o.days*86400000).toISOString():null});
}

const training=z.object({goal:z.enum(['cut','recomp','maintain','bulk','strength']),level:z.enum(['beginner','intermediate','advanced']),location:z.enum(['home','db','gym']),trainDays:z.array(z.number().int().min(0).max(6)).min(1).max(7),sessionMin:z.number().int().min(15).max(120),avoidEx:z.array(z.enum(Object.keys(EX))).max(100).default([])}).strict();
const Plan=z.object({name:z.string().min(1).max(100),description:z.string().max(3000),thb:z.number().min(10).max(100000),usd:z.number().min(1).max(10000),weeks:z.number().int().min(1).max(52),settings:training,notes:z.array(z.string().max(1000)).max(52)}).strict();
export async function marketplace(req,env,path,stripe,safeReturn) {
  if(path==='/api/plans'&&req.method==='GET')return {plans:(await rows(env,"SELECT * FROM plans WHERE status='approved'")).map(p=>({...p,json:JSON.parse(p.json)}))};
  const u=await user(req,env);
  if(path==='/api/plans/apply'&&req.method==='POST'){const b=await input(req,z.object({id:pid}).strict());const p=await q(env,'SELECT plans.* FROM plans JOIN plan_purchases ON plans.id=plan_purchases.plan_id WHERE plans.id=? AND user_id=?',b.id,u.id).first();if(!p)throw fail('Purchase required',403);await q(env,"INSERT INTO trainer_links(trainer_id,client_id,status,created_at) VALUES(?,?,'active',?) ON CONFLICT(trainer_id,client_id) DO UPDATE SET status='active'",p.trainer_id,u.id,Date.now()).run();return {plan:JSON.parse(p.json)};}
  if(u.role!=='trainer')throw fail('Trainer role required',403);
  if(path==='/api/trainer/plans'&&req.method==='POST'){const b=await input(req,Plan);const id='plan_'+crypto.randomUUID();await q(env,'INSERT INTO plans(id,trainer_id,json) VALUES(?,?,?)',id,u.id,JSON.stringify(b)).run();return {id};}
  if(path==='/api/trainer/plans'&&req.method==='GET')return {plans:await rows(env,'SELECT * FROM plans WHERE trainer_id=?',u.id),sales:await rows(env,'SELECT product,currency,sum(amount) AS amount,count(*) AS count FROM payments WHERE product IN (SELECT id FROM plans WHERE trainer_id=?) GROUP BY product,currency',u.id),balance:await rows(env,'SELECT currency,sum(amount) AS amount FROM payables WHERE trainer_id=? AND paid_at IS NULL GROUP BY currency',u.id)};
  if(path==='/api/trainer/connect'&&req.method==='POST'){const b=await input(req,z.object({returnUrl:z.string().url().max(2000)}).strict());const base=safeReturn(b.returnUrl,env);let a=await q(env,'SELECT stripe_id FROM trainer_accounts WHERE user_id=?',u.id).first();if(!a){const created=await stripe(env,'accounts',{type:'express',email:u.email,'capabilities[card_payments][requested]':'true','capabilities[transfers][requested]':'true'},'POST','trainer-'+u.id);await q(env,'INSERT INTO trainer_accounts(user_id,stripe_id) VALUES(?,?) ON CONFLICT DO NOTHING',u.id,created.id).run();a=await q(env,'SELECT stripe_id FROM trainer_accounts WHERE user_id=?',u.id).first();}return stripe(env,'account_links',{account:a.stripe_id,type:'account_onboarding',return_url:base+'#/trainer-plans',refresh_url:base+'#/trainer-plans'});}
  throw fail('Not found',404);
}

export function videoURL(raw) {
  const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password)throw fail('HTTPS video required');
  if(['youtube.com','www.youtube.com','youtu.be','www.youtube-nocookie.com'].includes(u.hostname)){const id=u.hostname==='youtu.be'?u.pathname.slice(1):u.searchParams.get('v')||u.pathname.split('/').at(-1);if(!/^[\w-]{11}$/.test(id))throw fail('Invalid YouTube video');return 'https://www.youtube-nocookie.com/embed/'+id;}
  if(['vimeo.com','player.vimeo.com'].includes(u.hostname)){const id=u.pathname.split('/').at(-1);if(!/^\d+$/.test(id))throw fail('Invalid Vimeo video');return 'https://player.vimeo.com/video/'+id+'?dnt=1';}
  if(!u.pathname.endsWith('.mp4'))throw fail('Use YouTube, Vimeo or MP4');return u.href;
}
export async function adminRound5(req,env,path) {
  await admin(req,env);
  if(path==='/api/admin/business'&&req.method==='PUT'){const b=await input(req,Settings);await env.CONFIG.put('business',JSON.stringify(b));return b;}
  if(path==='/api/admin/promos'&&req.method==='PUT'){const b=await input(req,Promo);await q(env,'INSERT INTO promos(code,json) VALUES(?,?) ON CONFLICT(code) DO UPDATE SET json=excluded.json',b.code,JSON.stringify(b)).run();return {};}
  if(path==='/api/admin/promos'&&req.method==='GET')return {promos:await rows(env,'SELECT * FROM promos')};
  if(path==='/api/admin/plans'&&req.method==='GET')return {plans:await rows(env,'SELECT * FROM plans'),balances:await rows(env,'SELECT trainer_id,currency,sum(amount) AS amount FROM payables WHERE paid_at IS NULL GROUP BY trainer_id,currency'),payables:await rows(env,'SELECT * FROM payables WHERE paid_at IS NULL')};
  if(path==='/api/admin/plans'&&req.method==='PUT'){const b=await input(req,z.object({id:pid,status:z.enum(['approved','rejected'])}).strict());await q(env,'UPDATE plans SET status=? WHERE id=?',b.status,b.id).run();return {};}
  if(path==='/api/admin/payout'&&req.method==='POST'){const b=await input(req,z.object({id:uuid}).strict());await q(env,'UPDATE payables SET paid_at=? WHERE payment_id=? AND paid_at IS NULL',Date.now(),b.id).run();return {};}
  if(path==='/api/admin/videos'&&req.method==='PUT'){const b=await input(req,z.object({id:z.enum(Object.keys(EX)),url:z.string().url().max(2000)}).strict());await q(env,'INSERT INTO videos(id,url) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET url=excluded.url',b.id,videoURL(b.url)).run();return {};}
  if(path==='/api/admin/dashboard'&&req.method==='GET'){
    const now=Date.now();return {members:await q(env,"SELECT count(*) AS total,sum(created_at>?) AS new7,sum(created_at>?) AS new30,sum(role='trainer') AS trainers,sum(pro_until>?) AS pro FROM users",now-7*86400000,now-30*86400000,now).first(),revenue:await rows(env,"SELECT date(created_at/1000,'unixepoch') AS day,currency,sum(amount) AS amount FROM payments WHERE created_at>? GROUP BY day,currency ORDER BY day",now-30*86400000),sales:await rows(env,'SELECT product,method,currency,count(*) AS count,sum(amount) AS amount FROM payments GROUP BY product,method,currency'),conversion:await q(env,'SELECT count(DISTINCT payments.user_id) AS buyers FROM payments JOIN users ON users.id=payments.user_id').first(),events:await rows(env,'SELECT name,sum(count) AS count FROM telemetry_daily GROUP BY name'),errors:await rows(env,'SELECT * FROM errors ORDER BY count DESC LIMIT 20')};
  }
  throw fail('Not found',404);
}
export async function media(req,env,path) {
  const id=z.enum(Object.keys(EX)).parse(path.split('/').at(-1));
  if(req.method==='PUT'){
    await admin(req,env);if(!env.MEDIA)throw fail('MEDIA binding required',503);
    if(req.headers.get('Content-Type')!=='video/mp4')throw fail('MP4 required');
    const reader=req.body?.getReader();if(!reader)throw fail('Missing video');const chunks=[];let size=0;
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>25*1024*1024){await reader.cancel();throw fail('Max video size is 25 MB',413);}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    if(size<12||new TextDecoder().decode(bytes.slice(4,8))!=='ftyp')throw fail('Invalid MP4');
    await env.MEDIA.put(id+'.mp4',bytes,{httpMetadata:{contentType:'video/mp4'}});
    const url=new URL(req.url).origin+'/api/media/'+id;
    await q(env,'INSERT INTO videos(id,url) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET url=excluded.url',id,url).run();return {url};
  }
  if(req.method!=='GET')throw fail('Method not allowed',405);
  const obj=await env.MEDIA?.get(id+'.mp4');if(!obj)throw fail('Not found',404);
  return new Response(obj.body,{headers:{'Content-Type':'video/mp4','Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}});
}
