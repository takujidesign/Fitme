import { z } from 'zod/v4';
import { input, fail, getSecret, enc } from './security.js';
import { user, query as q } from './accounts.js';
import { growthSettings } from './growth.js';
// https://docs.stripe.com/webhooks/signature -- verify the exact raw bytes before parsing.
export async function verifySignature(raw,header,secret,now=Date.now()){
 if(!secret||!header)return false;const parts=header.split(','),t=parts.find(s=>s.startsWith('t='))?.slice(2),signatures=parts.filter(s=>s.startsWith('v1=')).map(s=>s.slice(3));if(!/^\d+$/.test(t||'')||Math.abs(now/1000-Number(t))>300)return false;
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);for(const sig of signatures){if(!/^[a-f0-9]{64}$/.test(sig))continue;if(await crypto.subtle.verify('HMAC',key,Uint8Array.from(sig.match(/../g),v=>parseInt(v,16)),enc.encode(t+'.'+raw)))return true;}return false;
}
export async function billing(req,env,path,stripe){
 if(path==='/api/stripe/webhook'){
  if(req.method!=='POST')throw fail('Method not allowed',405);const raw=await req.text();if(raw.length>1048576)throw fail('Request too large',413);if(!await verifySignature(raw,req.headers.get('Stripe-Signature'),await getSecret(env,'stripeWebhookSecret')))throw fail('Invalid Stripe signature',401);
  const event=z.object({id:z.string().max(255),type:z.string(),created:z.number().int(),data:z.object({object:z.record(z.string(),z.unknown())})}).parse(JSON.parse(raw));if(await q(env,'SELECT 1 FROM stripe_events WHERE id=?',event.id).first())return {};
  if(!['checkout.session.completed','invoice.paid','customer.subscription.updated','customer.subscription.deleted'].includes(event.type))return {};
  const o=event.data.object,sid=event.type.startsWith('customer.subscription.')?o.id:o.subscription||o.parent?.subscription_details?.subscription;if(!sid||!/^sub_[A-Za-z0-9]+$/.test(sid))return {};
  // Retrieve current state so delayed/out-of-order notifications never restore a cancelled subscription.
  const s=await stripe(env,'subscriptions/'+sid,null,'GET'),uid=s.metadata?.userId;if(!uid||!await q(env,'SELECT id FROM users WHERE id=?',uid).first())throw fail('Subscription account missing',409);
  const until=Math.max(0,...(s.items?.data||[]).map(i=>Number(i.current_period_end)||0),Number(s.current_period_end)||0)*1000;
  await env.DB.batch([q(env,'INSERT OR IGNORE INTO ai_periods VALUES(?,?)',uid,(Number(s.start_date)||Number(s.current_period_start)||Math.floor(Date.now()/1000))*1000),q(env,'INSERT INTO subscriptions VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,until=excluded.until,cancel_at_end=excluded.cancel_at_end',s.id,uid,typeof s.customer==='string'?s.customer:s.customer.id,s.status,until,+!!s.cancel_at_period_end),...(event.type==='invoice.paid'?[q(env,"INSERT OR IGNORE INTO payments(id,user_id,product,amount,currency,method,ref,promo,created_at) VALUES(?,?,'monthly',?,?,'stripe',?,NULL,?)",o.id,uid,Number(o.amount_paid)||0,o.currency,o.id,event.created*1000)]:[]),q(env,'INSERT OR IGNORE INTO stripe_events VALUES(?,?)',event.id,event.created*1000)]);return {};
 }
 const u=await user(req,env);
 if(path==='/api/subscription'&&req.method==='GET')return {subscriptions:(await q(env,'SELECT status,until,cancel_at_end FROM subscriptions WHERE user_id=?',u.id).all()).results,settings:await growthSettings(env)};
 if(req.method!=='POST')throw fail('Method not allowed',405);
 const s=await growthSettings(env);if(!s.appUrl)throw fail('Configure the public app URL first');
 if(path==='/api/stripe/portal'){await input(req,z.object({}).strict());const row=await q(env,'SELECT customer FROM subscriptions WHERE user_id=? LIMIT 1',u.id).first();if(!row)throw fail('No subscription');return stripe(env,'billing_portal/sessions',{customer:row.customer,return_url:s.appUrl+'#/me'});}
 if(path==='/api/stripe/subscribe'){const b=await input(req,z.object({currency:z.enum(['thb','usd'])}).strict());if(await q(env,"SELECT id FROM subscriptions WHERE user_id=? AND status IN ('active','trialing','past_due','unpaid')",u.id).first())throw fail('Manage your existing subscription in the portal');return stripe(env,'checkout/sessions',{mode:'subscription',client_reference_id:u.id,'subscription_data[metadata][userId]':u.id,'line_items[0][quantity]':'1','line_items[0][price_data][currency]':b.currency,'line_items[0][price_data][unit_amount]':String(Math.round((b.currency==='thb'?s.monthlyTHB:s.monthlyUSD)*100)),'line_items[0][price_data][recurring][interval]':'month','line_items[0][price_data][product_data][name]':'Fixmee Pro monthly',success_url:s.appUrl+'#/me',cancel_url:s.appUrl+'#/pay'},'POST','subscription-'+u.id+'-'+Math.floor(Date.now()/1800000));}
 throw fail('Not found',404);
}
