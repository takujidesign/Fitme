import {routineProfile, routineWarnings, impliedFast, optionalSnack, inBusy, wakingMinute} from './routine-plan.js';
import { hasCondition } from './conditions.js';
import { supplementTime } from './interactions.js';
import { blockProfile } from './replan.js';
import { eatingWindow, inWindow, windowMinute } from './fasting.js';
// Combines workout, meals, supplements, hydration and sleep into one daily timeline.
import { getState, addDays, diffDays } from './store.js';
import { targets } from './calc.js';
import { sessionFor, isTrainingDay, sessionKcal } from './workout.js';
import { dayMeals } from './meals.js';
import { dosesFor, suppMacros, productOf, SLOTS } from './supplements.js';
import { toMin, toHHMM } from './ui.js';

export function planDay(iso, previewProfile) {
  const s = getState();
  const p = routineProfile(previewProfile || blockProfile(s, iso),iso,s.logs[iso]?.timeOverrides);
  const train = isTrainingDay(p, iso) && diffDays(p.startDate, iso) >= 0;
  const supps = s.supplements;
  const sm = suppMacros(supps, p, iso, train);
  const t = targets(p, train, sm, iso);
  if (!hasCondition(p,'kidney') && !hasCondition(p,'heart') && supps.some((x) => !x.paused && productOf(x)?.category === 'creatine')) t.water += 500;
  const sess = sessionFor(p, iso);
  const meals = dayMeals(p, iso, train, t, s.mealSeed);
  const wake = toMin(p.wake);
  let bed = toMin(p.bed); if (bed <= wake) bed += 1440;
  const w = p._routine ? wakingMinute(p.workoutTime,p) : toMin(p.workoutTime);
  const findMeal = (kinds) => meals.find((m) => kinds.includes(m.kind));
  const slotTime = {
    morning: wake + 10,
    breakfast: (findMeal(['breakfast'])?.min ?? wake + 30) + 15,
    lunch: (findMeal(['lunch'])?.min ?? 720) + 10,
    afternoon: 15 * 60 + 30,
    pre: w - 30,
    post: w + p.sessionMin + 5,
    dinner: (findMeal(['dinner'])?.min ?? bed - 180) + 15,
    night: bed - 30,
  };
  if(p._routine)Object.assign(slotTime,{breakfast:findMeal(['breakfast'])?.min??meals[0]?.min??wake+30,lunch:findMeal(['lunch'])?.min??meals[Math.floor(meals.length/2)]?.min??wake+30,dinner:findMeal(['dinner'])?.min??meals.at(-1)?.min??bed-180});
  const events = [];
  for(const med of p.medications||[])for(const time of med.times||[])events.push({key:'med-'+med.id+'-'+time,min:toMin(time),type:'medication',medication:med});
  const window = eatingWindow(p);
  if (window) {
    events.push({key:'eat-start',min:window.start,type:'fasting',eating:true});
    events.push({key:'fast-start',min:window.end,type:'fasting',eating:false});
  }
  events.push({ key: 'wake', min: wake, type: 'wake' });
  events.push({ key: 'water-am', min: wake + 5, type: 'water', ml: 500 });
  meals.forEach((m) => events.push({ key: 'meal-' + m.key, min: m.min, type: 'meal', meal: m, ...(p._routine?{fixed:m.fixed}:{}) }));
  if (sess) events.push({ key: 'workout', min: train || p._routine ? w : Math.max(wake + 60, toMin('17:30')), type: 'workout', sess, kcal: sessionKcal(sess, p.weight) });
  // group supplement doses by slot
  const bySlot = {};
  for (const sp of supps) {
    for (const d of dosesFor(sp, p, iso, train, supps)) {
      const prod = productOf(sp);
      const needsFood = ['breakfast','lunch','dinner'].includes(d.slot) || prod?.nutrition?.k > 0 || prod?.nutrition?.p > 0;
      const time = slotTime[d.slot];
      const moved = window && needsFood;
      let initialMin = moved ? (inWindow(time,window) ? windowMinute(time,window) : meals[0]?.min ?? time) : time;
      if(p._routine)initialMin=moved?(inWindow(time,window)||time===window.end?time:meals[0]?.min??time):time;
      if(p._routine){
        const allowed=at=>at>=wake&&at<bed&&!inBusy(at,p)&&(!window||!needsFood||inWindow(at,window)||at===window.end);
        const choices=Array.from({length:Math.max(0,bed-wake)},(_,i)=>wake+i).filter(allowed).sort((a,b)=>Math.abs(a-initialMin)-Math.abs(b-initialMin));
        let safe;for(const at of choices){const result=supplementTime(at,p.medications||[],prod,p,allowed);if(result.min!==null&&allowed(result.min)){safe=result;break;}}
        if(!safe)continue;initialMin=safe.min;
      }
      const timed=p._routine?{min:initialMin}:supplementTime(initialMin,p.medications||[],prod,p,at=>at<bed&&at>=wake&&(!window||!needsFood||inWindow(at,window)));
      if(timed.min===null)continue;
      const min=timed.min;
      const key = `${d.slot}:${min}`;
      (bySlot[key] ||= {slot:d.slot,min,list:[]}).list.push({ uid: sp.uid, prod, amount: d.amount });
    }
  }
  for (const {slot, min, list} of Object.values(bySlot)) {
    const split = Object.values(bySlot).filter(group => group.slot === slot).length > 1;
    events.push({ key: 'supp-' + slot + (split ? '-' + min : ''), min, type: 'supp', slot, slotInfo: SLOTS[slot], list });
  }
  events.push({ key: 'caffeine', min: bed - 8 * 60, type: 'note', note: 'caffeine' });
  events.push({ key: 'screens', min: bed - 60, type: 'note', note: 'screens' });
  events.push({ key: 'sleep', min: bed, type: 'sleep' });
  if(p._routine){
    for(const e of events)if(e.type==='wake'||e.type==='sleep')e.fixed=true;
    for(const a of p._activities)events.push({key:'activity-'+a.id,min:wakingMinute(a.start,p),type:'activity',activity:a,fixed:true});
    const snack=optionalSnack(p,meals,train);if(snack)events.push(snack);
    const water=events.find(e=>e.key==='water-am');if(water&&inBusy(water.min,p)){for(let at=wake+5;at<bed;at++)if(!inBusy(at,p)){water.min=at;break;}if(inBusy(water.min,p))events.splice(events.indexOf(water),1);}
    for(const e of events.filter(e=>e.type==='note'))if(inBusy(e.min,p)){const choices=Array.from({length:bed-wake},(_,i)=>wake+i).filter(at=>!inBusy(at,p)&&at<=e.min);if(choices.length)e.min=choices.at(-1);else events.splice(events.indexOf(e),1);}
    const gym=events.find(e=>e.key==='workout');if(gym)gym.fixed=!p.routine?.workoutAutomatic&&s.logs[iso]?.timeOverrides?.workout!==null;
  }
  events.sort((a, b) => a.min - b.min || order(a) - order(b));
  events.forEach((e) => (e.time = toHHMM(e.min)));
  const foodTotal = meals.reduce((a, m) => ({ k: a.k + m.total.k, p: a.p + m.total.p, c: a.c + m.total.c, f: a.f + m.total.f }), { k: 0, p: 0, c: 0, f: 0 });
  return { iso, train, t, sm, sess, meals, events, foodTotal, ...(p._routine?{warnings:routineWarnings(p,meals,train),impliedFast:impliedFast(p),routineProfile:p}:{}) };
}
const order = (e) => e.type === 'fasting' ? (e.eating ? 1.5 : 5.5) : ({ wake: 0, water: 1, supp: 3, meal: 2, workout: 4, note: 5, sleep: 6 }[e.type] ?? 9);

export function planRange(days, from) {
  const p = getState().profile;
  const start = from || p.startDate;
  return Array.from({ length: days }, (_, i) => planDay(addDays(start, i)));
}
