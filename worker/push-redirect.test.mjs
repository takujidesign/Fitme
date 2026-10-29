// Cloudflare Workers reject fetch(..., {redirect:'error'}) before sending; push, Kie, health OAuth and win-back must use 'manual'.
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
for(const f of readdirSync(new URL('./src/',import.meta.url)))if(f.endsWith('.js'))assert(!/redirect\s*:\s*['"]error['"]/.test(readFileSync(new URL('./src/'+f,import.meta.url),'utf8')),f+' uses redirect:error, unsupported in Workers');
console.log('PASS no redirect:error in worker sources');
