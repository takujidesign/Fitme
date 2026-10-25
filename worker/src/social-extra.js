import {z} from 'zod/v4';
import {query as q,serverState} from './accounts.js';
import {input,fail} from './security.js';
import {challengeDay} from '../../app/js/challenges.js';
import {EX} from '../../app/js/exercises.js';
import {pushUser} from './push.js';
import {activity} from './social-activity.js';
const id=z.string().uuid();
const day=at=>new Date(at).toISOString().slice(0,10);
const plus=(date,n)=>day(Date.parse(date+'T12:00:00Z')+n*86400000);
export async function socialExtra(req,env,path,{u,p,now,friends,member}){
 if(path==='/api/friends/duels'){
  if(req.method==='POST'){
   const b=await input(req,z.object({target:id,days:z.union([z.literal(7),z.literal(30)]),metric:z.enum(['workout','steps','checkins'])}).strict());
   if(!await friends(env,u.id,b.target))throw fail('Friends only',403);
   if((await q(env,"SELECT count(*) n FROM friend_duels WHERE a=? AND created>?",u.id,now-86400000).first()).n>=10)throw fail('Please wait',429);
   const key=crypto.randomUUID();await q(env,'INSERT INTO friend_duels VALUES(?,?,?,?,?,?,?,?)',key,u.id,b.target,b.metric,b.days,day(now),'pending',now).run();return {id:key};
  }
  if(req.method==='PUT'){
   const b=await input(req,z.object({id,accept:z.boolean()}).strict()),duel=await q(env,'SELECT * FROM friend_duels WHERE id=? AND b=? AND status=?',b.id,u.id,'pending').first();
   if(!duel||!await friends(env,u.id,duel.a))throw fail('Invite unavailable',403);
   await q(env,'UPDATE friend_duels SET status=?,start=? WHERE id=?',b.accept?'active':'declined',day(now),b.id).run();return {ok:true};
  }
  if(req.method==='GET'){
   const rows=(await q(env,'SELECT * FROM friend_duels WHERE a=? OR b=? ORDER BY created DESC LIMIT 100',u.id,u.id).all()).results,items=[];
   for(const d of rows){if(!await friends(env,d.a,d.b))continue;const leaderboard=[];
    for(const user of [d.a,d.b]){const s=(await serverState(env,user)).json;let score=0;
     if(d.status==='active')for(let n=0;n<d.days;n++){const date=plus(d.start,n);if(date>day(now))break;const log=s.logs?.[date]||{};
      if(d.metric==='checkins')score+=(await q(env,'SELECT count(*) n FROM checkins WHERE user_id=? AND created>=? AND created<?',user,Date.parse(date+'T00:00:00Z'),Date.parse(plus(date,1)+'T00:00:00Z')).first()).n;
      else if(d.metric==='workout')score+=Number(!!log.done?.workout&&challengeDay('workout',log,s.profile||{},date,s.dayOverrides));
      else score+=Math.max(0,Math.min(100000,Number(log.health?.steps)||0));
     }
     const profile=await q(env,'SELECT handle FROM profiles WHERE user_id=?',user).first();leaderboard.push({user_id:user,handle:profile?.handle,score});
    }const finished=day(now)>=plus(d.start,d.days);leaderboard.sort((a,b)=>b.score-a.score);if(d.status==='active'&&finished&&leaderboard[0].score>leaderboard[1].score)await activity(env,leaderboard[0].user_id,'challenge',d.id,{metric:d.metric,days:d.days},now);items.push({...d,leaderboard,finished});
   }return {items};
  }
 }
 if(path==='/api/friends/buddy'){
  if(req.method==='GET')return {items:(await q(env,'SELECT b.*,p.handle FROM buddies b JOIN profiles p ON p.user_id=CASE WHEN b.user_id=? THEN b.buddy_id ELSE b.user_id END WHERE b.user_id=? OR b.buddy_id=?',u.id,u.id,u.id).all()).results};
  if(req.method==='DELETE'){await q(env,'DELETE FROM buddies WHERE user_id=? OR buddy_id=?',u.id,u.id).run();return {ok:true};}
  if(req.method==='PUT'){const b=await input(req,z.object({target:id,consent:z.literal(true)}).strict());if(!await friends(env,u.id,b.target))throw fail('Friends only',403);await q(env,'INSERT INTO buddies VALUES(?,?,0,NULL) ON CONFLICT(user_id) DO UPDATE SET buddy_id=excluded.buddy_id,approved=0,last_nudge=NULL',u.id,b.target).run();return {ok:true};}
  if(req.method==='POST'){const b=await input(req,z.object({user_id:id,accept:z.boolean()}).strict());if(!await friends(env,u.id,b.user_id))throw fail('Friends only',403);if(b.accept)await q(env,'UPDATE buddies SET approved=1 WHERE user_id=? AND buddy_id=?',b.user_id,u.id).run();else await q(env,'DELETE FROM buddies WHERE user_id=? AND buddy_id=?',b.user_id,u.id).run();return {ok:true};}
 }
 if(path==='/api/friends/recap'&&req.method==='GET'){
  const end=day(now),start=plus(end,-6),state=(await serverState(env,u.id)).json;let workouts=0,minutes=0,prs=0,nutrition=0,logged=0,steps=0;const best={};
  for(const [date,log] of Object.entries(state.logs||{}).sort(([a],[b])=>a.localeCompare(b))){if(date>end)continue;const inside=date>=start;if(inside){steps+=Math.max(0,Number(log.health?.steps)||0);if(log.done?.workout){workouts++;minutes+=Number(log.workout?.minutes)||0;}if(log.foodLog?.length||log.mealAdherence!==undefined){logged++;nutrition+=Number(challengeDay('food',log,state.profile||{},date));}}
   for(const set of log.sets||[]){const score=(Number(set.kg)||0)*(1+(Number(set.reps)||0)/30);if(inside&&best[set.id]&&score>best[set.id])prs++;best[set.id]=Math.max(best[set.id]||0,score);}
  }
  const checkins=(await q(env,'SELECT count(*) n FROM checkins WHERE user_id=? AND created>=? AND created<=?',u.id,Date.parse(start+'T00:00:00Z'),now).first()).n;
  return {start,end,workouts,minutes,prs,checkins,steps,nutrition:logged?Math.round(nutrition/logged*100):null};
 }
 const session=path.match(/^\/api\/conversations\/([a-f0-9-]{36})\/session$/);
 if(session){await member(env,session[1],u.id);
  if(req.method==='POST'){
   const item=z.object({id:z.string().refine(v=>!!EX[v]),sets:z.number().int().min(1).max(10),reps:z.union([z.number().int().min(1).max(100),z.string().regex(/^\d{1,3}(?:-\d{1,3})?$/)]).optional(),sec:z.number().int().min(1).max(3600).optional(),rest:z.number().int().min(0).max(600).optional(),kg:z.number().min(0).max(1000).optional()}).strict();
   const b=await input(req,z.object({items:z.array(item).min(1).max(30)}).strict());
   const active=await q(env,'SELECT created FROM shared_sessions WHERE conversation_id=?',session[1]).first();if(active&&now-active.created<12*3600000)throw fail('Session already active',409);
   await env.DB.batch([q(env,'INSERT INTO shared_sessions VALUES(?,?,0,?) ON CONFLICT(conversation_id) DO UPDATE SET workout=excluded.workout,rest_until=0,created=excluded.created',session[1],JSON.stringify(b),now),q(env,'DELETE FROM shared_results WHERE conversation_id=?',session[1])]);
  }else if(req.method==='PUT'){
   const b=await input(req,z.union([z.object({seconds:z.number().int().min(0).max(600)}).strict(),z.object({minutes:z.number().min(0).max(720),reps:z.number().int().min(0).max(10000)}).strict()]));
   if(!await q(env,'SELECT 1 FROM shared_sessions WHERE conversation_id=? AND created>?',session[1],now-12*3600000).first())throw fail('Session expired',404);
   if('seconds' in b)await q(env,'UPDATE shared_sessions SET rest_until=? WHERE conversation_id=?',now+b.seconds*1000,session[1]).run();
   else await q(env,'INSERT INTO shared_results VALUES(?,?,?,?,?) ON CONFLICT(conversation_id,user_id) DO UPDATE SET minutes=excluded.minutes,reps=excluded.reps,created=excluded.created',session[1],u.id,b.minutes,b.reps,now).run();
  }else if(req.method!=='GET')throw fail('Method not allowed',405);
  if(req.method!=='GET'&&env.CONVERSATIONS)try{await env.CONVERSATIONS.get(env.CONVERSATIONS.idFromName(session[1])).fetch('https://conversation/notify',{method:'POST'});}catch{}
  const row=await q(env,'SELECT * FROM shared_sessions WHERE conversation_id=? AND created>?',session[1],now-12*3600000).first();
  return {session:row?{...row,workout:JSON.parse(row.workout)}:null,results:(await q(env,'SELECT r.user_id,r.minutes,r.reps,p.handle FROM shared_results r JOIN profiles p ON p.user_id=r.user_id WHERE conversation_id=?',session[1]).all()).results};
 }
 return null;
}
export async function nudgeBuddies(env,now,friends){
 if(!env.DB||!env.PUSH)return;const rows=(await q(env,'SELECT * FROM buddies WHERE approved=1').all()).results;
 for(const b of rows){if(!await friends(env,b.user_id,b.buddy_id))continue;const state=await serverState(env,b.user_id);if(state.updated_at<now-5*86400000)continue;const s=state.json,dates=[];
  for(let n=1;n<=14&&dates.length<2;n++){const date=plus(day(now),-n);if(s.dayOverrides?.[date]==='train'||s.dayOverrides?.[date]!=='off'&&(s.profile?.trainDays||[]).includes(new Date(date+'T12:00:00Z').getUTCDay()))dates.push(date);}
  if(dates.length<2||dates.some(date=>s.logs?.[date]?.done?.workout)||b.last_nudge===dates[0])continue;
  const sent=await pushUser(env,b.buddy_id,{title:'Fixmee',body:'Your buddy missed two planned workouts. A gentle check-in may help.',route:'#/friends',tag:'buddy-'+b.user_id});
  if(sent)await q(env,'UPDATE buddies SET last_nudge=? WHERE user_id=? AND approved=1',dates[0],b.user_id).run();
 }
}
