import { z } from 'zod/v4';
import { admin, fail, input, enc, hex } from './security.js';
const identifier=s=>'"'+s.replaceAll('"','""')+'"';
export async function uploadStream(bucket,key,stream){
 // CompressionStream has no known length. R2 multipart accepts bounded byte arrays.
 // https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
 const upload=await bucket.createMultipartUpload(key,{httpMetadata:{contentType:'application/gzip'}}),parts=[],reader=stream.getReader();
 const buffer=new Uint8Array(8*1024*1024);let used=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;let offset=0;while(offset<value.length){const count=Math.min(buffer.length-used,value.length-offset);buffer.set(value.subarray(offset,offset+count),used);used+=count;offset+=count;if(used===buffer.length){parts.push(await upload.uploadPart(parts.length+1,buffer.slice()));used=0;}}}if(used)parts.push(await upload.uploadPart(parts.length+1,buffer.slice(0,used)));await upload.complete(parts);}catch(e){await reader.cancel().catch(()=>{});await upload.abort();throw e;}finally{reader.releaseLock();}
}
export function pruneBackups(objects){const daily=objects.filter(o=>/^backups\/\d{4}-\d{2}-\d{2}\.json\.gz$/.test(o.key)).sort((a,b)=>b.key.localeCompare(a.key)),monthly=objects.filter(o=>/^monthly\/\d{4}-\d{2}\.json\.gz$/.test(o.key)).sort((a,b)=>b.key.localeCompare(a.key));return [...daily.slice(30),...monthly.slice(12)].map(o=>o.key);}
async function listing(env){let cursor,all=[];do{const p=await env.BACKUPS.list({cursor,limit:1000});all.push(...p.objects);cursor=p.truncated?p.cursor:undefined;}while(cursor);return all;}
export async function backup(env,now=Date.now()){
 if(!env.BACKUPS||!env.DB||!env.CONFIG)return;const date=new Date(now+7*3600000).toISOString().slice(0,10),key='backups/'+date+'.json.gz';if(await env.BACKUPS.head(key))return;
 const tables=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all()).results.map(t=>t.name),kv=[];let cursor;
 do{const p=await env.CONFIG.list({cursor});for(const item of p.keys)kv.push({name:item.name,value:await env.CONFIG.get(item.name),expiration:item.expiration});cursor=p.list_complete?undefined:p.cursor;}while(cursor);
 // Stream pages into gzip rather than assembling the whole database in memory.
 async function* chunks(){yield '{"version":1,"createdAt":'+now+',"config":'+JSON.stringify(kv)+',"tables":{';let first=true;for(const table of tables){yield (first?'':',')+JSON.stringify(table)+':[';first=false;let offset=0,comma=false;while(true){const page=(await env.DB.prepare('SELECT * FROM '+identifier(table)+' LIMIT 250 OFFSET ?').bind(offset).all()).results;for(const row of page){yield (comma?',':'')+JSON.stringify(row);comma=true;}if(page.length<250)break;offset+=250;}yield ']';}yield '}}';}
 const iterator=chunks(),stream=new ReadableStream({async pull(controller){try{const n=await iterator.next();if(n.done)controller.close();else controller.enqueue(enc.encode(n.value));}catch(e){controller.error(e);}}}).pipeThrough(new CompressionStream('gzip'));
 await uploadStream(env.BACKUPS,key,stream);
 const monthly='monthly/'+date.slice(0,7)+'.json.gz';if(!await env.BACKUPS.head(monthly)){const object=await env.BACKUPS.get(key);await env.BACKUPS.put(monthly,object.body,{httpMetadata:{contentType:'application/gzip'}});}
 for(const old of pruneBackups(await listing(env)))await env.BACKUPS.delete(old);
}
async function signature(env,value){if(!env.TOKEN_SECRET)throw fail('TOKEN_SECRET required',503);const k=await crypto.subtle.importKey('raw',enc.encode(env.TOKEN_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,enc.encode('backup:'+value)));}
export async function backupRoute(req,env){const url=new URL(req.url);if(url.pathname==='/api/admin/backups')await admin(req,env);if(!env.BACKUPS)throw fail('BACKUPS binding required',503);
 if(url.pathname==='/api/backups/download'){const b=z.object({key:z.string().regex(/^(backups\/\d{4}-\d{2}-\d{2}|monthly\/\d{4}-\d{2})\.json\.gz$/),expires:z.coerce.number().int(),sig:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(Object.fromEntries(url.searchParams));if(b.expires<Date.now()||b.expires>Date.now()+300000||b.sig!==await signature(env,b.key+':'+b.expires))throw fail('Expired or invalid link',403);const o=await env.BACKUPS.get(b.key);if(!o)throw fail('Not found',404);return new Response(o.body,{headers:{'Content-Type':'application/gzip','Content-Disposition':'attachment; filename="'+b.key.split('/').at(-1)+'"','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});}
 if(req.method==='GET')return {backups:(await listing(env)).map(o=>({key:o.key,size:o.size}))};if(req.method==='POST'){const b=await input(req,z.object({key:z.string().regex(/^(backups\/\d{4}-\d{2}-\d{2}|monthly\/\d{4}-\d{2})\.json\.gz$/)}).strict()),expires=Date.now()+60000;return {url:url.origin+'/api/backups/download?'+new URLSearchParams({key:b.key,expires:String(expires),sig:await signature(env,b.key+':'+expires)})};}throw fail('Method not allowed',405);
}
