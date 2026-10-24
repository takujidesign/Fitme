// Convert only original Codex outputs; never accepts RepDB or repo-root images.
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {EXERCISES} from '../../app/js/exercises.js';
const receiptPath=process.argv[2];if(!receiptPath)throw Error('Pass the local receipt JSON path');
const receipts=JSON.parse((await readFile(receiptPath,'utf8')).replace(/^\uFEFF/,''));const out=new URL('../../app/img/ex3d/',import.meta.url);await mkdir(out,{recursive:true});
for(const r of receipts){if(!EXERCISES.some(e=>e.id===r.id)||!['start','finish'].includes(r.pose)||!/[\\/]\.codex[\\/]generated_images[\\/].+\.png$/.test(r.path))throw Error('Only original built-in outputs accepted');const dest=new URL(`${r.id}-${r.pose}.webp`,out);let q=80;while(true){const buf=await sharp(r.path).resize(768,768,{fit:'contain',background:'#f4f4f4'}).webp({quality:q}).toBuffer();if(buf.length<=90000){await writeFile(dest,buf);break;}if((q-=5)<40)throw Error('Cannot meet image budget');}}
console.log('Converted',receipts.length,'original images to 768px WebP');
