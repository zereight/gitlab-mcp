class ZereightMcpGitlab < Formula
  desc "GitLab Model Context Protocol server for AI clients"
  homepage "https://github.com/zereight/gitlab-mcp"
  url "https://registry.npmjs.org/@zereight/mcp-gitlab/-/mcp-gitlab-2.1.49.tgz"
  sha256 "e5a79dbb4dd5243eac68802ada15ea3741e52598fa6540c49f6b35da5f9c41f4"
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
