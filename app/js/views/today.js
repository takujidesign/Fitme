import { fastingCard } from '../fasting.js';
import { actions, views, go, rerender } from '../core.js';
import { getState, todayISO, dayLog, updateLog, addDays } from '../store.js';
import { L, esc, icon, ring, fmt, dateLabel, sheet, closeSheet, toast, toMin, toHHMM } from '../ui.js';
import { planDay } from '../day.js';
import { splitName } from '../workout.js';
import { mealKind, unitText } from '../meals.js';
import { FOOD } from '../foods.js';
import { EX } from '../exercises.js';
import { figureSVG } from '../figure.js';
import { sleepNeed } from '../calc.js';
import { isLockedDay, lockCard } from './workout.js';

export function eaten(d, log) {
  let k = 0, pr = 0;
  for (const e of d.events) {
    if (!log.done[e.key]) continue;
    if (e.type === 'meal') { k += e.meal.total.k; pr += e.meal.total.p; }
    if (e.type === 'supp') for (const x of e.list) { k += (x.prod.nutrition?.k || 0) * x.amount; pr += (x.prod.nutrition?.p || 0) * x.amount; }
  }
  return { k: Math.round(k), p: Math.round(pr) };
}

function eventRow(e, log, iso) {
  const done = !!log.done[e.key];
  const check = ['meal', 'supp', 'workout', 'water'].includes(e.type);
  let ic = 'clock', title = '', sub = '', cls = e.type, act = '';
  if (e.type === 'fasting') { title = e.eating ? L('เริ่มกินได้', 'Eating window starts') : L('เริ่ม IF', 'Fasting starts'); }
  if (e.type === 'wake') { ic = 'sun'; title = L('ตื่นนอน', 'Wake up'); sub = L('เปิดม่าน รับแสงแดด 5-10 นาที', 'Get 5-10 min of daylight'); }
  if (e.type === 'water') { ic = 'drop'; title = L(`ดื่มน้ำ ${e.ml} มล.`, `Drink ${e.ml} ml water`); sub = L('ช่วยกระตุ้นระบบเผาผลาญหลังตื่นนอน', 'Rehydrate after sleep'); }
  if (e.type === 'meal') { ic = mealKind(e.meal.kind).icon; title = L(mealKind(e.meal.kind)); sub = `${esc(L(e.meal.name))} · <b>${e.meal.total.k}</b> kcal · P${e.meal.total.p}g`; act = `data-act="meal-open" data-iso="${iso}" data-k="${e.meal.key}"`; }
  if (e.type === 'supp') { ic = 'pill'; title = L(e.slotInfo); sub = e.list.map((x) => `<span class="dot" style="background:${x.prod.color || 'var(--teal)'}"></span>${esc(L(x.prod.name).split('(')[0])} ×${x.amount}`).join(' '); }
  if (e.type === 'workout') { ic = e.sess.type === 'train' ? 'dumbbell' : 'walk'; title = e.sess.type === 'train' ? L(splitName(e.sess.split)) : L('ฟื้นฟูร่างกาย', 'Active recovery'); sub = `${e.sess.minutes} ${L('นาที', 'min')} · ~${e.kcal} kcal`; act = `data-act="go" data-to="#/workout/${iso}"`; }
  if (e.type === 'note') { ic = e.note === 'caffeine' ? 'warn' : 'moon'; title = e.note === 'caffeine' ? L('งดคาเฟอีนหลังจากนี้', 'Caffeine cut-off') : L('ปิดจอ เตรียมนอน', 'Screens off'); sub = e.note === 'caffeine' ? L('ช่วยให้หลับลึกขึ้น', 'Protects deep sleep') : L('หรี่ไฟ อาบน้ำอุ่น ยืดเหยียดเบาๆ', 'Dim lights, warm shower, light stretch'); }
  if (e.type === 'sleep') { ic = 'bed'; title = L('เข้านอน', 'Lights out'); sub = L(`เป้าหมาย ${sleepNeed(getState().profile.age).join('-')} ชม.`, `Target ${sleepNeed(getState().profile.age).join('-')} h`); }
  if (e.type === 'workout' && e.sess.type === 'rest') ic = 'sun';
  return `<li class="tl t-${cls} ${done ? 'done' : ''}">
    <time>${e.time}</time><span class="tl-ic">${icon(ic, 18)}</span>
    <div class="tl-body" ${act}><b>${title}</b><small>${sub}</small></div>
    ${check ? `<button class="tick ${done ? 'on' : ''}" data-act="tick" data-iso="${iso}" data-k="${e.key}" aria-label="done">${icon('check', 16)}</button>` : ''}
  </li>`;
}

