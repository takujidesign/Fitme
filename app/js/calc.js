import {getState} from './store.js';
import {healthAdjustment} from './health-math.js';
import { localizedNames } from './i18n/index.js';
import { hasCondition } from './conditions.js';
import { healthCalories } from './womens-health.js';
// Energy, macro, hydration and sleep calculations.
import { toMin, toHHMM } from './ui.js';

export const GOALS = {
  cut: { th: 'ลดไขมัน', en: 'Lose fat', kcal: -0.2, protein: 2.2, icon: 'flame' },
  recomp: { th: 'ลดไขมัน + เพิ่มกล้าม', en: 'Recomposition', kcal: -0.08, protein: 2.0, icon: 'swap' },
  maintain: { th: 'รักษาสุขภาพ', en: 'Stay healthy', kcal: 0, protein: 1.6, icon: 'drop' },
  bulk: { th: 'เพิ่มกล้ามเนื้อ', en: 'Build muscle', kcal: 0.1, protein: 1.8, icon: 'dumbbell' },
  strength: { th: 'เพิ่มความแข็งแรง', en: 'Get stronger', kcal: 0.05, protein: 1.8, icon: 'dumbbell' },
};

export const bmi = (p) => p.weight / ((p.height / 100) ** 2);
export function bmiClass(v) {
  // Asian cut-offs (WHO Western Pacific)
  if (v < 18.5) return { th: 'น้ำหนักน้อย', en: 'Underweight', c: 'amber' };
  if (v < 23) return { th: 'ปกติ', en: 'Normal', c: 'teal' };
  if (v < 25) return { th: 'น้ำหนักเกิน', en: 'Overweight', c: 'amber' };
  if (v < 30) return { th: 'อ้วนระดับ 1', en: 'Obese I', c: 'pink' };
  return { th: 'อ้วนระดับ 2', en: 'Obese II', c: 'pink' };
}

export function bmr(p) {
  if (p.bmrScan > 600) return { value: p.bmrScan, method: 'scan' };
  if (p.bodyFat > 3 && p.bodyFat < 60) {
    const lbm = p.weight * (1 - p.bodyFat / 100);
    return { value: 370 + 21.6 * lbm, method: 'katch' };
  }
  const v = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'female' ? -161 : 5);
  return { value: v, method: 'mifflin' };
}

export function activityFactor(p) {
  const d = p.trainDays.length;
  if (d <= 1) return 1.25;
  if (d <= 3) return 1.4;
  if (d <= 5) return 1.55;
  return 1.7;
}

// Daily targets; training days get a little more energy, mostly as carbs.
export function targets(p, isTraining = true, supplementMacros = { kcal: 0, protein: 0 }, iso) {
  const b = bmr(p).value;
  const tdee = b * activityFactor(p);
  const g = GOALS[p.goal] || GOALS.maintain;
  let kcal = tdee * (1 + g.kcal);
  kcal = Math.max(kcal, b * 1.05, p.sex === 'female' ? 1200 : 1500);
  kcal *= isTraining ? 1.05 : 0.93;
  if (p.calorieFactor) kcal = Math.max(kcal * p.calorieFactor, b * 1.05, p.sex === 'female' ? 1200 : 1500);
  kcal = healthCalories(p,kcal,tdee,iso);
  const adjustment=healthAdjustment({bmr:b,tdee,kcal},iso?getState().logs[iso]?.health:null);
  if(iso&&getState().logs[iso]?.health?.active_kcal!=null)kcal=adjustment.kcal;
  const refW = p.bodyFat ? p.weight * (1 - p.bodyFat / 100) / 0.85 : Math.min(p.weight, 25 * (p.height / 100) ** 2);
  const protein = hasCondition(p,'kidney') ? Math.min(Math.round(g.protein * refW), Math.floor(0.8*p.weight)) : Math.round(g.protein * refW);
  let fat = Math.round(Math.max(0.7 * p.weight, (kcal * 0.27) / 9));
  let carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);
  if (p.diet === 'lowcarb') { carbs = Math.min(carbs, 90); fat = Math.round((kcal - protein * 4 - carbs * 4) / 9); }
  if (carbs < 50) { carbs = 50; fat = Math.round((kcal - protein * 4 - carbs * 4) / 9); }
  const water = Math.round((p.weight * 35 + (isTraining ? 600 : 0) + (hasCondition(p,'gout') && !hasCondition(p,'kidney') && !hasCondition(p,'heart') ? 500 : 0)) / 50) * 50;
  return {
    bmr: Math.round(b), tdee: Math.round(tdee), kcal: Math.round(kcal), protein, fat, carbs, water,
    healthExtra:adjustment.extra, fromSupps: supplementMacros,
    food: { kcal: Math.round(kcal - supplementMacros.kcal), protein: Math.max(0, protein - supplementMacros.protein) },
  };
}

export function sleepNeed(age) {
  if (age < 14) return [9, 11];
  if (age < 18) return [8, 10];
  if (age < 65) return [7, 9];
  return [7, 8];
}
// Bedtimes that end on a full 90-min cycle at wake time (15 min to fall asleep).
export function bedtimes(wake) {
  const w = toMin(wake);
  return [6, 5, 4].map((n) => ({ cycles: n, hours: n * 1.5, time: toHHMM(w - n * 90 - 15) }));
}

export function weeksToGoal(p, kcalDeficitPerDay) {
  if (!p.goalWeight || !kcalDeficitPerDay) return null;
  const kg = p.weight - p.goalWeight;
  if (Math.sign(kg) !== Math.sign(-kcalDeficitPerDay)) return null; // losing weight needs a deficit, gaining needs a surplus
  return Math.ceil((Math.abs(kg) * 7700) / Math.abs(kcalDeficitPerDay) / 7);
}

Object.values(GOALS).forEach(localizedNames);
