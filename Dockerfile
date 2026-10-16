# bookworm-slim (glibc): node:*-alpine (musl) crashes under QEMU arm64
# emulation with "uncaught target signal 4 (Illegal instruction)" during npm ci,
# hanging the multi-platform CI build until the job timeout.
FROM node:22.21.1-bookworm-slim AS builder

COPY . /app
COPY tsconfig.json /tsconfig.json

WORKDIR /app

RUN --mount=type=cache,target=/root/.npm npm install

RUN --mount=type=cache,target=/root/.npm-production npm ci --ignore-scripts --omit-dev

FROM node:22.21.1-alpine AS release

# MCP Registry OCI ownership check; must match "name" in server.json.
LABEL io.modelcontextprotocol.server.name="io.github.zereight/gitlab-mcp"

WORKDIR /app

COPY --from=builder /app/build /app/build
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/package-lock.json /app/package-lock.json

ENV NODE_ENV=production

EXPOSE 3002

RUN npm ci --ignore-scripts --omit-dev

USER node

ENTRYPOINT ["node", "build/index.js"]
