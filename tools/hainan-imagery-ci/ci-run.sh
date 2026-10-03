#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PYTHON=${PYTHON:-/usr/bin/python3}
WORKERS=${WORKERS:-2}
"$PYTHON" scripts/verify_kit.py --kit .
"$PYTHON" scripts/test_core.py --inputs inputs --output generated --work work
"$PYTHON" scripts/test_exact_warp.py --inputs inputs --output generated --work work
"$PYTHON" scripts/generate.py --inputs inputs --output generated --work work --workers "$WORKERS"
"$PYTHON" scripts/build_lod.py --inputs inputs --output generated --work work
"$PYTHON" scripts/verify.py --inputs inputs --output generated --work work
"$PYTHON" scripts/package_artifacts.py --input generated --output artifacts --max-zip-mib 20 --max-total-mib 220
