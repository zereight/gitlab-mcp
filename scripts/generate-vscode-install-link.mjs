/**
 * Generate one-click install badges for VS Code and Cursor.
 *
 * GitHub drops non-http links, so the VS Code badge uses the https redirect.
 * That redirect opens vscode:mcp/install with the same server entry.
 * Cursor does not expand ${input:...}, so its badge reads the token from the environment.
 * Both VS Code URLs also carry the `gitlab-token` input, so VS Code prompts for the token.
 * The entry leaves GITLAB_PERMISSION_MODE unset, so the server default applies.
 * See docs/clients/vscode.md and docs/clients/cursor.md.
 */

const SERVER_NAME = "zereight.gitlab-mcp";

const VSCODE_INPUTS = [
  {
    type: "promptString",
    id: "gitlab-token",
    description: "GitLab Personal Access Token",
    password: true,
  },
];

function serverConfig(tokenPlaceholder) {
  return {
    type: "stdio",
    command: "npx",
    args: ["-y", "@zereight/mcp-gitlab@latest"],
    env: {
      GITLAB_PERSONAL_ACCESS_TOKEN: tokenPlaceholder,
      GITLAB_API_URL: "https://gitlab.com/api/v4",
    },
  };
}

const vscodeConfig = serverConfig("${input:gitlab-token}");
const cursorConfig = serverConfig("${env:GITLAB_PERSONAL_ACCESS_TOKEN}");

const httpsInstallUrl = `https://vscode.dev/redirect/mcp/install?name=${encodeURIComponent(SERVER_NAME)}&inputs=${encodeURIComponent(JSON.stringify(VSCODE_INPUTS))}&config=${encodeURIComponent(JSON.stringify(vscodeConfig))}`;

const rawInstallUrl = `vscode:mcp/install?${encodeURIComponent(
  JSON.stringify({ name: SERVER_NAME, ...vscodeConfig, inputs: VSCODE_INPUTS })
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
