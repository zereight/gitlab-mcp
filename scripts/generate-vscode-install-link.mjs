/**
 * Generate one-click install badges for VS Code and Cursor.
 *
 * GitHub drops non-http links, so the VS Code badge uses the https redirect.
 * That redirect opens vscode:mcp/install with the same server entry.
 * Cursor does not expand ${input:...}, so its badge reads the token from the environment.
 * Install URLs only embed the server entry (not the top-level `inputs` array).
 * See docs/clients/vscode.md and docs/clients/cursor.md.
 */

const SERVER_NAME = "zereight.gitlab-mcp";

function serverConfig(tokenPlaceholder) {
  return {
    type: "stdio",
    command: "npx",
    args: ["-y", "@zereight/mcp-gitlab@latest"],
    env: {
      GITLAB_PERSONAL_ACCESS_TOKEN: tokenPlaceholder,
      GITLAB_API_URL: "https://gitlab.com/api/v4",
      GITLAB_PERMISSION_MODE: "full",
    },
  };
}

const vscodeConfig = serverConfig("${input:gitlab-token}");
const cursorConfig = serverConfig("${env:GITLAB_PERSONAL_ACCESS_TOKEN}");

const httpsInstallUrl = `https://vscode.dev/redirect/mcp/install?name=${encodeURIComponent(SERVER_NAME)}&config=${encodeURIComponent(JSON.stringify(vscodeConfig))}`;

const rawInstallUrl = `vscode:mcp/install?${encodeURIComponent(
  JSON.stringify({ name: SERVER_NAME, ...vscodeConfig })
)}`;

const cursorConfigBase64 = Buffer.from(JSON.stringify(cursorConfig), "utf8").toString("base64");
const cursorInstallUrl = `https://cursor.com/en/install-mcp?name=${encodeURIComponent(SERVER_NAME)}&config=${encodeURIComponent(cursorConfigBase64)}`;

const vscodeBadge = `[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_GitLab_MCP-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](${httpsInstallUrl})`;
const cursorBadge = `[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](${cursorInstallUrl})`;

console.log(httpsInstallUrl);
console.log(rawInstallUrl);
console.log("");
console.log(vscodeBadge);
console.log(cursorInstallUrl);
console.log(cursorBadge);
