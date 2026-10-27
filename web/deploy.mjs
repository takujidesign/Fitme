// Build is independently reviewable; deployment remains an explicit workflow step.
import {buildSEO} from '../scripts/build-seo.mjs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
await buildSEO();
if(!process.argv.includes('--build-only'))execFileSync('npx',['--prefix','../worker','wrangler','deploy'],{cwd:fileURLToPath(new URL('.',import.meta.url)),stdio:'inherit',shell:process.platform==='win32'});
