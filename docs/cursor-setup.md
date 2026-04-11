# Cursor Setup Guide

This guide explains how to use `@zereight/mcp-gitlab` with Cursor.

> Note: this guide is based on common community MCP configuration patterns for Cursor. The exact Cursor MCP wrapper schema and settings surface can vary by version or distribution, so treat the examples below as best-effort patterns rather than repository-verified official Cursor documentation.

## Recommended config location

Use a common Cursor MCP config file pattern such as:

- `.cursor/mcp.json`

If your team shares the setup, keep the config in version control when appropriate.

## PAT setup

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "npx",
      "args": ["-y", "@zereight/mcp-gitlab"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "glpat-your-token",
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
  "mcpServers": {
    "gitlab": {
      "command": "npx",
      "args": ["-y", "@zereight/mcp-gitlab"],
      "env": {
        "GITLAB_USE_OAUTH": "true",
        "GITLAB_OAUTH_CLIENT_ID": "your-client-id",
        "GITLAB_OAUTH_REDIRECT_URI": "http://127.0.0.1:8888/callback",
        "GITLAB_API_URL": "https://gitlab.com/api/v4"
      }
    }
  }
}
```

If your GitLab OAuth app is confidential, add `GITLAB_OAUTH_CLIENT_SECRET`.

## Suggested first prompt

```text
List my GitLab projects.
```

## Common mistakes

### 1. API URL is missing `/api/v4`

Always use the API URL, not the web root.

### 2. OAuth redirect mismatch

The redirect URI in GitLab must exactly match your config.

### 3. PAT scope too small

Read-only flows usually need `read_api`. Write flows need `api`.

### 4. `npx` is unavailable

If Cursor cannot spawn the process, verify Node.js and `npx` are available to the environment Cursor uses.

## Notes

Cursor MCP config commonly uses an `mcpServers` map for local stdio servers. If your Cursor version or plugin presents a settings UI instead of a raw file, use the same inner server fields:

- `command`
- `args`
- `env`

## See also

- [VS Code Setup Guide](./vscode-setup.md)
- [GitHub Copilot Setup Guide](./copilot-setup.md)
- [Claude Code Setup Guide](./claude-code-setup.md)
