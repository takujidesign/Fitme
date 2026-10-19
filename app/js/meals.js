import { getState } from './store.js';
import { translate } from './i18n/index.js';
import { hasCondition } from './conditions.js';
import { eatingWindow, windowMinute } from './fasting.js';
// Meal timing and portion solver.
import { allowedFoods, FOOD } from './foods.js';
import { toMin, toHHMM, rng, pick, L } from './ui.js';

const KIND = {
  breakfast: { th: 'มื้อเช้า', en: 'Breakfast', icon: 'sun' },
  lunch: { th: 'มื้อกลางวัน', en: 'Lunch', icon: 'food' },
  dinner: { th: 'มื้อเย็น', en: 'Dinner', icon: 'moon' },
  snack: { th: 'มื้อว่าง', en: 'Snack', icon: 'food' },
  pre: { th: 'ก่อนออกกำลังกาย', en: 'Pre-workout', icon: 'flame' },
  post: { th: 'หลังออกกำลังกาย', en: 'Post-workout', icon: 'dumbbell' },
};
export const mealKind = (k) => KIND[k];

const SHARES = {
  3: [['breakfast', 0.3], ['lunch', 0.37], ['dinner', 0.33]],
  4: [['breakfast', 0.25], ['lunch', 0.32], ['snack', 0.15], ['dinner', 0.28]],
  5: [['breakfast', 0.22], ['snack', 0.12], ['lunch', 0.28], ['snack', 0.13], ['dinner', 0.25]],
  6: [['breakfast', 0.2], ['snack', 0.1], ['lunch', 0.25], ['snack', 0.13], ['dinner', 0.22], ['snack', 0.1]],
};

export function mealSlots(p, isTraining) {
  const w = eatingWindow(p);
  if (w) {
    const cap = { '16:8': 3, '18:6': 3, '20:4': 2, omad: 1 }[p.fasting] || 6;
    const n = Math.max(1, Math.min(cap, p.mealsPerDay));
    const list = Array.from({length:n}, (_,i) => ({kind: n === 1 ? 'lunch' : i === 0 ? 'breakfast' : i === n-1 ? 'dinner' : 'lunch', share:1/n, min:Math.round(w.start + (n === 1 ? 0 : i*(w.length-30)/(n-1)))}));
    const end = windowMinute(toMin(p.workoutTime),w) + Number(p.sessionMin);
    if (isTraining && end < w.end) {
      const post = list.reduce((a,b) => Math.abs(a.min-end) < Math.abs(b.min-end) ? a : b);
      post.min = end; post.post = true; post.carbBoost = 1.25;
    }
    return list.sort((a,b)=>a.min-b.min).map((m,i)=>({...m,key:`m${i}`,time:toHHMM(m.min)}));
  }
  const n = Math.max(3, Math.min(6, p.mealsPerDay));
  const wake = toMin(p.wake);
  let bed = toMin(p.bed);
  if (bed <= wake) bed += 1440;
  const first = wake + 30, last = Math.max(first + 6 * 60, bed - 3 * 60);
  const list = SHARES[n].map(([kind, share]) => ({ kind, share }));
  // spread evenly between first and last meal
  list.forEach((m, i) => { m.min = Math.round((first + ((last - first) * i) / (n - 1)) / 15) * 15; });
  // nudge lunch toward noon
  const lunch = list.find((m) => m.kind === 'lunch');
  if (lunch && Math.abs(lunch.min - 720) < 120) lunch.min = 720;
  if (isTraining) {
    const w = toMin(p.workoutTime);
    const end = w + p.sessionMin;
    const post = list.filter((m) => m.min >= end).sort((a, b) => a.min - b.min)[0];
    if (post && post.min - end <= 150) { post.min = Math.max(post.min, end + 30); post.post = true; post.carbBoost = 1.25; }
    const pre = list.filter((m) => m.min <= w - 45 && m.min >= w - 180 && m !== post).sort((a, b) => b.min - a.min)[0];
    if (pre) pre.pre = true;
    if (pre && pre.kind === 'snack') pre.kind = 'pre';
    if (post && post.kind === 'snack') post.kind = 'post';
  }
  list.sort((a, b) => a.min - b.min);
  return list.map((m, i) => ({ ...m, key: `m${i}`, time: toHHMM(m.min) }));
}

const R5 = (g, step = 5) => Math.max(0, Math.round(g / step) * step);
const macro = (food, g) => ({ k: (food.k * g) / 100, p: (food.p * g) / 100, c: (food.c * g) / 100, f: (food.f * g) / 100 });

function choose(foods, pred, r) {
  const opts = foods.filter(pred);
  return opts.length ? pick(opts, r) : null;
}

