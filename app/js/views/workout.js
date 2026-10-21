import { mountExerciseVisual } from '../illustrations.js';
import { slot } from '../slots.js';
import { detectPRs } from '../records.js';
import { muscleMap, exerciseMuscles } from '../muscle-map.js';
import { supportedForm, startFormCheck, stopFormCheck } from '../form-check.js';
import { videoToggle } from '../videos.js';
import { track } from '../telemetry.js';
import { speak, stopVoice, voiceButton } from '../voice.js';
import { parseHeartRate, hrZone, hrCalories, exerciseHistory, historyHTML } from '../progress.js';
import { actions, views, go, rerender } from '../core.js';
import { getState, todayISO, addDays, diffDays, updateLog, dayLog } from '../store.js';
import { L, esc, icon, dateLabel, WEEKDAYS, sheet, toast } from '../ui.js';
import { sessionFor, splitName, sessionKcal, isTrainingDay } from '../workout.js';
import { EX, EXERCISES, GROUPS, EQUIP } from '../exercises.js';
import { figureSVG, animateFigure } from '../figure.js';
import { fmtSec } from '../export.js';
import { hasPro } from '../pay.js';
import { CONFIG } from '../config.js';

let tab = 'plan', filter = 'all';
export const isLockedDay = (iso) => !hasPro() && diffDays(getState().profile.startDate, iso) >= CONFIG.FREE_PLAN_DAYS;

const target = (it) => (it.reps ? `${it.sets} × ${it.reps} ${L('ครั้ง', 'reps')}` : `${it.sets > 1 ? it.sets + ' × ' : ''}${fmtSec(it.sec)}`);
const PHASE = { warm: { th: 'วอร์มอัพ', en: 'Warm-up' }, finisher: { th: 'ปิดท้าย (เผาผลาญ)', en: 'Finisher' }, cool: { th: 'คูลดาวน์', en: 'Cool-down' }, main: { th: 'หลัก', en: 'Main' } };

export function weekStrip(selected, route) {
  const p = getState().profile;
  const start = addDays(selected, -((new Date(selected + 'T00:00:00').getDay() + 6) % 7));
  return `<div class="week">${Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(start, i);
    const dt = new Date(iso + 'T00:00:00');
    const tr = isTrainingDay(p, iso) && diffDays(p.startDate, iso) >= 0;
    const done = dayLog(iso).done.workout;
    return `<button class="wd ${iso === selected ? 'on' : ''} ${tr ? 'tr' : ''} ${iso === todayISO() ? 'today' : ''}" data-act="go" data-to="${route}${iso}">
      <small>${WEEKDAYS()[dt.getDay()]}</small><b>${dt.getDate()}</b><i>${done ? '✓' : ''}</i>${isLockedDay(iso) ? `<span class="lk">${icon('lock', 10)}</span>` : ''}</button>`;
  }).join('')}</div><button class="btn ghost" data-act="calendar" data-iso="${selected}">${icon('cal',16)} ${L('ปฏิทิน', 'Calendar')}</button>`;
}

export const lockCard = (what) => `<div class="lock-card">${icon('lock', 28)}<b>${L('ปลดล็อกแผนเต็มด้วย Fixmee Pro', 'Unlock the full plan with Fixmee Pro')}</b>
  <small>${what || L(`ฟรีดูได้ ${CONFIG.FREE_PLAN_DAYS} วันแรก`, `Free covers the first ${CONFIG.FREE_PLAN_DAYS} days`)}</small><button class="btn primary" data-act="go" data-to="#/pay">${icon('spark', 18)} ${L('ดูแพ็กเกจ', 'See plans')}</button></div>`;

