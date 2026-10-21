import assert from 'node:assert/strict';
import worker from './src/index.js';
import {testDB} from './test-db.mjs';
const {db,DB}=testDB(),kv=new Map(),env={DB,TOKEN_SECRET:'test-token',ANTHROPIC_API_KEY:'mock',THUNDER_API_KEY:'mock',STRIPE_SECRET_KEY:'mock',CONFIG:{get:async(k,t)=>kv.has(k)?t==='json'?JSON.parse(kv.get(k)):kv.get(k):null,put:async(k,v)=>kv.set(k,v)}};
const call=(path,body,token='',method=body===undefined?'GET':'POST')=>worker.fetch(new Request('https://test/api/'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),env);
let slipRef=0,expected=99,checkoutBody,sid;
globalThis.fetch=async(url,opts)=>{
 if(String(url).includes('thunder'))return Response.json({success:true,data:{rawSlip:{amount:{amount:expected},receiver:{},transRef:'slip-'+(++slipRef)}}});
 if(opts.method==='POST'){checkoutBody=new URLSearchParams(opts.body);sid='cs_test'+slipRef;return Response.json({id:sid,url:'https://example.test/pay'});}
 return Response.json({id:sid,payment_status:'paid',amount_total:Number(checkoutBody.get('line_items[0][price_data][unit_amount]')),currency:checkoutBody.get('line_items[0][price_data][currency]'),metadata:{order:checkoutBody.get('metadata[order]')}});
};
let quote=await (await call('quote',{productId:'pro30',currency:'thb'})).json();
let paid=await (await call('slip/verify',{orderId:quote.orderId,image:'mock'})).json();assert(paid.ok);const pro=paid.token;
let wallet=await (await call('ai/credits',undefined,pro)).json();assert.equal(wallet.remaining,60);
quote=await (await call('quote',{productId:'credits40',currency:'thb',entitlementToken:pro})).json();assert.equal(quote.amount,49);expected=49;
paid=await (await call('slip/verify',{orderId:quote.orderId,image:'mock'})).json();assert(paid.ok);assert(paid.topup);
assert.equal((await (await call('ai/credits',undefined,pro)).json()).remaining,100);
const first=db.prepare('SELECT * FROM ai_topups').get();assert(Math.abs(Date.parse(first.expires)-Date.now()-90*86400000)<5000);
// Stripe goes through the same authoritative quote, frozen amount and replay-safe ledger.
quote=await (await call('quote',{productId:'credits40',currency:'usd',entitlementToken:pro})).json();assert.equal(quote.amount,1.49);
assert.equal((await call('stripe/checkout',{orderId:quote.orderId,returnUrl:'https://test/'})).status,200);
assert.equal(checkoutBody.get('line_items[0][price_data][unit_amount]'),'149');
paid=await (await call('stripe/confirm?session_id='+sid)).json();assert(paid.ok);assert(paid.topup);
await call('stripe/confirm?session_id='+sid);assert.equal((await (await call('ai/credits',undefined,pro)).json()).remaining,140);
assert.equal(db.prepare('SELECT count(*) n FROM ai_topups').get().n,2);
// A top-up alone gives a guest a stable, usable wallet, but no trial allowance.
quote=await (await call('quote',{productId:'credits40',currency:'thb'})).json();paid=await (await call('slip/verify',{orderId:quote.orderId,image:'mock'})).json();assert(paid.ok);wallet=await (await call('ai/credits',undefined,paid.token)).json();assert.equal(wallet.remaining,40);assert.equal(wallet.reset,null);
const payload=JSON.parse(Buffer.from(paid.token.split('.')[0],'base64url'));assert.equal(payload.ownerId,'purchase:'+quote.orderId);
console.log('PASS Round 8 payments: Thunder + Stripe top-ups, USD/THB pricing, 90-day validity, stable guest wallet, Pro balance preservation, replay idempotency, top-up-only guest without trial.');db.close();
