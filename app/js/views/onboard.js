import { trainingControls, toggleStyle, toggleEquipment } from '../training-controls.js';
import { slot } from '../slots.js';
import { enabledLanguages, LANGUAGES } from '../i18n/index.js';
import { consentFields, consentCurrent, acceptConsent } from '../legal.js';
import { track } from '../telemetry.js';
import { fastingFields } from '../fasting.js';
import { actions, views, go, rerender } from '../core.js';
import { getState, setState, todayISO } from '../store.js';
import { L, esc, icon, WEEKDAYS, fmt } from '../ui.js';
import { GOALS, targets, bmi, bmiClass, bmr } from '../calc.js';
import { DIETS, EXCLUDES } from '../foods.js';

let step = 0;
const STEPS = 6;

const chip = (act, val, on, label) => `<button class="chip ${on ? 'on' : ''}" data-act="${act}" data-v="${esc(val)}">${label}</button>`;
const field = (key, label, val, { type = 'number', step: st = 1, unit = '', ph = '' } = {}) =>
  `<label class="field"><span>${label}</span><div class="input-wrap"><input type="${type}" inputmode="${type === 'number' ? 'decimal' : 'text'}" step="${st}" data-bind="${key}" value="${val ?? ''}" placeholder="${ph}">${unit ? `<em>${unit}</em>` : ''}</div></label>`;

