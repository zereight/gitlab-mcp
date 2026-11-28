/**
 * Startup configuration checks. runServer() calls validateConfiguration() after
 * the startup config warnings and before any transport starts. Every error is
 * logged, then the process exits with code 1.
 *
 * index.ts owns the startup logger, and exitAfterFlush() must flush that same
 * logger before exiting, so both are passed in instead of being recreated here.
 */

import { getConfig, GITLAB_PERSONAL_ACCESS_TOKEN } from "./config.js";
import { RedirectUriPolicy, parseAllowedRedirectUris } from "./oauth-consent.js";
import type { createLogger } from "./utils/logger.js";
import {
  commaSplitHint,
  invalidListEntryError,
  toAllowedGitLabApiUrl,
  toAllowedMcpHost,
  toAllowedMcpOrigin,
} from "./utils/url.js";

export interface ConfigValidationDeps {
  logger: Pick<ReturnType<typeof createLogger>, "info" | "warn" | "error">;
  exitAfterFlush: (code: number) => never;
  /** index.ts-owned: GITLAB_API_URL errors, using the API URL source it resolved. */
  configuredGitLabApiUrlErrors: () => string[];
}

export function validateConfiguration({
  logger,
  exitAfterFlush,
  configuredGitLabApiUrlErrors,
}: ConfigValidationDeps): void {
  const errors: string[] = [];

  // Validate SESSION_TIMEOUT_SECONDS
  const timeoutStr = process.env.SESSION_TIMEOUT_SECONDS;
  if (timeoutStr) {
    const timeout = Number.parseInt(timeoutStr, 10);
    // Allow values >=1 for testing purposes, but recommend 60-86400 for production
    if (Number.isNaN(timeout) || timeout < 1 || timeout > 86400) {
      errors.push(
        `SESSION_TIMEOUT_SECONDS must be between 1 and 86400 seconds, got: ${timeoutStr}`
      );
    }
    if (timeout < 60) {
      logger.warn(
        `SESSION_TIMEOUT_SECONDS=${timeout} is below recommended minimum of 60 seconds. Only use low values for testing.`
      );
    }
  }

  // Validate MAX_SESSIONS
  const maxSessionsStr = process.env.MAX_SESSIONS;
  if (maxSessionsStr) {
    const maxSessions = Number.parseInt(maxSessionsStr, 10);
    if (Number.isNaN(maxSessions) || maxSessions < 1 || maxSessions > 10000) {
      errors.push(`MAX_SESSIONS must be between 1 and 10000, got: ${maxSessionsStr}`);
    }
  }

  // Validate MAX_REQUESTS_PER_MINUTE
  const maxReqStr = process.env.MAX_REQUESTS_PER_MINUTE;
  if (maxReqStr) {
    const maxReq = Number.parseInt(maxReqStr, 10);
    if (Number.isNaN(maxReq) || maxReq < 1 || maxReq > 1000) {
      errors.push(`MAX_REQUESTS_PER_MINUTE must be between 1 and 1000, got: ${maxReqStr}`);
    }
  }

  // Validate OAUTH_REGISTER_RATE_LIMIT_PER_HOUR
  const registerRateLimitStr = process.env.OAUTH_REGISTER_RATE_LIMIT_PER_HOUR;
  if (registerRateLimitStr) {
    const limit = Number(registerRateLimitStr);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      errors.push(
        `OAUTH_REGISTER_RATE_LIMIT_PER_HOUR must be an integer between 1 and 1000, got: ${registerRateLimitStr}`
      );
    }
  }

  // Validate PORT
  const portStr = getConfig("port", "PORT");
  if (portStr) {
    const port = Number.parseInt(portStr, 10);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      errors.push(`PORT must be between 1 and 65535, got: ${portStr}`);
    }
  }

  errors.push(...configuredGitLabApiUrlErrors());

  // No entry is echoed: a comma inside a password splits these lists too.
  const allowedHosts = getConfig("allowed-hosts", "GITLAB_ALLOWED_HOSTS")?.split(",") || [];
  let hasInvalidAllowedHost = false;
  allowedHosts.forEach((host, index) => {
    if (host.trim() && !toAllowedGitLabApiUrl(host)) {
      hasInvalidAllowedHost = true;
      errors.push(
        invalidListEntryError(
          "GITLAB_ALLOWED_HOSTS",
          index,
          allowedHosts.length,
          "is not a valid host or URL"
        )
      );
    }
  });
  if (hasInvalidAllowedHost && allowedHosts.length > 1) {
    errors.push(commaSplitHint("GITLAB_ALLOWED_HOSTS"));
  }

  const mcpAllowedHosts = getConfig("mcp-allowed-hosts", "MCP_ALLOWED_HOSTS")?.split(",") || [];
  mcpAllowedHosts.forEach((host, index) => {
    if (host.trim() && !toAllowedMcpHost(host)) {
      errors.push(
        invalidListEntryError(
          "MCP_ALLOWED_HOSTS",
          index,
          mcpAllowedHosts.length,
          "is not a valid host or URL"
        )
      );
    }
  });

  const mcpAllowedOrigins =
    getConfig("mcp-allowed-origins", "MCP_ALLOWED_ORIGINS")?.split(",") || [];
  mcpAllowedOrigins.forEach((origin, index) => {
    if (origin.trim() && !toAllowedMcpOrigin(origin)) {
      errors.push(
        invalidListEntryError(
          "MCP_ALLOWED_ORIGINS",
          index,
          mcpAllowedOrigins.length,
          "is not a valid origin URL"
        )
      );
    }
  });

  // Validate auth configuration
  const remoteAuth = getConfig("remote-auth", "REMOTE_AUTHORIZATION") === "true";
  const useOAuth = getConfig("use-oauth", "GITLAB_USE_OAUTH") === "true";
  // getConfig() would ignore GITLAB_PERSONAL_ACCESS_TOKEN_FILE.
  const hasToken = !!GITLAB_PERSONAL_ACCESS_TOKEN;
  const hasJobToken = !!getConfig("job-token", "GITLAB_JOB_TOKEN");
  const hasCookie = !!getConfig("cookie-path", "GITLAB_AUTH_COOKIE_PATH");
  const mcpOAuth = getConfig("mcp-oauth", "GITLAB_MCP_OAUTH") === "true";
  const mcpServerUrl = getConfig("mcp-server-url", "MCP_SERVER_URL");
  const streamableHttp = getConfig("streamable-http", "STREAMABLE_HTTP") === "true";
  const sse = getConfig("sse", "SSE") === "true";
  const sseAuthToken = getConfig("sse-auth-token", "SSE_AUTH_TOKEN");
  const allowUnauthenticatedRemoteSse =
    getConfig(
      "sse-dangerously-allow-unauthenticated-remote",
      "SSE_DANGEROUSLY_ALLOW_UNAUTHENTICATED_REMOTE"
    ) === "true";

  if (!remoteAuth && !useOAuth && !hasToken && !hasJobToken && !hasCookie && !mcpOAuth) {
    errors.push(
      "Either --token, --job-token, --cookie-path, --use-oauth=true, --remote-auth=true, or --mcp-oauth=true must be set (or use environment variables)"
    );
  }

  const streamableHttpAuthToken = getConfig(
    "streamable-http-auth-token",
    "STREAMABLE_HTTP_AUTH_TOKEN"
  );
  if (
    streamableHttp &&
    (hasToken || hasJobToken || hasCookie || useOAuth) &&
    !remoteAuth &&
    !mcpOAuth &&
    !streamableHttpAuthToken
  ) {
    errors.push(
      "STREAMABLE_HTTP=true/--streamable-http with server-side GitLab credentials requires REMOTE_AUTHORIZATION=true/--remote-auth=true, GITLAB_MCP_OAUTH=true/--mcp-oauth=true, or STREAMABLE_HTTP_AUTH_TOKEN/--streamable-http-auth-token"
    );
  }

  if (sse && !sseAuthToken && !allowUnauthenticatedRemoteSse) {
    errors.push(
      "SSE=true requires SSE_AUTH_TOKEN (or explicitly set SSE_DANGEROUSLY_ALLOW_UNAUTHENTICATED_REMOTE=true)"
    );
  }

  if (mcpOAuth) {
    if (!mcpServerUrl) {
      errors.push(
        "MCP_SERVER_URL is required when GITLAB_MCP_OAUTH=true (e.g. https://mcp.example.com)"
      );
    } else {
      try {
        const u = new URL(mcpServerUrl);
        const isInsecure = u.protocol !== "https:";
        const isLocalhost = u.hostname === "localhost" || u.hostname === "127.0.0.1";
        const allowInsecure = process.env.MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL === "true";
        if (isInsecure && !isLocalhost && !allowInsecure) {
          errors.push(
            "MCP_SERVER_URL must use HTTPS in production " +
              "(set MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL=true for local dev)"
          );
        }
      } catch {
        errors.push(`MCP_SERVER_URL is not a valid URL: ${mcpServerUrl}`);
      }
    }

    if (!getConfig("api-url", "GITLAB_API_URL")) {
      errors.push("GITLAB_API_URL is required when GITLAB_MCP_OAUTH=true");
    }

    if (!getConfig("oauth-app-id", "GITLAB_OAUTH_APP_ID")) {
      errors.push(
        "GITLAB_OAUTH_APP_ID is required when GITLAB_MCP_OAUTH=true " +
          "(create an OAuth application in GitLab Admin with the required scopes)"
      );
    }

    if (getConfig("oauth-callback-proxy", "GITLAB_OAUTH_CALLBACK_PROXY") === "true") {
      try {
        new RedirectUriPolicy(
          parseAllowedRedirectUris(
            getConfig("oauth-allowed-redirect-uris", "GITLAB_OAUTH_ALLOWED_REDIRECT_URIS")
          )
        );
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  const enableDynamicApiUrl =
    getConfig("enable-dynamic-api-url", "ENABLE_DYNAMIC_API_URL") === "true";
  if (enableDynamicApiUrl && !remoteAuth) {
    errors.push("ENABLE_DYNAMIC_API_URL=true requires REMOTE_AUTHORIZATION=true");
  }

  const enableDynamicProjectScope =
    getConfig("enable-dynamic-project-scope", "ENABLE_DYNAMIC_PROJECT_SCOPE") === "true";
  if (enableDynamicProjectScope && !remoteAuth) {
    errors.push("ENABLE_DYNAMIC_PROJECT_SCOPE=true requires REMOTE_AUTHORIZATION=true");
  }

  if (errors.length > 0) {
    logger.error("Configuration validation failed:");
    errors.forEach(err => logger.error(`  - ${err}`));
    exitAfterFlush(1);
  }

  logger.info("Configuration validation passed");
}
