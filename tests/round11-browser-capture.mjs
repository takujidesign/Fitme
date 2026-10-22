import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';
const app=path.resolve(import.meta.dirname,'../app'),out=path.resolve(import.meta.dirname,'../docs/round11-screens');
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);if(pathname==='/favicon.ico'){res.writeHead(204);return res.end();}const file=path.resolve(app,'.'+pathname+(pathname.endsWith('/')?'index.html':''));if(!file.startsWith(app+path.sep))throw Error('outside app');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await mkdir(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
 const context=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:1,serviceWorkers:'block'});
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1')return route.continue();let body={items:[],messages:[],config:{},videos:[],products:[],ideas:[],supporter:null,profile:null,secrets:{},counts:{profiles:3,checkins:4,messages:12,reports:0,gyms:2}};return route.fulfill({status:200,contentType:u.hostname.includes('fonts')?'text/css':'application/json',body:u.hostname.includes('fonts')?'':JSON.stringify(body)});});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.evaluate(async()=>{const {setState,todayISO}=await import('./js/store.js'),{POLICY_VERSION}=await import('./js/legal.js');setState(s=>{s.onboarded=true;s.telemetry=false;s.lang='en';s.guidance.tourDone=true;s.consents={terms:'local',health:'local',version:POLICY_VERSION};s.profile.startDate=todayISO();s.account={token:'a'.repeat(64),user:{id:'00000000-0000-4000-8000-000000000001',email:'local@example.test'}};});const {setAdminSession}=await import('./js/admin-session.js');setAdminSession('b'.repeat(64),true);});
 for(const theme of ['dark','light'])for(const route of ['me','profile','friends','messages','checkin','help','admin?section=dashboard','admin?section=setup','tour']){
  await page.evaluate(async({theme,route})=>{const {setState}=await import('./js/store.js');setState(s=>s.theme=theme);location.hash='#/'+(route==='tour'?'today':route);const {rerender,actions}=await import('./js/core.js');rerender();if(route==='tour')actions['guided-tour']();},{theme,route});await page.waitForTimeout(400);
  await page.screenshot({path:path.join(out,theme+'-'+route.replace(/[^a-z]/g,'-')+'.png'),fullPage:true});
  await page.evaluate(()=>document.querySelector('.tour-wrap')?.remove());
 }
 await page.evaluate(async()=>{const {EXERCISES}=await import('./js/exercises.js'),{interpolatePose,renderPose,figureDefs,figureViewBox}=await import('./js/figure.js');document.body.innerHTML='<main id="poses"></main>';document.head.querySelectorAll('link').forEach(n=>n.remove());document.body.style='margin:0;background:white;color:black;font-family:Arial';const host=document.getElementById('poses');host.style='display:grid;grid-template-columns:repeat(4,450px);width:1800px';host.innerHTML=EXERCISES.map(ex=>`<section style="height:220px;border:1px solid #ddd"><h3 style="margin:8px">${ex.id}</h3><div style="display:flex">${[0,.5,1].map((t,i)=>`<svg width="145" height="175" viewBox="${figureViewBox(ex)}" style="--muscle-primary:#d63636;--muscle-secondary:#ef8065">${figureDefs(ex.id+i)}${renderPose(interpolatePose(ex.frames[0],ex.frames[1]||ex.frames[0],t,ex),ex,ex.id+i)}</svg>`).join('')}</div></section>`).join('');});
 await page.setViewportSize({width:1800,height:2200});await page.screenshot({path:path.join(out,'poses.png'),fullPage:true});
 await writeFile(path.join(out,'browser-results.json'),JSON.stringify({errors},null,2));if(errors.length)throw Error(errors.join('\n'));
}catch(e){await writeFile(path.join(out,'browser-block.txt'),String(e.stack));console.error(String(e));process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.close(r));}
