import {requireIntegration,integrationEnabled,endpointIntegration} from './beta.js';
import { activeEngine, engineRequest } from './ai-engines.js';
﻿import { CONFIG } from './config.js';
import { getState } from './store.js';
import { api } from './account.js';
import { L, sheet, toast } from './ui.js';
export const aiToken=()=>getState().account?.token||getState().premium.token;
let snapshot=null,ownerToken=null,checked=0;
export const featureName=k=>L({chat:{th:'แชตโค้ช',en:'Coach chat'},chatSuggestions:{th:'ข้อเสนอแนะ',en:'Suggestions'},mealPhoto:{th:'รูปอาหาร',en:'Meal photo'},bodyReview:{th:'ประเมินรูปร่าง',en:'Body review'},planReview:{th:'ตรวจแผน',en:'Plan review'},labelRead:{th:'อ่านฉลาก',en:'Label read'}}[k]||{th:k,en:k});
export const creditCost=feature=>activeEngine()!=='claude'?'':`<span class="ai-cost" data-ai-cost="${feature}">✦ ${CONFIG.AI.prices[feature]}</span>`;
export const creditPill=()=>`<a class="chip" href="#/ai-usage" aria-label="${L('การใช้ AI','AI usage')}">✦ <span data-ai-balance>${snapshot&&ownerToken===aiToken()?snapshot.remaining:'—'}</span></a>`;
export function noCredits(){if(CONFIG.freeMode){sheet(`<h2>${L('เครดิต AI','AI credits')}</h2><a class="btn primary" href="#/pay">${L('เติมเครดิต','Top up')}</a><a class="btn ghost" href="#/ai-settings">${L('เลือกเอนจิน','Choose engine')}</a>`);return;}sheet(`<div class="sheet-head"><h2>${L('เครดิต AI หมด','No AI credits remaining')}</h2><button class="icon-btn" data-close aria-label="${L('ปิด','Close')}">×</button></div><p>${L('สมัคร Pro หรือเติมเครดิตเพื่อใช้ AI ต่อ','Get Pro or top up credits to continue using AI')}</p><a class="btn primary block" href="#/pay">${L('Pro / เติมเครดิต','Pro / top up')}</a><a class="btn ghost block" href="#/account">${L('เข้าสู่ระบบเพื่อรับเครดิตทดลอง','Sign in for trial credits')}</a>`);}
export async function refreshCredits(force=false){
 if(!integrationEnabled('ai'))return null;
 const token=aiToken();if(token!==ownerToken){snapshot=null;checked=0;ownerToken=token;}
 if(!token||!CONFIG.API_BASE)return null;
 if(!force&&Date.now()-checked<15000)return snapshot;
 const data=await api('ai/credits',undefined,'GET',token);
 if(token!==aiToken())return null;
 snapshot=data;checked=Date.now();CONFIG.AI.prices=data.prices||CONFIG.AI.prices;
 updateCreditUI();return data;
}
export function updateCreditUI(){
 document.querySelectorAll('[data-ai-balance]').forEach(el=>el.textContent=snapshot&&ownerToken===aiToken()?snapshot.remaining:'—');
 document.querySelectorAll('[data-ai-cost]').forEach(el=>el.textContent='✦ '+CONFIG.AI.prices[el.dataset.aiCost]);
}
export async function requireCredits(feature){
 if(activeEngine()!=='claude')return true;
 try{const balance=await refreshCredits(true);if(!balance||balance.remaining<CONFIG.AI.prices[feature]){noCredits();return false;}return true;}
 catch(e){toast(L('เชื่อมต่อเพื่อดูเครดิต AI','Connect to check AI credits'),'warn');return false;}
}
export async function aiRequest(path,body){
 requireIntegration(activeEngine()==='claude'?endpointIntegration(path):'byok');
 if(activeEngine()!=='claude')return engineRequest(path,body);
 try{const result=await api(path,body,'POST',aiToken());if(ownerToken!==aiToken()){snapshot=null;ownerToken=aiToken();}snapshot={...snapshot,remaining:result.creditsLeft};checked=0;updateCreditUI();return result;}
 catch(e){if(e.code==='no_credits')noCredits();throw e;}
}
