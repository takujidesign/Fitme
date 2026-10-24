import {L} from './ui.js';
import {exerciseMuscles} from './muscle-map.js';
export const PAGE_SIZE=40;
// Deliberately identical to the original library predicate.
export function filterExercises(rows,search='',filters={}) {
 return rows.filter(e=>(e.searchNames||L(e.name)+' '+e.name.en).toLowerCase().includes(search.toLowerCase())&&(!filters.source||(e.sources||[e.source||'fixmee']).includes(filters.source))&&(!filters.muscle||exerciseMuscles(e).includes(filters.muscle))&&(!filters.equipment||e.equipment===filters.equipment)&&(!filters.level||(e.sourceLevel||['','beginner','intermediate','expert'][e.level])===filters.level)&&(!filters.category||(e.category||'strength')===filters.category));
}
export function mountPages(host,rows,card,sentinel){
 let count=0,observer,stopped=false;
 const append=()=>{if(stopped)return;host.insertAdjacentHTML('beforeend',rows.slice(count,count+PAGE_SIZE).map(card).join(''));count=Math.min(rows.length,count+PAGE_SIZE);sentinel.hidden=count===rows.length;if(sentinel.hidden)observer?.disconnect();};
 append();sentinel.onclick=append;
 if(globalThis.IntersectionObserver&&!sentinel.hidden){observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))append();},{rootMargin:'160px'});observer.observe(sentinel);}
 return ()=>{stopped=true;observer?.disconnect();sentinel.onclick=null;};
}
