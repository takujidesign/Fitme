import {z} from 'zod/v4';
import {user,query as q} from './accounts.js';
import {input,fail,random,hash,admin,encrypt} from './security.js';
import {healthFields,healthRanges,mergeHealth} from '../../app/js/health-model.js';
export const providers=['fitbit','polar','withings','strava','oura'];
export const HealthDay=z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{try{return new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;}catch{return false;}}),tz:z.string().max(100).refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}}).optional(),...Object.fromEntries(healthFields.map(k=>[k,z.number().finite().transform(v=>Math.max(healthRanges[k][0],Math.min(healthRanges[k][1],v))).optional()]))}).strict().refine(v=>healthFields.some(k=>v[k]!=null));
export async function healthConsent(env,id){if(!await q(env,'SELECT accepted FROM health_consent WHERE user_id=?',id).first())throw fail('Health import consent required',403);}
export async function healthRate(env,key,max=60,window=3600000){const now=Date.now(),bucket=key+':'+Math.floor(now/window);await q(env,'DELETE FROM health_limits WHERE expires<?',now).run();const r=await q(env,'INSERT INTO health_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<? RETURNING count',bucket,now+window,max).first();if(!r)throw fail('Try again later',429);}
export async function saveHealth(env,id,source,days){await healthConsent(env,id);const parsed=days.map(d=>HealthDay.parse(d));await env.DB.batch(parsed.map(d=>q(env,`INSERT INTO health_daily(user_id,date,source,${healthFields.join(',')},updated) SELECT ?,?,?,${healthFields.map(()=>'?').join(',')},? WHERE EXISTS(SELECT 1 FROM health_consent WHERE user_id=?) ON CONFLICT(user_id,date,source) DO UPDATE SET ${healthFields.map(k=>k+'=excluded.'+k).join(',')},updated=excluded.updated`,id,d.date,source,...healthFields.map(k=>d[k]??null),Date.now(),id)));return {saved:parsed.length};}
export async function healthSnapshot(env,id){const days=(await q(env,'SELECT * FROM health_daily WHERE user_id=? ORDER BY date',id).all()).results;return {consent:!!await q(env,'SELECT accepted FROM health_consent WHERE user_id=?',id).first(),days,merged:mergeHealth(days),connections:(await q(env,'SELECT provider,last_sync,retry_at FROM health_connections WHERE user_id=?',id).all()).results,lastReceived:(await q(env,'SELECT last_received FROM health_tokens WHERE user_id=?',id).first())?.last_received||null};}
export async function clearHealth(env,id){await env.DB.batch(['health_daily','health_tokens','health_connections','health_flows','health_consent'].map(t=>q(env,`DELETE FROM ${t} WHERE user_id=?`,id)));await purgeHealthState(env,id);}
export async function healthSettings(req,env){await admin(req,env);let saved=await env.CONFIG.get('health-settings','json')||{};if(req.method==='PUT'){const b=await input(req,z.object({healthShortcutUrl:z.union([z.literal(''),z.string().url().refine(v=>{const u=new URL(v);return u.origin==='https://www.icloud.com'&&u.pathname.startsWith('/shortcuts/');})]),providers:z.object(Object.fromEntries(providers.map(p=>[p,z.object({enabled:z.boolean(),clientId:z.string().max(300),secret:z.string().max(4096).optional()}).strict()]))).strict()}).strict());for(const p of providers){const old=saved.providers?.[p];if(b.providers[p].secret===undefined)b.providers[p].secret=old?.secret;else if(b.providers[p].secret)b.providers[p].secret=await encrypt(env,'health-'+p,b.providers[p].secret);}saved=b;await env.CONFIG.put('health-settings',JSON.stringify(saved));}else if(req.method!=='GET')throw fail('Method not allowed',405);return {...saved,providers:Object.fromEntries(providers.map(p=>[p,{enabled:false,clientId:'',...saved.providers?.[p],secret:undefined,secretSet:!!saved.providers?.[p]?.secret}]))};}
export async function healthData(req,env,path){
 if(path==='/api/admin/health')return healthSettings(req,env);
 if(path==='/api/health/ingest'){
  if(req.method!=='POST')throw fail('Method not allowed',405);
  const token=req.headers.get('Authorization')?.match(/^Bearer (h_[a-f0-9]{64})$/)?.[1];const row=token&&await q(env,'SELECT * FROM health_tokens WHERE hash=? AND scope=?',await hash(token),'health:write').first();if(!row)throw fail('Invalid ingest token',401);
  await healthConsent(env,row.user_id);await healthRate(env,'ingest:'+row.hash);
  const b=await input(req,z.union([HealthDay,z.object({days:z.array(HealthDay).min(1).max(30)}).strict()]));const r=await saveHealth(env,row.user_id,'apple_shortcut',b.days||[b]);await q(env,'UPDATE health_tokens SET last_received=? WHERE hash=?',Date.now(),row.hash).run();return r;
 }
 const u=await user(req,env);
 if(path==='/api/health/data'&&req.method==='GET'){const settings=await env.CONFIG.get('health-settings','json')||{};return {...await healthSnapshot(env,u.id),healthShortcutUrl:settings.healthShortcutUrl||'',providers:Object.fromEntries(providers.map(p=>[p,!!settings.providers?.[p]?.enabled]))};}
 if(path==='/api/health/consent'){
  if(req.method==='POST'){await input(req,z.object({consent:z.literal(true)}).strict());await q(env,'INSERT INTO health_consent VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET accepted=excluded.accepted',u.id,Date.now()).run();return {consent:true};}
  if(req.method==='DELETE'){await clearHealth(env,u.id);return {consent:false};}
 }
 await healthConsent(env,u.id);
 if(path==='/api/health/token'){
  if(req.method==='DELETE'){await q(env,'DELETE FROM health_tokens WHERE user_id=?',u.id).run();return {};}
  if(req.method==='POST'){const token='h_'+random(32);await q(env,'INSERT INTO health_tokens(user_id,hash,scope) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET hash=excluded.hash,scope=excluded.scope,last_received=NULL',u.id,await hash(token),'health:write').run();return {token};}
 }
 if(path==='/api/health/days'&&req.method==='POST'){const b=await input(req,z.object({days:z.array(HealthDay).min(1).max(400)}).strict());return saveHealth(env,u.id,'apple_export',b.days);}
 if(path==='/api/health/source'&&req.method==='DELETE'){const b=await input(req,z.object({source:z.enum(['apple_shortcut','apple_export',...providers])}).strict());await q(env,'DELETE FROM health_daily WHERE user_id=? AND source=?',u.id,b.source).run();await purgeHealthState(env,u.id);return {};}
 throw fail('Not found',404);
}

export async function overlayHealth(env,id,state){for(const log of Object.values(state.logs||{}))if(log.health?.imported)delete log.health;const rows=(await q(env,'SELECT * FROM health_daily WHERE user_id=?',id).all()).results;for(const day of mergeHealth(rows)){state.logs||={};const log=state.logs[day.date]||={done:{},water:0};log.health={...day,imported:true};}return state;}

async function purgeHealthState(env,id){const row=await q(env,'SELECT json FROM user_state WHERE user_id=?',id).first();if(!row)return;const state=await overlayHealth(env,id,JSON.parse(row.json));await q(env,'UPDATE user_state SET json=?,updated_at=?,version=version+1 WHERE user_id=?',JSON.stringify(state),Date.now(),id).run();}
