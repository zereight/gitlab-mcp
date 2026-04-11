# GitHub Copilot Setup Guide

This guide explains how to use `@zereight/mcp-gitlab` with GitHub Copilot in VS Code.

## Important note

GitHub Copilot in VS Code uses the same VS Code MCP server configuration model.

That means you configure the server in:

- `.vscode/mcp.json` for workspace scope, or
- your user-profile `mcp.json` for global scope

## PAT setup

Recommended secure example:

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

## How to verify it loaded

After adding the server:

1. Reload VS Code if needed
2. Open Chat
3. Use MCP or chat customization commands to confirm the server is present
4. Ask a simple prompt such as:

```text
List my GitLab projects.
```

## Troubleshooting

### 1. The server does not appear in chat

Check the MCP server list and output logs in VS Code.

### 2. The server exists but tools are missing

Make sure the server actually started and that trust was granted.

### 3. `${input:...}` does not resolve

Add the matching `inputs` entry with the exact same `id`.

### 4. OAuth does not open correctly

Check:

- client ID
- redirect URI
- whether the app is confidential and needs a secret
- API URL format

### 5. PAT works in GitLab but not here

Verify the token scope and make sure you used the API URL with `/api/v4`.

## Recommended first prompt

```text
Show me my GitLab projects and recent merge requests.
```

## See also

- [VS Code Setup Guide](./vscode-setup.md)
- [Claude Code Setup Guide](./claude-code-setup.md)
- [OAuth2 Authentication Setup Guide](./oauth-setup.md)
