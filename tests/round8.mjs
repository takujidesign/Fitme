import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFile} from 'node:fs/promises';
const window=new Window({url:'http://localhost/#/coach'});
for(const key of ['window','document','localStorage','sessionStorage','navigator','location','FormData','Event'])Object.defineProperty(globalThis,key,{value:key==='window'?window:window[key],configurable:true});
globalThis.requestAnimationFrame=()=>1;
localStorage.setItem('fitme:ai-engine','claude');
const {getState,setState,compressImage}=await import('../app/js/store.js');
const {views,actions}=await import('../app/js/core.js');
const {CONFIG}=await import('../app/js/config.js');
CONFIG.freeMode=false; // Exercise the retained legacy paid mode.

const {requireCredits,refreshCredits,creditPill,aiRequest}=await import('../app/js/ai-credits.js');
const {closeSheet}=await import('../app/js/ui.js');
for(const v of ['chat','food','food-log','me','supps','pay','ai-usage','admin-round5','admin-round5b','admin-round5c','admin-login'])await import('../app/js/views/'+v+'.js');
setState(s=>{s.onboarded=true;s.account.token='session';s.premium.token='old-premium';});
let balance=42,authorization,posted=0;
globalThis.fetch=async(url,opts={})=>{authorization=opts.headers?.Authorization;if(url.endsWith('/ai/credits'))return Response.json({remaining:balance,creditsLeft:balance,reset:'2026-11-20T00:00:00Z',prices:CONFIG.AI.prices,topups:[],recent:[{feature:'chat',credits:1,created:'2026-10-21T12:00:00Z'}]});posted++;return Response.json({ok:false,code:'no_credits',error:'No AI credits remaining'},{status:402});};
await refreshCredits(true);assert.equal(authorization,'Bearer session');assert(creditPill().includes('42'));
for(const lang of ['th','en','zh','ja','vi'])for(const theme of ['light','dark']){
 setState(s=>{s.lang=lang;s.theme=theme;});
 for(const name of ['coach','food','me','pay','ai-usage']){const html=views[name]({params:[]});assert(!html.includes('undefined'),name);const root=document.createElement('main');root.innerHTML=html;if(name==='coach'){assert(root.querySelector('[data-ai-balance]'));assert(root.querySelector('[data-ai-cost="chat"]'));}if(name==='food')assert(root.querySelector('[data-ai-cost="planReview"]'));if(name==='me')assert(root.querySelector('[data-ai-cost="bodyReview"]'));if(name==='pay'){assert(root.querySelector('[data-v="credits40"]'));assert(root.textContent.includes('60 / 30'));assert(root.textContent.includes('40'));}}
}
setState(s=>{s.lang='en';});balance=0;assert.equal(await requireCredits('chat'),false);assert(document.body.textContent.includes('No AI credits remaining'));assert(document.querySelector('a[href="#/pay"]'));closeSheet();
await assert.rejects(aiRequest('ai/chat',{messages:[]}));assert.equal(posted,1);assert(document.body.textContent.includes('No AI credits remaining'));closeSheet();
balance=10;assert.equal(await requireCredits('mealPhoto'),true);
const root=document.createElement('main');root.innerHTML=views['ai-usage']();document.body.append(root);await views['ai-usage'].mount(root);assert(root.textContent.includes('Coach chat'));assert(root.textContent.includes('Credits reset'));
// Actual resize function with canvas/image decoding substituted, no fixture photos needed.
const originalCreate=document.createElement.bind(document);let encoded;
document.createElement=(tag,...rest)=>tag==='canvas'?{width:0,height:0,getContext:()=>({drawImage(){}}),toBlob(fn,type,quality){encoded={width:this.width,height:this.height,type,quality};fn(new Blob(['resized'],{type}));}}:originalCreate(tag,...rest);
for(const [width,height] of [[4000,3000],[800,2400],[500,200]]){globalThis.createImageBitmap=async()=>({width,height,close(){}});const blob=await compressImage(new Blob(['test']),1024,.8,true);assert(Math.max(encoded.width,encoded.height)<=1024);assert.equal(encoded.quality,.8);assert.equal(blob.type,'image/jpeg');}
globalThis.createImageBitmap=async()=>{throw Error('decode failed');};await assert.rejects(compressImage(new Blob(),1024,.8,true));document.createElement=originalCreate;
for(const file of ['pay.js','views/coach.js','views/food-log.js','views/supps.js'])assert.match(await readFile(new URL('../app/js/'+file,import.meta.url),'utf8'),/compressImage\([^)]*1024,\s*0\.8,\s*true\)/);
assert(!views.admin().includes('ai-settings'),'admin remains login-only');
const {renderAdminAI}=await import('../app/js/views/admin-ai.js');
const ai={chat:{model:'claude-sonnet-5-5',effort:'low',maxTokens:1200},chatSuggestions:{model:'claude-haiku-5-5',effort:'low',maxTokens:600},mealPhoto:{model:'claude-sonnet-5-5',effort:'low',maxTokens:2500},bodyReview:{model:'claude-sonnet-5-5',effort:'medium',maxTokens:2500},planReview:{model:'claude-sonnet-5-5',effort:'low',maxTokens:2500},labelRead:{model:'claude-haiku-5-5',effort:'low',maxTokens:4000},prices:CONFIG.AI.prices,credits:CONFIG.AI.credits,thbRate:34};
globalThis.fetch=async()=>Response.json({ai,recommended:ai,estimates:Object.fromEntries(Object.keys(ai).slice(0,6).map(k=>[k,[.04,.02,.001]])),dashboard:{totals:{calls:2,costUSD:.03,costTHB:1.02,cacheHitRate:.5,averageCostPerPro:.03},zeroOwners:1,fallbacks:1,byFeature:[],byModel:[]}});
await renderAdminAI(root);assert.equal(root.querySelectorAll('select[name$=".model"]').length,6);assert(root.textContent.includes('50.0%'));
const model=root.querySelector('[name="chat.model"]');model.value='claude-opus-5-5';model.dispatchEvent(new Event('input',{bubbles:true}));assert.equal(root.querySelector('[data-estimate="chat"]').textContent,'$0.04000');root.querySelector('#ai-reset').click();assert.equal(root.querySelector('[name="chat.model"]').value,'claude-sonnet-5-5');
console.log('PASS Round 8: all five languages/both-theme DOM rendering, credit pills/costs/pay, account auth, zero-credit sheet, AI usage, real resize bounds/JPEG quality/failure, admin model estimates/reset/login gate.');
await window.happyDOM.close();
