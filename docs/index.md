# GitLab MCP Server

A comprehensive **Model Context Protocol** server for GitLab. Manage projects,
merge requests, issues, pipelines, wikis, releases, tags, milestones, and more
from any MCP-compatible AI client.

**Default: 40 tools** (38 `core` + `discover_tools` + `help`). 287 tools exist in total.
Start lean; call `discover_tools` to activate more. Machine-readable index:
[llms.txt](llms.txt) · [llms-full.txt](llms-full.txt).

[![npm](https://img.shields.io/npm/v/@zereight/mcp-gitlab.svg)](https://www.npmjs.com/package/@zereight/mcp-gitlab)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/zereight/gitlab-mcp/blob/main/LICENSE)

---

## Without → With

| Without this MCP                       | With this MCP                                                              |
| -------------------------------------- | -------------------------------------------------------------------------- |
| Paste MR URLs and diffs into chat      | `list_merge_request_changed_files` → batched `get_merge_request_file_diff` |
| Hunt job logs in the GitLab UI         | `get_pipeline_job_output` with pagination                                  |
| Re-explain the project path every turn | `project_id=group%2Fproject` and `merge_request_iid=123`                   |

## Three install paths

| Path        | When                                       | How                                                       |
| ----------- | ------------------------------------------ | --------------------------------------------------------- |
| Local IDE   | Cursor, Claude Code, Codex on your machine | stdio + PAT or local OAuth                                |
| Shared HTTP | Team or hosted MCP                         | Streamable HTTP URL such as `https://mcp.example.com/mcp` |
| Claude.ai   | Claude web connectors                      | Public HTTPS + `GITLAB_MCP_OAUTH`                         |

Skill + CLI is an equal path with no MCP registration: see
[CLI without MCP](getting-started/cli-without-mcp.md).

Use MCP in chat; use the CLI when you need the full payload (diffs, logs,
artifacts). Human CLI is never compacted.

---

## Why use this GitLab MCP?

- **Broad GitLab coverage** — projects, repository browsing, merge requests,
  issues, pipelines, wiki, releases, tags, labels, milestones, and more.
- **Flexible auth** — Personal Access Token, local OAuth2 browser flow, MCP
  OAuth proxy, and per-request remote authorization.
- **Multiple transports** — stdio for local clients, SSE for legacy clients,
  and Streamable HTTP for modern remote deployments.
- **Client-friendly setup** — examples for Claude Code, Codex, Antigravity,
  OpenCode, Copilot, Cline, Roo Code, Cursor, Kilo Code, and Amp Code.
- **Self-hosted ready** — works with custom GitLab instances, proxy settings,
  and dynamic API URL routing.

---

## Quick Start

Pick the auth method that fits your environment and drop it into your MCP
client config.

Install the server once:

```bash
brew tap zereight/gitlab-mcp https://github.com/zereight/gitlab-mcp
brew install zereight/gitlab-mcp/zereight-mcp-gitlab
```

Or with npm:

```bash
npm install -g @zereight/mcp-gitlab
```

Official MCP Registry listing: [`io.github.zereight/gitlab-mcp`](https://registry.modelcontextprotocol.io/?q=io.github.zereight%2Fgitlab-mcp). One-liner: `npx -y @zereight/mcp-gitlab@latest`.

The examples use `zereight-mcp-gitlab`, a less collision-prone alias for the legacy `mcp-gitlab` binary. If your MCP client cannot find it, use the absolute path from `which zereight-mcp-gitlab`.

No global install? Pin `npx` to the previous stable release (the version these docs recommend), for example `npx -y @zereight/mcp-gitlab@2.3.14`. If you always want the newest release, use `npx -y @zereight/mcp-gitlab@latest` instead. To try a fix merged to `main` before the next stable release, use `npx -y @zereight/mcp-gitlab@next`, a pre-release build that is not meant for production.

=== "Personal Access Token"

    ```json
    {
      "mcpServers": {
        "gitlab": {
          "command": "zereight-mcp-gitlab",
          "env": {
            "GITLAB_PERSONAL_ACCESS_TOKEN": "glpat-xxxxxxxxxxxxxxxxxxxx",
            "GITLAB_API_URL": "https://gitlab.com/api/v4"
          }
        }
      }
    }
    ```

=== "OAuth2 (local browser)"

    ```json
    {
      "mcpServers": {
        "gitlab": {
          "command": "zereight-mcp-gitlab",
          "env": {
            "GITLAB_USE_OAUTH": "true",
            "GITLAB_API_URL": "https://gitlab.com/api/v4"
          }
        }
      }
    }
    ```

=== "CLI arguments"

    ```json
    {
      "mcpServers": {
        "gitlab": {
          "command": "zereight-mcp-gitlab",
          "args": [
            "--token=glpat-xxxxxxxxxxxxxxxxxxxx",
            "--api-url=https://gitlab.com/api/v4"
          ]
        }
      }
    }
    ```

See [Getting Started](getting-started/index.md) for a full comparison of
authentication methods.

---

## Choose your client

<div class="grid cards" markdown>

- :material-robot-outline: **[Claude Code](clients/claude-code.md)**

  Anthropic's terminal coding agent.

- :material-microsoft-visual-studio-code: **[VS Code](clients/vscode.md)**

  MCP support via VS Code's built-in client.

- :material-github: **[GitHub Copilot](clients/copilot.md)**

  GitHub Copilot CLI with MCP integration.

- :material-code-tags: **[Cursor](clients/cursor.md)**

  The AI-first code editor.

- :material-application-brackets-outline: **[Codex](clients/codex.md)**

  OpenAI Codex CLI client.

- :material-code-json: **[JSON-Based Clients](clients/json-clients.md)**

  Factory AI Droid, OpenClaw, OpenCode, and other generic clients.

</div>

---

## Learn more

- **[Tools Reference](tools/index.md)** — complete catalog of every tool the
  MCP server exposes, grouped by category with read/write markers.
- **[Authentication](auth/oauth-setup.md)** — OAuth2 setup, callback proxy,
  and multi-PAT configurations for custom agents.
- **[Configuration](configuration/environment-variables.md)** — complete
  environment variable reference, dynamic API URLs, and stateless mode for
  multi-pod deployments.
- **[Features](features/resolve-issue-thread.md)** — feature-specific guides
  such as resolving issue threads.
- **[Reference](reference/setup-github-secrets.md)** — repository setup
  guides and design specs, including [OpenTelemetry MCP semantics](reference/opentelemetry-mcp.md)
  (docs-only; local stdio is not instrumented).

---

## Project links

- **Source code** — [github.com/zereight/gitlab-mcp](https://github.com/zereight/gitlab-mcp)
- **npm package** — [@zereight/mcp-gitlab](https://www.npmjs.com/package/@zereight/mcp-gitlab)
- **Changelog** — [CHANGELOG.md](https://github.com/zereight/gitlab-mcp/blob/main/CHANGELOG.md)
- **Issues** — [GitHub Issues](https://github.com/zereight/gitlab-mcp/issues)
