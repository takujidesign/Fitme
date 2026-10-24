import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {chromium} from 'playwright-core';
const app=path.resolve('app'),out=path.resolve('docs/round15-screens');
let baseline=false;
const previous=process.env.ROUND15_BASELINE?await readFile(process.env.ROUND15_BASELINE,'utf8'):execFileSync('git',['show','HEAD:app/js/views/library.js'],{encoding:'utf8'});
const server=createServer(async(req,res)=>{try{
 const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
 if(pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
 const file=path.resolve(app,'.'+pathname+(pathname.endsWith('/')?'index.html':''));if(!file.startsWith(app+path.sep))throw Error('outside app');
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');
 res.end(baseline&&pathname==='/js/views/library.js'?previous:await readFile(file));
}catch{res.writeHead(404);res.end();}});
await mkdir(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let context,profile,browser;const errors=[],results={viewport:375};
try{
 profile=await mkdtemp(path.join(os.tmpdir(),'fitme-round15-browser-'));
 if(process.env.ROUND15_CDP){browser=await chromium.connectOverCDP(process.env.ROUND15_CDP);context=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:1,serviceWorkers:'block'});}else context=await chromium.launchPersistentContext(profile,{headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',viewport:{width:375,height:812},deviceScaleFactor:1,serviceWorkers:'block',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1'||u.hostname==='cdn.jsdelivr.net')return route.continue();return route.fulfill({status:200,contentType:u.hostname.includes('fonts')?'text/css':'application/json',body:u.hostname.includes('fonts')?'':JSON.stringify({items:[],config:{},videos:[],products:[],announcements:[]})});});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 for(const before of [true,false]){
  baseline=before;await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(async()=>{const {setState,todayISO}=await import('./js/store.js'),{POLICY_VERSION}=await import('./js/legal.js');setState(s=>{s.onboarded=true;s.telemetry=false;s.lang='en';s.guidance.tourDone=true;s.consents={terms:'local',health:'local',version:POLICY_VERSION};s.profile.startDate=todayISO();});window.libraryStart=performance.now();window.firstLibrary=0;const o=new MutationObserver(()=>{if(document.querySelector('.ex-card')){window.firstLibrary=performance.now()-window.libraryStart;o.disconnect();}});o.observe(document.body,{childList:true,subtree:true});location.hash='#/library';});
  await page.waitForFunction(()=>document.querySelector('#library-count')?.textContent.match(/\/ 1\d\d\d/),null,{timeout:45000});
  results[before?'before':'after']=await page.evaluate(()=>({firstRenderMs:window.firstLibrary,loadedMs:performance.now()-window.libraryStart,nodes:document.querySelectorAll('*').length,images:document.querySelectorAll('img').length,cards:document.querySelectorAll('.ex-card').length,count:document.querySelector('#library-count').textContent}));
 }
 const ids=await page.evaluate(async()=>Object.keys((await import('./js/exercises.js')).EX));
 for(const theme of ['dark','light']){
  await page.evaluate(async theme=>{const {setState}=await import('./js/store.js');setState(s=>s.theme=theme);},theme);
  for(const id of theme==='dark'?ids:['bench_press','squat','pushup','deadlift','plank','lateral_raise','lunge','jumping_jack']){
   await page.evaluate(async id=>{window.qaPlayer?.stop();const {EX}=await import('./js/exercises.js');const {sheet}=await import('./js/ui.js');sheet(`<h2>${EX[id].name.en}</h2><div id="qa-three"></div>`);window.qaPlayer=await(await import('./js/three-viewer.js')).mount3D(document.querySelector('#qa-three'),EX[id]);window.qaPlayer.seek(.4);},id);
   await page.waitForTimeout(100);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=375));
   await page.screenshot({path:path.join(out,`${theme}-${id}.png`),fullPage:false});
  }
 }
 results.errors=errors;results.profilesRemoved=true;await writeFile(path.join(out,'browser-results.json'),JSON.stringify(results,null,2));
 await writeFile(path.join(out,'contact-sheet.html'),`<!doctype html><meta charset="utf-8"><title>Round 15 · all 40 · mid rep</title><style>body{background:#111;color:white;font:14px sans-serif}main{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}img{width:100%}figure{margin:0}</style><h1>All 40 · 3/4 camera · phase 0.4</h1><main>${ids.map(id=>`<figure><img src="dark-${id}.png"><figcaption>${id}</figcaption></figure>`).join('')}</main>`);
 assert.deepEqual(errors,[]);console.log(JSON.stringify(results));
}catch(error){await writeFile(path.join(out,'browser-block.txt'),String(error.stack));console.error(error);process.exitCode=1;}
finally{await context?.close();if(browser){const cdp=await browser.newBrowserCDPSession();await cdp.send('Browser.close').catch(()=>{});await browser.close();}await new Promise(r=>server.close(r));if(profile){const resolved=path.resolve(profile);assert(path.dirname(resolved)===path.resolve(os.tmpdir())&&path.basename(resolved).startsWith('fitme-round15-browser-'));await rm(resolved,{recursive:true,force:true});}}
