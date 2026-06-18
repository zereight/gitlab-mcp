#!/usr/bin/env bash
set -euo pipefail

tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT

package_dir="$tmp_dir/package"
app_dir="$tmp_dir/app"
mkdir -p "$package_dir" "$app_dir"

tarball_name=$(npm pack --ignore-scripts --pack-destination "$package_dir" | tail -n 1)
tarball_path="$package_dir/$tarball_name"

cd "$app_dir"
npm init -y >/dev/null
npm install "$tarball_path" --ignore-scripts --no-audit --no-fund >/dev/null

output_file="$tmp_dir/startup.log"
set +e
GITLAB_PERSONAL_ACCESS_TOKEN=smoke-test-token node node_modules/@zereight/mcp-gitlab/build/index.js >"$output_file" 2>&1 &
pid=$!

for _ in 1 2 3 4 5; do
  if ! kill -0 "$pid" 2>/dev/null; then
    wait "$pid"
    status=$?
    break
  fi
  sleep 1
done

if kill -0 "$pid" 2>/dev/null; then
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  status=0
fi
set -e

output=$(cat "$output_file")
if echo "$output" | grep -Eq "SyntaxError|ERR_MODULE_NOT_FOUND|ERR_PACKAGE_PATH_NOT_EXPORTED|Cannot find package|does not provide an export named"; then
  echo "$output"
  exit 1
fi

if [ "${status:-0}" -ne 0 ]; then
  echo "$output"
  exit "$status"
fi

echo "Consumer install smoke passed."