views.workout = ({ params }) => {
  const iso = params[0] || todayISO();
  const p = getState().profile;
  const head = `<header class="top"><div><small class="muted">${L('การออกกำลังกาย', 'Training')}</small><h1>${tab === 'plan' ? L('แผนของฉัน', 'My plan') : L('คลังท่า', 'Exercise library')}</h1></div><button class="icon-btn" data-act="calendar" data-iso="${iso}" aria-label="${L('ปฏิทิน', 'Calendar')}">${icon('cal')}</button></header><nav class="quick-actions">${[['tools','chart','เครื่องคำนวณ','Calculators'],['free-workout','plus','บันทึกการฝึกเอง','Free workout logging'],['library?day='+iso,'dumbbell','เพิ่มท่า','Add exercise'],['training-settings','settings','ตั้งค่าการฝึก','Training settings'],['programs','cal','โปรแกรม','Programs']].map(([path,ic,th,en])=>`<a class="btn ghost" href="#/${path}">${icon(ic,18)}<span>${L(th,en)}</span></a>`).join('')}</nav>
    <div class="seg tabs">${['plan', 'lib'].map((t) => `<button class="chip ${tab === t ? 'on' : ''}" data-act="wo-tab" data-v="${t}">${t === 'plan' ? L('แผน', 'Plan') : L('ท่าทั้งหมด', 'All exercises')}</button>`).join('')}</div>`;
  if (tab === 'lib') {
    const list = EXERCISES.filter((e) => filter === 'all' || e.group === filter);
    return head + `<div class="chips scroll">${['all', ...Object.keys(GROUPS)].map((g) => `<button class="chip ${filter === g ? 'on' : ''}" data-act="wo-filter" data-v="${g}">${g === 'all' ? L('ทั้งหมด', 'All') : L(GROUPS[g])}</button>`).join('')}</div>
      <div class="ex-grid">${list.map((e) => `<button class="ex-card" data-act="ex-open" data-id="${e.id}"><div class="fig" data-anim="${e.id}"></div><b>${L(e.name)}</b><small>${L(EQUIP[e.equip])} · ${L(e.muscles)}</small></button>`).join('')}</div>`;
  }
  const sess = sessionFor(p, iso);
  const locked = isLockedDay(iso);
  if (!sess) return head + weekStrip(iso, '#/workout/') + `<div class="empty">${getState().dayOverrides[iso] === 'off' ? L('วันหยุด ไม่มีการฝึก', 'Day off — no workout') : L('แผนเริ่มวันที่', 'Plan starts on') + ' ' + dateLabel(p.startDate)}</div>`;
  const groups = {};
  sess.items.forEach((it, i) => (groups[it.phase || 'main'] ||= []).push({ ...it, i }));
  return head + weekStrip(iso, '#/workout/') + `

    <section class="card session">
      <div class="row between"><div><small class="muted">${dateLabel(iso, { weekday: 'long', day: 'numeric', month: 'short' })} · ${L('สัปดาห์', 'Week')} ${sess.week}</small>
      <h2>${sess.type === 'train' ? L(splitName(sess.split)) : L('ฟื้นฟูร่างกาย (Active recovery)', 'Active recovery')}</h2></div>
      ${sess.deload ? `<span class="tag amber">Deload</span>` : ''}</div>
      <div class="meta">${icon('clock', 16)} ${sess.minutes} ${L('นาที', 'min')} ${icon('flame', 16)} ~${sessionKcal(sess, p.weight)} kcal ${icon('dumbbell', 16)} ${sess.items.length} ${L('ท่า', 'moves')}</div>
      ${sess.deload ? `<p class="note">${icon('info', 16)} ${L('สัปดาห์ Deload: ลดปริมาณเพื่อให้ร่างกายฟื้นตัวและแข็งแรงขึ้น', 'Deload week: lower volume so your body can adapt')}</p>` : ''}
      ${sess.type === 'rest' ? `<p class="note">${icon('moon', 16)} ${L('วันพัก: เดินเบาๆ ยืดเหยียด ดื่มน้ำให้พอ และนอนให้ครบ — กล้ามเนื้อเติบโตตอนพัก', 'Rest day: easy walk, stretch, hydrate and sleep — muscles grow while you recover')}</p>` : ''}
    <details class="session-muscles"><summary>${L('กล้ามเนื้อหลัก','Target')}</summary>${muscleMap(Object.fromEntries(sess.items.flatMap(i=>exerciseMuscles(EX[i.id])).map(id=>[id,1])))}</details>
    </section>
    ${locked ? lockCard() : `${Object.entries(groups).map(([ph, items]) => `<h3 class="sec">${L(PHASE[ph])}</h3>
      <ul class="ex-list">${items.map((it) => `<li data-act="ex-open" data-id="${it.id}"><div class="fig sm" data-anim="${it.id}"></div><div><b>${L(EX[it.id].name)}</b><small>${target(it)}${it.rest ? ` · ${L('พัก', 'rest')} ${it.rest}s` : ''}</small></div><button class="icon-btn" data-act="exercise-swap" data-iso="${iso}" data-index="${it.i}" aria-label="${L('เปลี่ยนท่า', 'Swap exercise')}">${icon('swap',18)}</button></li>`).join('')}</ul>`).join('')}
    ${slot('workout.readiness',{params})}${slot('workout.secondary')}
    ${sess.items.length ? `<div class="sticky-cta"><button class="btn primary block lg" data-act="go" data-to="#/player/${iso}">${icon('play', 20)} ${L('เริ่มเลย', 'Start workout')}</button></div>` : `<p class="note">${L('ไม่มีท่าที่อนุญาต กรุณาปรับตั้งค่าท่า', 'No allowed exercises. Adjust exercise preferences.')}</p>`}`}`;
};
views.workout.mount = (root) => {
  const io = new IntersectionObserver((ents) => ents.forEach((en) => {
    if (en.isIntersecting && !en.target.dataset.on) { en.target.dataset.on = 1; animateFigure(en.target, EX[en.target.dataset.anim], { speed: 0.9 }); }
  }));
  root.querySelectorAll('[data-anim]').forEach((el) => io.observe(el));
};

