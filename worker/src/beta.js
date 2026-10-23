import {allowed,betaDefaults,endpointIntegration,integrations} from '../../app/js/beta-policy.js';
import {admin,input,fail} from './security.js';
import {z} from 'zod/v4';
export async function betaFlags(env){return {...betaDefaults(),...(await env.CONFIG?.get('beta','json'))};}
export async function betaAllowed(env,key){return allowed(await betaFlags(env),key);}
export async function betaGate(req,env,path){
 const key=endpointIntegration(path);if(!key)return;
 const flags=await betaFlags(env);
 if(allowed(flags,key)&&(!['mealPhoto','labelScan','bodyPhoto'].includes(key)||allowed(flags,'ai')))return;
 if(await previewAdmin(req,env))return;
 if(key==='line'&&req.method==='GET'&&['/api/auth/line/start','/api/auth/line/callback'].includes(path)){const u=new URL(req.url),id=u.searchParams.get('ticket')||u.searchParams.get('state');if(/^[a-f0-9]{64}$/.test(id||'')){const row=await env.DB?.prepare('SELECT json FROM line_flows WHERE state=? AND expires_at>?').bind(id,Date.now()).first();if(row&&JSON.parse(row.json).adminPreview===true)return;}}
 throw Object.assign(fail('Feature unavailable during beta',403),{code:'beta_disabled'});
}
export async function adminBeta(req,env){await admin(req,env);if(req.method==='PUT'){const flags=await input(req,z.object(Object.fromEntries(['enabled',...integrations].map(k=>[k,z.boolean()]))).strict());await env.CONFIG.put('beta',JSON.stringify(flags));}else if(req.method!=='GET')throw fail('Method not allowed',405);return {beta:await betaFlags(env)};}

export async function previewAdmin(req,env){const token=req.headers.get('X-Admin-Preview')||req.headers.get('Authorization')?.replace(/^Bearer /,'');if(!token)return false;try{await admin(new Request(req.url,{headers:{Authorization:'Bearer '+token}}),env);return true;}catch{return false;}}
