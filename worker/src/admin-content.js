import {z} from 'zod/v4';
import {query as q} from './accounts.js';
import {input,fail,hash} from './security.js';
import {EX} from '../../app/js/exercises.js';
import {FOOD} from '../../app/js/foods.js';
const labels=z.object({th:z.string().min(1).max(200),en:z.string().min(1).max(200),zh:z.string().max(200).optional(),ja:z.string().max(200).optional(),vi:z.string().max(200).optional()}).strict();
const steps=z.object({th:z.array(z.string().max(500)).max(20),en:z.array(z.string().max(500)).max(20),zh:z.array(z.string().max(500)).max(20).optional(),ja:z.array(z.string().max(500)).max(20).optional(),vi:z.array(z.string().max(500)).max(20).optional()}).strict();
export async function adminContent(req,env,section){
 if(section!=='illustrations'&&section!=='recipes')return null;
 if(req.method==='GET')return {items:(await q(env,'SELECT * FROM content_overrides WHERE kind=? ORDER BY updated DESC',section).all()).results.map(r=>({...r,value:JSON.parse(r.json)}))};
 let key,value,status;
 if(req.method==='PUT'){
  const b=await input(req,z.object({id:z.string().regex(/^[a-z0-9_-]{1,80}$/),status:z.enum(['approved','rejected'])}).strict());key=b.id;status=b.status;
  if(!await q(env,'SELECT 1 FROM content_overrides WHERE kind=? AND id=?',section,key).first())throw fail('Not found',404);
  await q(env,'UPDATE content_overrides SET status=?,updated=? WHERE kind=? AND id=?',status,Date.now(),section,key).run();
 }else if(req.method==='POST'&&section==='recipes'){
  value=await input(req,z.object({id:z.string().regex(/^[a-z0-9_-]{1,80}$/),name:labels,ingredients:z.array(z.object({id:z.string().refine(v=>!!FOOD[v]),grams:z.number().positive().max(10000)}).strict()).min(1).max(40),steps,servings:z.number().int().min(1).max(100),prepMinutes:z.number().int().min(0).max(1440),tags:z.array(z.string().max(40)).max(20)}).strict());key=value.id;
 }else if(req.method==='POST'&&section==='illustrations'){
  const b=await input(req,z.object({id:z.string().refine(v=>!!EX[v]),start:z.string().max(1400000),finish:z.string().max(1400000)}).strict(),2900000);key=b.id;value={};const bytes={};
  for(const pose of ['start','finish']){try{bytes[pose]=Uint8Array.from(atob(b[pose]),c=>c.charCodeAt(0));}catch{throw fail('Invalid image');}if(bytes[pose].length>1000000||new TextDecoder().decode(bytes[pose].slice(0,4))!=='RIFF'||new TextDecoder().decode(bytes[pose].slice(8,12))!=='WEBP')throw fail('WebP up to 1 MB required');}
  if(!env.MEDIA)throw fail('Media unavailable',503);for(const pose of ['start','finish']){value[pose]=`illustrations/${key}/${crypto.randomUUID()}.webp`;await env.MEDIA.put(value[pose],bytes[pose],{httpMetadata:{contentType:'image/webp'}});}
 }else throw fail('Method not allowed',405);
 if(value){const old=await q(env,'SELECT json FROM content_overrides WHERE kind=? AND id=?',section,key).first();await q(env,"INSERT INTO content_overrides VALUES(?,?,?,'pending',?) ON CONFLICT(kind,id) DO UPDATE SET json=excluded.json,status='pending',updated=excluded.updated",section,key,JSON.stringify(value),Date.now()).run();if(section==='illustrations'&&old)for(const file of Object.values(JSON.parse(old.json)))await env.MEDIA.delete(file);}
 await q(env,'INSERT INTO admin_audit VALUES(?,?,?,?,?,?)',crypto.randomUUID(),(await hash(req.headers.get('Authorization')||'')).slice(0,16),section,key,JSON.stringify({status:status||'pending'}),Date.now()).run();return {ok:true};
}
export async function publicContent(req,env,path){
 if(req.method!=='GET')return null;
 const match=path.match(/^\/api\/feed\/(illustrations|recipes)(?:\/([a-z0-9_-]+)\/(start|finish))?$/);if(!match)return null;
 if(match[2]){const row=await q(env,"SELECT json FROM content_overrides WHERE kind='illustrations' AND id=? AND status='approved'",match[2]).first();if(!row)throw fail('Not found',404);const object=await env.MEDIA?.get(JSON.parse(row.json)[match[3]]);if(!object)throw fail('Not found',404);return new Response(object.body,{headers:{'Content-Type':'image/webp','Cache-Control':'public,max-age=60','X-Content-Type-Options':'nosniff'}});}
 return {items:(await q(env,"SELECT id,json,updated FROM content_overrides WHERE kind=? AND status='approved'",match[1]).all()).results.map(r=>match[1]==='recipes'?JSON.parse(r.json):{id:r.id,updated:r.updated})};
}
