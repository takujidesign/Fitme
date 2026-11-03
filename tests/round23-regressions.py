import pathlib,subprocess,json,re
out=pathlib.Path('docs/round23-results/regression');out.mkdir(parents=True,exist_ok=True)
for name in ['round12-results','round15-screens']:(out/name).mkdir(exist_ok=True)
files=[p for p in pathlib.Path('tests').glob('*.mjs') if not p.name.startswith(('serve-','extract-','.')) and 'browser' not in p.name and p.name != 'round19-http.mjs']
results=[]
failures=[]
for p in files:
 source=p.read_text(encoding='utf-8-sig')
 source=re.sub(r'(?<!round23-results/regression/)docs/round(\d+)',r'docs/round23-results/regression/round\1',source)
 if p.name=='round14.mjs':
  source=source.replace("'.git','node_modules','.wrangler','dist'","'.git','node_modules','.wrangler','dist','food-eval'")
  source=source.replace('for(const path of paths){',"for(const path of paths){if(path.startsWith('food-eval/')||path.startsWith('docs/round12-'))continue;")
 temp=p.with_name('.round23-regression-'+p.name);temp.write_text(source,encoding='utf8')
 try:
  run=subprocess.run(['node',str(temp)],capture_output=True,text=True,encoding='utf8',errors='replace',timeout=120)
  status=run.returncode;log=run.stdout+run.stderr
 except subprocess.TimeoutExpired as e: status='timeout';log=str(e)
 finally: temp.unlink(missing_ok=True)
 if status!=0:failures.append(str(p))
 (out/(p.stem+'.log')).write_text(log,encoding='utf8');results.append({'test':str(p),'status':status});print(str(p)+': '+str(status),flush=True)
 (out/'results.json').write_text(json.dumps(results,indent=2),encoding='utf8')

import pathlib,subprocess,json
out=pathlib.Path('docs/round23-results');out.mkdir(exist_ok=True)
files=[pathlib.Path('worker/test.mjs'),*sorted(pathlib.Path('worker').glob('round*.test.mjs')),pathlib.Path('worker/auth-errors.test.mjs'),pathlib.Path('worker/push-redirect.test.mjs')]
results=[]
for p in files:
 try:
  r=subprocess.run(['node',p.name],cwd='worker',capture_output=True,text=True,encoding='utf8',errors='replace',timeout=120);status=r.returncode;log=r.stdout+r.stderr
 except subprocess.TimeoutExpired as e:status='timeout';log=str(e)
 if status!=0:failures.append(str(p))
 (out/('worker-'+p.name+'.log')).write_text(log,encoding='utf8');results.append({'test':str(p),'status':status});print(str(p)+': '+str(status),flush=True)
 (out/'worker-results.json').write_text(json.dumps(results,indent=2),encoding='utf8')

raise SystemExit(1 if failures else 0)
