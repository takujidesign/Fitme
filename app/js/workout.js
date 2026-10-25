import {dailyHealthCheckin} from './health-math.js';
import { equipmentFor, styleGroups, styleAllows } from './training.js';
import { medicalSession } from './conditions.js';
import { readinessSession } from './readiness.js';
import { healthAllowed, healthSession } from './womens-health.js';
import { programSession, PROGRAMS } from './programs.js';
import { blockProfile } from './replan.js';
// Builds a periodised training plan for any number of days from the profile.
import { EXERCISES, EX } from './exercises.js';
import { addDays, diffDays, getState } from './store.js';
import { rng } from './ui.js';

const SPLITS = {
  cardio: { th: 'เดิน / วิ่ง', en: 'Walk / run', groups: ['cardio','cardio','cardio','cardio','cardio','cardio'] },
  mobility: { th: 'โยคะ / ยืดเหยียด', en: 'Mobility / yoga', groups: ['mobility','mobility','mobility','mobility','mobility','mobility'] },
  full: { th: 'ทั้งตัว', en: 'Full body', groups: ['legs', 'push', 'pull', 'legs', 'push', 'core'] },
  fullB: { th: 'ทั้งตัว B', en: 'Full body B', groups: ['legs', 'pull', 'push', 'pull', 'legs', 'core'] },
  upper: { th: 'ร่างกายส่วนบน', en: 'Upper body', groups: ['push', 'pull', 'push', 'pull', 'push', 'core'] },
  lower: { th: 'ร่างกายส่วนล่าง', en: 'Lower body', groups: ['legs', 'legs', 'legs', 'core', 'legs', 'core'] },
  push: { th: 'Push (อก/ไหล่/หลังแขน)', en: 'Push', groups: ['push', 'push', 'push', 'push', 'core', 'push'] },
  pull: { th: 'Pull (หลัง/หน้าแขน)', en: 'Pull', groups: ['pull', 'pull', 'pull', 'core', 'pull', 'pull'] },
  legs: { th: 'Legs (ขา/ก้น)', en: 'Legs', groups: ['legs', 'legs', 'legs', 'legs', 'core', 'legs'] },
  hiit: { th: 'คาร์ดิโอ HIIT', en: 'HIIT cardio', groups: ['cardio', 'core', 'cardio', 'legs', 'cardio', 'core'] },
};
export const splitName = (k) => SPLITS[k] || {th:'โปรแกรม / ฟื้นตัว',en:'Program / recovery'};

function rotation(n) {
  if (n <= 1) return ['full'];
  if (n === 2) return ['full', 'fullB'];
  if (n === 3) return ['full', 'fullB', 'full'];
  if (n === 4) return ['upper', 'lower', 'upper', 'lower'];
  if (n === 5) return ['push', 'pull', 'legs', 'upper', 'lower'];
  return ['push', 'pull', 'legs', 'push', 'pull', 'legs', 'hiit'].slice(0, n);
}

const SCHEME = {
  cut: { sets: 3, reps: '12-15', rest: 45, time: 40, finisher: 8 },
  recomp: { sets: 3, reps: '10-12', rest: 60, time: 40, finisher: 5 },
  maintain: { sets: 3, reps: '10-15', rest: 60, time: 35, finisher: 5 },
  bulk: { sets: 4, reps: '8-12', rest: 90, time: 45, finisher: 0 },
  strength: { sets: 5, reps: '4-6', rest: 150, time: 45, finisher: 0 },
};

export function allowed(p, includeLibrary = false, allPhases = false) {
  const eq = equipmentFor(p);
  const maxLvl = p.level === 'beginner' ? 1 : p.level === 'intermediate' ? 2 : 3;
  return (includeLibrary ? Object.values(EX) : [...EXERCISES, ...Object.values(EX).filter(e=>e.source && p.trainingConfigured && p.preferEx?.includes(e.id))]).filter((e) => healthAllowed(p,e.id) && (allPhases || styleAllows(p,e)) && ![e.id,...(e.aliases||[])].some(id=>p.avoidEx?.includes(id)) && eq.includes(e.equip) && e.level <= maxLvl + (e.group === 'core' ? 1 : 0));
}

// Week-based progression: weeks 1-3 build, week 4 deloads.
function weekMod(week) {
  const w = ((week - 1) % 4) + 1;
  return { w, deload: w === 4, extraReps: w === 4 ? 0 : w - 1 };
}

