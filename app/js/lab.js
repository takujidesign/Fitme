import {schemas,z} from './ai-schemas.js';
import {parseReply,nanoAvailability} from './ai-engines.js';
export const labPresets={beginner:{age:30,height:170,weight:70,sex:'male',goal:'maintain'},active:{age:35,height:165,weight:60,sex:'female',goal:'strength'}};
export const labModels={claude:['claude-haiku-5-5','claude-sonnet-5-5','claude-opus-5-5'],gemini:['gemini-2.5-flash','gemini-2.5-pro'],nano:['on-device'],external:['ChatGPT','Gemini']};
export function labPrompt(task,profile){return 'Fixmee isolated admin test. Use only this synthetic profile; do not diagnose. Return bilingual fields and JSON matching the schema, or a fenced FIXMEE block when copying to another app. Task: '+task+'\nProfile: '+JSON.stringify(profile)+'\nSchema: '+JSON.stringify(z.toJSONSchema(schemas[task]));}
export function labResult(task,raw,meta={}){let parsed,validation='valid',error;try{parsed=typeof raw==='string'?(/```FIXMEE/i.test(raw)?parseReply(task,raw).value:JSON.parse(raw)):raw;parsed=schemas[task].parse(parsed);}catch(e){validation='invalid';error=e.message;}return {raw,parsed,validation,...meta,...(error?{error}:{})};}
export async function runLab(input,{server,fetcher=fetch,languageModel=globalThis.LanguageModel}={}){
 const started=performance.now(),requestId=crypto.randomUUID();
 try{
  if(!schemas[input.task]||!labModels[input.engine])throw Error('Invalid lab task or engine');
  if(['claude','gemini'].includes(input.engine)&&!(input.engine==='gemini'&&input.key))return await server({...input,requestId});
  let raw,tokens=null,cost=null;
  if(input.engine==='external')raw=input.reply;
  else if(input.engine==='nano'){if(input.images?.length)throw Error('Images are not supported by the on-device lab engine');if(!languageModel)throw Error('On-device AI unavailable');let session;try{session=await languageModel.create();raw=await session.prompt(input.prompt);}finally{session?.destroy?.();}}
  else {const model=input.model;if(!/^gemini-[a-z0-9.-]+$/.test(model))throw Error('Invalid Gemini model');const r=await fetcher('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':input.key},body:JSON.stringify({contents:[{role:'user',parts:[{text:input.prompt},...(input.images||[]).map(i=>({inline_data:{mime_type:i.media_type,data:i.data}}))]}],generationConfig:{responseMimeType:'application/json',responseJsonSchema:z.toJSONSchema(schemas[input.task])}}),signal:AbortSignal.timeout(60000)});const data=await r.json();if(!r.ok)throw Error(data.error?.message||'Gemini failed');raw=data.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';tokens=data.usageMetadata||{};cost=geminiCost(model,tokens);}
  return labResult(input.task,raw,{requestId,latency:Math.round(performance.now()-started),tokens,cost,tag:'admin_test'});
 }catch(e){return {requestId,error:e.message,validation:'error',latency:Math.round(performance.now()-started),tag:'admin_test'};}
}
// Explicit planning estimate, USD; never represented as an invoice.
export function geminiCost(model,tokens){const price=model.includes('pro')?[1.25,10]:[.3,2.5];return ((tokens.promptTokenCount||0)*price[0]+(tokens.candidatesTokenCount||0)*price[1])/1e6;}
export {nanoAvailability};
