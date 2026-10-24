import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {chromium} from 'playwright-core';
const app=path.resolve('app'),out=path.resolve('docs/round14-screens');
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);if(pathname==='/favicon.ico'){res.writeHead(204);return res.end();}const file=path.resolve(app,'.'+pathname+(pathname.endsWith('/')?'index.html':''));if(!file.startsWith(app+path.sep))throw Error('outside app');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await mkdir(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let context,profile;const errors=[];
try{
 profile=await mkdtemp(path.join(os.tmpdir(),'fitme-round14-browser-'));
 context=await chromium.launchPersistentContext(profile,{headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',viewport:{width:375,height:812},deviceScaleFactor:1,serviceWorkers:'block'});
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1'||u.hostname==='cdn.jsdelivr.net')return route.continue();return route.fulfill({status:200,contentType:u.hostname.includes('fonts')?'text/css':'application/json',body:u.hostname.includes('fonts')?'':JSON.stringify({items:[],config:{},videos:[],products:[],announcements:[]})});});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.evaluate(async()=>{const {setState,todayISO}=await import('./js/store.js'),{POLICY_VERSION}=await import('./js/legal.js');setState(s=>{s.onboarded=true;s.telemetry=false;s.lang='en';s.guidance.tourDone=true;s.consents={terms:'local',health:'local',version:POLICY_VERSION};s.profile.startDate=todayISO();});location.hash='#/library';});
 await page.waitForFunction(()=>document.querySelector('#library-count')?.textContent.match(/\/ 1\d\d\d/),null,{timeout:30000});
 for(const theme of ['dark','light']){
  await page.evaluate(async theme=>{const {setState}=await import('./js/store.js');setState(s=>s.theme=theme);},theme);await page.waitForTimeout(200);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=375));await page.screenshot({path:path.join(out,theme+'-library.png'),fullPage:false});
  await page.locator('[data-filter="source"]').selectOption('repdb');await page.locator('#library-search').fill('90/90');await page.locator('[data-act="library-open"]').first().click();await page.waitForTimeout(1000);await page.screenshot({path:path.join(out,theme+'-repdb-sheet.png'),fullPage:true});await page.evaluate(async()=>{(await import('./js/ui.js')).closeSheet();});
  await page.locator('#library-search').fill('');await page.locator('[data-filter="source"]').selectOption('');
  for(const id of ['bench_press','squat','pushup','deadlift','plank']){
   await page.evaluate(async id=>{(await import('./js/core.js')).actions['ex-open']({dataset:{id}});},id);await page.waitForTimeout(400);await page.screenshot({path:path.join(out,theme+'-'+id+'.png'),fullPage:true});await page.evaluate(async()=>{(await import('./js/ui.js')).closeSheet();});
  }
 }
 await writeFile(path.join(out,'browser-results.json'),JSON.stringify({viewport:375,errors,repdb:'runtime live CDN',profilesRemoved:true},null,2));assert.deepEqual(errors,[]);
}catch(error){await writeFile(path.join(out,'browser-block.txt'),String(error.stack));process.exitCode=1;console.error(String(error));}
finally{await context?.close();await new Promise(r=>server.close(r));if(profile){const resolved=path.resolve(profile);assert(path.dirname(resolved)===path.resolve(os.tmpdir())&&path.basename(resolved).startsWith('fitme-round14-browser-'));await rm(resolved,{recursive:true,force:true});}}
