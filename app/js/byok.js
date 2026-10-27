import {CONFIG} from './config.js';
import {getState} from './store.js';
import {requireIntegration} from './beta.js';
export const providerKey=p=>localStorage.getItem(`fitme:${p}-key`)||'';
export const saveProviderKey=(p,k)=>k?localStorage.setItem(`fitme:${p}-key`,k.trim()):localStorage.removeItem(`fitme:${p}-key`);
export const providerModel=p=>localStorage.getItem(`fitme:${p}-model`)||(p==='kie'?CONFIG.byok?.kieModel:'')||'';
export const saveProviderModel=(p,m)=>localStorage.setItem(`fitme:${p}-model`,m);
export function strictSchema(schema){const s=structuredClone(schema);delete s.$schema;const walk=v=>{if(!v||typeof v!=='object')return;if(v.type==='object'){v.additionalProperties=false;const required=new Set(v.required||[]);for(const [k,p] of Object.entries(v.properties||{})){if(!required.has(k))v.properties[k]={anyOf:[p,{type:'null'}]};}v.required=Object.keys(v.properties||{});}for(const x of Object.values(v))if(Array.isArray(x))x.forEach(walk);else walk(x);};walk(s);return s;}
export async function providerModels(p,fetcher=fetch){requireIntegration('byok');const url=p==='openai'?'https://api.openai.com/v1/models':'https://api.kie.ai/openai/v1/models';const r=await fetcher(url,{headers:{Authorization:'Bearer '+providerKey(p)}});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();return (d.data||[]).filter(m=>p==='kie'||/^(gpt-(4o|4\.1|5|6)|o[134])/.test(m.id)&&!/(audio|realtime|transcribe|tts|image|search|codex|instruct)/.test(m.id));}
export function requestBody(p,prompt,images,schema){const model=providerModel(p);if(!model)throw Error('Choose a model in AI settings');const format={type:'json_schema',name:'fixmee',strict:true,schema:strictSchema(schema)};return p==='kie'?{model,input:[{role:'user',content:[{type:'input_text',text:prompt},...images.map(i=>({type:'input_image',image_url:`data:${i.media_type};base64,${i.data}`}))]}],text:{format},store:false}:{model,messages:[{role:'user',content:[{type:'text',text:prompt},...images.map(i=>({type:'image_url',image_url:{url:`data:${i.media_type};base64,${i.data}`}}))]}],response_format:{type:'json_schema',json_schema:{name:format.name,strict:true,schema:format.schema}},store:false};}
export async function byokRequest(p,prompt,images,schema,fetcher=fetch){
 requireIntegration('byok');const key=providerKey(p);if(!key)throw Error('Set your API key in AI settings');
 const body=JSON.stringify(requestBody(p,prompt,images,schema));let r;
 try{r=await fetcher(p==='openai'?'https://api.openai.com/v1/chat/completions':'https://api.kie.ai'+(CONFIG.byok?.kiePath||'/openai/v1/responses'),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body});}
 catch(e){if(p!=='kie'||e.name!=='TypeError')throw Error('Provider connection failed');r=await fetcher(CONFIG.API_BASE.replace(/\/$/,'')+'/api/ai/byok/kie',{method:'POST',headers:{'Content-Type':'application/json','X-BYOK-Key':key,...(getState().account.token?{Authorization:'Bearer '+getState().account.token}:{})},body});}
 if(!r.ok)throw Error('Provider HTTP '+r.status+' (401: key; 429: quota; 400: model/schema)');
 const data=await r.json();if(data.code&&data.code!==200)throw Error('Provider request rejected');
 const text=p==='openai'?data.choices?.[0]?.message?.content:data.output_text||data.output?.flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');
 try{const value=JSON.parse(text);const restore=(v,s)=>{if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(x=>restore(x,s.items||{}));return;}for(const k of Object.keys(v)){const p=s.properties?.[k];if(v[k]===null&&p&&!(s.required||[]).includes(k))delete v[k];else if(p)restore(v[k],p);}};restore(value,schema);return value;}catch{throw Error('Invalid provider JSON');}
}
