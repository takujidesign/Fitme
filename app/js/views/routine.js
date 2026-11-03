import {getState,setState,todayISO,uid} from '../store.js';
import {sheet,closeSheet,esc,toast,toHHMM,toMin,L} from '../ui.js';
import {rerender} from '../core.js';
import {planDay} from '../day.js';
import {resizeMeals,resizeRoutine,mealCount,validTime} from '../routine-plan.js';
import {R} from '../routine-sheet-copy.js';

const input=(key,label,value,type='time')=>`<label class="field">${esc(label)}<div class="input-wrap"><input data-r="${key}" type="${type}" value="${esc(value??'')}"></div></label>`;
const name=e=>e.type==='meal'?R('meal')+' '+(Number(e.meal.key.slice(1))+1):e.type==='activity'?e.activity.label:e.type==='supp'?L(e.slotInfo):(e.type==='medication'?e.medication.name:e.type==='note'?R(e.note):R(({wake:'wake',sleep:'bed',workout:'workout',suggestion:'snack',water:'water',fasting:e.eating?'eatStart':'fastStart'})[e.type]));
export function warningHTML(d) {
 return (d.warnings||[]).map(w=>{const event=d.events.find(e=>e.key===w.key),label=event?name(event):R('meal')+' '+(Number(w.key.slice(6))+1);return `<p class="note" role="status">⚠ ${esc(label)}: ${R(w.code+'Warning')} <button type="button" class="btn xs ghost" data-fix="${w.key}">${R('fix')}</button></p>`;}).join('');
}
export function showRoutine(iso=todayISO()) {
 const p=structuredClone(getState().profile);p.routine||={meals:resizeMeals([],mealCount(p)),activities:[],weekend:null};resizeRoutine(p);
 const routine=p.routine;
 routine.activities||=[];
 if(routine.weekend)routine.weekend.meals||=resizeMeals(routine.meals,mealCount(p));
 const rows=(meals,prefix)=>meals.map((m,i)=>`<div class="grid2"><label class="field">${R('meal')} ${i+1}<div class="input-wrap"><select data-mode="${prefix}:${i}"><option value="auto" ${!m.time?'selected':''}>${R('automatic')}</option><option value="fixed" ${m.time?'selected':''}>${R('fixed')}</option></select></div></label>${input(prefix+':'+i,R('fixed'),m.time||'', 'time')}</div>`).join('');
 const render=()=>sheet(`<div class="sheet-head"><h2>${R('title')}</h2><button class="icon-btn" data-close aria-label="${R('cancel')}">×</button></div><form id="routine-form">
 <div class="grid2">${input('wake',R('wake'),p.wake)}${input('bed',R('bed'),p.bed)}</div>${input('workoutTime',R('workout'),p.workoutTime)}
 <label class="field">${R('meals')}<div class="input-wrap"><select id="routine-count">${[1,2,3,4,5,6].map(n=>`<option ${mealCount(p)===n?'selected':''}>${n}</option>`).join('')}</select></div></label>
 ${rows(routine.meals,'meal')}<label class="field"><input type="checkbox" id="routine-snack" ${routine.postWorkoutSnack!==false?'checked':''}>${R('snack')}</label>
 <h3>${R('activities')}</h3>${routine.activities.map((a,i)=>`<fieldset><legend>${esc(a.label||R('activities'))}</legend>${input('a:'+i+':label',R('label'),a.label,'text')}<div class="grid2">${input('a:'+i+':start',R('start'),a.start)}${input('a:'+i+':end',R('end'),a.end)}</div><div class="chips">${R('days').map((d,day)=>`<label><input type="checkbox" data-day="${i}:${day}" ${a.days.includes(day)?'checked':''}>${d}</label>`).join('')}</div><div class="input-wrap"><select data-kind="${i}" aria-label="${R('busy')} / ${R('free')}"><option value="busy" ${a.kind==='busy'?'selected':''}>${R('busy')}</option><option value="free" ${a.kind==='free'?'selected':''}>${R('free')}</option></select></div><button type="button" class="btn ghost" data-remove="${i}">${R('remove')}</button></fieldset>`).join('')}
 <button type="button" class="btn ghost" id="routine-add">${R('add')}</button><p><label><input type="checkbox" id="routine-weekend" ${routine.weekend?'checked':''}>${R('weekend')}</label></p>
 ${routine.weekend?`<div class="grid2">${input('weekend:wake',R('wake'),routine.weekend.wake||'')}${input('weekend:bed',R('bed'),routine.weekend.bed||'')}</div>${rows(routine.weekend.meals,'weekmeal')}`:''}
 <h3>${R('preview')}</h3><div id="routine-preview"></div><p id="routine-error" role="alert"></p><button type="submit" class="btn primary block">${R('save')}</button><button type="button" class="btn ghost" data-close>${R('cancel')}</button></form>`,{onMount(root){
 const preview=()=>{const d=planDay(iso,p),fast=d.impliedFast;root.querySelector('#routine-preview').innerHTML=warningHTML(d)+(fast?`<p>${R('fast')} ${Math.floor(fast.minutes/60)} ${R('hours')} ${fast.minutes%60} ${R('minutes')} (${fast.start} → ${fast.end})</p>${fast.mismatch?`<p class="note">${R('mismatch')}</p><button type="button" class="btn ghost" id="routine-if">${R('update')}</button>`:''}`:'')+`<ol>${d.events.map(e=>`<li>${e.time} ${e.fixed?'📌 ':''}${esc(name(e))}</li>`).join('')}</ol>`;
 root.querySelectorAll('[data-fix]').forEach(b=>b.onclick=()=>{makeAutomatic(p,b.dataset.fix);render();});
 const update=root.querySelector('#routine-if');if(update)update.onclick=()=>{p.eatStart=fast.end;if(fast.pattern)p.fasting=fast.pattern;preview();};};
 root.querySelectorAll('[data-r]').forEach(el=>el.oninput=()=>{const k=el.dataset.r.split(':');
 if(k[0]==='meal'||k[0]==='weekmeal'){const meals=k[0]==='meal'?routine.meals:routine.weekend.meals;meals[+k[1]].time=validTime(el.value)?el.value:null;root.querySelector(`[data-mode="${el.dataset.r}"]`).value=el.value?'fixed':'auto';}
 else if(k[0]==='a')routine.activities[+k[1]][k[2]]=el.value;
 else if(k[0]==='weekend'){if(el.value)routine.weekend[k[1]]=el.value;else delete routine.weekend[k[1]];}
 else {p[k[0]]=el.value;if(k[0]==='workoutTime')routine.workoutAutomatic=false;}preview();});
 root.querySelectorAll('[data-mode]').forEach(el=>el.onchange=()=>{const [prefix,i]=el.dataset.mode.split(':'),meals=prefix==='meal'?routine.meals:routine.weekend.meals;meals[+i].time=el.value==='auto'?null:(meals[+i].time||'12:00');render();});
 root.querySelector('#routine-count').onchange=e=>{p.mealsPerDay=+e.target.value;resizeRoutine(p);render();};
 root.querySelector('#routine-snack').onchange=e=>{routine.postWorkoutSnack=e.target.checked;preview();};
 root.querySelector('#routine-add').onclick=()=>{routine.activities.push({id:uid(),label:'',start:'09:00',end:'17:00',days:[1,2,3,4,5],kind:'busy'});render();};
 root.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{routine.activities.splice(+el.dataset.remove,1);render();});
 root.querySelectorAll('[data-kind]').forEach(el=>el.onchange=()=>{routine.activities[+el.dataset.kind].kind=el.value;preview();});
 root.querySelectorAll('[data-day]').forEach(el=>el.onchange=()=>{const [i,day]=el.dataset.day.split(':').map(Number),days=new Set(routine.activities[i].days);el.checked?days.add(day):days.delete(day);routine.activities[i].days=[...days].sort();preview();});
 root.querySelector('#routine-weekend').onchange=e=>{routine.weekend=e.target.checked?{meals:resizeMeals(routine.meals,mealCount(p))}:null;render();};
 root.querySelector('form').onsubmit=e=>{e.preventDefault();if(!['wake','bed','workoutTime'].every(k=>validTime(p[k]))||routine.activities.some(a=>!a.label.trim()||!validTime(a.start)||!validTime(a.end))){root.querySelector('#routine-error').textContent=R('invalid');return;}
 setState(s=>{for(const k of ['wake','bed','workoutTime','mealsPerDay','routine','fasting','eatStart'])s.profile[k]=p[k];});closeSheet();rerender();toast(R('unchanged'));};preview();
 }});render();
}

