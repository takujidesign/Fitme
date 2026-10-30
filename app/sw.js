// Offline-first service worker. Bump VERSION on every release.
const VERSION = 'fitme-v1'; // replaced with the commit SHA by the deploy workflow
const OFFLINE_CACHE = VERSION+'-offline-r20';
const DELIVERY_CACHE = 'fitme-reminder-delivery-v1';
const SHELL = [ './js/landing.js','./js/push-routes.js','./js/push-storage.js','./js/reminder-privacy.js','./js/push-actions.js',
 './js/i18n/round20.js','./offline.html','./offline-manifest.json','./js/reminders.js','./js/calendar.js','./js/reminder-runtime.js','./js/reminder-ui.js','./js/offline-core.js',
  './js/usage-labels.js','./js/usage-policy.js','./js/usage-copy.js','./js/usage-copy-data.js','./js/legal-content.js','./js/charts.js','./js/views/admin-usage.js','./js/i18n/round19.js','./js/seo-mode.js','./js/seo-boot.js',
 './js/i18n/round18.js','./js/views/round10-entry.js','./js/daily-menu.js','./js/views/daily-menu.js','./js/byok.js','./js/views/byok.js','./js/backup.js',
 './js/views/admin-health.js','./js/health-entry.js','./js/i18n/round17.js','./js/notifications-ui.js','./js/health-math.js','./js/health-model.js','./js/health-sync.js','./js/health-parser.js','./js/health-import-worker.js','./js/vendor/fflate.js','./js/views/health-data.js',
  './js/image-upload.js', './js/i18n/round16.js',
  './js/vendor/three/BufferGeometryUtils.js','./js/vendor/three/GLTFLoader.js','./js/vendor/three/OrbitControls.js','./js/vendor/three/meshopt_decoder.module.js','./js/vendor/three/three.core.js','./js/vendor/three/three.module.js',
  './js/three-motion.js','./js/three-viewer.js','./js/library-paging.js','./js/three-support.js','./js/i18n/round15.js',
  './js/repdb.js','./js/repdb-worker.js','./js/exercise-merge.js','./js/i18n/round14.js','./data/exercise-aliases.json','./data/illustrations-3d.json',
  './js/render-stability.js','./js/beta-policy.js','./js/beta.js','./js/lab.js','./js/views/admin-round13.js','./js/views/admin-lab.js','./js/views/gemini-guide.js','./img/lab/meal.svg','./img/lab/label.svg','./img/lab/body.svg',
  './js/i18n/round13.js','./js/i18n/round12.js','./js/turnstile.js','./js/views/account-security.js','./js/views/admin-security.js',
  './js/i18n/round11.js', './js/views/admin-setup.js',
  './js/gym-map.js', './js/vendor/leaflet/leaflet.js', './js/vendor/leaflet/leaflet.css', './js/chat-realtime.js', './js/palettes.js', './js/errors.js', './js/help-data.js', './js/guidance.js', './js/views/social.js', './js/views/social-extra.js', './js/views/me-round11.js', './js/views/admin-round11.js', './js/views/admin-system.js', './js/views/admin-content.js',
  './js/i18n/round10.js','./js/vendor/qrcode.min.js',
  './js/ai-engines.js','./js/ai-schemas.js','./js/vendor/zod.js','./js/views/round10.js','./js/views/admin-round10.js','./js/tab-effects.js',
  './js/illustrations.js', './js/i18n/round9.js', './data/illustrations.json',
  './js/ai-credits.js', './js/views/ai-usage.js', './js/views/admin-ai.js',
  './js/i18n/round7.js', './js/slots.js', './js/training.js', './js/training-controls.js', './js/views/training-settings.js',
  './js/i18n/round6.js',
  './data/exercise-db.json',
  './js/exercise-library.js','./js/muscle-map.js','./js/tools.js','./js/records.js','./js/recipes.js','./js/views/library.js','./js/views/tools.js','./js/views/free-workout.js','./js/views/recipes.js','./js/views/credits.js','./data/recipes-th.json',
  './js/admin-session.js','./js/views/admin-login.js',
  './js/form-check.js','./js/eating-out.js','./js/install-id.js','./js/views/wellbeing.js','./js/views/round5c.js','./js/views/admin-round5c.js',
  './js/i18n/index.js','./js/i18n/zh.js','./js/i18n/ja.js','./js/i18n/vi.js',
  './js/conditions.js','./js/readiness.js','./js/interactions.js','./js/barcode.js','./js/offline.js','./js/views/round5b.js','./js/views/admin-round5b.js',
  './js/legal.js', './js/telemetry.js', './js/womens-health.js', './js/programs.js', './js/videos.js', './js/views/round5.js', './js/views/admin-round5.js',
  './js/sync-data.js', './js/account.js', './js/challenges.js', './js/replan.js', './js/metrics.js',
  './js/views/account.js', './js/views/trainer.js', './js/views/chat.js', './js/views/challenges.js', './js/views/replan.js', './js/views/admin-keys.js',
  './', './index.html', './manifest.webmanifest', './css/app.css', './icons/icon.svg', './icons/icon-192.png',
  './js/views/food-log.js',
  './js/notifications.js',
  './js/measurements.js', './js/share.js', './js/custom-foods.js', './js/health.js', './js/voice.js', './js/theme.js',
  './js/app.js', './js/core.js', './js/config.js', './js/store.js', './js/ui.js', './js/calc.js', './js/figure.js',
  './js/exercises.js', './js/workout.js', './js/foods.js', './js/meals.js', './js/supplements.js', './js/day.js',
  './js/fasting.js', './js/views/planning.js', './js/progress.js', './js/pay.js', './js/export.js',
  './js/views/onboard.js', './js/views/today.js', './js/views/workout.js', './js/views/food.js',
  './js/views/supps.js', './js/views/me.js', './js/views/pay.js', './js/views/admin.js', './js/views/coach.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.filter(path=>path!=='./data/exercise-db.json'&&!path.startsWith('./js/vendor/three/')&&!['./js/three-motion.js','./js/three-viewer.js'].includes(path)))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== OFFLINE_CACHE && k !== DELIVERY_CACHE && k !== VERSION && k !== 'fitme-videos-v1' && k !== 'fitme-assets-v1').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers?.get('X-Fixmee-Precache')) return;
  const url = new URL(req.url);
  if (/repdb/i.test(url.href)&&!(url.origin===location.origin&&/\/js\/repdb(?:-worker)?\.js$/.test(url.pathname))) return; // Adapter code is shell; restricted runtime data/images are network-only.
  if (url.pathname.includes('/api/')) return; // never cache API calls
  const isShell = url.origin === location.origin;
  // Large offline data is downloaded in the background into OFFLINE_CACHE.
  const is3D = isShell && (/\/3d\//.test(url.pathname)||/\/js\/(three-viewer|three-motion)\.js$/.test(url.pathname)||url.pathname.includes('/js/vendor/three/'));
  const isFont = ['fonts.googleapis.com','fonts.gstatic.com','cdnjs.cloudflare.com','cdn.jsdelivr.net'].includes(url.hostname);
  if (!isShell && !isFont) return;
  e.respondWith(caches.open(is3D ? 'fitme-assets-v1' : isFont ? 'fitme-assets-v1' : VERSION).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: isShell }) || await (await caches.open(OFFLINE_CACHE)).match(req,{ignoreSearch:true});
    if ((isFont || is3D) && hit) return hit; // fonts/libs: cache-first
    // app files: network-first so releases show up immediately, cache when offline
    try {
      const res = await fetch(req, { cache: 'no-cache', ...(req.mode==='navigate'?{signal:AbortSignal.timeout(3000)}:{}) }); // revalidate, skip stale HTTP cache
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    } catch {
      if(hit)return hit;
      if(req.mode==='navigate'){const fallback=await cache.match('./offline.html');if(fallback&&self.registration?.scope)return new Response((await fallback.text()).replace('href="./#/today"','href="'+self.registration.scope+'#/today"'),{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});return fallback||Response.error();}
      return Response.error();
    }
  }));
});

