// Conservative equivalence: preserve equipment and variants unless explicitly paired.
export const normalizedName=name=>String(name).toLowerCase().replace(/dumbbells?/g,'db').replace(/push[ -]?ups?/g,'pushup').replace(/pull[ -]?ups?/g,'pullup').replace(/[^a-z0-9]/g,'');
export function mergeExercises(rows,aliases=[]){
 const parent=new Map(rows.map(e=>[e.id,e.id])),find=id=>{while(parent.get(id)!==id)id=parent.get(id);return id;},join=(a,b)=>parent.set(find(b),find(a));
 for(const group of Array.isArray(aliases)?aliases:[])if(Array.isArray(group)){const present=group.filter(id=>parent.has(id));for(const id of present.slice(1))join(present[0],id);}
 const equipment=e=>e.equipment||({none:'body only',db:'dumbbell',gym:'gym'})[e.equip];
 const names=new Map();for(const row of rows){const key=normalizedName(row.name.en)+'|'+equipment(row);if(names.has(key))join(names.get(key),row.id);else names.set(key,row.id);}
 const groups=new Map();for(const row of rows){const key=find(row.id);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
 return [...groups.values()].map(entries=>{entries.sort((a,b)=>(a.frames?0:a.source==='repdb'?1:2)-(b.frames?0:b.source==='repdb'?1:2));const best=entries[0];return {...best,equipment:equipment(best),aliases:entries.map(e=>e.id),sources:[...new Set(entries.map(e=>e.source||'fixmee'))],searchNames:entries.flatMap(e=>Object.values(e.name)).filter(Boolean).join(' '),repdb:entries.find(e=>e.source==='repdb')};});
}
