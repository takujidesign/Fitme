import {readdir,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('app');const files=[];
async function walk(relative){for(const entry of await readdir(path.join(root,relative),{withFileTypes:true})){const rel=relative+'/'+entry.name;if(entry.isDirectory())await walk(rel);else if(entry.isFile())files.push(rel);}}
// Deliberately enumerate only our explicit asset directories; never repo-root photos.
for(const name of await readdir(path.join(root,'data')))if(name.endsWith('.json')&&!/repdb/i.test(name))files.push('data/'+name);
await walk('img/ex');
for(const name of await readdir(path.join(root,'js/vendor/three')))if(name.endsWith('.js'))files.push('js/vendor/three/'+name);
files.push('js/three-viewer.js','js/three-motion.js');
const manifest=[];for(const file of files.sort()){if(/repdb|(?:^|\/)\.\./i.test(file))throw Error('Forbidden offline asset');manifest.push({url:'./'+file,bytes:(await stat(path.join(root,file))).size});}
await writeFile(path.join(root,'offline-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({assets:manifest.length,bytes:manifest.reduce((n,a)=>n+a.bytes,0),budget:40*1024*1024}));
