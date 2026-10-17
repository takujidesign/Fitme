import { views, actions, rerender } from '../core.js';
import { getState, setState, subscribe, todayISO, updateLog } from '../store.js';
import { L, esc, toast } from '../ui.js';
import { CHALLENGES, BADGES, challengeProgress, earnedBadges } from '../challenges.js';
export function badgeGrid() {
 const s=getState(),earned=new Set([...s.badges,...earnedBadges(s)]);
 return `<section class="card"><h2>${L('เหรียญรางวัล','Badges')}</h2><div class="badge-grid">${BADGES.map(b=>`<div class="badge ${earned.has(b.id)?'unlocked':'locked'}" title="${esc(L(b))}"><span aria-hidden="true">${earned.has(b.id)?'★':'☆'}</span><small>${L(b)}</small></div>`).join('')}</div><a class="btn ghost block" href="#/challenges">${L('ชาเลนจ์ 30 วัน','30-day challenges')}</a></section>`;
}
views.challenges=()=>{
 const s=getState(),health=Object.values(s.logs).some(l=>Number.isFinite(l.health?.steps));
 return `<header class="top"><h1>${L('ชาเลนจ์','Challenges')}</h1></header><p class="muted">${L('มีวันพักสตรีค 1 วัน เติมใหม่ทุก 10 วัน วันพักไม่นับเป็นวันที่ทำสำเร็จ','One streak freeze per 10-day period. Frozen days do not count as completed.')}</p>${CHALLENGES.filter(c=>c.id!=='steps'||health).map(c=>{const join=s.challenges.find(j=>j.id===c.id),p=join&&challengeProgress(join,s);return `<section class="card"><h2>${L(c)}</h2>${p?`<p>${p.completed}/${p.total} · ${L('ต่อเนื่อง','Streak')} ${p.streak} · ❄ ${p.freeze}</p><div class="challenge-checks">${p.checks.map(d=>`<span title="${esc(d.date)}">${d.ok?'✓':d.frozen?'❄':'·'}<small>${d.date.slice(8)}</small></span>`).join('')}</div>${c.id==='fasting'?`<button class="btn ghost" data-act="challenge-if">${L('ยืนยันทำ IF 16:8 วันนี้ครบแล้ว','Confirm today’s 16:8 completed')}</button>`:''}`:`<button class="btn primary" data-act="challenge-join" data-id="${c.id}">${L('เข้าร่วม','Join')}</button>`}</section>`;}).join('')}`;
};
actions['challenge-join']=el=>{if(!CHALLENGES.some(c=>c.id===el.dataset.id))return;setState(s=>{if(!s.challenges.some(c=>c.id===el.dataset.id))s.challenges.push({id:el.dataset.id,startDate:todayISO()});});rerender();};
actions['challenge-if']=()=>{if(getState().profile.age<18||getState().profile.fasting!=='16:8')return toast(L('ต้องตั้ง IF 16:8 ก่อน','Set a 16:8 plan first'),'warn');updateLog(todayISO(),l=>{l.fasting={pattern:'16:8',completed:true};});rerender();};
let awarding=false;
subscribe(s=>{if(awarding)return;const fresh=earnedBadges(s).filter(id=>!s.badges.includes(id));if(!fresh.length)return;awarding=true;setState(s=>{s.badges.push(...fresh);});awarding=false;toast(L('ปลดล็อกรางวัล: ','Badge unlocked: ')+fresh.map(id=>L(BADGES.find(b=>b.id===id))).join(', '));const el=document.createElement('div');el.className='badge-confetti';el.textContent='✦ ★ ✦ ★ ✦';document.body.appendChild(el);setTimeout(()=>el.remove(),1800);});
