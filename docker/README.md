# Start GitLab MCP Server with Docker Compose


## Starting the server
### 1. Set up environment variables

```bash
# in root
cd docker

cp .env.example .env
```

### 2. Override environment variables

Edit `.env` and set at least:

```dotenv
GITLAB_PERSONAL_ACCESS_TOKEN=glpat-...
GITLAB_API_URL=https://gitlab.com/api/v4
STREAMABLE_HTTP=true
STREAMABLE_HTTP_AUTH_TOKEN=<output of: openssl rand -hex 32>
HOST=0.0.0.0
```

Streamable HTTP with a server-side GitLab token refuses to start without
`STREAMABLE_HTTP_AUTH_TOKEN` (or `REMOTE_AUTHORIZATION=true`). For the legacy SSE
transport, set `SSE=true` and `SSE_AUTH_TOKEN` instead of the two `STREAMABLE_HTTP*` lines.

Point your MCP client at the server and send the same secret:

```json
{
  "mcpServers": {
    "gitlab": {
      "type": "streamable-http",
      "url": "http://localhost:3002/mcp",
      "headers": {
        "Authorization": "Bearer <STREAMABLE_HTTP_AUTH_TOKEN>"
      }
    }
  }
}
```

### Response masking

The `masking-config` directory is mounted read-only at `/app/masking-config`.
It includes an empty `.gitlab-mcp-mask.json` so enabling masking starts with the
built-in token and IP rules. Add local rules to that file, then set:

```dotenv
GITLAB_MASKING_ENABLED=true
GITLAB_MASKING_CONFIG=.gitlab-mcp-mask.json
```

For managed policies, place the protected policy file in the same directory and
set `GITLAB_MASKING_POLICY_FILE` to its filename. Do not mount this directory
into an agent or any other untrusted container.



### 3. Start with Docker Compose

```bash
docker compose up -d
```


## Upgrade the server

```bash
cd docker
docker compose down
git pull origin main
docker compose pull
docker compose up -d
```