export function isTrainingDay(p, iso) {
  if(p.trainingHistory?.length){const prior=p.trainingHistory.find(h=>iso<h.from);if(prior)p={...prior.profile,trainingHistory:undefined};}
  if(PROGRAMS[p.program?.id]){const special=programSession(p,iso);if(special)return special.type==='train';}
  const override = getState().dayOverrides?.[iso];
  if (override) return override === 'train';
  return p.trainDays.includes(new Date(iso + 'T00:00:00').getDay());
}

export function sessionFor(p, iso) {
  if(p.trainingHistory?.length){const prior=p.trainingHistory.find(h=>iso<h.from);if(prior)p={...prior.profile,trainingHistory:undefined};}
  const result = rawSession(p,iso) || (getState().logs[iso]?.checkin?.override==='recovery'?recoverySession(p,iso,0):null);
  if(!result)return result;
  const extras=(getState().extraExercises?.[iso]||[]).filter(i=>allowed(p,true).some(e=>e.id===i.id));
  const combined={...result,items:[...result.items,...safeItems(p,iso,extras,result.items.length)]};
  const ready=readinessSession(combined,dailyHealthCheckin(getState().logs,iso));
  const adjusted=medicalSession(p,healthSession(p,ready,iso));
  const items=adjusted.items.filter(i=>!p.avoidEx?.includes(i.id)&&healthAllowed(p,i.id));
  return {...adjusted,items,minutes:estimateMin(items)};
}
function rawSession(p, iso) {
  if (p === getState().profile) p = blockProfile(getState(), iso);
  const day = diffDays(p.startDate, iso);
  if (day < 0 || getState().dayOverrides?.[iso] === 'off') return null;
  const special=programSession(p,iso);if(special)return special;
  if (!isTrainingDay(p, iso)) return recoverySession(p, iso, day);
  // count training days since start to rotate the split
  let idx = 0;
  for (let d = 0; d < day; d++) if (isTrainingDay(p, addDays(p.startDate, d))) idx++;
  const rot = rotation(p.trainDays.length);
  const styled=styleGroups(p),strength=styled?.includes('push');
  const splitKey = styled&&!strength ? (p.styles.includes('hiit')?'hiit':p.styles.includes('cardio')?'cardio':'mobility') : rot[idx % rot.length];
  const week = Math.floor(diffDays(p.blockStart || p.startDate, iso) / 7) + 1;
  const { deload, extraReps } = weekMod(week);
  const sc = SCHEME[p.goal] || SCHEME.maintain;
  const lvlSets = p.level === 'beginner' ? -1 : p.level === 'advanced' ? 1 : 0;
  const pool = allowed(p);
  const r = rng(`${splitKey}-${Math.floor((week - 1) / 2)}-${p.location}${p.planSeed ? "-" + p.planSeed : ""}`); // exercise choice changes every 2 weeks
  const mainCount = p.trainingConfigured ? Math.max(2, Math.min(6, Math.round((p.sessionMin - 5) / 8))) : Math.max(3, Math.min(6, Math.round((p.sessionMin - 15) / 8)));
  const used = new Set();
  const main = [];
  const focus = [...new Set(Array.isArray(p.focus) ? p.focus : [])].filter((g) => ['legs', 'push', 'pull', 'core', 'cardio', 'mobility'].includes(g));
  const baseGroups = SPLITS[splitKey].groups.slice(0, mainCount);
  if(styled){for(let i=0;i<baseGroups.length;i++)if(!styled.includes(baseGroups[i]))baseGroups[i]=styled[i%styled.length];
    const supplemental=styled.filter(g=>['cardio','mobility'].includes(g));
    supplemental.forEach((g,i)=>baseGroups[baseGroups.length-1-i]=g);
  }
  const groups = [...baseGroups, ...focus];
  for (const [index, g] of groups.entries()) {
    let opts = pool.filter((e) => e.group === g && !used.has(e.id));
    if (!opts.length && index >= mainCount) opts = pool.filter((e) => e.group === g);
    if (!opts.length && index < mainCount) opts = pool.filter((e) => ['legs', 'push', 'pull', 'core'].includes(e.group) && !used.has(e.id));
    if (!opts.length) continue;
    // prefer heavier equipment if available
    opts.sort((a, b) => rank(b, p) - rank(a, p) + (r() - 0.5) * 1.5);
    const ex = opts[0];
    used.add(ex.id);
    const sets = Math.max(1, sc.sets + lvlSets - (deload ? 1 : 0) + (p.volumeAdjustment || 0));
    main.push(ex.type === 'time'
      ? { id: ex.id, sets, sec: Math.min(60, 25 + (p.level === 'beginner' ? 0 : 10) + extraReps * 5), rest: Math.min(sc.rest, 60) }
      : { id: ex.id, sets, reps: bumpReps(sc.reps, extraReps), rest: sc.rest });
  }
  const warm = [{ id: splitKey==='mobility'?'cat_cow':'jumping_jack', sets: 1, sec: 60, rest: 15, phase: 'warm' }, { id: splitKey==='mobility'?'breathing':pool.some((e) => e.id === 'high_knees') ? 'high_knees' : 'jog', sets: 1, sec: 45, rest: 20, phase: 'warm' }];
  const finisher = sc.finisher && !deload && splitKey!=='mobility' ? [{ id: pick2(pool, r, ['mountain_climber', 'jumping_jack', 'squat_jump', 'jump_rope']), sets: 3, sec: 30, rest: 20, phase: 'finisher' }] : [];
  const cool = [{ id: 'forward_fold', sets: 1, sec: 40, rest: 5, phase: 'cool' }, { id: 'child_pose', sets: 1, sec: 45, rest: 0, phase: 'cool' }];
  const items = safeItems(p, iso, [...warm, ...main, ...finisher, ...cool]);
  return { type: 'train', split: splitKey, week, deload, items, minutes: estimateMin(items) };
}

