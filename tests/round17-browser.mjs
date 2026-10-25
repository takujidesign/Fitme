import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';
const app=path.resolve('app'),out=path.resolve('docs/round17-screens'),profile=path.resolve('.tmp/round17-browser-profile');await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);const file=path.resolve(app,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(app+path.sep))throw Error('Forbidden');res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let context,browser;const errors=[];
try{
 if(process.env.ROUND17_CDP){browser=await chromium.connectOverCDP(process.env.ROUND17_CDP);context=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:1,serviceWorkers:'block'});}else context=await chromium.launchPersistentContext(profile,{headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',viewport:{width:375,height:812},serviceWorkers:'block',args:['--disable-background-networking','--disable-sync']});
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1')return route.continue();return route.fulfill({status:200,contentType:u.hostname.includes('fonts')?'text/css':'application/json',body:u.hostname.includes('fonts')?'':JSON.stringify({items:[],config:{},videos:[],products:[],announcements:[]})});});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.evaluate(async()=>{
  const {getState,setState,todayISO,addDays}=await import('./js/store.js'),{POLICY_VERSION}=await import('./js/legal.js'),{CONFIG}=await import('./js/config.js');CONFIG.API_BASE='https://mock.test';CONFIG.beta={enabled:false};
  const date=todayISO(),days=Array.from({length:30},(_,i)=>({date:addDays(date,i-29),source:'apple_shortcut',steps:5000+i*110,resting_hr:60+i%4,sleep_min:420+i%5*15,active_kcal:250,updated:Date.now()}));
  const health={consent:true,days,merged:days,connections:[{provider:'fitbit',last_sync:Date.now()}],providers:{fitbit:true,polar:true,withings:true,strava:true,oura:true},lastReceived:Date.now()};
  const native=window.fetch;window.fetch=async(url,opts)=>{if(String(url).includes('/api/health/data'))return Response.json(health);if(String(url).includes('/api/push/key'))return Response.json({publicKey:'AQID'});if(String(url).includes('/api/push/reminders'))return Response.json({registeredAt:Date.now(),reminders:[{date,time:'07:00',title:'Wake up',route:'#/today'},{date,time:'12:00',title:'Meal time',route:'#/food'},{date,time:'18:00',title:'Workout',route:'#/player/'+date},{date,time:'22:00',title:'Prepare for sleep',route:'#/today'}]});if(String(url).includes('/api/'))return Response.json({items:[],ok:true});return native(url,opts);};
  setState(s=>{s.onboarded=true;s.telemetry=false;s.lang='en';s.guidance.tourDone=true;s.consents={terms:'local',health:'local',version:POLICY_VERSION};s.account={token:'mock',user:{id:'mock'},version:0};s.healthImport=health;s.profile.startDate=date;s.notifications.deviceId='mock-device';for(const day of days)s.logs[day.date]={health:day};});
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:async()=>({pushManager:{getSubscription:async()=>({})}})}});Object.defineProperty(Notification,'permission',{configurable:true,get:()=> 'granted'});
 });
 for(const theme of ['dark','light']){
  await page.evaluate(async theme=>{const {setState}=await import('./js/store.js');setState(s=>s.theme=theme);},theme);
  for(const route of ['health','health-shortcut','health-providers','health-export']){
   await page.evaluate(route=>location.hash='#/'+route,route);await page.waitForTimeout(350);await page.waitForSelector('h1');
   if(route==='health-export'){await page.evaluate(()=>{class MockWorker{postMessage(){setTimeout(()=>this.onmessage({data:{type:'progress',loaded:42,total:100}}),10);}terminate(){}}window.Worker=MockWorker;});await page.locator('#health-file').setInputFiles({name:'synthetic-export.zip',mimeType:'application/zip',buffer:Buffer.from('synthetic fixture - parser tested separately')});await page.waitForTimeout(100);}
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=375),route+' overflow');await page.screenshot({path:path.join(out,theme+'-'+route+'.png'),fullPage:true});
  }
  await page.evaluate(async()=>{location.hash='#/me';});await page.waitForTimeout(100);await page.evaluate(async()=>{const {actions}=await import('./js/core.js');await actions.notifications();});await page.waitForTimeout(150);await page.screenshot({path:path.join(out,theme+'-notifications.png'),fullPage:true});await page.evaluate(async()=>{(await import('./js/ui.js')).closeSheet();});
 }
 await writeFile(path.join(out,'results.json'),JSON.stringify({viewport:375,themes:['dark','light'],errors,fixtures:'Synthetic local health data, fake push device and import progress; no third-party requests'},null,2));assert.deepEqual(errors,[]);console.log('PASS 10 screenshots at 375px, both themes; mocked services only');
}catch(e){await writeFile(path.join(out,'browser-block.txt'),String(e.stack));console.error(e);process.exitCode=1;}
finally{await context?.close();if(browser){const session=await browser.newBrowserCDPSession();await session.send('Browser.close').catch(()=>{});await browser.close();}await new Promise(r=>server.close(r));assert(profile===path.resolve('.tmp/round17-browser-profile'));await rm(profile,{recursive:true,force:true});}