// Build one meal that hits macro targets {p,c,f} as closely as possible.
export function buildMeal(p, slot, tgt, seed) {
  const r = rng(seed);
  const foods = allowedFoods(p).filter(f => (f.cat !== 'protein' && f.cat !== 'dairyp' || f.p > 0) && (f.cat !== 'carb' || f.c > 0));
  const kind = slot.kind;
  const isMain = kind === 'lunch' || kind === 'dinner';
  const isBreakfast = kind === 'breakfast';
  const mealOk = (f) => !f.meal || f.meal.includes(isMain ? kind : isBreakfast ? 'breakfast' : 'snack');

  let prot, carb, veg = null, fruit = null, fat = null;
  if (isMain) {
    prot = choose(foods, (f) => f.cat === 'protein' && !['egg_white', 'tuna'].includes(f.id), r) || choose(foods, (f) => f.cat === 'protein', r);
    carb = choose(foods, (f) => f.cat === 'carb' && mealOk(f), r);
    veg = choose(foods, (f) => f.cat === 'veg', r);
    fat = choose(foods, f => f.cat === 'fat' && (f.id === 'olive_oil' || f.id.startsWith('my-')) && f.f > 0, r);
  } else if (isBreakfast) {
    prot = choose(foods, (f) => (['egg', 'greek_yogurt', 'tofu', 'chicken_breast', 'soy_milk', 'milk_lowfat'].includes(f.id) || f.id.startsWith('my-') && ['protein','dairyp'].includes(f.cat)), r) || choose(foods, (f) => f.cat === 'protein' || f.cat === 'dairyp', r);
    carb = choose(foods, (f) => f.cat === 'carb' && mealOk(f), r);
    fruit = choose(foods, (f) => f.cat === 'fruit' && f.id !== 'avocado', r);
    fat = choose(foods, (f) => ['almonds', 'peanut_butter', 'avocado'].includes(f.id), r);
  } else {
    // snacks / pre / post: light and easy to digest
    prot = choose(foods, (f) => (['greek_yogurt', 'egg', 'milk_lowfat', 'soy_milk', 'tuna', 'chicken_breast', 'tofu'].includes(f.id) || f.id.startsWith('my-') && ['protein','dairyp'].includes(f.cat)), r) || choose(foods, (f) => f.cat === 'protein' || f.cat === 'dairyp', r);
    fruit = choose(foods, (f) => f.cat === 'fruit' && f.id !== 'avocado', r);
    carb = fruit && kind !== 'post' ? null : choose(foods, (f) => f.cat === 'carb' && (kind === 'post' ? ['sweet_potato', 'ww_bread', 'jasmine_rice', 'oats'] : ['sweet_potato', 'ww_bread', 'oats', 'corn']).includes(f.id), r);
    fat = kind === 'snack' ? choose(foods, (f) => ['almonds', 'peanut_butter'].includes(f.id), r) : null;
  }

  const items = [];
  const add = (food, g, role) => { if (food && g > 0) items.push({ id: food.id, g, role }); };
  const vegG = veg ? 150 : 0;
  const fruitG = fruit ? (fruit.unitG || 120) : 0;
  const sum = () => items.reduce((a, it) => { const m = macro(FOOD[it.id], it.g); a.k += m.k; a.p += m.p; a.c += m.c; a.f += m.f; return a; }, { k: 0, p: 0, c: 0, f: 0 });

  add(veg, vegG, 'veg');
  add(fruit, fruitG, 'fruit');
  let protG = 0, carbG = 0;
  for (let i = 0; i < 3; i++) {
    const base = { p: 0, c: 0 };
    [[veg, vegG], [fruit, fruitG]].forEach(([f, g]) => { if (f) { base.p += (f.p * g) / 100; base.c += (f.c * g) / 100; } });
    if (carb) carbG = Math.max(0, (tgt.c - base.c - (prot ? (prot.c * protG) / 100 : 0)) / carb.c * 100);
    if (prot) protG = Math.max(0, (tgt.p - base.p - (carb ? (carb.p * carbG) / 100 : 0)) / prot.p * 100);
  }
  if (prot) {
    const cap = prot.cat === 'dairyp' ? 360 : prot.id === 'egg' ? 200 : 260;
    protG = Math.min(protG, cap);
    protG = prot.step ? Math.max(prot.step, R5(protG, prot.step)) : R5(protG, prot.cat === 'dairyp' ? 10 : 5);
  }
  const CARB_CAP = { oats: 100, ww_bread: 120, potato: 350, sweet_potato: 350, corn: 300 };
  if (carb) carbG = Math.min(R5(carbG, 10), CARB_CAP[carb.id] ?? 300);
  add(prot, protG, 'protein');
  add(carb, carbG, 'carb');
  if (fat) {
    const need = tgt.f - sum().f;
    const g = fat.id === 'olive_oil' ? Math.min(15, R5(need)) : Math.min(fat.id === 'avocado' ? 100 : 30, R5(need / (fat.f / 100)));
    if (g >= 5) add(fat, g, 'fat');
  }
  const total = sum();
  return { items, total: { k: Math.round(total.k), p: Math.round(total.p), c: Math.round(total.c), f: Math.round(total.f) }, name: mealName(items, r) };
}

