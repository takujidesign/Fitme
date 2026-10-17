import { eatingWindow, inWindow, windowMinute } from './fasting.js';
// Combines workout, meals, supplements, hydration and sleep into one daily timeline.
import { getState, addDays, diffDays } from './store.js';
import { targets } from './calc.js';
import { sessionFor, isTrainingDay, sessionKcal } from './workout.js';
import { dayMeals } from './meals.js';
import { dosesFor, suppMacros, productOf, SLOTS } from './supplements.js';
import { toMin, toHHMM } from './ui.js';

export function planDay(iso) {
  const s = getState();
  const p = s.profile;
  const train = isTrainingDay(p, iso) && diffDays(p.startDate, iso) >= 0;
  const supps = s.supplements;
  const sm = suppMacros(supps, p, iso, train);
  const t = targets(p, train, sm);
  if (supps.some((x) => !x.paused && productOf(x)?.category === 'creatine')) t.water += 500;
  const sess = sessionFor(p, iso);
  const meals = dayMeals(p, iso, train, t, s.mealSeed);
  const wake = toMin(p.wake);
  let bed = toMin(p.bed); if (bed <= wake) bed += 1440;
  const w = toMin(p.workoutTime);
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
  const events = [];
  const window = eatingWindow(p);
  if (window) {
    events.push({key:'eat-start',min:window.start,type:'fasting',eating:true});
    events.push({key:'fast-start',min:window.end,type:'fasting',eating:false});
  }
  events.push({ key: 'wake', min: wake, type: 'wake' });
  events.push({ key: 'water-am', min: wake + 5, type: 'water', ml: 500 });
  meals.forEach((m) => events.push({ key: 'meal-' + m.key, min: m.min, type: 'meal', meal: m }));
  if (sess) events.push({ key: 'workout', min: train ? w : Math.max(wake + 60, toMin('17:30')), type: 'workout', sess, kcal: sessionKcal(sess, p.weight) });
  // group supplement doses by slot
  const bySlot = {};
  for (const sp of supps) {
    for (const d of dosesFor(sp, p, iso, train, supps)) {
      const prod = productOf(sp);
      const needsFood = ['breakfast','lunch','dinner'].includes(d.slot) || prod?.nutrition?.k > 0 || prod?.nutrition?.p > 0;
      const time = slotTime[d.slot];
      const moved = window && needsFood;
      const min = moved ? (inWindow(time,window) ? windowMinute(time,window) : meals[0].min) : time;
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
  events.sort((a, b) => a.min - b.min || order(a) - order(b));
  events.forEach((e) => (e.time = toHHMM(e.min)));
  const foodTotal = meals.reduce((a, m) => ({ k: a.k + m.total.k, p: a.p + m.total.p, c: a.c + m.total.c, f: a.f + m.total.f }), { k: 0, p: 0, c: 0, f: 0 });
  return { iso, train, t, sm, sess, meals, events, foodTotal };
}
const order = (e) => ({ wake: 0, water: 1, supp: 3, meal: 2, workout: 4, note: 5, sleep: 6 }[e.type] ?? 9);

export function planRange(days, from) {
  const p = getState().profile;
  const start = from || p.startDate;
  return Array.from({ length: days }, (_, i) => planDay(addDays(start, i)));
}
