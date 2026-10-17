import { getState, setState, subscribe } from './store.js';
import { planDay } from './day.js';
// Snapshot targets with a day's log so future plan changes do not rewrite adherence.
export function startMetrics() {
 let busy=false;const seen=new Map();
 const update=(s,{remote=false}={})=>{
  if(busy||remote)return;
  const updates=[];
  for(const [date,l] of Object.entries(s.logs)){
   const signature=JSON.stringify([l.done,l.foodLog]);if(seen.get(date)===signature)continue;seen.set(date,signature);
   const d=planDay(date);let kcal=0;
   for(const e of d.events){if(!l.done?.[e.key])continue;if(e.type==='meal')kcal+=e.meal.total.k||0;if(e.type==='supp')kcal+=e.list.reduce((n,x)=>n+(x.prod.nutrition?.k||0)*x.amount,0);}
   kcal+=(l.foodLog||[]).reduce((n,v)=>n+(v.totals?.kcal||0),0);
   const meals=d.events.filter(e=>e.type==='meal');
   updates.push([date,{targets:l.targets||{kcal:d.t.kcal,water:d.t.water},kcalAdherence:Math.max(0,1-Math.abs(kcal-(l.targets?.kcal||d.t.kcal))/(l.targets?.kcal||d.t.kcal)),mealAdherence:meals.length?meals.filter(e=>l.done?.[e.key]).length/meals.length:0}]);
  }
  if(updates.length){busy=true;setState(s=>{for(const [date,values] of updates)Object.assign(s.logs[date],values);});busy=false;}
 };
 subscribe(update);update(getState());
}
