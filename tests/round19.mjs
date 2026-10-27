import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
import {resolve,join,extname} from 'node:path';
import {Window} from 'happy-dom';
const window=new Window({url:'https://fixmee.app/'});
for(const key of ['window','document','navigator','localStorage','sessionStorage','location'])Object.defineProperty(globalThis,key,{configurable:true,value:key==='window'?window:window[key]});
const {setState}=await import('../app/js/store.js'),{CONFIG}=await import('../app/js/config.js'),t=await import('../app/js/telemetry.js');CONFIG.API_BASE='https://mock.test';
let sent=[];globalThis.fetch=async(url,o)=>{sent.push(JSON.parse(o.body));return Response.json({ok:true});};
setState(s=>{s.profile.name='PRIVATE';s.account={token:'SECRET',user:{email:'private@example.com'}};s.lang='en';});
t.track('feature_used',{feature:'meal_logged'});t.track('screen_view',{route:'me'});t.track('screen_view',{route:'private@example.com'});t.captureError('PRIVATE email weight 75');await t.flushTelemetry();
assert.deepEqual(sent[0].events,[{kind:'event',name:'feature_used',dims:{feature:'meal_logged'}},{kind:'event',name:'screen_view',dims:{route:'me'}},{kind:'error',name:'error',dims:{}}]);assert(!/PRIVATE|SECRET|email|weight|userAgent/.test(JSON.stringify(sent)));
t.telemetryEnabled(false);const n=sent.length;t.track('app_open');t.captureError();await t.flushTelemetry();assert.equal(sent.length,n);assert.equal(localStorage.getItem('fitme:install-id'),null);
t.telemetryEnabled(true);t.screenView('me');t.screenView('me');await t.flushTelemetry();assert.equal(sent.at(-1).events.length,1);
let beacon;Object.defineProperty(navigator,'sendBeacon',{value:(url,body)=>{beacon={url,body};return true;},configurable:true});t.track('ai_used');await t.flushTelemetry(true);assert(beacon);assert.equal(sent.length,n+1);
const {chart,usageCSV}=await import('../app/js/charts.js');for(const theme of ['dark','light']){document.documentElement.dataset.theme=theme;document.body.innerHTML=chart('Test',[{label:'today',count:3}]);assert(document.querySelector('svg title'));document.querySelector('details').open=true;assert.equal(document.querySelector('td').textContent,'today');}
assert(usageCSV([{date:'2026-01-01',name:'app_open',dim:'',value:'',count:3}]).includes('"3"'));
const {usageView,usageExportRows}=await import('../app/js/views/admin-usage.js'),{loadLanguage}=await import('../app/js/i18n/index.js');
const fixture={days:7,end:'2026-10-27',daily:[{date:'2026-10-27',name:'app_open',dim:'',value:'',count:12},{date:'2026-10-27',name:'feature_used',dim:'feature',value:'meal_logged',count:7}],snapshots:[{date:'2026-10-27',dau:12,wau:25,mau:40,stickiness:30,newAccounts:4,ai:[{engine:'claude',calls:3,cost:.2}],push:{devices:8,successRate:90},retention:[{cohort:'2026-10-20',installs:10,d1:50,d7:30,d30:null,account_created:4}]}]};
mkdirSync('docs/round19-screens',{recursive:true});
for(const lang of ['th','en','zh','ja','vi']){await loadLanguage(lang);setState(s=>s.lang=lang);for(const theme of ['light','dark'])for(const panel of ['overview','usage','features','retention','devices']){const html=usageView(fixture,panel);document.body.innerHTML=html;assert(document.querySelector('[data-panel="'+panel+'"]'));assert(document.querySelector('#usage-range'));assert(document.querySelector('#usage-export'));assert(!/NaN|undefined|\?{3}/.test(html));if(lang==='th')writeFileSync('docs/round19-screens/'+theme+'-admin-'+panel+'.fixture.html',`<!doctype html><html lang="th" data-theme="${theme}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="../../app/css/app.css"><body style="max-width:375px;margin:auto"><p>DOM fixture — synthetic data, not a browser screenshot</p>${html}</body></html>`);}}
assert(usageExportRows(fixture,'overview').some(r=>r.value==='dau'&&r.count===12));assert(usageExportRows(fixture,'retention').some(r=>r.value==='installs'&&r.count===10));assert(!usageExportRows(fixture,'features').some(r=>r.name==='app_open'));
const modeScript=readFileSync('app/js/seo-mode.js','utf8');for(const [state,standalone,hash,expected] of [[{},false,'',false],[{onboarded:true},false,'',true],[{},true,'',true],[{},false,'#/account',true]]){document.documentElement.classList.remove('app-mode');vm.runInNewContext(modeScript,{document,location:{hash},navigator:{standalone},matchMedia:()=>({matches:false}),localStorage:{getItem:()=>JSON.stringify(state)}});assert.equal(document.documentElement.classList.contains('app-mode'),expected);}
const dist=resolve('web/dist'),pages=JSON.parse(readFileSync(join(dist,'seo-manifest.json'))),titles=new Set(),descriptions=new Set(),sitemap=readFileSync(join(dist,'sitemap.xml'),'utf8');
const pathFor=p=>join(dist,p==='/'?'index.html':p==='/404.html'?'404.html':p.replace(/^\//,'')+(p.endsWith('/')?'index.html':'.html'));
for(const p of pages){const html=readFileSync(pathFor(p.path),'utf8'),doc=new Window().document;doc.write(html);
 assert(!titles.has(p.title),'Duplicate title '+p.title);titles.add(p.title);assert(p.title.length<=60,p.title);
 assert(!descriptions.has(p.description),'Duplicate description '+p.description);descriptions.add(p.description);assert(p.description.length<=155,p.description);
 assert.equal(doc.querySelectorAll('h1').length,1,p.path);assert.equal(doc.documentElement.lang,p.lang);assert.equal(doc.querySelector('[rel=canonical]').href,'https://fixmee.app'+p.path);
 assert(existsSync(join(dist,p.image)));assert(doc.querySelector('[property="og:title"]'));assert(doc.querySelector('[name="twitter:card"]'));
 const ld=JSON.parse(doc.querySelector('[type="application/ld+json"]').textContent);assert.equal(ld['@context'],'https://schema.org');for(const entity of ld['@graph']){assert(entity['@type']);if(entity['@type']==='HowTo')assert(entity.step.length);if(entity['@type']==='FAQPage')assert(html.includes(entity.mainEntity[0].acceptedAnswer.text));}
 for(const [lang,path] of Object.entries(p.alternates)){const alt=pages.find(x=>x.path===path);assert(alt);assert.equal(alt.alternates[p.lang],p.path,'hreflang reciprocity');}
 for(const link of doc.querySelectorAll('a[href],img[src],script[src],link[rel=manifest]')){const href=link.getAttribute('href')||link.getAttribute('src');if(!href.startsWith('/'))continue;const pathname=href.split('#')[0].split('?')[0];assert(existsSync(join(dist,pathname))||existsSync(pathFor(pathname)),p.path+' broken '+href);}
 if(!p.noindex)assert(sitemap.includes('<loc>https://fixmee.app'+p.path+'</loc>'));else assert(!sitemap.includes(p.path));
}
assert(!/admin|account|#\//.test(sitemap));const robots=readFileSync(join(dist,'robots.txt'),'utf8');assert(robots.includes('Disallow: /api/'));assert(robots.includes('Sitemap: https://fixmee.app/sitemap.xml'));
const scan=dir=>{for(const f of readdirSync(dir,{withFileTypes:true})){const path=join(dir,f.name);if(f.isDirectory())scan(path);else if(['.html','.xml','.txt'].includes(extname(path)))assert(!/https?:[^\s"'`<>]*(?:repdb\.co|RepDB\/exercise-dataset)|"id"\s*:\s*"repdb[-:]/i.test(readFileSync(path,'utf8')),'Restricted source in '+path);}};scan(dist);
console.log('PASS Round 19 private payload snapshot/opt-out/beacon/session cap/charts/table/CSV; '+pages.length+' SEO pages: metadata, schema, links, sitemap, restricted-source scan');
