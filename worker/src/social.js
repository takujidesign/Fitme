import {z} from 'zod/v4';
import {user,query as q,serverState} from './accounts.js';
import {admin,input,fail,hash,random} from './security.js';
import {refreshGyms} from './gym-directory.js';
import {socialExtra,nudgeBuddies} from './social-extra.js';
import {pushUser} from './push.js';
import {adminSocial} from './admin-social.js';
import {publicContent} from './admin-content.js';
const id=z.string().uuid(),visibility=z.enum(['everyone','friends','only me']);
const privacy=z.object({profile:visibility.default('friends'),checkins:visibility.default('friends'),workouts:z.boolean().default(true),streak:z.boolean().default(true),weight:z.boolean().default(false),suggestions:z.boolean().default(false),gymPresence:z.boolean().default(false)}).strict();
const profile=z.object({handle:z.string().toLowerCase().regex(/^[a-z0-9_.]{3,20}$/),display_name:z.string().trim().min(1).max(40),bio:z.string().max(160).default(''),home_gym:id.nullable().default(null),privacy:privacy.default({}),age16:z.literal(true)}).strict();
const reserved=['admin','administrator','support','fixmee','system','help','api','moderator','null','undefined'];
export function validHandle(value,extra=[]){return /^[a-z0-9_.]{3,20}$/.test(value)&&![...reserved,...extra].includes(value);}
export function distance(a,b){const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlng=(b.lng-a.lng)*r;return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlng/2)**2)));}
const coords={lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180)};
export async function blocked(env,a,b){return !!await q(env,'SELECT 1 FROM blocks WHERE (a=? AND b=?) OR (a=? AND b=?)',a,b,b,a).first();}
export async function friends(env,a,b){return !await blocked(env,a,b)&&!!await q(env,"SELECT 1 FROM friendships WHERE status='accepted' AND ((a=? AND b=?) OR (a=? AND b=?))",a,b,b,a).first();}
async function eligible(req,env){const u=await user(req,env),p=await q(env,'SELECT * FROM profiles WHERE user_id=?',u.id).first();if(p?.suspended)throw fail('Account suspended',403);return {u,p};}
async function member(env,c,u){if(!await q(env,'SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=? AND invited=0',c,u).first())throw fail('Members only',403);const peers=(await q(env,'SELECT user_id FROM conversation_members WHERE conversation_id=?',c).all()).results;for(const peer of peers)if(await blocked(env,u,peer.user_id))throw fail('Conversation unavailable',403);}
async function visible(env,viewer,p,field='profile'){if(viewer===p.user_id)return true;if(await blocked(env,viewer,p.user_id))return false;const v=JSON.parse(p.privacy||'{}')[field]||'friends';return v==='everyone'||v==='friends'&&await friends(env,viewer,p.user_id);}
export async function audit(req,env,action,target,detail={}){await q(env,'INSERT INTO admin_audit VALUES(?,?,?,?,?,?)',crypto.randomUUID(),(await hash(req.headers.get('Authorization')||'')).slice(0,16),action,target,JSON.stringify(detail),Date.now()).run();}
export async function pruneSocial(env,now=Date.now()){
 if(!env.DB)return;
 const old=(await q(env,'SELECT id,media_key FROM messages WHERE (expires IS NOT NULL AND expires<=?) OR created<?',now,now-180*86400000).all()).results;
 for(const m of old){if(m.media_key)await env.MEDIA?.delete(m.media_key);await q(env,'DELETE FROM messages WHERE id=?',m.id).run();}
 await q(env,'DELETE FROM social_invites WHERE expires<=?',now).run();
 await nudgeBuddies(env,now,friends);
}
async function notifyChat(env,conversation,sender){
 try{if(env.CONVERSATIONS)await env.CONVERSATIONS.get(env.CONVERSATIONS.idFromName(conversation)).fetch('https://conversation/notify',{method:'POST'});}catch{}
 try{const peers=(await q(env,'SELECT user_id FROM conversation_members WHERE conversation_id=? AND user_id<>? AND muted=0 AND invited=0',conversation,sender).all()).results;for(const peer of peers)if(!await blocked(env,sender,peer.user_id))await pushUser(env,peer.user_id,{title:'Fixmee',body:'New message from a friend',route:'#/messages/'+conversation,tag:'chat-'+conversation});}catch{/* A push failure must not change the result of a persisted message. */}
}
export async function social(req,env,path){
 if(!env.DB)throw fail('Database unavailable',503);
 const url=new URL(req.url),now=Date.now();
 const publicResult=await publicContent(req,env,path);if(publicResult)return publicResult;
 if(path==='/api/conversations/socket'){
  const ticket=url.searchParams.get('ticket');if(!/^[a-f0-9]{64}$/.test(ticket||''))throw fail('Invalid ticket',401);
  const key='chat-ticket:'+await hash(ticket),t=await env.CONFIG.get(key,'json');if(!t||t.expires<now)throw fail('Expired ticket',401);await env.CONFIG.delete(key);
  await member(env,t.conversation,t.user);if(!env.CONVERSATIONS)throw fail('Realtime unavailable',503);
  const stub=env.CONVERSATIONS.get(env.CONVERSATIONS.idFromName(t.conversation));return stub.fetch(new Request('https://conversation/socket',{headers:{Upgrade:'websocket','X-Conversation':t.conversation,'X-User':t.user}}));
 }
 if(path.startsWith('/api/admin/social/')){
  await admin(req,env);const actor=(await hash(req.headers.get('Authorization')||'')).slice(0,16),section=path.split('/').at(-1);
  const result=await adminSocial(req,env,section);if(result)return result;
  if(req.method==='GET'){
   const tables={reports:'reports',gyms:'gyms',audit:'admin_audit',members:'profiles',announcements:'announcements'};
   if(tables[section])return {items:(await q(env,`SELECT * FROM ${tables[section]} ${['audit','reports','announcements'].includes(section)?'ORDER BY '+(section==='announcements'?'start':'created')+' DESC':''} LIMIT 300`).all()).results};
   if(section==='dashboard'){const counts={};for(const table of ['profiles','checkins','messages','reports','gyms'])counts[table]=(await q(env,`SELECT count(*) n FROM ${table}`).first()).n;return {counts};}
   if(section==='settings')return await env.CONFIG.get('social-settings','json')||{};
  }
  if(req.method==='PUT'&&section==='settings'){const b=await input(req,z.object({profanity:z.array(z.string().min(1).max(40)).max(200),bannedHandles:z.array(z.string().max(20)).max(200),tileUrl:z.string().max(500).refine(v=>!v||v.startsWith('https://')),social:z.boolean(),chat:z.boolean(),checkin:z.boolean(),maintenance:z.string().max(300).default(''),aiEnabled:z.boolean().default(true)}).strict());await audit(req,env,'settings','social');await env.CONFIG.put('social-settings',JSON.stringify(b));return {ok:true};}
  if(req.method==='PUT'&&section==='gyms'){const b=await input(req,z.object({id,status:z.enum(['approved','rejected']),name:z.string().min(1).max(100).optional()}).strict());await env.DB.batch([q(env,'UPDATE gyms SET status=?,name=COALESCE(?,name),updated=? WHERE id=?',b.status,b.name??null,now,b.id),q(env,'INSERT INTO admin_audit VALUES(?,?,?,?,?,?)',crypto.randomUUID(),actor,'gym',b.id,JSON.stringify(b),now)]);return {ok:true};}
  if(req.method==='PUT'&&section==='reports'){const b=await input(req,z.object({id,action:z.enum(['dismiss','remove','warn','suspend'])}).strict()),r=await q(env,'SELECT * FROM reports WHERE id=?',b.id).first();if(!r)throw fail('Not found',404);const ops=[q(env,'UPDATE reports SET status=? WHERE id=?',b.action,b.id),q(env,'INSERT INTO admin_audit VALUES(?,?,?,?,?,?)',crypto.randomUUID(),actor,'report',b.id,JSON.stringify(b),now)];if(b.action==='remove'&&r.target_type==='message')ops.push(q(env,"UPDATE messages SET deleted=1,body='' WHERE id=?",r.target_id));if(b.action==='suspend'&&r.target_type==='profile')ops.push(q(env,'UPDATE profiles SET suspended=1 WHERE user_id=?',r.target_id));await env.DB.batch(ops);return {ok:true};}
  if(req.method==='PUT'&&section==='members'){const b=await input(req,z.object({id,suspended:z.boolean()}).strict());await audit(req,env,'suspend',b.id,{suspended:b.suspended});await q(env,'UPDATE profiles SET suspended=? WHERE user_id=?',Number(b.suspended),b.id).run();return {ok:true};}
  throw fail('Not found',404);
 }
 if(path==='/api/feed/announcements'&&req.method==='GET')return {items:(await q(env,'SELECT body,language FROM announcements WHERE start<=? AND end>?',now,now).all()).results,maintenance:(await env.CONFIG.get('social-settings','json'))?.maintenance||''};
 const {u,p}=await eligible(req,env),settings=await env.CONFIG?.get('social-settings','json')||{};
 if(settings.social===false)throw fail('Social is disabled',503);
 if(path==='/api/profile'&&req.method==='GET')return {profile:p?{...p,privacy:JSON.parse(p.privacy)}:null};
 if(path==='/api/profile'&&req.method==='PUT'){
  const b=await input(req,profile);if(!validHandle(b.handle,settings.bannedHandles))throw fail('Handle reserved');
  if(b.home_gym&&!await q(env,"SELECT 1 FROM gyms WHERE id=? AND status='approved'",b.home_gym).first())throw fail('Gym unavailable');
  try{await q(env,'INSERT INTO profiles(user_id,handle,display_name,bio,privacy,home_gym,age16,created) VALUES(?,?,?,?,?,?,1,?) ON CONFLICT(user_id) DO UPDATE SET handle=excluded.handle,display_name=excluded.display_name,bio=excluded.bio,privacy=excluded.privacy,home_gym=excluded.home_gym,age16=1',u.id,b.handle,b.display_name,b.bio,JSON.stringify(b.privacy),b.home_gym,now).run();}catch{throw fail('Handle unavailable',409);}return {ok:true};
 }
 if(!p?.age16)throw fail('Confirm age 16 or over in your profile',403);
 if(path.startsWith('/api/conversations')&&settings.chat===false)throw fail('Chat disabled',503);
 const extra=await socialExtra(req,env,path,{u,p,now,friends,member});if(extra)return extra;
 if(path.startsWith('/api/profile/avatar/')&&req.method==='GET'){const target=await q(env,'SELECT * FROM profiles WHERE handle=?',decodeURIComponent(path.split('/').at(-1))).first();if(!target||!await visible(env,u.id,target)||!target.avatar_key)throw fail('Avatar unavailable',404);const object=await env.MEDIA?.get(target.avatar_key);if(!object)throw fail('Avatar unavailable',404);return new Response(object.body,{headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
 if(path==='/api/friends/invite'&&req.method==='POST'){const code=random(16);await q(env,'INSERT INTO social_invites VALUES(?,?,?)',code,u.id,now+7*86400000).run();return {code};}
 if(path==='/api/friends/invite'&&req.method==='PUT'){const b=await input(req,z.object({code:z.string().regex(/^[a-f0-9]{32}$/)}).strict()),invite=await q(env,'SELECT user_id FROM social_invites WHERE code=? AND expires>?',b.code,now).first();if(!invite||invite.user_id===u.id||await blocked(env,u.id,invite.user_id))throw fail('Invite unavailable',404);const target=await q(env,'SELECT user_id,handle,display_name FROM profiles WHERE user_id=? AND suspended=0',invite.user_id).first();return {profile:target};}
 if(path==='/api/friends/suggestions'&&req.method==='GET'){
  if(!JSON.parse(p.privacy).suggestions)return {items:[]};const rows=(await q(env,'SELECT * FROM profiles WHERE user_id<>? AND suspended=0 LIMIT 200',u.id).all()).results,items=[];
  for(const row of rows){if(!JSON.parse(row.privacy).suggestions||await blocked(env,u.id,row.user_id)||await friends(env,u.id,row.user_id))continue;const mutual=await q(env,"SELECT count(*) n FROM friendships f JOIN friendships g ON (CASE WHEN f.a=? THEN f.b ELSE f.a END)=(CASE WHEN g.a=? THEN g.b ELSE g.a END) WHERE f.status='accepted' AND g.status='accepted' AND (f.a=? OR f.b=?) AND (g.a=? OR g.b=?)",u.id,row.user_id,u.id,u.id,row.user_id,row.user_id).first();if(p.home_gym&&p.home_gym===row.home_gym||mutual.n)items.push({user_id:row.user_id,handle:row.handle,display_name:row.display_name,mutual:mutual.n});}return {items:items.slice(0,30)};
 }
 if(path==='/api/profile/avatar'&&req.method==='POST'){
  if(!env.MEDIA)throw fail('Media unavailable',503);
  if(req.headers.get('Content-Type')!=='image/webp')throw fail('WebP required',415);
  if(Number(req.headers.get('Content-Length'))>150000)throw fail('Image too large',413);
  const reader=req.body?.getReader();if(!reader)throw fail('Image required');let size=0,chunks=[];while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>150000){await reader.cancel();throw fail('Image too large',413);}chunks.push(r.value);}const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}if(new TextDecoder().decode(bytes.slice(0,4))!=='RIFF'||new TextDecoder().decode(bytes.slice(8,12))!=='WEBP')throw fail('Invalid WebP');
  const key=`avatars/${u.id}/${crypto.randomUUID()}.webp`;await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:'image/webp'}});await q(env,'UPDATE profiles SET avatar_key=? WHERE user_id=?',key,u.id).run();if(p.avatar_key)await env.MEDIA.delete(p.avatar_key);return {ok:true};
 }
 if(path.startsWith('/api/profiles/')&&req.method==='GET'){
  const target=await q(env,'SELECT * FROM profiles WHERE handle=?',decodeURIComponent(path.split('/').at(-1))).first();if(!target||target.suspended||!await visible(env,u.id,target))throw fail('Profile unavailable',404);
  const prefs=JSON.parse(target.privacy),state=(await serverState(env,target.user_id)).json,logs=Object.entries(state.logs||{}),workouts=logs.filter(([,v])=>v.done?.workout).length;
  const visits=await q(env,'SELECT count(*) n,count(DISTINCT gym_id) gyms FROM checkins WHERE user_id=?',target.user_id).first();
  const result={user_id:target.user_id,handle:target.handle,display_name:target.display_name,bio:target.bio,home_gym:target.home_gym,stats:{},badges:[]};
  if(prefs.workouts)result.stats.workouts=workouts;
  if(await visible(env,u.id,target,'checkins')){result.stats.checkins=visits.n;for(const n of [1,10,50,100])if(visits.n>=n)result.badges.push('checkins-'+n);if(visits.gyms>=3)result.badges.push('gyms-3');}
  if(prefs.weight&&state.weights?.length>1)result.stats.weightChange=Number(state.weights.at(-1).kg)-Number(state.weights[0].kg);
  let current=0,best=0,previous='',prCount=0;const lifts={};for(const [date,log] of logs.sort(([a],[b])=>a.localeCompare(b))){if(log.done?.workout){current=previous&&Date.parse(date)-Date.parse(previous)===86400000?current+1:1;best=Math.max(best,current);previous=date;}for(const set of log.sets||[]){const score=(Number(set.kg)||0)*(1+(Number(set.reps)||0)/30);if(lifts[set.id]&&score>lifts[set.id])prCount++;lifts[set.id]=Math.max(lifts[set.id]||0,score);}}
  if(prefs.streak){result.stats.streak=previous&&Date.now()-Date.parse(previous)<2*86400000?current:0;for(const n of [7,30,100])if(best>=n)result.badges.push('streak-'+n);}
  if(prefs.workouts)result.stats.prs=prCount;
  if(await q(env,'SELECT 1 FROM supporters WHERE owner=?',target.user_id).first())result.badges.push('supporter');
  return {profile:result};
 }
 if(path==='/api/friends/search'&&req.method==='GET'){const term=(url.searchParams.get('q')||'').replace(/^@/,'').toLowerCase();if(!/^[a-z0-9_.]{3,20}$/.test(term))return {items:[]};const rows=(await q(env,'SELECT * FROM profiles WHERE handle=? AND suspended=0',term).all()).results;return {items:(await Promise.all(rows.map(async row=>await visible(env,u.id,row)?{user_id:row.user_id,handle:row.handle,display_name:row.display_name}:null))).filter(Boolean)};}
 if(path==='/api/friends'&&req.method==='GET')return {items:(await q(env,'SELECT f.*,p.handle,p.display_name,p.user_id FROM friendships f JOIN profiles p ON p.user_id=CASE WHEN f.a=? THEN f.b ELSE f.a END WHERE (f.a=? OR f.b=?) AND NOT EXISTS(SELECT 1 FROM blocks WHERE (a=? AND b=p.user_id) OR (b=? AND a=p.user_id))',u.id,u.id,u.id,u.id,u.id).all()).results};
 if(path==='/api/friends'&&req.method==='POST'){
  const b=await input(req,z.object({target:id,action:z.enum(['send','accept','decline','cancel','remove','block','mute','unmute'])}).strict());if(b.target===u.id)throw fail('Choose another account');if(!await q(env,'SELECT 1 FROM profiles WHERE user_id=? AND age16=1 AND suspended=0',b.target).first())throw fail('Profile unavailable',404);
  if(b.action==='block'){await env.DB.batch([q(env,'INSERT OR IGNORE INTO blocks VALUES(?,?,?)',u.id,b.target,now),q(env,'DELETE FROM friendships WHERE (a=? AND b=?) OR (a=? AND b=?)',u.id,b.target,b.target,u.id)]);return {ok:true};}
  if(await blocked(env,u.id,b.target))throw fail('Unavailable',403);
  if(b.action==='mute'||b.action==='unmute'){await q(env,b.action==='mute'?'INSERT OR IGNORE INTO friend_mutes VALUES(?,?)':'DELETE FROM friend_mutes WHERE user_id=? AND friend_id=?',u.id,b.target).run();return {ok:true};}
  if(b.action==='send'){if(await q(env,'SELECT 1 FROM friendships WHERE (a=? AND b=?) OR (a=? AND b=?)',u.id,b.target,b.target,u.id).first())throw fail('Request already exists',409);try{await q(env,'INSERT INTO friendships VALUES(?,?,?,?)',u.id,b.target,'pending',now).run();}catch(e){if(/unique|constraint/i.test(e.message))throw fail('Request already exists',409);throw e;}}
  else if(b.action==='accept'){const r=await q(env,"UPDATE friendships SET status='accepted' WHERE a=? AND b=? AND status='pending'",b.target,u.id).run();if(!r.meta.changes)throw fail('Request unavailable',409);}
  else if(b.action==='cancel')await q(env,"DELETE FROM friendships WHERE a=? AND b=? AND status='pending'",u.id,b.target).run();
  else if(b.action==='decline')await q(env,"DELETE FROM friendships WHERE a=? AND b=? AND status='pending'",b.target,u.id).run();
  else await q(env,'DELETE FROM friendships WHERE (a=? AND b=?) OR (a=? AND b=?)',u.id,b.target,b.target,u.id).run();return {ok:true};
 }
 if(path==='/api/reports'&&req.method==='POST'){const b=await input(req,z.object({target_type:z.enum(['message','profile','avatar','idea','checkin']),target_id:id,reason:z.string().trim().min(1).max(200),detail:z.string().max(1000).default('')}).strict());if(b.target_type==='message'){const m=await q(env,'SELECT conversation_id FROM messages WHERE id=?',b.target_id).first();if(!m)throw fail('Not found',404);await member(env,m.conversation_id,u.id);}await q(env,'INSERT INTO reports(id,reporter,target_type,target_id,reason,detail,created) VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),u.id,b.target_type,b.target_id,b.reason,b.detail,now).run();return {ok:true};}
 if(path==='/api/conversations'&&req.method==='GET')return {items:(await q(env,'SELECT c.*,m.muted,m.receipts,m.invited,(SELECT count(*) FROM messages WHERE conversation_id=c.id AND created>m.read_at AND sender<>? AND deleted=0 AND (expires IS NULL OR expires>?)) unread FROM conversations c JOIN conversation_members m ON m.conversation_id=c.id WHERE m.user_id=? AND NOT EXISTS (SELECT 1 FROM conversation_members peer JOIN blocks b ON (b.a=? AND b.b=peer.user_id) OR (b.b=? AND b.a=peer.user_id) WHERE peer.conversation_id=c.id)',u.id,now,u.id,u.id,u.id).all()).results};
 if(path==='/api/conversations'&&req.method==='POST'){
  if(settings.chat===false)throw fail('Chat disabled',503);const b=await input(req,z.object({members:z.array(id).min(1).max(19),title:z.string().max(80).default('')}).strict()),members=[...new Set([u.id,...b.members])];for(const peer of members)if(peer!==u.id&&!await friends(env,u.id,peer))throw fail('Friends only',403);const cid=crypto.randomUUID();await env.DB.batch([q(env,'INSERT INTO conversations VALUES(?,?,?)',cid,b.title,now),...members.map(m=>q(env,'INSERT INTO conversation_members(conversation_id,user_id,invited) VALUES(?,?,?)',cid,m,Number(m!==u.id&&members.length>2)))]);return {id:cid};
 }
 const cm=path.match(/^\/api\/conversations\/([a-f0-9-]{36})(?:\/(messages|read|ticket|photo|join))?$/);
 if(cm){if(settings.chat===false)throw fail('Chat disabled',503);
  if(cm[2]==='join'&&req.method==='PUT'){const b=await input(req,z.object({accept:z.boolean()}).strict());if(!await q(env,'SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=? AND invited=1',cm[1],u.id).first())throw fail('Invite unavailable',404);if(b.accept){const peers=(await q(env,'SELECT user_id FROM conversation_members WHERE conversation_id=?',cm[1]).all()).results;for(const peer of peers)if(await blocked(env,u.id,peer.user_id))throw fail('Invite unavailable',403);await q(env,'UPDATE conversation_members SET invited=0 WHERE conversation_id=? AND user_id=?',cm[1],u.id).run();}else await q(env,'DELETE FROM conversation_members WHERE conversation_id=? AND user_id=?',cm[1],u.id).run();return {ok:true};}
  await member(env,cm[1],u.id);
  if(cm[2]==='ticket'&&req.method==='POST'){if(!env.CONVERSATIONS)throw fail('Realtime unavailable',503);const ticket=random();await env.CONFIG.put('chat-ticket:'+await hash(ticket),JSON.stringify({conversation:cm[1],user:u.id,expires:now+60000}),{expirationTtl:60});return {ticket};}
  if(cm[2]==='photo'&&req.method==='POST'){
   const b=await input(req,z.object({data:z.string().min(16).max(1400000)}).strict(),1450000);let bytes;try{bytes=Uint8Array.from(atob(b.data),c=>c.charCodeAt(0));}catch{throw fail('Invalid photo');}if(bytes.length>1000000)throw fail('Image too large',413);if(new TextDecoder().decode(bytes.slice(0,4))!=='RIFF'||new TextDecoder().decode(bytes.slice(8,12))!=='WEBP')throw fail('WebP required',415);if(!env.MEDIA)throw fail('Media unavailable',503);
   const mid=crypto.randomUUID(),key=`chat/${cm[1]}/${mid}.webp`;await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:'image/webp'},customMetadata:{expires:String(now+86400000)}});
   try{const r=await q(env,"INSERT INTO messages(id,conversation_id,sender,body,kind,media_key,expires,created) SELECT ?,?,?,'','photo',?,?,? WHERE (SELECT count(*) FROM messages WHERE sender=? AND created>?)<30",mid,cm[1],u.id,key,now+86400000,now,u.id,now-60000).run();if(!r.meta.changes)throw fail('30 messages per minute',429);}catch(e){await env.MEDIA.delete(key);throw e;}await notifyChat(env,cm[1],u.id);return {id:mid,expires:now+86400000};
  }
  if(req.method==='GET'){const result={messages:(await q(env,'SELECT id,sender,body,kind,expires,created,deleted,reply_to FROM messages WHERE conversation_id=? AND (expires IS NULL OR expires>?) AND created>? ORDER BY created DESC LIMIT 100',cm[1],now,now-180*86400000).all()).results.reverse(),members:(await q(env,'SELECT user_id,CASE WHEN receipts=1 THEN read_at ELSE NULL END read_at FROM conversation_members WHERE conversation_id=?',cm[1]).all()).results,preferences:await q(env,'SELECT muted,receipts FROM conversation_members WHERE conversation_id=? AND user_id=?',cm[1],u.id).first()};for(const message of result.messages)message.reactions=(await q(env,'SELECT emoji,count(*) n FROM reactions WHERE target_id=? GROUP BY emoji',message.id).all()).results;return result;}
  if(cm[2]==='read'&&req.method==='PUT'){const b=await input(req,z.object({muted:z.boolean(),receipts:z.boolean()}).strict()),latest=(await q(env,'SELECT COALESCE(max(created),0) t FROM messages WHERE conversation_id=?',cm[1]).first()).t;const changed=await q(env,'UPDATE conversation_members SET muted=?,receipts=?,read_at=MAX(read_at,?) WHERE conversation_id=? AND user_id=? AND (muted<>? OR receipts<>? OR read_at<?)',Number(b.muted),Number(b.receipts),latest,cm[1],u.id,Number(b.muted),Number(b.receipts),latest).run();if(changed.meta.changes&&env.CONVERSATIONS)try{await env.CONVERSATIONS.get(env.CONVERSATIONS.idFromName(cm[1])).fetch('https://conversation/notify',{method:'POST'});}catch{}return {ok:true};}
  if(cm[2]==='messages'&&req.method==='POST'){
   const b=await input(req,z.object({body:z.string().trim().min(1).max(2000),kind:z.enum(['text','workout','pr','meal','recipe','checkin']).default('text'),reply_to:id.nullable().default(null)}).strict());
   if((settings.profanity||['fuck','shit','เหี้ย','สัส']).some(w=>b.body.toLowerCase().includes(w.toLowerCase())))throw fail('Please edit your message');
   if(b.reply_to&&!await q(env,'SELECT 1 FROM messages WHERE id=? AND conversation_id=? AND deleted=0',b.reply_to,cm[1]).first())throw fail('Reply unavailable');
   const mid=crypto.randomUUID(),r=await q(env,'INSERT INTO messages(id,conversation_id,sender,body,kind,created,reply_to) SELECT ?,?,?,?,?,?,? WHERE (SELECT count(*) FROM messages WHERE sender=? AND created>?)<30',mid,cm[1],u.id,b.body,b.kind,now,b.reply_to,u.id,now-60000).run();if(!r.meta.changes)throw fail('30 messages per minute',429);await notifyChat(env,cm[1],u.id);return {id:mid};
  }
 }
 const media=path.match(/^\/api\/messages\/([a-f0-9-]{36})\/photo$/);if(media&&req.method==='GET'){const m=await q(env,'SELECT * FROM messages WHERE id=? AND deleted=0 AND expires>?',media[1],now).first();if(!m?.media_key)throw fail('Photo expired',404);await member(env,m.conversation_id,u.id);const object=await env.MEDIA?.get(m.media_key);if(!object)throw fail('Photo expired',404);return new Response(object.body,{headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
 const reaction=path.match(/^\/api\/messages\/([a-f0-9-]{36})\/react$/);if(reaction&&req.method==='POST'){const m=await q(env,'SELECT * FROM messages WHERE id=? AND deleted=0 AND (expires IS NULL OR expires>?)',reaction[1],now).first();if(!m)throw fail('Message unavailable',404);await member(env,m.conversation_id,u.id);const b=await input(req,z.object({emoji:z.enum(['💪','🔥','👏'])}).strict());await q(env,'INSERT INTO reactions VALUES(?,?,?) ON CONFLICT(target_id,user_id) DO UPDATE SET emoji=excluded.emoji',m.id,u.id,b.emoji).run();return {ok:true};}
 const dm=path.match(/^\/api\/messages\/([a-f0-9-]{36})$/);if(dm&&req.method==='DELETE'){const r=await q(env,"UPDATE messages SET deleted=1,body='' WHERE id=? AND sender=? AND created>=?",dm[1],u.id,now-3600000).run();if(!r.meta.changes)throw fail('Deletion window expired',403);return {ok:true};}
 if(path==='/api/gyms'&&req.method==='GET'){const lat=Number(url.searchParams.get('lat')),lng=Number(url.searchParams.get('lng'));if(!url.searchParams.has('lat')||!url.searchParams.has('lng')||!z.object(coords).safeParse({lat,lng}).success)throw fail('Location required');await refreshGyms(env,lat,lng);const rows=(await q(env,"SELECT * FROM gyms WHERE status='approved' AND lat BETWEEN ? AND ?",lat-.03,lat+.03).all()).results;return {items:rows.filter(g=>distance({lat,lng},g)<=3000),tileUrl:settings.tileUrl||''};}
 if(path==='/api/gyms'&&req.method==='POST'){const b=await input(req,z.object({name:z.string().trim().min(1).max(100),...coords}).strict());await q(env,"INSERT INTO gyms VALUES(?,?,?,?,?,'pending','user',?)",crypto.randomUUID(),null,b.name,b.lat,b.lng,now).run();return {status:'pending'};}
 const gymPage=path.match(/^\/api\/gyms\/([a-f0-9-]{36})$/);
 if(gymPage&&req.method==='GET'){
  const gym=await q(env,"SELECT * FROM gyms WHERE id=? AND status='approved'",gymPage[1]).first();if(!gym)throw fail('Gym unavailable',404);
  const visits=(await q(env,'SELECT created FROM checkins WHERE gym_id=? AND user_id=? ORDER BY created DESC',gym.id,u.id).all()).results;
  const days=new Set(visits.map(v=>new Date(v.created).toISOString().slice(0,10)));let streak=0;for(let d=new Date(now);days.has(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()-1))streak++;
  const people=(await q(env,'SELECT DISTINCT p.* FROM checkins c JOIN profiles p ON p.user_id=c.user_id WHERE c.gym_id=? AND c.created>? AND c.visibility<>? AND p.suspended=0',gym.id,now-7*86400000,'only me').all()).results,peers=[];
  for(const person of people)if(JSON.parse(person.privacy).gymPresence&&await friends(env,u.id,person.user_id)&&await visible(env,u.id,person,'checkins'))peers.push({handle:person.handle,display_name:person.display_name});
  return {gym,visits:visits.length,streak,friends:peers};
 }
 const feedAction=path.match(/^\/api\/feed\/([a-f0-9-]{36})\/(react|comment)$/);
 if(feedAction&&req.method==='POST'){
  const item=await q(env,'SELECT f.*,p.privacy FROM feed_items f JOIN profiles p ON p.user_id=f.user_id WHERE f.id=? AND p.suspended=0',feedAction[1]).first();
  if(!item||!(item.user_id===u.id||item.visibility!=='only me'&&await friends(env,u.id,item.user_id))||!await visible(env,u.id,item,item.kind==='checkin'?'checkins':'profile'))throw fail('Unavailable',404);
  if(feedAction[2]==='react'){const b=await input(req,z.object({emoji:z.enum(['💪','🔥','👏'])}).strict());await q(env,'INSERT INTO reactions VALUES(?,?,?) ON CONFLICT(target_id,user_id) DO UPDATE SET emoji=excluded.emoji',item.id,u.id,b.emoji).run();}
  else{const b=await input(req,z.object({body:z.string().trim().min(1).max(300)}).strict());if((settings.profanity||['fuck','shit','เหี้ย','สัส']).some(w=>b.body.toLowerCase().includes(w.toLowerCase())))throw fail('Please edit your message');const n=await q(env,'SELECT count(*) n FROM feed_comments WHERE user_id=? AND created>?',u.id,now-60000).first();if(n.n>=10)throw fail('Please wait',429);await q(env,'INSERT INTO feed_comments VALUES(?,?,?,?,?)',crypto.randomUUID(),item.id,u.id,b.body,now).run();}return {ok:true};
 }
 if(path==='/api/checkins'&&req.method==='POST'){
  if(settings.checkin===false)throw fail('Check-in disabled',503);const b=await input(req,z.object({gym_id:id,...coords,accuracy:z.number().min(0).max(100),workout_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()}).strict()),g=await q(env,"SELECT * FROM gyms WHERE id=? AND status='approved'",b.gym_id).first();if(!g||distance(b,g)>200)throw fail('Must be within 200 m');const cid=crypto.randomUUID(),v=JSON.parse(p.privacy).checkins||'friends';const r=q(env,'INSERT INTO checkins SELECT ?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM checkins WHERE user_id=? AND gym_id=? AND created>?)',cid,u.id,b.gym_id,now,v,b.workout_date||null,u.id,b.gym_id,now-4*3600000);
  const last=await q(env,'SELECT created FROM checkins WHERE user_id=? AND gym_id=? ORDER BY created DESC LIMIT 1',u.id,b.gym_id).first();if(last&&now-last.created<4*3600000)throw fail('Wait four hours',429);
  const result=await env.DB.batch([r,q(env,'INSERT INTO feed_items SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM checkins WHERE id=?)',cid,u.id,'checkin',JSON.stringify({gym_id:g.id,name:g.name}),v,now,cid)]);if(!result[0].meta.changes)throw fail('Wait four hours',429);return {id:cid};
 }
 if(path==='/api/feed'&&req.method==='GET'){const rows=(await q(env,'SELECT f.*,p.handle,p.privacy FROM feed_items f JOIN profiles p ON p.user_id=f.user_id WHERE p.suspended=0 AND NOT EXISTS(SELECT 1 FROM friend_mutes WHERE user_id=? AND friend_id=f.user_id) ORDER BY f.created DESC LIMIT 200',u.id).all()).results;const items=[];for(const row of rows)if((row.user_id===u.id||row.visibility!=='only me'&&await friends(env,u.id,row.user_id))&&await visible(env,u.id,row,row.kind==='checkin'?'checkins':'profile')){row.reactions=(await q(env,'SELECT emoji,count(*) n FROM reactions WHERE target_id=? GROUP BY emoji',row.id).all()).results;row.comments=(await q(env,'SELECT c.body,p.handle FROM feed_comments c JOIN profiles p ON p.user_id=c.user_id WHERE c.target_id=? AND NOT EXISTS(SELECT 1 FROM blocks WHERE (a=? AND b=c.user_id) OR (b=? AND a=c.user_id)) ORDER BY c.created DESC LIMIT 20',row.id,u.id,u.id).all()).results;items.push(row);}return {items};}
 throw fail('Not found',404);
}
