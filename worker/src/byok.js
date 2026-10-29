import {z} from 'zod/v4';
import {admin,input,fail} from './security.js';
import {cap,ip} from './launch-security.js';
export const BYOK_DEFAULTS={kiePath:'/openai/v1/responses',kieModel:'',affiliate:{gemini:'',openai:'',kie:''}};
const link=z.union([z.literal(''),z.url().refine(u=>{const x=new URL(u);return x.protocol==='https:'&&!x.username&&!x.password;})]);
const config=z.object({kiePath:z.string().regex(/^\/[a-zA-Z0-9_-]+\/v1\/responses$/),kieModel:z.string().max(120),affiliate:z.object({gemini:link,openai:link,kie:link}).strict()}).strict();
export const byokConfig=async env=>({...BYOK_DEFAULTS,...await env.CONFIG?.get('byok','json')});
export async function adminByok(req,env){await admin(req,env);if(req.method==='GET')return {byok:await byokConfig(env)};if(req.method!=='PUT')throw fail('Method not allowed',405);const data=await input(req,config,5000);await env.CONFIG.put('byok',JSON.stringify(data));return {byok:data};}
export async function kieProxy(req,env,fetcher=fetch){
 if(req.method!=='POST')throw fail('Method not allowed',405);
 await cap(env,'byok-kie',ip(req),30,3600000);
 const key=req.headers.get('X-BYOK-Key')||'';if(!key||key.length>512||/[\r\n]/.test(key))throw fail('Invalid provider key');
 const b=await input(req,z.object({model:z.string().min(1).max(120),input:z.array(z.json()).max(20),text:z.object({format:z.json()}).strict(),store:z.literal(false)}).strict(),6000000);
 const c=await byokConfig(env);if(!config.safeParse(c).success)throw fail('Provider configuration invalid',503);
 let r;try{r=await fetcher('https://api.kie.ai'+c.kiePath,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(b),signal:AbortSignal.timeout(60000)});}catch{throw fail('Provider connection failed',502);}
 if(!r.ok)throw fail('Provider HTTP '+r.status,r.status>=500?502:r.status);
 // Never relay arbitrary provider errors, headers or a reflected credential.
 let d;try{d=await r.json();}catch{throw fail('Invalid provider response',502);}
 if(d.error||d.code&&d.code!==200)throw fail('Provider request rejected',502);
 const text=d.output_text||d.output?.flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');
 if(typeof text!=='string'||text.includes(key))throw fail('Invalid provider response',502);
 return {output_text:text};
}
