import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';
const app=path.resolve('app'),out=path.resolve('docs/round20-screens');await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local'),f=path.resolve(app,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));if(!f.startsWith(app+path.sep)||/repdb/i.test(f)&&!f.endsWith('.js'))throw Error();res.setHeader('Content-Type',mime[path.extname(f)]||'application/octet-stream');res.end(await readFile(f));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const errors=[];
try{
 browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',args:['--disable-background-networking','--disable-sync']});
 const context=await browser.newContext({viewport:{width:375,height:812}});
 await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.fulfill({status:200,contentType:r.request().resourceType()==='stylesheet'?'text/css':'application/json',body:r.request().resourceType()==='stylesheet'?'':'{}'}));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/');
 await page.evaluate(async()=>{const {setState,todayISO}=await import('./js/store.js'),{CONFIG}=await import('./js/config.js'),{POLICY_VERSION}=await import('./js/legal.js');CONFIG.API_BASE='';setState(s=>{s.onboarded=true;s.telemetry=false;s.lang='th';s.guidance.tourDone=true;s.consents={terms:'yes',health:'yes',version:POLICY_VERSION};s.profile.startDate=todayISO();s.account={token:'synthetic',user:{id:'fixture'},lastSync:0};});await navigator.serviceWorker.ready;await (await import('./js/offline-core.js')).downloadOffline();});
 async function route(name){await page.evaluate(name=>location.hash='#/'+name,name);await page.waitForTimeout(150);}
 async function close(){await page.evaluate(async()=>(await import('./js/ui.js')).closeSheet());}
 async function shot(name){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=375),name+' overflow');await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
 for(const theme of ['light','dark']){
  await page.evaluate(async theme=>(await import('./js/store.js')).setState(s=>s.theme=theme),theme);await route('me');
  await page.evaluate(async()=>(await import('./js/offline-core.js')).setConnectivity(false));await shot(theme+'-offline-banner');await page.evaluate(async()=>(await import('./js/offline-core.js')).setConnectivity(true));
  await page.locator('#offline-readiness').scrollIntoViewIfNeeded();await shot(theme+'-offline-readiness');
  await page.evaluate(async()=>(await import('./js/notifications-ui.js')).showNotifications());await page.locator('#calendar-card').scrollIntoViewIfNeeded();await shot(theme+'-calendar-card');await close();
  await page.evaluate(async()=>(await import('./js/core.js')).actions['calendar-guide']());await shot(theme+'-calendar-guide');await close();
  await page.evaluate(async()=>{const {todayISO}=await import('./js/store.js');(await import('./js/reminder-runtime.js')).showMissed([{date:todayISO(),time:'08:00',title:'Water / น้ำ',id:'fixture',route:'#/today'}]);});await shot(theme+'-missed-reminders');await close();
  await page.evaluate(async()=>{const m=await import('./js/notifications-ui.js');m.showNotifications();await new Promise(r=>setTimeout(r,100));document.querySelector('#push-status').textContent=m.retryMessage(120);});await page.locator('#push-status').scrollIntoViewIfNeeded();await shot(theme+'-self-test-retry');await close();
 }
 const readiness=await page.evaluate(async()=>({...((await import('./js/offline-core.js')).offlineState)}));assert.equal(readiness.done,readiness.total);assert(readiness.total>0);
 await context.setOffline(true);for(const name of ['today','workout','food','supps','me','help']){await route(name);assert((await page.locator('#view').innerText()).length>20);}
 await page.reload();await page.waitForSelector('#view h1');assert((await page.locator('#view').innerText()).length>20);
 assert.deepEqual(errors,[]);await writeFile(path.join(out,'results.json'),JSON.stringify({viewport:375,themes:['light','dark'],screenshots:12,errors,readiness,offlineReload:true,externalServices:'mocked'},null,2));console.log('PASS 12 screenshots; 375px both themes; cached routes/reload offline; no page errors');
}catch(e){await writeFile(path.join(out,'browser-block.txt'),String(e.stack));console.error(e);process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.close(r));}
