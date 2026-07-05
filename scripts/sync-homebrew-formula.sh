#!/usr/bin/env bash
set -euo pipefail

FORMULA_PATH="Formula/zereight-mcp-gitlab.rb"
VERSION=$(node -p "require('./package.json').version")
TARBALL_URL="https://registry.npmjs.org/@zereight/mcp-gitlab/-/mcp-gitlab-${VERSION}.tgz"

if ! SHA256=$(curl -fsSL "$TARBALL_URL" | shasum -a 256 | awk '{print $1}'); then
  echo "Error: failed to download npm tarball for @zereight/mcp-gitlab@${VERSION}."
  echo "Publish to npm first, then rerun this script."
  exit 1
fi

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
