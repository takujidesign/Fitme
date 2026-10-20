import { views, actions, go, route, rerender } from '../core.js';
import { getState, setState, todayISO, addDays } from '../store.js';
import { L, esc, icon, WEEKDAYS, dateLabel, toast } from '../ui.js';
import { trainingControls, toggleStyle, toggleEquipment } from '../training-controls.js';
import { mapSettings, inferredStyles, equipmentFor, setPreference, REGION_GROUP } from '../training.js';
import { allowed, sessionFor, splitName } from '../workout.js';
import { EX, EXERCISES, GROUPS } from '../exercises.js';
import { figureSVG } from '../figure.js';
import { loadLibrary, libraryAllowed } from '../exercise-library.js';
import { muscleMap, exerciseMuscles, REGIONS } from '../muscle-map.js';

let draft, search='', library=[], libraryOpen=false;
const startDraft=()=> {
  const p=structuredClone(getState().profile);
  return {...p,styles:p.styles||inferredStyles(p),equipment:equipmentFor(p),focusMuscles:p.focusMuscles?.length?p.focusMuscles:Object.keys(REGION_GROUP).filter(id=>p.focus?.includes(REGION_GROUP[id])),trainingConfigured:true};
};
window.addEventListener('hashchange',()=>{if(route().name!=='training-settings'){draft=null;search='';libraryOpen=false;}});
function candidates() {
  const p=mapSettings(draft);
  return [...EXERCISES,...Object.values(getState().libraryExercises||{}),...(libraryOpen?library:[])].filter((e,i,all)=>all.findIndex(x=>x.id===e.id)===i && libraryAllowed({...p,avoidEx:[]},e));
}
function picker() {
  const list=candidates().filter(e=>(L(e.name)+' '+e.name.en).toLowerCase().includes(search.toLowerCase()));
  return Object.entries(GROUPS).map(([group,label])=>{
    const rows=list.filter(e=>e.group===group);if(!rows.length)return '';
    return `<h3 class="sec">${L(label)}</h3>${rows.map(e=>{
      const value=draft.avoidEx.includes(e.id)?'avoid':draft.preferEx.includes(e.id)?'prefer':'normal';
      return `<div class="exercise-choice"><div class="choice-title"><div class="fig sm">${figureSVG(e)}</div><div><b>${esc(L(e.name))}</b><small>${esc(exerciseMuscles(e).map(id=>L(...REGIONS[id])).join(' · '))}</small></div></div><div class="seg" aria-label="${esc(L(e.name))}">${[['prefer','ชอบ','Prefer'],['normal','ปกติ','Normal'],['avoid','ไม่เอา','Avoid']].map(([v,th,en])=>`<button class="chip ${value===v?'on':''}" aria-pressed="${value===v}" data-act="ts-preference" data-id="${esc(e.id)}" data-value="${v}">${L(th,en)}</button>`).join('')}</div></div>`;
    }).join('')}`;
  }).join('')||`<p class="empty">${L('ไม่พบ','No results')}</p>`;
}
function withLibrary(p,fn) {
  const staged=library.filter(e=>p.preferEx.includes(e.id)).map(e=>[e.id,EX[e.id]]);
  for(const e of library)if(p.preferEx.includes(e.id))EX[e.id]=e;
  try{return fn();}finally{for(const [id,old] of staged)if(old)EX[id]=old;else delete EX[id];}
}
function preview() {
  const p=mapSettings(draft);
  return withLibrary(p,()=>Array.from({length:7},(_,i)=>{
    const iso=addDays(todayISO(),i),sess=sessionFor({...p,trainingHistory:undefined},iso);
    return `<li><b>${dateLabel(iso)}</b><span>${sess?.type==='train'?L(splitName(sess.split)):L('ฟื้นฟูร่างกาย','Active recovery')} · ${sess?.minutes||0} ${L('นาที','min')} · ${sess?.items.length||0} ${L('ท่า','moves')}</span></li>`;
  }).join(''));
}
views['training-settings']=()=>{
  draft ||= startDraft();
  return `<header class="top"><h1>${L('ตั้งค่าการฝึก','Training settings')}</h1><a class="icon-btn" href="#/workout" aria-label="${L('ปิด','Close')}">${icon('x')}</a></header>
    <section class="card">${trainingControls(draft)}
    <h3 class="sec">${L('วันต่อสัปดาห์','Days per week')}</h3><div class="chips">${[1,2,3,4,5,6,7].map(n=>`<button class="chip ${draft.trainDays.length===n?'on':''}" data-act="ts-count" data-n="${n}">${n}</button>`).join('')}</div>
    <div class="days">${WEEKDAYS().map((d,i)=>`<button class="chip ${draft.trainDays.includes(i)?'on':''}" aria-pressed="${draft.trainDays.includes(i)}" data-act="ts-day" data-n="${i}">${d}</button>`).join('')}</div>
    <h3 class="sec">${L('เวลาต่อครั้ง','Session length')}</h3><div class="chips">${[20,30,45,60].map(n=>`<button class="chip ${draft.sessionMin===n?'on':''}" data-act="ts-minutes" data-n="${n}">${n} ${L('นาที','min')}</button>`).join('')}</div>
    <h3 class="sec">${L('เน้นกล้ามเนื้อ','Focus muscles')}</h3>${muscleMap(Object.fromEntries(draft.focusMuscles.map(id=>[id,1])),L('เน้นกล้ามเนื้อ','Focus muscles'),'ts-muscle')}</section>
    <section class="card"><h2>${L('เลือกท่าออกกำลัง','Choose exercises')}</h2><label class="field">${L('ค้นหา','Search')}<input type="search" id="ts-search" value="${esc(search)}"></label><details ${libraryOpen?'open':''} id="ts-library"><summary>${L('เพิ่มจากคลังท่า','Add from exercise library')}</summary><button class="btn ghost block" data-act="ts-load">${L('โหลดคลังท่า','Load exercise library')}</button><p id="ts-library-status" role="status"></p></details><div id="ts-picker">${picker()}</div></section>
    <section class="card"><h2>${L('แผนสัปดาห์นี้','This week’s plan')}</h2><ul class="week-preview" id="ts-preview">${preview()}</ul></section>
    <div class="sticky-cta"><button class="btn primary block" data-act="ts-save">${L('บันทึกและปรับแผน','Save and update plan')}</button></div>`;
};
views['training-settings'].mount=root=>{
  root.querySelector('#ts-search').oninput=e=>{search=e.target.value;root.querySelector('#ts-picker').innerHTML=picker();};
};
actions['exercise-prefs']=()=>go('#/training-settings');
actions['ts-style']=el=>{toggleStyle(draft,el.dataset.id);rerender();};
actions['ts-equipment']=el=>{toggleEquipment(draft,el.dataset.id);rerender();};
actions['ts-count']=el=>{const n=Number(el.dataset.n),days=[...draft.trainDays];for(const day of [1,3,5,2,4,6,0])if(days.length<n&&!days.includes(day))days.push(day);draft.trainDays=days.slice(0,n).sort();rerender();};
actions['ts-day']=el=>{const n=Number(el.dataset.n),days=new Set(draft.trainDays);days.has(n)?days.delete(n):days.add(n);draft.trainDays=[...days].sort();rerender();};
actions['ts-minutes']=el=>{draft.sessionMin=Number(el.dataset.n);rerender();};
actions['ts-muscle']=el=>{const ids=new Set(draft.focusMuscles);ids.has(el.dataset.region)?ids.delete(el.dataset.region):ids.add(el.dataset.region);draft.focusMuscles=[...ids];rerender();};
actions['ts-preference']=el=>{
  setPreference(draft,el.dataset.id,el.dataset.value);
  document.getElementById('ts-picker').innerHTML=picker();
  document.getElementById('ts-preview').innerHTML=preview();
};
actions['ts-load']=async el=>{
  el.disabled=true;
  try{library=await loadLibrary();libraryOpen=true;if(route().name==='training-settings')rerender();}
  catch{const status=document.getElementById('ts-library-status');if(status)status.textContent=L('โหลดคลังท่าไม่ได้ ลองอีกครั้งเมื่อออนไลน์','Library unavailable. Retry when online.');}
  finally{el.disabled=false;}
};
actions['ts-save']=()=>{
  if(!draft.trainDays.length)return toast(L('เลือกวันฝึกอย่างน้อยหนึ่งวัน','Choose at least one training day'),'warn');
  const next=mapSettings(draft),from=todayISO();
  if(!withLibrary(next,()=>allowed(next).length))return toast(L('ไม่มีท่าที่อนุญาต กรุณาปรับตั้งค่าท่า','No allowed exercises. Adjust exercise preferences.'),'warn');
  setState(s=>{
    const previous=structuredClone(s.profile);delete previous.trainingHistory;
    const history=[...(s.profile.trainingHistory||[])];
    if(!history.some(h=>h.from===from))history.push({from,profile:previous});
    s.profile={...next,trainingHistory:history};
    for(const e of library)if(next.preferEx.includes(e.id))s.libraryExercises[e.id]=e;
    for(const date of Object.keys(s.exSwaps))if(date>=from)delete s.exSwaps[date];
  });
  draft=null;go('#/workout');
};
