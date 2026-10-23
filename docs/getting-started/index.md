# Getting Started

This page helps you pick the right **authentication method** and the right
**transport** for your environment. The default tool list is **40 tools**
(38 `core` + `discover_tools` + `help`); call `discover_tools` to expand. Skill + CLI
is an equal path with no MCP registration — see [CLI without MCP](cli-without-mcp.md).

## 1. Pick an authentication method

The server supports four ways to authenticate against GitLab.

| Method                     | When to use it                                                     | Config                                                                |
| -------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| **Personal Access Token**  | Simplest setup for local/desktop use.                              | `GITLAB_PERSONAL_ACCESS_TOKEN` or `GITLAB_PERSONAL_ACCESS_TOKEN_FILE` |
| **OAuth2 — Local Browser** | Better security for local clients (Claude Desktop, VS Code).       | `GITLAB_USE_OAUTH=true`                                               |
| **OAuth2 — MCP Proxy**     | Remote MCP clients such as Claude.ai.                              | `GITLAB_MCP_OAUTH=true`                                               |
| **Remote Authorization**   | Multi-user deployments where each caller provides their own token. | `REMOTE_AUTHORIZATION=true`                                           |

For local stdio use, set any one credential: a Personal Access Token, `GITLAB_USE_OAUTH=true`, a GitLab CI job token ([`GITLAB_JOB_TOKEN`](../configuration/environment-variables.md#gitlab_job_token)), or a cookie file ([`GITLAB_AUTH_COOKIE_PATH`](../configuration/environment-variables.md#gitlab_auth_cookie_path)). None of them is required on its own.

### Decision flow

!!! tip "Which one should I use?"

    - **Local desktop, single user** → Personal Access Token or OAuth Local.
    - **Remote single tenant (e.g., Claude.ai)** → OAuth MCP Proxy.
    - **Remote multi-tenant (each user has their own GitLab token)** → Remote Authorization.
    - **Docker / containers** → Personal Access Token, or `GITLAB_PERSONAL_ACCESS_TOKEN_FILE` when the token is mounted as a file (OAuth needs a browser).

Full guides:

- [OAuth2 Setup](../auth/oauth-setup.md) — local browser flow & app registration.
- [OAuth Callback Proxy](../auth/oauth-callback-proxy.md) — proxy pattern for remote clients.
- [Custom Agents & Multiple PAT](../auth/custom-agent-multiple-pat.md) — multiple tokens per agent.

## 2. Pick a transport

| Transport           | When to use it                                                                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **stdio**           | Local MCP clients (Claude Code, VS Code, Cursor, etc.). The default. OpenTelemetry is not enabled on this path; see [OpenTelemetry MCP](../reference/opentelemetry-mcp.md). |
| **SSE**             | Legacy MCP clients that only speak Server-Sent Events.                                                                                                                      |
| **Streamable HTTP** | Modern remote deployments (recommended for hosted servers).                                                                                                                 |

## 3. Connect your client

Jump to the guide for your client:

- [Claude Code](../clients/claude-code.md)
- [VS Code](../clients/vscode.md)
- [GitHub Copilot](../clients/copilot.md)
- [Cursor](../clients/cursor.md)
- [Codex](../clients/codex.md)
- [JSON-Based Clients](../clients/json-clients.md) — Factory AI Droid, OpenClaw, OpenCode, etc.

## 4. Configure feature toggles (optional)

Wiki, milestones, and pipeline tools are opt-in to keep the tool list small
for clients with strict tool limits. Enable what you need with environment
variables or CLI flags — see [Environment Variables](../configuration/environment-variables.md).

If you can't use environment variables (some clients have issues with them),
use [CLI Arguments](cli-arguments.md) instead.