actions['wo-tab'] = (el) => { if(el.dataset.v==='lib')return go('#/library');tab = el.dataset.v; rerender(); };
actions['wo-filter'] = (el) => { filter = el.dataset.v; rerender(); };
actions['ex-open'] = (el) => {
  const ex = EX[el.dataset.id];
  sheet(`<div class="sheet-head"><div><small class="muted">${L(GROUPS[ex.group])} · ${L(EQUIP[ex.equip])}</small><h2>${L(ex.name)}</h2></div><button class="icon-btn" data-close>${icon('x')}</button></div>
    <div class="exercise-visual-panel" id="ex-anim"></div>${videoToggle(ex.id)}
    <p class="muted">${L('กล้ามเนื้อหลัก', 'Target')}: <b>${L(ex.muscles)}</b></p>
    ${muscleMap(Object.fromEntries(exerciseMuscles(ex).map(id=>[id,1])))}<ol class="cues">${L(ex.cues).map((c) => `<li>${esc(c)}</li>`).join('')}</ol>${historyHTML(ex.id)}`, { onMount: (r) => mountExerciseVisual(r.querySelector('#ex-anim'), ex) });
};

// ---------------- Player ----------------
let P = null;
function buildSteps(sess) {
  const steps = [];
  sess.items.forEach((it, idx) => {
    for (let s = 1; s <= it.sets; s++) {
      steps.push({ kind: 'work', it, set: s, idx });
      const last = idx === sess.items.length - 1 && s === it.sets;
      if (it.rest && !last) steps.push({ kind: 'rest', sec: it.rest, next: s < it.sets ? it : sess.items[idx + 1], nextSet: s < it.sets ? s + 1 : 1 });
    }
  });
  return steps;
}
let audio;
function beep(f = 880, d = 0.12) {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = f; o.connect(g); g.connect(audio.destination);
    g.gain.setValueAtTime(0.2, audio.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + d);
    o.start(); o.stop(audio.currentTime + d);
  } catch {}
}

views.player = ({ params }) => {
  const iso = params[0] || todayISO();
  if (isLockedDay(iso)) return `<div class="pad">${lockCard()}</div>`;
  const sess = sessionFor(getState().profile, iso);
  if (!sess?.items.length) { setTimeout(() => go('#/today'), 0); return ''; }
  if (!P || P.iso !== iso) { disconnectHR(); P = { iso, sess, steps: buildSteps(sess), i: 0, left: 0, paused: false, started: Date.now(), samples: [], sets: [] }; }
  return `<div class="player" id="player"></div>`;
};
views.player.mount = (root) => { renderStep(root.querySelector('#player')); requestWake(); };
views.player.full = true;

let wakeLock;
async function requestWake() { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch {} }

