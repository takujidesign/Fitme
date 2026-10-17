import { views, actions, rerender } from '../core.js';
import { getState, setState, todayISO } from '../store.js';
import { blockDue, blockSummary, blockProfile, proposeReplan } from '../replan.js';
import { L, esc } from '../ui.js';
export function replanCard(){return blockDue(getState())?`<a class="card block" href="#/replan">${L('สรุป 4 สัปดาห์ · ทบทวนแผนใหม่','4-week summary · Review your next plan')}</a>`:'';}
views.replan=()=>{
 const s=getState(),r=blockSummary(s),p=blockProfile(s),proposal=proposeReplan(p,r),num=v=>v===null?'—':v.toFixed(1);
 return `<header class="top"><h1>${L('สรุป 4 สัปดาห์','4-week summary')}</h1></header><section class="card"><p>${esc(r.start)} – ${esc(r.end)}</p><p>${L('น้ำหนักเปลี่ยน / คาดการณ์','Weight change / expected')}: ${num(r.weightChange)} / ${num(r.expected)} kg</p><p>${L('ทำตามแคลอรีเฉลี่ย','Average calorie adherence')}: ${num(r.kcalAdherence===null?null:r.kcalAdherence*100)}%</p><p>${L('ออกกำลัง','Workouts')}: ${r.workouts}/${r.scheduled}</p><p>${L('นอนเฉลี่ย','Average sleep')}: ${num(r.sleep)} h</p><h3>${L('พัฒนาการเซ็ตหนักสุด (ประมาณ 1RM)','Top-set progress (estimated 1RM)')}</h3>${r.lifts.map(l=>`<p>${esc(l.id)}: ${num(l.first)} → ${num(l.last)} kg</p>`).join('')||'—'}</section><section class="card"><h2>${L('ข้อเสนอแผนถัดไป','Proposed next plan')}</h2>${Object.entries(proposal.changes).map(([k,v])=>`<p>${esc(k)}: ${esc(JSON.stringify(p[k]??(k==='calorieFactor'?1:0)))} → ${esc(JSON.stringify(v))}</p>`).join('')||`<p>${L('คงค่าปัจจุบัน','Keep current settings')}</p>`}${proposal.notes.includes('recovery')?`<p class="note">${L('นอนน้อยกว่า 6.5 ชม. เพิ่มเวลาพักและลด 1 เซ็ต','Sleep is below 6.5 hours. Prioritize recovery and reduce volume by one set.')}</p>`:''}${proposal.notes.includes('adherence')?`<p>${L('ทำตามแผนน้อยกว่า 60% ลองลดเวลาหรือวันฝึก','Adherence is below 60%. Try a shorter or less frequent session.')}</p>`:''}<button class="btn primary" data-act="replan-apply" ${blockDue(s)?'':'disabled'}>${L('ใช้แผนใหม่','Apply new plan')}</button><button class="btn ghost" data-act="replan-keep" ${blockDue(s)?'':'disabled'}>${L('คงแผนเดิม','Keep current plan')}</button></section>`;
};
for(const choice of ['apply','keep'])actions['replan-'+choice]=()=>{
 const s=getState();if(!blockDue(s))return;const p=blockProfile(s),r=blockSummary(s),proposal=proposeReplan(p,r);
 setState(s=>{
  const {blockStart,...before}=p;
  if(!s.blocks.length)s.blocks.push({startDate:s.profile.startDate,adjustments:{},profileSnapshot:before});
  else s.blocks.at(-1).profileSnapshot=before;
  const changes=choice==='apply'?proposal.changes:{};
  Object.assign(s.profile,changes);
  s.blocks.push({startDate:todayISO(),adjustments:changes,profileSnapshot:{...s.profile},report:r,accepted:choice==='apply'});
 });rerender();
};