export function showTimeChange(iso,key) {
 const before=planDay(iso),event=before.events.find(e=>e.key===key);if(!event)return;
 sheet(`<h2>${R('today')}</h2><p>${esc(name(event))}</p>${input('time',R('fixed'),event.time)}<button class="btn primary block" id="time-today">${R('today')}</button><button class="btn ghost block" id="time-daily">${R('daily')}</button>${key==='workout'?`<a class="btn ghost" href="#/workout/${iso}" data-close>${R('workout')}</a>`:''}`,{onMount(root){
 const save=daily=>{const time=root.querySelector('[data-r="time"]').value;if(!validTime(time))return;
 setState(s=>{if(!daily){(s.logs[iso]||={done:{},water:0}).timeOverrides||={};s.logs[iso].timeOverrides[key]=time;}
 else{const p=s.profile;p.routine||={meals:resizeMeals([],mealCount(p)),activities:[],weekend:null};
 if(key.startsWith('meal-m')){const i=+key.slice(6);p.routine.meals[i]={time};if(p.routine.weekend?.meals)p.routine.weekend.meals[i]={time};}
 else if(key==='workout'){p.workoutTime=time;p.routine.workoutAutomatic=false;}
 else {const a=p.routine.activities.find(a=>'activity-'+a.id===key);if(a){a.end=toHHMM(toMin(time)+(toMin(a.end)-toMin(a.start)+1440)%1440);a.start=time;}}
 if(s.logs[iso]?.timeOverrides)delete s.logs[iso].timeOverrides[key];}});
 const after=planDay(iso),moved=after.events.filter(e=>e.key!==key&&before.events.some(b=>b.key===e.key&&b.min!==e.min));
 closeSheet();rerender();toast(moved.length?R('moved')+': '+moved.map(e=>name(e)+' → '+e.time).join(', '):R('unchanged'));
 };root.querySelector('#time-today').onclick=()=>save(false);root.querySelector('#time-daily').onclick=()=>save(true);
 }});
}

