import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
const window=new Window({url:'https://app.test/#/me'});
for(const k of ['window','document','localStorage','sessionStorage','navigator','location','history','FormData','Event'])Object.defineProperty(globalThis,k,{configurable:true,value:k==='window'?window:window[k]});
globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
const {getState,setState,todayISO}=await import('../app/js/store.js');
const {views,actions,setRenderer}=await import('../app/js/core.js');setRenderer(()=>{});
for(const module of ['onboard','today','workout','food','supps','me','pay','admin','round5','admin-round5','round5b','admin-round5b','round5c','admin-round5c'])await import('../app/js/views/'+module+'.js');
const {RepCounter,angle,supportedForm}=await import('../app/js/form-check.js');
assert(supportedForm.has('db_curl'));assert.equal(angle({x:0,y:0},{x:1,y:0},{x:2,y:0}),180);
// Deterministic synthetic landmark fixture, deliberately not labelled as a recorded human session.
const fixture=(degrees)=>{const l=Array.from({length:33},()=>({x:0,y:0,visibility:1}));l[11]={x:0,y:0,visibility:1};l[13]={x:1,y:0,visibility:1};l[15]={x:1-Math.cos(degrees*Math.PI/180),y:Math.sin(degrees*Math.PI/180),visibility:1};return l;};
const counter=new RepCounter('db_curl');for(const [at,degrees] of [[300,170],[600,80],[650,160],[950,170],[1250,160],[1550,80],[1850,170]])counter.update(fixture(degrees),at);assert.equal(counter.reps,2);counter.update(null,2000);counter.update(fixture(80),2300);counter.update(fixture(170),2600);assert.equal(counter.reps,2,'Tracking loss must reset the rep cycle');
const p=getState().profile,{dayMeals}=await import('../app/js/meals.js'),{targets}=await import('../app/js/calc.js'),{FOOD,allowedFoods}=await import('../app/js/foods.js');
const meals=dayMeals({...p,eatingOut:['lunch']},todayISO(),false,targets(p,false));assert(meals.find(m=>m.kind==='lunch').items[0].id.startsWith('out_'));assert(meals.every(m=>Number.isFinite(m.total.p)));assert(allowedFoods({...p,diet:'vegan'}).filter(f=>f.cat==='eatingout').every(f=>!f.tags.includes('meat')));
const root=document.createElement('main');document.body.append(root);
for(const lang of ['th','en','zh','ja','vi'])for(const theme of ['light','dark']){setState(s=>{s.lang=lang;s.theme=theme;});for(const route of ['wellbeing','eating-out','org','pay','me','food','today','admin']){root.innerHTML=views[route]({params:[],query:new URLSearchParams()});assert(root.textContent.trim(),route);assert(!root.textContent.includes('undefined'),route);}}
root.innerHTML=views.wellbeing();views.wellbeing.mount(root);root.querySelector('#mood-value').value='4';root.querySelector('#mood-stress').value='5';root.querySelector('#mood-note').value='A busy day';root.querySelector('form').dispatchEvent(new Event('submit',{cancelable:true}));assert.equal(getState().logs[todayISO()].mood.stress,5);
const {installId}=await import('../app/js/install-id.js');assert.equal(installId(),installId());
const {reminderPlan}=await import('../app/js/notifications.js');setState(s=>{s.lang='en';s.premium.until=new Date(new Date(todayISO()+'T12:00:00').getTime()+86400000).toISOString();});assert(reminderPlan().some(r=>r.route==='#/me'&&/Membership expires soon|สมาชิกใกล้หมดอายุ/.test(r.title)));
actions['breathe-stop']();await window.happyDOM.close();
console.log('PASS Round 5c app: five-language/two-theme render, synthetic landmark hysteresis/tracking loss, eating-out meal/diet rules, mood persistence, trial install identity and expiry reminder.');
