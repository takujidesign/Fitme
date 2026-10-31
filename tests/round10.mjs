import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const window=new Window({url:'http://localhost/#/today'});
for(const k of ['window','document','localStorage','sessionStorage','navigator','location','FormData','Event'])Object.defineProperty(globalThis,k,{configurable:true,value:k==='window'?window:window[k]});
globalThis.requestAnimationFrame=()=>1;
globalThis.fetch=async()=>{throw Error('Unexpected network request');};
const {CONFIG}=await import('../app/js/config.js');
CONFIG.beta.enabled=false; // Exercise enabled integrations with mocked providers.
const {getState,setState,todayISO,addDays}=await import('../app/js/store.js');
const {hasPro,canExport,useExport}=await import('../app/js/pay.js');
const {views,actions}=await import('../app/js/core.js');
const {syncCopy}=await import('../app/js/sync-data.js');
const engines=await import('../app/js/ai-engines.js');
const {schemas,z}=await import('../app/js/ai-schemas.js');
const {isLockedDay}=await import('../app/js/views/workout.js');
for(const v of ['me','pay','chat','round10'])await import('../app/js/views/'+v+'.js');
setState(s=>{s.onboarded=true;s.lang='en';});
assert.equal(CONFIG.freeMode,true);assert(hasPro());assert(canExport());assert(!isLockedDay(addDays(todayISO(),29)));useExport();assert.equal(getState().premium.exportsLeft,0);assert(!views.pay().includes('data-v="pro30"'));assert(!views.me().includes('Upgrade'));
CONFIG.freeMode=false;assert(!hasPro());assert(!canExport());assert(isLockedDay(addDays(todayISO(),29)));assert(views.pay().includes('data-v="pro30"'));CONFIG.freeMode=true;
assert.equal(engines.activeEngine(),'gemini');engines.selectEngine('external');assert.equal(localStorage.getItem('fitme:ai-engine'),'external');engines.selectEngine('gemini');
engines.saveKey('secret-only-on-device');assert(!JSON.stringify(getState()).includes('secret-only'));assert(!JSON.stringify(syncCopy(getState())).includes('secret-only'));assert(!JSON.stringify(engines.aiSummary()).includes('secret-only'));
const value={text:'Hello',suggestions:[]};const reply='Human text\n```FIXMEE\n'+JSON.stringify(value)+'\n```\nExtra';assert.deepEqual(engines.parseReply('ai/chat',reply),{value,text:'Human text\n\nExtra'});
for(const bad of ['missing','```FIXMEE\n{bad}\n```','```FIXMEE\n{"text":42}\n```'])assert.throws(()=>engines.parseReply('ai/chat',bad));
assert(engines.chatGPTLink('hello').startsWith('https://chatgpt.com/?q='));assert.equal(engines.chatGPTLink('x'.repeat(6000)),null);
assert.equal(await engines.nanoAvailability(),'unavailable');globalThis.LanguageModel={availability:async()=> 'downloadable',create:async()=>({prompt:async()=>reply,destroy(){}})};assert.equal(await engines.nanoAvailability(),'downloadable');engines.selectEngine('nano');assert.equal((await engines.engineRequest('ai/chat',{messages:[]})).text,'Hello');await assert.rejects(engines.engineRequest('ai/body',{images:[{}]}),/not supported/);delete globalThis.LanguageModel;
engines.selectEngine('gemini');let sent;
await engines.models(async(url,opts)=>{assert.equal(opts.headers['x-goog-api-key'],'secret-only-on-device');return Response.json({models:[{name:'models/gemini-2-flash',supportedGenerationMethods:['generateContent']},{name:'models/gemini-3-flash',supportedGenerationMethods:['generateContent']},{name:'models/embed',supportedGenerationMethods:['embedContent']}]});});assert.equal(engines.selectedModel(),'models/gemini-3-flash');
const review={items:[{name_th:'rice',name_en:'rice',kind:'ingredient',portion:{amount:100,unit:'g'},grams_est:100,confidence:.7,macros_est:{kcal:120,p:2,c:25,f:1}}]};
const r=await engines.engineRequest('ai/meal-photo',{images:[{media_type:'image/jpeg',data:'YWJj'}]},{consent:async(prompt,images)=>{assert(prompt.includes('Fixmee'));assert.equal(images.length,1);return true;},fetcher:async(url,opts)=>{assert(url.startsWith('https://generativelanguage.googleapis.com/'));assert(!url.includes('secret-only'));sent=JSON.parse(opts.body);return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(review)}]}}]});}});
assert.equal(r.review.items[0].macros_est.kcal,120);assert.deepEqual(sent.contents[0].parts[1],{inline_data:{mime_type:'image/jpeg',data:'YWJj'}});assert.equal(sent.generationConfig.responseMimeType,'application/json');assert.deepEqual(sent.generationConfig.responseJsonSchema,z.toJSONSchema(schemas['ai/meal-photo']));
engines.selectEngine('external');assert.equal((await engines.engineRequest('ai/chat',{messages:[]},{paste:async()=>({value,text:'human'})})).text,'human\nHello');
CONFIG.aiEngines.claude=false;assert.throws(()=>engines.selectEngine('claude'));CONFIG.aiEngines.claude=true;
for(const lang of ['th','en','zh','ja','vi'])for(const theme of ['light','dark']){setState(s=>{s.lang=lang;s.theme=theme;});for(const name of ['ai-settings','ai-summary','support','ideas'])assert(!views[name]().includes('undefined'),name);}
CONFIG.donate={wiseUrl:'',stripeUrl:''};assert(!views.support().includes('International'));CONFIG.donate.wiseUrl='https://wise.example/pay';assert(views.support().includes('https://wise.example/pay'));CONFIG.donate.wiseUrl='javascript:alert(1)';assert(!views.support().includes('javascript:'));
assert(views.me().includes('#/ai-settings'));assert(views.coach().includes('#/ai-settings'));
engines.saveKey('');assert.equal(engines.geminiKey(),'');
const {parentTab}=await import('../app/js/tab-effects.js');assert.equal(parentTab('player'),'workout');assert.equal(parentTab('recipes'),'food');assert.equal(parentTab('ai-settings'),'me');
const qrContext={};runInNewContext(await readFile(new URL('../app/js/vendor/qrcode.min.js',import.meta.url),'utf8'),qrContext);window.qrcode=qrContext.qrcode;
const {qrSVG,promptPayPayload}=await import('../app/js/pay.js');assert.match(await qrSVG(promptPayPayload('0812345678',99)),/<svg/);
const luminance=hex=>{const c=hex.replace('#','').match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
for(const c of ['#C6F432','#FF8A3D','#34D399','#B197FC','#4CC3FA']){assert(contrast(c,'#101820')>=4.5,c);assert(contrast(c,'#141B24')>=4.5,c);}
for(const c of ['#5B7F00','#C2410C','#047857','#6D28D9','#0369A1']){assert(contrast(c,'#FFFFFF')>=4.5,c);const text='#'+c.slice(1).match(/../g).map(v=>Math.round(parseInt(v,16)*.88).toString(16).padStart(2,'0')).join('');assert(contrast(text,'#E8EEF3')>=4.5,c);}
console.log('PASS Round 10: free/paid restoration, engine persistence, private key/state/sync, Gemini models/request/images/schema, Nano availability/images, FIXMEE validation, external fallback, five-language views, donation links and tab inheritance.');
await window.happyDOM.close();
