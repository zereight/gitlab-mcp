#!/usr/bin/env bash
# Pack build/ plus production dependencies into an MCP Bundle (.mcpb) for
# Claude Desktop one-click install. Run `npm run build` first.
set -euo pipefail

MCPB_CLI="@anthropic-ai/mcpb@2.1.2"

cd "$(dirname "$0")/.."
OUTPUT="${1:-gitlab-mcp.mcpb}"

if [ ! -f build/index.js ]; then
  echo "❌ build/index.js not found. Run: npm run build"
  exit 1
fi

stage_dir=$(mktemp -d)
trap 'rm -rf "$stage_dir"' EXIT

# Same layout as the npm package: build/server/version.js reads ../../package.json.
cp -R build package.json package-lock.json LICENSE "$stage_dir/"

# Stamp the package version so the bundle always matches the release it ships with.
node -e '
const fs = require("fs");
const [src, dest] = process.argv.slice(1);
const manifest = JSON.parse(fs.readFileSync(src, "utf8"));
manifest.version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
fs.writeFileSync(dest, `${JSON.stringify(manifest, null, 2)}\n`);
' manifest.json "$stage_dir/manifest.json"

(cd "$stage_dir" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null)

npx --yes "$MCPB_CLI" pack "$stage_dir" "$OUTPUT"
