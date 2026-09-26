# GitLab MCP Server

Agent-workflow-optimized [GitLab MCP](https://github.com/zereight/gitlab-mcp) server — manage
projects, merge requests, issues, pipelines, wiki, releases, tags, milestones, and more from
AI clients such as Claude Code, VS Code, Cursor, and Copilot.

- 232 tools + `discover_tools` for on-demand activation
- Personal Access Token, OAuth2, read-only mode, and remote authorization
- stdio, SSE, and Streamable HTTP transports
- Works with gitlab.com and self-hosted instances

## Quick start

```bash
docker pull zereight050/gitlab-mcp:latest

docker run -d --name gitlab-mcp -p 127.0.0.1:3002:3002 \
  -e GITLAB_PERSONAL_ACCESS_TOKEN="<your-token>" \
  -e GITLAB_API_URL="https://gitlab.com/api/v4" \
  -e STREAMABLE_HTTP=true \
  -e HOST=0.0.0.0 \
  zereight050/gitlab-mcp:latest
```

With Docker Compose, copy the compose file from the
[repository](https://github.com/zereight/gitlab-mcp/tree/main/docker), set at least
`GITLAB_PERSONAL_ACCESS_TOKEN`, `STREAMABLE_HTTP=true`, and `HOST=0.0.0.0` in your `.env`
(or environment), and run `docker compose up -d`. Without `HOST=0.0.0.0` the server binds
to container loopback and the published port stays unreachable.

## Environment variables

| Variable                         | Default                      | Description                                        |
| -------------------------------- | ---------------------------- | -------------------------------------------------- |
| `GITLAB_PERSONAL_ACCESS_TOKEN`   | —                            | GitLab personal access token (required for PAT)    |
| `GITLAB_API_URL`                 | `https://gitlab.com/api/v4`  | GitLab API endpoint, self-hosted supported         |
| `STREAMABLE_HTTP`                | `false`                      | Set `true` for Streamable HTTP transport (port 3002) |
| `SSE`                            | `false`                      | Set `true` for legacy SSE transport                |
| `HOST`                           | `127.0.0.1`                  | Set `0.0.0.0` inside containers                    |
| `PORT`                           | `3002`                       | HTTP port for SSE / Streamable HTTP                |
| `GITLAB_READ_ONLY_MODE`          | `false`                      | Set `true` to expose read-only tools               |
| `GITLAB_ALLOWED_PROJECT_IDS`     | —                            | Comma-separated project allowlist                  |
| `REMOTE_AUTHORIZATION`           | `false`                      | Multi-user mode, each caller sends its own token   |

Full list:
[environment variables](https://github.com/zereight/gitlab-mcp/blob/main/docs/configuration/environment-variables.md).

## Tags

- `latest` — latest stable release
- `vX.Y.Z` — pinned releases, e.g. `zereight050/gitlab-mcp:v2.1.59`

## Links

- Source: <https://github.com/zereight/gitlab-mcp>
- Docs: <https://zereight.github.io/gitlab-mcp/>
- npm: <https://www.npmjs.com/package/@zereight/mcp-gitlab>
