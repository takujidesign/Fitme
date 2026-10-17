import { getState, setState } from './store.js';
import { actions } from './core.js';
import { L } from './ui.js';
export const voiceAvailable=()=>!!globalThis.speechSynthesis&&!!globalThis.SpeechSynthesisUtterance;
export function stopVoice(){globalThis.speechSynthesis?.cancel();}
export function speak(th,en){
  if(!getState().voiceCoach||!voiceAvailable())return;
  const voices=speechSynthesis.getVoices(),thai=getState().lang==='th'&&voices.find(v=>v.lang.startsWith('th')),voice=thai||voices.find(v=>v.lang.startsWith('en'));
  stopVoice();const utterance=new SpeechSynthesisUtterance(thai?th:en);utterance.lang=thai?'th-TH':'en-US';if(voice)utterance.voice=voice;utterance.rate=1;speechSynthesis.speak(utterance);
}
export const voiceButton=()=>voiceAvailable()?`<button class="btn ghost xs" data-act="voice-toggle" aria-pressed="${getState().voiceCoach}">${L('เสียงโค้ช','Voice coach')} ${getState().voiceCoach?'✓':'—'}</button>`:'';
actions['voice-toggle']=el=>{setState(s=>s.voiceCoach=!s.voiceCoach);el.setAttribute('aria-pressed',String(getState().voiceCoach));el.innerHTML=`${L('เสียงโค้ช','Voice coach')} ${getState().voiceCoach?'✓':'—'}`;if(getState().voiceCoach)speak('เปิดเสียงโค้ชแล้ว','Voice coach enabled');else stopVoice();};
