// Screenshot capture only: app/ server, synthetic local state and mocked external traffic.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';
const app=path.resolve(import.meta.dirname,'../app'),out=path.resolve(import.meta.dirname,'../docs/round10-screens');
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);if(pathname==='/favicon.ico'){res.writeHead(204);return res.end();}const file=path.resolve(app,'.'+pathname+(pathname.endsWith('/')?'index.html':''));if(!file.startsWith(app+path.sep))throw Error('outside app');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
 const context=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:1,serviceWorkers:'block'});
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1')return route.continue();let body={};if(u.pathname==='/api/ideas')body={ideas:[{id:'00000000-0000-4000-8000-000000000001',title:'More home workouts',detail:'Short sessions for busy days.',status:'planned',votes:8,voted:0,created:Date.now()}]};if(u.pathname==='/api/supporter')body={supporter:null};if(u.pathname==='/api/videos')body={videos:[]};return route.fulfill({status:200,contentType:u.hostname.includes('fonts')?'text/css':'application/json',body:u.hostname.includes('fonts')?'':JSON.stringify(body)});});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.evaluate(async()=>{const {setState,todayISO}=await import('./js/store.js'),{POLICY_VERSION}=await import('./js/legal.js');setState(s=>{s.onboarded=true;s.telemetry=false;s.lang='en';s.consents={terms:'local',health:'local',version:POLICY_VERSION};s.profile.startDate=todayISO();s.profile.trainDays=[0,1,2,3,4,5,6];s.profile.fasting='14:10';s.profile.eatStart='08:00';});});
 await mkdir(out,{recursive:true});const checks=[];
 for(const theme of ['dark','light'])for(const route of ['today','workout','food','supps','me','ai-settings','support','ideas']){
  await page.evaluate(async({theme,route})=>{const {setState}=await import('./js/store.js');setState(s=>s.theme=theme);location.hash='#/'+route;const {rerender}=await import('./js/core.js');rerender();},{theme,route});await page.waitForSelector('.v-'+route);await page.waitForTimeout(300);
  const width=await page.evaluate(()=>document.documentElement.scrollWidth);checks.push({route,theme,width});await page.screenshot({path:path.join(out,`${route}-${theme}.png`)});
 }
 await writeFile(path.join(out,'capture.json'),JSON.stringify({viewport:375,checks,errors,externalTraffic:'all mocked'},null,2));if(errors.length||checks.some(c=>c.width>375))throw Error(JSON.stringify({errors,overflow:checks.filter(c=>c.width>375)}));console.log('Captured 16 screens at 375px; no console/page errors or horizontal overflow.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
