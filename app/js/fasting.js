import { medicalNoFasting } from './conditions.js';
import { noFasting } from './womens-health.js';
import { toMin, toHHMM, L, ring } from './ui.js';
export const FASTING = { 'none': 0, '12:12': 12, '14:10': 10, '16:8': 8, '18:6': 6, '20:4': 4, 'omad': 1 };
export function eatingWindow(p) {
  if((noFasting(p) || medicalNoFasting(p)))return null;
  const hours = Number(p.age) >= 18 ? FASTING[p.fasting] : 0;
  if (!hours) return null;
  const start = toMin(p.eatStart || '12:00');
  return { start, end: start + hours * 60, length: hours * 60 };
}
// The part of the eating window a person is actually awake for: from 30 min after waking to 3 h before bed
// (relaxed to 15 min / 2 h when that leaves nothing). Times are in the window's frame; ok=false means the window falls in sleep.
export function eatingRange(p, w = eatingWindow(p)) {
  if (!w) return null;
  const wake = toMin(p.wake || '07:00'); let bed = toMin(p.bed || '23:00'); if (bed <= wake) bed += 1440;
  for (const [after, before] of [[30, 180], [15, 120]]) {
    let best = null;
    for (const k of [-1, 0, 1]) {
      const lo = Math.max(w.start, wake + after + k * 1440), hi = Math.min(w.end - 30, bed - before + k * 1440);
      if (hi >= lo && (!best || hi - lo > best.hi - best.lo)) best = { lo, hi };
    }
    if (best) return { ...best, ok: true };
  }
  return { lo: w.start, hi: Math.max(w.start, w.end - 30), ok: false };
}
export const windowMinute = (min, w) => w.start + ((min - w.start) % 1440 + 1440) % 1440;
export const inWindow = (min, w) => windowMinute(min, w) < w.end;
export function fastingFields(p) {
  return `<h3>${L('การกินแบบ IF', 'Intermittent fasting')}</h3><p class="note">${L('ไม่เหมาะสำหรับผู้ตั้งครรภ์ ผู้เป็นเบาหวานที่ใช้ยา ผู้มีประวัติการกินผิดปกติ และผู้มีอายุต่ำกว่า 18 ปี', 'Not suitable during pregnancy, for diabetes on medication, a history of eating disorders, or under age 18.')}</p>
  <label class="field">${L('รูปแบบ IF', 'Fasting pattern')}<div class="input-wrap"><select data-bind="fasting" data-fasting ${p.age < 18 || (noFasting(p) || medicalNoFasting(p)) ? 'disabled' : ''}>${Object.entries(FASTING).map(([key,h]) => `<option value="${key}" ${p.fasting === key ? 'selected' : ''}>${key === 'none' ? L('ไม่ทำ IF', 'No fasting') : key === 'omad' ? L('OMAD: 1 มื้อใน 1 ชั่วโมง', 'OMAD: one meal in 1 hour') : `${key} · ${L('อด', 'Fast')} ${24-h} ${L('ชม. / กิน', 'h / eat')} ${h} h`}</option>`).join('')}</select></div></label>
  <div class="grid2"><label class="field">${L('เริ่มกินได้', 'Eating window starts')}<div class="input-wrap"><input type="time" data-bind="eatStart" data-eat-start value="${p.eatStart || '12:00'}" required></div></label>
  <label class="field">${L('เริ่ม IF (หยุดกิน)', 'Fasting starts (stop eating)')}<div class="input-wrap"><input type="time" data-fast-start value="${toHHMM(toMin(p.eatStart || '12:00') + (FASTING[p.fasting] || 8) * 60)}" required></div></label></div>
  <p class="note" data-fast-hint>${fastHint(p)}</p>`;
}
export function fastHint(p) {
  const w = eatingWindow(p), r = eatingRange(p, w);
  if (!w) return '';
  if (!r.ok) return L('⚠️ ช่วงกินตรงกับเวลานอน', '⚠️ Eating window is in your sleep time');
  const gym = windowMinute(toMin(p.workoutTime || '18:00'), w), len = Number(p.sessionMin) || 60;
  if ([gym, gym - 1440].some((a) => a - 45 <= r.lo && a + len + 30 >= r.hi)) return L('⚠️ ช่วงกินชนเวลาออกกำลังกาย', '⚠️ Eating window clashes with your workout');
  return L('จัดมื้อ','Meals')+` ${toHHMM(r.lo)}–${toHHMM(r.hi)}`;
}
// Either time can be edited; the sync code loads on the first change.
globalThis.document?.addEventListener('change', (e) => { if (e.target?.matches?.('[data-fast-start],[data-eat-start],[data-fasting]')) import('./fasting-sync.js').then((m) => m.sync(e.target, FASTING)); }, true);
export function fastingCard(p) {
  const w = eatingWindow(p); if (!w) return '';
  const now = new Date(), min = now.getHours()*60 + now.getMinutes();
  const at = windowMinute(min,w), eating = at < w.end;
  const left = (eating ? w.end : w.start+1440) - at;
  return `<section class="card row gap">${ring(1-left/(eating ? w.length : 1440-w.length), {label: '', sub: ''})}<div><b>${L('ช่วงกิน','Eating window')} ${toHHMM(w.start)}–${toHHMM(w.end)}</b><p>${eating ? L(`เหลือ ${toHHMM(left)} ชม. ก่อนปิดช่วงกิน`,`${toHHMM(left)} h until eating window closes`) : L(`อีก ${toHHMM(left)} ชม. เริ่มกินได้`,`${toHHMM(left)} h until eating starts`)}</p></div></section>`;
}
