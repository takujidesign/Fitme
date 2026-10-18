import { actions, go, rerender } from '../core.js';
import { getState, setState, todayISO, addDays, diffDays } from '../store.js';
import { L, esc, icon, sheet, closeSheet, dateLabel, WEEKDAYS, toast } from '../ui.js';
import { EX, EXERCISES, GROUPS } from '../exercises.js';
import { allowed, sessionFor, isTrainingDay } from '../workout.js';
import { planDay } from '../day.js';
import { FOOD } from '../foods.js';
import { isLockedDay } from './workout.js';

const presets = { knees:['lunge','squat_jump','jump_rope','high_knees'], back:['deadlift','rdl','superman'], shoulders:['shoulder_press','lateral_raise','bench_press'], wrists:['pushup','mountain_climber','plank'] };
actions['exercise-prefs'] = () => {
  const p = getState().profile;
  sheet(`<div class="sheet-head"><h2>${L('ตั้งค่าท่า', 'Exercise preferences')}</h2><button class="icon-btn" data-close>${icon('x')}</button></div>
    <p class="note">${L('แตะท่าเพื่ออนุญาตหรือหลีกเลี่ยง เลือกท่าที่ชอบเพื่อให้แผนเลือกก่อน', 'Tap exercises to allow or avoid them. Preferred exercises are selected first.')}</p>
    <h3>${L('ท่าที่ไม่อยากทำ / มีอาการบาดเจ็บ', 'Avoid / injury exclusions')}</h3><div class="chips">${Object.keys(presets).map((k,i)=>`<button class="chip" data-act="avoid-preset" data-v="${k}">${[L('เข่า', 'Knees'),L('หลังล่าง', 'Lower back'),L('ไหล่', 'Shoulders'),L('ข้อมือ', 'Wrists')][i]}</button>`).join('')}</div>
    ${Object.entries(GROUPS).map(([g,label])=>`<h3>${L(label)}</h3><div class="chips">${EXERCISES.filter(e=>e.group===g).map(e=>`<button class="chip ${p.avoidEx.includes(e.id)?'':'on'}" data-act="avoid-ex" data-id="${e.id}" aria-pressed="${!p.avoidEx.includes(e.id)}">${p.avoidEx.includes(e.id)?'×':'✓'} ${L(e.name)}</button>`).join('')}</div>`).join('')}
    <h3>${L('ท่าที่ชอบ', 'Preferred exercises')}</h3><div class="chips">${EXERCISES.filter(e=>!p.avoidEx.includes(e.id)).map(e=>`<button class="chip ${p.preferEx.includes(e.id)?'on':''}" data-act="prefer-ex" data-id="${e.id}">${L(e.name)}</button>`).join('')}</div>`);
};
for (const [act,key] of [['avoid-ex','avoidEx'],['prefer-ex','preferEx']]) actions[act] = el => { setState(s=>{const a=new Set(s.profile[key]); a.has(el.dataset.id)?a.delete(el.dataset.id):a.add(el.dataset.id);s.profile[key]=[...a];});rerender();actions['exercise-prefs'](); };
actions['avoid-preset'] = el => {setState(s=>s.profile.avoidEx=[...new Set([...s.profile.avoidEx,...presets[el.dataset.v]])]);rerender();actions['exercise-prefs']();};
actions['exercise-swap'] = el => {
  const {iso,index}=el.dataset; if(isLockedDay(iso)) return;
  const item=sessionFor(getState().profile,iso)?.items[Number(index)];if(!item)return;
  sheet(`<h2>${L('เปลี่ยนท่า', 'Swap exercise')}</h2><div class="chips">${allowed(getState().profile).filter(e=>e.group===EX[item.id].group && e.id!==item.id).map(e=>`<button class="chip" data-act="swap-select" data-iso="${iso}" data-index="${index}" data-id="${e.id}">${L(e.name)}</button>`).join('') || L('ไม่มีท่าอื่นที่อนุญาต', 'No other allowed alternatives')}</div><button class="btn ghost" data-close>${L('ปิด', 'Close')}</button>`);
};
actions['swap-select'] = el => {setState(s=>{(s.exSwaps[el.dataset.iso] ||= {})[el.dataset.index]=el.dataset.id;});closeSheet();rerender();};
let month, selected;
actions.calendar = el => {selected=el.dataset.iso || todayISO();month=selected.slice(0,7)+'-01';showCalendar();};
function showCalendar() {
  const s=getState(), first=new Date(month+'T00:00:00'), count=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
  sheet(`<div class="sheet-head"><button class="icon-btn" data-act="calendar-month" data-n="-1" aria-label="${L('เดือนก่อน', 'Previous month')}">${icon('back')}</button><h2>${dateLabel(month,{month:'long',year:'numeric'})}</h2><button class="icon-btn" data-act="calendar-month" data-n="1" aria-label="${L('เดือนถัดไป', 'Next month')}">${icon('chev')}</button><button class="icon-btn" data-close>${icon('x')}</button></div>
    <p class="muted sm">${L('ฝึก • / พัก – / เสร็จ ✓ / วันหยุด ×','Train • / Rest – / Completed ✓ / Off ×')}</p><div class="calendar-grid">${WEEKDAYS().map(w=>`<small>${w}</small>`).join('')}${'<span></span>'.repeat(first.getDay())}${Array.from({length:count},(_,i)=>{const iso=addDays(month,i),off=s.dayOverrides[iso]==='off';return `<button class="chip ${iso===selected?'on':''}" data-act="calendar-day" data-iso="${iso}">${i+1}<small>${off?'×':s.logs[iso]?.done?.workout?'✓':isTrainingDay(s.profile,iso)?'•':'–'}</small></button>`;}).join('')}</div>
    <h3>${dateLabel(selected)}</h3><button class="btn primary" data-act="calendar-open">${L('เปิดแผนวันนี้', 'Open day plan')}</button><h3>${L('แก้ไขวันนี้', 'Edit this day')}</h3><div class="chips">${[['off',L('วันหยุด/ไม่สะดวก', 'Day off')],['train',L('วันออกกำลังกาย', 'Training day')],['normal',L('ปกติ', 'Normal')]].map(([v,t])=>`<button class="chip ${(s.dayOverrides[selected]||'normal')===v?'on':''}" data-act="day-override" data-v="${v}">${t}</button>`).join('')}</div>
    <h3>${L('ลาพักร้อน', 'Vacation')}</h3><div class="grid2"><label class="field">${L('เริ่ม', 'Start')}<div class="input-wrap"><input type="date" id="off-start" value="${selected}"></div></label><label class="field">${L('สิ้นสุด', 'End')}<div class="input-wrap"><input type="date" id="off-end" value="${selected}"></div></label></div><button class="btn ghost" data-act="vacation">${L('กำหนดวันหยุด', 'Set days off')}</button>`);
}
actions['calendar-month']=el=>{const d=new Date(month+'T00:00:00');d.setMonth(d.getMonth()+Number(el.dataset.n));month=todayISO(d);showCalendar();};
actions['calendar-day']=el=>{selected=el.dataset.iso;closeSheet();go('#/workout/'+selected);};
actions['calendar-open']=()=>{closeSheet();go('#/workout/'+selected);};
actions['day-override']=el=>{setState(s=>{if(el.dataset.v==='normal')delete s.dayOverrides[selected];else s.dayOverrides[selected]=el.dataset.v;});rerender();showCalendar();};
actions.vacation=()=>{const start=document.getElementById('off-start').value,end=document.getElementById('off-end').value;const n=diffDays(start,end);if(!start||!end||n<0||n>3660)return toast(L('เลือกช่วงวันที่ไม่เกิน 10 ปี', 'Choose a date range up to 10 years'),'warn');setState(s=>{for(let i=0;i<=n;i++)s.dayOverrides[addDays(start,i)]='off';});rerender();showCalendar();};