function recoverySession(p, iso, day) {
  const week = Math.floor(diffDays(p.blockStart || p.startDate, iso) / 7) + 1;
  const baseItems = [
    { id: 'walk', sets: 1, sec: 20 * 60, rest: 0, phase: 'main' },
    { id: 'quad_stretch', sets: 2, sec: 30, rest: 5, phase: 'cool' },
    { id: 'forward_fold', sets: 1, sec: 45, rest: 5, phase: 'cool' },
    { id: 'child_pose', sets: 1, sec: 60, rest: 0, phase: 'cool' },
  ];
  const items = safeItems(p, iso, baseItems);
  return { type: 'rest', split: 'recovery', week, items, minutes: estimateMin(items) };
}

const rank = (e, p) => (p.preferEx?.includes(e.id) ? 10 : 0) + (p.location === 'gym' ? { gym: 2, db: 1, none: 0 } : { gym: 0, db: 1, none: 0 })[e.equip];
const pick2 = (pool, r, ids) => { const ok = ids.filter((id) => pool.some((e) => e.id === id)); return ok[Math.floor(r() * ok.length)] || 'jumping_jack'; };
function bumpReps(range, n) {
  const [a, b] = range.split('-').map(Number);
  return `${a + n}-${b + n}`;
}
export function estimateMin(items) {
  if (!items.length) return 0;
  let s = 0;
  for (const it of items) {
    const work = (it.sec ?? repsMid(it.reps) * 4) + 10; // ~4 s per rep + set-up
    s += it.sets * (work + (it.rest || 0));
  }
  return Math.round(s / 60) + 1;
}
export const repsMid = (r) => { if (!r) return 10; const [a, b] = String(r).split('-').map(Number); return Math.round((a + (b || a)) / 2); };

export function sessionKcal(sess, weight) {
  let kcal = 0;
  for (const it of sess.items) {
    const ex = EX[it.id];
    const sec = it.sets * (it.sec ?? repsMid(it.reps) * 4);
    kcal += (ex.met * 3.5 * weight / 200) * (sec / 60);
  }
  return Math.round(kcal);
}

export function weekPlan(p, startIso) {
  return Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(startIso, i);
    return { iso, sess: sessionFor(p, iso) };
  });
}

// Apply exclusions to every phase and ignore stale/unsafe saved swaps.
function safeItems(p, iso, items, offset = 0) {
  // Training style selects main work, not basic warm-up or recovery movements.
  const pool = allowed(p, true, true), defaults = allowed(p, false, true);
  return items.flatMap((it, index) => {
    const original = EX[it.id];
    const base = pool.find(e => e.id === it.id) || defaults.filter(e => e.group === original?.group).sort((a,b) => rank(b,p)-rank(a,p))[0] || [...defaults].sort((a,b) => rank(b,p)-rank(a,p))[0];
    const swap = pool.find(e => e.id === getState().exSwaps?.[iso]?.[index+offset] && e.group === base?.group);
    const ex = swap || base;
    if (!ex) return [];
    if (ex.id === it.id) return [it];
    const { reps, sec, ...rest } = it;
    return [{ ...rest, id: ex.id, ...(ex.type === 'time' ? { sec: sec || 40 } : { reps: reps || '10-12' }) }];
  });
}
