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

# A zero poll interval would hammer the registry until the deadline. WAIT_SECONDS=0
# stays valid and means "make one attempt, then fail".
if ! [[ "$WAIT_SECONDS" =~ ^[0-9]+$ ]]; then
  echo "Error: HOMEBREW_SYNC_WAIT_SECONDS must be a non-negative integer, got '${WAIT_SECONDS}'."
  exit 1
fi
if ! [[ "$POLL_SECONDS" =~ ^[1-9][0-9]*$ ]]; then
  echo "Error: HOMEBREW_SYNC_POLL_SECONDS must be a positive integer, got '${POLL_SECONDS}'."
  exit 1
fi

tmp_metadata=$(mktemp)
tmp_tarball=$(mktemp)
trap 'rm -f "$tmp_metadata" "$tmp_tarball"' EXIT

http_status=""
fail_unavailable() {
  echo "Error: npm metadata for @zereight/mcp-gitlab@${VERSION} is still unavailable (HTTP ${http_status:-no response}) after ${WAIT_SECONDS}s."
  echo "Publish to npm first, or raise HOMEBREW_SYNC_WAIT_SECONDS to wait longer."
  exit 1
}

# WAIT_SECONDS is a hard budget: the request timeout and every sleep are capped at
# the time remaining, so a slow or stalled attempt cannot run past the deadline.
deadline=$((SECONDS + WAIT_SECONDS))
attempt=0
while :; do
  attempt=$((attempt + 1))
  remaining=$((deadline - SECONDS))

  # Always make one attempt; after that, stop as soon as the budget is spent.
  if [ "$attempt" -gt 1 ] && [ "$remaining" -le 0 ]; then
    fail_unavailable
  fi

  request_timeout=$((remaining < 30 ? remaining : 30))
  if [ "$request_timeout" -lt 1 ]; then
    request_timeout=1
  fi

  http_status=$(curl -sS --connect-timeout 10 --max-time "$request_timeout" -o "$tmp_metadata" -w '%{http_code}' "$METADATA_URL" 2>/dev/null) || http_status="000"

  if [ "$http_status" = "200" ]; then
    break
  fi

  remaining=$((deadline - SECONDS))
  if [ "$remaining" -le 0 ]; then
    fail_unavailable
  fi

  sleep_for=$((remaining < POLL_SECONDS ? remaining : POLL_SECONDS))
  echo "npm metadata for @zereight/mcp-gitlab@${VERSION} is not available yet (HTTP ${http_status}); retrying in ${sleep_for}s."
  sleep "$sleep_for"
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
