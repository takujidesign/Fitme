import assert from 'node:assert/strict';
import worker from './src/index.js';
import {testDB} from './test-db.mjs';
import {hash} from './src/security.js';
import {pushUser,sendScheduled,dueReminders,generateVapidKeys,b64,pushRequest} from './src/push.js';
import {quietUntil,recordFailure,pushDiagnostics,pruneFailures} from './src/push-policy.js';
import {PUSH_ROUTE,safeRoute} from '../app/js/push-routes.js';
const {db,DB}=testDB(),map=new Map(),config=new Map();
const kv=m=>({get:async(k,t)=>m.has(k)?t==='json'?JSON.parse(m.get(k)):m.get(k):null,put:async(k,v)=>m.set(k,v),delete:async k=>m.delete(k),list:async({prefix})=>({keys:[...m.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true})});
const keys=await generateVapidKeys(),env={DB,PUSH:kv(map),CONFIG:kv(config),VAPID_PUBLIC_KEY:keys.publicKey,VAPID_PRIVATE_KEY:keys.privateKey,ADMIN_PASSWORD:'synthetic-test',TOKEN_SECRET:'synthetic-test-secret'};
const uid=crypto.randomUUID(),token='a'.repeat(64),now=Date.now();db.prepare('INSERT INTO users(id,email,pass_hash,pass_salt,created_at) VALUES(?,?,?,?,?)').run(uid,'fixture@example.test','x','x',now);db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(await hash(token),uid,Date.parse('2030-01-01'));
const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']),subscription={endpoint:'https://fcm.googleapis.com/fcm/send/synthetic',keys:{p256dh:b64(await crypto.subtle.exportKey('raw',pair.publicKey)),auth:b64(new Uint8Array(16))}};
const ids=[crypto.randomUUID(),crypto.randomUUID()];for(const id of ids){db.prepare('INSERT INTO push_subscriptions VALUES(?,?)').run(id,uid);await env.PUSH.put('device:'+id,JSON.stringify({userId:uid,subscription,tz:'UTC',reminders:[],expires:now+86400000,prefs:{quietStart:'00:00',quietEnd:'23:59',chat:true},lastSent:{}}));}
let sent=0;globalThis.fetch=async()=>{sent++;return new Response('',{status:201});};
const req=(path,body,auth=token,device)=>new Request('https://test/api/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{}),...(device?{'X-Push-Device':device}:{})},body:body?JSON.stringify(body):undefined});
assert.equal(safeRoute('#/messages/abc_-123'),'#/messages/abc_-123');for(const route of ['javascript:alert(1)','https://evil.test/#/me','#/messages/'+ 'a'.repeat(65),'#/messages/a/b','#/unknown'])assert.equal(safeRoute(route),'#/today');assert(PUSH_ROUTE.test('#/help'));
assert.equal(quietUntil({quietStart:'22:00',quietEnd:'07:00'},'Asia/Bangkok',Date.parse('2026-10-30T18:00Z')),Date.parse('2026-10-31T00:00Z'));
assert.equal(quietUntil({quietStart:'22:00',quietEnd:'07:00'},'America/New_York',Date.parse('2026-10-30T03:00Z')),Date.parse('2026-10-30T11:00Z'));
assert.equal(new Set(dueReminders({tz:'UTC',reminders:['one','two'].map(id=>({id,time:'07:00',title:'Fixmee: reminder due',category:'medications'}))},Date.parse('2026-10-30T07:00Z')).map(r=>r.key)).size,2);
const payload={id:'message-1',tag:'chat-c1',route:'#/messages/c1',title:'Fixmee',body:'New message from a friend'};
// Set a quiet interval guaranteed to contain the mocked current instant.
const actualNow=Date.now;Date.now=()=>Date.parse('2026-10-30T12:00Z');for(const id of ids){const r=await env.PUSH.get('device:'+id,'json');r.expires=Date.now()+86400000;await env.PUSH.put('device:'+id,JSON.stringify(r));}
await pushUser(env,uid,payload,{category:'chat'});await pushUser(env,uid,{...payload,id:'message-2'},{category:'chat'});await pushUser(env,uid,{...payload,id:'message-2'},{category:'chat'});assert.equal(sent,0);
let r=await env.PUSH.get('device:'+ids[0],'json');assert.equal(Object.keys(r.pending).length,1);assert.equal(r.pending['social:chat-c1'].count,2);assert.equal(r.pending['social:chat-c1'].r.body,'2 new messages from a friend');
await sendScheduled(env,Date.parse('2026-10-30T23:59Z'));assert.equal(sent,2);await sendScheduled(env,Date.parse('2026-10-30T23:59Z'));assert.equal(sent,2);
for(const id of ids){r=await env.PUSH.get('device:'+id,'json');r.prefs.chat=false;await env.PUSH.put('device:'+id,JSON.stringify(r));}await pushUser(env,uid,{...payload,id:'disabled'},{category:'chat'});assert.equal(sent,2);
// Pending copies on both devices are cancelled by the account acknowledgement.
for(const id of ids){r=await env.PUSH.get('device:'+id,'json');r.prefs.chat=true;r.pending={copy:{r:{...payload,id:'acked',category:'chat'},at:Date.now()}};await env.PUSH.put('device:'+id,JSON.stringify(r));}
assert.equal((await worker.fetch(req('push/ack',{id:'acked',action:'done',at:Date.now()},'',ids[0]),env)).status,200);await sendScheduled(env,Date.now());assert.equal(sent,2);assert(map.has('ack:'+uid+':acked'));
const recent=await (await worker.fetch(req('push/ack'),env)).json();assert(recent.items.some(a=>a.id==='acked'));
const anonymous=crypto.randomUUID();await env.PUSH.put('device:'+anonymous,JSON.stringify({expires:Date.now()+86400000}));await worker.fetch(req('push/ack',{id:'local',action:'snooze',at:Date.now()},'',anonymous),env);assert(map.has('ack:device:'+anonymous+':local'));assert(!map.has('ack:'+uid+':local'));
let response;for(let i=0;i<121;i++)response=await worker.fetch(req('push/ack',{id:'rate',action:'done',at:Date.now()},'',anonymous),env);assert.equal(response.status,429);
Date.now=actualNow;
// Device capability renews an existing linked subscription without persisting account tokens in IDB.
response=await worker.fetch(req('push/subscribe',{deviceId:ids[0],subscription,tz:'UTC',prefs:{privacy:'medications'},reminders:[]},'',ids[0]),env);assert.equal(response.status,200);assert.equal((await response.json()).deviceId,ids[0]);
await assert.rejects(()=>pushDiagnostics(req('admin/push/diagnostics',undefined,''),env),e=>e.status===401);
const login=await worker.fetch(req('admin/login',{password:env.ADMIN_PASSWORD},''),env),adminToken=(await login.json()).token;assert(adminToken);
for(let i=0;i<55;i++)await recordFailure(env,ids[0],subscription.endpoint,i%2?410:500,Date.now()-i);await recordFailure(env,ids[0],subscription.endpoint,500,Date.now()-31*86400000);await pruneFailures(env);
const diagnostics=await pushDiagnostics(req('admin/push/diagnostics',undefined,adminToken),env);assert.equal(diagnostics.items.length,50);assert.equal(diagnostics.services[0].failures,55);assert.equal(diagnostics.services[0].cleanups,27);assert(diagnostics.items.every(r=>r.device.length===8));assert(!JSON.stringify(diagnostics).includes('fixture@example'));assert(!JSON.stringify(diagnostics).includes('subscription'));assert(!JSON.stringify(diagnostics).includes('payload'));
// A saved chat response must not await the push provider.
const sender=crypto.randomUUID(),senderToken='b'.repeat(64),conversation=crypto.randomUUID();db.prepare('INSERT INTO users(id,email,pass_hash,pass_salt,created_at) VALUES(?,?,?,?,?)').run(sender,'sender@example.test','x','x',Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(await hash(senderToken),sender,Date.now()+3600000);db.prepare('INSERT INTO profiles(user_id,handle,age16,created) VALUES(?,?,1,?)').run(sender,'sender',Date.now());db.prepare('INSERT INTO conversations(id,created) VALUES(?,?)').run(conversation,Date.now());for(const member of [sender,uid])db.prepare('INSERT INTO conversation_members(conversation_id,user_id) VALUES(?,?)').run(conversation,member);
for(const id of ids){r=await env.PUSH.get('device:'+id,'json');r.expires=Date.now()+86400000;r.prefs={chat:true};await env.PUSH.put('device:'+id,JSON.stringify(r));}
let release;const slow=new Promise(resolve=>release=resolve),background=[];globalThis.fetch=async()=>{await slow;return new Response('',{status:201});};
const responsePromise=worker.fetch(req('conversations/'+conversation+'/messages',{body:'Never include this text in a push',kind:'text'},senderToken),env,{waitUntil:p=>background.push(p)});
response=await Promise.race([responsePromise,new Promise((_,reject)=>setTimeout(()=>reject(Error('Chat awaited push')),1000))]);assert.equal(response.status,200);assert(background.length);release();await Promise.all(background);
// Logout removes only the authorised device. Account deletion cleanup is covered by the existing round5 suite.
response=await worker.fetch(req('push/unsubscribe',{deviceId:ids[0]},token),env);assert.equal(response.status,200);assert(!map.has('device:'+ids[0]));assert.equal(db.prepare('SELECT count(*) n FROM push_subscriptions WHERE device_id=?').get(ids[0]).n,0);
console.log('PASS Round21 routes, receiver timezones, midnight quiet/coalescing, dedup, categories, device renewal, cross-device/anonymous ack, rate limit, admin-only capped/private/pruned diagnostics');
