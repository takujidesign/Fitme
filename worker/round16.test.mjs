import assert from 'node:assert/strict';
import worker from './src/index.js';
import {testDB} from './test-db.mjs';
import {hash} from './src/security.js';
globalThis.fetch=async()=>{throw Error('External requests prohibited');};
const {db,DB}=testDB(),kv=new Map(),objects=new Map();
const env={DB,CONFIG:{get:async(k,t)=>kv.has(k)?t==='json'?JSON.parse(kv.get(k)):kv.get(k):null,put:async(k,v)=>kv.set(k,v)},MEDIA:{put:async(k,bytes,metadata)=>objects.set(k,{body:bytes,...metadata}),get:async k=>objects.get(k),delete:async k=>objects.delete(k)}};
const ids=[crypto.randomUUID(),crypto.randomUUID()],tokens=['a'.repeat(64),'b'.repeat(64)];
for(let i=0;i<2;i++){db.prepare('INSERT INTO users(id,email,pass_hash,pass_salt,created_at) VALUES(?,?,?,?,?)').run(ids[i],`r16-${i}@example.test`,'x','x',Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(await hash(tokens[i]),ids[i],Date.now()+3600000);}
async function call(path,body,method='POST',type='application/json',token=tokens[0]){return worker.fetch(new Request('https://test/api/'+path,{method,headers:{'Content-Type':type,Authorization:'Bearer '+token},body:body===undefined?undefined:type==='application/json'?JSON.stringify(body):body}),env);}
const profile={handle:'Arm',display_name:'Arm',age16:true};
assert.equal((await call('profile',profile,'PUT')).status,200);assert.equal(db.prepare('SELECT handle FROM profiles WHERE user_id=?').get(ids[0]).handle,'arm');
for(const [handle,code,token] of [['ar','handle_invalid',tokens[0]],['admin','handle_reserved',tokens[0]],['arm','handle_taken',tokens[1]]])assert.equal((await(await call('profile',{...profile,handle},'PUT','application/json',token)).json()).code,code);
const cid=crypto.randomUUID();db.prepare('INSERT INTO conversations VALUES(?,?,?)').run(cid,'Test',Date.now());db.prepare('INSERT INTO conversation_members(conversation_id,user_id) VALUES(?,?)').run(cid,ids[0]);
const webp=new TextEncoder().encode('RIFF0000WEBPtest'),jpeg=new Uint8Array([255,216,255,0]),png=new Uint8Array([137,80,78,71]);
for(const [path,cap] of [['profile/avatar',150000],['conversations/'+cid+'/photo',1000000]]){
 for(const [bytes,type,extension] of [[webp,'image/webp','webp'],[jpeg,'image/jpeg','jpg']]){
  const res=await call(path,bytes,'POST',type);assert.equal(res.status,200);const result=await res.json();
  const key=path==='profile/avatar'?db.prepare('SELECT avatar_key FROM profiles WHERE user_id=?').get(ids[0]).avatar_key:db.prepare('SELECT media_key FROM messages WHERE id=?').get(result.id).media_key;
  assert(key.endsWith('.'+extension));assert.equal(objects.get(key).httpMetadata.contentType,type);
  const served=await call(path==='profile/avatar'?'profile/avatar/arm':'messages/'+result.id+'/photo',undefined,'GET');assert.equal(served.status,200);assert.equal(served.headers.get('Content-Type'),type);assert.equal(served.headers.get('X-Content-Type-Options'),'nosniff');
 }
 for(const [bytes,type,code,status] of [[png,'image/png','unsupported_image',415],[jpeg,'image/webp','unsupported_image',415],[webp,'image/jpeg','unsupported_image',415],[new Uint8Array(cap+1),'image/jpeg','image_too_large',413]]){const res=await call(path,bytes,'POST',type);assert.equal(res.status,status);assert.equal((await res.json()).code,code);}
}
assert.equal((await call('conversations/'+cid+'/photo',{data:Buffer.from(webp).toString('base64')})).status,200);
assert.equal((await call('profile/avatar',jpeg,'POST','image/jpeg','bad')).status,401);
kv.set('beta',JSON.stringify({enabled:false}));env.RESEND_API_KEY='mock-only';
const unverified=await call('profile/avatar',jpeg,'POST','image/jpeg');assert.equal(unverified.status,403);assert.equal((await unverified.json()).code,'email_not_verified');
kv.set('beta',JSON.stringify({enabled:true}));
assert.equal((await(await call('ai/chat',{message:'test'})).json()).code,'beta_disabled');
console.log('PASS Round 16 real local SQLite routes: handles, WebP/JPEG uploads and stored metadata, protected reads, PNG/magic/size rejection, legacy chat');
db.close();
