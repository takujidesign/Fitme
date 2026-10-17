import { cacheOfflineAssets } from './offline.js';
import { languageFont } from './i18n/index.js';
import { loadVideos } from './videos.js';
import { consentCurrent } from './legal.js';
import { startTelemetry } from './telemetry.js';
import './views/round5.js';
import './views/admin-round5.js';
import { startMetrics } from './metrics.js';
import { blockDue } from './replan.js';
import { startAccountSync, refreshEntitlement } from './account.js';
import './views/account.js';
import './views/trainer.js';
import './views/chat.js';
import './views/challenges.js';
import './views/replan.js';
import { applyTheme } from './theme.js';
import './custom-foods.js';
import './share.js';
import { startPushSync } from './notifications.js';
import { actions, views, setRenderer, route, go, rerender } from './core.js';
import { getState } from './store.js';
import { L, icon, toast } from './ui.js';
import { handleStripeReturn } from './pay.js';
import './views/onboard.js';
import './views/today.js';
import './views/workout.js';
import './views/food.js';
import './views/supps.js';
import './views/me.js';
import './views/pay.js';
import './views/admin.js';
import './views/coach.js';
import './views/planning.js';
import { startLineReminders } from './views/round5b.js';
import './views/admin-round5b.js';
import './views/round5c.js';
import './views/admin-round5c.js';
import { loadConfig } from './config.js';

const TABS = [
  ['today', 'home', { th: 'วันนี้', en: 'Today' }],
  ['workout', 'dumbbell', { th: 'ออกกำลัง', en: 'Train' }],
  ['food', 'food', { th: 'อาหาร', en: 'Food' }],
  ['supps', 'pill', { th: 'อาหารเสริม', en: 'Supps' }],
  ['me', 'user', { th: 'ฉัน', en: 'Me' }],
];

const viewEl = document.getElementById('view');
const tabEl = document.getElementById('tabbar');

function render() {
  applyTheme();
  languageFont(getState().lang);
  const r = route();
  if (!getState().onboarded && !['onboarding', 'admin', 'privacy', 'terms', 'account', 'line-return', 'pay'].includes(r.name)) return go('#/onboarding');
  if(getState().onboarded && !consentCurrent() && !['consent','privacy','terms','account','admin','line-return'].includes(r.name))return go('#/consent');
  const v = views[r.name] || views.today;
  const html = v(r);
  document.body.classList.toggle('full', !!v.full || r.name === 'onboarding');
  viewEl.innerHTML = `<div class="view-inner v-${r.name}">${html}</div>`;
  v.mount?.(viewEl);
  tabEl.innerHTML = TABS.map(([name, ic, label]) => `<a href="#/${name}" class="${r.name === name ? 'on' : ''}">${icon(ic, 22)}<span>${L(label)}</span></a>`).join('')
    + (installEvt ? '' : '');
  document.documentElement.lang = getState().lang;
}
setRenderer(render);

let lastHash = '';
window.addEventListener('hashchange', () => {
  const [a] = lastHash.split('?'), [b] = location.hash.split('?');
  lastHash = location.hash;
  render();
  if (a !== b) window.scrollTo(0, 0);
});

// Delegated actions (works for the view and for bottom sheets appended to <body>)
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});

// ---- PWA install ----
let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvt = e;
  showInstall();
});
function showInstall() {
  if (document.getElementById('install') || matchMedia('(display-mode: standalone)').matches) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  if (!installEvt && !ios) return;
  try { if (localStorage.getItem('fitme:install-dismissed')) return; } catch {}
  const b = document.createElement('div');
  b.id = 'install';
  b.className = 'install';
  b.innerHTML = `${icon('download', 20)}<div><b>${L('ติดตั้ง Fix me เป็นแอป', 'Install Fix me')}</b><small>${installEvt ? L('ใช้งานแบบออฟไลน์ เปิดจากหน้าจอโฮม', 'Works offline, opens from your home screen') : L('แตะ แชร์ ⬆ แล้วเลือก "เพิ่มไปยังหน้าจอโฮม"', 'Tap Share ⬆ then "Add to Home Screen"')}</small></div>
    ${installEvt ? `<button class="btn primary xs" id="inst-go">${L('ติดตั้ง', 'Install')}</button>` : ''}<button class="icon-btn" id="inst-x">${icon('x', 18)}</button>`;
  document.body.appendChild(b);
  b.querySelector('#inst-go')?.addEventListener('click', async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; b.remove(); });
  b.querySelector('#inst-x').addEventListener('click', () => { try { localStorage.setItem('fitme:install-dismissed', '1'); } catch {} b.remove(); });
}
setTimeout(showInstall, 4000);

if (!window.Capacitor?.isNativePlatform?.() && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

await loadConfig();
await loadVideos();
startPushSync();
startLineReminders();
startMetrics();
startAccountSync();
refreshEntitlement();
startTelemetry();
handleStripeReturn().then((r) => r && toast(L('ชำระเงินสำเร็จ 🎉', 'Payment confirmed 🎉'))).catch((e) => toast(e.message, 'warn'));
lastHash = location.hash;
if ((!location.hash || location.hash === '#/today') && getState().onboarded && blockDue(getState())) location.hash = '#/replan';
render();
cacheOfflineAssets().catch(()=>{});
window.addEventListener('online',()=>cacheOfflineAssets().catch(()=>{}));
export { rerender };
