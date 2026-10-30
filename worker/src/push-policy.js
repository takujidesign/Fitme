import {user,query} from './accounts.js';
import {admin,input,fail} from './security.js';
import {cap} from './launch-security.js';
import {z} from 'zod/v4';
export const preferenceSchema=z.object({quietStart:z.string().regex(/^(?:|(?:[01]\d|2[0-3]):[0-5]\d)$/).default(''),quietEnd:z.string().regex(/^(?:|(?:[01]\d|2[0-3]):[0-5]\d)$/).default(''),chat:z.boolean().default(true),social:z.boolean().default(true),privacy:z.enum(['off','medications','all']).default('medications'),badge:z.boolean().default(true),lang:z.enum(['th','en','zh','ja','vi']).default('en')}).strict();
export function quietUntil(prefs={},tz='UTC',now=Date.now()){
 const {quietStart:a,quietEnd:b}=prefs;if(!a||!b||a===b)return now;
 const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}),inside=t=>a<b?t>=a&&t<b:t>=a||t<b;
 if(!inside(fmt.format(now)))return now;
 for(let at=Math.floor(now/60000)*60000+60000;at<=now+27*3600000;at+=60000)if(!inside(fmt.format(at)))return at;
 return now+86400000;
}
export async function ackOwner(req,env){
 if(/^Bearer\s+\S+/.test(req.headers.get('Authorization')||''))return (await user(req,env)).id;
 const id=req.headers.get('X-Push-Device');if(!/^[a-f0-9-]{36}$/.test(id||''))throw fail('Device authentication required',401);
 const record=await env.PUSH?.get('device:'+id,'json');if(!record||record.expires<Date.now())throw fail('Device authentication required',401);
 return (await query(env,'SELECT user_id FROM push_subscriptions WHERE device_id=?',id).first())?.user_id||'device:'+id;
}
export async function hasAck(env,owner,id){return !!(owner&&id&&await env.PUSH.get('ack:'+owner+':'+id));}
export async function pushAck(req,env){
 const owner=await ackOwner(req,env);await cap(env,'push-ack',owner,120,60000);
 if(req.method==='POST'){const b=await input(req,z.object({id:z.string().min(1).max(400),action:z.enum(['done','snooze']),at:z.number().finite()}).strict());const item={...b,at:Date.now()};await env.PUSH.put('ack:'+owner+':'+b.id,JSON.stringify(item),{expirationTtl:172800});return {ok:true};}
 if(req.method!=='GET')throw fail('Method not allowed',405);
 const since=Math.max(Date.now()-172800000,Number(new URL(req.url).searchParams.get('since'))||0),items=[];let cursor;
 do{const page=await env.PUSH.list({prefix:'ack:'+owner+':',...(cursor?{cursor}:{})});for(const {name} of page.keys){const a=await env.PUSH.get(name,'json');if(a?.at>=since)items.push(a);}cursor=page.list_complete?null:page.cursor;}while(cursor);return {items};
}
export async function recordFailure(env,device,endpoint,status,now=Date.now()){
 if(!env.DB)return;let host;try{host=new URL(endpoint).hostname;}catch{host='unknown';}
 // Never retain provider response bodies: they may echo endpoints or payload data.
 const reason=status===0?'Transport error':[404,410].includes(status)?'Subscription removed':'Push service rejected request';
 await query(env,'INSERT INTO push_failures VALUES(?,?,?,?,?,?)',crypto.randomUUID(),device.slice(0,8),host,status,reason,now).run();await pruneFailures(env,now);
}
export async function pruneFailures(env,now=Date.now()){if(env.DB)await query(env,'DELETE FROM push_failures WHERE at<?',now-30*86400000).run();}
export async function pushDiagnostics(req,env){await admin(req,env);await pruneFailures(env);const days=Math.max(1,Math.min(30,Number(new URL(req.url).searchParams.get('days'))||7)),since=Date.now()-days*86400000;return {items:(await query(env,'SELECT device,host,status,reason,at FROM push_failures WHERE at>=? ORDER BY at DESC LIMIT 50',since).all()).results,services:(await query(env,'SELECT host,count(*) failures,sum(CASE WHEN status IN (404,410) THEN 1 ELSE 0 END) cleanups FROM push_failures WHERE at>=? GROUP BY host',since).all()).results};}
