/**
 * OAuth Configuration for gitlab-mcp
 *
 * Handles OAuth mode detection and configuration validation.
 * Uses Zod for runtime validation per CLAUDE.md standards.
 */

import { z } from "zod";
import { logger } from "../logger";

/**
 * Zod schema for OAuth configuration
 * All OAuth-specific environment variables are validated here
 */
const OAuthConfigSchema = z.object({
  /** Whether OAuth mode is enabled */
  enabled: z.literal(true),
  /** Secret for signing MCP JWT tokens (minimum 32 characters) */
  sessionSecret: z.string().min(32, "OAUTH_SESSION_SECRET must be at least 32 characters"),
  /** GitLab OAuth application client ID */
  gitlabClientId: z.string().min(1, "GITLAB_OAUTH_CLIENT_ID is required"),
  /** GitLab OAuth application client secret (optional, for confidential apps) */
  gitlabClientSecret: z.string().optional(),
  /** OAuth scopes to request from GitLab */
  gitlabScopes: z.string().default("api,read_user"),
  /** MCP access token TTL in seconds */
  tokenTtl: z.number().positive().default(3600),
  /** MCP refresh token TTL in seconds */
  refreshTokenTtl: z.number().positive().default(604800),
  /** Device flow polling interval in seconds */
  devicePollInterval: z.number().positive().default(5),
  /** Device flow timeout in seconds */
  deviceTimeout: z.number().positive().default(300),
});

/**
 * Inferred TypeScript type from Zod schema
 */
export type OAuthConfig = z.infer<typeof OAuthConfigSchema>;

/**
 * Cached OAuth configuration (loaded once at startup)
 */
let cachedOAuthConfig: OAuthConfig | null | undefined = undefined;

/**
 * Load and validate OAuth configuration from environment variables
 *
 * Returns null if OAuth is not enabled (OAUTH_ENABLED !== 'true')
 * Throws an error if OAuth is enabled but configuration is invalid
 *
 * @returns OAuthConfig if OAuth mode is enabled, null otherwise
 */
export function loadOAuthConfig(): OAuthConfig | null {
  // Return cached config if already loaded
  if (cachedOAuthConfig !== undefined) {
    return cachedOAuthConfig;
  }

  // Check if OAuth mode is enabled
  if (process.env.OAUTH_ENABLED !== "true") {
    cachedOAuthConfig = null;
    logger.debug("OAuth mode disabled (OAUTH_ENABLED !== 'true')");
    return null;
  }

  // Use safeParse per CLAUDE.md Zod standards
  const result = OAuthConfigSchema.safeParse({
    enabled: true as const,
    sessionSecret: process.env.OAUTH_SESSION_SECRET,
    gitlabClientId: process.env.GITLAB_OAUTH_CLIENT_ID,
    gitlabClientSecret: process.env.GITLAB_OAUTH_CLIENT_SECRET,
    gitlabScopes: process.env.GITLAB_OAUTH_SCOPES ?? "api,read_user",
    tokenTtl: parseInt(process.env.OAUTH_TOKEN_TTL ?? "3600", 10),
    refreshTokenTtl: parseInt(process.env.OAUTH_REFRESH_TOKEN_TTL ?? "604800", 10),
    devicePollInterval: parseInt(process.env.OAUTH_DEVICE_POLL_INTERVAL ?? "5", 10),
    deviceTimeout: parseInt(process.env.OAUTH_DEVICE_TIMEOUT ?? "300", 10),
  });

  if (!result.success) {
    const errorMessages = result.error.issues
      .map(e => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
    throw new Error(`Invalid OAuth configuration: ${errorMessages}`);
  }

  cachedOAuthConfig = result.data;
  logger.info("OAuth mode enabled with valid configuration");
  return result.data;
}

/**
 * Validate static token configuration (used when OAuth is disabled)
 *
 * Throws an error if GITLAB_TOKEN is not set
 */
export function validateStaticConfig(): void {
  if (!process.env.GITLAB_TOKEN) {
    throw new Error("GITLAB_TOKEN is required when OAUTH_ENABLED is not true");
  }
  logger.debug("Static token mode: GITLAB_TOKEN configured");
}

/**
 * Check if the server is running in OAuth mode
 *
 * @returns true if OAuth mode is enabled
 */
export function isOAuthEnabled(): boolean {
  return loadOAuthConfig() !== null;
}

/**
 * Reset cached configuration (for testing purposes)
 */
export function resetOAuthConfigCache(): void {
  cachedOAuthConfig = undefined;
}

/**
 * Get the authentication mode description
 *
 * @returns Human-readable description of the current auth mode
 */
export function getAuthModeDescription(): string {
  if (isOAuthEnabled()) {
    return "OAuth mode (per-user authentication via GitLab Device Flow)";
  }
  return "Static token mode (shared GITLAB_TOKEN)";
}
