/**
 * Generate VS Code MCP one-click install badge/link.
 *
 * GitHub drops non-http links, so the badge uses the https redirect.
 * That redirect opens vscode:mcp/install with the same server entry.
 * Install URLs only embed the server entry (not the top-level `inputs` array).
 * Use ${input:gitlab-token} in env and add the matching `inputs` block in mcp.json
 * after install. See docs/clients/vscode.md.
 */

const SERVER_NAME = "zereight.gitlab-mcp";

const configWithoutName = {
  type: "stdio",
  command: "npx",
  args: ["-y", "@zereight/mcp-gitlab@latest"],
  env: {
    GITLAB_PERSONAL_ACCESS_TOKEN: "${input:gitlab-token}",
    GITLAB_API_URL: "https://gitlab.com/api/v4",
    GITLAB_PERMISSION_MODE: "full",
  },
};

const httpsInstallUrl = `https://insiders.vscode.dev/redirect/mcp/install?name=${encodeURIComponent(SERVER_NAME)}&config=${encodeURIComponent(JSON.stringify(configWithoutName))}`;

const rawInstallUrl = `vscode:mcp/install?${encodeURIComponent(
  JSON.stringify({ name: SERVER_NAME, ...configWithoutName }),
)}`;

const badge = `[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_GitLab_MCP-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](${httpsInstallUrl})`;

console.log(httpsInstallUrl);
console.log(rawInstallUrl);
console.log("");
console.log(badge);
