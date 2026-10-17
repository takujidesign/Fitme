// Refresh the English-key manifest when adding UI copy; dictionaries are static at runtime.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../app/js/',import.meta.url)),strings=new Set();
const literal=/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g;
const decode=s=>s.slice(1,-1).replace(/\\(['"\\])/g,'$1').replace(/\\n/g,'\n');
async function scan(dir){for(const file of await readdir(dir,{withFileTypes:true})){if(file.name==='i18n')continue;const full=path.join(dir,file.name);if(file.isDirectory()){await scan(full);continue;}if(!file.name.endsWith('.js'))continue;const source=await readFile(full,'utf8'),values=[...source.matchAll(literal)];
 for(let i=1;i<values.length;i++){const a=values[i-1],b=values[i];if(/^\s*,\s*$/.test(source.slice(a.index+a[0].length,b.index))&&/[\u0e00-\u0e7f]/.test(a[0])&&!/[\u0e00-\u0e7f]/.test(b[0]))strings.add(decode(b[0]));}
 for(const m of source.matchAll(/\ben:\s*('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")/g))strings.add(decode(m[1]));
 for(const m of source.matchAll(/\ben:\s*\[(.*?)\]/gs))for(const v of m[1].matchAll(literal))strings.add(decode(v[0]));
 for(const m of source.matchAll(/L\(`[^`]*`,\s*`([^`]*)`\)/g)){let i=0;const key=m[1].replace(/\$\{[^{}]*\}/g,()=>`{${i++}}`);if(!key.includes('${'))strings.add(key);}
}}
await scan(root);
await writeFile(new URL('./i18n-strings.json',import.meta.url),JSON.stringify([...strings].sort(),null,2)+'\n');
console.log(`Extracted ${strings.size} UI keys`);
