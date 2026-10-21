// Local visual capture only. Serve app/ exclusively; never expose repository-root photos.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from 'playwright-core';
const app=fileURLToPath(new URL('../app/',import.meta.url)),out=fileURLToPath(new URL('../docs/round9-screens/',import.meta.url));
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),relative=decodeURIComponent(url.pathname);if(relative==='/favicon.ico'){res.writeHead(204);return res.end();}const file=path.resolve(app,'.'+relative+(relative.endsWith('/')?'index.html':''));if(!file.startsWith(app+path.sep)&&file!==path.join(app,'index.html'))throw Error();const data=await readFile(file);res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
 const context=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:1});
 // Prevent ALL external requests, including provider/config/fonts/images.
 await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.fulfill({status:200,contentType:'application/json',body:'{}'}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.evaluate(async()=>{const {setState,todayISO}=await import('./js/store.js');setState(s=>{s.onboarded=true;s.lang='en';s.profile.startDate=todayISO();});location.hash='#/workout';});await page.waitForSelector('.v-workout');await mkdir(out,{recursive:true});
 const open=async id=>{await page.evaluate(async id=>{const {actions}=await import('./js/core.js');actions['ex-open']({dataset:{id}});},id);await page.waitForSelector('.exercise-visual-panel svg');};
 for(const theme of ['dark','light']){
  await page.evaluate(async theme=>{const {setState}=await import('./js/store.js');setState(s=>s.theme=theme);document.documentElement.dataset.theme=theme;},theme);
  for(const id of ['bench_press','squat','pushup','plank','deadlift']){
   await open(id);await page.waitForTimeout(220);await page.screenshot({path:path.join(out,`${id}-${theme}-animation.png`)});
   await page.locator('[data-mode="pair"]').click();assert.equal(await page.locator('.start-finish svg').count(),2);await page.screenshot({path:path.join(out,`${id}-${theme}-start-finish.png`)});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=375),id+' overflow');
  }
  // All forty pair views fit the sheet in both themes, including every localized label.
  for(const lang of ['th','en','zh','ja','vi']){
   await page.evaluate(async lang=>{const {setState}=await import('./js/store.js');setState(s=>s.lang=lang);},lang);
   const ids=await page.evaluate(async()=>Object.keys((await import('./js/exercises.js')).EX));
   for(const id of ids){await open(id);await page.locator('[data-mode="pair"]').click();assert.equal(await page.locator('.start-finish svg').count(),2);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=375),`${id}/${theme}/${lang}`);}
  }
 }
 await page.emulateMedia({reducedMotion:'reduce'});await open('squat');assert.equal(await page.locator('.start-finish svg').count(),2);await page.emulateMedia({reducedMotion:'no-preference'});
 await open('squat');const perf=await page.evaluate(async()=>{const body=document.querySelector('#ex-anim .body'),first=body.firstElementChild,ts=[];await new Promise(resolve=>{function next(t){ts.push(t);if(ts.length<121)requestAnimationFrame(next);else resolve();}requestAnimationFrame(next);});return {meanFrameMs:(ts.at(-1)-ts[0])/120,sameSvgNode:first===body.firstElementChild};});assert(perf.sameSvgNode);assert.deepEqual(errors,[]);
 await writeFile(path.join(out,'capture.json'),JSON.stringify({viewport:{width:375,height:812},screenshots:20,allPairChecks:400,errors,performance:perf,note:'Desktop Chromium; not physical mid-phone proof. bench_press is the existing flat bench press; no incline dumbbell pose exists in the 40-exercise catalog.'},null,2));console.log(JSON.stringify({errors,performance:perf,screenshots:20}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
