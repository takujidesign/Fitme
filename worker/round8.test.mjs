import assert from 'node:assert/strict';
import worker, {readConfig} from './src/index.js';
import {testDB} from './test-db.mjs';
import {hash} from './src/security.js';
import {AI_DEFAULTS,AIConfig,aiCall,stableJSON,PREAMBLE} from './src/ai.js';
import {creditOwner,credits,reserve,refund} from './src/ai-credits.js';
import {recordPayment} from './src/round5.js';
const {db,DB}=testDB(),kv=new Map([['beta',JSON.stringify({enabled:false})]]);
const env={DB,TOKEN_SECRET:'test-secret',ADMIN_PASSWORD:'test-admin',ANTHROPIC_API_KEY:'mock-key',CONFIG:{get:async(k,t)=>kv.has(k)?t==='json'?JSON.parse(kv.get(k)):kv.get(k):null,put:async(k,v)=>kv.set(k,v)}};
const now=Date.now(),day=86400000,token='a'.repeat(64);
db.prepare('INSERT INTO users(id,email,pass_hash,pass_salt,created_at) VALUES(?,?,?,?,?)').run('alice','a@example.test','unused','unused',now);
db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await hash(token),'alice',now+365*day);
const req=(path,body,bearer=token,method=body===undefined?'GET':'POST')=>new Request('https://test/api/'+path,{method,headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
const call=(...args)=>worker.fetch(req(...args),env);
const config=structuredClone(AI_DEFAULTS);
assert(AIConfig.safeParse(config).success);
for(const change of [{model:'other-model'},{effort:'extreme'},{maxTokens:0}])assert(!AIConfig.safeParse({...config,chat:{...config.chat,...change}}).success);
assert(PREAMBLE.split(/\s+/).length>512);
assert.equal(stableJSON({z:{b:2,a:1},a:3}),stableJSON({a:3,z:{a:1,b:2}}));
let c=await creditOwner(req('ai/credits'),env,()=>null,config,now);
assert.equal((await credits(env,c,now)).remaining,10);
const once=await reserve(env,c,3,now);await refund(env,once);await refund(env,once);assert.equal((await credits(env,c,now)).remaining,10);
await reserve(env,c,10,now);
c=await creditOwner(req('ai/credits'),env,()=>null,config,now+day);assert.equal((await credits(env,c,now)).remaining,0,'trial is never regranted');
assert.equal((await call('ai/credits',undefined,'')).status,402);
await assert.rejects(reserve(env,c,1,now),e=>e.status===402&&e.code==='no_credits');
// Paid 90-day membership resets in 30-day windows anchored to the purchase.
db.prepare('UPDATE users SET pro_until=? WHERE id=?').run(now+90*day,'alice');
db.prepare('INSERT INTO ai_periods VALUES(?,?)').run('alice',now);
c=await creditOwner(req('ai/credits'),env,()=>null,config,now);assert.equal((await credits(env,c,now)).remaining,60);
await reserve(env,c,60,now);
const before=await creditOwner(req('ai/credits'),env,()=>null,config,now+30*day-1);assert.equal((await credits(env,before,now+30*day-1)).remaining,0);
const reset=await creditOwner(req('ai/credits'),env,()=>null,config,now+30*day);assert.equal((await credits(env,reset,now+30*day)).remaining,60);
assert.equal(reset.reset,new Date(now+60*day).toISOString());
// Spend allowance before top-ups, then the earliest expiry; expired credits cannot be used.
const pool={...c,owner:'pool',period:new Date(now).toISOString()};
db.prepare('INSERT INTO ai_credits VALUES(?,?,?,0)').run('pool',pool.period,2);
for(const [id,total,expires] of [['old',3,now+day],['new',8,now+2*day],['expired',100,now-1]])db.prepare('INSERT INTO ai_topups VALUES(?,?,?,0,?)').run(id,'pool',total,new Date(expires).toISOString());
const allocation=await reserve(env,pool,6,now);
assert.equal(db.prepare('SELECT used FROM ai_credits WHERE owner=?').get('pool').used,2);
assert.equal(db.prepare('SELECT used FROM ai_topups WHERE id=?').get('old').used,3);
assert.equal(db.prepare('SELECT used FROM ai_topups WHERE id=?').get('new').used,1);
assert.equal(db.prepare('SELECT used FROM ai_topups WHERE id=?').get('expired').used,0);
await refund(env,allocation);assert.equal((await credits(env,pool,now)).remaining,13);
const concurrent={...c,owner:'concurrent',period:'trial'};db.prepare("INSERT INTO ai_credits VALUES('concurrent','trial',10,0)").run();
const attempts=await Promise.allSettled(Array.from({length:20},()=>reserve(env,concurrent,3,now)));
assert.equal(attempts.filter(v=>v.status==='fulfilled').length,3);assert.equal((await credits(env,concurrent,now)).remaining,1);
// SDK transport is mocked: exercise actual messages.parse + zodOutputFormat conversion.
db.prepare("UPDATE ai_credits SET used=0 WHERE owner='alice'").run();
let sent=[],mode='normal';
globalThis.fetch=async(url,opts)=>{
 assert(String(url).includes('anthropic'));const body=JSON.parse(opts.body);sent.push(body);
 if(mode==='network')throw new Error('offline');
 const broken=mode==='bad'||mode==='fallback'&&body.model==='claude-haiku-5-5';
 return Response.json({id:'msg_mock',type:'message',role:'assistant',model:body.model,stop_reason:mode==='refusal'?'refusal':mode==='max_tokens'?'max_tokens':'end_turn',content:[{type:'text',text:broken||mode==='max_tokens'?'not JSON':JSON.stringify({advice:[],swaps:[],warnings:[]})}],usage:{input_tokens:120,output_tokens:40,cache_read_input_tokens:80,cache_creation_input_tokens:20}});
};
const input={lang:'th',profile:{age:30},targets:{},meals:[],supplements:[]};
let r=await call('ai/plan-review',input);assert.equal(r.status,200);assert.equal((await r.json()).creditsLeft,68);
assert.equal(sent.at(-1).model,'claude-sonnet-5-5');assert.equal(sent.at(-1).max_tokens,2500);assert.equal(sent.at(-1).output_config.effort,'low');
const system=sent.at(-1).system;assert.equal(system[0].cache_control.type,'ephemeral');
await call('ai/plan-review',{...input,lang:'ja',profile:{age:47}});assert.deepEqual(sent.at(-1).system,system);
const login=await (await call('admin/login',{password:env.ADMIN_PASSWORD},'')).json();
config.planReview={model:'claude-haiku-5-5',effort:'high',maxTokens:777};
r=await call('admin/ai',config,login.token,'PUT');assert.equal(r.status,200);
mode='fallback';const balance=(await (await call('ai/credits')).json()).remaining;
r=await call('ai/plan-review',input);assert.equal(r.status,200);assert.equal((await r.json()).creditsLeft,balance-2);
assert.equal(sent.at(-2).model,'claude-haiku-5-5');assert.equal(sent.at(-1).model,'claude-sonnet-5-5');assert.equal(sent.at(-1).max_tokens,777);assert.equal(sent.at(-1).output_config.effort,'high');
for(const field of ['temperature','top_p','top_k'])assert.equal(sent.at(-2)[field],undefined);
for(const failure of ['refusal','max_tokens','bad','network']){mode=failure;const before=(await (await call('ai/credits')).json()).remaining,n=sent.length;r=await call('ai/plan-review',input);assert(r.status>=400);assert.equal((await (await call('ai/credits')).json()).remaining,before);if(['refusal','max_tokens'].includes(failure)){assert.equal(r.status,422);assert.equal(sent.length,n+1,'no fallback for refusal/truncation');}}
mode='normal';
const dashboard=await (await call('admin/ai',undefined,login.token)).json();assert(dashboard.dashboard.fallbacks>=2);assert(dashboard.dashboard.totals.cacheHitRate>0);assert(dashboard.dashboard.byModel.length>=2);
assert.equal((await call('admin/ai',undefined,'')).status,401);
assert.equal((await call('admin/ai',{...config,chat:{...config.chat,model:'unapproved'}},login.token,'PUT')).status,400);
const cols=db.prepare('PRAGMA table_info(ai_usage)').all().map(v=>v.name);assert(!cols.some(v=>/prompt|photo|context|message/.test(v)));
assert(!JSON.stringify(db.prepare('SELECT * FROM ai_usage').all()).includes('profile'));
// Top-up purchases are granted exactly once and quoted quantities survive config edits.
const order=await (await call('quote',{productId:'credits40',currency:'thb'})).json();assert.equal(order.amount,49);
const o=db.prepare('SELECT * FROM orders WHERE id=?').get(order.orderId);
const quotedSettings=kv.get('settings');const changed=JSON.parse(quotedSettings);changed.ai.credits.topup=999;changed.ai.credits.topupDays=1;kv.set('settings',JSON.stringify(changed));
await recordPayment(env,o,'stripe','test-topup');kv.set('settings',quotedSettings);await recordPayment(env,o,'stripe','test-topup');
assert.equal(db.prepare('SELECT count(*) n FROM ai_topups WHERE id=?').get(o.id).n,1);assert.equal(db.prepare('SELECT credits FROM ai_topups WHERE id=?').get(o.id).credits,40);
// Chat uses automatic history caching, separate suggestion model, and stable context JSON.
let chatSent=[];
globalThis.fetch=async(url,opts)=>{const body=JSON.parse(opts.body);chatSent.push(body);return Response.json({id:'msg_chat',type:'message',role:'assistant',model:body.model,stop_reason:'end_turn',content:[{type:'text',text:body.output_config.format?JSON.stringify({suggestions:[]}):'Try to change your session duration.'}],usage:{input_tokens:10,output_tokens:10}});};
db.prepare("DELETE FROM ai_limits WHERE owner='alice'").run();
r=await call('ai/chat',{messages:[{role:'user',text:'Please change my plan'}],context:{language:'en',goal:'cut'}});assert.equal(r.status,200);assert.equal(chatSent[0].cache_control.type,'ephemeral');assert.equal(chatSent[0].model,'claude-sonnet-5-5');assert.equal(chatSent[1].model,'claude-haiku-5-5');assert.equal(chatSent[1].max_tokens,600);
const firstContext=chatSent[0].messages[0];
await call('ai/chat',{messages:[{role:'user',text:'Please change my plan'},{role:'assistant',text:'Try to change your session duration.'},{role:'user',text:'Why?'}],context:{goal:'cut',language:'en'}});
assert.deepEqual(chatSent[2].messages[0],firstContext);assert.deepEqual(chatSent[2].system,chatSent[0].system);
assert.equal((await call('ai/chat',{messages:[{role:'assistant',text:'Prefill'}],context:{}})).status,400);
// HTTP no_credits and per-owner rate cap occur without contacting the provider.
db.prepare("UPDATE ai_credits SET used=granted WHERE owner='alice'").run();db.prepare("UPDATE ai_topups SET used=credits WHERE owner='alice'").run();
r=await call('ai/plan-review',input);assert.equal(r.status,402);assert.equal((await r.json()).code,'no_credits');
db.prepare('INSERT INTO ai_limits VALUES(?,?,30) ON CONFLICT(owner,bucket) DO UPDATE SET count=30').run('alice',Math.floor(Date.now()/3600000));r=await call('ai/plan-review',input);assert.equal(r.status,429);
// Subscription entitlement uses the same period grant, without stacking credits.
db.prepare('INSERT INTO users(id,email,pass_hash,pass_salt,created_at) VALUES(?,?,?,?,?)').run('subscriber','sub@example.test','unused','unused',now);
const subToken='b'.repeat(64);db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(await hash(subToken),'subscriber',now+day);
db.prepare("INSERT INTO subscriptions VALUES('sub_mock','subscriber','cus_mock','active',?,0)").run(now+30*day);
const sub=await creditOwner(req('ai/credits',undefined,subToken),env,()=>null,config,now);assert.equal((await credits(env,sub,now)).remaining,70);
// No free trial for a guest purchase wallet.
const guestOrder=crypto.randomUUID();db.prepare("INSERT INTO orders(id,product,amount,currency,share,days,created_at,expires_at,paid) VALUES(?,'credits40',4900,'thb',70,0,?,?,1)").run(guestOrder,now,now+day);
db.prepare("INSERT INTO payments(id,product,amount,currency,method,ref,created_at) VALUES(?,'credits40',4900,'thb','stripe','guest-ref',?)").run(guestOrder,now);
const guest=await creditOwner(req('ai/credits',undefined,'guest'),env,async()=>({ref:'guest-ref',until:null}),config,now);assert.equal((await credits(env,guest,now)).remaining,0);assert.equal(db.prepare('SELECT count(*) n FROM ai_credits WHERE owner=?').get(guest.owner).n,0);
console.log('PASS Round 8: migration, config allowlist, SDK models/cache/language stability, atomic reserve/refund/concurrency, trial, 30-day reset, top-up ordering/expiry/idempotency, no_credits, hourly cap, usage privacy, admin access/dashboard, subscription allowance.');
db.close();
