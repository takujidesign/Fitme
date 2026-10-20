import { slot } from '../slots.js';
import { LANGUAGES, languageFont } from '../i18n/index.js';
import { accountCard, mountTrainerNotes } from './account.js';
import { badgeGrid } from './challenges.js';
import { replanCard } from './replan.js';
import { healthCard } from '../health.js';
import '../measurements.js';
import { progressCard } from '../progress.js';
import { actions, views, go, rerender, pickFiles } from '../core.js';
import { getState, setState, todayISO, addDays, putImage, imageURL, compressImage, uid, delImage, resetAll, importState } from '../store.js';
import { L, esc, icon, sheet, closeSheet, toast, dateLabel, fmt } from '../ui.js';
import { bmi, bmiClass, targets, GOALS, sleepNeed, bedtimes, weeksToGoal } from '../calc.js';
import { hasPro, canExport, useExport } from '../pay.js';
import { exportPDF, exportICS, exportJSON } from '../export.js';
import { resetOnboardStep } from './onboard.js';
import { CONFIG } from '../config.js';

function sparkline(points, { w = 300, h = 80, color = 'var(--lime)' } = {}) {
  if (points.length < 2) return `<div class="muted sm center pad">${L('บันทึกน้ำหนักอย่างน้อย 2 ครั้งเพื่อดูกราฟ', 'Log at least 2 weigh-ins to see the trend')}</div>`;
  const vals = points.map((p) => p.v), min = Math.min(...vals) - 0.5, max = Math.max(...vals) + 0.5;
  const x = (i) => 8 + (i / (points.length - 1)) * (w - 16), y = (v) => h - 10 - ((v - min) / (max - min)) * (h - 20);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" class="spark"><defs><linearGradient id="sg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${d} L${x(points.length - 1)},${h} L${x(0)},${h} Z" fill="url(#sg)"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.v)}" r="3" fill="${color}"/>`).join('')}</svg>`;
}

views.me = () => {
  const s = getState(), p = s.profile;
  const b = bmi(p), bc = bmiClass(b), t = targets(p, true);
  const [sMin, sMax] = sleepNeed(p.age);
  const nights = Array.from({ length: 7 }, (_, i) => addDays(todayISO(), i - 6)).map((iso) => ({ iso, h: s.logs[iso]?.sleep?.hours || 0, q: s.logs[iso]?.sleep?.quality }));
  const avg = nights.filter((n) => n.h).reduce((a, n, _, arr) => a + n.h / arr.length, 0);
  const nTrain = p.trainDays.length;
  const avgKcal = (t.kcal * nTrain + targets(p, false).kcal * (7 - nTrain)) / 7;
  const wk = weeksToGoal(p, avgKcal - t.tdee);
  const done = Object.values(s.logs).filter((l) => l.done?.workout).length;
  return `<header class="top"><div><small class="muted">${L('โปรไฟล์', 'Profile')}</small><h1>${esc(p.name) || L('ฉัน', 'Me')}</h1></div>
    <button class="icon-btn" data-act="me-edit">${icon('settings')}</button></header><section class="card profile">
      <div class="sum-grid">
        <div class="stat"><small>${L('น้ำหนัก', 'Weight')}</small><b>${p.weight}</b><span class="tag">kg</span></div>
        <div class="stat"><small>BMI</small><b>${b.toFixed(1)}</b><span class="tag ${bc.c}">${L(bc)}</span></div>
        <div class="stat"><small>${L('เป้าหมาย', 'Goal')}</small><b class="sm">${L(GOALS[p.goal])}</b><span class="tag">${p.goalWeight ? p.goalWeight + ' kg' : '—'}</span></div>
        <div class="stat"><small>${L('ฝึกแล้ว', 'Workouts')}</small><b>${done}</b><span class="tag">${L('ครั้ง', 'done')}</span></div>
      </div>
      ${wk ? `<p class="muted sm">${L(`ถึงน้ำหนักเป้าหมายในราว ${wk} สัปดาห์ (อัตรา ~${((Math.abs(avgKcal - t.tdee) * 7) / 7700).toFixed(2)} กก./สัปดาห์)`, `About ${wk} weeks to your goal weight (~${((Math.abs(avgKcal - t.tdee) * 7) / 7700).toFixed(2)} kg/week)`)}</p>` : ''}
      ${p.bodyFat ? `<p class="muted sm">${L('ไขมัน', 'Body fat')} ${p.bodyFat}% ${p.muscle ? `· ${L('กล้ามเนื้อ', 'Muscle')} ${p.muscle} kg` : ''} ${p.bmrScan ? `· BMR ${p.bmrScan}` : ''}</p>` : ''}
    </section>

    ${progressCard(sparkline(s.weights.slice(-20).map(w => ({v:w.kg}))))}
    <section class="card">
      <div class="row between"><h2>${icon('camera', 20)} ${L('รูปร่าง', 'Body photos')}</h2><button class="btn xs ghost" data-act="me-photo">${icon('plus', 16)} ${L('เพิ่มรูป', 'Add')}</button></div>
      <p class="muted sm">${L('รูปที่บันทึกเก็บในเครื่อง ส่งให้ AI เฉพาะเมื่อยินยอม · ถ่ายมุมเดิม แสงเดิม ทุก 2 สัปดาห์', 'Saved photos stay on this device; AI uploads only with consent · same angle and light every 2 weeks')}</p>
      <button class="btn ghost block" data-act="ai-body">${L('วิเคราะห์รูปร่างด้วย AI', 'Analyze body with AI')}</button>
      <div class="photo-grid">${s.photos.slice().reverse().map((ph) => `<button class="ph" data-act="me-photo-open" data-id="${ph.id}" data-img="${ph.id}"><small>${dateLabel(ph.date, { day: 'numeric', month: 'short' })}</small></button>`).join('') || `<div class="muted sm">${L('ยังไม่มีรูป', 'No photos yet')}</div>`}</div>
      ${s.photos.length >= 2 ? `<button class="btn ghost block" data-act="me-compare">${icon('swap', 18)} ${L('เปรียบเทียบก่อน/หลัง', 'Compare before/after')}</button>` : ''}
    </section>

    <section class="card">
      <h2>${icon('moon', 20)} ${L('การนอนและการพักผ่อน', 'Sleep & recovery')}</h2>
      <div class="sleep-bars">${nights.map((n) => `<div class="sb"><i style="height:${Math.min(100, (n.h / 10) * 100)}%" class="${n.h && n.h < sMin ? 'low' : ''}"></i><small>${dateLabel(n.iso, { weekday: 'narrow' })}</small></div>`).join('')}<span class="goal-line" style="bottom:${(sMin / 10) * 100}%"></span></div>
      <p class="muted sm">${L(`เป้าหมาย ${sMin}-${sMax} ชม./คืน · เฉลี่ย 7 วัน ${avg ? avg.toFixed(1) : '—'} ชม.`, `Target ${sMin}-${sMax} h/night · 7-day avg ${avg ? avg.toFixed(1) : '—'} h`)}</p>
      <div class="bed-times">${bedtimes(p.wake).map((bt) => `<div><b>${bt.time}</b><small>${bt.hours} ${L('ชม.', 'h')} · ${bt.cycles} ${L('รอบ', 'cycles')}</small></div>`).join('')}</div>
      <p class="muted sm">${L(`เวลาเข้านอนที่ตื่นตรงรอบการนอน 90 นาที เมื่อต้องตื่น ${p.wake}`, `Bedtimes that complete 90-min sleep cycles for a ${p.wake} wake-up`)}</p>
      <button class="btn ghost block" data-act="sleep-log" data-iso="${todayISO()}">${icon('bed', 18)} ${L('บันทึกการนอนเมื่อคืน', 'Log last night')}</button>
    </section>

    <section class="card settings-list"><h2>${L('ตั้งค่า','Settings')}</h2><div class="list">
    ${[['training-settings','settings','ตั้งค่าการฝึก','Training settings'],['food','food','ตั้งค่าอาหาร','Food preferences'],['supps','pill','อาหารเสริม','Supplements']].map(([path,ic,th,en])=>`<a class="list-row" href="#/${path}" ${path==='food'?'data-act="food-prefs"':''}>${icon(ic,18)}<span>${L(th,en)}</span>${icon('chev',16)}</a>`).join('')}
    <button class="list-row" data-act="me-lang">${icon('globe',18)}<span>${L('ภาษา','Language')}</span>${icon('chev',16)}</button><button class="list-row" data-act="theme">${icon('moon',18)}<span>${L('ธีม','Theme')}</span>${icon('chev',16)}</button>
    ${[['account','user','บัญชี','Account'],['groups','user','กลุ่มและชาเลนจ์','Groups and challenges'],['shop','card','ร้านค้า','Shop']].map(([path,ic,th,en])=>`<a class="list-row" href="#/${path}">${icon(ic,18)}<span>${L(th,en)}</span>${icon('chev',16)}</a>`).join('')}
    <button class="list-row" data-act="me-data">${icon('download',18)}<span>${L('ข้อมูลและสำรอง','Data & backup')}</span>${icon('chev',16)}</button>
    <a class="list-row" href="#/privacy">${icon('lock',18)}<span>${L('ความเป็นส่วนตัวและเงื่อนไข','Privacy & terms')}</span>${icon('chev',16)}</a>
    <a class="list-row" href="#/credits">${icon('info',18)}<span>${L('เครดิต','Credits')}</span>${icon('chev',16)}</a></div></section>
    <details class="card"><summary>${L('สุขภาพและความก้าวหน้า','Health and progress')}</summary><div class="list">${[['muscles','กล้ามเนื้อ','Muscles'],['records','สถิติส่วนตัว','Personal records'],['tools','เครื่องคำนวณ','Calculators']].map(([path,th,en])=>`<a class="list-row" href="#/${path}">${L(th,en)}${icon('chev',16)}</a>`).join('')}</div>${accountCard()}${badgeGrid()}${replanCard()}${healthCard()}${slot('me.secondary')}</details>
    <details class="card" id="me-data"><summary>${L('ข้อมูลและสำรอง','Data & backup')}</summary>    <section class="card premium ${hasPro() ? 'on' : ''}">
      <div class="row between"><h2>${icon('spark', 20)} Fixmee Pro</h2>${hasPro() ? `<span class="tag teal">${L('ใช้งานถึง', 'Active until')} ${dateLabel(s.premium.until.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' })}</span>` : ''}</div>
      ${hasPro() ? '' : `<p class="muted sm">${L('แผนเต็มทุกวัน · อาหารเสริมไม่จำกัด · AI อ่านฉลาก · ดาวน์โหลด PDF/ปฏิทิน', 'Full plan · unlimited supplements · AI label reader · PDF & calendar downloads')}</p><button class="btn primary block" data-act="go" data-to="#/pay">${L('อัปเกรด', 'Upgrade')}</button>`}
      ${!hasPro() && s.premium.exportsLeft ? `<p class="muted sm">${L(`สิทธิ์ดาวน์โหลดคงเหลือ ${s.premium.exportsLeft} ครั้ง`, `${s.premium.exportsLeft} download(s) left`)}</p>` : ''}
    </section>

    <section class="card">
      <h2>${icon('download', 20)} ${L('ดาวน์โหลดแผน', 'Download plan')}</h2>
      <div class="seg">${[7, 30, 60, 90].map((n) => `<button class="chip ${p.planDays === n ? 'on' : ''}" data-act="me-days" data-v="${n}">${n} ${L('วัน', 'days')}</button>`).join('')}</div>
      <div class="row gap"><button class="btn ghost block" data-act="me-pdf">${canExport() ? '' : icon('lock', 16)} PDF</button><button class="btn ghost block" data-act="me-ics">${canExport() ? '' : icon('lock', 16)} ${L('ปฏิทิน', 'Calendar')} .ics</button></div>
      <p class="muted sm">${L('PDF: กด "บันทึกเป็น PDF" ในหน้าพิมพ์ · ปฏิทิน: นำเข้า Google/Apple Calendar เพื่อแจ้งเตือนมื้ออาหาร อาหารเสริม และเวลาออกกำลังกาย', 'PDF: choose "Save as PDF" in the print dialog · Calendar: import into Google/Apple Calendar for meal, supplement and workout reminders')}</p>
    </section>

    <section class="card"><div class="list"><button class="btn ghost" data-act="measurements">${L('สัดส่วนร่างกาย', 'Body measurements')}</button><button class="btn ghost" data-act="share-card">${L('แชร์ผลลัพธ์', 'Share results')}</button><button class="btn ghost" data-act="notifications">${L('การแจ้งเตือน', 'Notifications')}</button></div></section>
    <section class="card">
      <h2>${icon('settings', 20)} ${L('ตั้งค่า', 'Settings')}</h2>
      <div class="list">
        <button class="btn ghost" data-act="me-edit">${icon('user', 18)} ${L('แก้ไขข้อมูลและเป้าหมาย', 'Edit profile & goals')}${icon('chev', 16)}</button>
        <button class="btn ghost" data-act="me-restart">${icon('refresh', 18)} ${L('เริ่มแผนใหม่วันนี้', 'Restart plan today')}${icon('chev', 16)}</button>
        <button class="btn ghost" data-act="me-backup">${icon('download', 18)} ${L('สำรองข้อมูล (JSON)', 'Back up data (JSON)')}${icon('chev', 16)}</button>
        <button class="btn ghost" data-act="me-restore">${icon('refresh', 18)} ${L('กู้คืนข้อมูล', 'Restore backup')}${icon('chev', 16)}</button>
        <button data-act="me-reset" class="danger">${icon('trash', 18)} ${L('ลบข้อมูลทั้งหมด', 'Delete all data')}${icon('chev', 16)}</button>
      </div>
    </section>
</details>
    <p class="muted sm center">Fixmee · ${L('คำแนะนำทั่วไป ไม่ใช่คำวินิจฉัยทางการแพทย์', 'General guidance, not medical advice')}</p>${slot('me.footer')}`;
};
views.me.mount = async (root) => {
  mountTrainerNotes(root);
  for (const el of root.querySelectorAll('[data-img]')) {
    const u = await imageURL(el.dataset.img);
    if (u) el.style.backgroundImage = `url(${u})`;
  }
};

actions['me-edit'] = () => { resetOnboardStep(); go('#/onboarding?edit=1'); };
actions['me-lang'] = () => sheet(`<h2>${L('ภาษา','Language')}</h2>${Object.entries(LANGUAGES).map(([id,name])=>`<button class="btn ghost block" data-act="language-set" data-lang="${id}">${name}</button>`).join('')}`);
actions['language-set']=el=>{if(!LANGUAGES[el.dataset.lang])return;setState(s=>s.lang=el.dataset.lang);languageFont(getState().lang);rerender();};
actions['me-days'] = (el) => { setState((s) => (s.profile.planDays = Number(el.dataset.v))); rerender(); };
actions['me-restart'] = () => { if (confirm(L('เริ่มนับแผนใหม่ตั้งแต่วันนี้?', 'Restart the plan from today?'))) { setState((s) => (s.profile.startDate = todayISO())); rerender(); toast(L('เริ่มแผนใหม่แล้ว', 'Plan restarted')); } };
const gateExport = (fn) => {
  if (!canExport()) { toast(L('ดาวน์โหลดสำหรับผู้ซื้อแพ็กเกจ', 'Downloads need a purchase'), 'warn'); return go('#/pay'); }
  fn(getState().profile.planDays);
  useExport();
  rerender();
};
actions['me-pdf'] = () => gateExport(exportPDF);
actions['me-ics'] = () => gateExport(exportICS);
actions['me-backup'] = () => exportJSON();
actions['me-restore'] = async () => {
  const [f] = await pickFiles({ accept: 'application/json,.json' });
  if (!f) return;
  try {
    const obj = JSON.parse(await f.text());
    if (!obj.profile) throw new Error('invalid');
    delete obj.premium;
    importState(obj);
    toast(L('กู้คืนข้อมูลแล้ว', 'Backup restored'));
    rerender();
  } catch { toast(L('ไฟล์ไม่ถูกต้อง', 'Invalid file'), 'warn'); }
};
actions['me-reset'] = async () => {
  if (!confirm(L('ลบข้อมูลทั้งหมดในเครื่องนี้? (รวมรูปภาพ) ไม่สามารถกู้คืนได้', 'Delete all data on this device, including photos? This cannot be undone.'))) return;
  await resetAll();
  location.hash = '#/onboarding';
  location.reload();
};

actions['me-weight'] = () => {
  sheet(`<div class="sheet-head"><h2>${L('บันทึกน้ำหนัก', 'Log weight')}</h2><button class="icon-btn" data-close>${icon('x')}</button></div>
    <label class="field"><span>${L('น้ำหนัก (kg)', 'Weight (kg)')}</span><div class="input-wrap"><input id="w-kg" type="number" step="0.1" inputmode="decimal" value="${getState().profile.weight}"></div></label>
    <p class="muted sm">${L('ชั่งตอนเช้าหลังเข้าห้องน้ำ ก่อนทานอาหาร', 'Weigh in the morning after the bathroom, before eating')}</p>
    <button class="btn primary block" id="w-save">${L('บันทึก', 'Save')}</button>`, {
    onMount(root) {
      root.querySelector('#w-save').addEventListener('click', () => {
        const kg = Number(root.querySelector('#w-kg').value);
        if (!(kg > 25 && kg < 300)) return toast(L('น้ำหนักไม่ถูกต้อง', 'Invalid weight'), 'warn');
        setState((s) => {
          const t = todayISO();
          const last = s.weights.at(-1);
          if (last?.date === t) last.kg = kg; else s.weights.push({ date: t, kg });
          s.profile.weight = kg;
        });
        closeSheet(); rerender();
        toast(L('อัปเดตแผนตามน้ำหนักใหม่แล้ว', 'Plan updated for your new weight'));
      });
    },
  });
};

actions['me-photo'] = async () => {
  const [f] = await pickFiles({ accept: 'image/*' });
  if (!f) return;
  const id = 'body-' + uid();
  await putImage(id, await compressImage(f, 1280, 0.8));
  setState((s) => s.photos.push({ id, date: todayISO(), weight: s.profile.weight }));
  rerender();
  toast(L('บันทึกรูปแล้ว (เก็บในเครื่องเท่านั้น)', 'Photo saved (on this device only)'));
};
actions['me-photo-open'] = async (el) => {
  const ph = getState().photos.find((x) => x.id === el.dataset.id);
  const u = await imageURL(ph.id);
  sheet(`<div class="sheet-head"><h2>${dateLabel(ph.date, { day: 'numeric', month: 'long', year: 'numeric' })}</h2><button class="icon-btn" data-close>${icon('x')}</button></div>
    <img class="full-img" src="${u}" alt="">${ph.weight ? `<p class="muted center">${ph.weight} kg</p>` : ''}
    <button class="btn danger block" data-act="me-photo-del" data-id="${ph.id}">${icon('trash', 18)} ${L('ลบรูป', 'Delete photo')}</button>`);
};
actions['me-photo-del'] = (el) => {
  delImage(el.dataset.id).catch(() => {});
  setState((s) => (s.photos = s.photos.filter((x) => x.id !== el.dataset.id)));
  closeSheet(); rerender();
};
actions['me-compare'] = async () => {
  const ph = getState().photos;
  const a = ph[0], b = ph.at(-1);
  const [ua, ub] = await Promise.all([imageURL(a.id), imageURL(b.id)]);
  sheet(`<div class="sheet-head"><h2>${L('ก่อน / หลัง', 'Before / after')}</h2><button class="icon-btn" data-close>${icon('x')}</button></div>
    <div class="compare" id="cmp"><img src="${ub}" alt=""><div class="cmp-top" id="cmp-top"><img src="${ua}" alt=""></div><input type="range" min="0" max="100" value="50" id="cmp-r" aria-label="compare"></div>
    <div class="row between muted sm"><span>${dateLabel(a.date)}${a.weight ? ' · ' + a.weight + ' kg' : ''}</span><span>${dateLabel(b.date)}${b.weight ? ' · ' + b.weight + ' kg' : ''}</span></div>`, {
    onMount(root) {
      const r = root.querySelector('#cmp-r'), top = root.querySelector('#cmp-top');
      const upd = () => (top.style.clipPath = `inset(0 ${100 - r.value}% 0 0)`);
      r.addEventListener('input', upd); upd();
    },
  });
};
export { fmt, CONFIG };

actions['me-data']=()=>{const el=document.getElementById('me-data');el.open=true;el.scrollIntoView({behavior:'smooth'});};
