import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {Window} from 'happy-dom';
const window=new Window({url:'http://localhost/#/library',width:375,height:812});
for(const key of ['window','document','localStorage','sessionStorage','navigator','location','MutationObserver','Event'])Object.defineProperty(globalThis,key,{value:key==='window'?window:window[key],configurable:true});
globalThis.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});globalThis.requestAnimationFrame=()=>1;
const {adaptRepdb,mapRepdb,REPDB_MUSCLES,REPDB_URL,repdbImage,loadRepdb,repdbStatus,fetchRepdb}=await import('../app/js/repdb.js');
const {mergeExercises}=await import('../app/js/exercise-merge.js');
const {REGIONS,exerciseMuscles,muscleRecovery}=await import('../app/js/muscle-map.js');
const {EX}=await import('../app/js/exercises.js');
const {retainExercise,libraryAllowed,photoHTML}=await import('../app/js/exercise-library.js');
const {getState,setState,todayISO}=await import('../app/js/store.js');
const {sessionFor,sessionKcal}=await import('../app/js/workout.js');
const {mountExerciseVisual,approved3D}=await import('../app/js/illustrations.js');
const {CONFIG}=await import('../app/js/config.js');CONFIG.API_BASE='';
// Invented test content, not copied or sampled from the licensed dataset.
const fixture={schema_version:3,exercises:[{id:'test-curl',name_en:'Example curl',name_de:'Beispiel',name_es:'Ejemplo',primary_muscles:['biceps_brachii'],secondary_muscles:['forearm_flexors'],equipment:'dumbbell',category:'strength',force_type:'pull',mechanic:'isolation',difficulty:'beginner',body_part:'upper_arms',is_bodyweight:false,met:4,instructions_en:['Test instruction.'],tips_en:['Test tip.'],images:{flat:{main:'images/flat/test-curl-main.webp'}}}]};
for(const [name,regions] of Object.entries(REPDB_MUSCLES)){assert(regions.length,name);for(const r of regions)assert(REGIONS[r],name);const e=adaptRepdb({...fixture.exercises[0],primary_muscles:[name]});assert(e.primaryMuscles.length);}
const rows=await mapRepdb(fixture,{'test-curl':'งอแขนทดสอบ'}),e=rows[0];assert.equal(e.name.th,'งอแขนทดสอบ');assert.equal(e.name.de,'Beispiel');assert.equal(e.id,'repdb:test-curl');assert.equal(e.equip,'db');assert.equal(e.met,4);assert.deepEqual(exerciseMuscles(e),['biceps','forearms']);
await assert.rejects(mapRepdb({...fixture,schema_version:4}));await assert.rejects(mapRepdb({schema_version:3}));assert.throws(()=>adaptRepdb({...fixture.exercises[0],primary_muscles:['unknown']}));
assert.equal(repdbImage('premium-samples/test.webp'),'');assert.equal(repdbImage('images/flat/../test.webp'),'');assert.equal(repdbImage('https://other.test/a.webp'),'');assert(photoHTML(e).includes('https://repdb.co/'));assert(photoHTML({...e,images:['javascript:alert(1)']}).includes('src=""'));
const merged=mergeExercises([EX.db_curl,e,{...e,id:'db-example',source:'free-exercise-db'}],[['db_curl',e.id]]);assert.equal(merged.length,1);assert.equal(merged[0].id,'db_curl');assert.equal(merged[0].sources.length,3);assert(merged[0].searchNames.includes('งอแขนทดสอบ'));
assert.equal(mergeExercises([e,{...e,id:'another',equipment:'barbell'}]).length,2);
const p={...getState().profile,location:'db',level:'beginner'};assert(libraryAllowed(p,e));assert(!libraryAllowed({...p,location:'home'},e));assert(!libraryAllowed({...p,avoidEx:[e.id]},e));assert(!libraryAllowed(p,{...e,level:3}));assert.equal(adaptRepdb({...fixture.exercises[0],is_bodyweight:true,equipment:['pull_up_bar']}).equip,'gym');
retainExercise(e);assert.equal(EX[e.id].id,e.id);assert.equal(getState().libraryExercises[e.id].met,4);
const day=todayISO();setState(s=>{s.profile={...p,startDate:day};s.dayOverrides[day]='train';s.extraExercises[day]=[{id:e.id,sets:3,reps:'10-12',rest:60,phase:'main'}];});assert(sessionFor(getState().profile,day).items.some(i=>i.id===e.id));assert(sessionKcal({items:[{id:e.id,sets:3,reps:'10'}]},70)>0);
const {personalRecords,detectPRs}=await import('../app/js/records.js');
const sets=[{id:e.id,kg:10,reps:12},{id:e.id,kg:12,reps:10}];const logs={[day]:{sets}};assert.equal(personalRecords(logs)[e.id].weight,12);assert(detectPRs({},sets).some(pr=>pr.id===e.id));assert.equal(muscleRecovery(logs,EX).biceps.sets,2);
const current=sessionFor(getState().profile,day),swapIndex=current.items.findIndex(it=>EX[it.id].group===e.group);if(swapIndex>=0){setState(s=>{s.exSwaps[day]={[swapIndex]:e.id};});assert.equal(sessionFor(getState().profile,day).items[swapIndex].id,e.id);}
assert(!libraryAllowed({...p,avoidEx:['db_curl']},{...e,aliases:['db_curl']}));
const host=document.createElement('div');document.body.append(host);await mountExerciseVisual(host,e);assert(host.querySelector('img[loading="lazy"]'));assert(host.textContent.includes('RepDB'));
const art={start:'img/ex3d/squat-start.webp',finish:'img/ex3d/squat-finish.webp',style:'3d',tool:'Codex image generation',created:'2026-10-24'};
assert.deepEqual(approved3D({squat:art}),{squat:art});assert.deepEqual(approved3D({squat:{...art,start:'https://other.test/a.webp'}}),{});
const flat={start:'img/ex/squat-start.webp',finish:'img/ex/squat-finish.webp',source:'ai',tool:'Codex image generation',created:'2026-10-24'};
const fetcher=async url=>Response.json(String(url).includes('illustrations-3d')?{squat:art}:{squat:flat});
let ctl=await mountExerciseVisual(host,EX.squat,{fetcher});assert(host.querySelector('[data-mode="3d"].on'));host.querySelector('img').dispatchEvent(new Event('error'));assert(host.querySelector('[data-mode="ai"].on'));host.querySelector('img').dispatchEvent(new Event('error'));assert(host.querySelector('svg'));ctl.stop();
setState(s=>s.exerciseVisualStyle='animation');ctl=await mountExerciseVisual(host,EX.squat,{fetcher});assert(host.querySelector('[data-mode="animation"].on'));ctl.stop();
setState(s=>s.exerciseVisualStyle='flat');ctl=await mountExerciseVisual(host,EX.squat,{fetcher});assert(host.querySelector('[data-mode="ai"].on'));ctl.stop();
assert.deepEqual(await loadRepdb(async()=>{throw Error('offline');}),[]);assert.equal(repdbStatus(),'unavailable');
assert.deepEqual(await loadRepdb(async url=>Response.json(String(url)===REPDB_URL?{...fixture,schema_version:4}:{})),[]);
assert.equal((await loadRepdb(async url=>Response.json(String(url)===REPDB_URL?fixture:{}))).length,1);assert.equal(repdbStatus(),'ready');
const cached=new Map();globalThis.caches={open:async()=>({match:async key=>cached.get(key)?.clone(),put:async(key,response)=>cached.set(key,response.clone())})};
let downloads=0;await fetchRepdb(async()=>{downloads++;return Response.json(fixture);});await fetchRepdb(async()=>{throw Error('offline');});assert.equal(downloads,1);assert(cached.has(REPDB_URL));delete globalThis.caches;

