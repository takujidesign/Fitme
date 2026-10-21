import {createServer} from 'node:http';
import {readFile,access} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {directory,output,downloaded,atomicJSON} from './generate.mjs';
const manifestFile=path.resolve(directory,'../../app/data/illustrations.json');
const read=async(file,fallback)=>{try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}};
export async function createReviewServer({manifest=manifestFile,out=output,dir=directory}={}) {
 const prompts=await read(path.join(dir,'prompts.json'),{exercises:[]}),ids=new Set(prompts.exercises.map(e=>e.id)),token=randomBytes(24).toString('hex');
 let writes=Promise.resolve();
 const server=createServer(async(req,res)=>{
  const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  try{
   const url=new URL(req.url,'http://localhost'),origin=`http://127.0.0.1:${server.address().port}`;
   if(req.headers.host!==new URL(origin).host)return send(403,{error:'Local host only'});
   if(req.method==='GET'&&url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self'; frame-ancestors 'none'"});return res.end((await readFile(path.join(directory,'review.html'),'utf8')).replace('__TOKEN__',token));}
   if(req.method==='GET'&&url.pathname==='/pairs'){
    const approved=await read(manifest,{}),rows=[];
    for(const id of ids)if(await downloaded(path.join(out,id+'-start.webp'))&&await downloaded(path.join(out,id+'-finish.webp')))rows.push({id,approved:!!approved[id]});
    return send(200,rows);
   }
   const image=url.pathname.match(/^\/img\/([a-z0-9_-]+)-(start|finish)\.webp$/i);
   if(req.method==='GET'&&image&&ids.has(image[1])){res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'no-store'});return res.end(await readFile(path.join(out,image[1]+'-'+image[2]+'.webp')));}
   if(req.method!=='POST'||url.pathname!=='/decision')return send(404,{error:'Not found'});
   if(req.headers.origin!==origin||req.headers['x-review-token']!==token||req.headers['content-type']!=='application/json')return send(403,{error:'Invalid review origin/token'});
   if(await access(path.join(dir,'generate.lock')).then(()=>true,()=>false))return send(409,{error:'Wait for the generator to finish before reviewing'});
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)return send(413,{error:'Too large'});}
   const {id,decision}=JSON.parse(raw);if(!ids.has(id)||!['approve','regenerate','reject'].includes(decision))return send(400,{error:'Invalid decision'});
   const work=writes.then(async()=>{
    const approved=await read(manifest,{});
    if(decision==='approve'){
     const receipts=await Promise.all(['start','finish'].map(p=>read(path.join(dir,'receipts',`${id}-${p}.json`),null)));
     if(receipts.some(r=>r?.state!=='downloaded')||receipts[0].model!==receipts[1].model||!(await downloaded(path.join(out,id+'-start.webp')))||!(await downloaded(path.join(out,id+'-finish.webp'))))throw Error('Pair or matching model receipts missing');
     approved[id]={start:`img/ex/${id}-start.webp`,finish:`img/ex/${id}-finish.webp`,source:'ai',model:receipts[0].model,created:receipts[0].created};
    } else delete approved[id];
    await atomicJSON(manifest,approved);
    const queue=await read(path.join(dir,'queue.json'),[]);await atomicJSON(path.join(dir,'queue.json'),decision==='regenerate'?[...new Set([...queue,id])]:queue.filter(item=>item!==id));
   });writes=work.catch(()=>{});await work;send(200,{ok:true});
  }catch(e){send(400,{error:e.code==='ENOENT'?'File missing':e.message});}
 });return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const server=await createReviewServer();server.listen(Number(process.env.PORT)||5189,'127.0.0.1',()=>console.log(`Review: http://127.0.0.1:${server.address().port}`));}
