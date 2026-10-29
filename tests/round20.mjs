import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {Window} from 'happy-dom';
const window=new Window({url:'https://local/'});
for(const k of ['window','document','localStorage','sessionStorage','navigator','location','history','IntersectionObserver','Event'])Object.defineProperty(globalThis,k,{configurable:true,value:k==='window'?window:window[k]});
globalThis.fetch=async()=>{throw Error('offline fixture');};globalThis.requestAnimationFrame=()=>1;
const {getState,setState,todayISO,addDays}=await import('../app/js/store.js');
const {reminderPlan,deviceZone,reminderTime}=await import('../app/js/reminders.js');
const {buildICS}=await import('../app/js/calendar.js');
const {precache,allowedAsset,setConnectivity,pendingSync}=await import('../app/js/offline-core.js');
const {missedReminders,scheduleNative,markDelivered,tickReminders,enableLocal}=await import('../app/js/reminder-runtime.js');
const {POLICY_VERSION}=await import('../app/js/legal.js');
setState(s=>{s.onboarded=true;s.telemetry=false;s.lang='en';s.consents={terms:'yes',health:'yes',version:POLICY_VERSION};s.notifications={...s.notifications,water:true,meals:true,sleep:true,workout:true,supplements:true,fasting:true,quietStart:'23:00',quietEnd:'06:00'};});
const originalTZ=process.env.TZ;
for(const zone of ['Asia/Bangkok','UTC','America/New_York']){process.env.TZ=zone;assert.equal(deviceZone(),zone);const r={date:'2026-03-08',time:'09:00'};assert.equal(new Date(reminderTime(r)).getHours(),9);const plan=reminderPlan('2026-03-07',undefined,14);assert(plan.length);assert(plan.every(r=>r.time>='06:00'&&r.time<'23:00'));const ics=buildICS(plan,{tz:zone,earlier:10,now:0});assert(!/(?<!\r)\n/.test(ics));assert(ics.split('\r\n').every(l=>Buffer.byteLength(l)<=75));
 // Minimal stack parser, unfolds physical lines and validates component structure.
 const stack=[],events=[];let current;for(const line of ics.replace(/\r\n[ \t]/g,'').split('\r\n')){if(!line)continue;const i=line.indexOf(':'),key=line.slice(0,i),value=line.slice(i+1);assert(i>0);if(key==='BEGIN'){stack.push(value);if(value==='VEVENT'){current={};events.push(current);}}else if(key==='END')assert.equal(stack.pop(),value);else if(current&&stack.includes('VEVENT'))(current[key]||=[]).push(value);}assert.equal(stack.length,0);assert(events.length);assert(events.every(e=>e.UID&&e.SEQUENCE&&e['DTSTART;TZID='+zone]&&e.TRIGGER.includes('PT0M')));assert(ics.includes('RRULE:FREQ=DAILY'));assert(ics.includes('TZID:'+zone));if(zone==='America/New_York')assert(ics.includes('BEGIN:DAYLIGHT'));
 const again=buildICS(plan,{tz:zone,now:100000,sequence:1});assert.deepEqual([...ics.matchAll(/UID:(.*)/g)].map(m=>m[1]),[...again.matchAll(/UID:(.*)/g)].map(m=>m[1]));}
