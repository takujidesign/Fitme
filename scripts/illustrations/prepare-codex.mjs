// Local conversion only. Never calls an image provider or reads repo-root photos.
// Receipts point exclusively to built-in Codex PNG outputs inspected by the reviewer.
import {readFile,writeFile,mkdir,readdir,copyFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {EXERCISES} from '../../app/js/exercises.js';
const dir=new URL('./receipts/',import.meta.url),out=new URL('../../app/img/ex/',import.meta.url);
await mkdir(out,{recursive:true});
for(const name of (await readdir(dir)).filter(n=>/^codex-[a-z_]+-(start|finish)\.json$/.test(n))){
 const row=JSON.parse(await readFile(new URL(name,dir),'utf8'));
 if(!EXERCISES.some(e=>e.id===row.id)||!['start','finish'].includes(row.pose)||!/[\\/]\.codex[\\/]generated_images[\\/].+\.png$/.test(row.path))throw Error('Invalid built-in receipt');
 const result=await sharp(row.path).resize(768,768,{fit:'contain',background:'#ffffff'}).webp({quality:80}).toFile(fileURLToPath(new URL(`${row.id}-${row.pose}.webp`,out)));
 if(result.width!==768||result.height!==768||result.size>90000)throw Error('Image dimensions/size exceed budget: '+name);
}
const reviewURL=new URL('../../docs/round9-screens/round9b-review.json',import.meta.url);
let review={};try{review=JSON.parse(await readFile(reviewURL,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const manifest={},inventory=[];
for(const ex of EXERCISES){
 const decision=review[ex.id];
 if(decision?.approved&&decision.static)await copyFile(new URL(`${ex.id}-start.webp`,out),new URL(`${ex.id}-finish.webp`,out));
 const poses=[];for(const pose of ['start','finish']){let bytes=0;try{bytes=(await stat(new URL(`${ex.id}-${pose}.webp`,out))).size;}catch{}poses.push({pose,bytes});}
 if(decision?.approved){if(poses.some(p=>!p.bytes))throw Error('Missing approved pose: '+ex.id);manifest[ex.id]={start:`img/ex/${ex.id}-start.webp`,finish:`img/ex/${ex.id}-finish.webp`,source:'ai',tool:'Codex image generation',created:'2026-10-21'};}
 inventory.push({id:ex.id,name:ex.name.en,approved:!!manifest[ex.id],note:decision?.note||'Pending visual review',poses});
}
await writeFile(new URL('../../app/data/illustrations.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
await writeFile(new URL('../../docs/round9-screens/round9b-inventory.json',import.meta.url),JSON.stringify(inventory,null,2)+'\n');
const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Round 9B illustrations review</title><style>body{font:16px system-ui;background:#eef0f3;color:#20242a;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:20px}article{background:white;padding:16px;border-radius:12px}h2{font-size:18px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}figure{margin:0}img{width:100%;aspect-ratio:1;object-fit:contain}.missing{aspect-ratio:1;display:grid;place-items:center;background:#eee}small{color:#555}</style><h1>Round 9B: all 40 exercise pairs</h1><p>OpenAI image generation through Codex. Only visually approved complete pairs are enabled in the app. Missing or rejected poses are explicitly marked.</p><p>${inventory.filter(r=>r.approved).length} approved pairs · ${inventory.reduce((n,r)=>n+r.poses.reduce((a,p)=>a+p.bytes,0),0).toLocaleString('en')} bytes of generated WebP files.</p><main>${inventory.map(r=>`<article><h2>${esc(r.name)} (${r.id})</h2><p>${r.approved?'Approved':'Not enabled'} — ${esc(r.note)}</p><div class="pair">${r.poses.map(p=>`<figure>${p.bytes?`<img loading="lazy" src="../../app/img/ex/${r.id}-${p.pose}.webp" alt="${esc(r.name)} ${p.pose}">`:'<div class="missing">Not generated</div>'}<figcaption>${p.pose} · ${p.bytes?Math.round(p.bytes/1024)+' KiB':'missing'}</figcaption></figure>`).join('')}</div></article>`).join('')}</main></html>`;
await writeFile(new URL('../../docs/round9-screens/illustrations.html',import.meta.url),html);
console.log(`Converted Codex images; ${Object.keys(manifest).length} reviewed pairs approved. Contact sheet and inventory refreshed.`);
