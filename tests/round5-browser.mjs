import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
const {chromium}=await import(process.env.PLAYWRIGHT_PATH||'playwright');
const app=fileURLToPath(new URL('../app/',import.meta.url));
const server=createServer(async(req,res)=>{try{const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(app,'.'+relative+(relative.endsWith('/')?'index.html':''));if(!file.startsWith(app))throw Error();const body=await readFile(file);res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 const context=await browser.newContext({viewport:{width:375,height:812}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.evaluate(async()=>{const {setState,todayISO}=await import('./js/store.js');const {POLICY_VERSION}=await import('./js/legal.js');setState(s=>{s.onboarded=true;s.consents={terms:todayISO(),health:todayISO(),version:POLICY_VERSION};s.profile.sex='female';});});
 const output=path.join(os.tmpdir(),'fitme-round5-screens');await mkdir(output,{recursive:true});
 for(const lang of ['th','en'])for(const theme of ['light','dark']){
  await page.evaluate(async({lang,theme})=>{const {setState}=await import('./js/store.js');setState(s=>{s.lang=lang;s.theme=theme;});},{lang,theme});
  for(const route of ['today','workout','food','supps','me','account','pay','privacy','terms','programs','womens-health','plans','trainer-plans','plan-checkout','admin']){
   await page.evaluate(route=>location.hash='#/'+route,route);await page.waitForTimeout(100);
   assert(await page.locator('#view').innerText(),route);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=375),route+' '+lang+' '+theme+' overflow');
   if(lang==='en'&&['privacy','programs','womens-health','admin'].includes(route))await page.screenshot({path:path.join(output,route+'-'+theme+'.png'),fullPage:true});
  }
 }
 await page.evaluate(()=>location.hash='#/programs');await page.getByRole('button',{name:'Start program'}).first().click();await page.waitForTimeout(100);assert(await page.locator('#view').innerText().then(s=>s.includes('Week')));
 await page.evaluate(()=>location.hash='#/me');await page.getByRole('button',{name:'Withdraw health consent'}).click();await page.waitForTimeout(100);assert(page.url().endsWith('#/consent'));
 await page.locator('#consent-terms').check();await page.locator('#consent-health').check();await page.getByRole('button',{name:'Confirm',exact:true}).click();await page.waitForTimeout(100);assert(page.url().endsWith('#/today'));
 assert.deepEqual(errors,[]);
 console.log('PASS Chromium: 15 routes x TH/EN x light/dark at 375px, no overflow or page errors; program picker and consent actions. Screenshots: '+output);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
