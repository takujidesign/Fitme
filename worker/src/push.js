import {user, query} from './accounts.js';
import { z } from 'zod/v4';
import { equal, input as readInput } from './security.js';
import { getSecret } from './security.js';
// WebCrypto-only RFC 8291 single-record aes128gcm and RFC 8292 VAPID.
const enc = new TextEncoder();
export const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export const unb64 = s => Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0));
const join = (...parts) => { const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out; };
async function hkdf(ikm,salt,info,length){const key=await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']);return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},key,length*8));}
export async function generateVapidKeys(){const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);const jwk=await crypto.subtle.exportKey('jwk',keys.privateKey);return {publicKey:b64(await crypto.subtle.exportKey('raw',keys.publicKey)),privateKey:jwk.d};}
export async function pushUser(env,userId,payload){
 if(!env.DB||!env.PUSH||!await getSecret(env,'vapidPrivateKey')||!await getSecret(env,'vapidPublicKey'))return false;
 const devices=(await query(env,'SELECT device_id FROM push_subscriptions WHERE user_id=?',userId).all()).results;let sent=false;
 for(const {device_id} of devices){try{const record=await env.PUSH.get('device:'+device_id,'json');if(!record||record.expires<Date.now()||!validEndpoint(record.subscription.endpoint))continue;const endpoint=record.subscription.endpoint,res=await fetch(endpoint,{method:'POST',redirect:'error',headers:{Urgency:'normal',TTL:'300','Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',Authorization:`vapid t=${await vapidJWT(endpoint,env)}, k=${b64(unb64(await getSecret(env,'vapidPublicKey')))}`},body:await encryptPush(record.subscription,payload)});if(res.ok){sent=true;record.lastError=null;await env.PUSH.put('device:'+device_id,JSON.stringify(record),{expirationTtl:Math.max(60,Math.ceil((record.expires-Date.now())/1000))});}else if([404,410].includes(res.status)){await env.PUSH.delete('device:'+device_id);await query(env,'DELETE FROM push_subscriptions WHERE device_id=?',device_id).run();}}catch{/* A notification failure must not fail the saved message. */}}
 return sent;
}
export async function vapidJWT(endpoint,env,now=Date.now()){
  const contact=(await env.CONFIG?.get('business','json'))?.contactEmail;
  if(contact)env={...env,VAPID_SUBJECT:'mailto:'+contact};
  const pub=unb64((await getSecret(env, 'vapidPublicKey')));if(pub.length!==65||pub[0]!==4)throw Error('Invalid VAPID public key');
  const key=await crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',x:b64(pub.slice(1,33)),y:b64(pub.slice(33)),d:(await getSecret(env, 'vapidPrivateKey'))},{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const unsigned=b64(enc.encode(JSON.stringify({typ:'JWT',alg:'ES256'})))+'.'+b64(enc.encode(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(now/1000)+3600,sub:/^(mailto:[^@\s]+@[^@\s]+|https:\/\/)/.test(env.VAPID_SUBJECT||'')?env.VAPID_SUBJECT:'https://fixmee.app'})));
  return unsigned+'.'+b64(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(unsigned)));
}
export async function encryptPush(subscription,payload,options={}){
  const ua=unb64(subscription.keys.p256dh),auth=unb64(subscription.keys.auth);
  const pair=options.pair||await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const pub=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey));
  const receiver=await crypto.subtle.importKey('raw',ua,{name:'ECDH',namedCurve:'P-256'},false,[]);
  const secret=await crypto.subtle.deriveBits({name:'ECDH',public:receiver},pair.privateKey,256);
  const ikm=await hkdf(secret,auth,join(enc.encode('WebPush: info\0'),ua,pub),32),salt=options.salt||crypto.getRandomValues(new Uint8Array(16));
  const cek=await hkdf(ikm,salt,enc.encode('Content-Encoding: aes128gcm\0'),16),nonce=await hkdf(ikm,salt,enc.encode('Content-Encoding: nonce\0'),12);
  const data=payload instanceof Uint8Array?payload:enc.encode(JSON.stringify(payload));if(data.length>3993)throw Error('Push payload too large');
  const key=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},key,join(data,new Uint8Array([2]))));
  return join(salt,new Uint8Array([0,0,16,0,65]),pub,encrypted);
}
const fail=message=>Object.assign(Error(message),{status:400});
export function validEndpoint(endpoint){
  const u=new URL(endpoint);
  // Only browser push services; never fetch an arbitrary caller-supplied host.
  return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&(u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname.endsWith('.push.services.mozilla.com')||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.notify.windows.com'));
}
export async function pushRequest(req,env,unsubscribe=false){
  if(!env.PUSH||!(await getSecret(env, 'vapidPublicKey'))||!(await getSecret(env, 'vapidPrivateKey')))throw Object.assign(Error('Push server is not configured'),{status:503});
  const input=await readInput(req,unsubscribe?z.object({deviceId:z.string().uuid()}).strict():z.object({deviceId:z.string().uuid().optional(),subscription:z.object({endpoint:z.string().url().max(4096),expirationTime:z.number().nullable().optional(),keys:z.object({p256dh:z.string().max(200),auth:z.string().max(100)}).strict()}).strict(),tz:z.string().max(100),reminders:z.array(z.object({time:z.string().max(5),title:z.string().max(120),body:z.string().max(500),days:z.array(z.number().int().min(0).max(6)).max(7).optional(),date:z.string().max(10).optional(),route:z.string().max(40).optional(),category:z.enum(['general','wake','water','meals','workout','supplements','sleep','fasting','medications']).optional()}).strict()).max(300)}).strict(),150000);
  const id=input.deviceId;
  const account=/^Bearer\s+\S+/.test(req.headers.get('Authorization')||'')?await user(req,env):null;
  if(id&&env.DB){const owner=await query(env,'SELECT user_id FROM push_subscriptions WHERE device_id=?',id).first();if(owner&&owner.user_id!==account?.id)throw Object.assign(fail('Subscription belongs to another account'),{status:403});}
  if(id&&!/^[a-f0-9-]{36}$/.test(id))throw fail('Invalid device id');
  if(unsubscribe){if(!id)throw fail('Device id required');await env.PUSH.delete('device:'+id);if(env.DB)await query(env,'DELETE FROM push_subscriptions WHERE device_id=?',id).run();return {};}
  if(id&&!await env.PUSH.get('device:'+id))throw Object.assign(fail('Unknown device id'),{status:404});
  const {subscription,tz,reminders}=input;
  try{if(!validEndpoint(subscription.endpoint)||unb64(subscription.keys.p256dh).length!==65||unb64(subscription.keys.auth).length!==16)throw Error();await crypto.subtle.importKey('raw',unb64(subscription.keys.p256dh),{name:'ECDH',namedCurve:'P-256'},false,[]);new Intl.DateTimeFormat('en',{timeZone:tz}).format();}catch{throw fail('Invalid subscription or timezone');}
  if(!Array.isArray(reminders)||reminders.length>300||reminders.some(r=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)||typeof r.title!=='string'||r.title.length>120||typeof r.body!=='string'||r.body.length>500||(r.days&&(!Array.isArray(r.days)||r.days.some(d=>!Number.isInteger(d)||d<0||d>6)))||(r.date&&!/^\d{4}-\d{2}-\d{2}$/.test(r.date))||(r.route&&!/^#\/(today|food|workout|supps|me|player\/\d{4}-\d{2}-\d{2})$/.test(r.route))))throw fail('Invalid reminders');
  const deviceId=id||crypto.randomUUID();const previous=id?await env.PUSH.get('device:'+id,'json'):null;
  await env.PUSH.put('device:'+deviceId,JSON.stringify({subscription,tz,reminders,lastError:previous?.lastError||null,lastSent:Object.fromEntries(Object.entries(previous?.lastSent||{}).filter(([key])=>key!=='refresh')),registeredAt:Date.now(),expires:Date.now()+8*86400000}),{expirationTtl:8*86400});
  if(account){await query(env,'INSERT INTO push_subscriptions(device_id,user_id) VALUES(?,?) ON CONFLICT(device_id) DO UPDATE SET user_id=excluded.user_id',deviceId,account.id).run();}
  return {deviceId,registeredAt:Date.now()};
}
export function dueReminders(record,now){
  const due=[];
  // Inspect the current five-minute cron window, including midnight / DST transitions.
  for(let delta=0;delta<5;delta++){
    const instant=new Date(Math.floor(now/60000)*60000-delta*60000);
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:record.tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instant).map(p=>[p.type,p.value]));
    const date=`${parts.year}-${parts.month}-${parts.day}`,time=`${parts.hour}:${parts.minute}`,day=new Date(date+'T12:00:00Z').getUTCDay();
    record.reminders.forEach((r,i)=>{const key=r.category?`${date}:${time}:${r.category}:${r.route||''}:${r.title}`:`${date}:${time}:${i}`;if(r.time===time&&(!r.date||r.date===date)&&(!r.days||r.days.includes(day))&&!record.lastSent?.[key])due.push({r,key});});
  }return due;
}
export async function sendScheduled(env,now=Date.now()){
  if(!env.PUSH||!(await getSecret(env, 'vapidPrivateKey'))||!(await getSecret(env, 'vapidPublicKey')))return;
  let cursor;
  do{const page=await env.PUSH.list({prefix:'device:',...(cursor?{cursor}:{})});
    for(const {name} of page.keys){try{
      const record=await env.PUSH.get(name,'json');if(!record||record.expires<now)continue;
      record.lastSent||={};record.pending||={};let expired=false;
      if(record.registeredAt&&now-record.registeredAt>=6*86400000&&!record.lastSent.refresh&&!record.pending.refresh)record.pending.refresh={r:{title:'Fixmee',body:'เปิดแอปเพื่ออัปเดตการแจ้งเตือน / Open the app to refresh reminders',route:'#/today',category:'refresh'},at:now};
      for(const {r,key} of dueReminders(record,now))record.pending[key]||={r,at:now};
      for(const [key,{r,at}] of Object.entries(record.pending)){
        if(now-at>3600000){delete record.pending[key];continue;}
        let res;try{res=await fetch(record.subscription.endpoint,{method:'POST',redirect:'error',headers:{Urgency:'normal',TTL:'300','Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',Authorization:`vapid t=${await vapidJWT(record.subscription.endpoint,env,now)}, k=${b64(unb64(await getSecret(env, 'vapidPublicKey')))}`},body:await encryptPush(record.subscription,{title:r.title,body:r.body,route:r.route||'#/today',tag:r.category||'general'})});}catch{record.lastError={status:0,reason:'TransportError',at:now};continue;}
        if(res.status===404||res.status===410){await env.PUSH.delete(name);if(env.DB)await query(env,'DELETE FROM push_subscriptions WHERE device_id=?',name.slice(7)).run();expired=true;break;}if(res.ok){record.lastSent[key]=now;delete record.pending[key];record.lastError=null;}else record.lastError={status:res.status,reason:(await res.text().catch(()=>'')).slice(0,300),at:now};
      }
      if(!expired){record.lastSent=Object.fromEntries(Object.entries(record.lastSent).filter(([key,at])=>key==='refresh'||at>now-86400000));await env.PUSH.put(name,JSON.stringify(record),{expirationTtl:Math.max(60,Math.ceil((record.expires-now)/1000))});}
    }catch{ /* One unavailable device must not block the rest. Retry next cron window. */ }}
    cursor=page.list_complete?null:page.cursor;
  }while(cursor);
}

export async function pushReminders(req,env){const id=new URL(req.url).searchParams.get('deviceId');if(!/^[a-f0-9-]{36}$/.test(id||'')||!await equal(req.headers.get('X-Push-Device')||'',id))throw Object.assign(fail('Device authentication required'),{status:401});const record=await env.PUSH?.get('device:'+id,'json');if(!record||record.expires<Date.now())throw Object.assign(fail('Device not registered'),{status:404});return {registeredAt:record.registeredAt||record.expires-8*86400000,expires:record.expires,tz:record.tz,reminders:record.reminders,lastError:record.lastError||null};}
