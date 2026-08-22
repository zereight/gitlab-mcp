/**
 * Generate VS Code MCP one-click install badge/link.
 *
 * Install URLs only embed the server entry (not the top-level `inputs` array).
 * Use ${input:gitlab-token} in env and add the matching `inputs` block in mcp.json
 * after install — see docs/clients/vscode.md.
 */

const serverConfig = {
  name: "zereight.gitlab-mcp",
  type: "stdio",
  command: "npx",
  args: ["-y", "@zereight/mcp-gitlab@latest"],
  env: {
    GITLAB_PERSONAL_ACCESS_TOKEN: "${input:gitlab-token}",
    GITLAB_API_URL: "https://gitlab.com/api/v4",
    GITLAB_PERMISSION_MODE: "full",
  },
};

const installUrl = `vscode:mcp/install?${encodeURIComponent(JSON.stringify(serverConfig))}`;

const badge = `[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_GitLab_MCP-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](${installUrl})`;

console.log(installUrl);
console.log("");
console.log(badge);
