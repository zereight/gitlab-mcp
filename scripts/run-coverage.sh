#!/usr/bin/env bash
# Runs the mock/unit suite (scripts/run-mock-tests.sh) under c8 and reports code
# coverage for the TypeScript sources (config: .c8rc.json). See CONTRIBUTING.md.
#
# Server-spawning suites start build/index.js as child processes; c8 collects
# their V8 coverage through NODE_V8_COVERAGE, which every descendant process
# inherits. Mapping that coverage back to *.ts needs source maps, which the
# published build does not ship. So this run swaps in a `--sourceMap` build and
# restores the regular `npm run build` output on exit (pass or fail), keeping
# *.map files out of build/ and therefore out of `npm pack`.
#
# Informational only: no coverage threshold. Test failures still fail the run.
set -euo pipefail

cd "$(dirname "$0")/.."

restore_build() {
  local rc=$?
  trap - EXIT
  echo "Restoring the regular build (no source maps)..." >&2
  if ! npm run --silent build >/dev/null; then
    echo "error: failed to restore build/; run 'npm run build' before packing." >&2
    [ "$rc" -ne 0 ] || rc=1
  fi
  exit "$rc"
}
trap restore_build EXIT

echo "Building with source maps for coverage..." >&2
node -e "require('fs').rmSync('build',{recursive:true,force:true})"
tsc -p tsconfig.build.json --sourceMap
node -e "require('fs').chmodSync('build/index.js', '755')"

# One c8 invocation: the report step reads the build/*.js.map files, so it must
# run before restore_build removes them.
c8 bash scripts/run-mock-tests.sh

tsx scripts/code-coverage-summary.ts coverage/coverage-summary.json