process.env.TZ=originalTZ||'UTC';
const escaped=buildICS([{date:'2026-10-29',time:'10:00',title:'ชื่อ,;\\\n'.repeat(40),category:'meals'}]);assert(escaped.includes('\\,'));assert(escaped.includes('\\n'));assert(escaped.split('\r\n').every(l=>Buffer.byteLength(l)<=75));
const manifest=JSON.parse(await readFile('app/offline-manifest.json','utf8'));assert(manifest.some(a=>a.url.endsWith('exercise-db.json')));assert(!manifest.some(a=>/repdb/i.test(a.url)));assert(manifest.every(a=>allowedAsset(a.url)));assert(manifest.reduce((n,a)=>n+a.bytes,0)<40*1024*1024);
const entries=new Map(),cache={match:async k=>entries.get(k)?.clone(),put:async(k,r)=>entries.set(k,r)};let fetches=0;
const assets=[{url:'./data/a.json',bytes:4},{url:'./img/ex/a.webp',bytes:4},{url:'./data/repdb.json',bytes:1}];
const fetcher=async()=>{fetches++;return new Response('1234');};let result=await precache({manifest:assets,cache,fetcher,budget:4});assert.equal(result.done,1);assert.equal(fetches,1);
result=await precache({manifest:assets,cache,fetcher,estimate:{quota:5,usage:4}});assert.equal(result.done,1);assert.equal(fetches,1);result=await precache({manifest:assets,cache,fetcher});assert.equal(result.done,2);
setConnectivity(false);assert(document.querySelector('#offline-banner'));setConnectivity(true);assert(!document.querySelector('#offline-banner'));
setState(s=>{s.account.lastSync=Date.now();s.account.syncedAt={...s.updatedAt};});setState(s=>s.profile.name='Offline edit');assert(pendingSync()>0);
const now=new Date(todayISO()+'T12:00:00').getTime(),r={date:todayISO(),time:'11:59',title:'Water',id:'fixture',category:'water',route:'#/today'};
assert.equal(missedReminders([r],now-120000,now).length,1);assert.equal(missedReminders([r],now-120000,now,{fixture:now}).length,0);assert.equal(missedReminders([{...r,date:addDays(todayISO(),-2)}],now-3*86400000,now).length,0);
let scheduled,cancelled,asked=0;const plugin={checkPermissions:async()=>({display:'prompt'}),requestPermissions:async()=>{asked++;return {display:'granted'};},getPending:async()=>({notifications:[{id:55}]}),cancel:async v=>cancelled=v,registerActionTypes:async()=>{},schedule:async v=>scheduled=v};
const future=Array.from({length:100},(_,i)=>({...r,id:'n'+i,at:now+60000*(i+1)}));assert(await scheduleNative(plugin,future,{now,ask:true}));assert.equal(scheduled.notifications.length,64);assert.deepEqual(cancelled,{notifications:[{id:55}]});assert.equal(asked,1);await scheduleNative(plugin,future.slice(0,2),{now,ask:true});assert.equal(scheduled.notifications.length,2);
await enableLocal();localStorage.setItem('fitme:local-reminders',JSON.stringify({enabled:true,lastOpen:now-120000,delivered:{}}));markDelivered(r.id,now);assert(JSON.parse(localStorage.getItem('fitme:local-reminders')).delivered.fixture);
await import('../app/js/guidance.js');
// Every core view renders with all network calls failing.
const {views,actions}=await import('../app/js/core.js');for(const name of ['pay','today','workout','food','supps','me','planning','wellbeing','training-settings','daily-menu','food-log','tools','round5','round5b','round5c','round10','me-round11'])await import('../app/js/views/'+name+'.js');
for(const name of ['today','workout','food','supps','me','help','training-settings']){assert.equal(typeof views[name],'function',name);document.body.innerHTML=views[name]({name,params:[todayISO()],query:new URLSearchParams()});assert(document.body.textContent.trim().length>50,name);}
setState(s=>{s.profile.startDate=todayISO();s.profile.trainDays=[0,1,2,3,4,5,6];});document.body.innerHTML=views.player({params:[todayISO()]});assert(document.querySelector('#player'));views.player.mount(document.body);assert(document.body.textContent.length>20);globalThis.confirm=()=>true;actions['pl-exit']();
const before=getState().logs[todayISO()]?.water||0;assert(actions.water);actions.water({dataset:{ml:'250',iso:todayISO()}});assert(getState().logs[todayISO()].water>before);
// Worker cache fallback, timeout and RepDB network-only boundary.
const handlers={},buckets=new Map();const swcache=n=>{if(!buckets.has(n))buckets.set(n,new Map());const b=buckets.get(n);return {addAll:async urls=>urls.forEach(u=>b.set(new URL(u,'https://local/').href,new Response('shell'))),match:async r=>b.get(typeof r==='string'?new URL(r,'https://local/').href:r.url)?.clone(),put:async(r,v)=>b.set(typeof r==='string'?new URL(r,'https://local/').href:r.url,v)};};
const sw={self:{addEventListener:(n,f)=>handlers[n]=f,registration:{scope:'https://local/'},clients:{claim:async()=>{}}},caches:{open:async n=>swcache(n),keys:async()=>[...buckets.keys()],delete:async n=>buckets.delete(n)},location:{origin:'https://local'},URL,Response,AbortSignal,fetch:async()=>{throw Error('offline');}};
vm.runInNewContext(await readFile('app/sw.js','utf8'),sw);let wait;handlers.install({waitUntil:p=>wait=p});await wait;let response;handlers.fetch({request:{url:'https://local/missing-route',method:'GET',mode:'navigate'},respondWith:p=>response=p});assert.equal(await (await response).text(),'shell');response=null;handlers.fetch({request:new Request('https://local/data/repdb.json'),respondWith:p=>response=p});assert.equal(response,null);
const {retryMessage}=await import('../app/js/notifications-ui.js');assert.match(retryMessage(61),/2/);
// Push and foreground delivery use one serialized worker ledger.
const ledger=new Map(),shown=[];sw.caches.open=async()=>({match:async k=>ledger.get(String(k))?.clone(),put:async(k,v)=>ledger.set(String(k),v)});sw.self.clients.matchAll=async()=>[];sw.self.registration.showNotification=async(title,options)=>shown.push({title,options});
const payload={title:'Water',tag:'same-reminder',route:'#/today'};handlers.push({data:{json:()=>payload},waitUntil:p=>wait=p});await wait;
handlers.push({data:{json:()=>payload},waitUntil:p=>wait=p});await wait;let acknowledged=false;handlers.message({data:{type:'LOCAL_REMINDER',payload},ports:[{postMessage:r=>acknowledged=r.ok}],waitUntil:p=>wait=p});await wait;assert.equal(shown.length,1);assert(acknowledged);
// Reconnect flushes the existing per-key sync queue without touching timestamps.
const {CONFIG}=await import('../app/js/config.js');CONFIG.API_BASE='https://mock.test';let remote={},writes=0;
Object.defineProperty(navigator,'onLine',{configurable:true,value:false});setState(s=>{s.account={token:'fixture',user:{id:'fixture'},lastSync:0,syncedAt:{}};s.profile.name='Queued offline';});
const {syncNow,startAccountSync}=await import('../app/js/account.js');await syncNow();assert.equal(writes,0);
globalThis.fetch=async(url,o={})=>{if(String(url).endsWith('/sync')){if(o.method==='PUT'){remote=JSON.parse(o.body).json;writes++;}return Response.json({json:remote,version:writes});}return Response.json({links:[],connections:[]});};
startAccountSync();Object.defineProperty(navigator,'onLine',{configurable:true,value:true});window.dispatchEvent(new Event('online'));await new Promise(r=>setTimeout(r,50));assert.equal(remote.profile.name,'Queued offline');assert.equal(pendingSync(),0);CONFIG.API_BASE='';
// Reviewable DOM artifacts when the host cannot spawn a browser. These are not screenshots.
const {calendarCard}=await import('../app/js/reminder-ui.js'),{offlineCard}=await import('../app/js/offline-core.js'),{loadLanguage}=await import('../app/js/i18n/index.js');
for(const lang of ['zh','ja','vi']){await loadLanguage(lang);setState(s=>s.lang=lang);assert(!calendarCard().includes('Device calendar reminders'));assert(reminderPlan().every(r=>r.title));}
setState(s=>s.lang='th');await mkdir('docs/round20-screens',{recursive:true});const css=(await readFile('app/css/app.css','utf8')).replace(/@import[^;]+;/g,'');
for(const theme of ['light','dark'])for(const name of ['offline-banner','offline-readiness','calendar-card','calendar-guide','missed-reminders','self-test-retry']){
 document.body.innerHTML='';if(name==='offline-banner')setConnectivity(false);if(name==='offline-readiness')document.body.innerHTML=offlineCard();if(name==='calendar-card')document.body.innerHTML=calendarCard();if(name==='calendar-guide')actions['calendar-guide']();if(name==='missed-reminders')(await import('../app/js/reminder-runtime.js')).showMissed([r]);if(name==='self-test-retry')document.body.textContent=retryMessage(120);
 await writeFile(`docs/round20-screens/${theme}-${name}.fixture.html`,`<!doctype html><html lang="th" data-theme="${theme}"><meta charset="utf-8"><meta name="viewport" content="width=375"><title>Round 20 DOM fixture</title><style>${css}body{max-width:375px;margin:auto}.sheet-wrap .sheet{transform:translate(-50%,0);max-width:375px}.sheet-backdrop{opacity:1}</style><body><p>375px DOM fixture — NOT a browser screenshot</p>${document.body.innerHTML}</body></html>`);
}
console.log('PASS Round 20: timezones/DST, RFC5545 parser/folding/alarms/UIDs, cache budget/quota/exclusions, banner/queue, missed/dedup, native 64/replan, offline core routes/logging, SW fallback, retry UX');
await window.happyDOM.abort();
