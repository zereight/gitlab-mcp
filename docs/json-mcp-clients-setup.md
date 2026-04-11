# JSON-Based MCP Clients Setup Guide

This guide is for clients such as Factory AI Droid, OpenClaw, and OpenCode when they support MCP server configuration through a JSON-based settings file or MCP settings UI.

> Note: this is a schema-agnostic, best-effort guide. It intentionally avoids claiming exact official file locations or wrapper schemas for these clients unless the format is explicitly verified.

## Important note

Different clients use different top-level schemas and file locations.

Because those client-specific schemas can vary, this guide does **not** assume a single exact file path or wrapper format. Instead, it gives you reusable server blocks for `@zereight/mcp-gitlab` that you can place inside the client's MCP configuration structure.

Use the local stdio server fields that your client expects and map in these values:

- `command`
- `args`
- `env`

## Reusable PAT server block

```json
{
  "command": "npx",
  "args": ["-y", "@zereight/mcp-gitlab"],
  "env": {
    "GITLAB_PERSONAL_ACCESS_TOKEN": "glpat-your-token",
    "GITLAB_API_URL": "https://gitlab.com/api/v4",
    "GITLAB_READ_ONLY_MODE": "false"
  }
}
```

## Reusable OAuth server block

```json
{
  "command": "npx",
  "args": ["-y", "@zereight/mcp-gitlab"],
  "env": {
    "GITLAB_USE_OAUTH": "true",
    "GITLAB_OAUTH_CLIENT_ID": "your-client-id",
    "GITLAB_OAUTH_REDIRECT_URI": "http://127.0.0.1:8888/callback",
    "GITLAB_API_URL": "https://gitlab.com/api/v4"
  }
}
```

If your OAuth app is confidential, also add:

```json
{
  "GITLAB_OAUTH_CLIENT_SECRET": "your-client-secret"
}
```

## Example wrappers

If your client expects an `mcpServers` object:

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "npx",
      "args": ["-y", "@zereight/mcp-gitlab"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "glpat-your-token",
        "GITLAB_API_URL": "https://gitlab.com/api/v4"
      }
    }
  }
}
```

If your client expects a `servers` object:

```json
{
  "servers": {
    "gitlab": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@zereight/mcp-gitlab"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "glpat-your-token",
        "GITLAB_API_URL": "https://gitlab.com/api/v4"
      }
    }
  }
}
```

## Client-specific notes

### Factory AI Droid

Use the local stdio MCP server fields supported by the Droid MCP configuration flow. Reuse the server block above and adapt it to the exact Droid wrapper schema exposed by your Droid version.

### OpenClaw

If OpenClaw exposes an MCP JSON configuration surface, reuse the same `command` / `args` / `env` block and place it inside the client's expected wrapper format.

### OpenCode

If OpenCode exposes a JSON MCP configuration format, reuse the same stdio server block and adapt it to the required top-level schema for that release or integration surface.

## Common mistakes

### 1. Using the GitLab web URL instead of the API URL

Use:

- `https://gitlab.com/api/v4`

not:

- `https://gitlab.com`

### 2. Missing OAuth client secret for confidential apps

Only public OAuth apps can omit `GITLAB_OAUTH_CLIENT_SECRET`.

### 3. Wrong wrapper schema

Your client may require:

- `mcpServers`
- `servers`
- or a settings UI with separate fields

The inner server block remains the same, but the outer wrapper can differ.

### 4. Hardcoding secrets in shared config

If the client supports secret prompts, environment files, or injected env vars, prefer those over committing secrets to source control.

## Recommended first prompt

```text
List my GitLab projects and show me recent merge requests.
```

## See also

- [VS Code Setup Guide](./vscode-setup.md)
- [Cursor Setup Guide](./cursor-setup.md)
- [Codex Setup Guide](./codex-setup.md)
- [Claude Code Setup Guide](./claude-code-setup.md)
- [OAuth2 Authentication Setup Guide](./oauth-setup.md)
