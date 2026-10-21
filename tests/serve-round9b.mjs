// Isolated actual exercise sheet; serves app/ only, never repository-root files.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const app=resolve(import.meta.dirname,'../app');
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="/css/app.css"><style>.sheet,.sheet-backdrop,.visual-toggle .chip{transition:none!important}</style></head><body><main id="app"></main><script type="module">
import {setState} from '/js/store.js';import {actions} from '/js/core.js';import '/js/views/workout.js';
const q=new URLSearchParams(location.search);setState(s=>{s.lang=q.get('lang')||'en';s.theme=q.get('theme')||'dark'});document.documentElement.dataset.theme=q.get('theme')||'dark';
actions['ex-open']({dataset:{id:q.get('id')||'squat'}});
document.addEventListener('click',e=>{if(e.target.closest('[data-close]'))document.querySelector('.sheet-wrap')?.remove();});
</script></body></html>`;
createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'"});return res.end(html);}const file=resolve(app,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(app+sep))throw Error();const data=await readFile(file);res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp'})[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(404);res.end();}}).listen(5188,'127.0.0.1',()=>console.log('Round 9B actual exercise sheet http://127.0.0.1:5188/'));
