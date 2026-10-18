// Copies ../app to ./dist, stamps the service-worker version with the git commit, then deploys.
// Usage (from the repo root or web/): node web/deploy.mjs
import { cpSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, 'dist');
rmSync(dist, { recursive: true, force: true });
cpSync(join(here, '..', 'app'), dist, { recursive: true });
const sha = execSync('git rev-parse --short=8 HEAD', { cwd: here }).toString().trim();
const sw = join(dist, 'sw.js');
writeFileSync(sw, readFileSync(sw, 'utf8').replace("const VERSION = 'fitme-v1';", `const VERSION = 'fitme-${sha}';`));
execSync('npx --prefix ../worker wrangler deploy', { cwd: here, stdio: 'inherit' });
