// Timeline sanity across many profiles: meals inside waking hours and the eating window, not too close to bedtime, and in a sensible order.
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
const window=new Window({url:'http://localhost/#/today'});
for(const k of ['window','document','localStorage','sessionStorage','navigator','location','history','FormData','Event','MutationObserver','indexedDB'])Object.defineProperty(globalThis,k,{configurable:true,value:k==='window'?window:window[k]});
globalThis.requestAnimationFrame=()=>1;globalThis.fetch=async()=>{throw Error('Unmocked network');};
const {setState,getState,todayISO,addDays}=await import('../app/js/store.js');
const {planDay}=await import('../app/js/day.js');
const {eatingWindow,eatingRange,windowMinute,fastingFields}=await import('../app/js/fasting.js');
const {toMin}=await import('../app/js/ui.js');
const iso=todayISO(),problems=[];
const sleeps=[['06:00','22:00'],['07:00','23:00'],['05:30','21:30'],['09:00','01:00'],['14:00','06:00']];
const starts=['06:00','08:00','10:00','12:00','14:00','18:00'];
const workouts=['06:30','12:00','17:30','20:30'];
let runs=0,asleep=0;
for(const [wake,bed] of sleeps)for(const fasting of ['none','12:12','14:10','16:8','18:6','20:4','omad'])for(const eatStart of fasting==='none'?['12:00']:starts)for(const workoutTime of workouts)for(const mealsPerDay of [3,5]){
 setState(s=>Object.assign(s.profile,{age:30,wake,bed,fasting,eatStart,workoutTime,mealsPerDay,sessionMin:60,startDate:iso,medical:{enabled:false},medications:[]}));
 const p=getState().profile,w=eatingWindow(p);
 for(let day=0;day<7;day++){const d=planDay(addDays(iso,day));runs++;
 if(w&&fastingFields(p).includes('⚠️ Eating window clashes')){asleep++;continue;}
 if(w&&!eatingRange(p,w).ok){asleep++;assert(fastingFields(p).includes('⚠️'),`${wake}-${bed} ${fasting} ${eatStart}: no warning`);continue;}
 const wk=toMin(wake);if(((toMin(workoutTime)-wk)%1440+1440)%1440+60>((toMin(bed)-wk)%1440+1440)%1440)continue;
 // (a gym time set inside sleep is the user's own setting)
let bd=toMin(bed);if(bd<=wk)bd+=1440;
 const rel=m=>((m-wk)%1440+1440)%1440; // minutes after waking
 const tag=`${wake}-${bed} ${fasting} eat ${eatStart} gym ${workoutTime} x${mealsPerDay}`;
 const meals=d.events.filter(e=>e.type==='meal');
 for(const m of meals){
  if(rel(m.min)<20)problems.push(`${tag}: meal ${m.time} before/at wake`);
  if(rel(m.min)>bd-wk-120)problems.push(`${tag}: meal ${m.time} within 2h of bed`);
  if(w&&windowMinute(m.min,w)>=w.end)problems.push(`${tag}: meal ${m.time} outside eating window`);
 }
 const gym=d.events.find(e=>e.type==='workout');if(gym&&d.train)for(const m of meals){const at=rel(m.min)-rel(gym.min);if(at>=0&&at<60)problems.push(`${tag}: meal ${m.time} during workout ${gym.time}`);}
 for(const e of d.events)if(!['fasting','medication','sleep'].includes(e.type)&&(rel(e.min)>bd-wk))problems.push(`${tag}: ${e.type} ${e.time} after bedtime`);
 if(d.train&&gym&&rel(gym.min)+60>bd-wk)problems.push(`${tag}: workout ${gym.time} runs past bedtime`);
 const times=meals.map(m=>rel(m.min));for(let i=1;i<times.length;i++)if(times[i]-times[i-1]<60)problems.push(`${tag}: meals ${meals[i-1].time} and ${meals[i].time} under 1h apart`);
 const es=d.events.find(e=>e.key==='eat-start'),first=meals[0];if(es&&first&&d.events.indexOf(first)<d.events.indexOf(es)&&first.min===es.min)problems.push(`${tag}: meal listed before eating window opens`);
}}
const uniq=[...new Set(problems.map(x=>x.replace(/^\S+ \S+ eat \S+ gym \S+ x\d: /,'').replace(/\d\d:\d\d/g,'HH:MM')))];
if(process.argv.includes('--report')){console.log(runs,'plans,',problems.length,'problems');for(const u of uniq)console.log(' -',u,'×',problems.filter(x=>x.replace(/\d\d:\d\d/g,'HH:MM').endsWith(u)).length);console.log(problems.slice(0,15).join('\n'));}
assert.equal(problems.length,0,problems.slice(0,10).join('\n'));
// The two IF times stay in sync and the fasting-start field saves through eatStart.
setState(s=>Object.assign(s.profile,{fasting:'14:10',eatStart:'12:00',wake:'05:30',bed:'21:30'}));
const host=document.createElement('main');host.innerHTML=fastingFields(getState().profile);document.body.append(host);
const eat=host.querySelector('[data-eat-start]'),fast=host.querySelector('[data-fast-start]');assert.equal(fast.value,'22:00');
host.querySelector('[data-fasting]').value='14:10';// happy-dom ignores the selected attribute
let saved;eat.addEventListener('change',()=>saved=eat.value);fast.value='19:00';fast.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,50));assert.equal(eat.value,'09:00');assert.equal(saved,'09:00');
// The reported case: 05:30–21:30 sleep, 14:10 from 12:00 used to put dinner at 21:30, on top of bedtime.
const meals=planDay(iso).meals.map(m=>m.time);assert(meals.every(t=>t<='18:30'),meals.join());
console.log('PASS timeline audit:',runs,'plans,',asleep,'plans with a warned window (inside sleep or workout)');
