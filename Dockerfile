# GitLab MCP Server Dockerfile
# Multi-stage build for optimal image size and security

# ============================================================================
# DEPENDENCIES STAGE - Install all dependencies
# ============================================================================
FROM node:22-alpine AS dependencies

# Enable Corepack and prepare Yarn
RUN corepack enable && corepack prepare yarn@4.12.0 --activate

# Set working directory
WORKDIR /app

# Copy only package files for better caching
COPY package.json yarn.lock .yarnrc.yml ./

# Install ALL dependencies (including dev) for building
RUN --mount=type=cache,target=/root/.yarn/berry/cache \
    --mount=type=cache,target=/app/.yarn/cache \
    yarn install --immutable

# ============================================================================
# BUILD STAGE - Build the application
# ============================================================================
FROM node:22-alpine AS builder

# Enable Corepack and prepare Yarn (same version)
RUN corepack enable && corepack prepare yarn@4.12.0 --activate

# Set working directory
WORKDIR /app

# Copy dependencies and Yarn setup from previous stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package.json ./package.json
COPY --from=dependencies /app/yarn.lock ./yarn.lock
COPY --from=dependencies /app/.yarnrc.yml ./.yarnrc.yml
# Copy .yarn directory to avoid re-downloading Yarn
COPY --from=dependencies /app/.yarn ./.yarn

# Copy source code and config files
COPY tsconfig*.json ./
COPY src ./src
COPY prisma ./prisma
COPY prisma.config.ts ./

# Build the application
RUN yarn build

# ============================================================================
# PRODUCTION DEPENDENCIES STAGE - Install only production dependencies
# ============================================================================
FROM node:22-alpine AS production-deps

# Enable Corepack and prepare Yarn (same version)
RUN corepack enable && corepack prepare yarn@4.12.0 --activate

# Set working directory
WORKDIR /app

# Copy package files and Yarn setup
COPY package.json yarn.lock .yarnrc.yml ./
# Copy .yarn directory from dependencies stage to avoid re-downloading
COPY --from=dependencies /app/.yarn ./.yarn

# Install only production dependencies
ENV NODE_ENV=production
RUN --mount=type=cache,target=/root/.yarn/berry/cache \
    --mount=type=cache,target=/app/.yarn/cache \
    yarn workspaces focus --production

# ============================================================================
# RUNTIME STAGE
# ============================================================================
FROM node:22-alpine AS runtime

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    && update-ca-certificates

# Create non-root user for security
RUN addgroup -g 1001 -S gitlab-mcp && \
    adduser -S gitlab-mcp -u 1001 -G gitlab-mcp

# Set working directory
WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=gitlab-mcp:gitlab-mcp /app/dist ./dist

# Copy production dependencies from production-deps stage
COPY --from=production-deps --chown=gitlab-mcp:gitlab-mcp /app/node_modules ./node_modules

# Copy package.json for reference
COPY --from=builder --chown=gitlab-mcp:gitlab-mcp /app/package.json ./package.json

# ============================================================================
# ENVIRONMENT CONFIGURATION
# ============================================================================

# Core GitLab connection settings (required)
ENV GITLAB_TOKEN=""
ENV GITLAB_API_URL=""

# Optional GitLab connection settings
ENV GITLAB_PROJECT_ID=""
ENV GITLAB_GROUP_PATH=""

# Server configuration
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV PORT=3000

# Transport mode configuration (default: HTTP streamable)
ENV STREAMABLE_HTTP=true
ENV SSE=false

# Feature flags for GitLab tiers
ENV USE_WORKITEMS=true
ENV USE_MILESTONE=true
ENV USE_PIPELINE=true
ENV USE_GITLAB_WIKI=true

# Security and access control
ENV GITLAB_READ_ONLY_MODE=false
ENV GITLAB_DENIED_TOOLS_REGEX=""

# Network and proxy settings
ENV HTTP_PROXY=""
ENV HTTPS_PROXY=""
ENV NO_PROXY=""

# Performance and resource limits with ESM support
ENV NODE_OPTIONS="--max-old-space-size=512 --experimental-specifier-resolution=node --no-warnings"

# Health check endpoint
ENV HEALTH_CHECK_ENABLED=true

# ============================================================================
# RUNTIME CONFIGURATION
# ============================================================================

# Switch to non-root user
USER gitlab-mcp

# Expose default port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "const http = require('http'); const options = { host: 'localhost', port: process.env.PORT || 3000, path: '/health', timeout: 2000 }; const req = http.request(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.end();" || exit 1

# Set entrypoint
ENTRYPOINT ["node", "dist/main.js"]

# Default command arguments (can be overridden)
CMD ["sse"]

# ============================================================================
# LABELS AND METADATA
# ============================================================================
LABEL org.opencontainers.image.title="GitLab MCP Server"
LABEL org.opencontainers.image.description="Model Context Protocol server for GitLab API integration"
LABEL org.opencontainers.image.vendor="Structured World"
LABEL org.opencontainers.image.authors="Dmitry Prudnikov <mail@polaz.com>"
LABEL org.opencontainers.image.url="https://github.com/structured-world/gitlab-mcp"
LABEL org.opencontainers.image.documentation="https://github.com/structured-world/gitlab-mcp/blob/main/README.md"
LABEL org.opencontainers.image.source="https://github.com/structured-world/gitlab-mcp"
LABEL org.opencontainers.image.licenses="MIT"
