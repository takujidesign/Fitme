import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
const window=new Window({url:'https://local/'});
for(const k of ['window','document','localStorage','sessionStorage','navigator','location','history','Event'])Object.defineProperty(globalThis,k,{configurable:true,value:k==='window'?window:window[k]});
globalThis.requestAnimationFrame=()=>1;globalThis.fetch=async()=>{throw Error('No live providers in tests');};
const {FOODS}=await import('../app/js/foods.js');
const {candidates,resolveFood,nutrition}=await import('../app/js/food-match.js');
const {pickMealTier,requestMeal,privacy}=await import('../app/js/meal-tiers.js');
const {CONFIG}=await import('../app/js/config.js');CONFIG.beta.enabled=false;CONFIG.API_BASE='https://fixture.test';
const fixtures=JSON.parse(await readFile(new URL('./fixtures/food-match.json',import.meta.url),'utf8'));
let correct=0;for(const [name,id] of fixtures){const c=candidates(name,FOODS);if(c[0].food.id===id)correct++;assert.equal(c[0].food.id,id,name);assert(c[0].score>=.67,name+' below threshold');}console.log(`Food matching ${correct}/${fixtures.length} top-1`);
const item={name_th:'ข้าวมันไก่',name_en:'Hainanese chicken rice',kind:'dish',portion:{amount:1,unit:'plate'},grams_est:350,confidence:.9,macros_est:{kcal:999,p:99,c:99,f:99}};
let r=resolveFood(item,FOODS);assert.equal(r.food.id,'out_chicken_rice');assert(Math.abs(r.kcal-600)<1e-8);assert(Math.abs(nutrition(item,r.food,175).kcal-300)<1e-8);
assert.equal(resolveFood({...item,confidence:.3},FOODS).selected,false);
const unknown={...item,name_th:'ไม่รู้ชื่ออาหาร',name_en:'Unknown alien meal'};r=resolveFood(unknown,FOODS);assert.equal(r.source,'ai');assert.equal(r.kcal,999);
assert.equal(resolveFood({...unknown,macros_est:undefined},FOODS).selected,false);
const custom={id:'my-food',th:'สูตรบ้านเรา',en:'Home secret',k:200,p:10,c:20,f:5,unit:{en:'bowl',g:250}};
r=resolveFood({...item,name_th:custom.th,name_en:custom.en,portion:{amount:2,unit:'bowl'}},[...FOODS,custom]);assert.equal(r.grams,500);assert.equal(r.kcal,1000);
assert.equal(pickMealTier({preferred:'gemini',hasKey:()=>false}).tier,'free');assert.equal(pickMealTier({preferred:'gemini',hasKey:p=>p==='openai'}).provider,'openai');assert.equal(pickMealTier({preferred:'gemini',hasKey:()=>true}).provider,'gemini');assert.equal(pickMealTier({highAccuracy:true}).tier,'credits');
localStorage.setItem('fitme:gemini-key','never-send-this-key');localStorage.setItem('fitme:ai-preview','skip');
const requests=[];globalThis.fetch=async(url,options)=>{requests.push({url,options});return url.includes('googleapis')?Response.json({candidates:[{content:{parts:[{text:JSON.stringify({items:[item]})}]}}]}):Response.json({review:{items:[item]}});};
await requestMeal({images:[{media_type:'image/jpeg',data:'YQ=='}],key:'never-send-this-key',note:'meal'}, {tier:'byok',provider:'gemini'});assert(requests.every(r=>r.url.includes('googleapis')));
await requestMeal({images:[{media_type:'image/jpeg',data:'YQ=='}],key:'never-send-this-key',note:'meal'}, {tier:'free'});assert(!requests.at(-1).options.body.includes('never-send-this-key'));assert(!requests.at(-1).options.body.includes('profile'));assert(Object.keys(privacy).length===5);for(const text of Object.values(privacy))for(const processor of ['Google','OpenAI','kie','Cloudflare','Groq','Anthropic'])assert(text.includes(processor));
const {showMealReview}=await import('../app/js/views/meal-photo.js');const {getState,setState,todayISO}=await import('../app/js/store.js');
setState(s=>s.telemetry=true);globalThis.fetch=async()=>Response.json({error:'synthetic'},{status:429});await assert.rejects(requestMeal({images:[]},{tier:'byok',provider:'gemini'}));const telemetry=JSON.parse(localStorage.getItem('fitme:telemetry-queue'));assert(telemetry.some(e=>e.dims.feature==='byok_gemini_error'));assert(!JSON.stringify(telemetry).includes('never-send-this-key'));setState(s=>s.telemetry=false);
const before=JSON.stringify(getState().logs);showMealReview(todayISO(),[item,{...item,confidence:.2}]);assert.equal(document.querySelectorAll('[data-include]')[1].checked,false);assert.equal(document.querySelectorAll('[data-food]')[0].options.length,5);assert.equal(JSON.stringify(getState().logs),before);assert(document.querySelector('#meal-total').textContent.includes('600 kcal'));
const {scorePhoto,evaluate,report}=await import('../scripts/food-eval.mjs');const label={file:'synthetic.jpg',dishes:['ข้าวมันไก่'],grams:[350]};assert.deepEqual(scorePhoto({items:[item]},label),{top1:1,top3:1,kcalError:0});assert.equal(scorePhoto({items:[item,item]},label).top1,1);const evaluated=await evaluate([label],{mock:async()=>({review:{items:[item]},cost:0})},async()=>[]);assert.equal(evaluated.length,1);assert(report(evaluated).includes('100.0%'));
const {estimateCost}=await import('../scripts/food-eval.mjs');assert.equal(estimateCost({prompt_tokens:100,completion_tokens:50},2,10),.0007);assert.equal(estimateCost({promptTokenCount:100,candidatesTokenCount:20,thoughtsTokenCount:30},2,10),.0007);assert.equal(estimateCost(undefined,2,10),null);
// Exercise real review handlers: a half-portion changes totals, then only selected
// rows are persisted by the explicit save action.
const portion=document.querySelector('[data-portion]');portion.value='0.5';portion.dispatchEvent(new Event('change'));assert(document.querySelector('#meal-total').textContent.includes('300 kcal'));assert.equal(JSON.stringify(getState().logs),before);
await document.querySelector('#meal-save').onclick({target:document.querySelector('#meal-save')});const saved=getState().logs[todayISO()].foodLog.at(-1);assert.equal(saved.items.length,1);assert(Math.abs(saved.totals.kcal-300)<1e-8);
// Canvas geometry/error handling here; actual encoding/EXIF is tested in Chromium.
const {downscaleMealPhotos}=await import('../app/js/meal-photo-image.js');const create=document.createElement.bind(document);let encoded,closed=0;
document.createElement=tag=>tag==='canvas'?{getContext:()=>({fillRect(){},drawImage(){}}),toBlob(fn,type,quality){encoded={width:this.width,height:this.height,quality};fn(new Blob(['mock-jpeg'],{type}));}}:create(tag);
globalThis.createImageBitmap=async()=>({width:4000,height:3000,close(){closed++;}});const downsized=await downscaleMealPhotos([new Blob(),new Blob()]);assert.equal(Math.max(encoded.width,encoded.height),768);assert.equal(encoded.quality,.8);assert.equal(downsized.type,'image/jpeg');assert.equal(closed,2);console.log('Mock canvas dimensions',encoded.width,encoded.height,'bytes',downsized.size,'(not real JPEG encoding evidence)');
globalThis.createImageBitmap=async()=>{throw Error('decode');};await assert.rejects(downscaleMealPhotos([new Blob()]),/decode/);document.createElement=create;
console.log('PASS Round22 matching, portions, fallbacks, low confidence, tier order, BYOK isolation, five-language processors, review/save, synthetic benchmark, canvas bounds');

