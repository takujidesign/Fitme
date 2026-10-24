import assert from 'node:assert/strict';
import worker from './src/index.js';
import {testDB} from './test-db.mjs';
// Sign-up must say which field is wrong instead of a bare "Invalid request".
const {DB}=testDB(),kv=new Map();
const env={DB,MASTER_KEY:'m'.repeat(32),TOKEN_SECRET:'t'.repeat(32),ADMIN_PASSWORD:'x',CONFIG:{get:async(k,t)=>kv.has(k)?t==='json'?JSON.parse(kv.get(k)):kv.get(k):null,put:async(k,v)=>kv.set(k,v),delete:async k=>kv.delete(k)},MEDIA:{head:async()=>null}};
globalThis.fetch=async url=>{throw Error('Unmocked external request prohibited: '+url);};
let n=0;
async function register(body){const res=await worker.fetch(new Request('https://example.test/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'10.0.0.'+(n++)},body:JSON.stringify(body)}),env);return {status:res.status,data:await res.json()};}
let r=await register({email:'a@example.test',password:'123456789',age16:true});
assert.equal(r.status,400);assert.equal(r.data.code,'password_length');
r=await register({email:'not-an-email',password:'long-enough-1',age16:true});
assert.equal(r.status,400);assert.equal(r.data.code,'invalid_email');
r=await register({email:'  Mixed@Example.TEST ',password:'long-enough-1',age16:true});
assert.equal(r.status,200);assert.equal(r.data.user.email,'mixed@example.test');
console.log('PASS auth errors: password length and email codes; email trimmed and lower-cased before validation');
