# GitLab MCP Server

Agent-workflow-optimized [GitLab MCP](https://github.com/zereight/gitlab-mcp) server — manage
projects, merge requests, issues, pipelines, wiki, releases, tags, milestones, and more from
AI clients such as Claude Code, VS Code, Cursor, and Copilot.

- 277 tools: 275 in toolsets + `execute_graphql` + `discover_tools` for on-demand activation
- Personal Access Token, OAuth2, read-only mode, and remote authorization
- stdio, SSE, and Streamable HTTP transports
- Works with gitlab.com and self-hosted instances

## Quick start

```bash
docker pull zereight050/gitlab-mcp:latest

# Secret your MCP client must send as a Bearer token
export MCP_AUTH_TOKEN="$(openssl rand -hex 32)"

docker run -d --name gitlab-mcp -p 127.0.0.1:3002:3002 \
  -e GITLAB_PERSONAL_ACCESS_TOKEN="<your-token>" \
  -e GITLAB_API_URL="https://gitlab.com/api/v4" \
  -e STREAMABLE_HTTP=true \
  -e STREAMABLE_HTTP_AUTH_TOKEN="$MCP_AUTH_TOKEN" \
  -e HOST=0.0.0.0 \
  zereight050/gitlab-mcp:latest
```

Streamable HTTP with a server-side `GITLAB_PERSONAL_ACCESS_TOKEN` refuses to start without
`STREAMABLE_HTTP_AUTH_TOKEN` (or `REMOTE_AUTHORIZATION=true`). Point your MCP client at the
server and send the same secret:

```json
{
  "mcpServers": {
    "gitlab": {
      "type": "streamable-http",
      "url": "http://localhost:3002/mcp",
      "headers": {
        "Authorization": "Bearer <value of MCP_AUTH_TOKEN>"
      }
    }
  }
}
```

With Docker Compose, copy the compose file and `.env.example` from the
[repository](https://github.com/zereight/gitlab-mcp/tree/main/docker), set at least
`GITLAB_PERSONAL_ACCESS_TOKEN`, `STREAMABLE_HTTP=true`, `STREAMABLE_HTTP_AUTH_TOKEN`, and
`HOST=0.0.0.0` in your `.env` (or environment), and run `docker compose up -d`. Without
`HOST=0.0.0.0` the server binds to container loopback and the published port stays
unreachable.

## Environment variables

| Variable                         | Default                      | Description                                        |
| -------------------------------- | ---------------------------- | -------------------------------------------------- |
| `GITLAB_PERSONAL_ACCESS_TOKEN`   | —                            | GitLab personal access token (required for PAT)    |
| `GITLAB_API_URL`                 | `https://gitlab.com/api/v4`  | GitLab API endpoint, self-hosted supported         |
| `STREAMABLE_HTTP`                | `false`                      | Set `true` for Streamable HTTP transport (port 3002) |
| `STREAMABLE_HTTP_AUTH_TOKEN`     | —                            | Bearer token clients send on `/mcp`; required with a server-side token unless `REMOTE_AUTHORIZATION=true` |
| `SSE`                            | `false`                      | Set `true` for legacy SSE transport (requires `SSE_AUTH_TOKEN`) |
| `HOST`                           | `127.0.0.1`                  | Set `0.0.0.0` inside containers                    |
| `PORT`                           | `3002`                       | HTTP port for SSE / Streamable HTTP                |
| `GITLAB_PERMISSION_MODE`         | `full`                       | `readonly`, `modify`, or `full`                    |
| `GITLAB_TOOLSETS`                | lean `core` when unset       | Comma-separated toolset IDs. A non-empty value replaces the default core set. Include `core` to keep that set. |
| `GITLAB_ALLOWED_PROJECT_IDS`     | —                            | Comma-separated project allowlist                  |
| `REMOTE_AUTHORIZATION`           | `false`                      | Multi-user mode, each caller sends its own token   |

Full list:
[environment variables](https://github.com/zereight/gitlab-mcp/blob/main/docs/configuration/environment-variables.md).

## Tags

- `latest` — latest stable release
- `X.Y.Z` — pinned releases, e.g. `zereight050/gitlab-mcp:2.1.59`

## Provenance and SBOM

Release images are multi-platform (`linux/amd64`, `linux/arm64`) and carry a
build provenance attestation and an SBOM for each platform. Inspect them with
Docker Buildx 0.10.0 or later:

```bash
docker buildx imagetools inspect zereight050/gitlab-mcp:<version> --format '{{ json .Provenance }}'
docker buildx imagetools inspect zereight050/gitlab-mcp:<version> --format '{{ json .SBOM }}'
```

Images up to 2.3.6 have no SBOM.

## Links

- Source: <https://github.com/zereight/gitlab-mcp>
- Docs: <https://zereight.github.io/gitlab-mcp/>
- npm: <https://www.npmjs.com/package/@zereight/mcp-gitlab>
