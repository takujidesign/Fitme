import { readFile, writeFile, mkdir, rename, stat, open, unlink } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
export const directory=fileURLToPath(new URL('./',import.meta.url));
export const output=fileURLToPath(new URL('../../app/img/ex/',import.meta.url));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const json=async(file,fallback)=>{try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}};
export async function atomicJSON(file,value){await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.tmp',JSON.stringify(value,null,2)+'\n');await rename(file+'.tmp',file);}
export async function downloaded(file){try{return (await stat(file)).size>0;}catch{return false;}}
export function parseKie(body) {
  if(Number(body?.code)!==200)throw Error(`Kie response code ${body?.code ?? 'missing'}`);
  const data=body.data;if(!data||typeof data!=='object')throw Error('Missing Kie data');
  if(data.state==='fail')throw Error('Kie task failed; inspect the task in your provider dashboard');
  if(data.state==='success'){
    const result=typeof data.resultJson==='string'?JSON.parse(data.resultJson):data.resultJson;
    const url=result?.resultUrls?.[0];if(typeof url!=='string'||!url.startsWith('https://'))throw Error('Missing HTTPS result URL');
    return {...data,url};
  }
  return data;
}
// Serial admission spaces requests: <=19 admissions per rolling ten seconds, shared by all jobs.
export function rateLimiter({now=Date.now,wait=sleep,interval=550}={}) {
  let next=0,tail=Promise.resolve();
  return ()=>{const turn=tail.then(async()=>{await wait(Math.max(0,next-now()));next=now()+interval;});tail=turn.catch(()=>{});return turn;};
}
export function kieClient({key,fetcher=globalThis.fetch,wait=sleep,limit=rateLimiter(),base='https://api.kie.ai'}={}) {
  return async(endpoint,{method='GET',body}={})=>{
    for(let attempt=0;attempt<5;attempt++){
      await limit();
      const response=await fetcher(base+endpoint,{method,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});
      if(response.status===429){await wait(Math.max(1000*2**attempt,Number(response.headers?.get('retry-after')||0)*1000));continue;}
      if(!response.ok)throw Error(`Kie HTTP ${response.status}; task creation is not automatically retried`);
      const payload=await response.json();
      if(Number(payload?.code)===429){await wait(1000*2**attempt);continue;}
      return parseKie(payload);
    }
    throw Error('Kie rate limit retry budget exhausted');
  };
}
export async function pool(items,run,concurrency=4){let cursor=0;const errors=[];await Promise.all(Array.from({length:Math.min(4,concurrency,items.length)},async()=>{while(cursor<items.length){const item=items[cursor++];try{await run(item);}catch(e){errors.push({item,error:e});}}}));if(errors.length)throw new AggregateError(errors.map(e=>e.error),`${errors.length} jobs failed; receipts retained for resume`);}
export async function generateJob(job,{api,env,wait=sleep,exists=downloaded,save=atomicJSON,read=json,download,receipts=path.join(directory,'receipts'),out=output,log=console.log,regenerate=false,generation=null}={}) {
  const name=`${job.id}-${job.pose}`,file=path.join(out,name+'.webp'),receiptFile=path.join(receipts,name+'.json');
  let receipt=await read(receiptFile,null);
  // Queue regenerations are completed once, then ordinary resume applies.
  if(!regenerate && await exists(file)){log(`Skip ${name}`);return;}
  if(regenerate && receipt?.state==='downloaded'){if(receipt.generation===generation && await exists(file)){log(`Skip regenerated ${name}`);return;}receipt=null;}
  const model=env.KIE_MODEL||'gpt-image-2-text-to-image';
  if(!receipt){
    const extra=JSON.parse(env.KIE_INPUT||'{}');if(!extra||typeof extra!=='object'||Array.isArray(extra))throw Error('KIE_INPUT must be a JSON object');
    const input={...extra,prompt:job.prompt};
    if(env.KIE_REF_IMAGE_URL){if(!env.KIE_REF_FIELD)throw Error('Set KIE_REF_FIELD for your model');input[env.KIE_REF_FIELD]=env.KIE_REF_IMAGE_URL;}
    // Persist intent BEFORE a paid POST. An ambiguous response must never trigger another POST on resume.
    receipt={state:'creating',model,generation,created:new Date().toISOString()};await save(receiptFile,receipt);
    const data=await api('/api/v1/jobs/createTask',{method:'POST',body:{model,input:env.KIE_INPUT_AS_STRING==='1'?JSON.stringify(input):input}});
    if(!data.taskId)throw Error('Missing taskId; creation may have succeeded. Reconcile receipt in provider dashboard.');
    receipt={...receipt,taskId:data.taskId,state:'polling'};await save(receiptFile,receipt);
  }
  if(!receipt.taskId)throw Error(`Ambiguous creation for ${name}; reconcile receipt taskId manually, do not blindly retry`);
  for(let attempt=0;attempt<600;attempt++){
    const data=await api('/api/v1/jobs/recordInfo?taskId='+encodeURIComponent(receipt.taskId));
    if(data.state==='success'){
      await download(data.url,file);
      receipt={...receipt,state:'downloaded',creditsConsumed:data.creditsConsumed??null};await save(receiptFile,receipt);
      log(`${name}: creditsConsumed=${receipt.creditsConsumed??'not reported'}`);return;
    }
    await wait(3000);
  }
  throw Error(`Polling timed out for ${name}; resume with the saved taskId`);
}
export async function main(args=process.argv.slice(2),env=process.env) {
  const prompts=await json(path.join(directory,'prompts.json'),null);
  const only=args.includes('--only')?new Set((args[args.indexOf('--only')+1]||'').split(',')):null;
  const queued=args.includes('--queue')?await json(path.join(directory,'queue.json'),[]):[];
  const queue=new Set(queued);
  for(const id of [...(only||[]),...queue])if(!prompts.exercises.some(e=>e.id===id))throw Error('Unknown exercise id: '+id);
  const selected=prompts.exercises.filter(e=>(!only||only.has(e.id))&&(!args.includes('--queue')||queue.has(e.id)));
  const jobs=selected.flatMap(e=>['start','finish'].map(pose=>({id:e.id,pose,prompt:e[pose]})));
  if(args.includes('--dry-run')){for(const job of jobs)console.log(`${job.id}/${job.pose}: ${job.prompt}`);console.log(`Estimated count: ${jobs.length} images (${selected.length} pairs); no requests. Female variant: available in prompts.json, not generated.`);return;}
  if(!env.KIE_API_KEY)throw Error('Set KIE_API_KEY in your environment');
  const lockFile=path.join(directory,'generate.lock');
  const lock=await open(lockFile,'wx').catch(()=>{throw Error('Generator lock exists. Stop other runs; remove generate.lock only after confirming no process is running.');});
  try {
  const {default:sharp}=await import('sharp');
  const download=async(url,file)=>{const r=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error(`Download HTTP ${r.status}`);await mkdir(path.dirname(file),{recursive:true});await sharp(Buffer.from(await r.arrayBuffer())).resize(768,768,{fit:'contain',background:'#ffffff'}).webp({quality:80}).toFile(file+'.tmp');await rename(file+'.tmp',file);};
  const api=kieClient({key:env.KIE_API_KEY});
  const progressFile=path.join(directory,'queue-progress.json'),progress=await json(progressFile,{});let updates=Promise.resolve();
  const update=fn=>{const pending=updates.then(fn);updates=pending.catch(()=>{});return pending;};
  await pool(selected,async e=>{
    if(queue.has(e.id)&&!progress[e.id])await update(async()=>{progress[e.id]={generation:crypto.randomUUID(),poses:[]};await atomicJSON(progressFile,progress);});
    for(const job of jobs.filter(j=>j.id===e.id)){
      if(queue.has(e.id)&&progress[e.id]?.poses?.includes(job.pose))continue;
      await generateJob(job,{api,env,download,regenerate:queue.has(e.id),generation:progress[e.id]?.generation});
      if(queue.has(e.id))await update(async()=>{progress[e.id].poses.push(job.pose);await atomicJSON(progressFile,progress);});
    }
    if(queue.has(e.id))await update(async()=>{queue.delete(e.id);await atomicJSON(path.join(directory,'queue.json'),[...queue]);delete progress[e.id];await atomicJSON(progressFile,progress);});
  },4);
  } finally {await lock.close();await unlink(lockFile);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);if(e instanceof AggregateError)for(const cause of e.errors)console.error(cause.message);process.exitCode=1;});
