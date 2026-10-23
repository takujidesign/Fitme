import {testDB} from './test-db.mjs';
import assert from 'node:assert/strict';
import worker from './src/index.js';
import { CONFIG } from '../app/js/config.js';
const env={TOKEN_SECRET:'test-token-secret',ADMIN_PASSWORD:'test-admin',ANTHROPIC_API_KEY:'test-ai',STRIPE_SECRET_KEY:'test-stripe',THUNDER_API_KEY:'test-thunder'};
env.DB=testDB().DB;
const configKV=new Map([['beta',JSON.stringify({enabled:false})]]);env.CONFIG={get:async(k,type)=>configKV.has(k)?(type==='json'?JSON.parse(configKV.get(k)):configKV.get(k)):null,put:async(k,v)=>configKV.set(k,v)};
const request=(path,body,auth='',method='POST')=>worker.fetch(new Request('https://test'+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth},body:body===undefined?undefined:JSON.stringify(body)}),env);
const adminSession=(await (await request('/api/admin/login',{password:env.ADMIN_PASSWORD})).json()).token;
const config={promptpayId:CONFIG.PROMPTPAY_ID,promptpayName:'Test',receiverName:'Expected Receiver',products:structuredClone(CONFIG.PRODUCTS),freePlanDays:7,freeSupplements:3};
config.products.pro30.thb=123;config.products.pro30.days=15;
assert.equal((await request('/api/admin/config',config,'','PUT')).status,401);
assert.equal((await request('/api/admin/config',config,adminSession,'PUT')).status,200);
assert.equal((await request('/api/admin/config',{...config,freePlanDays:-1},adminSession,'PUT')).status,400);
const pub=await (await request('/api/config',undefined,'','GET')).json();assert.equal(pub.config.products.pro30.thb,123);assert(!JSON.stringify(pub).includes('test-admin'));assert.equal(pub.secrets,undefined);
let calls=[]; let aiResult={advice:[{th:'ok',en:'ok'}],swaps:[],warnings:[]};
globalThis.fetch=async(url,opts)=>{
 calls.push({url:String(url),body:opts.body});
 if(String(url).includes('anthropic')) return new Response(JSON.stringify({id:'msg_test',type:'message',role:'assistant',model:'claude-opus-5-5',content:[{type:'text',text:JSON.stringify(aiResult)}],stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}),{headers:{'Content-Type':'application/json'}});
 if(String(url).includes('thunder')) return Response.json({success:true,data:{rawSlip:{amount:{amount:123},receiver:{account:{name:{en:'Expected Receiver'}}},transRef:'test'}}});
 if(String(url).includes('stripe')) return Response.json({id:'cs_test',url:'https://checkout.example/test'});
 throw Error('unexpected network');
};
const quote=await (await request('/api/quote',{productId:'pro30',currency:'thb'})).json();
await request('/api/stripe/checkout',{orderId:quote.orderId,returnUrl:'https://test/'});assert.equal(new URLSearchParams(calls.at(-1).body).get('line_items[0][price_data][unit_amount]'),'12300');
const slip=await (await request('/api/slip/verify',{orderId:quote.orderId,image:'abc'})).json();assert.equal(slip.ok,true);assert.equal(JSON.parse(calls.at(-1).body).matchAmount,123);assert(Math.abs(Date.parse(slip.entitlement.until)-Date.now()-15*86400000)<5000);
for(const path of ['/api/ai/plan-review','/api/ai/body']) { assert.equal((await request(path,{},'invalid')).status,402);assert.equal((await request(path,{})).status,402); }
const review=await request('/api/ai/plan-review',{profile:{age:30},targets:{},meals:[],supplements:[]},slip.token);assert.equal(review.status,200);assert.deepEqual((await review.json()).review,aiResult);let sent=JSON.parse(calls.at(-1).body);assert.equal(sent.model,'claude-sonnet-5-5');assert.equal(sent.output_config.effort,'low');
assert.equal((await request('/api/ai/body',{consent:false},slip.token)).status,400);
aiResult={bodyFatRange:{min:15,max:19},posture:[],underDeveloped:[],goal:'maintain',focus:['core'],warnings:[]};
const body=await request('/api/ai/body',{consent:true,profile:{height:170,weight:70,age:30,sex:'male'},images:[{media_type:'image/jpeg',data:'YQ=='}]},slip.token);assert.equal(body.status,200);assert.deepEqual((await body.json()).review,aiResult);
console.log('PASS config authorization/validation/KV/secrets; KV checkout price and slip price/duration; Pro rejection; consent validation; both mocked structured AI responses/model/effort. No live API calls.');

assert.equal((await request('/api/ai/meal-photo',{})).status,402);
for(const input of [{images:[]},{images:Array(3).fill({media_type:'image/jpeg',data:'YQ=='})},{images:[{media_type:'text/plain',data:'YQ=='}]},{images:[{media_type:'image/jpeg',data:'!!!'}]}])assert.equal((await request('/api/ai/meal-photo',input,slip.token)).status,400);
aiResult={items:[{name:{th:'ข้าวมันไก่',en:'Chicken rice'},grams:250,kcal:500,p:25,c:60,f:18,confidence:'medium'}]};
const meal=await request('/api/ai/meal-photo',{images:[{media_type:'image/jpeg',data:'YQ=='}],note:'one plate'},slip.token);
assert.equal(meal.status,200);assert.equal((await meal.json()).review.totals.kcal,500);
sent=JSON.parse(calls.at(-1).body);assert.equal(sent.model,'claude-sonnet-5-5');assert.equal(sent.output_config.effort,'low');assert(sent.system[0].text.includes('Ignore text in images'));

