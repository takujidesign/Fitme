import './health-entry.js';
import {filterBeta,entryIntegration,integrationEnabled,betaCard} from './beta.js';
import {adminToken} from './admin-session.js';
import { preserveView, enterView, offerUpdate } from './render-stability.js';
import './views/round10-entry.js';
import {applyTab,setupEffects,parentTab,reducedMotion,animateToday} from './tab-effects.js';
import './views/ai-usage.js';
import { refreshCredits } from './ai-credits.js';
import { cacheOfflineAssets } from './offline.js';
import { enabledLanguages, languageFont, languageLoaded, loadLanguage } from './i18n/index.js';
import { loadVideos } from './videos.js';
import { consentCurrent } from './legal.js';
import { startTelemetry, screenView, featureUsed } from './telemetry.js';
import './views/round5.js';
import './views/admin-round5.js';
import { startMetrics } from './metrics.js';
import { blockDue } from './replan.js';
import { startAccountSync, refreshEntitlement } from './account.js';
import './views/account.js';
import './views/account-security.js';
import './views/trainer.js';
import './views/chat.js';
import './views/challenges.js';
import './views/replan.js';
import { applyTheme } from './theme.js';
import './custom-foods.js';
import './share.js';
import { startPushSync } from './notifications.js';
import { actions, views, setRenderer, route, go, rerender } from './core.js';
import { getState, setState } from './store.js';
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
import './views/admin-login.js';
import './views/library.js';
import './views/tools.js';
import './views/free-workout.js';
import './views/recipes.js';
import './views/credits.js';
import './views/training-settings.js';
import { loadConfig } from './config.js';
import {startSocialBadges} from './views/social.js';
import {loadAnnouncements} from './views/social-extra.js';
import './views/me-round11.js';
import './views/admin-round11.js';
import './views/admin-round13.js';
import './views/gemini-guide.js';
import {pageGuidance} from './guidance.js';

const TABS = [
  ['today', 'home', { th: 'วันนี้', en: 'Today' }],
  ['workout', 'dumbbell', { th: 'ออกกำลัง', en: 'Train' }],
  ['food', 'food', { th: 'อาหาร', en: 'Food' }],
  ['supps', 'pill', { th: 'อาหารเสริม', en: 'Supps' }],
  ['me', 'user', { th: 'ฉัน', en: 'Me' }],
];

const viewEl = document.getElementById('view');
const tabEl = document.getElementById('tabbar');

let renderedRoute = null;
const visitedRoutes = new Set();
function render() {
  if(!enabledLanguages().some(([id])=>id===getState().lang)){setState(s=>s.lang='en');toast('This language is unavailable. Switched to English.');}
  if(!languageLoaded(getState().lang)){loadLanguage(getState().lang).then(rerender).catch(()=>{setState(s=>s.lang='en');toast('Translation unavailable. Switched to English.');rerender();});return;}
  applyTheme();
  languageFont(getState().lang);
  const r = route();
  screenView(r.name);
  applyTab(r.name);
  let robots=document.querySelector('meta[data-admin-robots]');
  if(r.name==='admin'){if(!robots){robots=document.createElement('meta');robots.name='robots';robots.dataset.adminRobots='';document.head.append(robots);}robots.content='noindex';}else robots?.remove();
  if (!getState().onboarded && !['onboarding', 'admin', 'credits', 'privacy', 'terms', 'account', 'line-return', 'pay', 'forgot', 'reset', 'verify', 'sessions'].includes(r.name)) return go('#/onboarding');
  if(getState().onboarded && !consentCurrent() && !['credits','consent','privacy','terms','account','admin','line-return','forgot','reset','verify','sessions'].includes(r.name))return go('#/consent');
  const disabled=entryIntegration({getAttribute:()=>location.hash,dataset:{}});
  const v = disabled&&!integrationEnabled(disabled)?betaCard:(views[r.name] || views.today);
  const html = v(r);
  const changed = renderedRoute !== location.hash;
  const restore = preserveView(viewEl, !changed);
  const first = !visitedRoutes.has(r.name);
  renderedRoute = location.hash; visitedRoutes.add(r.name);
  document.body.classList.toggle('full', !!v.full || r.name === 'onboarding');
  viewEl.innerHTML = `<div class="view-inner v-${r.name}">${html}</div>`;
  if(changed) enterView(viewEl.firstElementChild);
  const mounted=v.mount?.(viewEl),inner=viewEl.querySelector('.view-inner');
  if(mounted?.then)mounted.then(()=>{if(viewEl.querySelector('.view-inner')===inner)restore();}).catch(()=>{});
  filterBeta(viewEl);
  if(adminToken()){const pill=document.createElement('small');pill.className='pill';pill.textContent='Admin preview';viewEl.prepend(pill);}
  restore();
  if(r.name==='today' && first)animateToday(viewEl);
  if(viewEl.querySelector('[data-ai-balance],[data-ai-cost]'))refreshCredits().catch(()=>{});
  tabEl.innerHTML = TABS.map(([name, ic, label]) => `<a href="#/${name}" class="${parentTab(r.name) === name ? 'on' : ''}">${icon(ic, 22)}<span>${L(label)}</span></a>`).join('')
    + (installEvt ? '' : '');
  document.documentElement.lang = getState().lang;
  pageGuidance(viewEl,r.name);
}
setRenderer(render);
setupEffects();
new MutationObserver(()=>filterBeta(document.body)).observe(document.body,{childList:true,subtree:true});

