import { getState, todayISO, addDays } from './store.js';
import { L, dateLabel } from './ui.js';

export function parseHeartRate(value) {
  if (value.byteLength < 2) return null;
  const wide = value.getUint8(0) & 1;
  if (wide && value.byteLength < 3) return null;
  const bpm = wide ? value.getUint16(1, true) : value.getUint8(1);
  return bpm > 0 && bpm < 250 ? bpm : null;
}
export const hrZone = (bpm, age) => Math.max(1, Math.min(5, Math.floor((bpm / (220 - age) - .5) * 10) + 1));
export function hrCalories(bpm, minutes, p) {
  // Keytel et al. (2005), without VO2max; weight in kg, output converted kJ -> kcal.
  // https://doi.org/10.1080/02640410470001730089
  const perMin = p.sex === 'female'
    ? (-20.4022 + .4472 * bpm - .1263 * p.weight + .074 * p.age) / 4.184
    : (-55.0969 + .6309 * bpm + .1988 * p.weight + .2017 * p.age) / 4.184;
  return Math.max(0, Math.round(perMin * minutes));
}
export function exerciseHistory(id, before = '9999-12-31') {
  return Object.entries(getState().logs).filter(([iso,l]) => iso < before && l.sets?.some(s=>s.id===id))
    .sort(([a],[b])=>b.localeCompare(a)).slice(0,5).map(([iso,l])=>({iso,sets:l.sets.filter(s=>s.id===id)}));
}
export function historyHTML(id) {
  const sessions=exerciseHistory(id),last=sessions[0];
  const increase=last?.sets.length && last.sets.length >= (last.sets[0].totalSets || Infinity) && last.sets.every(s=>s.target && s.reps>=s.target);
  return `<h3>${L('ประวัติ 5 ครั้งล่าสุด','Last 5 sessions')}</h3>${sessions.map(h=>`<p><b>${dateLabel(h.iso)}</b><br>${h.sets.map(s=>`${s.kg} kg × ${s.reps}`).join(' · ')}</p>`).join('') || `<p class="muted">${L('ยังไม่มีบันทึกเซ็ต','No sets logged yet')}</p>`}${increase?`<p class="note">${L('เพิ่มน้ำหนัก 2.5 kg','Increase weight by 2.5 kg')}</p>`:''}`;
}
export function progressCard(weightTrend = '') {
  const logs=getState().logs,today=todayISO();
  const monday=addDays(today,-((new Date(today+'T00:00:00').getDay()+6)%7));
  const weeks=Array.from({length:8},(_,i)=>{const start=addDays(monday,(i-7)*7);return {start,count:Array.from({length:7},(_,j)=>logs[addDays(start,j)]?.done?.workout?1:0).reduce((a,b)=>a+b,0)};});
  let streak=0,date=logs[today]?.done?.workout?today:addDays(today,-1);
  while(logs[date]?.done?.workout){streak++;date=addDays(date,-1);}
  const minutes=Object.values(logs).reduce((n,l)=>n+(l.workout?.minutes||0),0);
  return `<section class="card"><h2>${L('สถิติ','Progress')}</h2><p>${L('ฝึกต่อเนื่อง','Current daily streak')}: ${streak} ${L('วัน','days')} · ${minutes} ${L('นาทีรวม','total minutes')}</p><p class="muted sm">${L('จำนวนครั้งต่อสัปดาห์ · 8 สัปดาห์ล่าสุด','Workouts per week · last 8 weeks')}</p><div class="progress-bars">${weeks.map(w=>`<div><b>${w.count}</b><i style="height:${w.count*12+2}px"></i><small>${dateLabel(w.start,{day:'numeric',month:'numeric'})}</small></div>`).join('')}</div><div class="row between"><h3>${L('แนวโน้มน้ำหนัก','Weight trend')}</h3><button class="btn xs ghost" data-act="me-weight">${L('บันทึกน้ำหนัก','Log weight')}</button></div>${weightTrend}</section>`;
}