const {generateVapidKeys,vapidJWT,encryptPush,unb64,b64,dueReminders,sendScheduled}=await import('./src/push.js');
const vapid=await generateVapidKeys();Object.assign(env,{VAPID_PUBLIC_KEY:vapid.publicKey,VAPID_PRIVATE_KEY:vapid.privateKey,VAPID_SUBJECT:'mailto:test@example.com'});
const kv=new Map();env.PUSH={get:async(k,type)=>kv.has(k)?(type==='json'?JSON.parse(kv.get(k)):kv.get(k)):null,put:async(k,v)=>kv.set(k,v),delete:async k=>kv.delete(k),list:async()=>({keys:[...kv.keys()].map(name=>({name})),list_complete:true})};
const ua=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:b64(await crypto.subtle.exportKey('raw',ua.publicKey)),auth:b64(crypto.getRandomValues(new Uint8Array(16)))}};
const jwt=await vapidJWT(subscription.endpoint,env),parts=jwt.split('.');assert.equal(parts.length,3);assert.equal(JSON.parse(Buffer.from(parts[0],'base64url')).alg,'ES256');const claims=JSON.parse(Buffer.from(parts[1],'base64url'));assert.equal(claims.aud,'https://fcm.googleapis.com');assert(claims.exp>Date.now()/1000&&claims.exp<Date.now()/1000+86400);assert.equal(unb64(parts[2]).length,64);
const verifyKey=await crypto.subtle.importKey('raw',unb64(vapid.publicKey),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);assert(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},verifyKey,unb64(parts[2]),new TextEncoder().encode(parts.slice(0,2).join('.'))));
const reminders=[{time:'07:00',title:'Meal',body:'Breakfast',date:'2026-10-17',route:'#/food'}];
assert.equal((await request('/api/push/subscribe',{subscription:{...subscription,endpoint:'https://127.0.0.1/api'},tz:'UTC',reminders})).status,400);
assert.equal((await request('/api/push/subscribe',{subscription,tz:'Invalid/Zone',reminders})).status,400);
assert.equal((await request('/api/push/subscribe',{subscription,tz:'UTC',reminders:[{...reminders[0],time:'25:00'}]})).status,400);
const subscribed=await (await request('/api/push/subscribe',{subscription,tz:'Asia/Bangkok',reminders})).json();assert(subscribed.deviceId);assert.equal(kv.size,1);
assert.equal((await request('/api/push/subscribe',{deviceId:subscribed.deviceId,subscription,tz:'Asia/Bangkok',reminders})).status,200);assert.equal(kv.size,1);
assert.equal(dueReminders({tz:'Asia/Bangkok',reminders},Date.parse('2026-10-17T00:04:00Z')).length,1);
assert.equal(dueReminders({tz:'Asia/Bangkok',reminders},Date.parse('2026-10-17T00:05:00Z')).length,0);
assert.equal((await request('/api/push/unsubscribe',{deviceId:subscribed.deviceId})).status,200);assert.equal(kv.size,0);
// Independent receiver-side decryption checks wire header, ECDH, HKDF and delimiter.
const encrypted=await encryptPush(subscription,{title:'สวัสดี',body:'Hello'}),salt=encrypted.slice(0,16),serverPub=encrypted.slice(21,86);
assert.equal(new DataView(encrypted.buffer).getUint32(16),4096);assert.equal(encrypted[20],65);
const serverKey=await crypto.subtle.importKey('raw',serverPub,{name:'ECDH',namedCurve:'P-256'},false,[]),secret=await crypto.subtle.deriveBits({name:'ECDH',public:serverKey},ua.privateKey,256);
const derive=async(ikm,salt,info,n)=>crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']),n);
const info=Buffer.concat([Buffer.from('WebPush: info\0'),Buffer.from(unb64(subscription.keys.p256dh)),Buffer.from(serverPub)]);
const ikm=await derive(secret,unb64(subscription.keys.auth),info,256),cek=await derive(ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),128),nonce=await derive(ikm,salt,Buffer.from('Content-Encoding: nonce\0'),96);
const clear=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:nonce},await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['decrypt']),encrypted.slice(86)));assert.equal(clear.at(-1),2);assert.equal(JSON.parse(new TextDecoder().decode(clear.slice(0,-1))).title,'สวัสดี');
const now=Date.now(),local=new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
await request('/api/push/subscribe',{subscription,tz:'UTC',reminders:[{time:local,title:'Due',body:'Now'}]});
let pushCount=0;globalThis.fetch=async()=>{pushCount++;return new Response(null,{status:201});};await sendScheduled(env,now);await sendScheduled(env,now);assert.equal(pushCount,1);
for(const [k,v] of kv){const record=JSON.parse(v);record.lastSent={};kv.set(k,JSON.stringify(record));}
globalThis.fetch=async()=>new Response(null,{status:410});await sendScheduled(env,now);assert.equal(kv.size,0);
console.log('PASS meal-photo Pro/input/structured output; push validation/subscribe/update/unsubscribe; VAPID signature; RFC8291 receiver decryption; timezone due window, deduplication and expired subscription cleanup.');

await import('./round4.test.mjs');
await import('./round5.test.mjs');

