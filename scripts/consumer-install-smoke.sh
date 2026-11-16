#!/usr/bin/env bash
set -euo pipefail

tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT

package_dir="$tmp_dir/package"
app_dir="$tmp_dir/app"
mkdir -p "$package_dir" "$app_dir"

tarball_name=$(npm pack --ignore-scripts --pack-destination "$package_dir" | tail -n 1)
tarball_path="$package_dir/$tarball_name"

# Scorecard treats `npm install` as unpinned. Build a consumer lockfile from
# the committed package-lock.json plus the packed tarball's sha512, then
# install with `npm ci` so hashes are verified.
node --input-type=module - "$tarball_path" "$app_dir" <<'EOF'
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const [tarballPath, appDir] = process.argv.slice(2);
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const repoLock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const resolved = `file:../package/${basename(tarballPath)}`;
const integrity = `sha512-${createHash("sha512").update(readFileSync(tarballPath)).digest("base64")}`;
const root = repoLock.packages[""] ?? {};

const packageJson = {
  name: "consumer-install-smoke",
  version: "1.0.0",
  private: true,
  dependencies: {
    [pkg.name]: resolved,
  },
};

const lock = {
  name: packageJson.name,
  version: packageJson.version,
  lockfileVersion: 3,
  requires: true,
  packages: {
    ...repoLock.packages,
    "": {
      name: packageJson.name,
      version: packageJson.version,
      dependencies: packageJson.dependencies,
    },
    [`node_modules/${pkg.name}`]: {
      version: pkg.version,
      resolved,
      integrity,
      license: root.license,
      dependencies: pkg.dependencies,
      bin: root.bin,
      engines: root.engines,
    },
  },
};

writeFileSync(`${appDir}/package.json`, `${JSON.stringify(packageJson, null, 2)}\n`);
writeFileSync(`${appDir}/package-lock.json`, `${JSON.stringify(lock, null, 2)}\n`);
EOF

cd "$app_dir"
npm ci --ignore-scripts --no-audit --no-fund >/dev/null

output_file="$tmp_dir/startup.log"
set +e
GITLAB_PERSONAL_ACCESS_TOKEN=smoke-test-token ./node_modules/.bin/zereight-mcp-gitlab >"$output_file" 2>&1 &
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
