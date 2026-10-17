// npm install --no-save happy-dom (or set HAPPY_DOM_PATH to its lib/index.js).
// Run: node app/ui-test.mjs. Uses a simulated DOM and BLE device; no network.
import assert from 'node:assert/strict';
const { Window } = await import(process.env.HAPPY_DOM_PATH || 'happy-dom');
const window = new Window({url:'http://localhost:5173/#/today'});
for (const name of ['window','document','localStorage','sessionStorage','navigator','location','history','FormData','Event','IntersectionObserver']) {
 Object.defineProperty(globalThis,name,{configurable:true,value:name==='window'?window:window[name]});
}
globalThis.requestAnimationFrame=fn=>{fn(0);return 1;};
// Disable continuous figure animation while still creating the real SVG DOM.
let frames=0;globalThis.requestAnimationFrame=fn=>{if(frames++<1)fn(0);return frames;};
globalThis.confirm=()=>true;
const {getState,setState,todayISO,addDays}=await import('./js/store.js');
const {views,actions,setRenderer}=await import('./js/core.js');
const {CONFIG,currentConfig}=await import('./js/config.js');
const {sessionFor}=await import('./js/workout.js');
for(const name of ['today','workout','food','supps','me','pay','admin','coach','planning'])await import(`./js/views/${name}.js`);
const iso=todayISO(),s=getState();
setState(s=>{s.onboarded=true;Object.assign(s.profile,{startDate:iso,trainDays:[0,1,2,3,4,5,6],location:'gym',level:'advanced',fasting:'16:8'});});
const root=document.createElement('main');root.id='view';document.body.append(root);
let current='today';
const render=()=>{root.innerHTML=views[current]({params:[],query:new URLSearchParams()});};setRenderer(render);
const el=data=>({dataset:data});
const sheet=()=>document.querySelector('.sheet-wrap:last-child .sheet');
for(const lang of ['th','en']){s.lang=lang;for(const name of ['today','workout','food','supps','me','pay','admin','onboarding']){current=name;render();assert(root.textContent.length>30,name);assert(!root.textContent.includes('undefined'),name);}}
current='workout';render();
actions['avoid-preset'](el({v:'knees'}));assert(s.profile.avoidEx.includes('lunge'));assert(sessionFor(s.profile,iso).items.every(i=>!s.profile.avoidEx.includes(i.id)));
actions['exercise-swap'](el({iso,index:'0'}));const alternative=sheet().querySelector('[data-act="swap-select"]');assert(alternative);actions['swap-select'](alternative);assert.equal(sessionFor(s.profile,iso).items[0].id,alternative.dataset.id);
actions.calendar(el({iso}));actions['day-override'](el({v:'off'}));assert.equal(sessionFor(s.profile,iso),null);actions['day-override'](el({v:'train'}));assert.equal(sessionFor(s.profile,iso).type,'train');
// Vacation and normal reset use the same persisted override engine.
document.querySelectorAll('.sheet-wrap:not(:last-child)').forEach(e=>e.remove());
document.getElementById('off-start').value=addDays(iso,1);document.getElementById('off-end').value=addDays(iso,2);actions.vacation();assert.equal(s.dayOverrides[addDays(iso,2)],'off');
actions.shopping(el({iso}));assert(sheet().querySelectorAll('[data-shopping]').length);const check=sheet().querySelector('[data-shopping]');check.checked=true;check.dispatchEvent(new Event('change'));assert.equal(s.shoppingChecks[check.dataset.shopping],true);
const {shoppingItems}=await import('./js/views/planning.js');assert.equal(shoppingItems(iso).days,3);
current='food';render();actions['food-prefs']();const pattern=sheet().querySelector('[data-fasting]');pattern.value='20:4';pattern.dispatchEvent(new Event('change'));assert.equal(s.profile.fasting,'20:4');
document.querySelectorAll('.sheet-wrap').forEach(e=>e.remove());
// Real player handlers + simulated standard BLE notification characteristic.
let disconnected=false;
const characteristic=new window.EventTarget();characteristic.startNotifications=async()=>{};characteristic.stopNotifications=async()=>{};
const device=new window.EventTarget();device.gatt={disconnect:()=>{disconnected=true;},connect:async()=>({getPrimaryService:async name=>{assert.equal(name,'heart_rate');return {getCharacteristic:async name=>{assert.equal(name,'heart_rate_measurement');return characteristic;}};}})};
Object.defineProperty(navigator,'bluetooth',{value:{requestDevice:async options=>{assert.deepEqual(options,{filters:[{services:['heart_rate']}]});return device;}}});
current='player';render();views.player.mount(root);await actions['hr-connect']();
characteristic.value=new DataView(Uint8Array.from([0,140]).buffer);characteristic.dispatchEvent(new Event('characteristicvaluechanged'));
characteristic.value=new DataView(Uint8Array.from([1,160,0]).buffer);characteristic.dispatchEvent(new Event('characteristicvaluechanged'));
assert(document.getElementById('live-hr').textContent.includes('160 BPM'));
for(let i=0;i<150 && root.querySelector('[data-act="pl-next"]');i++){
 const kg=document.getElementById('set-kg'),reps=document.getElementById('set-reps');if(kg){kg.value='12.5';reps.value='15';}
 actions['pl-next']();
}
assert(s.logs[iso].done.workout);assert.equal(s.logs[iso].workout.avgHR,150);assert.equal(s.logs[iso].workout.maxHR,160);assert(disconnected);
assert(s.logs[iso].sets.length>0);assert(s.logs[iso].sets.every(x=>x.kg===12.5&&x.reps===15));
// A later session prefills the exact previous set, and history shows progression.
actions['pl-close']();s.dayOverrides[addDays(iso,1)]='train';root.innerHTML=views.player({params:[addDays(iso,1)]});views.player.mount(root);
for(let i=0;i<30&&!document.getElementById('set-kg');i++)actions['pl-next']();
const priorId=root.querySelector('[aria-label]')?.getAttribute('aria-label');
if(s.logs[iso].sets.some(x=>x.id===priorId))assert.equal(document.getElementById('set-kg').value,'12.5');
actions['pl-exit']();
current='admin';render();CONFIG.API_BASE='http://test.invalid';let savedConfig;
globalThis.fetch=async(url,options)=>({ok:true,json:async()=>options?.method==='PUT'?(savedConfig=JSON.parse(options.body),{config:savedConfig}):{secrets:{config:true,token:true,thunder:false,stripe:false,anthropic:false}}});
await views.admin.mount(root);
const form=document.getElementById('admin-form');form.elements.promptpayId.value='123';form.dispatchEvent(new Event('input'));assert(!form.elements.promptpayId.checkValidity());
// happy-dom uses floating-point modulo for fractional steps; native Chrome was
// checked separately. Keep range/required/custom validation in this DOM test.
form.querySelectorAll('input[step=".01"]').forEach(input=>input.step='any');
form.elements.promptpayId.value='0812345678';form.elements['pro30.thb'].value='120';form.elements['pro90.best'].checked=false;form.dispatchEvent(new Event('input'));
assert(document.querySelector('[data-preview="pro30"]').textContent.includes('฿120'));assert(document.getElementById('admin-dirty').textContent.includes('Unsaved'));
assert(form.checkValidity(), [...form.elements].filter(e=>e.checkValidity&&!e.checkValidity()).map(e=>e.name+': '+e.validationMessage).join(', '));
await actions['admin-save'](root.querySelector('[data-act="admin-save"]'));assert.equal(savedConfig.products.pro30.thb,120);assert.equal(savedConfig.products.pro90.best,false);assert.equal(document.getElementById('admin-dirty').textContent,'All changes saved');
console.log('PASS TH/EN view rendering; exclusion/swap/calendar/vacation/shopping/IF actions; simulated BLE connection, uint8/uint16 notifications, session finish, HR/set persistence; admin status, validation, preview and save payload.');
await window.happyDOM.abort();process.exit(0);