views.onboarding = ({ query }) => {
  const s = getState(), p = s.profile;
  const edit = query.get('edit') === '1';
  const steps = [
    () => `<div class="ob-hero"><div class="logo-big">${icon('flame', 40)}</div>
      <h1>Fixmee</h1><p>${L('แผนออกกำลังกาย อาหาร อาหารเสริม และการพักผ่อน ที่คำนวณเฉพาะคุณ', 'Training, nutrition, supplements and recovery — calculated for you')}</p></div>
      <div class="seg">${enabledLanguages().map(([lang,name])=>chip('ob-lang',lang,s.lang===lang,name)).join('')}</div>
      ${field('name', L('ชื่อเล่น', 'Your name'), esc(p.name), { type: 'text', ph: L('เช่น ต้น', 'e.g. Alex') })}`,
    () => `<h2>${L('ข้อมูลร่างกาย', 'Your body')}</h2>
      <div class="seg">${chip('ob-set', 'sex:male', p.sex === 'male', L('ชาย', 'Male'))}${chip('ob-set', 'sex:female', p.sex === 'female', L('หญิง', 'Female'))}</div>
      <div class="grid2">${field('age', L('อายุ', 'Age'), p.age, { unit: L('ปี', 'yr') })}${field('height', L('ส่วนสูง', 'Height'), p.height, { unit: 'cm' })}
      ${field('weight', L('น้ำหนัก', 'Weight'), p.weight, { step: 0.1, unit: 'kg' })}${field('goalWeight', L('น้ำหนักเป้าหมาย', 'Goal weight'), p.goalWeight, { step: 0.1, unit: 'kg', ph: L('ไม่บังคับ', 'optional') })}</div>
      <details class="card soft" ${p.bodyFat || p.bmrScan ? 'open' : ''}><summary>${icon('scale', 18)} ${L('มีผลสแกน InBody / Body composition?', 'Have a body-composition scan?')}</summary>
      <p class="muted sm">${L('ถ้ามี จะคำนวณพลังงานได้แม่นยำขึ้น (สูตร Katch-McArdle หรือใช้ BMR จากเครื่อง)', 'Improves accuracy (Katch-McArdle, or your measured BMR)')}</p>
      <div class="grid2">${field('bodyFat', L('ไขมัน %', 'Body fat %'), p.bodyFat, { step: 0.1, unit: '%' })}${field('muscle', L('มวลกล้ามเนื้อ', 'Skeletal muscle'), p.muscle, { step: 0.1, unit: 'kg' })}
      ${field('bmrScan', 'BMR', p.bmrScan, { unit: 'kcal' })}${field('visceral', L('ไขมันช่องท้อง', 'Visceral fat'), p.visceral, { unit: 'lv' })}</div></details>`,
    () => `<h2>${L('เป้าหมายของคุณ', 'Your goal')}</h2>
      <div class="goal-grid">${Object.entries(GOALS).map(([k, g]) => `<button class="goal ${p.goal === k ? 'on' : ''}" data-act="ob-set" data-v="goal:${k}">${icon(g.icon, 26)}<b>${L(g)}</b></button>`).join('')}</div>
      <h3>${L('ประสบการณ์', 'Experience')}</h3>
      <div class="seg">${['beginner', 'intermediate', 'advanced'].map((k, i) => chip('ob-set', 'level:' + k, p.level === k, [L('มือใหม่', 'Beginner'), L('ปานกลาง', 'Intermediate'), L('ชำนาญ', 'Advanced')][i])).join('')}</div>`,
    () => `<h2>${L('การออกกำลังกาย', 'Training')}</h2>
      ${trainingControls(p,'ob')}
      <h3>${L('วันที่ออกกำลังกาย', 'Training days')} <small class="muted">${p.trainDays.length} ${L('วัน/สัปดาห์', 'days/week')}</small></h3>
      <div class="days">${WEEKDAYS().map((d, i) => chip('ob-day', i, p.trainDays.includes(i), d)).join('')}</div>
      <h3>${L('เวลาต่อครั้ง', 'Session length')}</h3>
      <div class="seg">${[20, 30, 45, 60].map((m) => chip('ob-set', 'sessionMin:' + m, p.sessionMin === m, m + ' ' + L('นาที', 'min'))).join('')}</div>
      ${field('workoutTime', L('เวลาที่สะดวกออกกำลังกาย', 'Usual workout time'), p.workoutTime, { type: 'time' })}`,
    () => `<h2>${L('อาหารและเวลาพักผ่อน', 'Food & rest')}</h2>
      <h3>${L('รูปแบบการกิน', 'Eating style')}</h3>
      <div class="chips">${Object.entries(DIETS).map(([k, d]) => chip('ob-set', 'diet:' + k, p.diet === k, L(d))).join('')}</div>
      <h3>${L('ไม่ทาน / แพ้', 'Exclude / allergies')}</h3>
      <div class="chips">${Object.entries(EXCLUDES).map(([k, d]) => chip('ob-ex', k, p.exclude.includes(k), L(d))).join('')}</div>
      ${fastingFields(p)}<h3>${L('จำนวนมื้อต่อวัน', 'Meals per day')}</h3>
      <div class="seg">${[3, 4, 5, 6].map((n) => chip('ob-set', 'mealsPerDay:' + n, p.mealsPerDay === n, n + ' ' + L('มื้อ', 'meals'))).join('')}</div>
      <div class="grid2">${field('wake', L('ตื่นนอน', 'Wake up'), p.wake, { type: 'time' })}${field('bed', L('เข้านอน', 'Bedtime'), p.bed, { type: 'time' })}</div>`,
    () => {
      const t = targets(p, true), tr = targets(p, false), b = bmi(p), bc = bmiClass(b), m = bmr(p);
      return `<h2>${L('แผนของคุณพร้อมแล้ว', 'Your plan is ready')}</h2>
      ${!consentCurrent()?consentFields():''}<div class="sum-grid">
        <div class="stat"><small>BMI</small><b>${b.toFixed(1)}</b><span class="tag ${bc.c}">${L(bc)}</span></div>
        <div class="stat"><small>BMR</small><b>${fmt(t.bmr)}</b><span class="tag">${{ scan: L('จากเครื่องสแกน', 'from scan'), katch: 'Katch-McArdle', mifflin: 'Mifflin-St Jeor' }[m.method]}</span></div>
        <div class="stat"><small>${L('วันออกกำลังกาย', 'Training day')}</small><b>${fmt(t.kcal)}</b><span class="tag">kcal</span></div>
        <div class="stat"><small>${L('วันพัก', 'Rest day')}</small><b>${fmt(tr.kcal)}</b><span class="tag">kcal</span></div>
        <div class="stat"><small>${L('โปรตีน', 'Protein')}</small><b>${t.protein} g</b><span class="tag">${(t.protein / p.weight).toFixed(1)} g/kg</span></div>
        <div class="stat"><small>${L('น้ำ', 'Water')}</small><b>${(t.water / 1000).toFixed(1)} L</b><span class="tag">${L('ต่อวัน', 'per day')}</span></div>
      </div>
      <h3>${L('ระยะเวลาแผน', 'Plan length')}</h3>
      <div class="seg">${[7, 30, 60, 90].map((n) => chip('ob-set', 'planDays:' + n, p.planDays === n, n + ' ' + L('วัน', 'days'))).join('')}</div>
      <p class="muted sm">${L('ฟรี: ดูแผนเต็มได้ 3 วันแรก · อัปเกรด Pro เพื่อดูทั้งแผนและดาวน์โหลด', 'Free: first 3 days of the full plan · upgrade to Pro for everything + downloads')}</p>`;
    },
  ];
  const content = steps[step]();
  return `<div class="onboard">
    <div class="ob-top">${step > 0 ? `<button class="icon-btn" data-act="ob-back">${icon('back')}</button>` : edit ? `<button class="icon-btn" data-act="ob-cancel">${icon('x')}</button>` : '<span></span>'}
      <div class="dots">${Array.from({ length: STEPS }, (_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div><span></span></div>
    <div class="ob-body">${content}</div>
    ${step===STEPS-1?`<p><a class="btn ghost" href="#/pay">${L('ทดลอง Pro ฟรี 7 วัน (ต้องมีบัญชี)','Free 7-day Pro trial (account required)')}</a></p>`:''}<div class="ob-foot"><button class="btn primary block" data-act="ob-next">${step === STEPS - 1 ? (edit ? L('บันทึก', 'Save') : L('เริ่มเลย', "Let's go")) : L('ถัดไป', 'Next')} ${icon('chev', 18)}</button></div>
  </div>${slot('onboarding.secondary')}${slot('onboarding.footer')}`;
};

