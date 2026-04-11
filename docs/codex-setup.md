# Codex Setup Guide

This guide explains how to use `@zereight/mcp-gitlab` with Codex.

Codex supports MCP in two main ways:

1. `codex mcp add` from the CLI
2. `config.toml` in `~/.codex/config.toml` or project `.codex/config.toml`

## Prerequisites

- Codex installed
- Node.js available in your shell
- GitLab access via either:
  - Personal Access Token (PAT), or
  - OAuth for compatible remote MCP servers

For this local stdio server, PAT is the simplest path.

Use an API URL, not the web root:

- `https://gitlab.com/api/v4`
- `https://your-gitlab.example.com/api/v4`

## Option 1 — Add with `codex mcp add`

PAT example:

```bash
codex mcp add gitlab \
  --env GITLAB_PERSONAL_ACCESS_TOKEN=glpat-your-token \
  --env GITLAB_API_URL=https://gitlab.com/api/v4 \
  -- npx -y @zereight/mcp-gitlab
```

Optional extra environment variables:

```bash
--env GITLAB_READ_ONLY_MODE=true
--env USE_GITLAB_WIKI=true
--env USE_MILESTONE=true
--env USE_PIPELINE=true
```

## Option 2 — Configure with `config.toml`

Codex stores MCP config in:

- `~/.codex/config.toml`
- or project-scoped `.codex/config.toml`

Example:

```toml
[mcp_servers.gitlab]
command = "npx"
args = ["-y", "@zereight/mcp-gitlab"]

[mcp_servers.gitlab.env]
GITLAB_PERSONAL_ACCESS_TOKEN = "glpat-your-token"
GITLAB_API_URL = "https://gitlab.com/api/v4"
GITLAB_READ_ONLY_MODE = "false"
```

## Verifying the server

Useful commands:

```bash
codex mcp --help
```

In the Codex TUI, use:

```text
/mcp
```

to see active MCP servers.

## Recommended first prompt

```text
List my GitLab projects and recent merge requests.
```

## Common mistakes

### 1. Using the web URL instead of the API URL

Wrong:

- `https://gitlab.com`

Correct:

- `https://gitlab.com/api/v4`

### 2. Missing PAT scope

Use a token with at least:

- `read_api` for read-only workflows
- `api` for write workflows

### 3. Expecting OAuth flags to apply to stdio PAT mode

Codex supports OAuth for remote MCP flows, but for this local stdio GitLab setup, PAT is the most reliable starting point.

### 4. Shell command not found

If `npx` is not available in the environment where Codex launches subprocesses, use the full command path or ensure Node.js is on your `PATH`.

## See also

- [VS Code Setup Guide](./vscode-setup.md)
- [Claude Code Setup Guide](./claude-code-setup.md)
- [GitHub Copilot Setup Guide](./copilot-setup.md)
