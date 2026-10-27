import {featureUsed} from './telemetry.js';
import { measurementsPrint } from './measurements.js';
// Plan export: printable PDF view, calendar (.ics) reminders and JSON backup.
import { getState } from './store.js';
import { planRange } from './day.js';
import { EX } from './exercises.js';
import { FOOD } from './foods.js';
import { splitName } from './workout.js';
import { mealKind, unitText } from './meals.js';
import { GOALS, bmi, sleepNeed, bedtimes, targets } from './calc.js';
import { L, esc, fmt, dateLabel, toHHMM, toMin } from './ui.js';
import { figureSVG } from './figure.js';

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

const exLine = (it) => {
  const ex = EX[it.id];
  return `${L(ex.name)} — ${it.sets}×${it.reps ? it.reps + ' ' + L('ครั้ง', 'reps') : fmtSec(it.sec)}${it.rest ? ` · ${L('พัก', 'rest')} ${it.rest}s` : ''}`;
};
export const fmtSec = (s) => (s >= 60 ? `${Math.round(s / 60)} ${L('นาที', 'min')}` : `${s} ${L('วินาที', 'sec')}`);

export function printHTML(days) {
  const s = getState(), p = s.profile;
  const plan = planRange(days);
  const first = plan[0];
  const lang = s.lang;
  const usedEx = [...new Set(plan.flatMap((d) => d.sess?.items.map((i) => i.id) || []))];
  const [sMin, sMax] = sleepNeed(p.age);
  return `<div class="print-doc">
  <header class="pd-head"><div><h1>Fixmee ${L('แผนสุขภาพส่วนตัว', 'Personal plan')}</h1>
  <p>${esc(p.name || '')} · ${p.age} ${L('ปี', 'y')} · ${p.height} cm · ${p.weight} kg · BMI ${bmi(p).toFixed(1)} · ${L(GOALS[p.goal])}</p>
  <p>${dateLabel(plan[0].iso, { day: 'numeric', month: 'long', year: 'numeric' })} – ${dateLabel(plan.at(-1).iso, { day: 'numeric', month: 'long', year: 'numeric' })} (${days} ${L('วัน', 'days')})</p></div></header>
  ${measurementsPrint()}<section class="pd-grid">
    <div><h3>${L('พลังงาน วันฝึก / วันพัก', 'kcal train / rest')}</h3><b>${fmt(targets(p, true).kcal)} / ${fmt(targets(p, false).kcal)}</b><small>BMR ${fmt(first.t.bmr)} · TDEE ${fmt(first.t.tdee)}</small></div>
    <div><h3>${L('โปรตีน', 'Protein')}</h3><b>${first.t.protein} g</b></div>
    <div><h3>${L('คาร์บ / ไขมัน', 'Carbs / fat')}</h3><b>${first.t.carbs} / ${first.t.fat} g</b></div>
    <div><h3>${L('น้ำ', 'Water')}</h3><b>${(first.t.water / 1000).toFixed(1)} L</b></div>
    <div><h3>${L('การนอน', 'Sleep')}</h3><b>${sMin}-${sMax} ${L('ชม.', 'h')}</b><small>${L('เข้านอน', 'Bed')} ${bedtimes(p.wake).map((b) => b.time).slice(0, 2).join(' / ')}</small></div>
  </section>
  <h2>${L('ท่าออกกำลังกายในแผน', 'Exercises in your plan')}</h2>
  <div class="pd-ex">${usedEx.map((id) => `<div class="pd-exi">${figureSVG(EX[id])}<b>${L(EX[id].name)}</b><small>${L(EX[id].cues).join(' · ')}</small></div>`).join('')}</div>
  ${plan.map((d) => `<section class="pd-day">
    <h2>${dateLabel(d.iso, { weekday: 'long', day: 'numeric', month: 'long' })} — ${d.train ? L(splitName(d.sess.split)) : `<em>${L('วันพักฟื้น', 'Recovery day')}</em>`} · ${fmt(d.t.kcal)} kcal</h2>
    <table><thead><tr><th>${L('เวลา', 'Time')}</th><th>${L('กิจกรรม', 'Activity')}</th></tr></thead><tbody>
    ${d.events.map((e) => `<tr><td>${e.time}</td><td>${eventText(e, lang)}</td></tr>`).join('')}
    </tbody></table>
    <p class="pd-sum">${L('รวมจากอาหาร', 'Food total')}: ${fmt(d.foodTotal.k)} kcal · P ${d.foodTotal.p} · C ${d.foodTotal.c} · F ${d.foodTotal.f} g${d.sm.kcal ? ` + ${L('อาหารเสริม', 'supplements')} ${d.sm.kcal} kcal / P ${d.sm.protein} g` : ''}</p>
  </section>`).join('')}
  <footer class="pd-foot">Fixmee · ${L('ข้อมูลนี้เป็นคำแนะนำทั่วไป ไม่ใช่คำวินิจฉัยทางการแพทย์ ปรึกษาแพทย์ก่อนเริ่มโปรแกรมหากมีโรคประจำตัว ปฏิบัติตามฉลากอาหารเสริมเสมอ', 'General guidance only, not medical advice. Consult a doctor before starting if you have a medical condition. Always follow supplement labels.')}</footer>
  </div>`;
}

