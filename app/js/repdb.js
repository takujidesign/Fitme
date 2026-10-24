// Runtime adapter only. Never vendor the upstream dataset or artwork.
export const REPDB_COMMIT='b407c5951a027a27817fb2a5cee9ec9feffc4dc7';
export const REPDB_BASE=`https://cdn.jsdelivr.net/gh/RepDB/exercise-dataset@${REPDB_COMMIT}/`;
export const REPDB_URL=REPDB_BASE+'exercises.json';
export const REPDB_MUSCLES={hip_flexors:['quads'],rectus_abdominis:['abs'],transverse_abdominis:['abs'],hamstrings:['hamstrings'],quadriceps:['quads'],latissimus_dorsi:['lats'],pectoralis_major:['chest'],anterior_deltoid:['front_delts'],lateral_deltoid:['rear_delts'],triceps_brachii:['triceps'],erector_spinae:['lower_back'],obliques:['obliques'],posterior_deltoid:['rear_delts'],adductors:['adductors'],gastrocnemius:['calves'],gluteus_medius:['glutes'],gluteus_maximus:['glutes'],abductors:['glutes'],biceps_brachii:['biceps'],rhomboids:['traps'],forearm_flexors:['forearms'],trapezius:['traps'],brachialis:['biceps'],brachioradialis:['forearms'],forearm_extensors:['forearms'],soleus:['calves'],tibialis_anterior:['calves'],quadratus_lumborum:['lower_back'],serratus_anterior:['chest'],forearms:['forearms'],supraspinatus:['rear_delts']};
export const repdbImage=path=>typeof path==='string'&&/^images\/flat\/[a-z0-9_-]+\.webp$/.test(path)?REPDB_BASE+path:'';
export const isRepdbImage=url=>typeof url==='string'&&url.startsWith(REPDB_BASE)&&!!repdbImage(url.slice(REPDB_BASE.length));
export function adaptRepdb(e,names={}){
 if(!e||!(/^[a-z0-9-]+$/).test(e.id)||!e.name_en)throw Error('Invalid RepDB entry');
 const regions=values=>[...new Set((values||[]).flatMap(v=>{if(!REPDB_MUSCLES[v])throw Error('Unknown RepDB muscle');return REPDB_MUSCLES[v];}))];
 const primaryMuscles=regions(e.primary_muscles),secondaryMuscles=regions(e.secondary_muscles),equipment=Array.isArray(e.equipment)?e.equipment:e.equipment?[e.equipment]:[];
 if(!primaryMuscles.length)throw Error('Missing RepDB muscles');
 const translated=names[e.id],name={en:e.name_en,de:e.name_de,es:e.name_es,th:typeof translated==='string'?translated:translated?.name||e.name_en};
 const cues={},tips={};for(const lang of ['en','de','es']){cues[lang]=e['instructions_'+lang]||e.instructions_en||[];tips[lang]=e['tips_'+lang]||e.tips_en||[];}
 if(translated?.instructions)cues.th=translated.instructions;if(translated?.tips)tips.th=translated.tips;
 const equip=equipment.length===0?'none':equipment.every(x=>x==='dumbbell')?'db':'gym';
 return {id:'repdb:'+e.id,source:'repdb',name,cues,tips,primaryMuscles,secondaryMuscles,muscles:{en:primaryMuscles.join(', ')},category:e.category,force:e.force_type,mechanic:e.mechanic,body_part:e.body_part,is_bodyweight:!!e.is_bodyweight,equipment:equipment.join(', ')||'body only',equipmentIds:equipment,equip,level:({beginner:1,intermediate:2,advanced:3})[e.difficulty]||3,sourceLevel:e.difficulty==='advanced'?'expert':e.difficulty,met:Number(e.met)||3.5,type:e.category==='stretching'||e.category==='cardio'||e.force_type==='static'?'time':'reps',group:e.category==='stretching'?'mobility':e.category==='cardio'?'cardio':primaryMuscles.some(x=>['quads','hamstrings','glutes','calves','adductors'].includes(x))?'legs':primaryMuscles.some(x=>['abs','obliques'].includes(x))?'core':primaryMuscles.some(x=>['chest','front_delts','rear_delts','triceps'].includes(x))?'push':'pull',images:Object.values(e.images?.flat||{}).map(repdbImage).filter(Boolean)};
}
export async function mapRepdb(data,names={}){
 if(data?.schema_version!==3||!Array.isArray(data.exercises))throw Error('Unsupported RepDB schema');
 const rows=[];for(let i=0;i<data.exercises.length;i+=30){rows.push(...data.exercises.slice(i,i+30).map(e=>adaptRepdb(e,names)));await new Promise(resolve=>setTimeout(resolve,0));}return rows;
}
export async function fetchRepdb(fetcher=globalThis.fetch){
 let cache;try{cache=globalThis.caches?await caches.open('fitme-assets-v1'):null;}catch{}
 let response=await cache?.match(REPDB_URL);
 if(!response){response=await fetcher(REPDB_URL,{signal:AbortSignal.timeout(18000)});if(!response.ok)throw Error('RepDB unavailable');}
 const data=await response.clone().json();if(data?.schema_version!==3)throw Error('Unsupported RepDB schema');
 if(cache)try{await cache.put(REPDB_URL,response);}catch{}return data;
}
let loading;let status='idle';
export const repdbStatus=()=>status;
export async function loadRepdb(fetcher=globalThis.fetch){
 if(loading)return loading;status='loading';
 loading=(async()=>{try{
   const namesResponse=await fetcher(new URL('../data/repdb-names-th.json',import.meta.url));const names=namesResponse.ok?await namesResponse.json():{};
   // Parse the large JSON outside the UI thread; mapped rows yield between chunks.
   let data;
   if(typeof Worker!=='undefined'&&fetcher===globalThis.fetch)data=await new Promise((resolve,reject)=>{const worker=new Worker(new URL('./repdb-worker.js',import.meta.url),{type:'module'});const timer=setTimeout(()=>{worker.terminate();reject(Error('RepDB timeout'));},20000);const finish=(fn,value)=>{clearTimeout(timer);worker.terminate();fn(value);};worker.onmessage=e=>e.data.error?finish(reject,Error(e.data.error)):finish(resolve,e.data);worker.onerror=()=>finish(reject,Error('RepDB worker unavailable'));worker.postMessage(REPDB_URL);});
   else data=await fetchRepdb(fetcher);
   const rows=await mapRepdb(data,names);status='ready';return rows;
 }catch{status='unavailable';loading=null;return [];}})();return loading;
}
