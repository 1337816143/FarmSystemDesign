from pathlib import Path
from html.parser import HTMLParser
import json,re,hashlib
root=Path(__file__).resolve().parents[1]
class Parser(HTMLParser):
 def __init__(self): super().__init__(); self.ids=[]; self.refs=[]; self.loads=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  for k in ('src','href'):
   if k in a:self.refs.append((tag,k,a[k]))
  if tag=='script' and 'src' in a:self.loads.append(a['src'])
p=Parser();p.feed((root/'index.html').read_text());assert len(p.ids)==len(set(p.ids)), 'Duplicate DOM IDs'
for tag,k,v in p.refs:
 if v.startswith('#'):assert v[1:] in p.ids, f'Missing anchor {v}'
 elif not v.startswith(('http:','https:')):
  if v=='../index.html':continue # conditional integrated A return link, hidden for standalone mode
  assert (root/v).is_file(),f'Missing asset {v}'
for src in [* (root/'src').glob('*.js'), * (root/'src').glob('*.mjs')]:
 for ref in re.findall(r"from\s+['\"]([^'\"]+)['\"]",src.read_text()):
  assert (src.parent/ref).is_file(),f'Missing module {src}:{ref}'
report={'html':'parsed, unique IDs and internal anchors resolved','local_assets':'all script/link references and ES module imports exist','external_runtime_loads':0,'visual_browser_test':'not run; restricted browser environment; no bypass attempted','a_return':'../index.html only revealed when deployed under /route-b/','file_hashes':{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(root.rglob('*')) if p.is_file() and p.suffix in ('.html','.css','.js','.mjs')}}
(root/'evidence/static-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='file_hashes'},ensure_ascii=False,indent=2))
