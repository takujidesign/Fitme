import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../web/worker.js';
const seen=[],env={ASSETS:{fetch:req=>{seen.push(req.url);return new Response('page');}}};
const www=await worker.fetch(new Request('https://www.fixmee.app/exercises/squat?x=1'),env);
assert.equal(www.status,301);assert.equal(www.headers.get('Location'),'https://fixmee.app/exercises/squat?x=1');assert.equal(seen.length,0);
const apex=await worker.fetch(new Request('https://fixmee.app/exercises/squat'),env);
assert.equal(await apex.text(),'page');assert.deepEqual(seen,['https://fixmee.app/exercises/squat']);
const config=readFileSync(new URL('../web/wrangler.toml',import.meta.url),'utf8');
for(const pattern of ['"/"','"/exercises/*"','"/sitemap.xml"'])assert(config.includes(pattern),pattern);assert(!/run_worker_first\s*=\s*true/.test(config));
// Social images are named by content, so two deploys of the same page keep the same URL.
assert(!/'\/og\/'\+id\+'-'\+sha/.test(readFileSync(new URL('../scripts/build-seo.mjs',import.meta.url),'utf8')));
console.log('PASS web worker: www 301 keeps path and query, main domain served from assets, only pages run the worker, stable social image names');
