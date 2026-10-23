import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {Window} from 'happy-dom';
const window=new Window({url:'http://localhost/#/account'});
for(const k of ['window','document','localStorage','sessionStorage','navigator','location','FormData','Event'])Object.defineProperty(globalThis,k,{configurable:true,value:k==='window'?window:window[k]});
globalThis.requestAnimationFrame=()=>1;
const qrContext={};vm.runInNewContext(await readFile(new URL('../app/js/vendor/qrcode.min.js',import.meta.url),'utf8'),qrContext);window.qrcode=qrContext.qrcode;
globalThis.confirm=()=>true;
const {getState,setState}=await import('../app/js/store.js'),{views,actions}=await import('../app/js/core.js'),{CONFIG}=await import('../app/js/config.js'),{enabledLanguages,loadLanguage}=await import('../app/js/i18n/index.js');
await import('../app/js/views/account.js');await import('../app/js/views/account-security.js');
const {mountSecurity}=await import('../app/js/views/admin-security.js'),{mountSetup}=await import('../app/js/views/admin-setup.js');
const {setAdminSession}=await import('../app/js/admin-session.js');setAdminSession('b'.repeat(64),true);
const requests=[];
globalThis.fetch=async(url,opts={})=>{requests.push({url,opts});const path=new URL(url).pathname;if(path==='/api/admin/launch')return Response.json({verification:true,languages:{zh:false,ja:false,vi:false}});if(path==='/api/admin/status')return Response.json({secrets:{resendApiKey:{set:true}}});if(path==='/api/auth/sessions')return Response.json({sessions:[{family:'Chrome',created:1720000000000,last_used:1720000100000,current:true}]});return Response.json({message:'Check your email',items:[],user:{email:'person@example.test',verified:true}});};
assert.deepEqual(enabledLanguages().map(([id])=>id),['th','en']);CONFIG.launch.languages.zh=true;assert.equal(enabledLanguages()[2][0],'zh');CONFIG.launch.languages.zh=false;
const root=document.createElement('main');root.id='view';document.body.append(root);
const out=new URL('../docs/round12-screens/',import.meta.url);await mkdir(out,{recursive:true});
const css=(await readFile(new URL('../app/css/app.css',import.meta.url),'utf8')).replace(/@import[^;]+;/g,'');
async function capture(name,theme){await writeFile(new URL(`${theme}-${name}.html`,out),`<!doctype html><html data-theme="${theme}" lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'"><title>Round 12 ${name} — mocked DOM fixture</title><style>${css}</style><body><div id="app"><main id="view"><div class="view-inner">${root.innerHTML}</div></main></div></body></html>`);}
for(const theme of ['dark','light']){
 setState(s=>{s.lang='en';s.theme=theme;s.account={token:null,user:null};});
 for(const name of ['forgot','reset']){root.innerHTML=views[name]();assert(root.querySelector('input'));await capture(name,theme);}
 setState(s=>s.account={token:'a'.repeat(64),user:{email:'<img src=x onerror=alert(1)>',verified:false}});CONFIG.launch.verification=true;
 root.innerHTML=views.account();assert(!root.querySelector('img'));assert(root.textContent.includes('Verify your email'));await capture('verify-banner',theme);
 root.innerHTML=views.sessions();await views.sessions.mount(root);assert(root.textContent.includes('Chrome'));await capture('sessions',theme);
 root.replaceChildren();await mountSecurity(root,true);await root.querySelector('#totp-generate').click();await new Promise(r=>setTimeout(r,30));assert(root.querySelector('#totp-key svg'));await capture('admin-2fa',theme);
 root.replaceChildren();await mountSetup(root);assert(root.querySelector('a[href="#/admin/system?panel=languages"]'));assert(!root.querySelector('#lang-zh'));root.replaceChildren();await mountSecurity(root);assert(root.querySelector('#lang-zh'));assert(!root.querySelector('#lang-zh').checked);await capture('setup-languages',theme);
}
location.hash='#/forgot';root.innerHTML=views.forgot();root.querySelector('#forgot-email').value='person@example.test';await actions['forgot-send'](root.querySelector('button'));assert(requests.some(r=>r.url.endsWith('/api/auth/forgot')));
for(const lang of ['th','en','zh','ja','vi']){await loadLanguage(lang);setState(s=>s.lang=lang);for(const name of ['forgot','reset','verify','sessions']){root.innerHTML=views[name]();assert(!root.textContent.includes('undefined'));assert(!root.querySelector('[onclick]'));}}
const headers=await readFile(new URL('../app/_headers',import.meta.url),'utf8');for(const host of ['https://challenges.cloudflare.com','https://cdn.jsdelivr.net','https://world.openfoodfacts.org','https://storage.googleapis.com'])assert(headers.includes(host),host);assert(headers.includes("'wasm-unsafe-eval'"));assert(headers.includes('media-src'));assert(headers.includes("frame-ancestors 'none'"));assert(!headers.includes('MAP_TILE_HOST'));
const sw=await readFile(new URL('../app/sw.js',import.meta.url),'utf8');assert(sw.includes("const VERSION = 'fitme-v1';"));for(const file of ['turnstile.js','views/account-security.js','views/admin-security.js'])assert(sw.includes(file));
// Static first-load module graph, measured per HTTP resource, excluding dynamic imports.
const visited=new Set();async function visit(url){if(visited.has(url.href))return;visited.add(url.href);const source=await readFile(url,'utf8');for(const match of source.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"](\.[^'"]+)['"]/g))await visit(new URL(match[1],url));}
await visit(new URL('../app/js/app.js',import.meta.url));let gzip=0;for(const url of visited)gzip+=gzipSync(await readFile(new URL(url))).length;
await writeFile(new URL('../docs/round12-results/performance.json',import.meta.url),JSON.stringify({staticModules:visited.size,gzipBytes:gzip,budgetBytes:350*1024,pass:gzip<=350*1024,note:'Static import graph only; no CPU/browser measurement.'},null,2));assert(gzip<=350*1024,`First-load JS ${gzip} > 350 KiB`);
console.log(`PASS Round 12 screen DOM, escaping, language gates, mocked actions, CSP/SW; first-load static JS ${gzip} bytes gzip (${visited.size} modules). HTML fixtures saved, not browser screenshots.`);
await window.happyDOM.abort();
