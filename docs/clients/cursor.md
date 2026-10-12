# Cursor Setup Guide

This guide explains how to use `@zereight/mcp-gitlab` with Cursor.

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=zereight.gitlab-mcp&config=eyJ0eXBlIjoic3RkaW8iLCJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkB6ZXJlaWdodC9tY3AtZ2l0bGFiQGxhdGVzdCJdLCJlbnYiOnsiR0lUTEFCX1BFUlNPTkFMX0FDQ0VTU19UT0tFTiI6IiR7ZW52OkdJVExBQl9QRVJTT05BTF9BQ0NFU1NfVE9LRU59IiwiR0lUTEFCX0FQSV9VUkwiOiJodHRwczovL2dpdGxhYi5jb20vYXBpL3Y0IiwiR0lUTEFCX1BFUk1JU1NJT05fTU9ERSI6ImZ1bGwifX0%3D)

Set `GITLAB_PERSONAL_ACCESS_TOKEN` in the environment of the Cursor process. In `mcp.json`, Cursor substitutes `${env:GITLAB_PERSONAL_ACCESS_TOKEN}` in the `env` field.

## Recommended config location

Use a common Cursor MCP config file pattern such as:

- `.cursor/mcp.json`

If your team shares the setup, keep the config in version control when appropriate.

Install the server once:

```bash
brew tap zereight/gitlab-mcp https://github.com/zereight/gitlab-mcp
brew install zereight/gitlab-mcp/zereight-mcp-gitlab
```

Or with npm:

```bash
npm install -g @zereight/mcp-gitlab
```

If Cursor cannot find `zereight-mcp-gitlab`, use the absolute path from `which zereight-mcp-gitlab`.

## PAT setup

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "zereight-mcp-gitlab",
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "${env:GITLAB_PERSONAL_ACCESS_TOKEN}",
        "GITLAB_API_URL": "https://gitlab.com/api/v4"
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
      "command": "zereight-mcp-gitlab",
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

### 4. Global command is unavailable

If Cursor cannot spawn the process, verify npm's global bin directory is on the PATH Cursor uses, or set `command` to the absolute path from `which zereight-mcp-gitlab`.

## Notes

Cursor MCP config commonly uses an `mcpServers` map for local stdio servers. If your Cursor version or plugin presents a settings UI instead of a raw file, use the same inner server fields:

- `command`
- `args`
- `env`

## See also

- [VS Code Setup Guide](vscode.md)
- [GitHub Copilot Setup Guide](copilot.md)
- [Claude Code Setup Guide](claude-code.md)
