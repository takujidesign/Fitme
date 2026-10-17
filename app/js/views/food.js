import { fastingFields, eatingWindow, inWindow } from '../fasting.js';
import { actions, views, rerender } from '../core.js';
import { getState, setState, todayISO, dayLog } from '../store.js';
import { L, esc, icon, dateLabel, sheet, closeSheet } from '../ui.js';
import { planDay } from '../day.js';
import { mealKind, unitText } from '../meals.js';
import { FOOD, DIETS, EXCLUDES } from '../foods.js';
import { weekStrip, isLockedDay, lockCard } from './workout.js';
import { mealLogButtons, foodLogHTML } from './food-log.js';
import { eaten, mealSheet } from './today.js';

const bar = (label, val, tgt, color) => {
  const pct = Math.min(120, (val / (tgt || 1)) * 100);
  return `<div class="mbar"><div class="row between"><span>${label}</span><small><b>${val}</b> / ${tgt} g</small></div><div class="track"><i style="width:${Math.min(100, pct)}%;background:${color}"></i></div></div>`;
};

views.food = ({ params }) => {
  const iso = params[0] || todayISO();
  const p = getState().profile;
  const d = planDay(iso);
  const lang = getState().lang;
  const log = dayLog(iso);
  const tot = eaten(d, log);
  const head = `<header class="top"><div><small class="muted">${L('โภชนาการ', 'Nutrition')}</small><h1>${L('แผนอาหาร', 'Meal plan')}</h1></div>
    <button class="icon-btn" data-act="food-prefs" aria-label="prefs">${icon('settings')}</button></header>`;
  return head + mealLogButtons(iso) + foodLogHTML(iso) + `<button class="btn ghost block" data-act="shopping" data-iso="${iso}">${L('รายการซื้อของ 7 วัน', '7-day shopping list')}</button>${eatingWindow(p) && d.train && !inWindow(Number(p.workoutTime.slice(0,2))*60+Number(p.workoutTime.slice(3)), eatingWindow(p)) ? `<p class="note">${L('เวลาออกกำลังกายอยู่ในช่วงอด ลองเลื่อนมาใกล้เวลาเริ่มกิน', 'Your workout falls in the fast. Consider moving it near the eating window start.')}</p>` : ""}` + weekStrip(iso, '#/food/') + `
    <section class="card">
      <div class="row between"><div><small class="muted">${dateLabel(iso, { weekday: 'long', day: 'numeric', month: 'short' })} · ${d.train ? L('วันออกกำลังกาย', 'Training day') : L('วันพัก', 'Rest day')}</small>
        <h2>${tot.k.toLocaleString()} <small class="muted">/ ${d.t.kcal.toLocaleString()} kcal</small></h2></div>
        <span class="tag">${L(DIETS[p.diet])}</span></div>
      ${bar(L('โปรตีน', 'Protein'), tot.p, d.t.protein, 'var(--teal)')}
      ${bar(L('คาร์โบไฮเดรต', 'Carbs'), tot.c, d.t.carbs, 'var(--lime)')}
      ${bar(L('ไขมัน', 'Fat'), tot.f, d.t.fat, 'var(--amber)')}
      <p class="muted sm">${L('รวมเฉพาะที่ทานแล้ว', 'Includes eaten meals, checked supplements and extra food logs')}</p>
      ${p.exclude.length ? `<div class="chips">${p.exclude.map((e) => `<span class="chip sm on">${L(EXCLUDES[e])}</span>`).join('')}</div>` : ''}
    </section>
    ${isLockedDay(iso) ? lockCard() : d.meals.map((m) => `<article class="meal ${log.done['meal-' + m.key] ? 'done' : ''}" data-act="meal-open2" data-iso="${iso}" data-k="${m.key}">
      <div class="meal-head"><span class="meal-ic">${icon(mealKind(m.kind).icon, 18)}</span><div><small>${m.time} · ${L(mealKind(m.kind))}</small><b>${esc(L(m.name))}</b></div><em>${m.total.k}<small>kcal</small></em></div>
      <ul class="food-chips">${m.items.map((it) => { const f = FOOD[it.id]; return `<li><span class="fcat ${f.cat}"></span>${esc(L({ th: f.th, en: f.en }))} <b>${it.g}g</b> <small>${esc(unitText(f, it.g, lang))}</small></li>`; }).join('')}</ul>
      <div class="meal-mac"><span>P ${m.total.p}g</span><span>C ${m.total.c}g</span><span>F ${m.total.f}g</span>${log.done['meal-' + m.key] ? `<span class="ok">${icon('check', 14)} ${L('ทานแล้ว', 'Eaten')}</span>` : ''}</div>
    </article>`).join('')}
    <section class="card"><h2>${L('AI โค้ช', 'AI coach')}</h2><p class="muted sm">${L('ทบทวนอาหารและอาหารเสริมวันนี้ (Pro)', "Review today's meals and supplements (Pro)")}</p><button class="btn primary" data-act="ai-plan">${L('ทบทวนแผนวันนี้', "Review today's plan")}</button></section>
    <div class="tips card soft"><b>${icon('info', 16)} ${L('เคล็ดลับ', 'Tips')}</b><ul>
      <li>${L('ชั่งอาหารสุก 1-2 สัปดาห์แรก จะกะปริมาณได้แม่นขึ้น', 'Weigh cooked food for 1-2 weeks to learn portions')}</li>
      <li>${L('ปรุงด้วยการต้ม นึ่ง ย่าง อบ ลดน้ำมัน น้ำตาล และโซเดียม', 'Boil, steam, grill or bake; go easy on oil, sugar and salt')}</li>
      <li>${L('กดที่มื้อเพื่อดูรายละเอียดหรือสุ่มเมนูใหม่', 'Tap a meal for details or to swap it')}</li></ul></div>`;
};
actions['meal-open2'] = (el) => {
  const m = planDay(el.dataset.iso).meals.find((x) => x.key === el.dataset.k);
  mealSheet(m, el.dataset.iso);
};