let timer, anim;
function renderStep(host) {
  stopFormCheck();
  clearInterval(timer);
  anim?.stop();
  if (!host?.isConnected) return;
  const st = P.steps[P.i];
  if (!st) return finish(host);
  const pct = (P.i / P.steps.length) * 100;
  const top = `<div class="pl-top">${voiceButton()}<button class="icon-btn" data-act="pl-exit">${icon('x')}</button><div class="pl-bar"><i style="width:${pct}%"></i></div><span class="muted sm">${Math.round(pct)}%</span></div>`;
  if (st.kind === 'rest') {
    speak('พัก', 'Rest starts');
    P.left = st.sec;
    const nx = EX[st.next.id];
    host.innerHTML = `${top}${heartUI()}<div class="pl-rest"><small>${L('พัก', 'Rest')}</small><div class="big-count" id="cnt">${P.left}</div>
      <div class="row gap center"><button class="btn ghost" data-act="pl-add">+15s</button><button class="btn primary" data-act="pl-next">${L('ข้าม', 'Skip')} ${icon('skip', 16)}</button></div>
      <div class="next-up"><small>${L('ต่อไป', 'Up next')} · ${L('เซ็ต', 'Set')} ${st.nextSet}/${st.next.sets}</small><div class="fig md" id="pl-fig"></div><b>${L(nx.name)}</b><span>${target(st.next)}</span></div></div>`;
    anim = animateFigure(host.querySelector('#pl-fig'), nx, { speed: 0.8 });
    tick(host);
    return;
  }
  const it = st.it, ex = EX[it.id];
  speak(`${P.steps[P.i-1]?.kind === 'rest' ? 'หมดเวลาพัก ' : ''}${ex.name.th} เซ็ต ${st.set} ${ex.cues.th[st.set % 3]}`, `${P.steps[P.i-1]?.kind === 'rest' ? 'Rest ends. ' : ''}${ex.name.en}. Set ${st.set}. ${ex.cues.en[st.set % 3]}`);
  const timed = !!it.sec;
  P.left = timed ? it.sec : 0;
  host.innerHTML = `${top}${heartUI()}<div class="pl-work">
    <div class="fig xl" id="pl-fig"></div>${videoToggle(ex.id)}
    <small class="muted">${L(PHASE[it.phase || 'main'])} · ${L('เซ็ต', 'Set')} ${st.set}/${it.sets}</small>
    <h1>${L(ex.name)}</h1>
    ${timed ? `<div class="big-count" id="cnt">${P.left}</div>` : `<div class="reps">${it.reps}<small>${L('ครั้ง', 'reps')}</small></div>`}
    ${supportedForm.has(it.id)?`<button class="btn ghost" data-act="form-check">${L('ตรวจฟอร์มด้วยกล้อง','Camera form check')}</button><div id="form-check"></div>`:''}${setInputs(st)}<p class="cue">${esc(L(ex.cues)[st.set % 3])}</p>
    <div class="pl-ctrl"><button class="icon-btn lg" data-act="pl-prev">${icon('back')}</button>
      ${timed ? `<button class="btn primary round" data-act="pl-pause" id="pp">${icon(P.paused ? 'play' : 'pause', 28)}</button>` : `<button class="btn primary round" data-act="pl-next">${icon('check', 30)}</button>`}
      <button class="icon-btn lg" data-act="pl-next">${icon('skip')}</button></div></div>`;
  anim = animateFigure(host.querySelector('#pl-fig'), ex);
  if (timed) tick(host);
}
function tick(host) {
  timer = setInterval(() => {
    if (!host.isConnected) { clearInterval(timer); disconnectHR(); return; }
    if (P.paused) return;
    P.left--;
    const c = host.querySelector('#cnt');
    if (c) c.textContent = Math.max(0, P.left);
    if (P.left === 3) speak('อีก 3 วินาที', '3 seconds left');
    if (P.left <= 3 && P.left > 0) beep(660);
    if (P.left <= 0) { beep(990, 0.25); navigator.vibrate?.(200); P.i++; renderStep(host); }
  }, 1000);
}
function finish(host) {
  stopVoice();
  const mins = Math.max(1, Math.round((Date.now() - P.started) / 60000));
  const avgHR = P.samples.length ? Math.round(P.samples.reduce((n,s)=>n+s.bpm,0)/P.samples.length) : null;
  const maxHR = P.samples.length ? P.samples.reduce((max,s)=>Math.max(max,s.bpm),0) : null;
  const kcal = avgHR ? hrCalories(avgHR, mins, getState().profile) : sessionKcal(P.sess, getState().profile.weight);
  disconnectHR();
  track('workout_done');
  const prs=detectPRs(getState().logs,P.sets);if(prs.length)toast(L('สถิติใหม่','New personal record')+' 🏆');
  updateLog(P.iso, (l) => { l.done.workout = true; l.sets = [...(l.freeSessions||[]).flatMap(s=>s.sets),...P.sets]; l.workout = { minutes: mins, kcal, avgHR, maxHR, hrSamples: P.samples, items: P.sess.items, at: new Date().toISOString() }; });
  host.innerHTML = `<div class="pl-done"><div class="burst">${icon('check', 46)}</div><h1>${L('เยี่ยมมาก!', 'Great work!')}</h1>
    <p>${L('จบการฝึกวันนี้แล้ว', 'Session complete')}</p>${avgHR ? `<p>${L('ชีพจรเฉลี่ย / สูงสุด','Average / max HR')}: ${avgHR} / ${maxHR} BPM</p>` : ''}<div class="sum-grid"><div class="stat"><small>${L('เวลา', 'Time')}</small><b>${mins}</b><span class="tag">${L('นาที', 'min')}</span></div><div class="stat"><small>${L('เผาผลาญ', 'Burned')}</small><b>~${kcal}</b><span class="tag">kcal</span></div></div>
    <p class="muted">${L('อย่าลืมมื้อหลังออกกำลังกาย และดื่มน้ำ 500 มล.', 'Have your post-workout meal and 500 ml of water')}</p>
    <button class="btn primary block" data-act="pl-close">${L('กลับหน้าหลัก', 'Back to today')}</button></div>`;
  beep(880, 0.15); setTimeout(() => beep(1320, 0.3), 160);
  wakeLock?.release?.();
}
const host = () => document.getElementById('player');
actions['pl-next'] = () => { stopFormCheck(); if (saveSet() === false) return; P.i++; renderStep(host()); };
actions['pl-prev'] = () => { P.i = Math.max(0, P.i - 1); while (P.i > 0 && P.steps[P.i].kind === 'rest') P.i--; renderStep(host()); };
actions['pl-add'] = () => { P.left += 15; const c = document.getElementById('cnt'); if (c) c.textContent = P.left; };
actions['pl-pause'] = (el) => { P.paused = !P.paused; el.innerHTML = icon(P.paused ? 'play' : 'pause', 28); P.paused ? anim?.pause() : anim?.play(); if (P.paused) stopVoice(); };
actions['pl-exit'] = () => { if (confirm(L('ออกจากการฝึก? ความคืบหน้าจะไม่ถูกบันทึก', 'Quit the workout? Progress will not be saved'))) { stopFormCheck(); stopVoice(); clearInterval(timer); anim?.stop(); disconnectHR(); P = null; wakeLock?.release?.(); history.back(); } };
actions['pl-close'] = () => { P = null; go('#/today'); toast(L('บันทึกการฝึกแล้ว 💪', 'Workout saved 💪')); };