views.today = ({ query }) => {
  const s = getState(), p = s.profile;
  const iso = query.get('d') || todayISO();
  const d = planDay(iso);
  const log = dayLog(iso);
  const ate = eaten(d, log);
  const now = toMin(new Date().toTimeString().slice(0, 5));
  const nextIdx = iso === todayISO() ? d.events.findIndex((e) => e.min >= now - 20 && !log.done[e.key]) : -1;
  const hr = new Date().getHours();
  const hello = hr < 12 ? L('อรุณสวัสดิ์', 'Good morning') : hr < 17 ? L('สวัสดีตอนบ่าย', 'Good afternoon') : L('สวัสดีตอนเย็น', 'Good evening');
  const lastNight = s.logs[iso]?.sleep;
  const sess = d.sess;
  return `<header class="top">
      <div><small class="muted">${dateLabel(iso, { weekday: 'long', day: 'numeric', month: 'long' })}</small><h1>${hello}${p.name ? ', ' + esc(p.name) : ''}</h1></div>
      <div class="day-nav"><button class="icon-btn" data-act="go" data-to="#/today?d=${addDays(iso, -1)}">${icon('back', 18)}</button><button class="icon-btn" data-act="go" data-to="#/today?d=${addDays(iso, 1)}">${icon('chev', 18)}</button></div>
    </header>
    ${fastingCard(p)}<section class="hero-card ${d.train ? 'train' : 'rest'}">
      <div class="hero-top"><span class="pill">${d.train ? icon('dumbbell', 14) + L('วันออกกำลังกาย', 'Training day') : icon('moon', 14) + L('วันพักฟื้น', 'Recovery day')}</span>${sess ? `<span class="muted sm">${L('สัปดาห์ที่', 'Week')} ${sess.week}${sess.deload ? ' · Deload' : ''}</span>` : ''}</div>
      <div class="rings">
        ${ring(ate.k / d.t.kcal, { size: 92, stroke: 9, label: fmt(Math.max(0, d.t.kcal - ate.k)), sub: L('kcal เหลือ', 'kcal left') })}
        <div class="ring-col">
          <div class="mini">${ring(ate.p / d.t.protein, { size: 46, stroke: 5, color: 'var(--teal)', label: '' })}<div><b>${ate.p}/${d.t.protein} g</b><small>${L('โปรตีน', 'Protein')}</small></div></div>
          <div class="mini">${ring(log.water / d.t.water, { size: 46, stroke: 5, color: 'var(--sky)', label: '' })}<div><b>${(log.water / 1000).toFixed(1)}/${(d.t.water / 1000).toFixed(1)} L</b><small>${L('น้ำ', 'Water')}</small></div>
            <button class="btn xs ghost" data-act="water" data-iso="${iso}" data-ml="250">+250</button></div>
        </div>
      </div>
      ${sess?.items.length ? `<button class="session-cta" data-act="go" data-to="#/player/${iso}">
        <div class="cta-fig">${figureSVG(EX[sess.items.find((i) => !i.phase || i.phase === 'main')?.id || sess.items[0].id])}</div>
        <div><small>${d.train ? L(splitName(sess.split)) : L('เดินเบาๆ + ยืดเหยียด', 'Walk + stretch')}</small><b>${log.done.workout ? L('ทำเสร็จแล้ว ✓', 'Completed ✓') : L('เริ่มออกกำลังกาย', 'Start workout')}</b><span>${sess.minutes} ${L('นาที', 'min')} · ${sess.items.length} ${L('ท่า', 'moves')}</span></div>
        <span class="play">${icon('play', 20)}</span></button>` : ''}
    </section>
    ${!lastNight && iso === todayISO() ? `<button class="card soft row-card" data-act="sleep-log" data-iso="${iso}">${icon('bed', 22)}<div><b>${L('เมื่อคืนนอนหลับเป็นอย่างไร?', 'How did you sleep?')}</b><small>${L('บันทึกการนอนเพื่อปรับแผนการพักผ่อน', 'Log sleep to tune your recovery')}</small></div>${icon('chev', 18)}</button>` : ''}
    <h2 class="sec">${L('ไทม์ไลน์วันนี้', 'Today\'s timeline')}</h2>
    ${isLockedDay(iso) ? lockCard() : `<ol class="timeline">${d.events.map((e, i) => eventRow(e, log, iso).replace('<li class="tl', `<li class="tl ${i === nextIdx ? 'next' : ''}`)).join('')}</ol>`}
    ${d.sm.protein ? `<p class="muted sm center">${L(`อาหารเสริมวันนี้ให้โปรตีน ${d.sm.protein} g / ${d.sm.kcal} kcal (หักออกจากมื้ออาหารแล้ว)`, `Supplements today add ${d.sm.protein} g protein / ${d.sm.kcal} kcal (already deducted from meals)`)}</p>` : ''}`;
};

actions.tick = (el) => {
  const { iso, k } = el.dataset;
  updateLog(iso, (l) => { l.done[k] = !l.done[k]; if (k === 'water-am' && l.done[k]) l.water += 500; });
  if (navigator.vibrate) navigator.vibrate(12);
  rerender();
};
actions.water = (el) => {
  const ml = Number(el.dataset.ml);
  updateLog(el.dataset.iso, (l) => (l.water = (l.water || 0) + ml));
  toast(L(`+${ml} มล. 💧`, `+${ml} ml 💧`));
  rerender();
};

