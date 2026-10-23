import Anthropic from '@anthropic-ai/sdk';
import {zodOutputFormat} from '@anthropic-ai/sdk/helpers/zod';
import {z} from 'zod/v4';
import {admin,input,getSecret,fail} from './security.js';
import {schemas} from '../../app/js/ai-schemas.js';
import {PRICES,PREAMBLE} from './ai.js';
import {query} from './accounts.js';
const tasks=Object.keys(schemas);
export async function adminLab(req,env){
 await admin(req,env);if(req.method==='GET')return {usage:(await query(env,"SELECT tag,engine,task,model,count(*) calls,sum(input_tokens) input_tokens,sum(output_tokens) output_tokens,sum(estimated_cost) estimated_cost FROM admin_ai_tests GROUP BY tag,engine,task,model").all()).results};if(req.method!=='POST')throw fail('Method not allowed',405);
 const b=await input(req,z.object({engine:z.enum(['claude','gemini']),task:z.enum(tasks),prompt:z.string().min(1).max(30000),model:z.string().max(100),requestId:z.string().uuid(),images:z.array(z.object({media_type:z.enum(['image/png','image/jpeg','image/webp']),data:z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).max(4000000)}).strict()).max(3).default([])}).strict(),13000000);
 const started=Date.now();let raw,parsed,tokens={},cost=0,validation='valid';
 try{
  if(b.engine==='claude'){
   if(!Object.hasOwn(PRICES,b.model))throw fail('Invalid model');
   const key=await getSecret(env,'anthropicApiKey');if(!key)throw fail('Claude key is not configured');
   const client=new Anthropic({apiKey:key,maxRetries:0});
   const response=await client.messages.parse({model:b.model,max_tokens:4000,system:PREAMBLE,messages:[{role:'user',content:[{type:'text',text:b.prompt},...b.images.map(i=>({type:'image',source:{type:'base64',...i}}))]}],output_config:{format:zodOutputFormat(schemas[b.task])}});
   raw=response.content;parsed=response.parsed_output;tokens=response.usage||{};const p=PRICES[b.model];cost=((tokens.input_tokens||0)*p.input+(tokens.output_tokens||0)*p.output)/1e6;
   if(['refusal','max_tokens'].includes(response.stop_reason))validation='invalid';
  }else{
   if(!/^gemini-[a-z0-9.-]+$/.test(b.model))throw fail('Invalid model');
   const key=await getSecret(env,'geminiApiKey');if(!key)throw fail('Gemini server key is not configured; enter a session key in the lab');
   const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+b.model+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts:[{text:b.prompt},...b.images.map(i=>({inline_data:{mime_type:i.media_type,data:i.data}}))]}],generationConfig:{responseMimeType:'application/json',responseJsonSchema:z.toJSONSchema(schemas[b.task])}}),signal:AbortSignal.timeout(60000)});
   const d=await response.json();if(!response.ok)throw fail('Gemini request failed ('+response.status+')');raw=d.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';const u=d.usageMetadata||{};tokens={input_tokens:u.promptTokenCount||0,output_tokens:u.candidatesTokenCount||0};const p=b.model.includes('pro')?[1.25,10]:[.3,2.5];cost=(tokens.input_tokens*p[0]+tokens.output_tokens*p[1])/1e6;try{parsed=JSON.parse(raw);}catch{validation='invalid';}
  }
  const check=schemas[b.task].safeParse(parsed);if(!check.success)validation='invalid';
  await query(env,'INSERT INTO admin_ai_tests VALUES(?,?,?,?,?,?,?,?,?)',b.requestId,'admin_test',b.engine,b.task,b.model,tokens.input_tokens||0,tokens.output_tokens||0,cost,Date.now()).run();
  return {raw,parsed:check.success?check.data:parsed,validation,tokens,cost,requestId:b.requestId,latency:Date.now()-started,tag:'admin_test'};
 }catch(e){return {error:e.safe?e.message:'AI provider request failed',requestId:b.requestId,validation:'error',latency:Date.now()-started,tag:'admin_test'};}
}

export async function labUsage(req,env){
 await admin(req,env);if(req.method!=='POST')throw fail('Method not allowed',405);
 const b=await input(req,z.object({requestId:z.string().uuid(),engine:z.enum(['gemini','nano','external']),task:z.enum(tasks),model:z.string().max(100),inputTokens:z.number().int().min(0).max(10000000),outputTokens:z.number().int().min(0).max(10000000),cost:z.number().min(0).max(1000)}).strict());
 await query(env,'INSERT OR IGNORE INTO admin_ai_tests VALUES(?,?,?,?,?,?,?,?,?)',b.requestId,'admin_test',b.engine,b.task,b.model,b.inputTokens,b.outputTokens,b.cost,Date.now()).run();return {};
}
