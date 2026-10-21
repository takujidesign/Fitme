import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Window} from 'happy-dom';
import {parseKie,rateLimiter,kieClient,pool,generateJob,downloaded,atomicJSON} from '../scripts/illustrations/generate.mjs';
const window=new Window({url:'http://localhost/'});
for(const key of ['window','document','localStorage','sessionStorage','navigator','location','MutationObserver'])Object.defineProperty(globalThis,key,{value:key==='window'?window:window[key],configurable:true});
globalThis.requestAnimationFrame=()=>1;
let reduced=false;globalThis.matchMedia=()=>({matches:reduced,addEventListener(){},removeEventListener(){}});
const {EXERCISES,EX}=await import('../app/js/exercises.js');
const {figureSVG,movementArrow,startFinishHTML,animateFigure}=await import('../app/js/figure.js');
const {exerciseMuscles,muscleMap,REGIONS}=await import('../app/js/muscle-map.js');
const {approvedIllustrations,loadIllustrations,mountExerciseVisual}=await import('../app/js/illustrations.js');
const {setState}=await import('../app/js/store.js');
const holds=new Set(['plank','forward_fold','quad_stretch','child_pose','side_plank','kegel','breathing']);
for(const ex of EXERCISES){
 assert(exerciseMuscles(ex).length,ex.id);const svg=figureSVG(ex);assert(!/NaN|undefined/.test(svg),ex.id);assert(svg.includes('var(--muscle-primary)'),ex.id);assert(svg.includes(`data-muscle="${exerciseMuscles(ex)[0]}"`),ex.id);
 const arrow=movementArrow(ex);if(!holds.has(ex.id))assert(arrow?.length>0,ex.id);else assert.equal(arrow,null,ex.id);
 for(const theme of ['dark','light'])for(const lang of ['th','en','zh','ja','vi']){document.documentElement.dataset.theme=theme;setState(s=>s.lang=lang);const host=document.createElement('div');host.innerHTML=startFinishHTML(ex);assert.equal(host.querySelectorAll('svg').length,2);assert.equal(host.querySelectorAll('figcaption').length,2);assert(!host.textContent.includes('?'),lang+' labels');}
}
assert.equal(movementArrow({...EX.squat,arrow:{joint:'hip',bend:-12}}).joint,'hip');
const map=document.createElement('div');map.innerHTML=muscleMap({},'Muscles','pick');assert.equal(map.querySelectorAll('rect').length,0);for(const id of Object.keys(REGIONS))assert(map.querySelector(`a[data-region="${id}"][tabindex="0"][aria-label] path`),id);
const row={start:'img/ex/squat-start.webp',finish:'img/ex/squat-finish.webp',source:'ai',model:'mock-model',created:'2026-10-21'};
assert.deepEqual(approvedIllustrations(null),{});assert.deepEqual(approvedIllustrations({squat:{...row,start:'https://bad/x'}}),{});
assert.deepEqual(await loadIllustrations(async()=>{throw Error();}),{});assert.deepEqual(await loadIllustrations(async()=>({ok:false})),{});
assert.deepEqual(await loadIllustrations(async()=>({ok:true,json:async()=>({})})),{});
const host=document.createElement('div');document.body.append(host);
let control=await mountExerciseVisual(host,EX.squat,{fetcher:async()=>({ok:true,json:async()=>({squat:row})})});assert.equal(host.querySelectorAll('img').length,4);assert(host.querySelector('[data-mode="ai"]').classList.contains('on'));host.querySelector('img').dispatchEvent(new window.Event('error'));assert.equal(host.querySelectorAll('img').length,0);assert(host.querySelector('svg'));control.stop();
reduced=true;control=await mountExerciseVisual(host,EX.squat,{fetcher:async()=>({ok:true,json:async()=>({squat:row})})});assert(host.querySelector('.start-finish'));assert.equal(host.querySelectorAll('img').length,0);host.querySelector('[data-mode="ai"]').click();assert.equal(host.querySelector('.illustration-crossfade').hidden,true);control.stop();animateFigure(host,EX.squat);assert(host.querySelector('.start-finish'));
assert.equal(parseKie({code:200,data:{state:'success',resultJson:JSON.stringify({resultUrls:['https://example.test/image']})}}).url,'https://example.test/image');
assert.throws(()=>parseKie({code:500,data:{}}));assert.throws(()=>parseKie({code:200,data:{state:'fail'}}));assert.throws(()=>parseKie({code:200,data:{state:'success',resultJson:'{}'}}));
let clock=0;const admissions=[],limit=rateLimiter({now:()=>clock,wait:async ms=>{clock+=ms;}});await Promise.all(Array.from({length:30},async()=>{await limit();admissions.push(clock);}));for(let i=20;i<admissions.length;i++)assert(admissions[i]-admissions[i-20]>=10000);
let calls=0;const api=kieClient({key:'test-only',limit:async()=>{},wait:async()=>{},fetcher:async(url,opts)=>{assert(url.startsWith('https://api.kie.ai'));assert.equal(opts.headers.Authorization,'Bearer test-only');calls++;return calls<2?{status:429,headers:new Headers()}:{ok:true,json:async()=>({code:200,data:{taskId:'mock'}})};}});assert.equal((await api('/mock')).taskId,'mock');assert.equal(calls,2);
await assert.rejects(kieClient({key:'test',limit:async()=>{},fetcher:async()=>({ok:true,json:async()=>({code:401})})})('/mock'));
let active=0,max=0;await pool(Array.from({length:20}),async()=>{max=Math.max(max,++active);await new Promise(r=>setTimeout(r,1));active--;});assert(max<=4);
const files=new Map(),save=async(k,v)=>files.set(k,structuredClone(v)),read=async k=>files.get(k)||null;let posts=0,downloads=0;
const job={id:'squat',pose:'start',prompt:'mock prompt'},options={env:{KIE_INPUT_AS_STRING:'1',KIE_INPUT:'{"size":"1:1"}'},wait:async()=>{},save,read,exists:async()=>false,download:async()=>{downloads++;},log:()=>{},api:async(url,opts)=>{if(opts){posts++;assert.equal(typeof opts.body.input,'string');return {taskId:'saved'};}return {state:'success',url:'https://example.test/image',creditsConsumed:2};}};
await generateJob(job,options);assert.equal(posts,1);assert.equal(downloads,1);await generateJob(job,{...options,exists:async()=>true});assert.equal(posts,1);assert.equal(downloads,1);await generateJob(job,options);assert.equal(posts,1);assert.equal(downloads,2);await generateJob(job,{...options,regenerate:true,generation:'new'});assert.equal(posts,2);await generateJob(job,{...options,regenerate:true,generation:'new',exists:async()=>true});assert.equal(posts,2);
files.clear();await assert.rejects(generateJob(job,{...options,api:async()=>{throw Error('ambiguous network');}}));await assert.rejects(generateJob(job,options),/Ambiguous/);assert.equal(posts,2);
const prompts=JSON.parse(await readFile(new URL('../scripts/illustrations/prompts.json',import.meta.url),'utf8'));assert.equal(prompts.exercises.length,40);assert(prompts.exercises.every(e=>e.start&&e.finish));assert.equal(prompts.femaleVariant.enabled,false);
const temp=await mkdtemp(path.join(os.tmpdir(),'fixmee-r9-'));
try{assert.equal(await downloaded(path.join(temp,'absent')),false);await writeFile(path.join(temp,'empty'),'');assert.equal(await downloaded(path.join(temp,'empty')),false);
 const {createReviewServer}=await import('../scripts/illustrations/review.mjs');await atomicJSON(path.join(temp,'prompts.json'),{exercises:[{id:'squat'}]});await mkdir(path.join(temp,'receipts'));for(const pose of ['start','finish']){await writeFile(path.join(temp,`squat-${pose}.webp`),'mock');await atomicJSON(path.join(temp,'receipts',`squat-${pose}.json`),{state:'downloaded',model:'mock',created:'2026-10-21'});}
 const server=await createReviewServer({dir:temp,out:temp,manifest:path.join(temp,'manifest.json')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const base=`http://127.0.0.1:${server.address().port}`,html=await (await fetch(base)).text(),token=html.match(/const token='([^']+)'/)[1];const decide=decision=>fetch(base+'/decision',{method:'POST',headers:{'Content-Type':'application/json','Origin':base,'X-Review-Token':token},body:JSON.stringify({id:'squat',decision})});assert.equal((await decide('approve')).status,200);assert(JSON.parse(await readFile(path.join(temp,'manifest.json'),'utf8')).squat);assert.equal((await decide('regenerate')).status,200);assert.deepEqual(JSON.parse(await readFile(path.join(temp,'manifest.json'),'utf8')),{});assert.deepEqual(JSON.parse(await readFile(path.join(temp,'queue.json'),'utf8')),['squat']);assert.equal((await decide('reject')).status,200);assert.equal((await fetch(base+'/decision',{method:'POST'})).status,403);assert.equal((await fetch(base+'/../README.md')).status,404);}finally{await new Promise(r=>server.close(r));}
}finally{await rm(temp,{recursive:true,force:true});}
await window.happyDOM.close();console.log('PASS Round 9: 40 figures, muscle paths/tokens, arrows, five languages/two themes, reduced motion, approved/missing/broken images, mocked Kie parsing/rate limit/concurrency/resume/ambiguous creation, local review approval/queue/security. No provider calls.');