function readInputs() {
  document.querySelectorAll('[data-bind]').forEach((el) => {
    const k = el.dataset.bind;
    let v = el.value.trim();
    setState((s) => {
      if (el.type === 'number') s.profile[k] = v === '' ? (['goalWeight', 'bodyFat', 'muscle', 'bmrScan', 'visceral'].includes(k) ? null : s.profile[k]) : Number(v);
      else s.profile[k] = v;
    });
  });
}

actions['ob-lang'] = (el) => { if(!enabledLanguages().some(([id])=>id===el.dataset.v))return;readInputs(); setState((s) => (s.lang = el.dataset.v)); rerender(); };
actions['ob-set'] = (el) => {
  readInputs();
  const [k, v] = el.dataset.v.split(':');
  setState((s) => (s.profile[k] = isNaN(Number(v)) ? v : Number(v)));
  rerender();
};
actions['ob-day'] = (el) => {
  readInputs();
  const d = Number(el.dataset.v);
  setState((s) => {
    const t = new Set(s.profile.trainDays);
    t.has(d) ? t.delete(d) : t.add(d);
    s.profile.trainDays = [...t].sort();
  });
  rerender();
};
actions['ob-ex'] = (el) => {
  readInputs();
  const k = el.dataset.v;
  setState((s) => { const e = new Set(s.profile.exclude); e.has(k) ? e.delete(k) : e.add(k); s.profile.exclude = [...e]; });
  rerender();
};
actions['ob-back'] = () => { readInputs(); step = Math.max(0, step - 1); rerender(); };
actions['ob-cancel'] = () => { step = 0; go('#/me'); };
actions['ob-next'] = () => {
  readInputs();
  const p = getState().profile;
  if (p.age < 18) setState(s => s.profile.fasting = 'none');
  if (step === 1 && (!(p.age > 10 && p.age < 100) || !(p.height > 100 && p.height < 230) || !(p.weight > 25 && p.weight < 300))) {
    import('../ui.js').then((u) => u.toast(L('กรุณากรอก อายุ ส่วนสูง น้ำหนัก ให้ถูกต้อง', 'Please enter a valid age, height and weight'), 'warn'));
    return;
  }
  if (step === 3 && p.trainDays.length === 0) {
    import('../ui.js').then((u) => u.toast(L('เลือกอย่างน้อย 1 วัน', 'Pick at least one day'), 'warn'));
    return;
  }
  if (step < STEPS - 1) { step++; rerender(); window.scrollTo(0, 0); return; }
  if(!consentCurrent()&&!acceptConsent())return;
  track('onboarding_done');
  const wasOnboarded = getState().onboarded;
  setState((s) => {
    s.onboarded = true;
    if (!wasOnboarded) s.profile.startDate = todayISO();
    if (!s.weights.length || s.weights.at(-1).kg !== s.profile.weight) s.weights.push({ date: todayISO(), kg: s.profile.weight });
  });
  step = 0;
  go(wasOnboarded ? '#/me' : '#/today');
};
export const resetOnboardStep = () => (step = 0);

actions['ob-style']=el=>{readInputs();setState(s=>toggleStyle(s.profile,el.dataset.id));rerender();};
actions['ob-equipment']=el=>{readInputs();setState(s=>toggleEquipment(s.profile,el.dataset.id));rerender();};
