import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
const window=new Window({url:'http://localhost/#/today',width:375,height:812});
for(const key of ['window','document','localStorage','sessionStorage','navigator','location','FormData','Event'])Object.defineProperty(globalThis,key,{value:key==='window'?window:window[key],configurable:true});
globalThis.requestAnimationFrame=()=>1;
const {getState,setState,todayISO}=await import('../app/js/store.js');
const {EX,EXERCISES}=await import('../app/js/exercises.js');
const {bmi,bmiClass}=await import('../app/js/calc.js');
const T=await import('../app/js/tools.js');
const {personalRecords,detectPRs}=await import('../app/js/records.js');
const {REGIONS,exerciseMuscles,muscleRecovery}=await import('../app/js/muscle-map.js');
const {mapExercise,COMMIT}=await import('../scripts/import-exercises.mjs');
const {scaleRecipe,recipeTotals}=await import('../app/js/recipes.js');
const {adaptExercise,retainExercise}=await import('../app/js/exercise-library.js');
const {sessionFor}=await import('../app/js/workout.js');
const near=(actual,expected,tolerance=.001)=>assert(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);
const p={weight:70,height:170,age:30,sex:'male',bodyFat:20};
near(bmi(p),24.22145);assert.equal(bmiClass(23).en,'Overweight');assert.equal(bmiClass(25).en,'Obese I');
near(T.basal(p),1617.5);near(T.basal(p,'harris'),1671.672);near(T.basal({...p,sex:'female'},'harris'),1491.643);near(T.basal({...p,sex:'female'}),1451.5);near(T.basal(p,'katch'),1579.6);near(T.tdee(1600,1.5),2400);
const m=T.macros(2400,70,'cut');near(m.kcal,1920);near(m.p,154);near(m.p*4+m.c*4+m.f*9,1920);
near(T.oneRM(100,10),133.333333);near(T.oneRM(100,10,'brzycki'),133.333333);near(T.oneRM(100,1),100);assert.throws(()=>T.oneRM(10,37));assert.equal(T.rmTable(100)[0].kg,50);
assert.deepEqual(T.plates(100,20).sides,[{kg:25,count:1},{kg:15,count:1}]);assert.equal(T.plates(101,20).remainder,1);assert.throws(()=>T.plates(10,20));
near(T.navyFat({sex:'male',height:81*2.54,waist:43*2.54,neck:17*2.54}),24.8,.1);near(T.navyFat({sex:'female',height:64*2.54,waist:30*2.54,hip:38*2.54,neck:13*2.54}),29.214008);assert.throws(()=>T.navyFat({...p,waist:30,neck:40}));
const zones=T.heartZones(30,60);near(zones.max,187);near(zones.zones[0].low,123.5);near(T.heartZones(30,60,'classic').max,190);near(T.burned(6,70,30),210);near(T.water(70,30),2750);near(T.protein(70,'maintain'),112);assert.throws(()=>T.basal({...p,weight:NaN}));
const logs={'2026-10-10':{sets:[{id:'squat',kg:50,reps:5}]},'2026-10-11':{sets:[{id:'squat',kg:55,reps:6}]}};
assert.equal(personalRecords(logs).squat.weight,55);assert.equal(detectPRs(logs,[{id:'squat',kg:55,reps:6}]).length,0);assert.equal(detectPRs(logs,[{id:'squat',kg:60,reps:6}]).length,3);assert.equal(detectPRs(logs,[{id:'squat',kg:50,reps:7}]).length,1);assert.equal(T.overload(logs,'squat')[1].volume,330);
const db=JSON.parse(await readFile(new URL('../app/data/exercise-db.json',import.meta.url),'utf8')),names=JSON.parse(await readFile(new URL('../scripts/exercise-names-th.json',import.meta.url),'utf8'));assert.equal(db.length,876);assert(Object.keys(names).length>=150);for(const n of Object.values(names))assert(/[\u0e00-\u0e7f]/.test(n.name));
for(const ex of [...EXERCISES,...db]){const regions=exerciseMuscles(ex);assert(regions.length,ex.id);for(const id of regions)assert(REGIONS[id],id);}
assert.equal(EXERCISES.length,40);assert.deepEqual(exerciseMuscles(EX.deadlift),['hamstrings','glutes','lower_back','traps']);
assert(db.every(e=>e.images.every(src=>src.includes('@'+COMMIT))));const sample={id:'sample',name:'Sample',primaryMuscles:['chest'],secondaryMuscles:['triceps'],images:['Sample/0.jpg'],instructions:['Press'],level:'beginner'};assert.deepEqual(mapExercise(sample).primaryMuscles,['chest']);assert.equal(mapExercise(sample).nameTh,'Sample');assert.throws(()=>mapExercise({...sample,primaryMuscles:['unknown']}));
const now=Date.now(),fresh=muscleRecovery({[todayISO()]:{sets:Array(9).fill({id:'squat'}),workout:{at:new Date(now).toISOString()}}},EX,now);assert.equal(fresh.quads.status,'fatigued');assert.equal(fresh.quads.sets,9);assert.equal(muscleRecovery({[todayISO()]:{sets:Array(9).fill({id:'squat'}),workout:{at:new Date(now-73*3600000).toISOString()}}},EX,now).quads.status,'fresh');assert.equal(muscleRecovery({[todayISO()]:{checkin:{soreness:{shoulders:true}},workout:{at:new Date(now).toISOString()}}},EX,now).front_delts.status,'recovering');
const recipes=JSON.parse((await readFile(new URL('../app/data/recipes-th.json',import.meta.url),'utf8')).replace(/^\uFEFF/,''));assert.equal(recipes.length,30);for(const r of recipes){const one=recipeTotals(r,1),three=recipeTotals(r,3);for(const k of ['k','p','c','f'])near(three[k],one[k]*3);assert(r.steps.th.length&&r.steps.en.length);assert.equal(scaleRecipe(r,2)[0].grams,r.ingredients[0].grams*2);}assert.throws(()=>scaleRecipe(recipes[0],0));
setState(s=>{s.onboarded=true;Object.assign(s.profile,{startDate:todayISO(),trainDays:[0,1,2,3,4,5,6],location:'gym',level:'advanced'});});
const chosen=adaptExercise(db.find(e=>e.id==='db-Dumbbell_Bench_Press'));retainExercise(chosen);setState(s=>s.extraExercises[todayISO()]=[{id:chosen.id,sets:3,reps:'10-12',rest:60}]);assert(sessionFor(getState().profile,todayISO()).items.some(i=>i.id===chosen.id));setState(s=>s.profile.avoidEx=[chosen.id]);assert(!sessionFor(getState().profile,todayISO()).items.some(i=>i.id===chosen.id));setState(s=>s.profile.avoidEx=[]);
const {views,actions,setRenderer}=await import('../app/js/core.js');for(const file of ['admin-round5','admin-round5b','admin-round5c','admin-login','library','tools','free-workout','recipes','credits'])await import('../app/js/views/'+file+'.js');
const {setAdminSession,adminToken}=await import('../app/js/admin-session.js');const root=document.createElement('main');document.body.append(root);let active='admin';const render=()=>{root.innerHTML=views[active]({params:[],query:new URLSearchParams()});};setRenderer(render);
let calls=[];globalThis.fetch=async(url,opts)=>{calls.push({url:String(url),opts});if(String(url).endsWith('/login'))return Response.json({token:'a'.repeat(64)});if(String(url).endsWith('/status'))return Response.json({secrets:{}});if(String(url).endsWith('/exercise-db.json'))return Response.json(db);if(String(url).endsWith('/recipes-th.json'))return Response.json(recipes);return Response.json({});};
location.hash='#/admin';setAdminSession('');render();await views.admin.mount(root);assert(root.querySelector('#admin-login'));assert(!root.querySelector('#admin-form'));assert(!root.querySelector('[data-act="admin-tab"]'));assert.equal(calls.length,0);
const form=root.querySelector('form');form.elements.password.value='password';await form.onsubmit({preventDefault(){},target:form});assert.equal(adminToken(),'a'.repeat(64));assert(root.querySelector('#admin-form'));assert(root.querySelector('[data-act="admin-backups"]'));assert.equal(sessionStorage.getItem('fitme:admin-password'),null);
const {adminFetch}=await import('../app/js/admin-session.js');globalThis.fetch=async()=>new Response('{}',{status:401});await adminFetch('http://localhost/api/admin/status');assert(root.querySelector('#admin-login'));assert.equal(adminToken(),'');
for(const lang of ['th','en','zh','ja','vi'])for(const theme of ['light','dark']){setState(s=>{s.lang=lang;s.theme=theme;});for(const name of ['admin','library','tools','free-workout','records','muscles','recipes','credits']){active=name;render();assert(!root.innerHTML.includes('undefined'),`${name}/${lang}/${theme}`);assert(root.textContent.length>0, name+lang+theme);if(name==='tools'){views.tools.mount(root);assert(!/NaN|Infinity/.test(root.textContent));}}}
active='free-workout';actions['free-start']();const before=getState().logs[todayISO()]?.sets?.length||0;setState(s=>s.freeWorkout.items=[{id:'squat',sets:[{kg:60,reps:5}]}]);actions['free-finish']();assert.equal(getState().logs[todayISO()].sets.length,before+1);assert(getState().logs[todayISO()].done.workout);assert.equal(getState().freeWorkout,null);
// Exercise picker and meal-prep integration use the real UI actions and state.
globalThis.fetch=async url=>Response.json(String(url).includes('exercise-db')?db:recipes);
active='library';location.hash='#/library?free=1';actions['free-start']();render();await views.library.mount(root);
actions['library-open']({dataset:{id:'db-Dumbbell_Bench_Press'}});document.querySelector('#library-add').click();assert.equal(getState().freeWorkout.items[0].id,'db-Dumbbell_Bench_Press');
active='recipes';location.hash='#/recipes';render();await views.recipes.mount(root);actions['recipe-open']({dataset:{id:recipes[0].id}});
const servings=document.querySelector('#recipe-servings');servings.value='2';servings.dispatchEvent(new Event('input'));const date=document.querySelector('#recipe-date').value,slot=document.querySelector('#recipe-slot').value;document.querySelector('#recipe-plan').click();assert.equal(getState().mealOverrides[date][slot].items[0].g,300);
const {planDay}=await import('../app/js/day.js');assert.equal(planDay(date).meals.find(m=>m.key===slot).recipeId,recipes[0].id);
actions['recipe-open']({dataset:{id:recipes[0].id}});const prepSheet=document.querySelector('.sheet-wrap:last-child');prepSheet.querySelector('#recipe-days').value='3';prepSheet.querySelector('#recipe-prep').click();assert.equal(getState().mealPrep.at(-1).ingredients[0].grams,450);
console.log('PASS Round 6 formula references, PRs, 40+876 muscle mappings, pinned import/155 Thai names, recovery/soreness, 30 recipe scaling, planner restrictions, admin login/401 gate, free session and five-language/two-theme DOM rendering. DOM does not prove pixel layout.');
await window.happyDOM.close();


