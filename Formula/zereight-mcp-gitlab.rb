class ZereightMcpGitlab < Formula
  desc "GitLab Model Context Protocol server for AI clients"
  homepage "https://github.com/zereight/gitlab-mcp"
  url "https://registry.npmjs.org/@zereight/mcp-gitlab/-/mcp-gitlab-2.1.67.tgz"
  sha256 "d6d4e44f6bc7e3344303f7d95c64d4b68b6acff082da4e3456201bccd464a4b5"
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
