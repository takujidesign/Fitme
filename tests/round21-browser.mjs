import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';
const app=path.resolve('app'),out=path.resolve('docs/round21-screens');await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local'),f=path.resolve(app,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));if(!f.startsWith(app+path.sep)||/repdb/i.test(f)&&!f.endsWith('.js'))throw Error();res.setHeader('Content-Type',mime[path.extname(f)]||'application/octet-stream');res.end(await readFile(f));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));

let browser;const errors=[];
try{
 browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',args:['--disable-background-networking','--disable-sync']});
 const context=await browser.newContext({viewport:{width:375,height:812}});
 await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.fulfill({status:200,contentType:r.request().resourceType()==='stylesheet'?'text/css':'application/json',body:r.request().resourceType()==='stylesheet'?'':'{}'}));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/');
 await page.evaluate(async()=>{const {setState,todayISO}=await import('./js/store.js'),{CONFIG}=await import('./js/config.js'),{POLICY_VERSION}=await import('./js/legal.js');CONFIG.API_BASE='';setState(s=>{s.onboarded=true;s.telemetry=false;s.lang='th';s.guidance.tourDone=true;s.consents={terms:'yes',health:'yes',version:POLICY_VERSION};s.profile.startDate=todayISO();});});
 for(const theme of ['light','dark']){
 await page.evaluate(async theme=>{(await import('./js/ui.js')).closeSheet();(await import('./js/store.js')).setState(s=>s.theme=theme);(await import('./js/notifications-ui.js')).showNotifications();},theme);
 await page.waitForTimeout(150);await page.screenshot({path:path.join(out,theme+'-notification-settings.png'),fullPage:true});
 await page.locator('#push-privacy').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,theme+'-privacy-preview.png'),fullPage:true});
 await page.evaluate(async()=>{const {closeSheet}=await import('./js/ui.js'),{showMissed,missedReminders}=await import('./js/reminder-runtime.js'),{acknowledge}=await import('./js/push-actions.js'),{todayISO}=await import('./js/store.js');closeSheet();await acknowledge('fixture-done');const list=[{id:'fixture-done',title:'ACKED ITEM MUST BE HIDDEN',date:todayISO(),time:'00:00'},{id:'fixture-missed',title:'ดื่มน้ำ',date:todayISO(),time:'00:00'}];showMissed(missedReminders(list,0,Date.now()));});
 assert.equal(await page.getByText('ACKED ITEM MUST BE HIDDEN').count(),0);await page.screenshot({path:path.join(out,theme+'-missed-list.png'),fullPage:true});
 await page.evaluate(async()=>{const {sheet,closeSheet}=await import('./js/ui.js'),{pushDiagnosticsView}=await import('./js/views/admin-usage.js');closeSheet();sheet(pushDiagnosticsView({services:[{host:'fcm.googleapis.com',failures:2,cleanups:1}],items:[{device:'12345678',host:'fcm.googleapis.com',status:410,reason:'Subscription removed',at:Date.now()}]}));});await page.screenshot({path:path.join(out,theme+'-admin-diagnostics.png'),fullPage:true});
 }
 // Real browser IndexedDB + mocked PushManager/fetch: no provider calls.
 const renewal=await page.evaluate(async()=>{
 const {setState}=await import('./js/store.js'),{CONFIG}=await import('./js/config.js'),{syncPush}=await import('./js/notifications.js'),{pushStorage}=await import('./js/push-storage.js');
 CONFIG.API_BASE='https://fixture.test';let endpoint='https://push.test/one',sub=null,subscribes=0,registrations=0,unregisters=0,permission='granted';
 const make=()=>({endpoint,options:{applicationServerKey:new Uint8Array([4])},toJSON:()=>({endpoint,keys:{}}),unsubscribe:async()=>{sub=null;}});
 const reg={pushManager:{getSubscription:async()=>sub,subscribe:async()=>{subscribes++;return sub=make();}}};
 Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{ready:Promise.resolve(reg)}});Object.defineProperty(Notification,'permission',{configurable:true,get:()=>permission});
 window.fetch=async(url,options)=>{if(url.endsWith('/key'))return Response.json({publicKey:'BA'});if(url.endsWith('/unsubscribe')){unregisters++;return Response.json({});}registrations++;return Response.json({deviceId:'12345678-1234-4123-8123-123456789012',registeredAt:Date.now()});};
 setState(s=>{s.notifications.enabled=true;s.notifications.deviceId=null;});await syncPush(true);const first={registrations,subscribes};await syncPush(true);const throttled=registrations;
 endpoint='https://push.test/two';sub=make();await syncPush(true);const changed=registrations;sub=null;await syncPush(true);const missing=subscribes;
 const saved=await pushStorage();await pushStorage({...saved,registeredAt:Date.now()-86400001});await syncPush(true);const daily=registrations;
 permission='denied';await syncPush(true);return {first,throttled,changed,missing,daily,unregisters,enabled:(await import('./js/store.js')).getState().notifications.enabled};
 });
 assert.deepEqual(renewal,{first:{registrations:1,subscribes:1},throttled:1,changed:2,missing:2,daily:4,unregisters:1,enabled:false});assert.deepEqual(errors,[]);
 await writeFile(path.join(out,'validation.json'),JSON.stringify({width:375,themes:['light','dark'],screenshots:8,renewal,errors},null,2));console.log('PASS eight 375px screenshots, ack-hidden UI, browser IDB renewal/null/changed/denied/24-hour throttle, no page errors');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
