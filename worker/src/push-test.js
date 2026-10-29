import {z} from 'zod/v4';
import {input,admin,getSecret,fail} from './security.js';
import {user,query} from './accounts.js';
import {cap} from './launch-security.js';
import {validEndpoint,encryptPush,vapidJWT,b64,unb64} from './push.js';
export async function testPush(req,env,isAdmin=false){
 if(req.method!=='POST')throw fail('Method not allowed',405);
 if(isAdmin)await admin(req,env);
 const b=await input(req,z.object({deviceId:z.string().uuid().optional(),userId:z.string().uuid().optional()}).strict());
 if(!b.deviceId&&!b.userId)throw fail('Select a device or user');
 if(!isAdmin&&b.userId)throw fail('Forbidden',403);
 let ids=b.deviceId?[b.deviceId]:(await query(env,'SELECT device_id FROM push_subscriptions WHERE user_id=?',b.userId).all()).results.map(r=>r.device_id);
 if(!isAdmin){const owner=await query(env,'SELECT user_id FROM push_subscriptions WHERE device_id=?',b.deviceId).first();if(owner){const u=await user(req,env);if(owner.user_id!==u.id)throw fail('Forbidden',403);}await cap(env,'push-self',b.deviceId,3,3600000);}
 if(!env.PUSH||!await getSecret(env,'vapidPublicKey')||!await getSecret(env,'vapidPrivateKey'))throw fail('Push server is not configured',503);
 let sent=0,lastError=null;for(const id of ids){const r=await env.PUSH.get('device:'+id,'json');if(!r||r.expires<Date.now())continue;if(!validEndpoint(r.subscription.endpoint))throw fail('Invalid push endpoint');let response;try{response=await fetch(r.subscription.endpoint,{method:'POST',redirect:'manual',headers:{Urgency:'normal',TTL:'60','Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',Authorization:`vapid t=${await vapidJWT(r.subscription.endpoint,env)}, k=${b64(unb64(await getSecret(env,'vapidPublicKey')))}`},body:await encryptPush(r.subscription,{title:'Fixmee',body:'Test notification',route:'#/today'}),signal:AbortSignal.timeout(10000)});}catch(e){lastError={status:0,reason:('TransportError: '+(e?.message||e)).slice(0,300)};await env.PUSH.put('device:'+id,JSON.stringify({...r,lastError:{...lastError,at:Date.now()}}),{expirationTtl:Math.max(60,Math.ceil((r.expires-Date.now())/1000))});continue;}if(response.ok){sent++;await env.PUSH.put('device:'+id,JSON.stringify({...r,lastError:null,lastDelivery:Date.now()}),{expirationTtl:Math.max(60,Math.ceil((r.expires-Date.now())/1000))});}else if(![404,410].includes(response.status)){lastError={status:response.status,reason:(await response.text().catch(()=>'')).slice(0,300)};await env.PUSH.put('device:'+id,JSON.stringify({...r,lastError:{...lastError,at:Date.now()}}),{expirationTtl:Math.max(60,Math.ceil((r.expires-Date.now())/1000))});}else if([404,410].includes(response.status)){await env.PUSH.delete('device:'+id);await query(env,'DELETE FROM push_subscriptions WHERE device_id=?',id).run();}}
 if(!sent)throw Object.assign(fail(lastError?'Push service rejected the notification ('+lastError.status+(lastError.reason?': '+lastError.reason.slice(0,120):'')+')':'No active device accepted the notification',lastError?400:503),{code:'push_rejected'});return {sent};
}