actions['food-prefs'] = () => {
  const p = getState().profile;
  sheet(`<div class="sheet-head"><h2>${L('ความชอบด้านอาหาร', 'Food preferences')}</h2><button class="icon-btn" data-close>${icon('x')}</button></div>
    <button class="btn ghost block" data-act="custom-foods">${L('เมนูของฉัน', 'My foods')}</button><h3>${L('รูปแบบการกิน', 'Eating style')}</h3>
    <div class="chips">${Object.entries(DIETS).map(([k, d]) => `<button class="chip ${p.diet === k ? 'on' : ''}" data-act="fp-diet" data-v="${k}">${L(d)}</button>`).join('')}</div>
    <h3>${L('ไม่ทาน / แพ้', 'Exclude')}</h3>
    <div class="chips">${Object.entries(EXCLUDES).map(([k, d]) => `<button class="chip ${p.exclude.includes(k) ? 'on' : ''}" data-act="fp-ex" data-v="${k}">${L(d)}</button>`).join('')}</div>
    ${fastingFields(p)}<h3>${L('มื้อต่อวัน', 'Meals per day')}</h3>
    <div class="seg">${[3, 4, 5, 6].map((n) => `<button class="chip ${p.mealsPerDay === n ? 'on' : ''}" data-act="fp-meals" data-v="${n}">${n}</button>`).join('')}</div>`, { onMount(root) { root.querySelectorAll('[data-bind]').forEach(el => el.addEventListener('change', () => { setState(s => { s.profile[el.dataset.bind] = el.value; if (s.profile.age < 18) s.profile.fasting = 'none'; }); rerender(); })); } });
};
// Toggle chips in place so the sheet stays open while the plan underneath re-renders.
const single = (el) => el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el));
actions['fp-diet'] = (el) => { setState((s) => (s.profile.diet = el.dataset.v)); single(el); rerender(); };
actions['fp-ex'] = (el) => { setState((s) => { const e = new Set(s.profile.exclude); e.has(el.dataset.v) ? e.delete(el.dataset.v) : e.add(el.dataset.v); s.profile.exclude = [...e]; }); el.classList.toggle('on'); rerender(); };
actions['fp-meals'] = (el) => { setState((s) => (s.profile.mealsPerDay = Number(el.dataset.v))); single(el); rerender(); };
