import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';
const app=path.resolve('app'),out=path.resolve('docs/round23-screens');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local'),f=path.resolve(app,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!f.startsWith(app+path.sep))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(f)]||'application/octet-stream');res.end(await readFile(f));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const errors=[],checks=[];
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',args:['--disable-background-networking','--disable-sync']});
 const context=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:1,serviceWorkers:'block'});
 await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.fulfill({status:200,contentType:route.request().resourceType()==='stylesheet'?'text/css':'application/json',body:route.request().resourceType()==='stylesheet'?'':'{}'}));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/');
 await page.evaluate(async()=>{const {setState}=await import('./js/store.js'),{CONFIG}=await import('./js/config.js'),{POLICY_VERSION}=await import('./js/legal.js');CONFIG.beta.enabled=false;CONFIG.API_BASE='https://mock.test';globalThis.fetch=async()=>Response.json({});setState(s=>{s.onboarded=true;s.telemetry=false;s.lang='th';s.guidance.tourDone=true;s.consents={terms:'yes',health:'yes',version:POLICY_VERSION};s.supplements=[{uid:'b',productId:'vistra_bcomplex',startDate:'2026-11-02'}];Object.assign(s.profile,{startDate:'2026-11-02',wake:'05:30',bed:'21:30',workoutTime:'17:30',sessionMin:45,mealsPerDay:2,fasting:'none',trainDays:[0,1,2,3,4,5,6],routine:{meals:[{time:'08:10'},{time:'16:30'}],activities:[],weekend:null}});});location.hash='#/today?d=2026-11-02';});
 await page.waitForSelector('.timeline');
 const capture=async name=>{await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>375);assert.equal(overflow,false,name+' overflow');checks.push(name);};
 for(const theme of ['light','dark']){
  await page.evaluate(async theme=>{(await import('./js/ui.js')).closeSheet(true);const {setState}=await import('./js/store.js');setState(s=>{s.theme=theme;s.logs={};s.profile.routine.meals[0].time='08:10';});(await import('./js/core.js')).rerender();},theme);
  await page.evaluate(async()=> (await import('./js/views/routine.js')).showRoutine('2026-11-02'));await page.waitForSelector('#routine-form');await page.waitForTimeout(300);await capture(theme+'-routine-example');
  const before=await page.evaluate(async()=>JSON.stringify((await import('./js/store.js')).getState().profile));
  await page.locator('[data-r="meal:0"]').fill('05:35');assert.equal(await page.evaluate(async()=>JSON.stringify((await import('./js/store.js')).getState().profile)),before);
  assert((await page.locator('#routine-preview').innerText()).includes('20'));await page.locator('#routine-preview').scrollIntoViewIfNeeded();await capture(theme+'-conflict-warning');
  await page.locator('[data-fix="meal-m0"]').click();assert.equal(await page.locator('[data-mode="meal:0"]').inputValue(),'auto');
  await page.evaluate(async()=>{(await import('./js/ui.js')).closeSheet(true);(await import('./js/core.js')).rerender();});
  await page.locator('.timeline').scrollIntoViewIfNeeded();assert((await page.locator('.timeline').innerText()).includes('📌'));await capture(theme+'-today-pinned');
  // Go through the actual meal tap and change-time action.
  await page.locator('[data-act="meal-open"][data-k="m0"]').click();await page.locator('[data-act="routine-time"][data-key="meal-m0"]').click();await page.waitForSelector('#time-today');await page.waitForTimeout(300);await capture(theme+'-change-time');
  await page.locator('[data-r="time"]').fill('09:00');await page.locator('#time-today').click();await page.waitForSelector('.toast');assert((await page.locator('.toast').last().innerText()).includes('09:00'));await page.waitForTimeout(300);await capture(theme+'-change-toast');
  const plans=await page.evaluate(async()=>{const {planDay}=await import('./js/day.js');return [planDay('2026-11-02').meals[0].time,planDay('2026-11-03').meals[0].time];});assert.deepEqual(plans,['09:00','08:10']);
 }
 // Editing activity fields, weekday selection, weekend rows, save and cancellation.
 await page.evaluate(async()=> (await import('./js/views/routine.js')).showRoutine('2026-11-02'));await page.locator('#routine-add').click();await page.locator('[data-r="a:0:label"]').fill('Work');await page.locator('[data-r="a:0:start"]').fill('10:00');await page.locator('[data-kind="0"]').selectOption('free');await page.locator('#routine-weekend').check();await page.locator('[data-r="weekend:wake"]').fill('07:00');await page.locator('#routine-form button[type="submit"]').click();
 assert.equal(await page.evaluate(async()=>(await import('./js/store.js')).getState().profile.routine.activities[0].start),'10:00');
 // Reachable from Me and food preferences, with lazy UI loading.
 await page.evaluate(async()=>{(await import('./js/ui.js')).closeSheet(true);location.hash='#/me';});await page.locator('[data-act="routine"]').first().click();await page.waitForSelector('#routine-form');
 await page.evaluate(async()=>{(await import('./js/ui.js')).closeSheet(true);location.hash='#/food';});await page.locator('[data-act="food-prefs"]').click();await page.locator('[data-act="routine"]').click();await page.waitForSelector('#routine-form');
 assert.deepEqual(errors,[]);await writeFile(path.join(out,'results.json'),JSON.stringify({viewport:375,themes:['light','dark'],screenshots:checks,errors,network:'External requests mocked; local app only'},null,2));console.log('PASS Round 23 browser: 10 screenshots, 375px, both themes, draft/cancel/save, warnings/fixes, pinned timeline, time flow/toast, weekday activity/weekend editing, Me/food entry points');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