let hrDevice, hrCharacteristic, hrConnecting = false;
function heartUI() {
 return `<section class="hr-card"><div id="live-hr" aria-live="polite">${P.samples.length ? P.samples.at(-1).bpm+' BPM' : '— BPM'}</div>${navigator.bluetooth ? `<button class="btn ghost" data-act="hr-connect">${L('เชื่อมต่อนาฬิกา/สายคาดอก', 'Connect watch / chest strap')}</button>` : `<p class="muted sm">${L('iPhone / Safari ไม่รองรับ Web Bluetooth', 'iPhone / Safari does not support Web Bluetooth.')}</p>`}<small>${L('ใช้กับอุปกรณ์ส่งชีพจรมาตรฐาน BLE เช่น สายคาดอก หรือโหมด broadcast HR ของ Garmin / Polar / Coros / Amazfit โดย Apple Watch และ Wear OS ส่วนใหญ่ไม่ส่งสัญญาณนี้', 'Requires standard BLE heart rate: chest straps or Garmin / Polar / Coros / Amazfit broadcast HR mode. Apple Watch and most Wear OS watches do not broadcast it.')}</small></section>`;
}
function hrChanged(event) {
 const bpm=parseHeartRate(event.target.value);if(!P || !host()?.isConnected){disconnectHR();return;}if(!bpm)return;
 if(!P.paused)P.samples.push({at:Date.now(),bpm});
 const el=document.getElementById('live-hr');if(el)el.textContent=`${bpm} BPM · ${L('โซน', 'Zone')} ${hrZone(bpm,getState().profile.age)}`;
}
function disconnectHR() {
 hrCharacteristic?.removeEventListener('characteristicvaluechanged',hrChanged);
 if(hrCharacteristic)hrCharacteristic.stopNotifications().catch(()=>{});
 hrDevice?.gatt?.disconnect();hrCharacteristic=null;hrDevice=null;
}
actions['hr-connect']=async()=>{
 if(hrConnecting)return;hrConnecting=true;const session=P;
 try{
  disconnectHR();
  const device=await navigator.bluetooth.requestDevice({filters:[{services:['heart_rate']}]});
  if(P!==session || !host()?.isConnected)return;
  hrDevice=device;device.addEventListener('gattserverdisconnected',()=>{const el=document.getElementById('live-hr');if(el)el.textContent=L('การเชื่อมต่อหลุด กรุณาเชื่อมต่อใหม่','Disconnected — reconnect to resume HR');});
  const server=await device.gatt.connect(),service=await server.getPrimaryService('heart_rate');
  const characteristic=await service.getCharacteristic('heart_rate_measurement');
  if(P!==session || !host()?.isConnected){device.gatt.disconnect();return;}
  hrCharacteristic=characteristic;characteristic.addEventListener('characteristicvaluechanged',hrChanged);await characteristic.startNotifications();
 }catch(e){disconnectHR();if(e.name!=='NotFoundError')toast(L('เชื่อมต่อไม่ได้ ตรวจโหมด broadcast HR แล้วลองอีกครั้ง', 'Could not connect. Check broadcast HR mode and try again.'),'warn');}finally{hrConnecting=false;}
};
window.addEventListener('hashchange',()=>{if(!location.hash.startsWith('#/player/')){stopFormCheck();stopVoice();clearInterval(timer);anim?.stop();disconnectHR();wakeLock?.release?.();P=null;}});
function setInputs(st) {
 if(st.kind!=='work'||!st.it.reps)return '';
 const prev=P.sets.find(s=>s.index===st.idx && s.set===st.set) || exerciseHistory(st.it.id,P.iso)[0]?.sets.find(s=>s.set===st.set);
 return `<div class="grid2">${[['kg',prev?.kg||0,'kg',2.5],['reps',prev?.reps ?? Number(st.it.reps.split('-')[0]),L('ครั้ง', 'Reps'),1]].map(([key,value,label,step])=>`<label class="field">${label}<div class="stepper"><button class="btn ghost" data-act="set-step" data-key="${key}" data-n="${-step}">−</button><div class="input-wrap"><input type="number" id="set-${key}" min="0" max="${key==='kg'?1000:1000}" step="${key==='kg'?'.5':'1'}" value="${value}"></div><button class="btn ghost" data-act="set-step" data-key="${key}" data-n="${step}">+</button></div></label>`).join('')}</div>`;
}
actions['set-step']=el=>{const input=document.getElementById('set-'+el.dataset.key);input.value=Math.max(0,Math.min(1000,Number(input.value)+Number(el.dataset.n)));};
function saveSet(){
 const st=P.steps[P.i],kg=document.getElementById('set-kg'),reps=document.getElementById('set-reps');if(!kg||!reps||st.kind!=='work')return;
 if(!kg.reportValidity()||!reps.reportValidity())return false;
 const record={id:st.it.id,index:st.idx,set:st.set,kg:Number(kg.value),reps:Number(reps.value),totalSets:st.it.sets,target:Number(st.it.reps.split('-').at(-1))};
 P.sets=P.sets.filter(s=>!(s.index===st.idx&&s.set===st.set));P.sets.push(record);
}

actions["form-check"]=()=>{const st=P?.steps[P.i];if(!st||st.kind!=="work")return;startFormCheck(document.getElementById("form-check"),st.it.id,summary=>{const input=document.getElementById("set-reps");if(input&&summary.reps)input.value=summary.reps;if(summary.reps||summary.seconds)toast(`${summary.reps} reps · ${summary.seconds}s · ${summary.cues.join(" / ")}`);updateLog(P.iso,l=>{(l.formChecks||=[]).push({id:st.it.id,set:st.set,...summary});});});};
