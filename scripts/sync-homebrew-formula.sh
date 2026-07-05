#!/usr/bin/env bash
set -euo pipefail

FORMULA_PATH="Formula/zereight-mcp-gitlab.rb"
VERSION=$(node -p "require('./package.json').version")
METADATA_URL="https://registry.npmjs.org/@zereight/mcp-gitlab/${VERSION}"

if ! METADATA=$(curl -fsSL "$METADATA_URL"); then
  echo "Error: failed to fetch npm metadata for @zereight/mcp-gitlab@${VERSION}."
  echo "Publish to npm first, then rerun this script."
  exit 1
fi

TARBALL_URL=$(node -e "const dist=JSON.parse(process.argv[1]).dist; if (!dist?.tarball || !dist?.shasum) process.exit(1); console.log(dist.tarball)" "$METADATA")
EXPECTED_SHASUM=$(node -e "console.log(JSON.parse(process.argv[1]).dist.shasum)" "$METADATA")

tmp_tarball=$(mktemp)
trap 'rm -f "$tmp_tarball"' EXIT

if ! curl -fsSL "$TARBALL_URL" -o "$tmp_tarball"; then
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
    assert_match "better-gitlab-mcp-server", output
  end
end
EOF

echo "Updated $FORMULA_PATH for @zereight/mcp-gitlab@${VERSION}"
