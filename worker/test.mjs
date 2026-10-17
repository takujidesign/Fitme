import assert from 'node:assert/strict';
import worker from './src/index.js';
import { CONFIG } from '../app/js/config.js';
const env={TOKEN_SECRET:'test-token-secret',ADMIN_PASSWORD:'test-admin',ANTHROPIC_API_KEY:'test-ai',STRIPE_SECRET_KEY:'test-stripe',THUNDER_API_KEY:'test-thunder'};
let saved=null; env.CONFIG={get:async()=>saved,put:async(k,v)=>{saved=JSON.parse(v)}};
const request=(path,body,auth='',method='POST')=>worker.fetch(new Request('https://test'+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth},body:body===undefined?undefined:JSON.stringify(body)}),env);
const config={promptpayId:CONFIG.PROMPTPAY_ID,promptpayName:'Test',receiverName:'Expected Receiver',products:structuredClone(CONFIG.PRODUCTS),freePlanDays:7,freeSupplements:3};
config.products.pro30.thb=123;config.products.pro30.days=15;
assert.equal((await request('/api/admin/config',config,'','PUT')).status,401);
assert.equal((await request('/api/admin/config',config,'test-admin','PUT')).status,200);
assert.equal((await request('/api/admin/config',{...config,freePlanDays:-1},'test-admin','PUT')).status,400);
const pub=await (await request('/api/config',undefined,'','GET')).json();assert.equal(pub.config.products.pro30.thb,123);assert(!JSON.stringify(pub).includes('test-admin'));assert.equal(pub.secrets.anthropic,true);
let calls=[]; let aiResult={advice:[{th:'ok',en:'ok'}],swaps:[],warnings:[]};
globalThis.fetch=async(url,opts)=>{
 calls.push({url:String(url),body:opts.body});
 if(String(url).includes('anthropic')) return new Response(JSON.stringify({id:'msg_test',type:'message',role:'assistant',model:'claude-opus-5-5',content:[{type:'text',text:JSON.stringify(aiResult)}],stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}),{headers:{'Content-Type':'application/json'}});
 if(String(url).includes('thunder')) return Response.json({success:true,data:{rawSlip:{amount:{amount:123},receiver:{account:{name:{en:'Expected Receiver'}}},transRef:'test'}}});
 if(String(url).includes('stripe')) return Response.json({url:'https://checkout.example/test'});
 throw Error('unexpected network');
};
await request('/api/stripe/checkout',{productId:'pro30',currency:'thb',returnUrl:'https://test/'});assert.equal(new URLSearchParams(calls.at(-1).body).get('line_items[0][price_data][unit_amount]'),'12300');
const slip=await (await request('/api/slip/verify',{productId:'pro30',image:'abc'})).json();assert.equal(slip.ok,true);assert.equal(JSON.parse(calls.at(-1).body).matchAmount,123);assert(Math.abs(Date.parse(slip.entitlement.until)-Date.now()-15*86400000)<5000);
for(const path of ['/api/ai/plan-review','/api/ai/body']) { assert.equal((await request(path,{},'invalid')).status,402);assert.equal((await request(path,{})).status,402); }
const review=await request('/api/ai/plan-review',{profile:{age:30},targets:{},meals:[],supplements:[]},slip.token);assert.equal(review.status,200);assert.deepEqual((await review.json()).review,aiResult);let sent=JSON.parse(calls.at(-1).body);assert.equal(sent.model,'claude-opus-5-5');assert.equal(sent.output_config.effort,'medium');
assert.equal((await request('/api/ai/body',{consent:false},slip.token)).status,400);
aiResult={bodyFatRange:{min:15,max:19},posture:[],underDeveloped:[],goal:'maintain',focus:['core'],warnings:[]};
const body=await request('/api/ai/body',{consent:true,profile:{height:170,weight:70,age:30,sex:'male'},images:[{media_type:'image/jpeg',data:'YQ=='}]},slip.token);assert.equal(body.status,200);assert.deepEqual((await body.json()).review,aiResult);
console.log('PASS config authorization/validation/KV/secrets; KV checkout price and slip price/duration; Pro rejection; consent validation; both mocked structured AI responses/model/effort. No live API calls.');

