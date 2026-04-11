# VS Code Setup Guide

This guide explains how to configure `@zereight/mcp-gitlab` in VS Code using `mcp.json`.

## Where to put the config

VS Code supports two MCP configuration locations:

- Workspace: `.vscode/mcp.json`
- User profile: open the user `mcp.json` from the Command Palette

Use workspace config when you want to share the MCP server with your team.

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
      "command": "npx",
      "args": ["-y", "@zereight/mcp-gitlab"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "${input:gitlab-token}",
        "GITLAB_API_URL": "https://gitlab.com/api/v4",
        "GITLAB_READ_ONLY_MODE": "false"
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
      "command": "npx",
      "args": ["-y", "@zereight/mcp-gitlab"],
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

- [OAuth2 Authentication Setup Guide](./oauth-setup.md)
- [GitHub Copilot Setup Guide](./copilot-setup.md)
- [Claude Code Setup Guide](./claude-code-setup.md)
