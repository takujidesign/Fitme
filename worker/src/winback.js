import { query as q } from './accounts.js';
import { getSecret } from './security.js';
import { growthSettings } from './growth.js';
import { lineSettings } from './line.js';
import { encryptPush, vapidJWT } from './push.js';
export async function winback(env,now=Date.now()){
 if(!env.DB)return;
 await q(env,'UPDATE engagement SET returned=returned+1,returned_at=? WHERE last_sent>returned_at AND EXISTS(SELECT 1 FROM user_state WHERE user_id=engagement.user_id AND updated_at>engagement.last_sent)',now).run();
 const candidates=(await q(env,'SELECT users.id,users.email,users.line_user_id,engagement.sent FROM users JOIN engagement ON engagement.user_id=users.id LEFT JOIN user_state ON user_state.user_id=id WHERE opted_in=1 AND COALESCE(user_state.updated_at,users.created_at)<? AND last_sent<?',now-3*86400000,now-7*86400000).all()).results;
 const settings=await growthSettings(env),line=await getSecret(env,'lineMessagingToken'),resend=await getSecret(env,'resendApiKey');
 for(const u of candidates){const messages=['กลับมาเริ่มใหม่สบาย ๆ วันนี้ได้ / A fresh start is always welcome.','วันนี้ลองออกกำลังสั้น ๆ กัน / Try a short workout today.','ชวนเพื่อนทำชาเลนจ์กัน / Join a friendly challenge.'],body=messages[u.sent%messages.length];
  let deliver;
  if(u.line_user_id&&line){const cap=(await lineSettings(env)).dailyCap,day=new Date(now+7*3600000).toISOString().slice(0,10),reserved=await q(env,"INSERT OR IGNORE INTO line_deliveries SELECT ?,?,'winback' WHERE (SELECT count(*) FROM line_deliveries WHERE user_id=? AND day=?)<?",u.id,day,u.id,day,cap).run();if(!reserved.meta.changes)continue;deliver=()=>fetch('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{Authorization:'Bearer '+line,'Content-Type':'application/json'},body:JSON.stringify({to:u.line_user_id,messages:[{type:'text',text:body}]})});}
  else {const devices=(await q(env,'SELECT device_id FROM push_subscriptions WHERE user_id=?',u.id).all()).results;let record;for(const d of devices){const r=await env.PUSH?.get('device:'+d.device_id,'json');if(r&&r.expires>now){record=r;break;}}
   const publicKey=await getSecret(env,'vapidPublicKey');if(record&&publicKey&&await getSecret(env,'vapidPrivateKey'))deliver=async()=>fetch(record.subscription.endpoint,{method:'POST',redirect:'error',headers:{TTL:'300','Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',Authorization:`vapid t=${await vapidJWT(record.subscription.endpoint,env,now)}, k=${publicKey}`},body:await encryptPush(record.subscription,{title:'Fix me',body,route:'#/today',tag:'winback'})});
   else if(resend&&settings.emailFrom&&!u.email.endsWith('@line.invalid'))deliver=()=>fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+resend,'Content-Type':'application/json'},body:JSON.stringify({from:settings.emailFrom,to:[u.email],subject:'A friendly reminder from Fix me',text:body+'\n'+settings.appUrl})});
  }
  if(!deliver)continue;
  // Reserve before network I/O: ambiguous failures cannot cause duplicate messages.
  const r=await q(env,'UPDATE engagement SET last_sent=? WHERE user_id=? AND opted_in=1 AND last_sent<?',now,u.id,now-7*86400000).run();if(!r.meta.changes)continue;
  try{const result=await deliver();if(result.ok)await q(env,'UPDATE engagement SET sent=sent+1 WHERE user_id=?',u.id).run();}catch{}
 }
}
