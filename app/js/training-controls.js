import { L, icon } from './ui.js';
import { inferredStyles, equipmentFor } from './training.js';
export const STYLES = [
  ['gym','dumbbell','เวทในยิม','Gym weights','เครื่องและบาร์เบล','Machines and barbells'],
  ['dumbbell','dumbbell','ดัมเบลที่บ้าน','Home dumbbells','ฝึกแรงต้านด้วยดัมเบล','Resistance with dumbbells'],
  ['bodyweight','user','บอดี้เวท','Bodyweight','ใช้น้ำหนักตัว','Train with your own weight'],
  ['cardio','flame','เดิน / วิ่ง','Walk / run','เพิ่มความทนทาน','Build endurance'],
  ['hiit','clock','HIIT','HIIT','สลับช่วงหนักและพัก','Work and recovery intervals'],
  ['mobility','sun','โยคะ / ยืดเหยียด','Mobility / yoga','เคลื่อนไหวและยืดเบา ๆ','Gentle movement and stretching'],
];
export function trainingControls(p,prefix='ts') {
  return `<h3 class="sec">${L('รูปแบบการฝึก','Training style')}</h3><div class="style-grid">${STYLES.map(([id,ic,th,en,dt,de])=>`<button type="button" class="style-card ${(p.styles||inferredStyles(p)).includes(id)?'on':''}" aria-pressed="${(p.styles||inferredStyles(p)).includes(id)}" data-act="${prefix}-style" data-id="${id}">${icon(ic)}<b>${L(th,en)}</b><small>${L(dt,de)}</small></button>`).join('')}</div>
  <h3 class="sec">${L('อุปกรณ์ที่มี','Equipment available')}</h3><div class="chips">${[['none','น้ำหนักตัว','Bodyweight'],['db','ดัมเบล','Dumbbells'],['gym','อุปกรณ์ยิม','Gym equipment']].map(([id,th,en])=>`<button type="button" class="chip ${equipmentFor(p).includes(id)?'on':''}" aria-pressed="${equipmentFor(p).includes(id)}" data-act="${prefix}-equipment" data-id="${id}">${L(th,en)}</button>`).join('')}</div>`;
}
export function toggleStyle(p,id) {
  const values=new Set(p.styles||inferredStyles(p));values.has(id)?values.delete(id):values.add(id);
  if(!values.size)return;
  p.styles=[...values];p.trainingConfigured=true;
  p.equipment=['none',...(values.has('dumbbell')||values.has('gym')?['db']:[]),...(values.has('gym')?['gym']:[])];
  p.location=p.equipment.includes('gym')?'gym':p.equipment.includes('db')?'db':'home';
}
export function toggleEquipment(p,id) {
  const values=new Set(equipmentFor(p));values.has(id)?values.delete(id):values.add(id);
  if(!values.size)return;
  p.equipment=[...values];p.trainingConfigured=true;p.location=values.has('gym')?'gym':values.has('db')?'db':'home';
}
