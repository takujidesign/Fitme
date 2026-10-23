import assert from 'node:assert/strict';
import worker from './src/index.js';
import {testDB} from './test-db.mjs';
import {betaDefaults} from '../app/js/beta-policy.js';
import {hash} from './src/security.js';
import {generateVapidKeys,b64,dueReminders,sendScheduled} from './src/push.js';
const {db,DB}=testDB(),kv=new Map(),push=new Map();
const storage=map=>({get:async(k,t)=>map.has(k)?t==='json'?JSON.parse(map.get(k)):map.get(k):null,put:async(k,v)=>map.set(k,v),delete:async k=>map.delete(k),list:async()=>({keys:[...map.keys()].map(name=>({name})),list_complete:true})});
const env={DB,CONFIG:storage(kv),PUSH:storage(push),ADMIN_PASSWORD:'mock-admin',ANTHROPIC_API_KEY:'mock-claude',GEMINI_API_KEY:'mock-gemini',RESEND_API_KEY:'mock-resend',VAPID_SUBJECT:'mailto:push@example.test'};
let requests=[];
globalThis.fetch=async(url,options)=>{requests.push(String(url));if(String(url).includes('anthropic'))return Response.json({id:'mock',type:'message',role:'assistant',model:'claude-haiku-5-5',content:[{type:'text',text:JSON.stringify({text:'Mock chat',suggestions:[]})}],stop_reason:'end_turn',usage:{input_tokens:10,output_tokens:5}});if(String(url).includes('generativelanguage'))return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({text:'Mock chat',suggestions:[]})}]}}],usageMetadata:{promptTokenCount:10,candidatesTokenCount:5}});if(String(url).startsWith('https://fcm.googleapis.com/'))return new Response('',{status:201});throw Error('Unexpected external service: '+url);};
const call=async(path,body,token='',method=body===undefined?'GET':'POST',headers={})=>{const res=await worker.fetch(new Request('https://example.test/api/'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)}),env);return {status:res.status,data:await res.json()};};
for(const path of ['ai/chat','ai/meal-photo','ai/body','ai/plan-review','label/analyze','stripe/checkout','stripe/subscribe','stripe/portal','slip/verify','donate/slip','auth/line/start','line/reminders','auth/forgot','auth/resend']){const r=await call(path,{});assert.equal(r.status,403,path);assert.equal(r.data.code,'beta_disabled');}
assert.equal(requests.length,0);
const admin=(await call('admin/login',{password:env.ADMIN_PASSWORD})).data.token;
const pub=(await call('config')).data.config;assert.deepEqual(pub.beta,betaDefaults());assert.equal(pub.launch.verification,false);
assert.equal((await call('admin/beta',undefined,'bad')).status,401);assert.equal((await call('admin/beta',{enabled:false},admin,'PUT')).status,400);
const user=(await call('auth/register',{email:'tester@example.test',password:'test-password-123',age16:true})).data;
assert(user.token);assert.equal(requests.length,0,'Resend verification skipped');
const preview=await call('ai/plan-review',{},'', 'POST',{'X-Admin-Preview':admin});assert.notEqual(preview.data.code,'beta_disabled');
assert.equal((await call('ai/chat',{},user.token,'POST',{'X-Admin-Preview':'forged'})).data.code,'beta_disabled');
await call('admin/beta',{...betaDefaults(),ai:true},admin,'PUT');assert.notEqual((await call('ai/chat',{},user.token)).data.code,'beta_disabled');assert.equal((await call('ai/body',{},user.token)).data.code,'beta_disabled');
await call('admin/beta',betaDefaults(),admin,'PUT');
for(const engine of ['claude','gemini']){
 const b={engine,task:'ai/chat',prompt:'Synthetic test',model:engine==='claude'?'claude-haiku-5-5':'gemini-2.5-flash',requestId:crypto.randomUUID(),images:[]};
 assert.equal((await call('admin/ai-lab',b,user.token)).status,401);
 const r=await call('admin/ai-lab',b,admin);assert.equal(r.status,200);assert.equal(r.data.validation,'valid',JSON.stringify(r));assert.equal(r.data.tag,'admin_test');assert(r.data.cost>0);assert(r.data.tokens);assert.equal(r.data.requestId,b.requestId);
}
assert.equal(db.prepare('SELECT COUNT(*) n FROM admin_ai_tests').get().n,2);assert.equal(db.prepare('SELECT COUNT(*) n FROM ai_usage').get().n,0);
// Disabled LINE still supports a verified admin's one-time OAuth preview ticket.
kv.set('line',JSON.stringify({lineChannelId:'123',appUrl:'https://example.test',dailyCap:3}));env.ALLOWED_ORIGINS='https://example.test';
const {pkce}=await import('./src/line.js');const {betaGate}=await import('./src/beta.js');const challenge=await pkce('a'.repeat(64));
const ticket=await call('auth/line/preview',{challenge},user.token,'POST',{'X-Admin-Preview':admin});assert.equal(ticket.status,200);
const start=await worker.fetch(new Request(ticket.data.url),env);assert.equal(start.status,302);const state=new URL(start.headers.get('Location')).searchParams.get('state');
await betaGate(new Request('https://example.test/api/auth/line/callback?state='+state+'&code=mock'),env,'/api/auth/line/callback');
assert.equal((await worker.fetch(new Request(ticket.data.url),env)).status,403,'ticket is single use');
await assert.rejects(()=>betaGate(new Request('https://example.test/api/auth/line/callback?state='+'0'.repeat(64)+'&code=mock'),env,'/api/auth/line/callback'),e=>e.code==='beta_disabled');
assert.equal((await call('admin/ai-lab',undefined,admin)).data.usage.length,2);
// Actual scheduler uses a fake clock, real local crypto and mocked push delivery.
const keys=await generateVapidKeys();env.VAPID_PUBLIC_KEY=keys.publicKey;env.VAPID_PRIVATE_KEY=keys.privateKey;
const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);const subscription={endpoint:'https://fcm.googleapis.com/mock',keys:{p256dh:b64(await crypto.subtle.exportKey('raw',pair.publicKey)),auth:b64(crypto.getRandomValues(new Uint8Array(16)))}};
for(const [tz,instant,date,time] of [['Asia/Bangkok','2026-07-01T01:00:00Z','2026-07-01','08:00'],['America/New_York','2026-07-01T12:00:00Z','2026-07-01','08:00'],['America/New_York','2026-01-01T13:00:00Z','2026-01-01','08:00'],['America/New_York','2026-11-01T05:30:00Z','2026-11-01','01:30']]){
 const now=Date.parse(instant),id=crypto.randomUUID();push.clear();push.set('device:'+id,JSON.stringify({subscription,tz,reminders:[{date,time,title:'Mock reminder',body:'Test'}],expires:now+86400000,lastSent:{}}));const before=requests.length;await sendScheduled(env,now);assert.equal(requests.length,before+1,tz);await sendScheduled(env,now+60000);assert.equal(requests.length,before+1,'no duplicates');if(time==='01:30'){await sendScheduled(env,now+3600000);assert.equal(requests.length,before+1,'DST repeated hour not duplicated');}}
const subscribed=await call('push/subscribe',{subscription,tz:'Asia/Bangkok',reminders:[]},user.token);assert.equal(subscribed.status,200);const deviceId=subscribed.data.deviceId;
for(let i=0;i<3;i++)assert.equal((await call('push/test',{deviceId},user.token)).status,200);
assert.equal((await call('push/test',{deviceId},user.token)).status,429);
const other=(await call('auth/register',{email:'other@example.test',password:'test-password-123',age16:true})).data;
assert.equal((await call('push/test',{deviceId},other.token)).status,403);
assert.equal((await call('admin/push-test',{deviceId},admin)).status,200);assert.equal((await call('admin/push-test',{userId:user.user.id},admin)).status,200);
console.log('PASS Round 13 Worker: fail-closed beta, verified admin preview, toggles, skipped mail, mocked Claude/Gemini lab and isolated usage, actual scheduler Bangkok/New York summer/winter/DST deduplication, self-test ownership and 3/hour cap, admin device/user push.');db.close();