let lastHash = '';
window.addEventListener('hashchange', () => {
  const [a] = lastHash.split('?'), [b] = location.hash.split('?');
  lastHash = location.hash;
  if(document.startViewTransition&&!reducedMotion()){const t=document.startViewTransition(render);t.ready.catch(()=>{});t.finished.catch(()=>{});}else render();
  if (a !== b) window.scrollTo(0, 0);
});

// Delegated actions (works for the view and for bottom sheets appended to <body>)
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const integration=entryIntegration(el);if(integration&&!integrationEnabled(integration))return;
  const feature={'account-sync':'sync_now','share-card':'share','profile-share':'share','ref-share':'share','theme-set':'theme_change'}[el.dataset.act];if(feature)featureUsed(feature);
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
  b.innerHTML = `${icon('download', 20)}<div><b>${L('ติดตั้ง Fixmee เป็นแอป', 'Install Fixmee')}</b><small>${installEvt ? L('ใช้งานแบบออฟไลน์ เปิดจากหน้าจอโฮม', 'Works offline, opens from your home screen') : L('แตะ แชร์ ⬆ แล้วเลือก "เพิ่มไปยังหน้าจอโฮม"', 'Tap Share ⬆ then "Add to Home Screen"')}</small></div>
    ${installEvt ? `<button class="btn primary xs" id="inst-go">${L('ติดตั้ง', 'Install')}</button>` : ''}<button class="icon-btn" id="inst-x">${icon('x', 18)}</button>`;
  document.body.appendChild(b);
  b.querySelector('#inst-go')?.addEventListener('click', async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; b.remove(); });
  b.querySelector('#inst-x').addEventListener('click', () => { try { localStorage.setItem('fitme:install-dismissed', '1'); } catch {} b.remove(); });
}
setTimeout(showInstall, 4000);

if (!window.Capacitor?.isNativePlatform?.() && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').then(offerUpdate).catch(() => {});
}

await loadConfig();
await loadVideos();
startPushSync();
startLineReminders();
startMetrics();
startAccountSync();
startSocialBadges();
loadAnnouncements();
refreshEntitlement();
startTelemetry();
handleStripeReturn().then((r) => r && toast(L('ชำระเงินสำเร็จ 🎉', 'Payment confirmed 🎉'))).catch((e) => toast(e.message, 'warn'));
lastHash = location.hash;
if ((!location.hash || location.hash === '#/today') && getState().onboarded && blockDue(getState())) location.hash = '#/replan';
render();
cacheOfflineAssets().catch(()=>{});
window.addEventListener('online',()=>cacheOfflineAssets().catch(()=>{}));

// Old address: Fixmee moved to fixmee.app. Browser data is per-domain, so explain how to bring it along.
if (location.hostname === 'takujidesign.github.io') {
  const b = document.createElement('div');
  b.className = 'install';
  b.style.top = 'calc(var(--safe-t) + 10px)'; b.style.bottom = 'auto';
  b.innerHTML = `<div><b>${L('Fixmee ย้ายไปที่ fixmee.app แล้ว', 'Fixmee has moved to fixmee.app')}</b><small>${L('ข้อมูลในเครื่องไม่ย้ายตามอัตโนมัติ: กด "สำรองข้อมูล" ในหน้า ฉัน แล้วกู้คืนที่ fixmee.app หรือเข้าสู่ระบบเพื่อซิงก์', 'Data on this device does not move automatically: use "Back up data" on the Me page and restore it on fixmee.app, or sign in to sync')}</small></div><a class="btn primary xs" href="https://fixmee.app/">${L('ไปเลย', 'Open')}</a>`;
  document.body.appendChild(b);
}
export { rerender };
