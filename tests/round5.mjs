import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
const window=new Window({url:'https://test/#/me'});
for(const k of ['window','document','localStorage','sessionStorage','navigator','location','history','FormData','Event'])Object.defineProperty(globalThis,k,{configurable:true,value:k==='window'?window:window[k]});
globalThis.requestAnimationFrame=()=>1;
const {getState,setState,todayISO,addDays}=await import('../app/js/store.js');
const {views,actions,setRenderer}=await import('../app/js/core.js');
const {CONFIG}=await import('../app/js/config.js');
const {POLICY_VERSION,consentCurrent,acceptConsent}=await import('../app/js/legal.js');
const {cyclePhase,healthCalories}=await import('../app/js/womens-health.js');
const {sessionFor}=await import('../app/js/workout.js');
const {programSession,PROGRAMS}=await import('../app/js/programs.js');
const {targets}=await import('../app/js/calc.js');
const {eatingWindow}=await import('../app/js/fasting.js');
const {EX}=await import('../app/js/exercises.js');
const {solve,renderPose,figureSVG}=await import('../app/js/figure.js');
const {track,captureError,flushTelemetry,telemetryEnabled}=await import('../app/js/telemetry.js');
await import('../app/js/views/round5.js');await import('../app/js/views/admin-round5.js');await import('../app/js/views/pay.js');
const root=document.createElement('main');document.body.append(root);setRenderer(()=>{});
assert.equal(consentCurrent(),false);root.innerHTML=views.consent();assert.equal(acceptConsent(),false);root.querySelector('#consent-terms').checked=true;assert.equal(acceptConsent(),false);root.querySelector('#consent-health').checked=true;assert(acceptConsent());assert(consentCurrent());assert(!consentCurrent({consents:{terms:'date',health:'date',version:'old'}}));
const p={...getState().profile,startDate:'2026-01-01',sex:'female',trainDays:[0,1,2,3,4,5,6],goal:'cut',fasting:'16:8',womensHealth:{enabled:true,mode:'cycle',lastPeriod:'2026-01-01',cycleLength:28,adjustments:true}};
assert.equal(cyclePhase(p,'2025-12-31'),null);assert.equal(cyclePhase(p,'2026-01-02'),'menstrual');assert.equal(cyclePhase(p,'2026-01-10'),'follicular');assert.equal(cyclePhase(p,'2026-01-14'),'ovulation');assert.equal(cyclePhase(p,'2026-01-25'),'luteal');assert.equal(healthCalories(p,1800,2000,'2026-01-25'),1925);
assert.equal(healthCalories({...p,womensHealth:{...p.womensHealth,adjustments:false}},1800,2000,'2026-01-25'),1800);
let session=sessionFor(p,'2026-01-02');assert(session.items.every(it=>it.sets<=2));assert(session.items.some(it=>it.id==='cat_cow'));assert(!session.items.some(it=>it.phase==='finisher'));
const pregnant={...p,womensHealth:{enabled:true,mode:'pregnancy',weeks:20,cleared:true}};
assert.equal(eatingWindow(pregnant),null);assert(targets(pregnant,false).kcal>=targets(pregnant,false).tdee);
for(const program of [null,...Object.keys(PROGRAMS)])for(const location of ['home','db','gym'])for(let d=0;d<7;d++){
 const profile={...pregnant,location,program:program?{id:program,startDate:p.startDate}:null};const s=sessionFor(profile,addDays(p.startDate,d));assert(s.items.every(it=>!['bench_press','crunch','leg_raise','bridge','superman','dead_bug','jumping_jack','squat_jump','run_interval'].includes(it.id)));assert(!s.items.some(it=>it.phase==='finisher'));
}
const postpartum={...p,womensHealth:{enabled:true,mode:'postpartum',weeks:3,cleared:true,breastfeeding:true}};
assert.equal(eatingWindow(postpartum),null);assert(targets(postpartum).kcal>=targets(postpartum).tdee+450);assert(sessionFor(postpartum,'2026-01-02').items.every(it=>['walk','breathing','kegel'].includes(it.id)));
assert.equal(sessionFor({...pregnant,womensHealth:{...pregnant.womensHealth,cleared:false}},'2026-01-02').items.length,0);
for(const [id,program] of Object.entries(PROGRAMS))for(let d=0;d<program.weeks*7;d++){const s=programSession({...p,program:{id,startDate:p.startDate}},addDays(p.startDate,d));assert.equal(s.week,Math.floor(d/7)+1);assert(s.items.every(it=>EX[it.id]));if(id==='back')assert(s.items.every(it=>!['deadlift','rdl','superman','crunch'].includes(it.id)));if(id==='senior')assert(s.items.every(it=>it.rest>=90));}
const runs=Array.from({length:7},(_,d)=>programSession({...p,program:{id:'run5k',startDate:p.startDate}},addDays(p.startDate,d)));assert.equal(runs.filter(s=>s.items.some(i=>i.id==='run_interval')).length,3);assert.equal(runs.filter(s=>s.type==='train').length,4);assert.equal(programSession({...p,program:{id:'beginner',startDate:p.startDate}},'2026-01-15'),null);
// Every new keyframe and both projection modes produce finite SVG coordinates.
for(const id of ['bird_dog','dead_bug','cat_cow','chair_squat','wall_pushup','step_up','run_interval','side_plank','kegel','breathing'])for(const view of ['side','front'])for(const pose of EX[id].frames){assert(!/NaN|Infinity|undefined/.test(renderPose(pose,{...EX[id],view})),id+' '+view);const coords=JSON.stringify(solve(pose,view));assert(!coords.includes('null')||view==='front');root.innerHTML=figureSVG({...EX[id],view});assert(root.querySelector('svg'));}
for(const lang of ['th','en'])for(const theme of ['dark','light']){
 setState(s=>{s.lang=lang;s.theme=theme;s.profile.sex='female';});
 for(const name of ['privacy','terms','consent','me','account','workout','programs','womens-health','plans','trainer-plans','plan-checkout','admin','pay']){root.innerHTML=views[name]({params:[]});assert(root.textContent.trim(),name);assert(!root.textContent.includes('undefined'),name);assert(!root.textContent.includes('???'),name);}
}
CONFIG.API_BASE='https://test';let posted=[];
globalThis.fetch=async(url,opts)=>{posted.push({url,body:opts?.body?JSON.parse(opts.body):null});return Response.json({ok:true,orderId:crypto.randomUUID(),amount:89.1,currency:'thb',expiresAt:Date.now()+60000});};
track('onboarding_done');captureError('TypeError alice@example.com','https://test/app.js?private=1',4);await flushTelemetry();assert.equal(posted.length,1);assert(!JSON.stringify(posted).includes('alice'));assert(!JSON.stringify(posted).includes('private'));assert(posted[0].body.installId);
telemetryEnabled(false);track('ai_used');captureError('Error private');await flushTelemetry();assert.equal(posted.length,1);
root.innerHTML=views.pay();root.querySelector('#pay-promo').value='SAVE10';await actions['pay-quote'](document.createElement('button'));assert.equal(posted.at(-1).body.promo,'SAVE10');
actions['consent-withdraw']();assert(!consentCurrent());
console.log('PASS Round 5a DOM: separate/versioned consent, TH/EN routes and themes, promo input, sanitized telemetry opt-out, cycle phases/adjustments, pregnancy/postpartum safety across programs, eight-week run progression, all new poses in side/front.');
await window.happyDOM.close();
