// Review only our generated assets, never upstream exercise artwork.
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {EXERCISES} from '../../app/js/exercises.js';
const root=new URL('../../',import.meta.url), out=new URL('docs/round14-screens/',root);
const manifest=JSON.parse(await readFile(new URL('app/data/illustrations-3d.json',root),'utf8'));
const report=[];
for(const ex of EXERCISES)for(const pose of ['start','finish']){
 const file=new URL(`app/img/ex3d/${ex.id}-${pose}.webp`,root),meta=await sharp(fileURLToPath(file)).metadata(),bytes=(await stat(file)).size;
 if(meta.width!==768||meta.height!==768||bytes>90000)throw Error(`Invalid asset ${ex.id}-${pose}`);
 report.push({id:ex.id,pose,width:meta.width,height:meta.height,bytes,enabled:!!manifest[ex.id]});
}
for(let batch=0;batch<4;batch++){
 const parts=[];for(const [i,ex] of EXERCISES.slice(batch*10,batch*10+10).entries())for(const [p,pose] of ['start','finish'].entries()){
  const left=((i%2)*2+p)*320,top=Math.floor(i/2)*350;
  parts.push({input:await sharp(fileURLToPath(new URL(`app/img/ex3d/${ex.id}-${pose}.webp`,root))).resize(320,320).toBuffer(),left,top});
  parts.push({input:Buffer.from(`<svg width="320" height="30"><text x="8" y="22" font-size="18">${ex.id} ${pose}</text></svg>`),left,top:top+320});
 }
 await sharp({create:{width:1280,height:1750,channels:3,background:'#fff'}}).composite(parts).png().toFile(fileURLToPath(new URL(`review-${batch+1}.png`,out)));
}
await writeFile(new URL('asset-checks.json',out),JSON.stringify(report,null,2)+'\n');
await writeFile(new URL('ex3d.html',out),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Round 14 — original 3D illustrations</title><style>body{font:16px system-ui;margin:24px;background:#eee;color:#222}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}section{background:white;padding:12px;border-radius:12px}.pair{display:flex}figure{margin:0;width:50%}img{width:100%;height:auto}figcaption{text-align:center}</style><h1>Original Codex 3D illustrations</h1><p>Text-only generation. No RepDB images or other reference images were supplied. Start / Finish; static holds reuse one image. See ROUND14_VALIDATION.md for review limitations.</p><main>${EXERCISES.map(e=>`<section><h2>${e.id}</h2><p>${manifest[e.id]?'Enabled':'Withheld; existing fallback used'}</p><div class="pair">${['start','finish'].map(p=>`<figure><a href="../../app/img/ex3d/${e.id}-${p}.webp"><img loading="lazy" src="../../app/img/ex3d/${e.id}-${p}.webp" alt="${e.id} ${p}"></a><figcaption>${p}</figcaption></figure>`).join('')}</div></section>`).join('')}</main></html>`);
console.log(JSON.stringify({assets:report.length,totalBytes:report.reduce((n,r)=>n+r.bytes,0),maximumBytes:Math.max(...report.map(r=>r.bytes)),enabledExercises:Object.keys(manifest).length}));
