# VS Code Setup Guide

This guide explains how to configure `@zereight/mcp-gitlab` in VS Code using `mcp.json`.

## One-click install

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_GitLab_MCP-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](vscode:mcp/install?%7B%22name%22%3A%22zereight.gitlab-mcp%22%2C%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40zereight%2Fmcp-gitlab%40latest%22%5D%2C%22env%22%3A%7B%22GITLAB_PERSONAL_ACCESS_TOKEN%22%3A%22%24%7Binput%3Agitlab-token%7D%22%2C%22GITLAB_API_URL%22%3A%22https%3A%2F%2Fgitlab.com%2Fapi%2Fv4%22%2C%22GITLAB_PERMISSION_MODE%22%3A%22full%22%7D%7D)

Click the badge to add the server via `npx`. The install URL embeds the **server entry**
only (VS Code limitation). It pre-fills:

| Variable | Value |
|----------|-------|
| `GITLAB_PERSONAL_ACCESS_TOKEN` | `${input:gitlab-token}` |
| `GITLAB_API_URL` | `https://gitlab.com/api/v4` |
| `GITLAB_PERMISSION_MODE` | `full` |

### After one-click install — add `inputs`

The token prompt needs a top-level `inputs` block in the same `mcp.json`. Merge this
**alongside** the `servers` object VS Code created:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "gitlab-token",
      "description": "GitLab Personal Access Token",
      "password": true
    }
  ],
  "servers": {
    "zereight.gitlab-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@zereight/mcp-gitlab@latest"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "${input:gitlab-token}",
        "GITLAB_API_URL": "https://gitlab.com/api/v4",
        "GITLAB_PERMISSION_MODE": "full"
      }
    }
  }
}
```

Run **MCP: Open User Configuration** (or workspace `.vscode/mcp.json`), paste/adjust, save,
then restart the server. VS Code prompts for the PAT on first start and stores it securely.

Self-hosted GitLab: change `GITLAB_API_URL` to `https://your-host.example.com/api/v4`.

Read-only: set `GITLAB_PERMISSION_MODE` to `readonly` (or `modify` to block delete tools).

Regenerate the badge URL: `node scripts/generate-vscode-install-link.mjs`

The same server is available as `@zereight/gitlab-mcp`.

## Where to put the config

VS Code supports two MCP configuration locations:

- Workspace: `.vscode/mcp.json`
- User profile: open the user `mcp.json` from the Command Palette

Use workspace config when you want to share the MCP server with your team.

Install the server once:

```bash
brew tap zereight/gitlab-mcp https://github.com/zereight/gitlab-mcp
brew install zereight/gitlab-mcp/zereight-mcp-gitlab
```

Or with npm:

```bash
npm install -g @zereight/mcp-gitlab
# or
npm install -g @zereight/gitlab-mcp
```

If VS Code cannot find `zereight-mcp-gitlab`, use the absolute path from `which zereight-mcp-gitlab`.

## PAT setup

A secure workspace example using input prompts:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "gitlab-token",
      "description": "GitLab Personal Access Token",
      "password": true
    }
  ],
  "servers": {
    "gitlab": {
      "type": "stdio",
      "command": "zereight-mcp-gitlab",
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "${input:gitlab-token}",
        "GITLAB_API_URL": "https://gitlab.com/api/v4",
        "GITLAB_PERMISSION_MODE": "full"
      }
    }
  }
}
```

## OAuth setup

A local OAuth example:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "gitlab-oauth-client-id",
      "description": "GitLab OAuth Client ID"
    }
  ],
  "servers": {
    "gitlab": {
      "type": "stdio",
      "command": "zereight-mcp-gitlab",
      "env": {
        "GITLAB_USE_OAUTH": "true",
        "GITLAB_OAUTH_CLIENT_ID": "${input:gitlab-oauth-client-id}",
        "GITLAB_OAUTH_REDIRECT_URI": "http://127.0.0.1:8888/callback",
        "GITLAB_API_URL": "https://gitlab.com/api/v4"
      }
    }
  }
}
```

If your GitLab OAuth app is confidential, add `GITLAB_OAUTH_CLIENT_SECRET` too.

## What `${input:...}` means

VS Code resolves `${input:name}` by looking up an entry in the top-level `inputs` array.

Example:

- `"GITLAB_PERSONAL_ACCESS_TOKEN": "${input:gitlab-token}"`

means:

- find the input whose `id` is `gitlab-token`
- prompt the user for a value
- inject that value into the environment variable

If the `inputs` entry is missing or the `id` does not match exactly, the value will not resolve correctly.

## Starting and troubleshooting the server

When VS Code loads the server, you may need to trust it before it starts.

Useful actions:

- `MCP: List Servers`
- `MCP: Open Workspace Folder Configuration`
- `MCP: Open User Configuration`
- `MCP: Reset Trust`

To inspect logs:

- open Chat
- select the MCP error notification if present
- choose **Show Output**

## Common mistakes

### 1. Missing `/api/v4`

Use:

- `https://gitlab.com/api/v4`

not:

- `https://gitlab.com`

### 2. Input variable without `inputs` definition

If you use `${input:gitlab-token}`, you must also define an input with `id: "gitlab-token"`.

### 3. Wrong top-level key

In VS Code `mcp.json`, the top-level key is:

- `servers`

not `mcpServers`.

### 4. OAuth redirect mismatch

The redirect URI in GitLab must exactly match the URI in your MCP config.

### 5. Hardcoding secrets in source control

Prefer input variables or environment files over committing secrets in `.vscode/mcp.json`.

## See also

- [OAuth2 Authentication Setup Guide](../auth/oauth-setup.md)
- [GitHub Copilot Setup Guide](copilot.md)
- [Claude Code Setup Guide](claude-code.md)
