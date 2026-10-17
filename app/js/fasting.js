import { toMin, toHHMM, L, ring } from './ui.js';
export const FASTING = { 'none': 0, '12:12': 12, '14:10': 10, '16:8': 8, '18:6': 6, '20:4': 4, 'omad': 1 };
export function eatingWindow(p) {
  const hours = Number(p.age) >= 18 ? FASTING[p.fasting] : 0;
  if (!hours) return null;
  const start = toMin(p.eatStart || '12:00');
  return { start, end: start + hours * 60, length: hours * 60 };
}
export const windowMinute = (min, w) => w.start + ((min - w.start) % 1440 + 1440) % 1440;
export const inWindow = (min, w) => windowMinute(min, w) < w.end;
export function fastingFields(p) {
  return `<h3>${L('การกินแบบ IF', 'Intermittent fasting')}</h3><p class="note">${L('ไม่เหมาะสำหรับผู้ตั้งครรภ์ ผู้เป็นเบาหวานที่ใช้ยา ผู้มีประวัติการกินผิดปกติ และผู้มีอายุต่ำกว่า 18 ปี', 'Not suitable during pregnancy, for diabetes on medication, a history of eating disorders, or under age 18.')}</p>
  <label class="field">${L('รูปแบบ IF', 'Fasting pattern')}<div class="input-wrap"><select data-bind="fasting" data-fasting ${p.age < 18 ? 'disabled' : ''}>${Object.entries(FASTING).map(([key,h]) => `<option value="${key}" ${p.fasting === key ? 'selected' : ''}>${key === 'none' ? L('ไม่ทำ IF', 'No fasting') : key === 'omad' ? L('OMAD: 1 มื้อใน 1 ชั่วโมง', 'OMAD: one meal in 1 hour') : `${key} · ${L('อด', 'Fast')} ${24-h} ${L('ชม. / กิน', 'h / eat')} ${h} h`}</option>`).join('')}</select></div></label>
  <label class="field">${L('เริ่มกินได้', 'Eating window starts')}<div class="input-wrap"><input type="time" data-bind="eatStart" data-eat-start value="${p.eatStart || '12:00'}" required></div></label>`;
}
export function fastingCard(p) {
  const w = eatingWindow(p); if (!w) return '';
  const now = new Date(), min = now.getHours()*60 + now.getMinutes();
  const at = windowMinute(min,w), eating = at < w.end;
  const left = (eating ? w.end : w.start+1440) - at;
  return `<section class="card row gap">${ring(1-left/(eating ? w.length : 1440-w.length), {label: toHHMM(left), sub: L('ชม. เหลือ', 'h left')})}<div><b>${eating ? L('ช่วงกิน', 'Eating window') : L('กำลัง IF', 'Fasting')}</b><p>${toHHMM(w.start)}–${toHHMM(w.end)} · ${p.fasting}</p><small>${eating ? L('ก่อนเริ่ม IF', 'Until fasting starts') : L('ถึงเวลากิน', 'Until eating starts')}</small></div></section>`;
}
