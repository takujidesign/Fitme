// Supplement catalog + dosing engine. Catalog entries mirror the dosing charts printed on each label;
// custom and AI-read supplements use the same schema, so one engine schedules everything.
import { diffDays, addDays } from './store.js';

export const SLOTS = {
  morning: { th: 'ตื่นนอน/เช้า', en: 'Morning', icon: 'sun', order: 1 },
  breakfast: { th: 'หลังอาหารเช้า', en: 'After breakfast', icon: 'food', order: 2 },
  lunch: { th: 'มื้อกลางวัน', en: 'With lunch', icon: 'food', order: 3 },
  afternoon: { th: 'บ่าย', en: 'Afternoon', icon: 'sun', order: 4 },
  pre: { th: 'ก่อนออกกำลังกาย', en: 'Pre-workout', icon: 'flame', order: 5 },
  post: { th: 'หลังออกกำลังกาย', en: 'Post-workout', icon: 'dumbbell', order: 6 },
  dinner: { th: 'หลังอาหารเย็น', en: 'After dinner', icon: 'moon', order: 7 },
  night: { th: 'ก่อนนอน', en: 'Before bed', icon: 'moon', order: 8 },
};

const SCOOP = { th: 'ช้อนตวง', en: 'scoop' };
const CAP = { th: 'แคปซูล', en: 'capsule' };
const TAB = { th: 'เม็ด', en: 'tablet' };

