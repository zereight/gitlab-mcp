# bookworm-slim (glibc): node:*-alpine (musl) crashes under QEMU arm64
# emulation with "uncaught target signal 4 (Illegal instruction)" during npm ci,
# hanging the multi-platform CI build until the job timeout.
FROM node:22.23.5-bookworm-slim@sha256:be979e5523c76fa4d5ca4ebd3099078f220aa47ec39c48ad5b5df9314debd6eb AS builder

COPY . /app
COPY tsconfig.json /tsconfig.json

WORKDIR /app

# npm ci installs exactly package-lock.json (checked by integrity hash) and
# runs the prepare script, which builds build/.
RUN --mount=type=cache,target=/root/.npm npm ci

RUN --mount=type=cache,target=/root/.npm-production npm ci --ignore-scripts --omit-dev

FROM node:22.23.5-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS release

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
