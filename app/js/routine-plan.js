import {toMin, toHHMM} from './ui.js';
import {eatingWindow, inWindow, FASTING} from './fasting.js';

export const validTime = t => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
export const mealCount = p => Math.max(1, Math.min(6, Number(p.mealsPerDay) || 3));
export function resizeMeals(meals, n) {
  const rows = (meals || []).map(m => ({time:validTime(m?.time) ? m.time : null}));
  while (rows.length > n) { const i=rows.findLastIndex(m=>!m.time); rows.splice(i<0?rows.length-1:i,1); }
  while (rows.length < n) rows.push({time:null});
  return rows;
}
export function resizeRoutine(p) {
  if (!p.routine) return;
  p.routine.meals=resizeMeals(p.routine.meals,mealCount(p));
  if(p.routine.weekend?.meals)p.routine.weekend.meals=resizeMeals(p.routine.weekend.meals,mealCount(p));
}
export const wakingMinute = (t,p) => {const m=typeof t==='number'?t:toMin(t);return toMin(p.wake)+((m-toMin(p.wake))%1440+1440)%1440;};
export function routineProfile(p,iso,overrides={}) {
  if(!p.routine&&!Object.keys(overrides).length&&mealCount(p)>=3)return p;
  const day=new Date(iso+'T12:00:00').getDay(), weekend=[0,6].includes(day)?p.routine?.weekend:null;
  const q={...p,...(weekend?.wake?{wake:weekend.wake}:{}),...(weekend?.bed?{bed:weekend.bed}:{}),_routine:true};
  q._meals=resizeMeals(weekend?.meals||p.routine?.meals,mealCount(p)).map((m,i)=>({time:Object.hasOwn(overrides,'meal-m'+i)?overrides['meal-m'+i]:m.time}));
  if(validTime(overrides.workout))q.workoutTime=overrides.workout;
  q._activities=(p.routine?.activities||[]).filter(a=>a.days?.includes(day)&&validTime(a.start)&&validTime(a.end)).map(a=>{
    const start=validTime(overrides['activity-'+a.id])?overrides['activity-'+a.id]:a.start;
    return {...a,start,end:toHHMM(toMin(start)+(toMin(a.end)-toMin(a.start)+1440)%1440)};
  });
  if(p.routine?.workoutAutomatic&&!validTime(overrides.workout)||Object.hasOwn(overrides,'workout')&&!validTime(overrides.workout)){
    const bed=wakingMinute(q.bed,q);for(let t=toMin(q.wake)+60;t+Number(q.sessionMin)<=bed;t+=15)if(!busyBlocks(q).some(([a,b])=>t<b&&t+Number(q.sessionMin)>a)&&q._meals.every(m=>!validTime(m.time)||wakingMinute(m.time,q)<=t-45||wakingMinute(m.time,q)>=t+Number(q.sessionMin)+30)){q.workoutTime=toHHMM(t);break;}
  }
  q._chosenWindow=eatingWindow(q);
  if(q._chosenWindow) {
    const first=q._meals[0].time,last=q._meals.at(-1).time,len=q._chosenWindow.length;
    if(first||last){const start=first?wakingMinute(first,q):wakingMinute(last,q)-len;
      let end=last?wakingMinute(last,q):start+len;if(end<start)end+=1440;
      q._window={start,end,length:end-start};
    }
  }
  return q;
}
export const busyBlocks = p => (p._activities||[]).filter(a=>a.kind==='busy').flatMap(a=>{const start=wakingMinute(a.start,p),end=start+(toMin(a.end)-toMin(a.start)+1440)%1440;return [[start,end],[start-1440,end-1440]];});
export const inBusy = (min,p) => busyBlocks(p).some(([a,b])=>wakingMinute(min,p)>=a&&wakingMinute(min,p)<b);
export function routineMealSlots(p,train,spreadAround) {
  const wake=toMin(p.wake),bed=wakingMinute(p.bed,p),gym=wakingMinute(p.workoutTime,p),end=gym+Number(p.sessionMin);
  const window=eatingWindow(p);
  const ranges=window?[-1440,0,1440].map(k=>[Math.max(wake+30,window.start+k),Math.min(bed-180,window.end+k)]):[[wake+30,bed-180]];
  const [lo,hi]=ranges.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]))[0];
  const rows=p._meals.map((m,i)=>({key:'m'+i,fixed:validTime(m.time),min:validTime(m.time)?wakingMinute(m.time,p):null}));
  const busy=busyBlocks(p),blocks=[...busy];if(train)blocks.push([gym-45,end+30]);
  const allowed=t=>t>=lo&&t<=hi&&!busy.some(([a,b])=>t>=a&&t<b)&&(!train||t<=gym-45||t>=end+30);
  for(let i=0;i<rows.length;) {
    if(rows[i].fixed){i++;continue;}let j=i;while(j<rows.length&&!rows[j].fixed)j++;
    const lower=Math.max(lo,i?rows[i-1].min+90:lo),upper=Math.min(hi,j<rows.length?rows[j].min-90:hi),n=j-i;
    const before=i>0,after=j<rows.length,span=Math.max(0,upper-lower);
    const ideals=before||after?Array.from({length:n},(_,k)=>lower+span*(before&&after?(k+1)/(n+1):before?(k+1)/n:k/n)):spreadAround(lower,Math.max(lower,upper),n,blocks);
    const candidates=[];for(let t=Math.ceil(lower/5)*5;t<=upper;t+=5)if(allowed(t)&&rows.every(r=>r.min===null||Math.abs(r.min-t)>=90))candidates.push(t);
    const failed=new Set();let count=n;
    const solve=(k,after)=>{if(k===count)return [];if(failed.has(k+':'+after))return null;const ideal=ideals[k]??lower+(upper-lower)*k/Math.max(1,n-1);
      for(const t of candidates.filter(t=>t>=after&&t+90*(count-k-1)<=upper).sort((a,b)=>Math.abs(a-ideal)-Math.abs(b-ideal))){const tail=solve(k+1,t+90);if(tail)return [t,...tail];}failed.add(k+':'+after);return null;};
    let times;for(;count>0;count--){failed.clear();times=solve(0,lower);if(times)break;}times||=[];
    for(let k=i;k<j;k++)rows[k].min=times[k-i]??null;i=j;
  }
  const list=rows.filter(r=>r.min!==null).sort((a,b)=>a.min-b.min);
  return list.map((m,i)=>{const post=train&&m.min-end>=30&&m.min-end<=150,pre=train&&gym-m.min>=45&&gym-m.min<=180;
    return {...m,kind:list.length===1?'lunch':i===0?'breakfast':i===list.length-1?'dinner':m.min<14*60?'lunch':'snack',share:1/list.length,time:toHHMM(m.min),...(post?{post:true,carbBoost:1.25}:{}),...(pre?{pre:true}:{})};});
}
export function routineWarnings(p,meals,train) {
  const out=[],wake=toMin(p.wake),bed=wakingMinute(p.bed,p),gym=wakingMinute(p.workoutTime,p),window=eatingWindow(p);
  const add=(code,key)=>out.push({code,key});
  const sorted=[...meals].sort((a,b)=>a.min-b.min);
  for(const m of sorted){const key='meal-'+m.key;
    if(m.min<wake+20)add('wake',key);
    if(m.min>bed-120)add('bed',key);
    if(sorted.some(x=>x!==m&&Math.abs(x.min-m.min)<60))add('spacing',key);
    if(train&&m.min>gym-45&&m.min<gym+Number(p.sessionMin)+30)add('workout',key);
    if(inBusy(m.min,p))add('busy',key);
    if(window&&!inWindow(m.min,window)&&m.min!==window.end)add('if',key);
  }
  for(const [i,m] of p._meals.entries())if(!validTime(m.time)&&!meals.some(x=>x.key==='m'+i))add('unplaced','meal-m'+i);
  if(train&&(gym+Number(p.sessionMin)>bed||gym<wake))add('sleep','workout');
  return out;
}
export function impliedFast(p) {
  if(!p._window)return null;
  const w=p._window,minutes=1440-w.length;
  return {minutes,start:toHHMM(w.end),end:toHHMM(w.start),mismatch:w.length!==p._chosenWindow.length||toHHMM(w.start)!==toHHMM(p._chosenWindow.start),pattern:Object.keys(FASTING).find(k=>FASTING[k]*60===w.length)||null};
}
export function optionalSnack(p,meals,train) {
  if(!train||p.routine?.postWorkoutSnack===false||meals.some(m=>m.post))return null;
  const min=wakingMinute(p.workoutTime,p)+Number(p.sessionMin)+30,bed=wakingMinute(p.bed,p);
  return min<=bed-120&&!inBusy(min,p)?{key:'post-snack',min,type:'suggestion',optional:true}:null;
}
