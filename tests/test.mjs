// Run: node tests/test.mjs (no dependencies, network, or paid APIs).
import assert from 'node:assert/strict';
const saved = new Map([['fitme:v1', JSON.stringify({onboarded:true,lang:'en',profile:{name:'Existing user',startDate:'2026-10-12',trainDays:[1,3,5]}})]]);
globalThis.localStorage = {getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};
const {getState,setState,importState,addDays}=await import('../app/js/store.js');
const {sessionFor,isTrainingDay,allowed}=await import('../app/js/workout.js');
const {EXERCISES,EX}=await import('../app/js/exercises.js');
const {mealSlots}=await import('../app/js/meals.js');
const {eatingWindow,inWindow}=await import('../app/js/fasting.js');
const {planDay}=await import('../app/js/day.js');
const {parseHeartRate,hrCalories}=await import('../app/js/progress.js');
const s=getState(),p=s.profile;
assert.equal(p.name,'Existing user');assert.deepEqual(p.avoidEx,[]);assert.equal(p.eatStart,'12:00');assert.deepEqual(s.exSwaps,{});
const base=structuredClone(p);
for(const location of ['home','db','gym'])for(const level of ['beginner','intermediate','advanced']) {
 Object.assign(p,base,{location,level,avoidEx:['jumping_jack','forward_fold','child_pose','walk','squat','deadlift','lunge','mountain_climber']});
 for(let i=0;i<14;i++)for(const it of sessionFor(p,addDays(p.startDate,i)).items)assert(!p.avoidEx.includes(it.id),`${it.id} excluded in all phases`);
}
p.avoidEx=EXERCISES.map(e=>e.id);assert.equal(sessionFor(p,p.startDate).items.length,0);
Object.assign(p,base,{location:'gym',level:'advanced',preferEx:['lunge']});assert(sessionFor(p,p.startDate).items.some(it=>it.id==='lunge'));
const iso=p.startDate,original=sessionFor(p,iso),index=2,item=original.items[index];
const alternate=allowed(p).find(e=>e.group===EX[item.id].group&&e.id!==item.id);
s.exSwaps[iso]={[index]:alternate.id};assert.equal(sessionFor(p,iso).items[index].id,alternate.id);
p.avoidEx=[alternate.id];assert.notEqual(sessionFor(p,iso).items[index].id,alternate.id);p.avoidEx=[];s.exSwaps={};
s.dayOverrides[iso]='off';assert.equal(isTrainingDay(p,iso),false);assert.equal(sessionFor(p,iso),null);assert.equal(sessionFor(p,addDays(iso,2)).split,original.split);
s.dayOverrides[addDays(iso,1)]='train';assert.equal(isTrainingDay(p,addDays(iso,1)),true);assert.equal(sessionFor(p,addDays(iso,1)).split,original.split);assert.equal(planDay(iso).train,false);s.dayOverrides={};
for(const pattern of ['12:12','14:10','16:8','18:6','20:4','omad'])for(const start of ['00:00','12:00','22:30'])for(const workout of ['06:00','18:00','23:30']) {
 Object.assign(p,{fasting:pattern,eatStart:start,workoutTime:workout,mealsPerDay:6});const w=eatingWindow(p),meals=mealSlots(p,true);
 assert(meals.every(m=>m.min>=w.start&&m.min<w.end));assert(meals.length<=({'16:8':3,'18:6':3,'20:4':2,omad:1}[pattern]||6));
 assert(Math.abs(meals.reduce((n,m)=>n+m.share,0)-1)<1e-6);
}
Object.assign(p,{fasting:'16:8',eatStart:'12:00',workoutTime:'17:00',sessionMin:45});assert(mealSlots(p,true).some(m=>m.post&&m.time==='17:45'));
p.age=17;assert.equal(eatingWindow(p),null);p.age=30;
s.supplements=[{uid:'whey',productId:'vx_isopro',startDate:iso},{uid:'creatine',productId:'vx_creatine',startDate:iso}];
const day=planDay(iso),w=eatingWindow(p),supps=day.events.filter(e=>e.type==='supp');
assert(day.events.some(e=>e.type==='fasting'&&e.eating));assert(supps.some(e=>e.list.some(x=>x.uid==='whey')));
for(const e of supps)if(e.list.some(x=>x.prod.nutrition?.k>0||x.prod.nutrition?.p>0)||['breakfast','lunch','dinner'].includes(e.slot))assert(inWindow(e.min,w));
assert(supps.some(e=>e.slot==='morning'&&!inWindow(e.min,w)&&e.list.every(x=>!x.prod.nutrition.k)));
assert.equal(new Set(day.events.map(e=>e.key)).size,day.events.length);
assert.equal(parseHeartRate(new DataView(Uint8Array.from([0,135]).buffer)),135);
assert.equal(parseHeartRate(new DataView(Uint8Array.from([1,180,0]).buffer)),180);
assert.equal(parseHeartRate(new DataView(Uint8Array.from([1,180]).buffer)),null);
assert(hrCalories(140,30,p)>0);assert(hrCalories(140,30,{...p,sex:'female'})>0);
const {printHTML,exportICS}=await import('../app/js/export.js');
assert(printHTML(1).includes('Eating window starts'));assert(printHTML(1).includes('Fasting starts'));
let exportBlob;const create=URL.createObjectURL;URL.createObjectURL=blob=>(exportBlob=blob,'blob:test');
globalThis.document={createElement:()=>({click(){},remove(){}}),body:{appendChild(){}}};
exportICS(1);const calendar=await exportBlob.text();URL.createObjectURL=create;
assert(calendar.includes('X-WR-CALNAME:Fix me'));assert(calendar.includes('SUMMARY:Eating window starts'));assert(calendar.includes('SUMMARY:Fasting starts'));
const {readFileSync,existsSync}=await import('node:fs');const shell=readFileSync(new URL('../app/sw.js',import.meta.url),'utf8');
assert(shell.includes("const VERSION = 'fitme-v1';"));
for(const file of ['js/fasting.js','js/progress.js','js/views/planning.js']){assert(shell.includes(`'./${file}'`));assert(existsSync(new URL('../app/'+file,import.meta.url)));}
importState({profile:{name:'Old backup'},logs:{}});assert.equal(getState().profile.fasting,'none');assert.deepEqual(getState().shoppingChecks,{});
console.log('PASS old-state load/import, avoidance across all phases/equipment/levels, preferences, safe swaps, override rotation, every IF window including midnight/under-18, supplement relocation, BLE flags/HR calories, PDF/ICS fasting boundaries and offline shell.');
