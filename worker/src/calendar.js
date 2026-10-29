import {z} from 'zod/v4';
import {user,query} from './accounts.js';
import {input,hash,random,fail} from './security.js';
import {cap,ip} from './launch-security.js';
import {buildICS} from '../../app/js/calendar.js';
const schema=z.object({tz:z.string().max(100),reminders:z.array(z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),title:z.string().max(120),category:z.enum(['general','wake','water','meals','workout','supplements','sleep','fasting','medications'])}).strict()).max(1500),rotate:z.boolean().optional()}).strict();
export async function calendarRequest(req,env){
 const path=new URL(req.url).pathname;
 if(path!=='/api/cal'){
  if(req.method!=='GET')throw fail('Method not allowed',405);
  await cap(env,'calendar-feed',ip(req),60,3600000);
  const token=/^\/api\/cal\/([a-f0-9]{64})\.ics$/.exec(path)?.[1];
  const row=token&&await query(env,'SELECT tz,reminders,sequence FROM calendar_feeds WHERE token_hash=?',await hash(token)).first();
  if(!row)throw fail('Calendar not found',404);
  return new Response(buildICS(JSON.parse(row.reminders),{tz:row.tz,sequence:row.sequence}),{headers:{'Content-Type':'text/calendar; charset=utf-8','Cache-Control':'private, max-age=300','X-PUBLISHED-TTL':'PT6H','Referrer-Policy':'no-referrer'}});
 }
 const u=await user(req,env);
 if(req.method==='DELETE'){await query(env,'DELETE FROM calendar_feeds WHERE user_id=?',u.id).run();return {};}
 if(req.method!=='POST')throw fail('Method not allowed',405);
 await cap(env,'calendar-edit',u.id,60,3600000);
 const b=await input(req,schema,350000);try{new Intl.DateTimeFormat('en',{timeZone:b.tz}).format();}catch{throw fail('Invalid timezone');}
 const existing=await query(env,'SELECT sequence FROM calendar_feeds WHERE user_id=?',u.id).first();
 const token=!existing||b.rotate?random(32):null;
 if(token)await query(env,'INSERT INTO calendar_feeds(user_id,token_hash,tz,reminders,sequence) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash,tz=excluded.tz,reminders=excluded.reminders,sequence=excluded.sequence',u.id,await hash(token),b.tz,JSON.stringify(b.reminders),(existing?.sequence||0)+1).run();
 else await query(env,'UPDATE calendar_feeds SET tz=?,reminders=?,sequence=sequence+1 WHERE user_id=?',b.tz,JSON.stringify(b.reminders),u.id).run();
 return token?{url:'webcal://api.fixmee.app/api/cal/'+token+'.ics'}:{};
}
