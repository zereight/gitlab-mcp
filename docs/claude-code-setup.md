# Claude Code Setup Guide

This guide explains how to use `@zereight/mcp-gitlab` with Claude Code.

## Recommended options

Claude Code supports multiple ways to register a local stdio MCP server:

1. `claude mcp add` — fastest for personal local setup
2. `claude mcp add-json` — useful when you already have JSON config ready
3. Project `.mcp.json` — best when you want a team-shared configuration in version control

## Prerequisites

- Claude Code installed
- Node.js available in your shell
- GitLab access via either:
  - Personal Access Token (PAT), or
  - OAuth application for local browser auth

Use an API URL, not the web root:

- `https://gitlab.com/api/v4`
- `https://your-gitlab.example.com/api/v4`

## Option 1 — Add with `claude mcp add` (PAT)

This is the fastest path for a local personal setup.

```bash
claude mcp add gitlab --transport stdio \
  --scope local \
  --env GITLAB_PERSONAL_ACCESS_TOKEN=glpat-your-token \
  --env GITLAB_API_URL=https://gitlab.com/api/v4 \
  -- npx -y @zereight/mcp-gitlab
```

Optional flags you can add as extra `--env` values:

- `GITLAB_READ_ONLY_MODE=true`
- `USE_GITLAB_WIKI=true`
- `USE_MILESTONE=true`
- `USE_PIPELINE=true`

Useful management commands:

```bash
claude mcp list
claude mcp get gitlab
claude mcp remove gitlab
```

Inside Claude Code, use:

```text
/mcp
```

to inspect server status.

## Option 2 — Add with `claude mcp add` (OAuth)

Use this for a local browser-based auth flow instead of a PAT.

```bash
claude mcp add gitlab --transport stdio \
  --scope local \
  --env GITLAB_USE_OAUTH=true \
  --env GITLAB_OAUTH_CLIENT_ID=your-client-id \
  --env GITLAB_OAUTH_REDIRECT_URI=http://127.0.0.1:8888/callback \
  --env GITLAB_API_URL=https://gitlab.com/api/v4 \
  -- npx -y @zereight/mcp-gitlab
```

If your GitLab OAuth app is confidential, also add:

```bash
--env GITLAB_OAUTH_CLIENT_SECRET=your-client-secret
```

## Option 3 — Add with `claude mcp add-json`

Use this when you want to register a ready-made JSON server config.

PAT example:

```bash
claude mcp add-json gitlab '{"type":"stdio","command":"npx","args":["-y","@zereight/mcp-gitlab"],"env":{"GITLAB_PERSONAL_ACCESS_TOKEN":"glpat-your-token","GITLAB_API_URL":"https://gitlab.com/api/v4"}}'
```

OAuth example:

```bash
claude mcp add-json gitlab '{"type":"stdio","command":"npx","args":["-y","@zereight/mcp-gitlab"],"env":{"GITLAB_USE_OAUTH":"true","GITLAB_OAUTH_CLIENT_ID":"your-client-id","GITLAB_OAUTH_REDIRECT_URI":"http://127.0.0.1:8888/callback","GITLAB_API_URL":"https://gitlab.com/api/v4"}}'
```

## Option 4 — Project `.mcp.json`

Use a project-scoped config when you want the server definition shared with your team.

Create a `.mcp.json` file at your project root:

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "npx",
      "args": ["-y", "@zereight/mcp-gitlab"],
      "env": {
        "GITLAB_API_URL": "https://gitlab.com/api/v4",
        "GITLAB_READ_ONLY_MODE": "false"
      }
    }
  }
}
```

Then add secrets via environment variables in your shell before starting Claude Code.

## Suggested first prompt

After the server is loaded, try:

```text
List my GitLab projects.
```

## Common mistakes

### 1. Using the web URL instead of the API URL

Wrong:

- `https://gitlab.com`

Correct:

- `https://gitlab.com/api/v4`

### 2. OAuth redirect URI mismatch

Your GitLab OAuth application redirect URI must exactly match:

- `GITLAB_OAUTH_REDIRECT_URI`

### 3. Missing OAuth client secret for confidential apps

If the GitLab app is confidential, `GITLAB_OAUTH_CLIENT_SECRET` is required.

### 4. Server not found in Claude Code

Use:

```bash
claude mcp list
claude mcp get gitlab
```

### 5. MCP trust or scope confusion

Claude Code supports multiple scopes:

- `local` — private to you in the current project context
- `project` — stored in project `.mcp.json` for sharing
- `user` — available across projects for your user account

## See also

- [OAuth2 Authentication Setup Guide](./oauth-setup.md)
- [VS Code Setup Guide](./vscode-setup.md)
- [GitHub Copilot Setup Guide](./copilot-setup.md)
