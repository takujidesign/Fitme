// Optional real Chromium check: PLAYWRIGHT_PATH points to playwright/index.mjs.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
const {chromium}=await import(process.env.PLAYWRIGHT_PATH||'playwright');
const app=fileURLToPath(new URL('../app/',import.meta.url));
const server=createServer(async(req,res)=>{try{if(req.url==='/favicon.ico'){res.writeHead(204);return res.end();}const relative=decodeURIComponent(new URL(req.url,'http://local').pathname),file=path.resolve(app,'.'+relative+(relative.endsWith('/')?'index.html':''));if(!file.startsWith(app))throw Error();const body=await readFile(file);const ext=path.extname(file);res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[ext]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/`,artifacts=path.join(os.tmpdir(),'fitme-round3-browser');await mkdir(artifacts,{recursive:true});
let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const context=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:1});const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  // Fonts are optional online assets; route checks must also work without them.
  await page.route(/fonts\.(googleapis|gstatic)\.com/,route=>route.abort());
  await page.goto(base);await page.evaluate(async()=>{const {setState,todayISO}=await import('./js/store.js');setState(s=>{s.onboarded=true;s.profile.startDate=todayISO();s.profile.trainDays=[0,1,2,3,4,5,6];s.profile.name='Test';});location.hash='#/today';});
  await page.waitForSelector('.v-today');
  for(const lang of ['th','en'])for(const theme of ['dark','light']){
    await page.evaluate(async({lang,theme})=>{const {setState}=await import('./js/store.js');setState(s=>{s.lang=lang;s.theme=theme;});},{lang,theme});
    for(const route of ['today','workout','food','supps','me','pay','admin','coach','trainer','account','challenges','replan','onboarding?edit=1','player/'+new Date().toISOString().slice(0,10)]){
      await page.evaluate(route=>{location.hash='#/'+route;},route);await page.waitForTimeout(100);
      assert(await page.locator('#view').innerText(),route);
      assert(!await page.locator('#view').innerText().then(t=>t.includes('undefined')||t.includes('???')),route+' text');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=375),`${route} ${lang}/${theme} overflow`);
      if(lang==='en'&&['today','food','me','admin','workout'].includes(route))await page.screenshot({path:path.join(artifacts,`${route}-${theme}.png`),fullPage:true});
    }
    await page.evaluate(()=>location.hash='#/me');await page.waitForSelector('.v-me');
    for(const action of ['measurements','notifications','theme','share-card']){
      await page.locator(`[data-act="${action}"]`).click();await page.waitForTimeout(150);assert(await page.locator('.sheet').last().isVisible());
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=375),action+' overflow');
      if(action==='share-card'){await page.waitForFunction(()=>!document.querySelector('#share-send').disabled);assert.equal(await page.locator('#share-canvas').getAttribute('width'),'1080');await page.locator('#share-canvas').screenshot({path:path.join(artifacts,'share.png')});}
      await page.evaluate(()=>document.querySelectorAll('.sheet-wrap').forEach(e=>e.remove()));
    }
    await page.evaluate(()=>location.hash='#/food');await page.waitForSelector('.v-food');await page.locator('[data-act="food-prefs"]').click();await page.locator('[data-act="custom-foods"]').click();await page.locator('[data-act="custom-add"]').last().click();await page.waitForTimeout(300);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=375),'custom food overflow');
    if(lang==='en')await page.screenshot({path:path.join(artifacts,`custom-${theme}.png`),fullPage:true});
    await page.evaluate(()=>document.querySelectorAll('.sheet-wrap').forEach(e=>e.remove()));
  }
  await page.evaluate(()=>location.hash='#/today');await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForSelector('.v-today');
  await context.setOffline(true);await page.reload();await page.waitForSelector('.v-today');await page.evaluate(()=>location.hash='#/me');await page.waitForSelector('.v-me');
  const significant=errors.filter(e=>!e.includes('net::ERR_FAILED')&&!e.includes('net::ERR_INTERNET_DISCONNECTED')&&!e.includes('favicon'));
  assert.deepEqual(significant,[]);
  console.log('PASS Chromium 375px: 14 routes × TH/EN × dark/light; new sheets, canvas PNG, no overflow or JS errors; offline reload. Screenshots: '+artifacts);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
