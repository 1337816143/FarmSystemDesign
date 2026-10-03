"""Normalize evidence text to its committed LF byte representation; rebuild exact digests."""
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[1]/'data/hainan/landcover-2025'
for path in root.glob('*.json'):
 path.write_bytes(path.read_text(encoding='utf8').replace('\r\n','\n').encode('utf8'))
path=root/'verification.json'
report=json.loads(path.read_text(encoding='utf8'))
report['hashes']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in root.iterdir() if p.is_file() and p.name!='verification.json'}
path.write_bytes((json.dumps(report,ensure_ascii=False,indent=2)+'\n').encode('utf8'))
print(json.dumps({'normalizedJsonFiles':len(list(root.glob('*.json'))),'hashes':report['hashes']},indent=2))