export const CATALOG = [
  {
    id: 'vx_creatine', brand: 'VX Vita Xtrong', name: { th: 'VX Creatine 5000 (ครีเอทีน)', en: 'VX 100% Creatine 5000' },
    category: 'creatine', unit: SCOOP, servingG: 5, perContainer: 100, nutrition: { k: 0, p: 0, c: 0, f: 0 }, color: '#C8F31D',
    loadingDays: 7,
    note: { th: 'ผสมน้ำเย็น เวย์ หรือเครื่องดื่ม · ดื่มน้ำให้เพียงพอ', en: 'Mix with cold water, shake or any drink · stay well hydrated' },
    rules: [
      { wMax: 90, phase: 'loading', day: 'train', doses: { morning: 1, pre: 1, post: 1, night: 1 } },
      { wMax: 90, phase: 'loading', day: 'rest', doses: { morning: 1, lunch: 1, dinner: 1, night: 1 } },
      { wMax: 90, phase: 'maint', day: 'train', doses: { pre: 1, post: 1 } },
      { wMax: 90, phase: 'maint', day: 'rest', doses: { morning: 1, night: 1 } },
      { wMin: 90, phase: 'loading', day: 'train', doses: { morning: 1.5, pre: 1.5, post: 1.5, night: 1.5 } },
      { wMin: 90, phase: 'loading', day: 'rest', doses: { morning: 1.5, lunch: 1.5, dinner: 1.5, night: 1.5 } },
      { wMin: 90, phase: 'maint', day: 'train', doses: { pre: 1.5, post: 1.5 } },
      { wMin: 90, phase: 'maint', day: 'rest', doses: { morning: 1.5, night: 1.5 } },
    ],
  },
  {
    id: 'vx_carnitine', brand: 'VX Vita Xtrong', name: { th: 'VX L-Carnitine X500 (แอล-คาร์นิทีน)', en: 'VX L-Carnitine X500' },
    category: 'carnitine', unit: CAP, perContainer: 100, nutrition: { k: 0, p: 0, c: 0, f: 0 }, color: '#E6FF6A',
    note: { th: 'ปรึกษาแพทย์หากตั้งครรภ์ มีโรคไทรอยด์ หรือเคยชัก', en: 'Consult a doctor if pregnant, with thyroid disease or a history of seizures' },
    rules: [
      { wMax: 77, day: 'train', doses: { morning: 1, pre: 2, night: 1 } },
      { wMax: 77, day: 'rest', doses: { morning: 1, afternoon: 1, night: 1 } },
      { wMin: 77, day: 'train', doses: { morning: 2, pre: 2, night: 2 } },
      { wMin: 77, day: 'rest', doses: { morning: 2, afternoon: 2, night: 2 } },
    ],
  },
  {
    id: 'vx_isopro', brand: 'VX Vita Xtrong', name: { th: 'VX ISO-PRO เวย์ไอโซเลท (ช็อกโกแลต)', en: 'VX ISO-PRO Whey Isolate' },
    category: 'protein', unit: SCOOP, servingG: 38.57, perContainer: 59, nutrition: { k: 130, p: 27, c: 2, f: 0.5 }, color: '#7FE3FF',
    note: { th: '1 ช้อนตวง + น้ำเย็น 200 มล. เขย่า 10 ครั้ง · มีนมและถั่วเหลือง', en: '1 scoop + 200 ml cold water, shake · contains milk and soy' },
    rules: [
      { wMax: 70, day: 'train', doses: { morning: 1, post: 1.5, night: 0.5 } },
      { wMax: 70, day: 'rest', doses: { morning: 1, night: 0.5 } },
      { wMin: 70, day: 'train', doses: { morning: 1.5, post: 1.5, night: 1 } },
      { wMin: 70, day: 'rest', doses: { morning: 1.5, night: 1 } },
    ],
  },
  {
    id: 'vistra_bcomplex', brand: 'VISTRA', name: { th: 'Vistra B-Complex Ultra Plus', en: 'Vistra B-Complex Ultra Plus' },
    category: 'bcomplex', unit: TAB, perContainer: 30, nutrition: { k: 0, p: 0, c: 0, f: 0 }, color: '#FFB547',
    note: { th: 'ทานหลังอาหารเช้า วิตามินบีให้พลังงาน ไม่ควรทานก่อนนอน', en: 'Take after breakfast; B vitamins are energising, avoid at bedtime' },
    rules: [{ doses: { breakfast: 1 } }],
  },
  {
    id: 'vistra_multi', brand: 'VISTRA', name: { th: 'Vistra Vital-Pro วิตามินรวม + กรดอะมิโน', en: 'Vistra Vital-Pro Multivitamin + Amino' },
    category: 'multi', unit: TAB, perContainer: 30, nutrition: { k: 0, p: 0, c: 0, f: 0 }, color: '#8BB8FF',
    note: { th: 'ทานหลังอาหาร (มีวิตามินที่ละลายในไขมัน)', en: 'Take after a meal (contains fat-soluble vitamins)' },
    rules: [{ doses: { breakfast: 1 } }],
  },
  {
    id: 'amarit_collagen', brand: 'AMARIT', name: { th: 'Amarit Collagen Peptide 500 มก.', en: 'Amarit Fish Collagen Peptide 500 mg' },
    category: 'collagen', unit: CAP, perContainer: 30, nutrition: { k: 0, p: 0.5, c: 0, f: 0 }, color: '#FF7DB0',
    note: { th: 'ครั้งละ 1 แคปซูล วันละ 1 ครั้ง หลังอาหาร · มีคอลลาเจนจากปลาทะเล', en: '1 capsule daily after a meal · from marine fish' },
    rules: [{ doses: { dinner: 1 } }],
  },
  {
    id: 'vistra_astaxanthin', brand: 'VISTRA', name: { th: 'Vistra Astaxanthin 6 มก. + วิตามินอี', en: 'Vistra Astaxanthin 6 mg + Vitamin E' },
    category: 'antioxidant', unit: CAP, perContainer: 14, nutrition: { k: 0, p: 0, c: 0, f: 0 }, color: '#FF6B5C',
    note: { th: 'วันละ 1 แคปซูล พร้อมมื้ออาหาร (ดูดซึมดีกับไขมัน) · มีถั่วเหลือง', en: '1 capsule daily with food (absorbs best with fat) · contains soy' },
    rules: [{ doses: { lunch: 1 } }],
  },
  {
    id: 'inzent_multi', brand: 'INZENT', name: { th: 'Inzent Multivitamins Plus iCAP', en: 'Inzent Multivitamins Plus iCAP' },
    category: 'multi', unit: CAP, perContainer: 30, nutrition: { k: 0, p: 0, c: 0, f: 0 }, color: '#C77DFF',
    note: { th: 'วันละ 1 แคปซูล หลังอาหาร', en: '1 capsule daily after a meal' },
    rules: [{ doses: { breakfast: 1 } }],
  },
];
export const CAT = Object.fromEntries(CATALOG.map((c) => [c.id, c]));

export const CATEGORY = {
  creatine: { th: 'ครีเอทีน', en: 'Creatine' }, protein: { th: 'โปรตีน', en: 'Protein' }, carnitine: { th: 'แอล-คาร์นิทีน', en: 'L-carnitine' },
  multi: { th: 'วิตามินรวม', en: 'Multivitamin' }, bcomplex: { th: 'วิตามินบีรวม', en: 'B-complex' }, collagen: { th: 'คอลลาเจน', en: 'Collagen' },
  antioxidant: { th: 'สารต้านอนุมูลอิสระ', en: 'Antioxidant' }, other: { th: 'อื่นๆ', en: 'Other' },
};

export const productOf = (s) => s.custom || CAT[s.productId];

export function phaseOf(prod, s, iso) {
  if (!prod.loadingDays) return 'maint';
  const d = diffDays(s.startDate, iso);
  return d >= 0 && d < prod.loadingDays ? 'loading' : 'maint';
}

function ruleFor(prod, weight, dayType, phase) {
  const match = (r) => (r.wMin == null || weight > r.wMin) && (r.wMax == null || weight <= r.wMax)
    && (!r.day || r.day === 'any' || r.day === dayType) && (!r.phase || r.phase === 'any' || r.phase === phase);
  return prod.rules.find(match) || prod.rules.find((r) => (!r.day || r.day === 'any') && (!r.phase || r.phase === 'any' || r.phase === phase)) || prod.rules[0];
}

