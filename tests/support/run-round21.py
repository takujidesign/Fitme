"""Run executable suites individually (Node does not run every glob argument).
Preserve older tracked documentation artifacts, including pre-existing edits.
"""
from pathlib import Path
import subprocess, json, os, sys
root=Path(__file__).resolve().parents[2]
os.chdir(root)
out=root/'docs/round21-results'
out.mkdir(exist_ok=True)
tracked=subprocess.check_output(['git','ls-files','docs'],text=True).splitlines()
backup={Path(p):Path(p).read_bytes() for p in tracked if Path(p).is_file() and 'round21' not in p}
files=sorted(p for p in Path('tests').glob('*.mjs') if not p.name.startswith('serve-') and p.name!='extract-i18n.mjs')
files += [Path('worker/test.mjs')]+sorted(Path('worker').glob('round*.test.mjs'))+[Path('worker/auth-errors.test.mjs'),Path('worker/push-redirect.test.mjs')]
if '--unit' in sys.argv:files=[p for p in files if 'browser' not in p.name]
results=[]
try:
 for p in files:
  try:
   run=subprocess.run(['node','--import',(root/'tests/support/no-network.mjs').as_uri(),str(p.resolve())],cwd=root/'worker' if p.parts[0]=='worker' else root,capture_output=True,text=True,encoding='utf8',errors='replace',timeout=90)
   item={'file':str(p),'code':run.returncode,'output':run.stdout+run.stderr}
  except subprocess.TimeoutExpired as error:
   item={'file':str(p),'code':'timeout','output':str(error)}
  results.append(item)
  print(str(p),item['code'],flush=True)
  (out/('final-unit-tests.json' if '--unit' in sys.argv else 'all-tests.json')).write_text(json.dumps(results,indent=2),encoding='utf8')
finally:
 for p,data in backup.items():p.write_bytes(data)