export function fixToday(iso,key){setState(s=>{const log=s.logs[iso]||={done:{},water:0};log.timeOverrides||={};log.timeOverrides[key]=null;});rerender();toast(R('automatic'));}

export function mountSummary(root,iso) {
 const d=planDay(iso),fast=d.impliedFast;
 root.innerHTML=(fast?`<p class="note">${R('fast')} ${Math.floor(fast.minutes/60)} ${R('hours')} ${fast.minutes%60} ${R('minutes')} (${fast.start} → ${fast.end})${fast.mismatch?`<button class="btn ghost" data-act="routine" data-iso="${iso}">${R('mismatch')} · ${R('update')}</button>`:''}</p>`:'')+warningHTML(d);
 root.querySelectorAll('[data-fix]').forEach(b=>b.onclick=()=>fixToday(iso,b.dataset.fix));
}

export function makeAutomatic(p,key) {
  if(!p.routine)p.routine={meals:resizeMeals([],mealCount(p)),activities:[],weekend:null};
  if(key.startsWith('meal-m')){const i=Number(key.slice(6));p.routine.meals[i]={time:null};if(p.routine.weekend?.meals)p.routine.weekend.meals[i]={time:null};}
  if(key==='workout') {p.workoutTime=toHHMM(toMin(p.wake)+60);p.routine.workoutAutomatic=true;}
}