// Doses for one supplement on one date → [{slot, amount}]
export function dosesFor(s, profile, iso, isTraining, allSupps = []) {
  const prod = productOf(s);
  if (!prod || s.paused) return [];
  if (diffDays(s.startDate, iso) < 0) return [];
  // two multivitamins: alternate days instead of doubling fat-soluble vitamins
  const sameCat = allSupps.filter((x) => !x.paused && productOf(x)?.category === prod.category && prod.category === 'multi');
  if (sameCat.length > 1) {
    const idx = sameCat.findIndex((x) => x.uid === s.uid);
    const dayNum = Math.floor(new Date(iso + 'T00:00:00').getTime() / 86400000);
    if (dayNum % sameCat.length !== idx) return [];
  }
  const phase = phaseOf(prod, s, iso);
  const rule = ruleFor(prod, profile.weight, isTraining ? 'train' : 'rest', phase);
  if (!rule) return [];
  return Object.entries(rule.doses)
    .map(([slot, amount]) => ({ slot: !isTraining && (slot === 'pre' || slot === 'post') ? 'afternoon' : slot, amount }))
    .filter((d) => d.amount > 0);
}

export function suppMacros(supps, profile, iso, isTraining) {
  const m = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const s of supps) {
    const prod = productOf(s);
    if (!prod?.nutrition) continue;
    for (const d of dosesFor(s, profile, iso, isTraining, supps)) {
      m.kcal += (prod.nutrition.k || 0) * d.amount;
      m.protein += (prod.nutrition.p || 0) * d.amount;
      m.carbs += (prod.nutrition.c || 0) * d.amount;
      m.fat += (prod.nutrition.f || 0) * d.amount;
    }
  }
  return { kcal: Math.round(m.kcal), protein: Math.round(m.protein), carbs: Math.round(m.carbs), fat: Math.round(m.fat) };
}

// Estimated servings used so far and the run-out date.
export function supplyInfo(s, profile, todayIso, isTrainingFn, all = []) {
  const prod = productOf(s);
  if (!prod?.perContainer) return null;
  let used = 0, day = s.startDate, guard = 0;
  const remainingAt = () => (s.perContainer ?? prod.perContainer) - used;
  while (day < todayIso && guard++ < 1000) {
    used += dosesFor(s, profile, day, isTrainingFn(day), all).reduce((a, d) => a + d.amount, 0);
    day = addDays(day, 1);
  }
  const left = Math.max(0, remainingAt());
  let d2 = todayIso, left2 = left; guard = 0;
  while (left2 > 0 && guard++ < 1000) {
    left2 -= dosesFor(s, profile, d2, isTrainingFn(d2), all).reduce((a, d) => a + d.amount, 0) || 0;
    if (left2 > 0) d2 = addDays(d2, 1);
    if (guard > 400) break;
  }
  return { left: Math.round(left * 10) / 10, runsOut: guard > 400 ? null : d2, total: prod.perContainer };
}

export function warnings(supps, profile) {
  const out = [];
  const active = supps.filter((s) => !s.paused).map(productOf).filter(Boolean);
  const count = (c) => active.filter((p) => p.category === c).length;
  if (count('multi') > 1) out.push({ th: 'มีวิตามินรวมมากกว่า 1 ชนิด ระบบจะสลับวันทาน เพื่อไม่ให้ได้รับวิตามิน A/D/E เกิน', en: 'More than one multivitamin: the plan alternates days so you don\'t double up on vitamins A/D/E' });
  if (count('multi') && count('bcomplex')) out.push({ th: 'วิตามินรวมมีวิตามินบีอยู่แล้ว การทาน B-Complex เพิ่มปลอดภัย (ละลายในน้ำ) แต่อาจไม่จำเป็น', en: 'Your multivitamin already contains B vitamins; extra B-complex is water-soluble but may be unnecessary' });
  if (count('creatine')) out.push({ th: 'ครีเอทีน: ดื่มน้ำเพิ่มวันละ 500-750 มล. ระบบเพิ่มเป้าหมายน้ำให้แล้ว', en: 'Creatine: drink an extra 500-750 ml of water per day. Your water goal already includes it' });
  if (count('carnitine') && profile.sex === 'female') out.push({ th: 'แอล-คาร์นิทีน: ไม่ควรใช้ระหว่างตั้งครรภ์หรือให้นมบุตร', en: 'L-carnitine: avoid during pregnancy or breastfeeding' });
  return out;
}

for(const p of CATALOG) p.notPregnancy = /pregnan|breastfeed|ตั้งครรภ์|ให้นม/.test(JSON.stringify(p.note));