function pushStorage(value){return new Promise((resolve,reject)=>{const request=indexedDB.open('fitme-push-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('state');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('state',value===undefined?'readonly':'readwrite'),store=tx.objectStore('state'),op=value===undefined?store.get('registration'):store.put(value,'registration');let result;op.onsuccess=()=>result=op.result;tx.oncomplete=()=>{db.close?.();resolve(result);};tx.onerror=()=>{db.close?.();reject(tx.error);};};});}

const PUSH_ROUTE = /^#\/(today|food|workout|supps|me|help|friends|friend-challenges|together|player\/\d{4}-\d{2}-\d{2}|messages\/[A-Za-z0-9_-]{1,64})$/;
const safeRoute=route=>typeof route==='string'&&PUSH_ROUTE.test(route)?route:'#/today';
let deliveryQueue=Promise.resolve();
function deliver(data){
 deliveryQueue=deliveryQueue.catch(()=>{}).then(async()=>{
  const cache=await caches.open(DELIVERY_CACHE),key=new URL('./__reminder/'+encodeURIComponent(data.reminder?.id||data.tag),self.registration.scope);
  if(data.tag&&await cache.match(key)&&data.reminder?.category!=='chat')return;
  const saved=typeof indexedDB!=='undefined'?await pushStorage().catch(()=>null):null,mode=saved?.prefs?.privacy??data.privacy??'medications';
  if(mode==='all'||mode==='medications'&&data.reminder?.category==='medications'){data={...data,title:({th:'Fixmee: ถึงเวลาแล้ว',en:'Fixmee: reminder due',zh:'Fixmee: 提醒时间到了',ja:'Fixmee: リマインダーの時間です',vi:'Fixmee: Đã đến giờ nhắc nhở'}[saved?.prefs?.lang||data.lang]||'Fixmee: reminder due'),body:''};if(data.reminder)data.reminder={...data.reminder,title:data.title,body:''};}
  await self.registration.showNotification(data.title||'Fixmee',{body:data.body||'',icon:'./icons/icon-192.png',badge:'./icons/icon-192.png',tag:data.tag,data:{route:data.route,reminder:data.reminder},actions:[{action:'done',title:'✓ Done / ทำแล้ว'},{action:'snooze',title:'+10 min / เลื่อน'}]});
  await workerBadge(saved,data);
  if(data.tag){await cache.put(key,Response.json({at:Date.now()}));for(const client of await self.clients.matchAll())client.postMessage({type:'REMINDER_DELIVERED',id:data.reminder?.id||data.tag});}
 });return deliveryQueue;
}
self.addEventListener('push', e => {
  let data; try { data = e.data?.json(); } catch {}
  const route = safeRoute(data?.route);
  e.waitUntil(deliver({...data,route}));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if(e.action==='done'){e.waitUntil(workerAck(e.notification,'done'));return;}
  const route = safeRoute(e.notification.data?.route);
  const url = new URL('./', self.registration.scope); url.hash = route;
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients => {
    if(e.action==='snooze'&&e.notification.data?.reminder){await workerAck(e.notification,'snooze');const cache=await caches.open(DELIVERY_CACHE);await cache.put(new URL('./__snooze/'+encodeURIComponent(e.notification.tag),self.registration.scope),Response.json({reminder:e.notification.data.reminder,at:Date.now()+600000}));}
    const client = clients.find(c => c.url.startsWith(self.registration.scope));
    if(client){await client.navigate(url.href);await client.focus();}else await self.clients.openWindow(url.href);
  }));
});

self.addEventListener('message',event=>{if(event.data?.type==='LOCAL_REMINDER')event.waitUntil(deliver(event.data.payload).then(()=>event.ports?.[0]?.postMessage({ok:true})).catch(()=>event.ports?.[0]?.postMessage({ok:false})));if(['APPLY_UPDATE','SKIP_WAITING'].includes(event.data?.type))self.skipWaiting();if(['GET','GET_VERSION'].includes(event.data?.type))(event.ports?.[0]||event.source)?.postMessage({version:VERSION});});

self.addEventListener('pushsubscriptionchange',e=>e.waitUntil((async()=>{
 const saved=await pushStorage();if(!saved?.deviceId||!saved.publicKey)return;
 const applicationServerKey=Uint8Array.from(atob(saved.publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 const sub=e.newSubscription||await self.registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey});
 const body={deviceId:saved.deviceId,subscription:sub.toJSON(),tz:saved.tz,prefs:saved.prefs,reminders:saved.reminders};
 const response=await fetch(saved.api+'/api/push/subscribe',{method:'POST',headers:{'Content-Type':'application/json','X-Push-Device':saved.deviceId},body:JSON.stringify(body)});
 if(!response.ok)throw Error('Push renewal failed');await pushStorage({...saved,...body,registeredAt:Date.now()});
})()));
async function workerAck(notification,action){
 const saved=typeof indexedDB!=='undefined'?await pushStorage().catch(()=>null):null,id=notification.data?.reminder?.id||notification.tag;
 if(!id)return;const cache=await caches.open(DELIVERY_CACHE);await cache.put(new URL('./__ack/'+encodeURIComponent(id),self.registration.scope),Response.json({id,action,at:Date.now()}));
 if(saved){saved.acks={...saved.acks,[id]:Date.now()};await pushStorage(saved);await workerBadge(saved);if(saved.deviceId)try{await fetch(saved.api+'/api/push/ack',{method:'POST',headers:{'Content-Type':'application/json','X-Push-Device':saved.deviceId},body:JSON.stringify({id,action,at:Date.now()})});}catch{}}
 for(const client of await self.clients.matchAll())client.postMessage({type:'REMINDER_ACK',id,action});
}
async function workerBadge(saved,data){
 if(typeof navigator==='undefined'||!navigator.setAppBadge)return;
 if(saved?.prefs?.badge===false||data?.badge===false){await navigator.clearAppBadge?.();return;}
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:saved?.tz||'UTC',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
 const date=parts.year+'-'+parts.month+'-'+parts.day,time=parts.hour+':'+parts.minute;
 const count=(saved?.reminders||[]).filter(r=>r.date===date&&r.time<=time&&!saved.acks?.[r.id]).length;
 if(count)await navigator.setAppBadge(count);else await navigator.clearAppBadge?.();
}
