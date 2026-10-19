import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export const COMMIT='f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5';
export const MUSCLES={abdominals:['abs','obliques'],hamstrings:['hamstrings'],adductors:['adductors'],quadriceps:['quads'],biceps:['biceps'],shoulders:['front_delts','rear_delts'],chest:['chest'],'middle back':['traps','lats'],calves:['calves'],glutes:['glutes'],'lower back':['lower_back'],lats:['lats'],triceps:['triceps'],traps:['traps'],forearms:['forearms'],neck:['neck'],abductors:['glutes']};
export function mapExercise(e,names={}){
 const map=xs=>[...new Set(xs.flatMap(m=>{if(!MUSCLES[m])throw Error('Unknown muscle '+m);return MUSCLES[m];}))];
 if(!e.primaryMuscles.length)throw Error('Missing primary muscles: '+e.id);
 return {id:'db-'+e.id,name:e.name,nameTh:names[e.id]?.name||e.name,force:e.force,level:e.level,mechanic:e.mechanic,equipment:e.equipment,category:e.category,primaryMuscles:map(e.primaryMuscles),secondaryMuscles:map(e.secondaryMuscles),instructions:e.instructions,instructionsTh:names[e.id]?.instructions||[],images:e.images.map(p=>`https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${COMMIT}/exercises/${p}`)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const response=await fetch(`https://raw.githubusercontent.com/yuhonas/free-exercise-db/${COMMIT}/dist/exercises.json`);if(!response.ok)throw Error('Download failed '+response.status);
 const names=JSON.parse(await readFile(new URL('./exercise-names-th.json',import.meta.url),'utf8'));
 const data=(await response.json()).map(e=>mapExercise(e,names));await mkdir(new URL('../app/data/',import.meta.url),{recursive:true});await writeFile(new URL('../app/data/exercise-db.json',import.meta.url),JSON.stringify(data));console.log(`Imported ${data.length} exercises at ${COMMIT}`);
}