// Scan tracked AND untracked source artifacts. Never open repo-root JPGs.
async function scan(dir='.') {const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){if(['.git','node_modules','.wrangler','dist'].includes(entry.name))continue;const p=(dir==='.'?'':dir+'/')+entry.name;if(entry.isDirectory())out.push(...await scan(p));else out.push(p);}return out;}
let paths;try{paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);}catch(error){if(error.code!=='EPERM')throw error;paths=await scan();}
for(const path of paths){assert(!/(?:^|\/)premium-samples\//i.test(path),path);assert(!/(?:^|\/)images\/flat\/.*\.webp$/i.test(path),path);assert(!/(?:^|\/)[a-z0-9-]+-main\.webp$/i.test(path),path);if(!path.startsWith('docs/round14-screens/'))assert(!/repdb.*\.(webp|png|jpe?g)$/i.test(path),path);if(!path.endsWith('.json')||path.includes('node_modules'))continue;let value;try{value=JSON.parse(await readFile(path,'utf8'));}catch{continue;}assert(!(value?.schema_version&&Array.isArray(value.exercises)),`Dataset blob: ${path}`);assert(!(Array.isArray(value)&&value.some(r=>r?.name_en&&r?.instructions_en&&r?.images?.flat)),`Derived dataset: ${path}`);}
const sw=await readFile('app/sw.js','utf8');assert(sw.includes("const VERSION = 'fitme-v1';"));assert(!sw.slice(sw.indexOf('const SHELL'),sw.indexOf("self.addEventListener")).includes('img/ex3d/'));
for(const file of ['README.md','THIRD_PARTY_NOTICES.md','app/js/views/credits.js'])assert((await readFile(file,'utf8')).includes('Exercise data by RepDB (repdb.co)'));
const names=JSON.parse(await readFile('app/data/repdb-names-th.json','utf8'));assert(Object.keys(names).length>=200);for(const name of Object.values(names))assert(/[ก-๙]/.test(name));
const manifest=JSON.parse(await readFile('app/data/illustrations-3d.json','utf8'));assert.deepEqual(approved3D(manifest),manifest);
for(const [id,row] of Object.entries(manifest)){assert(EX[id]?.frames);for(const pose of ['start','finish']){const bytes=await readFile('app/'+row[pose]);assert(bytes.length<=90000);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');}}
console.log('PASS Round 14: mapping, schema failure, original Thai names, aliases, equipment/level/avoid, persistence/planner/calories, image URL allowlist, 3D preference/fallback, attribution and repository licence guard. Synthetic fixtures only.');
window.happyDOM.abort();
