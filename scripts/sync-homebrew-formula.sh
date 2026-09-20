#!/usr/bin/env bash
set -euo pipefail

FORMULA_PATH="Formula/zereight-mcp-gitlab.rb"
VERSION=$(node -p "require('./package.json').version")
METADATA_URL="https://registry.npmjs.org/@zereight/mcp-gitlab/${VERSION}"

# A successful `npm publish` does not mean the registry can serve the version
# yet: npm's CDN keeps returning 404 for a few minutes afterwards. `needs: npm`
# in npm-publish.yml only guarantees the publish job finished, so poll until the
# version is actually resolvable instead of failing on the first 404.
WAIT_SECONDS="${HOMEBREW_SYNC_WAIT_SECONDS:-600}"
POLL_SECONDS="${HOMEBREW_SYNC_POLL_SECONDS:-15}"

tmp_metadata=$(mktemp)
tmp_tarball=$(mktemp)
trap 'rm -f "$tmp_metadata" "$tmp_tarball"' EXIT

deadline=$((SECONDS + WAIT_SECONDS))
while :; do
  # --max-time keeps a stalled connection from hanging the whole retry loop.
  http_status=$(curl -sS --connect-timeout 10 --max-time 30 -o "$tmp_metadata" -w '%{http_code}' "$METADATA_URL" 2>/dev/null) || http_status="000"

  if [ "$http_status" = "200" ]; then
    break
  fi

  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "Error: npm metadata for @zereight/mcp-gitlab@${VERSION} is still unavailable (HTTP ${http_status}) after ${WAIT_SECONDS}s."
    echo "Publish to npm first, or raise HOMEBREW_SYNC_WAIT_SECONDS to wait longer."
    exit 1
  fi

  echo "npm metadata for @zereight/mcp-gitlab@${VERSION} is not available yet (HTTP ${http_status}); retrying in ${POLL_SECONDS}s."
  sleep "$POLL_SECONDS"
done

METADATA=$(cat "$tmp_metadata")

TARBALL_URL=$(node -e "const dist=JSON.parse(process.argv[1]).dist; if (!dist?.tarball || !dist?.shasum) process.exit(1); console.log(dist.tarball)" "$METADATA")
EXPECTED_SHASUM=$(node -e "console.log(JSON.parse(process.argv[1]).dist.shasum)" "$METADATA")

if ! curl -fsSL --connect-timeout 10 --max-time 120 "$TARBALL_URL" -o "$tmp_tarball"; then
  echo "Error: failed to download npm tarball for @zereight/mcp-gitlab@${VERSION}."
  exit 1
fi

ACTUAL_SHASUM=$(shasum -a 1 "$tmp_tarball" | awk '{print $1}')
if [ "$ACTUAL_SHASUM" != "$EXPECTED_SHASUM" ]; then
  echo "Error: npm tarball shasum mismatch for @zereight/mcp-gitlab@${VERSION}."
  exit 1
fi

SHA256=$(shasum -a 256 "$tmp_tarball" | awk '{print $1}')

mkdir -p "$(dirname "$FORMULA_PATH")"

cat >"$FORMULA_PATH" <<EOF
class ZereightMcpGitlab < Formula
  desc "GitLab Model Context Protocol server for AI clients"
  homepage "https://github.com/zereight/gitlab-mcp"
  url "$TARBALL_URL"
  sha256 "$SHA256"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end

  test do
    ENV["GITLAB_PERSONAL_ACCESS_TOKEN"] = "homebrew-test-token"

    json = <<~JSON
      {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"homebrew","version":"#{version}"}}}
      {"jsonrpc":"2.0","method":"notifications/initialized","params":{}}
    JSON

    output = pipe_output(bin/"zereight-mcp-gitlab", json, 0)
    assert_match "zereight-gitlab-mcp-server", output
  end
end
EOF

echo "Updated $FORMULA_PATH for @zereight/mcp-gitlab@${VERSION}"
