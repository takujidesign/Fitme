import assert from 'node:assert/strict';
import {previewServer} from '../web/preview.mjs';
const server=previewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{const origin='http://127.0.0.1:'+server.address().port;
for(const path of ['/','/index.html','/#/onboarding','/en/','/features/workout-plan','/exercises/squat','/sw.js','/manifest.webmanifest','/icons/icon.svg'])assert.equal((await fetch(origin+path)).status,200,path);
for(const path of ['/missing-round19','/api/private','/admin','/outside.jpg'])assert.equal((await fetch(origin+path)).status,404,path);
const page=await fetch(origin+'/');assert(page.headers.get('Content-Security-Policy').includes("script-src 'self'"));assert((await page.text()).includes('application/ld+json'));
console.log('PASS local HTTP preview: public pages/assets/hash route 200; unknown/private paths 404; CSP. Cloudflare runtime remains a separate check.');
}finally{await new Promise(r=>server.close(r));}
