import { addDays, diffDays, todayISO } from './store.js';
export const CHALLENGES=[
 {id:'workout',th:'30 วันไม่ขาดซ้อม',en:'30 days of scheduled workouts',days:30},
 {id:'water',th:'ดื่มน้ำครบ 30 วัน',en:'30 days of hydration',days:30},
 {id:'sleep',th:'นอนครบ 7 ชม. 21 วัน',en:'21 nights of 7 hours sleep',days:21},
 {id:'food',th:'ทำตามแผนอาหาร 80% 30 วัน',en:'30 days of 80% meal adherence',days:30},
 {id:'steps',th:'10,000 ก้าว 30 วัน',en:'30 days of 10,000 steps',days:30},
 {id:'fasting',th:'IF 16:8 ครบ 30 วัน',en:'30 days of 16:8 fasting',days:30},
];
export function challengeDay(id,log={},profile={},date,overrides={}) {
 const training=overrides[date]==='train'||overrides[date]!=='off'&&(profile.trainDays||[]).includes(new Date(date+'T00:00:00').getDay());
 if(id==='workout')return training?!!log.done?.workout:true;
 if(id==='water')return log.water>=(log.targets?.water||Math.round(((profile.weight||70)*35+(training?600:0))/50)*50);
 if(id==='sleep')return log.sleep?.hours>=7;
 if(id==='food')return (log.mealAdherence??Object.entries(log.done||{}).filter(([k,v])=>k.startsWith('meal:')&&v).length/(profile.mealsPerDay||4))>=.8;
 if(id==='steps')return log.health?.steps>=10000;
 if(id==='fasting')return log.fasting?.pattern==='16:8'&&log.fasting?.completed===true;
 return false;
}
export function challengeProgress(join,s,today=todayISO()) {
 const def=CHALLENGES.find(c=>c.id===join.id);if(!def)return null;
 const elapsed=Math.max(0,Math.min(def.days,diffDays(join.startDate,today)+1)),checks=[];
 let streak=0,freeze=1,completed=0;
 for(let i=0;i<elapsed;i++) {
  const date=addDays(join.startDate,i),ok=challengeDay(join.id,s.logs[date],s.profile,date,s.dayOverrides),closed=date<today;
  let frozen=false;
  if(i>0&&i%10===0)freeze=1;
  if(ok){streak++;completed++;}
  else if(closed&&freeze){freeze--;streak++;frozen=true;}else if(closed)streak=0;
  checks.push({date,ok,frozen});
 }
 return {checks,streak,completed,freeze,total:def.days,finished:completed===def.days};
}
export const BADGES=[
 ...[1,10,50,100].map(n=>({id:'workouts-'+n,th:n===1?'ออกกำลังครั้งแรก':`ออกกำลัง ${n} ครั้ง`,en:n===1?'First workout':`${n} workouts`})),
 ...[7,30,100].map(n=>({id:'streak-'+n,th:`ต่อเนื่อง ${n} วัน`,en:`${n}-day streak`})),
 ...[1,3,5].map(n=>({id:'loss-'+n,th:`ลดน้ำหนัก ${n} kg`,en:`First −${n} kg`})),
 {id:'perfect-week',th:'สัปดาห์สมบูรณ์แบบ',en:'Perfect week'},
 {id:'pr',th:'สถิติใหม่ครั้งแรก',en:'First personal record'}
];
export function earnedBadges(s,today=todayISO()) {
 const days=Object.entries(s.logs||{}).filter(([d])=>d<=today).sort(([a],[b])=>a.localeCompare(b));
 const workouts=days.filter(([,l])=>l.done?.workout);let best=0,streak=0,prev='',pr=false;const lifts={};
 for(const [date,l] of days){if(l.done?.workout){streak=prev&&diffDays(prev,date)===1?streak+1:1;prev=date;best=Math.max(best,streak);}const daily={};for(const set of l.sets||[]){const score=set.kg*(1+set.reps/30);if(score>0)daily[set.id]=Math.max(daily[set.id]||0,score);}for(const [id,score] of Object.entries(daily)){if(lifts[id]&&score>lifts[id])pr=true;lifts[id]=Math.max(lifts[id]||0,score);}}
 const weights=(s.weights||[]).filter(w=>w.date<=today).sort((a,b)=>a.date.localeCompare(b.date)),loss=weights.length>1?weights[0].kg-Math.min(...weights.slice(1).map(w=>w.kg)):0;
 let perfect=false;
 for(const [date] of days){if(new Date(date+'T00:00:00').getDay()!==1||addDays(date,6)>=today)continue;let scheduled=0,done=0;for(let i=0;i<7;i++){const iso=addDays(date,i);if(iso<(s.profile.startDate||''))continue;if(s.dayOverrides?.[iso]==='train'||s.dayOverrides?.[iso]!=='off'&&s.profile.trainDays.includes(new Date(iso+'T00:00:00').getDay())){scheduled++;if(s.logs[iso]?.done?.workout)done++;}}if(scheduled&&done===scheduled)perfect=true;}
 return BADGES.filter(b=>{const [type,n]=b.id.split('-');return type==='workouts'?workouts.length>=Number(n):type==='streak'?best>=Number(n):type==='loss'?loss>=Number(n):b.id==='pr'?pr:perfect;}).map(b=>b.id);
}
