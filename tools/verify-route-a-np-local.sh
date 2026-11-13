#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Pure local invocations. No package manager, registry, browser, server or asset downloads.
python3 - <<'PY_CHECK'
import json,subprocess
for command in json.load(open('package.json'))['scripts']['check'].split(' && '):
    args=command.split()
    assert args[:2]==['node','--check'],args
    subprocess.run(args,check=True)
PY_CHECK
node --max-old-space-size=512 --test --test-concurrency=1 tests/*.test.mjs
node --test route-b/tests/*.test.mjs
node tools/check-route-a-np-offline.mjs
if [[ "${1:-}" == '--built-site' ]]; then
  [[ -n "${2:-}" ]] || { echo 'Pass an independently materialized complete site directory'; exit 2; }
  node tools/check-route-a-np-offline.mjs --site "$2"
fi
