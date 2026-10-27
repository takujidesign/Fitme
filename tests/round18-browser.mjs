import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';
const app=path.resolve('app'),out=path.resolve('docs/round18-screens'),profile=path.resolve('.tmp/round18-browser-profile');await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local'),f=path.resolve(app,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));if(!f.startsWith(app+path.sep))throw Error();res.setHeader('Content-Type',mime[path.extname(f)]||'application/octet-stream');res.end(await readFile(f));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser,context;const errors=[];
try{
 if(process.env.ROUND18_CDP){browser=await chromium.connectOverCDP(process.env.ROUND18_CDP);context=await browser.newContext({viewport:{width:375,height:812},serviceWorkers:'block'});}else context=await chromium.launchPersistentContext(profile,{headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',viewport:{width:375,height:812},serviceWorkers:'block',args:['--disable-background-networking','--disable-sync','--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1']});
 await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.fulfill({status:200,contentType:r.request().resourceType()==='stylesheet'?'text/css':'application/json',body:r.request().resourceType()==='stylesheet'?'':'{}'}));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/');
 await page.evaluate(async()=>{const {setState,todayISO}=await import('./js/store.js'),{CONFIG}=await import('./js/config.js'),{POLICY_VERSION}=await import('./js/legal.js');CONFIG.API_BASE='https://mock.test';CONFIG.byok={kiePath:'/openai/v1/responses',kieModel:'configured-model',affiliate:{gemini:'https://example.test/gemini',openai:'https://example.test/openai',kie:'https://example.test/kie'}};CONFIG.beta={enabled:true,byok:true,ai:false};const native=window.fetch;window.fetch=async(url,o)=>String(url).includes('/api/')?Response.json({links:[],notes:[],items:[],ok:true}):native(url,o);setState(s=>{s.onboarded=true;s.telemetry=false;s.lang='en';s.guidance.tourDone=true;s.consents={terms:'yes',health:'yes',version:POLICY_VERSION};s.account={token:'synthetic',user:{id:'synthetic',email:'review@example.test'},lastSync:Date.now(),stats:{bytes:18325,counts:{logs:25,weights:8,supplements:2,dailyMenus:7}}};s.profile.name='Review';s.profile.startDate=todayISO();});});
 async function route(name){await page.evaluate(name=>location.hash='#/'+name,name);await page.waitForTimeout(250);}
 async function shot(name){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=375),name+' overflow');await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
 for(const theme of ['light','dark']){
  await page.evaluate(async theme=>(await import('./js/store.js')).setState(s=>s.theme=theme),theme);
  await route('account');await shot(theme+'-sync-status');await page.click('[data-act=account-logout]');await shot(theme+'-logout');await page.evaluate(async()=>(await import('./js/ui.js')).closeSheet());
  await route('me');await page.evaluate(async()=>{Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{addEventListener(){}}});(await import('./js/render-stability.js')).offerUpdate({waiting:{postMessage(){}},addEventListener(){},update:async()=>{}});});await shot(theme+'-update-version');await page.evaluate(()=>document.getElementById('sw-update')?.remove());
  await route('ai-settings');await page.waitForSelector('#openai-key');await shot(theme+'-ai-providers');
  for(const p of ['openai','kie']){await route('byok-guide/'+p);await shot(theme+'-'+p+'-setup');}
  await route('food');await page.click('[data-act=daily-menu]');await page.waitForSelector('#menu-copy');await shot(theme+'-daily-menu');await page.evaluate(async()=>(await import('./js/ui.js')).closeSheet());
 }
 assert.deepEqual(errors,[]);await writeFile(path.join(out,'results.json'),JSON.stringify({viewport:375,themes:['light','dark'],screenshots:14,errors,network:'All external page requests mocked; synthetic account and menus'},null,2));console.log('PASS 14 screenshots; 375px, both themes, zero page errors');
}catch(e){await writeFile(path.join(out,'browser-block.txt'),String(e.stack));console.error(e);process.exitCode=1;}
finally{await context?.close();if(browser){const cdp=await browser.newBrowserCDPSession();await cdp.send('Browser.close').catch(()=>{});await browser.close();}await new Promise(r=>server.close(r));assert(profile===path.resolve('.tmp/round18-browser-profile'));await rm(profile,{recursive:true,force:true});}
