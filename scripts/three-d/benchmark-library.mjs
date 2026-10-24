// Offline DOM-construction benchmark; explicitly not a browser paint benchmark.
import {readFile,writeFile} from 'node:fs/promises';
import {Window} from '../../tests/node_modules/happy-dom/lib/index.js';
const window=new Window({url:'http://localhost/#/library',width:375,height:812});
for(const key of ['window','document','localStorage','sessionStorage','navigator','location','MutationObserver'])Object.defineProperty(globalThis,key,{value:key==='window'?window:window[key],configurable:true});
const {EXERCISES}=await import('../../app/js/exercises.js');
const {L,esc}=await import('../../app/js/ui.js');
const {exerciseMuscles}=await import('../../app/js/muscle-map.js');
const {photoHTML}=await import('../../app/js/exercise-library.js');
const {filterExercises,mountPages}=await import('../../app/js/library-paging.js');
if(!process.env.ROUND15_BASELINE)throw Error('Set ROUND15_BASELINE to git show HEAD:app/js/views/library.js output.');
const old=await readFile(process.env.ROUND15_BASELINE,'utf8'),current=await readFile(new URL('../../app/js/views/library.js',import.meta.url),'utf8');
const records=JSON.parse(await readFile(new URL('../../app/data/exercise-db.json',import.meta.url))),rows=[...EXERCISES,...(Array.isArray(records)?records:records.exercises)];
const art=JSON.parse(await readFile(new URL('../../app/data/illustrations-3d.json',import.meta.url)));
const result={environment:'happy-dom; 375x812 configuration, no browser layout or paint',dataset:'40 original + 876 vendored Free Exercise DB; RepDB not downloaded',count:rows.length};
for(const [label,source,start] of [['before',old,'function results(root)'],['after',current,'const pageStops=']]){
 const fragment=source.slice(source.indexOf(start),source.indexOf('views.library.mount='));
 const render=new Function('loaded','rows','EXERCISES','L','exerciseMuscles','search','filters','illustrations','esc','photoHTML','filterExercises','mountPages',fragment+';return results;')(true,rows,EXERCISES,L,exerciseMuscles,'',{},art,esc,photoHTML,filterExercises,mountPages);
 const times=[];let root;
 for(let i=0;i<5;i++){root=document.createElement('section');root.innerHTML='<p id="library-count"></p><div id="library-results"></div>';document.body.replaceChildren(root);const t=performance.now();render(root);times.push(performance.now()-t);}
 result[label]={cards:root.querySelectorAll('.ex-card').length,images:root.querySelectorAll('img').length,nodes:root.querySelectorAll('*').length,constructionMs:times,medianMs:[...times].sort((a,b)=>a-b)[2]};
}
await writeFile(new URL('../../docs/round15-screens/library-dom.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));window.happyDOM.abort();
