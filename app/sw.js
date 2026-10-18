// Offline-first service worker. Bump VERSION on every release.
const VERSION = 'fitme-v1'; // replaced with the commit SHA by the deploy workflow
const SHELL = [
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
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'fitme-videos-v1' && k !== 'fitme-assets-v1').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.includes('/api/')) return; // never cache API calls
  const isShell = url.origin === location.origin;
  const isFont = ['fonts.googleapis.com','fonts.gstatic.com','cdnjs.cloudflare.com','cdn.jsdelivr.net'].includes(url.hostname);
  if (!isShell && !isFont) return;
  e.respondWith(caches.open(isFont ? 'fitme-assets-v1' : VERSION).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: isShell });
    if (isFont && hit) return hit; // fonts/libs: cache-first
    // app files: network-first so releases show up immediately, cache when offline
    try {
      const res = await fetch(req, { cache: 'no-cache' }); // revalidate, skip stale HTTP cache
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    } catch {
      return hit || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error());
    }
  }));
});

self.addEventListener('push', e => {
  let data; try { data = e.data?.json(); } catch {}
  const route = /^#\/(today|food|workout|supps|me)$/.test(data?.route) ? data.route : '#/today';
  e.waitUntil(self.registration.showNotification(data?.title || 'Fixmee', {body:data?.body || '',icon:'./icons/icon-192.png',tag:data?.tag,data:{route}}));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const route = /^#\/(today|food|workout|supps|me)$/.test(e.notification.data?.route) ? e.notification.data.route : '#/today';
  const url = new URL('./', self.registration.scope); url.hash = route;
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients => {
    const client = clients.find(c => c.url.startsWith(self.registration.scope));
    if(client){await client.navigate(url.href);await client.focus();}else await self.clients.openWindow(url.href);
  }));
});
