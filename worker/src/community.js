import { z } from 'zod/v4';
import { input, admin, fail, limit } from './security.js';
import { user, query as q } from './accounts.js';
const uuid=z.string().uuid(),day=z.string().date(),metric=z.enum(['steps','workouts','activeMinutes','waterDays']);
const nickname=z.string().trim().min(1).max(40).refine(v=>!v.includes('@'),'Use a nickname, not an email');
const rows=async(env,sql,...args)=>(await q(env,sql,...args).all()).results;
async function member(env,id,uid){if(!await q(env,'SELECT 1 FROM group_members WHERE group_id=? AND user_id=?',id,uid).first())throw fail('Group membership required',403);}
export function standings(members,scores,start,end,kind) {
  return members.map(m=>{const days=scores.filter(s=>s.user_id===m.user_id&&s.metric===kind&&s.day>=start&&s.day<=end).sort((a,b)=>a.day.localeCompare(b.day));let streak=0,best=0,last='';for(const d of days){if(d.value<=0){streak=0;continue;}streak=Date.parse(d.day)-Date.parse(last)===86400000?streak+1:1;best=Math.max(best,streak);last=d.day;}return {id:m.user_id,nickname:m.nickname,value:days.reduce((n,d)=>n+d.value,0),streak:best};}).sort((a,b)=>b.value-a.value||a.nickname.localeCompare(b.nickname)).map((r,i,all)=>({...r,rank:all.findIndex(x=>x.value===r.value)+1}));
}
export async function groups(req,env,path) {
  const u=await user(req,env);
  if(path==='/api/groups') {
    if(req.method==='GET')return {groups:await rows(env,'SELECT groups.* FROM groups JOIN group_members ON group_id=groups.id WHERE user_id=?',u.id)};
    if(req.method==='POST'){await limit(req,env,u.id);const b=await input(req,z.object({name:z.string().trim().min(1).max(80),nickname}).strict()),id=crypto.randomUUID(),code=Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');await env.DB.batch([q(env,'INSERT INTO groups VALUES(?,?,?,?)',id,u.id,b.name,code),q(env,'INSERT INTO group_members VALUES(?,?,?)',id,u.id,b.nickname)]);return {id,code};}
  }
  if(path==='/api/groups/join'&&req.method==='POST'){await limit(req,env,u.id);const b=await input(req,z.object({code:z.string().regex(/^[A-Z2-9]{6}$/),nickname}).strict());const g=await q(env,'SELECT id FROM groups WHERE code=?',b.code).first();if(!g)throw fail('Invalid join code');await q(env,'INSERT INTO group_members VALUES(?,?,?) ON CONFLICT(group_id,user_id) DO UPDATE SET nickname=excluded.nickname',g.id,u.id,b.nickname).run();return {id:g.id};}
  if(path==='/api/groups/scores'&&req.method==='PUT') {
    const b=await input(req,z.object({scores:z.array(z.object({day,metric,value:z.number().int().min(0).max(200000)}).strict()).max(124)}).strict());
    const today=new Date().toISOString().slice(0,10),old=new Date(Date.now()-31*86400000).toISOString().slice(0,10);
    const needed=await rows(env,'SELECT DISTINCT metric,start,end FROM group_challenges JOIN group_members ON group_members.group_id=group_challenges.group_id WHERE user_id=?',u.id);
    if(b.scores.some(s=>s.day>today||s.day<old||!needed.some(c=>c.metric===s.metric&&s.day>=c.start&&s.day<=c.end)||(['workouts','waterDays'].includes(s.metric)&&s.value>1)||(s.metric==='activeMinutes'&&s.value>1440)))throw fail('Invalid daily aggregate');
    if(b.scores.length)await env.DB.batch(b.scores.map(s=>q(env,'INSERT INTO group_scores VALUES(?,?,?,?) ON CONFLICT(day,user_id,metric) DO UPDATE SET value=excluded.value',s.day,u.id,s.metric,s.value)));return {};
  }
  const match=path.match(/^\/api\/groups\/([^/]+)(?:\/(challenges|members|leave))?$/);if(!match)throw fail('Not found',404);
  const id=uuid.parse(match[1]);await member(env,id,u.id);const g=await q(env,'SELECT * FROM groups WHERE id=?',id).first();
  if(!match[2]&&req.method==='GET') {
    const members=await rows(env,'SELECT user_id,nickname FROM group_members WHERE group_id=?',id),challenges=await rows(env,'SELECT * FROM group_challenges WHERE group_id=?',id),scores=await rows(env,'SELECT group_scores.* FROM group_scores JOIN group_members USING(user_id) WHERE group_id=?',id);
    const now=new Date(),monday=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-((now.getUTCDay()+6)%7))),end=new Date(+monday-86400000).toISOString().slice(0,10),start=new Date(+monday-7*86400000).toISOString().slice(0,10);
    return {group:g,members,challenges:challenges.map(c=>({...c,leaderboard:standings(members,scores,c.start,c.end,c.metric),weeklyWinner:standings(members,scores,start>c.start?start:c.start,end<c.end?end:c.end,c.metric).filter(r=>r.value>0)[0]?.id||null}))};
  }
  if(match[2]==='leave'&&req.method==='POST'){await input(req,z.object({}).strict());if(g.owner_id===u.id)throw fail('Owner must delete the group');await q(env,'DELETE FROM group_members WHERE group_id=? AND user_id=?',id,u.id).run();return {};}
  if(g.owner_id!==u.id)throw fail('Owner required',403);
  if(!match[2]&&req.method==='DELETE'){await input(req,z.object({}).strict());await q(env,'DELETE FROM groups WHERE id=?',id).run();return {};}
  if(match[2]==='members'&&req.method==='DELETE'){const b=await input(req,z.object({userId:uuid}).strict());if(b.userId===u.id)throw fail('Owner cannot be removed');await q(env,'DELETE FROM group_members WHERE group_id=? AND user_id=?',id,b.userId).run();return {};}
  if(match[2]==='challenges'&&req.method==='POST'){const b=await input(req,z.object({metric,start:day,end:day}).strict().refine(b=>b.end>=b.start&&Date.parse(b.end)-Date.parse(b.start)<=366*86400000));await q(env,'INSERT INTO group_challenges VALUES(?,?,?,?,?)',crypto.randomUUID(),id,b.metric,b.start,b.end).run();return {};}
  throw fail('Method not allowed',405);
}
export function affiliateURL(value,domains) {
  let u;try{u=new URL(value);}catch{throw fail('Invalid affiliate URL');}
  if(u.protocol!=='https:'||u.port||u.username||u.password||!domains.includes(u.hostname))throw fail('Affiliate domain is not approved');return u.href;
}
const Product=z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),name:z.string().min(1).max(120),image:z.string().url().max(2048).refine(v=>new URL(v).protocol==='https:'),price:z.string().max(80),category:z.enum(['supplement','equipment','food']),tags:z.array(z.string().max(50)).max(30),links:z.object({shopee:z.string().url().optional(),lazada:z.string().url().optional(),other:z.string().url().optional()}).strict(),active:z.boolean(),order:z.number().int().min(0).max(100000)}).strict();
export async function shop(req,env,path) {
  const domains=await env.CONFIG.get('shop-domains','json')||[];
  if(path==='/api/admin/shop') {
    await admin(req,env);
    if(req.method==='GET')return {domains,products:(await rows(env,'SELECT json FROM shop_products')).map(p=>JSON.parse(p.json)),clicks:await rows(env,'SELECT product_id,sum(count) AS count FROM shop_clicks GROUP BY product_id')};
    if(req.method==='PUT'){const b=await input(req,z.object({domains:z.array(z.string().regex(/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/)).max(100),products:z.array(Product).max(300)}).strict());if(new Set(b.products.map(p=>p.id)).size!==b.products.length)throw fail('Duplicate product ID');for(const p of b.products){if(!Object.keys(p.links).length)throw fail('Affiliate URL required');for(const link of Object.values(p.links))affiliateURL(link,b.domains);}await env.CONFIG.put('shop-domains',JSON.stringify(b.domains));await env.DB.batch([q(env,'DELETE FROM shop_products'),...b.products.map(p=>q(env,'INSERT INTO shop_products VALUES(?,?)',p.id,JSON.stringify(p)))]);return {};}
  }
  if(req.method!=='GET')throw fail('Method not allowed',405);
  if(path==='/api/shop')return {products:(await rows(env,'SELECT json FROM shop_products')).map(p=>JSON.parse(p.json)).filter(p=>p.active).sort((a,b)=>a.order-b.order)};
  const m=path.match(/^\/api\/shop\/go\/([a-zA-Z0-9_-]{1,80})$/);if(!m)throw fail('Not found',404);
  const params=z.object({via:z.enum(['shopee','lazada','other']).optional()}).strict().parse(Object.fromEntries(new URL(req.url).searchParams)),row=await q(env,'SELECT json FROM shop_products WHERE id=?',m[1]).first();if(!row)throw fail('Not found',404);const p=JSON.parse(row.json);if(!p.active)throw fail('Product unavailable',404);
  const target=affiliateURL(params.via?p.links[params.via]:Object.values(p.links)[0],domains);
  await q(env,'INSERT INTO shop_clicks VALUES(?,?,1) ON CONFLICT(day,product_id) DO UPDATE SET count=count+1',new Date().toISOString().slice(0,10),p.id).run();return new Response(null,{status:302,headers:{Location:target,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
