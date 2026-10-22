import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const window=new Window({url:'https://app.test/#/me'});
for(const k of ['window','document','localStorage','sessionStorage','navigator','location','history','FormData','Event','MutationObserver'])Object.defineProperty(globalThis,k,{configurable:true,value:k==='window'?window:window[k]});
globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
const {getState,setState,todayISO}=await import('../app/js/store.js');
const {L,locale}=await import('../app/js/ui.js');
const {dictionaries,loadLanguage}=await import('../app/js/i18n/index.js');
await Promise.all(['zh','ja','vi'].map(loadLanguage));
const keys=JSON.parse(readFileSync(new URL('./i18n-strings.json',import.meta.url),'utf8'));
for(const [lang,dict] of Object.entries(dictionaries))for(const key of keys){assert.equal(typeof dict[key],'string',lang+': '+key);assert(dict[key].trim());assert(!dict[key].includes('▁'));assert.deepEqual([...key.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),[...dict[key].matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),lang+' placeholders: '+key);}
const {views,actions,setRenderer}=await import('../app/js/core.js');setRenderer(()=>{});
const {CONFIG}=await import('../app/js/config.js');CONFIG.API_BASE='https://api.test';
const {sessionFor}=await import('../app/js/workout.js');
const {readiness}=await import('../app/js/readiness.js');
const {targets}=await import('../app/js/calc.js');
const {dayMeals}=await import('../app/js/meals.js');
const {eatingWindow}=await import('../app/js/fasting.js');
const {allowedFoods}=await import('../app/js/foods.js');
const {planDay}=await import('../app/js/day.js');
const {EX}=await import('../app/js/exercises.js');
const {renderPose,solve}=await import('../app/js/figure.js');
const {productFood,lookupBarcode}=await import('../app/js/barcode.js');
const {interactionWarnings,supplementTime}=await import('../app/js/interactions.js');
const {cacheableVideo,downloadPlanVideos,VIDEO_CACHE}=await import('../app/js/offline.js');
const {reminderPlan}=await import('../app/js/notifications.js');
const {exportICS}=await import('../app/js/export.js');
await import('../app/js/views/round5b.js');await import('../app/js/views/admin-round5b.js');
const root=document.createElement('main');document.body.append(root);
const iso=todayISO();setState(s=>{s.onboarded=true;s.profile.startDate=iso;s.profile.trainDays=[0,1,2,3,4,5,6];});
for(const lang of ['th','en','zh','ja','vi']){setState(s=>s.lang=lang);assert(L('วันนี้','Today'));assert(locale());for(const name of ['today','workout','food','supps','me','account','groups','shop','admin']){root.innerHTML=views[name]({params:[],query:new URLSearchParams()});assert(root.textContent.trim(),name);assert(!root.textContent.includes('undefined'),name+' '+lang);}}
setState(s=>s.lang='ja');assert.equal(L({th:'ไทย',en:'English',ja:'日本語'}),'日本語');assert.equal(L({th:'ไทย',en:'Untranslated test'}),'Untranslated test');assert.equal(L({th:'ไทย'}),'ไทย');
assert.equal(L('','Downloaded 12 videos'),'動画を12本ダウンロードしました');
for(const ex of Object.values(EX))for(const lang of ['zh','ja','vi'])assert(ex.name[lang],ex.id+' '+lang);
assert.equal(readiness({energy:5,stress:1,sleep:8,soreness:{}}).mode,'normal');assert.equal(readiness({energy:1,stress:5,sleep:2,soreness:{legs:true,arms:true}}).mode,'rest');
setState(s=>s.logs[iso]={done:{},checkin:{override:'recovery'}});assert.deepEqual(sessionFor(getState().profile,iso).items.map(i=>i.id),['walk','cat_cow','breathing']);
setState(s=>{s.logs[iso].checkin={energy:3,stress:3,sleep:7,soreness:{}};});assert.equal(sessionFor(getState().profile,iso).readiness,'lighter');assert(!sessionFor(getState().profile,iso).items.some(i=>i.phase==='finisher'));
setState(s=>{s.profile.medical={enabled:true,conditions:['diabetes','kidney','gout','heart']};s.profile.fasting='16:8';});assert.equal(eatingWindow(getState().profile),null);assert.equal(sessionFor(getState().profile,iso).items.length,0);
const t=targets(getState().profile,true);assert(t.protein<=getState().profile.weight*.8);assert(dayMeals(getState().profile,iso,true,t).reduce((n,m)=>n+m.total.p,0)<=t.protein+.01);assert(!allowedFoods(getState().profile).some(f=>['shrimp','jasmine_rice','tuna'].includes(f.id)));
setState(s=>{s.profile.medical.exerciseCleared=true;s.profile.medical.fastingCleared=true;});assert(eatingWindow(getState().profile));assert(!sessionFor(getState().profile,iso).items.some(i=>i.phase==='finisher'));
const med={id:'thyroid',name:'Levothyroxine',dose:'as prescribed',times:['23:00','07:00'],food:'without'},prod={name:{en:'Calcium'},category:'multi'};
const timed=supplementTime(60,[med],prod,{});assert.equal(timed.min,180);assert.equal(interactionWarnings([med],prod)[0].hours,4);
assert.equal(supplementTime(0,[{...med,times:['00:00','04:00','08:00','12:00','16:00','20:00']}],prod,{}).min,null);
assert(interactionWarnings([{name:'Warfarin'}],{name:{en:'Vitamin E'}}).length);assert(interactionWarnings([],{category:'creatine'},{medical:{enabled:true,conditions:['kidney']}}).length);
setState(s=>{s.profile.medical={enabled:false};s.profile.medications=[med];s.profile.fasting='none';});assert.equal(planDay(iso).events.filter(e=>e.type==='medication').length,2);assert(reminderPlan(iso,{medications:true}).some(r=>r.body.includes('Levothyroxine')));
let calendar;const createURL=URL.createObjectURL;URL.createObjectURL=blob=>{calendar=blob;return 'blob:calendar-test';};window.HTMLAnchorElement.prototype.click=()=>{};exportICS(1);const ics=await calendar.text();assert.equal((ics.match(/SUMMARY:Levothyroxine/g)||[]).length,2);assert(ics.includes('T230000'));assert(ics.includes('T070000'));URL.createObjectURL=createURL;
const f=productFood('12345678',{product_name:'Food',nutriments:{'energy-kcal_serving':200,proteins_serving:10,carbohydrates_serving:20,fat_serving:5},serving_quantity:50});assert.equal(f.p,20);assert.equal(f.k,400);assert.equal(productFood('12345678',{nutriments:{}}),null);
let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({status:1,product:{product_name:'Food',nutriments:{'energy-kcal_100g':200,proteins_100g:10,carbohydrates_100g:20,fat_100g:5}}});};
await lookupBarcode('12345678');await lookupBarcode('12345678');assert.equal(calls,1);await assert.rejects(lookupBarcode('../bad'));
assert(cacheableVideo('https://api.test/api/media/squat'));assert(!cacheableVideo('https://youtube.com/watch?v=x'));assert(!cacheableVideo('https://evil.test/api/media/squat'));
const cache=new Map();globalThis.caches={open:async()=>({match:async u=>cache.get(u),put:async(u,r)=>cache.set(u,r)}),delete:async()=>cache.clear()};globalThis.fetch=async()=>new Response('mp4',{headers:{'Content-Type':'video/mp4'}});
setState(s=>{s.profile.planDays=1;s.logs[iso].checkin={override:'recovery'};});let progress=0;assert.equal(await downloadPlanVideos({walk:'https://api.test/api/media/walk',cat_cow:'https://youtube.com/watch?v=x'},n=>progress=n),1);assert.equal(progress,1);assert.equal(cache.size,1);
for(const id of ['wall_pushup','chair_squat'])for(const view of ['side','front'])for(const pose of EX[id].frames){const html=renderPose(pose,{...EX[id],view});assert(!/NaN|Infinity/.test(html));assert(html.includes('prop-o'));assert(solve(pose,view).hip.every(Number.isFinite));}
for(const pose of EX.wall_pushup.frames){const joints=solve(pose,'side');assert(Math.abs(joints.arm1[2][0]-170)<.1,'hands planted on wall');}
assert.equal(EX.wall_pushup.prop,'wall');assert.equal(EX.chair_squat.prop,'chair');
// A service-worker release removes old shells while preserving downloadable video and font/library caches.
const listeners={},removed=[];let claimed=false;
vm.runInNewContext(readFileSync(new URL('../app/sw.js',import.meta.url),'utf8'),{self:{addEventListener:(name,fn)=>listeners[name]=fn,clients:{claim:async()=>claimed=true}},caches:{keys:async()=>['old-shell','fitme-v1',VIDEO_CACHE,'fitme-assets-v1'],delete:async name=>removed.push(name)}});
let activation;listeners.activate({waitUntil:p=>activation=p});await activation;assert.deepEqual(removed,['old-shell']);assert(claimed);
// Actual form handlers retain daily check-ins and medication instructions locally for later sync.
const {POLICY_VERSION}=await import('../app/js/legal.js');setState(s=>s.consents={terms:iso,health:iso,version:POLICY_VERSION});
actions.checkin({dataset:{iso}});const form=document.querySelector('#checkin-form');form.querySelector('[name=energy]').value='2';form.querySelector('[data-region=quads]').dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));assert.equal(getState().logs[iso].checkin.energy,2);assert(getState().logs[iso].checkin.soreness.quads);
actions.medications();const medicationForm=[...document.querySelectorAll('.sheet form')].at(-1);medicationForm.querySelector('[name=name]').value='Metformin';medicationForm.querySelector('[name=dose]').value='Prescribed dose';medicationForm.querySelector('[name=times]').value='08:00,20:00';medicationForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));assert(getState().profile.medications.some(m=>m.name==='Metformin'&&m.times.length===2));
console.log('PASS Round 5b app: five-language route rendering, readiness, condition safeguards, kidney protein budget, medication reminders/spacing across midnight, barcode serving conversion/cache, R2-only downloads and wall/chair poses.');
window.happyDOM.abort();
