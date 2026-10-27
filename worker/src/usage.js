import {z} from 'zod/v4';
import {admin,input,fail,hash} from './security.js';
import {query as q} from './accounts.js';
import {validEvent} from '../../app/js/usage-policy.js';
const DAY=86400000,date=n=>new Date(n).toISOString().slice(0,10);
const rows=async(env,sql,...args)=>(await q(env,sql,...args).all()).results;
async function salt(env,now){
 // Deterministic secret-keyed epoch salts avoid KV first-writer races between isolates.
 const epoch=Math.floor(now/(90*DAY));
 let s=await env.CONFIG.get('usage-salt','json');
 if(!s||s.epoch!==epoch||!s.previous){
  if(!env.MASTER_KEY||env.MASTER_KEY.length<32)throw fail('Usage salt unavailable',503);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.MASTER_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const derive=async n=>Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('fixmee-usage-salt:'+n))),b=>b.toString(16).padStart(2,'0')).join('');
  s={value:await derive(epoch),previous:await derive(epoch-1),created:epoch*90*DAY,epoch};await env.CONFIG.put('usage-salt',JSON.stringify(s));
 }
 return s;
}
export async function collectUsage(req,env){
 const b=await input(req,z.object({installId:z.string().uuid(),events:z.array(z.custom(validEvent)).min(1).max(20)}).strict(),16000);
 const now=Date.now(),day=date(now),salts=await salt(env,now),bucket=Math.floor(now/3600000);
 let id=await hash(salts.value+':'+b.installId);
 // Keep a cohort's hash stable across a salt rotation only within its 90-day lifetime.
 const previous=await hash(salts.previous+':'+b.installId);
 if(await q(env,'SELECT 1 FROM usage_installs WHERE install_hash=? AND first_seen>=?',previous,date(now-90*DAY)).first())id=previous;
 const limit=await q(env,'INSERT INTO telemetry_limits(id,bucket,count) VALUES(?,?,1) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN bucket=excluded.bucket THEN count+1 ELSE 1 END,bucket=excluded.bucket RETURNING count',id,bucket).first();
 if(limit.count>30)throw fail('Too many telemetry batches',429);
 const statements=[];
 for(const e of b.events){
  if(e.name==='app_open'){
   // The INSERT/SELECT conditions and active marker are committed atomically.
   statements.push(q(env,"INSERT INTO usage_daily SELECT ?,'new_install','','',1 WHERE NOT EXISTS(SELECT 1 FROM usage_installs WHERE install_hash=?) ON CONFLICT(date,name,dim,value) DO UPDATE SET count=count+1",day,id),q(env,'INSERT OR IGNORE INTO usage_installs VALUES(?,?)',id,day));
  }
  const once=['onboarding_done','workout_done','account_created','purchase_completed'].includes(e.name);
  const condition=e.name==='app_open'?'NOT EXISTS(SELECT 1 FROM usage_actives WHERE date=? AND install_hash=?)':once?'NOT EXISTS(SELECT 1 FROM usage_milestones WHERE install_hash=? AND name=?)':'1';
  const args=e.name==='app_open'?[day,id]:once?[id,e.name]:[];
  for(const [dim,value] of [['',''],...Object.entries(e.dims||{})])statements.push(q(env,`INSERT INTO usage_daily SELECT ?,?,?,?,1 WHERE ${e.name==='app_open'?condition:'1'} ON CONFLICT(date,name,dim,value) DO UPDATE SET count=count+1`,day,e.name,dim,value,...(e.name==='app_open'?args:[])));
  if(once)statements.push(q(env,`INSERT INTO usage_daily SELECT ?,?,'','',1 WHERE ${condition} ON CONFLICT(date,name,dim,value) DO UPDATE SET count=count+1`,day,'first_'+e.name,...args),q(env,'INSERT OR IGNORE INTO usage_milestones VALUES(?,?,?)',id,e.name,day));
  if(e.name==='app_open')statements.push(q(env,'INSERT OR IGNORE INTO usage_actives VALUES(?,?)',day,id));
 }
 await env.DB.batch(statements);return {ok:true};
}
export async function pruneUsage(env,now=Date.now()){
 const cutoff=date(now-90*DAY),totals=date(now-400*DAY);
 await env.DB.batch([q(env,'DELETE FROM usage_actives WHERE date<?',cutoff),q(env,'DELETE FROM usage_milestones WHERE date<?',cutoff),q(env,'DELETE FROM usage_installs WHERE first_seen<?',cutoff),q(env,'DELETE FROM usage_daily WHERE date<?',totals),q(env,'DELETE FROM usage_snapshot WHERE date<?',totals),q(env,'DELETE FROM telemetry_daily WHERE date<?',totals),q(env,'DELETE FROM errors WHERE last_seen<?',now-90*DAY),q(env,'DELETE FROM telemetry_limits WHERE bucket<?',Math.floor(now/3600000)-24)]);
}
export async function activeMetrics(env,day){
 const now=Date.parse(day+'T00:00:00Z'),out={};for(const [key,n] of [['dau',1],['wau',7],['mau',30]])out[key]=(await q(env,'SELECT count(DISTINCT install_hash) n FROM usage_actives WHERE date BETWEEN ? AND ?',date(now-(n-1)*DAY),day).first()).n;
 out.stickiness=out.mau?out.dau/out.mau*100:0;return out;
}
export async function retention(env,day){
 return rows(env,`SELECT i.first_seen AS cohort,count(*) AS installs,
 ${['onboarding_done','workout_done','account_created','purchase_completed'].map(name=>`sum(EXISTS(SELECT 1 FROM usage_milestones m WHERE m.install_hash=i.install_hash AND m.name='${name}' AND m.date<=?)) AS ${name}`).join(',')},
 ${[1,7,30].map(n=>`CASE WHEN date(i.first_seen,'+${n} days')<=? THEN 100.0*sum(EXISTS(SELECT 1 FROM usage_actives a WHERE a.install_hash=i.install_hash AND a.date=date(i.first_seen,'+${n} days')))/count(*) ELSE NULL END AS d${n}`).join(',')}
 FROM usage_installs i GROUP BY i.first_seen ORDER BY cohort`,day,day,day,day,day,day,day);
}
export async function snapshotUsage(env,now=Date.now()){
 await salt(env,now);await pruneUsage(env,now);const day=date(now),start=Date.parse(day+'T00:00:00Z'),end=start+DAY;
 // Finalize yesterday's activity after its last four UTC hours have arrived.
 // Operational account/device gauges retain their original snapshot time.
 const yesterday=date(start-DAY),prior=await q(env,'SELECT json FROM usage_snapshot WHERE date=?',yesterday).first();
 if(prior){const previous=JSON.parse(prior.json);Object.assign(previous,await activeMetrics(env,yesterday),{retention:await retention(env,yesterday)});
  previous.newAccounts=(await q(env,'SELECT count(*) n FROM users WHERE created_at>=? AND created_at<?',start-DAY,start).first()).n;
  previous.ai=await rows(env,"SELECT 'claude' engine,count(*) calls,coalesce(sum(cost_usd),0) cost FROM ai_usage WHERE created>=? AND created<?",new Date(start-DAY).toISOString(),new Date(start).toISOString());
  for(const engine of ['gemini','openai','kie'])previous.ai.push({engine,calls:(await q(env,"SELECT coalesce(sum(count),0) n FROM usage_daily WHERE date=? AND name='feature_used' AND dim='feature' AND value=?",yesterday,'byok_'+engine).first()).n,cost:0});
  previous.paid=(await q(env,'SELECT count(*) n FROM payments WHERE created_at>=? AND created_at<?',start-DAY,start).first()).n;previous.donated=(await q(env,'SELECT count(*) n FROM donations WHERE created>=? AND created<?',start-DAY,start).first()).n;
  await q(env,'UPDATE usage_snapshot SET json=? WHERE date=?',JSON.stringify(previous),yesterday).run();
 }
 const snapshot={...await activeMetrics(env,day),retention:await retention(env,day)};
 snapshot.at=new Date(now).toISOString();
 snapshot.accounts=(await q(env,'SELECT count(*) n FROM users').first()).n;
 snapshot.newAccounts=(await q(env,'SELECT count(*) n FROM users WHERE created_at>=? AND created_at<?',start,end).first()).n;
 snapshot.synced7=(await q(env,'SELECT count(*) n FROM user_state WHERE updated_at>=?',now-7*DAY).first()).n;
 snapshot.healthConnections=(await q(env,'SELECT count(*) n FROM health_connections').first()).n;
 snapshot.ai=await rows(env,"SELECT 'claude' engine,count(*) calls,coalesce(sum(cost_usd),0) cost FROM ai_usage WHERE created>=? AND created<?",new Date(start).toISOString(),new Date(end).toISOString());
 for(const engine of ['gemini','openai','kie'])snapshot.ai.push({engine,calls:(await q(env,"SELECT coalesce(sum(count),0) n FROM usage_daily WHERE date=? AND name='feature_used' AND dim='feature' AND value=?",day,'byok_'+engine).first()).n,cost:0});
 snapshot.paid=(await q(env,'SELECT count(*) n FROM payments WHERE created_at>=? AND created_at<?',start,end).first()).n;
 snapshot.donated=(await q(env,'SELECT count(*) n FROM donations WHERE created>=? AND created<?',start,end).first()).n;
 snapshot.push={devices:0,services:{apple:0,google:0,mozilla:0,other:0},reminders:0,sent:0,failed:0};let cursor;
 if(env.PUSH)do{const page=await env.PUSH.list({prefix:'device:',...(cursor?{cursor}:{})});for(const {name} of page.keys){const r=await env.PUSH.get(name,'json');if(!r||r.expires<now)continue;const p=snapshot.push;p.devices++;const host=new URL(r.subscription.endpoint).hostname;const service=host==='web.push.apple.com'?'apple':host.endsWith('googleapis.com')?'google':host.endsWith('mozilla.com')?'mozilla':'other';p.services[service]++;p.reminders+=r.reminders?.length||0;p.sent+=Object.values(r.lastSent||{}).filter(t=>t>=start&&t<end).length;if(r.lastError?.at>=start&&r.lastError.at<end)p.failed++;}cursor=page.list_complete?null:page.cursor;}while(cursor);
 snapshot.push.successRate=snapshot.push.sent+snapshot.push.failed?snapshot.push.sent/(snapshot.push.sent+snapshot.push.failed)*100:null;
 await q(env,'INSERT INTO usage_snapshot VALUES(?,?) ON CONFLICT(date) DO UPDATE SET json=excluded.json',day,JSON.stringify(snapshot)).run();return snapshot;
}
export async function usageReport(env,days=30,now=Date.now()){
 const end=date(now),since=date(now-(days*2-1)*DAY);
 return {days,end,daily:await rows(env,'SELECT * FROM usage_daily WHERE date BETWEEN ? AND ? ORDER BY date,name,dim,value',since,end),snapshots:(await rows(env,'SELECT * FROM usage_snapshot WHERE date BETWEEN ? AND ? ORDER BY date',since,end)).map(r=>({date:r.date,...JSON.parse(r.json)}))};
}
export async function adminUsage(req,env){await admin(req,env);if(req.method!=='GET')throw fail('Method not allowed',405);const n=Number(new URL(req.url).searchParams.get('days')||30);if(![7,30,90].includes(n))throw fail('Invalid range');return usageReport(env,n);}