function eventText(e, lang) {
  if (e.type === 'fasting') return e.eating ? L('เริ่มกินได้', 'Eating window starts') : L('เริ่ม IF', 'Fasting starts');
  if (e.type === 'meal') {
    const m = e.meal;
    return `<b>${L(mealKind(m.kind))}</b>: ${esc(L(m.name))}<br><small>${m.items.map((it) => `${esc(L({ th: FOOD[it.id].th, en: FOOD[it.id].en }))} ${it.g}g ${esc(unitText(FOOD[it.id], it.g, lang))}`).join(', ')} — ${m.total.k} kcal, P${m.total.p} C${m.total.c} F${m.total.f}</small>`;
  }
  if (e.type === 'workout') return `<b>${L('ออกกำลังกาย', 'Workout')} (${e.sess.minutes} ${L('นาที', 'min')}, ~${e.kcal} kcal)</b><br><small>${e.sess.items.map(exLine).join('<br>')}</small>`;
  if (e.type === 'supp') return `<b>${L(e.slotInfo)}</b>: ${e.list.map((x) => `${L(x.prod.name)} ${x.amount} ${L(x.prod.unit)}`).join(', ')}`;
  if (e.type === 'water') return L(`ดื่มน้ำ ${e.ml} มล.`, `Drink ${e.ml} ml water`);
  if(e.type === 'medication') return esc(e.medication.name)+' · '+esc(e.medication.dose)+' · '+esc(L({th:{with:'พร้อมอาหาร',without:'ท้องว่าง',any:'ตามคำสั่งแพทย์'}[e.medication.food],en:{with:'With food',without:'Without food',any:'As prescribed'}[e.medication.food]}));
  if (e.type === 'wake') return L('ตื่นนอน', 'Wake up');
  if (e.type === 'sleep') return L('เข้านอน', 'Lights out');
  if (e.note === 'caffeine') return L('งดกาแฟ/ชา/เครื่องดื่มชูกำลังหลังเวลานี้', 'No caffeine after this time');
  if (e.note === 'screens') return L('ปิดหน้าจอ หรี่ไฟ เตรียมนอน', 'Screens off, dim the lights');
  return '';
}

export function exportPDF(days) {
  const host = document.getElementById('print-root');
  host.innerHTML = printHTML(days);
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); host.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 300);
}

// ---------- ICS ----------
const icsDate = (iso, min) => {
  const d = new Date(iso + 'T00:00:00');
  d.setMinutes(min);
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}T${z(d.getHours())}${z(d.getMinutes())}00`;
};
const icsEsc = (s) => String(s).replace(/<[^>]+>/g, ' ').replace(/[,;\\]/g, (c) => '\\' + c).replace(/\n/g, '\\n').replace(/\s+/g, ' ').trim();

export function exportICS(days) {
  const plan = planRange(days);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fixmee//Plan//TH', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Fixmee'];
  let n = 0;
  for (const d of plan) {
    for (const e of d.events) {
      if (!['meal', 'workout', 'supp', 'sleep', 'fasting', 'medication'].includes(e.type)) continue;
      const dur = e.type === 'workout' ? e.sess.minutes : 15;
      const title = e.type === 'medication' ? e.medication.name : e.type === 'fasting' ? eventText(e, getState().lang) : e.type === 'meal' ? `🍽 ${L(mealKind(e.meal.kind))}` : e.type === 'workout' ? `💪 ${L('ออกกำลังกาย', 'Workout')}` : e.type === 'supp' ? `💊 ${L(e.slotInfo)}` : `🌙 ${L('เข้านอน', 'Bedtime')}`;
      lines.push('BEGIN:VEVENT', `UID:fixmee-${d.iso}-${n++}@fixmee.app`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, `DTSTART:${icsDate(d.iso, e.min)}`, `DTEND:${icsDate(d.iso, e.min + dur)}`,
        `SUMMARY:${icsEsc(title)}`, `DESCRIPTION:${icsEsc(eventText(e, getState().lang))}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT5M', `DESCRIPTION:${icsEsc(title)}`, 'END:VALARM', 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  download(`fixmee-plan-${plan[0].iso}.ics`, lines.join('\r\n'), 'text/calendar');
}

export async function exportJSON() {featureUsed('backup_export');
  const s = await (await import('./backup.js')).fullBackup();
  if(!confirm(L('สำรองรวมรูปในเครื่อง ไฟล์อาจมีขนาดใหญ่: ','Backup includes local photos and may be large: ')+Math.ceil(JSON.stringify(s).length/1024)+' KB'))return;
  delete s.premium;
  download(`fixmee-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(s, null, 2), 'application/json');
}
export { toHHMM, toMin };