function mealName(items, r) {
  const main = items.find((i) => i.role === 'protein');
  const parts = [];
  if (main) {
    const f = FOOD[main.id];
    const cook = f.cook ? pick(f.cook.th, r) : '';
    const idx = f.cook ? f.cook.th.indexOf(cook) : -1;
    parts.push({ th: (f.th + (cook ? cook : '')).trim(), en: (f.cook && idx >= 0 && f.cook.en[idx] ? f.cook.en[idx] + ' ' : '') + f.en.toLowerCase() });
    for(const lang of ['zh','ja','vi'])parts.at(-1)[lang]=[f.cook&&idx>=0?translate(f.cook.th[idx],f.cook.en[idx],lang):'',translate(f,undefined,lang)].filter(Boolean).join(' ');
  }
  for (const it of items) if (it.role === 'carb' || it.role === 'veg' || it.role === 'fruit') parts.push({ th: FOOD[it.id].th, en: FOOD[it.id].en.toLowerCase(),...Object.fromEntries(['zh','ja','vi'].map(lang=>[lang,translate(FOOD[it.id],undefined,lang)])) });
  return { source:items.some(it=>FOOD[it.id]?.source==='off')?'off':undefined, ...Object.fromEntries(['zh','ja','vi'].map(lang=>[lang,parts.map(x=>x[lang]).join(' / ')])), th: parts.map((x) => x.th).join(' · '), en: parts.map((x) => x.en).join(' · ').replace(/^./, (c) => c.toUpperCase()) };
}

// Full day of meals for given daily targets (food part, i.e. after supplement macros).
export function dayMeals(p, dateISO, isTraining, t, seeds = {}) {
  const slots = mealSlots(p, isTraining);
  if(hasCondition(p,'diabetes'))slots.forEach(s=>{s.share=1/slots.length;s.carbBoost=1;});
  const totalShare = slots.reduce((a, s) => a + s.share * (s.carbBoost || 1), 0);
  // keep at least ~55% of protein from real food even when shakes cover most of the target
  const foodP = (hasCondition(p,'kidney')?Math.max(0,t.food.protein):Math.max(t.food.protein, Math.round(t.protein * 0.55))), foodK = t.food.kcal;
  const foodF = t.fat, foodC = Math.max(40, (foodK - foodP * 4 - foodF * 9) / 4);
  const outside = new Map();
  for(const slot of slots){if(!(p.eatingOut||[]).includes(slot.kind))continue;const options=allowedFoods(p).filter(f=>f.cat==='eatingout');if(options.length){const f=options[Math.abs([...dateISO+slot.key].reduce((n,c)=>n+c.charCodeAt(0),0))%options.length],g=f.unitG;outside.set(slot.key,{items:[{id:f.id,g,role:'protein'}],total:Object.fromEntries(['k','p','c','f'].map(k=>[k,Math.round(f[k]*g/100)])),name:{th:f.th,en:f.en},tip:f.tip,estimate:true});}}
  const used=key=>[...outside.values()].reduce((n,m)=>n+m.total[key],0),remainingShare=slots.filter(s=>!outside.has(s.key)).reduce((n,s)=>n+s.share,0)||1;
  const meals = slots.map((s) => {
    const replacement=getState().mealOverrides?.[dateISO]?.[s.key];
    if(replacement&&replacement.items.every(it=>allowedFoods(p).some(f=>f.id===it.id)))return {...s,...replacement};
    if(outside.has(s.key))return {...s,...outside.get(s.key)};
    const cs = (s.share * (s.carbBoost || 1)) / totalShare;
    const tgt = outside.size ? {p:Math.max(0,foodP-used('p'))*s.share/remainingShare,c:Math.max(0,foodC-used('c'))*s.share/remainingShare,f:Math.max(0,foodF-used('f'))*s.share/remainingShare} : { p: foodP * s.share, c: foodC * cs, f: foodF * s.share * (s.post ? 0.6 : 1) };
    const seed = `${dateISO}-${s.key}-${seeds[`${dateISO}|${s.key}`] || 0}`;
    return { ...s, tgt, ...buildMeal(p, s, tgt, seed) };
  });
  if(hasCondition(p,'kidney')){const total=meals.reduce((sum,m)=>sum+m.items.reduce((n,it)=>n+FOOD[it.id].p*it.g/100,0),0);const factor=Math.min(1,Math.max(0,t.food.protein)/Math.max(total,1));if(factor<1)for(const meal of meals){meal.items=meal.items.map(it=>({...it,g:Math.floor(it.g*factor)}));meal.total=Object.fromEntries(['k','p','c','f'].map(k=>[k,meal.items.reduce((n,it)=>n+FOOD[it.id][k]*it.g/100,0)]));}}
  return meals;
}

export function unitText(food, g, lang) {
  const ug = food.unitG || food.unit.g;
  const n = g / ug;
  const rounded = n >= 3 ? Math.round(n) : Math.round(n * 2) / 2;
  if (!rounded) return '';
  return `≈ ${rounded} ${L(food.unit)}`;
}
