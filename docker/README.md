# Start GitLab MCP Server with Docker Compose


## Starting the server
### 1. Set up environment variables

```bash
# in root
cd docker

cp .env.example .env
```

### 2. Override environment variables

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
