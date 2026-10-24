import { isRepdbImage } from './repdb.js';
import { esc } from './ui.js';
import { equipmentFor, styleAllows } from './training.js';
import { healthAllowed } from './womens-health.js';
import { EX } from './exercises.js';
import { getState, setState, subscribe } from './store.js';
export function adaptExercise(e){return {...e,source:'free-exercise-db',name:{th:e.nameTh,en:e.name},muscles:{th:e.primaryMuscles.join(', '),en:e.primaryMuscles.join(', ')},cues:{th:e.instructionsTh.length?e.instructionsTh:e.instructions,en:e.instructions},equip:e.equipment==='body only'?'none':e.equipment==='dumbbell'?'db':'gym',level:({beginner:1,intermediate:2,expert:3})[e.level]||3,sourceLevel:e.level,group:e.category==='stretching'?'mobility':e.category==='cardio'?'cardio':e.primaryMuscles.some(x=>['quads','hamstrings','glutes','calves','adductors'].includes(x))?'legs':e.primaryMuscles.includes('abs')?'core':e.primaryMuscles.some(x=>['chest','triceps','front_delts'].includes(x))?'push':'pull',type:e.category==='stretching'||e.category==='cardio'?'time':'reps',met:e.category==='cardio'?6:3.5};}
const restore=()=>{for(const e of Object.values(getState().libraryExercises||{}))EX[e.id]=e;};restore();subscribe(restore);
let loading;
export async function loadLibrary(){if(!loading)loading=fetch(new URL('../data/exercise-db.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Exercise library unavailable offline until downloaded');return r.json();}).then(rows=>rows.map(adaptExercise)).catch(e=>{loading=null;throw e;});return loading;}
export function retainExercise(e){EX[e.id]=e;if(e.source)setState(s=>{s.libraryExercises[e.id]=e;});}
export function libraryAllowed(p,e){const equipment=equipmentFor(p);return healthAllowed(p,e.id)&&styleAllows(p,e)&& ![e.id,...(e.aliases||[])].some(id=>p.avoidEx?.includes(id))&&equipment.includes(e.equip)&&e.level<=({beginner:1,intermediate:2,advanced:3}[p.level]||1);}
const safeImage=src=>isRepdbImage(src)?src:/^https:\/\/cdn\.jsdelivr\.net\/gh\/yuhonas\/free-exercise-db@[a-f0-9]{40}\/exercises\/[A-Za-z0-9_\/-]+\.jpg$/.test(src)?src:'';
export function photoHTML(ex,{attribution=true}={}){return `<div class="exercise-photos">${(ex.images||[]).slice(0,2).map((src,i)=>`<img src="${esc(safeImage(src))}" loading="lazy" alt="${i+1}" class="photo-${i}" referrerpolicy="no-referrer">`).join('')}</div>${attribution?sourceHTML(ex):''}`;}
export function sourceHTML(ex){return ex.source==='repdb'||ex.repdb?'<p class="note"><a href="https://repdb.co/" target="_blank" rel="noopener noreferrer">RepDB</a></p>':'';}
