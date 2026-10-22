import {hash} from './security.js';
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
export async function activity(env,userId,kind,key,body,now=Date.now()){
 const p=await q(env,'SELECT age16,suspended,privacy FROM profiles WHERE user_id=?',userId).first();if(!p?.age16||p.suspended)return;
 const privacy=JSON.parse(p.privacy);if(!privacy.workouts||privacy.profile==='only me')return;
 const digest=await hash(userId+':'+kind+':'+key),id=`${digest.slice(0,8)}-${digest.slice(8,12)}-4${digest.slice(13,16)}-8${digest.slice(17,20)}-${digest.slice(20,32)}`;
 await q(env,'INSERT OR IGNORE INTO feed_items VALUES(?,?,?,?,?,?)',id,userId,kind,JSON.stringify(body),'friends',now).run();
}
export async function publishWorkouts(env,userId,before,after){
 const today=new Date().toISOString().slice(0,10),best={};
 for(const log of Object.values(before.logs||{}))for(const set of log.sets||[]){const score=(Number(set.kg)||0)*(1+(Number(set.reps)||0)/30);best[set.id]=Math.max(best[set.id]||0,score);}
 for(const [date,log] of Object.entries(after.logs||{})){if(date>today||Date.parse(today)-Date.parse(date)>7*86400000)continue;
  if(log.done?.workout&&!before.logs?.[date]?.done?.workout)await activity(env,userId,'workout',date,{date,minutes:Math.max(0,Number(log.workout?.minutes)||0)});
  for(const set of log.sets||[]){const score=(Number(set.kg)||0)*(1+(Number(set.reps)||0)/30);if(best[set.id]&&score>best[set.id])await activity(env,userId,'pr',date+':'+set.id,{date,exercise:set.id});}
 }
}
