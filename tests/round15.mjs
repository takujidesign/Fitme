import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {Window} from 'happy-dom';
const window=new Window({url:'http://localhost/#/library',width:375,height:812});
for(const key of ['window','document','localStorage','sessionStorage','navigator','location','MutationObserver','Event'])Object.defineProperty(globalThis,key,{configurable:true,value:key==='window'?window:window[key]});
const {EXERCISES}=await import('../app/js/exercises.js');
const {exerciseMuscles}=await import('../app/js/muscle-map.js');
const {L}=await import('../app/js/ui.js');
const {filterExercises,mountPages}=await import('../app/js/library-paging.js');
const {supports3D}=await import('../app/js/three-support.js');
const get=file=>readFile(new URL('../'+file,import.meta.url),'utf8');
const records=JSON.parse(await get('app/data/exercise-db.json'));
const rows=[...EXERCISES,...(Array.isArray(records)?records:records.exercises)];
const original=(search,filters)=>rows.filter(e=>(e.searchNames||L(e.name)+' '+e.name.en).toLowerCase().includes(search.toLowerCase())&&(!filters.source||(e.sources||[e.source||'fixmee']).includes(filters.source))&&(!filters.muscle||exerciseMuscles(e).includes(filters.muscle))&&(!filters.equipment||e.equipment===filters.equipment)&&(!filters.level||(e.sourceLevel||['','beginner','intermediate','expert'][e.level])===filters.level)&&(!filters.category||(e.category||'strength')===filters.category));
for(const query of ['','squat','press','เดิน','curl','zzzz'])for(const filters of [{},{muscle:'quads'},{source:'fixmee'},{equipment:'dumbbell'},{level:'beginner'},{category:'strength'},{muscle:'biceps',level:'intermediate'}])assert.deepEqual(filterExercises(rows,query,filters).map(e=>e.id),original(query,filters).map(e=>e.id));
const host=document.createElement('div'),button=document.createElement('button');document.body.append(host,button);
let stop=mountPages(host,rows,e=>`<article data-id="${e.id}"><img loading="lazy" decoding="async"></article>`,button);assert.equal(host.children.length,40);button.click();assert.equal(host.children.length,80);stop();button.click();assert.equal(host.children.length,80);host.innerHTML='';stop=mountPages(host,rows.slice(0,3),e=>`<article>${e.id}</article>`,button);assert.equal(host.children.length,3);assert(button.hidden);stop();
const env={navigator:{deviceMemory:8},matchMedia:()=>({matches:false}),document:{createElement:()=>({getContext:()=>({getExtension:()=>null})})}};
assert(supports3D(env));assert(!supports3D({...env,navigator:{connection:{saveData:true}}}));assert(!supports3D({...env,navigator:{deviceMemory:2}}));assert(!supports3D({...env,matchMedia:()=>({matches:true})}));assert(!supports3D({...env,document:{createElement:()=>({getContext:()=>null})}}));
const sources=JSON.parse(await get('app/3d/SOURCES.json')),manifest=JSON.parse(await get('app/3d/manifest.json'));
assert.deepEqual(Object.keys(manifest).sort(),EXERCISES.map(e=>e.id).sort());
const mit=new Set(['bent_over_row','calf_raise','deadlift','dumbbell_shoulder_press','glute_bridge','hammer_curl','high_knees','lateral_raise','lunge','romanian_deadlift','overhead_tricep_extension','superman']);
for(const source of sources.sources){assert(source.url.includes('/'+sources.commit+'/'));assert(!/mixamo|\.fbx|opengym3d-mocap/i.test(source.url));if(source.url.includes('/exercises/'))assert(mit.has(source.url.split('/').at(-1).replace('.json','')));}
for(const output of sources.outputs){const bytes=await readFile(new URL('../app/3d/'+output.file,import.meta.url));assert.equal(bytes.length,output.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),output.sha256);assert(!/mixamo|\.fbx|opengym3d-mocap/i.test(bytes.toString('utf8')),output.file);}
assert((await stat(new URL('../app/3d/human.glb',import.meta.url))).size<=900000);assert(sources.outputs.filter(o=>o.file.startsWith('clips/')).reduce((n,o)=>n+o.bytes,0)<=600000);
for(const row of Object.values(manifest))if(row.keyframes){const data=JSON.parse(await get('app/3d/'+row.keyframes));assert(data.keyframes.length>=2);assert(['original','MIT'].includes(data.provenance.licence));if(row.lane==='MIT')assert(mit.has(data.provenance.source));else assert.equal(data.provenance.source,'app/js/exercises.js');}
// Traverse only static imports from the app entry point: renderer must be unreachable.
const visited=new Set();async function visit(file){if(visited.has(file))return;visited.add(file);const s=await get(file);for(const m of s.matchAll(/(?:import|export)\s+[^;]*?from\s*['"]([^'"]+)['"]/g)){if(!m[1].startsWith('.'))continue;const url=new URL(m[1],new URL('../'+file,import.meta.url));await visit(url.href.slice(new URL('../',import.meta.url).href.length));}}
await visit('app/js/app.js');assert(![...visited].some(f=>/three-viewer|three-motion|vendor\/three/.test(f)));
// Actual SW install + runtime cache exercise, no network or RepDB fixture.
const handlers={},buckets=new Map();let installed=[],online=true;
const bucket=name=>{if(!buckets.has(name))buckets.set(name,new Map());const b=buckets.get(name);return {addAll:async paths=>installed=paths,match:async r=>b.get(r.url)?.clone(),put:async(r,v)=>b.set(r.url,v.clone())};};
vm.runInNewContext(await get('app/sw.js'),{self:{addEventListener:(e,f)=>handlers[e]=f},caches:{open:async n=>bucket(n)},location:{origin:'https://local'},URL,Response,fetch:async()=>{if(!online)throw Error('offline');return new Response('asset');}});
await new Promise((resolve,reject)=>handlers.install({waitUntil:p=>p.then(resolve,reject)}));assert(!installed.some(p=>p.includes('/3d/')||/three-viewer|three-motion|vendor\/three/.test(p)));
for(const p of ['3d/human.glb','3d/clips/pushup.glb','3d/keyframes/plank.json','js/vendor/three/three.module.js','js/three-viewer.js']){let response;const request=()=>{handlers.fetch({request:new Request('https://local/'+p),respondWith:p=>response=p});return response;};online=true;assert.equal(await(await request()).text(),'asset');online=false;assert.equal(await(await request()).text(),'asset');}
assert((await get('app/sw.js')).includes("const VERSION = 'fitme-v1'"));
console.log('PASS Round 15: 42 search/filter parity cases, paging/reset, fallback policy, 40 licensed animations + hashes/size caps, lazy static graph, runtime offline cache.');
window.happyDOM.abort();
