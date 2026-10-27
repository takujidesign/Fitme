import {usageReport} from './usage.js';
import {storedImageType} from './social-images.js';
import {z} from 'zod/v4';
import {query as q,serverState} from './accounts.js';
import {input,fail,hash} from './security.js';
import {deleteAccount} from './round5.js';
import {pushUser} from './push.js';
import {adminContent} from './admin-content.js';
const id=z.string().uuid(),rows=async(env,sql,...args)=>(await q(env,sql,...args).all()).results;
const actor=req=>hash(req.headers.get('Authorization')||'');
async function log(req,env,action,target,detail={}){await q(env,'INSERT INTO admin_audit VALUES(?,?,?,?,?,?)',crypto.randomUUID(),(await actor(req)).slice(0,16),action,target,JSON.stringify(detail),Date.now()).run();}
export async function adminSocial(req,env,section){
 const content=await adminContent(req,env,section);if(content)return content;
 const url=new URL(req.url),now=Date.now();
 if(section==='members'&&req.method==='GET'){
  const term=(url.searchParams.get('q')||'').slice(0,254);return {items:await rows(env,'SELECT u.id user_id,u.email,u.created_at,p.handle,p.display_name,p.suspended FROM users u LEFT JOIN profiles p ON p.user_id=u.id WHERE u.email LIKE ? OR p.handle LIKE ? ORDER BY u.created_at DESC LIMIT 300','%'+term+'%','%'+term+'%')};
 }
 if(section==='member'&&req.method==='GET'){
  const key=id.parse(url.searchParams.get('id')),u=await q(env,'SELECT id,email,role,created_at FROM users WHERE id=?',key).first();if(!u)throw fail('Not found',404);
  return {user:u,profile:await q(env,'SELECT * FROM profiles WHERE user_id=?',key).first(),state:await serverState(env,key),checkins:await rows(env,'SELECT * FROM checkins WHERE user_id=?',key),messages:await rows(env,'SELECT id,conversation_id,body,kind,created FROM messages WHERE sender=?',key),credits:await rows(env,'SELECT * FROM ai_credits WHERE owner=?',key),supporter:await q(env,'SELECT * FROM supporters WHERE owner=?',key).first()};
 }
 if(section==='member'&&req.method==='PUT'){
  const b=await input(req,z.object({id,action:z.enum(['support','revoke-support','credits','delete']),email:z.string().email().optional(),credits:z.number().int().min(-100000).max(100000).optional()}).strict()),u=await q(env,'SELECT id,email FROM users WHERE id=?',b.id).first();if(!u)throw fail('Not found',404);
  if(b.action==='delete'){if(b.email!==u.email)throw fail('Confirm member email');await deleteAccount(env,u);}
  if(b.action==='support')await q(env,'INSERT OR IGNORE INTO supporters VALUES(?,0,?)',u.id,now).run();
  if(b.action==='revoke-support')await q(env,'DELETE FROM supporters WHERE owner=?',u.id).run();
  if(b.action==='credits'){if(b.credits===undefined)throw fail('Credit amount required');await q(env,"INSERT INTO ai_credits VALUES(?,'trial',MAX(0,?),0) ON CONFLICT(owner,period_start) DO UPDATE SET granted=MAX(used,granted+?)",u.id,b.credits,b.credits).run();}
  await log(req,env,b.action,u.id,{credits:b.credits});return {ok:true};
 }
 if(section==='sessions'){
  if(req.method==='POST'){await env.CONFIG.put('admin-revoked-before',String(now));await log(req,env,'logout-all','admin');return {ok:true};}
  if(req.method==='GET'){const items=[];let cursor;do{const page=await env.CONFIG.list?.({prefix:'admin-session:',...(cursor?{cursor}:{})});if(!page)break;for(const key of page.keys){const value=await env.CONFIG.get(key.name,'json');if(value?.expires>now)items.push({id:key.name.slice(-12),created:value.created||value.expires-7200000,expires:value.expires});}cursor=page.list_complete?null:page.cursor;}while(cursor);return {items};}
 }
 if(section==='errors'&&req.method==='GET')return {items:await rows(env,'SELECT * FROM errors ORDER BY last_seen DESC LIMIT 100')};
 if(section==='avatars'&&req.method==='GET')return {items:await rows(env,'SELECT user_id,handle,avatar_key FROM profiles WHERE avatar_key IS NOT NULL LIMIT 300')};
 if(section==='avatar'){
  if(req.method==='GET'){const key=id.parse(url.searchParams.get('id')),profile=await q(env,'SELECT avatar_key FROM profiles WHERE user_id=?',key).first(),object=profile?.avatar_key&&await env.MEDIA?.get(profile.avatar_key);if(!object)throw fail('Not found',404);return new Response(object.body,{headers:{'Content-Type':storedImageType(object,profile.avatar_key),'Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff'}});}
  if(req.method==='DELETE'){const b=await input(req,z.object({id}).strict()),p=await q(env,'SELECT avatar_key FROM profiles WHERE user_id=?',b.id).first();if(p?.avatar_key)await env.MEDIA?.delete(p.avatar_key);await q(env,'UPDATE profiles SET avatar_key=NULL WHERE user_id=?',b.id).run();await log(req,env,'remove-avatar',b.id);return {ok:true};}
 }
 if(section==='reports'&&req.method==='PUT'){
  const b=await input(req,z.object({id,action:z.enum(['dismiss','remove','warn','suspend'])}).strict()),report=await q(env,'SELECT * FROM reports WHERE id=?',b.id).first();if(!report)throw fail('Not found',404);
  const target=report.target_type==='message'?await q(env,'SELECT sender owner,media_key FROM messages WHERE id=?',report.target_id).first():['profile','avatar'].includes(report.target_type)?await q(env,'SELECT user_id owner,avatar_key media_key FROM profiles WHERE user_id=?',report.target_id).first():report.target_type==='idea'?await q(env,'SELECT owner FROM ideas WHERE id=?',report.target_id).first():await q(env,'SELECT user_id owner FROM checkins WHERE id=?',report.target_id).first();
  if(b.action!=='dismiss'&&!target)throw fail('Content unavailable',404);
  if(b.action==='remove'){
   if(['message','avatar'].includes(report.target_type)&&target.media_key)await env.MEDIA?.delete(target.media_key);
   const changes={message:["UPDATE messages SET deleted=1,body='',media_key=NULL WHERE id=?"],avatar:['UPDATE profiles SET avatar_key=NULL WHERE user_id=?'],profile:["UPDATE profiles SET bio='',display_name='' WHERE user_id=?"],idea:["UPDATE ideas SET status='rejected' WHERE id=?"],checkin:['DELETE FROM checkins WHERE id=?','DELETE FROM feed_items WHERE id=?']};
   await env.DB.batch(changes[report.target_type].map(sql=>q(env,sql,report.target_id)));
  }
  if(b.action==='suspend')await q(env,'UPDATE profiles SET suspended=1 WHERE user_id=?',target.owner).run();
  if(b.action==='warn')await pushUser(env,target.owner,{title:'Fixmee',body:'A moderator reviewed a report about your content. Please follow the community safety guidelines.',route:'#/help',tag:'moderation'});
  await q(env,'UPDATE reports SET status=? WHERE id=?',b.action,b.id).run();await log(req,env,'report',b.id,{action:b.action});return {ok:true};
 }
 if(section==='gym-edit'&&req.method==='PUT'){
  const b=await input(req,z.object({id,name:z.string().trim().min(1).max(100),lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180)}).strict());await q(env,'UPDATE gyms SET name=?,lat=?,lng=?,updated=? WHERE id=?',b.name,b.lat,b.lng,now,b.id).run();await log(req,env,'edit-gym',b.id);return {ok:true};
 }
 if(section==='gym-merge'&&req.method==='PUT'){
  const b=await input(req,z.object({id,target:id}).strict());if(b.id===b.target||!await q(env,"SELECT 1 FROM gyms WHERE id=? AND status='approved'",b.target).first())throw fail('Choose an approved target gym');
  await env.DB.batch([q(env,'UPDATE checkins SET gym_id=? WHERE gym_id=?',b.target,b.id),q(env,'UPDATE profiles SET home_gym=? WHERE home_gym=?',b.target,b.id),q(env,"UPDATE gyms SET status='merged',updated=? WHERE id=?",now,b.id)]);await log(req,env,'merge-gym',b.id,{target:b.target});return {ok:true};
 }
 if(section==='announcements'){
  if(req.method==='POST'){const b=await input(req,z.object({body:z.string().trim().min(1).max(1000),start:z.number().int().nonnegative(),end:z.number().int().nonnegative(),language:z.enum(['all','th','en','zh','ja','vi'])}).strict());if(b.end<=b.start)throw fail('End must follow start');const key=crypto.randomUUID();await q(env,'INSERT INTO announcements VALUES(?,?,?,?,?)',key,b.body,b.start,b.end,b.language).run();await log(req,env,'announcement',key);return {id:key};}
  if(req.method==='DELETE'){const b=await input(req,z.object({id}).strict());await q(env,'DELETE FROM announcements WHERE id=?',b.id).run();await log(req,env,'delete-announcement',b.id);return {ok:true};}
 }
 if(section==='broadcast'&&req.method==='POST'){
  const b=await input(req,z.object({title:z.string().min(1).max(80),body:z.string().min(1).max(300),confirm:z.literal(true)}).strict());
  if(await q(env,"SELECT 1 FROM admin_audit WHERE action='broadcast' AND created>?",now-3600000).first())throw fail('One broadcast per hour',429);
  await log(req,env,'broadcast','all');let sent=0;for(const u of await rows(env,'SELECT DISTINCT user_id FROM push_subscriptions'))if(await pushUser(env,u.user_id,{title:b.title,body:b.body,route:'#/today',tag:'announcement'}))sent++;return {sent};
 }
 if(section==='dashboard'&&req.method==='GET'){
  return usageReport(env,30);
 }
 return null;
}
