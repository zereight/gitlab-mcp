# bookworm-slim (glibc): node:*-alpine (musl) crashes under QEMU arm64
# emulation with "uncaught target signal 4 (Illegal instruction)" during npm ci,
# hanging the multi-platform CI build until the job timeout.
FROM node:22.23.4-bookworm-slim@sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d AS builder

COPY . /app
COPY tsconfig.json /tsconfig.json

WORKDIR /app

# npm ci installs exactly package-lock.json (checked by integrity hash) and
# runs the prepare script, which builds build/.
RUN --mount=type=cache,target=/root/.npm npm ci

RUN --mount=type=cache,target=/root/.npm-production npm ci --ignore-scripts --omit-dev

FROM node:22.23.4-alpine@sha256:0e1754758c2df4cfa3e68d59e2e1b7374bb7fd9ea6328eaaacf15cc934af8202 AS release

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
