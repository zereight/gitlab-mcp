# Start GitLab MCP Server with Docker Compose


## Starting the server
### 1. Set up environment variables

```bash
# in root
cd docker

cp .env.example .env
```

### 2. Override environment variables



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