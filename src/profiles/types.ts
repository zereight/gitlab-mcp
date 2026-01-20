/**
 * Profile types and Zod schemas for GitLab MCP configuration profiles
 *
 * Profiles enable:
 * - Multi-GitLab instance support
 * - Role-based access patterns
 * - Feature flag presets
 * - Tool restrictions
 */

import { z } from "zod";

// ============================================================================
// Authentication Schemas
// ============================================================================

const PatAuthSchema = z.object({
  type: z.literal("pat"),
  token_env: z.string().describe("Environment variable containing the PAT token"),
});

const OAuthAuthSchema = z.object({
  type: z.literal("oauth"),
  client_id_env: z.string().describe("Environment variable containing OAuth client ID"),
  client_secret_env: z
    .string()
    .optional()
    .describe("Environment variable containing OAuth client secret"),
});

const CookieAuthSchema = z.object({
  type: z.literal("cookie"),
  cookie_path: z.string().describe("Path to cookie file for authentication"),
});

const AuthConfigSchema = z.discriminatedUnion("type", [
  PatAuthSchema,
  OAuthAuthSchema,
  CookieAuthSchema,
]);

// ============================================================================
// Feature Flags Schema
// ============================================================================

const FeatureFlagsSchema = z
  .object({
    wiki: z.boolean().optional(),
    milestones: z.boolean().optional(),
    pipelines: z.boolean().optional(),
    labels: z.boolean().optional(),
    mrs: z.boolean().optional(),
    files: z.boolean().optional(),
    variables: z.boolean().optional(),
    workitems: z.boolean().optional(),
    webhooks: z.boolean().optional(),
    snippets: z.boolean().optional(),
    integrations: z.boolean().optional(),
  })
  .optional();

// ============================================================================
// Profile Schema
// ============================================================================

/**
 * Full profile schema - for user-defined profiles with complete configuration
 */
export const ProfileSchema = z.object({
  // Connection (required for user profiles)
  host: z.string().describe("GitLab hostname (e.g., gitlab.company.com)"),
  api_url: z.string().url().optional().describe("Override API URL (default: https://{host})"),

  // Authentication (required for user profiles)
  auth: AuthConfigSchema,

  // Access Control
  read_only: z.boolean().optional().describe("Enable read-only mode"),
  allowed_projects: z
    .array(z.string())
    .optional()
    .describe("Project whitelist (empty = all allowed)"),
  allowed_groups: z.array(z.string()).optional().describe("Group whitelist (empty = all allowed)"),
  denied_tools_regex: z.string().optional().describe("Regex pattern to exclude tools"),
  allowed_tools: z
    .array(z.string())
    .optional()
    .describe("Explicit tool whitelist (overrides denied_tools_regex)"),
  denied_actions: z.array(z.string()).optional().describe("Denied actions in format 'tool:action'"),

  // Feature Flags
  features: FeatureFlagsSchema,

  // Behavior
  timeout_ms: z.number().int().positive().optional().describe("API timeout in milliseconds"),
  default_project: z.string().optional().describe("Auto-set project context"),
  default_namespace: z.string().optional().describe("Auto-set namespace context"),

  // TLS Configuration
  skip_tls_verify: z.boolean().optional().describe("Skip TLS certificate verification"),
  ssl_cert_path: z.string().optional().describe("Path to SSL certificate"),
  ssl_key_path: z.string().optional().describe("Path to SSL key"),
  ca_cert_path: z.string().optional().describe("Path to CA certificate"),
});

// ============================================================================
// Preset Schema (for built-in profiles - NO host/auth, only settings)
// ============================================================================

/**
 * Preset schema - for built-in profiles that only define settings/restrictions
 * These are applied ON TOP of existing environment configuration.
 * They NEVER contain host or auth - those come from env vars or user profiles.
 */
export const PresetSchema = z
  .object({
    // Description for documentation
    description: z.string().optional().describe("Human-readable description of the preset"),

    // Access Control
    read_only: z.boolean().optional().describe("Enable read-only mode"),
    denied_tools_regex: z.string().optional().describe("Regex pattern to exclude tools"),
    allowed_tools: z.array(z.string()).optional().describe("Explicit tool whitelist"),
    denied_actions: z
      .array(z.string())
      .optional()
      .describe("Denied actions in format 'tool:action'"),

    // Feature Flags
    features: FeatureFlagsSchema,

    // Behavior
    timeout_ms: z.number().int().positive().optional().describe("API timeout in milliseconds"),
  })
  .strict(); // Reject unknown fields like host/auth for security

// ============================================================================
// Profiles Config File Schema
// ============================================================================

export const ProfilesConfigSchema = z.object({
  profiles: z.record(z.string(), ProfileSchema).describe("Named profiles"),
  default_profile: z.string().optional().describe("Default profile when none specified"),
});

// ============================================================================
// TypeScript Types (inferred from schemas)
// ============================================================================

export type PatAuth = z.infer<typeof PatAuthSchema>;
export type OAuthAuth = z.infer<typeof OAuthAuthSchema>;
export type CookieAuth = z.infer<typeof CookieAuthSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Preset = z.infer<typeof PresetSchema>;
export type ProfilesConfig = z.infer<typeof ProfilesConfigSchema>;

// ============================================================================
// Profile Info (for listing)
// ============================================================================

export interface ProfileInfo {
  name: string;
  host?: string; // Optional - presets don't have host
  authType?: "pat" | "oauth" | "cookie"; // Optional - presets don't have auth
  readOnly: boolean;
  isBuiltIn: boolean;
  isPreset: boolean; // true for built-in presets, false for full profiles
  description?: string;
}

// ============================================================================
// Validation Result
// ============================================================================

export interface ProfileValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
