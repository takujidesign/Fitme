import assert from 'node:assert/strict';
import worker from './src/index.js';
import {testDB} from './test-db.mjs';
import {hash} from './src/security.js';
const {db,DB}=testDB(),kv=new Map([['beta',JSON.stringify({enabled:false})]]);
kv.set('settings',JSON.stringify({receiverName:'Fixmee'}));kv.set('growth',JSON.stringify({appUrl:'https://fixmee.app/'}));
const env={DB,TOKEN_SECRET:'test-signing',ADMIN_PASSWORD:'test-admin',STRIPE_SECRET_KEY:'sk_test_mock',STRIPE_WEBHOOK_SECRET:'whsec_mock',CONFIG:{get:async(k,t)=>kv.has(k)?t==='json'?JSON.parse(kv.get(k)):kv.get(k):null,put:async(k,v)=>kv.set(k,v)}};
const id='round10-install-0001';
async function call(path,body,method=body===undefined?'GET':'POST',token=''){const r=await worker.fetch(new Request('https://test/api/'+path+(path.includes('?')?'&':'?')+'installId='+id,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)}),env);return {...await r.json(),status:r.status};}
const sessions={};let calls=0,created;
globalThis.fetch=async(url,opts)=>{calls++;assert.equal(opts.headers.Authorization,'Bearer sk_test_mock');if(url==='https://api.stripe.com/v1/checkout/sessions'){created=Object.fromEntries(new URLSearchParams(opts.body));const id='cs_test_'+String(calls).padStart(12,'0');sessions[id]={id,url:'https://checkout.stripe.com/c/pay/'+id,payment_status:'unpaid',amount_total:Number(created['line_items[0][price_data][unit_amount]']),currency:'thb',metadata:{kind:created['metadata[kind]'],owner:created['metadata[owner]'],note:created['metadata[note]']}};return Response.json(sessions[id]);}const m=url.match(/checkout\/sessions\/(cs_[A-Za-z0-9_]+)$/);if(m&&sessions[m[1]])return Response.json(sessions[m[1]]);return Response.json({error:{message:'not found'}},{status:404});};
async function webhook(event){const raw=JSON.stringify(event),t=Math.floor(Date.now()/1000),key=await crypto.subtle.importKey('raw',new TextEncoder().encode('whsec_mock'),{name:'HMAC',hash:'SHA-256'},false,['sign']),sig=[...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(t+'.'+raw)))].map(b=>b.toString(16).padStart(2,'0')).join('');return worker.fetch(new Request('https://test/api/stripe/webhook',{method:'POST',headers:{'Stripe-Signature':`t=${t},v1=${sig}`},body:raw}),env);}
const login=await call('admin/login',{password:'test-admin'}),admin=login.token;assert(admin);
const publicConfig=await call('config');assert.equal(publicConfig.config.freeMode,true);
assert.equal((await call('admin/ideas')).status,401);
for(let i=0;i<3;i++)assert.equal((await call('ideas',{title:'Idea '+i,detail:'<script>no html</script>',category:'ai'})).status,200);
assert.equal((await call('ideas',{title:'Fourth',detail:'details',category:'other'})).status,429);
assert.equal((await call('ideas')).ideas.length,0);
const ideas=(await call('admin/ideas',undefined,'GET',admin)).ideas,idea=ideas[0].id;
assert.equal((await call('admin/ideas',{id:idea,status:'approved'},'PUT',admin)).status,200);
assert.equal((await call('ideas')).ideas.length,1);
await call('ideas/'+idea+'/vote',{voted:true});await call('ideas/'+idea+'/vote',{voted:true});assert.equal((await call('ideas')).ideas[0].votes,1);
await call('ideas/'+idea+'/vote',{voted:false});await call('ideas/'+idea+'/vote',{voted:false});assert.equal((await call('ideas')).ideas[0].votes,0);
assert.equal((await call('donate/stripe',{amount:5})).status,400);assert.equal((await call('donate/stripe',{amount:99.5})).status,400);assert.equal(calls,0);
const checkout=await call('donate/stripe',{amount:99,note:'thanks'});assert.equal(checkout.status,200);assert(checkout.url.startsWith('https://checkout.stripe.com/'));
assert.equal(created.mode,'payment');assert.equal(created['line_items[0][price_data][currency]'],'thb');assert.equal(created['line_items[0][price_data][unit_amount]'],'9900');assert.equal(created['metadata[owner]'],'install:'+id);assert.equal(created.success_url,'https://fixmee.app/#/support?session={CHECKOUT_SESSION_ID}');
const sid=Object.keys(sessions)[0];
const pending=await call('donate/stripe/confirm?session='+sid);assert.equal(pending.pending,true);assert.equal(db.prepare('SELECT count(*) n FROM donations').get().n,0);
assert.equal((await call('donate/stripe/confirm?session=bad')).status,400);
sessions[sid].payment_status='paid';
const donation=await call('donate/stripe/confirm?session='+sid);assert.equal(donation.status,200);assert(donation.token);assert.equal(donation.supporter.amount,99);
// The webhook for the same session, and a repeated return check, never count it twice.
assert.equal((await webhook({id:'evt_1',type:'checkout.session.completed',created:Math.floor(Date.now()/1000),data:{object:sessions[sid]}})).status,200);
assert.equal((await call('donate/stripe/confirm?session='+sid)).supporter.amount,99);assert.equal(db.prepare('SELECT count(*) n FROM donations').get().n,1);
assert.equal(db.prepare('SELECT method,ref,note FROM donations').get().method,'stripe');
// A session paid through the webhook alone also records it; another install cannot confirm someone else's session.
await call('donate/stripe',{amount:39});const sid2=Object.keys(sessions)[1];sessions[sid2].payment_status='paid';
assert.equal((await webhook({id:'evt_2',type:'checkout.session.async_payment_succeeded',created:Math.floor(Date.now()/1000),data:{object:sessions[sid2]}})).status,200);
assert.equal(db.prepare('SELECT count(*) n FROM donations').get().n,2);assert.equal(db.prepare('SELECT amount FROM supporters WHERE owner=?').get('install:'+id).amount,138);
const other=await worker.fetch(new Request('https://test/api/donate/stripe/confirm?session='+sid+'&installId=round10-install-9999'),env);assert.equal(other.status,404);
assert.equal((await worker.fetch(new Request('https://test/api/stripe/webhook',{method:'POST',headers:{'Stripe-Signature':'t=1,v1=00'},body:'{}'}),env)).status,401);
await call('ideas/'+idea+'/vote',{voted:true});assert.equal((await call('ideas')).ideas[0].votes,2);
const [body,sig]=donation.token.split('.'),enc=new TextEncoder();const key=await crypto.subtle.importKey('raw',enc.encode(env.TOKEN_SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']);assert(await crypto.subtle.verify('HMAC',key,Uint8Array.from(atob(sig),c=>c.charCodeAt(0)),enc.encode(body)));assert.equal(JSON.parse(atob(body)).type,'supporter');
const grant=await call('admin/donations',{amount:39,note:'manual'},'POST',admin);assert(grant.code);assert.equal((await call('supporter/claim',{code:grant.code})).status,200);assert.equal((await call('supporter/claim',{code:grant.code})).status,409);
const report=await call('admin/donations',undefined,'GET',admin);assert.equal(report.months[0].amount,177);
await call('admin/ideas',{id:ideas[1].id,status:'approved'},'PUT',admin);await call('admin/ideas',{id:idea,status:'merged',mergeInto:ideas[1].id},'PUT',admin);assert.equal((await call('ideas')).ideas.length,1);assert.equal((await call('ideas')).ideas[0].votes,2);
console.log('PASS Round 10: local migration, free default, admin authentication, pending/public approval, rate limit, idempotent vote/unvote, supporter double vote, Stripe Checkout donation (amount checks, pending, paid return check, webhook, no double count, owner check, bad signature), HMAC token, one-time code, monthly totals, merge. All provider calls mocked.');db.close();
