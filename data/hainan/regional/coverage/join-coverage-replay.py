"""Join the two public replay parts after checking every SHA-256; no network."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parent
manifest = json.loads((root / "coverage-audit-repack.json").read_text())
chunks = []
for item in manifest["parts"]:
    name = item["file"]
    if Path(name).name != name:
        raise SystemExit("Unexpected part path")
    data = (root / name).read_bytes()
    if len(data) != item["bytes"] or hashlib.sha256(data).hexdigest() != item["sha256"]:
        raise SystemExit(f"Checksum mismatch: {name}")
    chunks.append(data)
archive = b"".join(chunks)
if len(archive) != manifest["tar_xz_bytes"] or hashlib.sha256(archive).hexdigest() != manifest["tar_xz_sha256"]:
    raise SystemExit("Combined archive checksum mismatch")
target = root / "coverage-audit-repro.tar.xz"
if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() != manifest["tar_xz_sha256"]:
    raise SystemExit("A different output file already exists; move it before joining")
target.write_bytes(archive)
print("Verified coverage-audit-repro.tar.xz; extract with:")
print("python3 -m tarfile -e coverage-audit-repro.tar.xz replay")
