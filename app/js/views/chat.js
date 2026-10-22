import { activeEngine } from '../ai-engines.js';
import { aiRequest, creditPill, creditCost, requireCredits } from '../ai-credits.js';
import { track } from '../telemetry.js';
import { views, actions, rerender } from '../core.js';
import { getState, setState, todayISO, addDays } from '../store.js';
import { L, esc, toast } from '../ui.js';
import { planDay } from '../day.js';
import { EX } from '../exercises.js';
const prompts=[['วันนี้ปวดเข่า ควรเปลี่ยนท่าอะไร','My knees hurt today. Which exercises should I change?'],['กินอะไรก่อนออกกำลังกายดี','What should I eat before exercise?'],['นอนไม่หลับควรทำอย่างไร','What can I do when I cannot sleep?']];
let busy=false, conversationContext=null;
export function chatContext() {
 const s=getState(),d=planDay(todayISO()),p=s.profile;
 return {language:s.lang,profile:{age:p.age,sex:p.sex,height:p.height,weight:p.weight,level:p.level},goal:p.goal,today:{workout:d.sess,targets:d.t},adherence:Array.from({length:7},(_,i)=>({date:addDays(todayISO(),-i),done:!!s.logs[addDays(todayISO(),-i)]?.done?.workout})),avoid:p.avoidEx,supplements:s.supplements.slice(0,15).map(v=>({productId:v.productId,paused:v.paused})),fasting:p.fasting};
}
views.coach=()=>`<header class="top"><h1>${L('AI โค้ช','AI coach')}</h1>${activeEngine()==='claude'?creditPill():''}<a class="chip" href="#/ai-settings">${esc(activeEngine())}</a></header><a class="btn ghost" href="#/ai-summary">${L('เปิดหน้าสรุปให้ AI อ่าน','Open summary for AI to read')}</a><p class="note">${L('คำแนะนำทั่วไป เลือกเอนจิน AI ได้ในการตั้งค่า','General guidance. Select an AI engine in settings.')}</p><section class="chat-thread" aria-live="polite">${getState().chat.map((m,i)=>`<article class="card chat-${m.role}"><small>${m.role==='user'?L('คุณ','You'):L('โค้ช','Coach')}</small><p class="chat-text">${esc(m.text)}</p>${(m.suggestions||[]).map((a,j)=>`<button class="btn ghost block" data-act="chat-apply" data-i="${i}" data-j="${j}" ${a.applied?'disabled':''}>${L('ใช้คำแนะนำ','Apply suggestion')}: ${esc(a.type)} ${esc(typeof a.value==='object'?JSON.stringify(a.value):a.value)}</button>`).join('')}</article>`).join('')}</section><section class="card">${prompts.map((p,i)=>`<button class="btn ghost block" data-act="chat-prompt" data-i="${i}">${L(...p)}</button>`).join('')}<label class="field">${L('ข้อความ','Message')}<textarea id="chat-input" maxlength="4000" ${busy?'disabled':''}></textarea></label><button class="btn primary block" data-act="chat-send" ${busy?'disabled':''}>${busy?L('กำลังตอบ…','Thinking…'):L('ส่ง','Send')} ${creditCost('chat')}</button></section>`;
actions['chat-prompt']=el=>{document.getElementById('chat-input').value=L(...prompts[Number(el.dataset.i)]);};
actions['chat-send']=async()=>{
 if(busy)return;busy=true;if(!await requireCredits('chat')){busy=false;return;}
 const text=document.getElementById('chat-input').value.trim();if(!text){busy=false;return;}
 busy=true;setState(s=>{s.chat=[...s.chat,{role:'user',text}].slice(-50);});rerender();
 try {
  let size=0;const messages=[];
  for(const m of getState().chat.slice(-12).reverse()){if(size+m.text.length>8000)break;messages.unshift({role:m.role,text:m.text});size+=m.text.length;}
  const r=await aiRequest('ai/chat',{messages,context:(chatContext())});
  track('ai_used');
  setState(s=>{s.chat=[...s.chat,{role:'assistant',text:r.text,suggestions:r.suggestions}].slice(-50);});
 }catch(e){toast(e.message,'warn');}finally{busy=false;rerender();}
};
actions['chat-apply']=el=>{
 const i=Number(el.dataset.i),j=Number(el.dataset.j),a=getState().chat[i]?.suggestions?.[j];if(!a||a.applied)return;
 setState(s=>{
  if(a.type==='avoidEx'&&Array.isArray(a.value))s.profile.avoidEx=[...new Set([...s.profile.avoidEx,...a.value.filter(v=>EX[v])])];
  if(a.type==='goal'&&['cut','bulk','recomp','maintain','strength'].includes(a.value))s.profile.goal=a.value;
  if(a.type==='sessionMin'&&Number.isInteger(a.value)&&a.value>=15&&a.value<=120)s.profile.sessionMin=a.value;
  if(a.type==='swapToday'&&EX[a.value.from]&&EX[a.value.to]&&!s.profile.avoidEx.includes(a.value.to)){s.exSwaps[todayISO()]||={};const index=planDay(todayISO()).sess?.items.findIndex(it=>it.id===a.value.from);if(index>=0)s.exSwaps[todayISO()][index]=a.value.to;}
  s.chat[i].suggestions[j].applied=true;
 });rerender();
};