actions['meal-open'] = (el) => {
  const d = planDay(el.dataset.iso);
  const m = d.meals.find((x) => x.key === el.dataset.k);
  mealSheet(m, el.dataset.iso);
};
export function mealSheet(m, iso) {
  const lang = getState().lang;
  sheet(`<div class="sheet-head"><div><small class="muted">${m.time} · ${L(mealKind(m.kind))}</small><h2>${esc(L(m.name))}</h2></div><button class="icon-btn" data-close>${icon('x')}</button></div>
    <div class="macro-row"><div><b>${m.total.k}</b><small>kcal</small></div><div><b>${m.total.p}g</b><small>${L('โปรตีน', 'Protein')}</small></div><div><b>${m.total.c}g</b><small>${L('คาร์บ', 'Carbs')}</small></div><div><b>${m.total.f}g</b><small>${L('ไขมัน', 'Fat')}</small></div></div>
    <ul class="food-list">${m.items.map((it) => { const f = FOOD[it.id]; return `<li><span class="fcat ${f.cat}"></span><div><b>${L({ th: f.th, en: f.en })}</b><small>${unitText(f, it.g, lang)}</small></div><em>${it.g} g</em></li>`; }).join('')}</ul>
    ${m.post ? `<p class="note">${icon('info', 16)} ${L('มื้อหลังออกกำลังกาย: เน้นคาร์บ + โปรตีน ภายใน 1-2 ชม. เพื่อฟื้นฟูกล้ามเนื้อ', 'Post-workout: carbs + protein within 1-2 h to recover')}</p>` : ''}
    ${m.pre ? `<p class="note">${icon('info', 16)} ${L('มื้อก่อนออกกำลังกาย: ทานก่อน 60-90 นาที ไขมันต่ำ ย่อยง่าย', 'Pre-workout: 60-90 min before, low fat, easy to digest')}</p>` : ''}
    <div class="row gap"><button class="btn ghost block" data-act="meal-swap" data-iso="${iso}" data-k="${m.key}">${icon('refresh', 18)} ${L('สุ่มเมนูใหม่', 'Swap meal')}</button>
    <button class="btn primary block" data-act="tick" data-iso="${iso}" data-k="meal-${m.key}" data-close>${icon('check', 18)} ${L('ทานแล้ว', 'Eaten')}</button></div>`);
}
actions['meal-swap'] = (el) => {
  const { iso, k } = el.dataset;
  import('../store.js').then(({ setState }) => {
    setState((s) => { const key = `${iso}|${k}`; s.mealSeed[key] = (s.mealSeed[key] || 0) + 1; });
    const m = planDay(iso).meals.find((x) => x.key === k);
    closeSheet();
    rerender();
    setTimeout(() => mealSheet(m, iso), 260);
  });
};

actions['sleep-log'] = (el) => {
  const p = getState().profile;
  const iso = el.dataset.iso;
  sheet(`<div class="sheet-head"><h2>${L('บันทึกการนอน', 'Log sleep')}</h2><button class="icon-btn" data-close>${icon('x')}</button></div>
    <div class="grid2"><label class="field"><span>${L('เข้านอนเมื่อคืน', 'Went to bed')}</span><div class="input-wrap"><input type="time" id="sl-bed" value="${p.bed}"></div></label>
    <label class="field"><span>${L('ตื่นนอน', 'Woke up')}</span><div class="input-wrap"><input type="time" id="sl-wake" value="${p.wake}"></div></label></div>
    <h3>${L('คุณภาพการนอน', 'Sleep quality')}</h3>
    <div class="seg" id="sl-q">${[1, 2, 3, 4, 5].map((q) => `<button class="chip ${q === 4 ? 'on' : ''}" data-q="${q}">${['😫', '😕', '😐', '🙂', '😴'][q - 1]}</button>`).join('')}</div>
    <button class="btn primary block" id="sl-save">${L('บันทึก', 'Save')}</button>`, {
    onMount(root) {
      let q = 4;
      root.querySelector('#sl-q').addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (!b) return; q = Number(b.dataset.q); root.querySelectorAll('#sl-q .chip').forEach((c) => c.classList.toggle('on', c === b)); });
      root.querySelector('#sl-save').addEventListener('click', () => {
        const bed = root.querySelector('#sl-bed').value, wake = root.querySelector('#sl-wake').value;
        let h = (toMin(wake) - toMin(bed) + 1440) % 1440 / 60;
        updateLog(iso, (l) => (l.sleep = { bed, wake, hours: Math.round(h * 10) / 10, quality: q }));
        closeSheet();
        const [mn] = sleepNeed(p.age);
        toast(h < mn ? L(`นอน ${h.toFixed(1)} ชม. น้อยกว่าเป้า ลองเข้านอนเร็วขึ้นคืนนี้`, `${h.toFixed(1)} h — below target, try an earlier night`) : L(`นอน ${h.toFixed(1)} ชม. เยี่ยมมาก!`, `${h.toFixed(1)} h — great!`));
        rerender();
      });
    },
  });
};
actions.go = (el) => go(el.dataset.to);
export { toHHMM };

views.today.mount = (root) => { const timer = setInterval(() => { if (!root.querySelector('.v-today')) return clearInterval(timer); rerender(); clearInterval(timer); }, 60000); };
