import pathlib,subprocess,json,time
root=pathlib.Path.cwd()
files=[]
for p in sorted((root/'tests').glob('*.mjs')):
 if any(x in p.name.lower() for x in ['browser','serve-','extract-i18n']):continue
 if 'playwright' in p.read_text(encoding='utf-8-sig').lower():continue
 files.append(p)
files += [root/'worker/test.mjs']+sorted((root/'worker').glob('round*.test.mjs'))
results=[]
for p in files:
 started=time.time()
 try:
  r=subprocess.run(['node','--import',(root/'tests/support/no-network.mjs').as_uri(),str(p)],cwd=p.parent if p.parent.name=='worker' else root,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=120)
  result=dict(file=str(p.relative_to(root)),code=r.returncode,seconds=round(time.time()-started,2),output=r.stdout+r.stderr)
 except subprocess.TimeoutExpired as e:result=dict(file=str(p.relative_to(root)),code=-1,seconds=120,output='Timeout')
 results.append(result)
 print(result['file'],result['code'],flush=True)
 (root/'docs/round11-screens/test-results.json').write_text(json.dumps(results,indent=2,ensure_ascii=False),encoding='utf-8')
