import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
const window=new Window({url:'http://local/#/today'});
for(const k of ['window','document','localStorage','sessionStorage','navigator','location','history','Event','FormData'])Object.defineProperty(globalThis,k,{configurable:true,value:k==='window'?window:window[k]});
globalThis.requestAnimationFrame=()=>1;globalThis.fetch=async()=>{throw Error('No network');};
const {getState,setState,addDays}=await import('../app/js/store.js');
const {planDay}=await import('../app/js/day.js');
const {routineProfile,resizeRoutine,inBusy}=await import('../app/js/routine-plan.js');
const {makeAutomatic}=await import('../app/js/views/routine.js');
const {reminderPlan}=await import('../app/js/reminders.js');
const iso='2026-11-02';
const legacy=JSON.parse(await readFile(new URL('./fixtures/round23-legacy.json',import.meta.url),'utf8'));
for(const f of legacy){setState(s=>{s.profile=structuredClone(f.profile);s.logs={};s.supplements=structuredClone(f.supplements||[]);});assert.equal(JSON.stringify(planDay(iso)),JSON.stringify(f.plan),'Legacy byte identity');}
const base={...structuredClone(getState().profile),wake:'05:30',bed:'21:30',workoutTime:'17:30',sessionMin:45,fasting:'none',mealsPerDay:2,trainDays:[0,1,2,3,4,5,6],startDate:iso,routine:{meals:[{time:'08:10'},{time:'16:30'}],activities:[],weekend:null}};
const reset=changes=>setState(s=>{s.profile=structuredClone({...base,...changes});s.logs={};s.supplements=[];});
reset();let d=planDay(iso);assert.deepEqual(d.meals.map(m=>m.time),['08:10','16:30']);assert.deepEqual(d.warnings,[]);assert(d.events.find(e=>e.key==='post-snack').min>=18*60+15);assert(d.events.find(e=>e.key==='post-snack').min<=19*60+30);
reset({fasting:'16:8'});d=planDay(iso);assert.deepEqual(d.meals.map(m=>m.time),['08:10','16:30']);assert.equal(d.impliedFast.minutes,940);assert(d.impliedFast.mismatch);assert.deepEqual(d.warnings,[]);
reset({mealsPerDay:4,routine:{meals:[{time:'07:00'},{time:null},{time:null},{time:null}],activities:[]}});d=planDay(iso);assert.equal(d.meals.length,4);assert.equal(d.meals[0].time,'07:00');for(let i=1;i<4;i++)assert(d.meals[i].min-d.meals[i-1].min>=90);assert.deepEqual(d.warnings,[]);
const busy={id:'work',label:'Work',start:'09:00',end:'17:00',days:[1,2,3,4,5],kind:'busy'};
reset({routine:{meals:[{time:null},{time:null}],activities:[busy]},medications:[{id:'med',name:'Rx',times:['12:00'],food:'any',dose:'1'}]});d=planDay(iso);assert(d.meals.every(m=>!inBusy(m.min,d.routineProfile)));assert(d.events.some(e=>e.type==='medication'&&e.time==='12:00'));
reset({routine:{...base.routine,weekend:{wake:'07:30',bed:'23:00',meals:[{time:'09:00'},{time:'17:00'}]}}});assert.equal(planDay('2026-11-07').events.find(e=>e.key==='wake').time,'07:30');assert.equal(planDay(iso).meals[0].time,'08:10');
reset();setState(s=>s.logs[iso]={done:{},timeOverrides:{'meal-m0':'09:00',workout:'18:00'}});assert.equal(planDay(iso).meals[0].time,'09:00');assert.equal(planDay(addDays(iso,1)).meals[0].time,'08:10');assert.equal(planDay(iso).events.find(e=>e.key==='workout').time,'18:00');
const reminders=reminderPlan(iso,{meals:true,workout:true},1,true);assert(reminders.some(r=>r.eventKey==='meal-m0'&&r.time==='09:00'));assert(reminders.some(r=>r.eventKey==='workout'&&r.time==='18:00'));
for(const [code,changes] of [ ['wake',{routine:{meals:[{time:'05:35'},{time:'16:30'}]}}],['bed',{routine:{meals:[{time:'08:10'},{time:'21:00'}]}}],['spacing',{routine:{meals:[{time:'08:10'},{time:'08:30'}]}}],['workout',{routine:{meals:[{time:'08:10'},{time:'17:30'}]}}],['busy',{routine:{meals:[{time:'10:00'},{time:'18:00'}],activities:[busy]}}],['if',{fasting:'16:8',mealsPerDay:3,routine:{meals:[{time:null},{time:'08:00'},{time:null}]}}],['sleep',{workoutTime:'03:00'}]]){
 reset(changes);d=planDay(iso);assert(d.warnings.some(w=>w.code===code),code);const warning=d.warnings.find(w=>w.code===code);setState(s=>makeAutomatic(s.profile,warning.key));assert(!planDay(iso).warnings.some(w=>w.code===code&&w.key===warning.key),'fix '+code);
}
reset();setState(s=>{s.profile.routine.meals=[{time:null},{time:'16:30'}];s.profile.mealsPerDay=1;resizeRoutine(s.profile);});assert.equal(getState().profile.routine.meals[0].time,'16:30');
// Food-bound supplement uses the final meal, not the old default offset.
reset();setState(s=>s.supplements=[{uid:'breakfast',productId:'vistra_bcomplex',startDate:iso},{uid:'dinner',productId:'amarit_collagen',startDate:iso}]);
let supplements=planDay(iso).events.filter(e=>e.type==='supp');assert.equal(supplements.find(e=>e.slot==='breakfast').time,'08:10');assert.equal(supplements.find(e=>e.slot==='dinner').time,'16:30');
reset({routine:{meals:[{time:null},{time:null}],activities:[busy]}});setState(s=>s.supplements=[{uid:'lunch',productId:'vistra_astaxanthin',startDate:iso}]);d=planDay(iso);assert(d.events.filter(e=>e.type==='supp').every(e=>!inBusy(e.min,d.routineProfile)));
const {showRoutine,showTimeChange}=await import('../app/js/views/routine.js');
reset();const before=JSON.stringify(getState().profile);showRoutine(iso);const time=document.querySelector('[data-r="meal:0"]');time.value='09:00';time.dispatchEvent(new Event('input'));assert.equal(JSON.stringify(getState().profile),before);assert(document.querySelector('#routine-preview').textContent.includes('09:00'));document.querySelector('#routine-form').dispatchEvent(new Event('submit',{cancelable:true}));assert.equal(getState().profile.routine.meals[0].time,'09:00');
showTimeChange(iso,'meal-m0');document.querySelector('[data-r="time"]').value='09:30';document.querySelector('#time-today').click();assert.equal(planDay(iso).meals[0].time,'09:30');assert.equal(planDay(addDays(iso,1)).meals[0].time,'09:00');
for(const lang of ['th','en','zh','ja','vi']){setState(s=>s.lang=lang);showRoutine(iso);assert(!/undefined|\?{3}/.test(document.querySelector('.sheet').textContent));}
reset({mealsPerDay:1,routine:undefined});assert.equal(planDay(iso).meals.length,1);
reset({routine:undefined});assert.equal(planDay(iso).meals.length,2);
reset({routine:{...base.routine,postWorkoutSnack:false}});assert(!planDay(iso).events.some(e=>e.key==='post-snack'));
reset({wake:'14:00',bed:'06:00',workoutTime:'20:30',fasting:'16:8',eatStart:'02:00',routine:{meals:[{time:null},{time:null}],activities:[]}});
d=planDay(iso);assert(d.meals.length>0);assert(d.meals.every(m=>m.min>=1560&&m.min<=1620));assert(!d.warnings.some(w=>w.code==='if'));
reset({routine:{...base.routine,activities:[busy],weekend:{wake:'07:00',bed:'23:00'}}});
showRoutine('2026-11-07');assert(document.querySelector('[data-r="weekend:wake"]'));
showTimeChange(iso,'activity-work');document.querySelector('[data-r="time"]').value='10:00';document.querySelector('#time-today').click();
assert.equal(planDay(iso).events.find(e=>e.key==='activity-work').time,'10:00');assert.equal(planDay('2026-11-03').events.find(e=>e.key==='activity-work').time,'09:00');
showTimeChange(iso,'meal-m0');document.querySelector('[data-r="time"]').value='09:45';document.querySelector('#time-daily').click();assert.equal(planDay('2026-11-03').meals[0].time,'09:45');
const {fixToday}=await import('../app/js/views/routine.js');fixToday(iso,'meal-m0');assert.equal(getState().logs[iso].timeOverrides['meal-m0'],null);assert(!planDay(iso).meals.find(m=>m.key==='m0')?.fixed);assert.equal(planDay('2026-11-03').meals[0].time,'09:45');
reset({routine:{...base.routine,weekend:{wake:'07:00',bed:'23:00',meals:[{time:'09:00'},{time:'17:00'}]}}});assert(reminderPlan('2026-11-07',{wake:true,sleep:true},1,true).some(r=>r.category==='wake'&&r.time==='07:00'));
const {copy}=await import('../app/js/routine-sheet-copy.js');for(const [key,values] of Object.entries(copy)){assert.equal(values.length,5,key);for(const value of values)assert(!/\?{3}|undefined/.test(String(value)),key);}
console.log('PASS Round 23: 20 legacy byte fixtures, anchors, IF, overnight, spacing, busy blocks, weekends, meal/workout/activity day overrides, warning fixes, reminders, snack toggle, draft/save, daily save and five languages');
await window.happyDOM.abort();
