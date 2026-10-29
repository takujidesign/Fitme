import assert from 'node:assert/strict';
import worker from './src/index.js';
import {testDB} from './test-db.mjs';
import {hash} from './src/security.js';
import {generateVapidKeys} from './src/push.js';
const {db,DB}=testDB(),kv=new Map(),push=new Map();const KV=map=>({get:async(k,t)=>map.has(k)?t==='json'?JSON.parse(map.get(k)):map.get(k):null,put:async(k,v)=>map.set(k,v),delete:async k=>map.delete(k)});
const env={DB,CONFIG:KV(kv),PUSH:KV(push)},uid=crypto.randomUUID(),token='a'.repeat(64);
db.prepare('INSERT INTO users(id,email,pass_hash,pass_salt,created_at) VALUES(?,?,?,?,?)').run(uid,'private@example.test','x','x',Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(await hash(token),uid,Date.now()+3600000);
const call=(path,body,method=body===undefined?'GET':'POST',auth=token)=>worker.fetch(new Request('https://test/api/'+path,{method,headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),env);
const body={tz:'Asia/Bangkok',reminders:[{date:'2026-10-29',time:'08:00',title:'Drink water',category:'water'}]};
assert.equal((await call('cal',body,'POST','')).status,401);
let res=await call('cal',body);assert.equal(res.status,200);const first=await res.json(),secret=first.url.match(/cal\/(.*)\.ics/)[1];assert.equal(secret.length,64);
const stored=db.prepare('SELECT * FROM calendar_feeds').get();assert.equal(stored.token_hash,await hash(secret));assert(!JSON.stringify(stored).includes(secret));
res=await call('cal/'+secret+'.ics');assert.equal(res.status,200);const ics=await res.text();assert(ics.includes('TRIGGER:PT0M'));assert(ics.includes('X-PUBLISHED-TTL:PT6H'));assert(res.headers.get('Cache-Control'));assert(!ics.includes(uid));assert(!ics.includes('private@example.test'));
const rotated=await (await call('cal',{...body,rotate:true})).json();assert.notEqual(rotated.url,first.url);assert.equal((await call('cal/'+secret+'.ics')).status,404);
const path=rotated.url.split('/api/')[1];assert.equal((await call(path)).status,200);await call('cal',undefined,'DELETE');assert.equal((await call(path)).status,404);
for(let i=0;i<60;i++)res=await call('cal/'+'0'.repeat(64)+'.ics');assert.equal(res.status,429);assert((await res.json()).retryAfter>0);
const keys=await generateVapidKeys();env.VAPID_PUBLIC_KEY=keys.publicKey;env.VAPID_PRIVATE_KEY=keys.privateKey;const id=crypto.randomUUID();
// A missing subscription is sufficient: count each self-test attempt before delivery.
for(let i=0;i<5;i++){res=await call('push/test',{deviceId:id});assert.notEqual(res.status,429);}
res=await call('push/test',{deviceId:id});assert.equal(res.status,429);assert((await res.json()).retryAfter>0);
console.log('PASS Round 20 local migration; calendar authentication/hash/rotation/revocation/privacy/rate limit; self-test five attempts/retryAfter');