export function shoppingItems(start) {
  const totals={};let days=0;
  for(let i=0;i<7;i++){const iso=addDays(start,i);if(isLockedDay(iso)||diffDays(getState().profile.startDate,iso)<0)continue;days++;for(const m of planDay(iso).meals)for(const item of m.items)totals[item.id]=(totals[item.id]||0)+item.g;}
  return {days,items:Object.entries(totals).map(([id,g])=>({id,g,food:FOOD[id]})).sort((a,b)=>a.food.cat.localeCompare(b.food.cat))};
}
let shoppingText='';
actions.shopping=el=>{
 const {days,items}=shoppingItems(el.dataset.iso||todayISO());const cats={protein:L('โปรตีน', 'Protein'),carb:L('คาร์บ', 'Carbs'),veg:L('ผัก', 'Vegetables'),fruit:L('ผลไม้', 'Fruit'),fat:L('ไขมัน', 'Fats'),dairyp:L('นม/โปรตีน', 'Dairy / protein')};
 shoppingText=`Fixmee · ${days} ${L('วัน', 'days')}\n`+items.map(x=>`${L(x.food)} ${x.g} g`).join('\n');
 sheet(`<div class="sheet-head"><h2>${L('รายการซื้อของ', 'Shopping list')}</h2><button class="icon-btn" data-close>${icon('x')}</button></div><p class="note">${L(`รวม ${days} วันที่เปิดดูได้ · น้ำหนักอาหารตามแผน (สุกตามรายการอาหาร)`,`Includes ${days} unlocked days · planned food weights (cooked where specified)`)}</p>${[...new Set(items.map(x=>x.food.cat))].map(cat=>`<h3>${cats[cat]||cat}</h3>${items.filter(x=>x.food.cat===cat).map(x=>`<label class="shopping-row"><input type="checkbox" data-shopping="${x.id}" ${getState().shoppingChecks[x.id]?'checked':''}>${esc(L(x.food))}<b>${x.g} g</b></label>`).join('')}`).join('')}<button class="btn primary" data-act="shopping-share">${L('แชร์ / คัดลอก', 'Share / copy')}</button><textarea class="copy-text" readonly>${esc(shoppingText)}</textarea>`,{onMount(root){root.querySelectorAll('[data-shopping]').forEach(el=>el.addEventListener('change',()=>setState(s=>s.shoppingChecks[el.dataset.shopping]=el.checked)));}});
};
actions['shopping-share']=async()=>{try{if(navigator.share)await navigator.share({text:shoppingText});else{await navigator.clipboard.writeText(shoppingText);toast(L('คัดลอกแล้ว', 'Copied'));}}catch(e){if(e.name!=='AbortError')toast(L('เลือกข้อความด้านล่างเพื่อคัดลอก', 'Select the text below to copy'));}};
