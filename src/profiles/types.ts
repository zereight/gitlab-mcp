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
// Project-Level Configuration Schemas (.gitlab-mcp/)
// ============================================================================

/**
 * Scope configuration for project-level restrictions.
 * Determines which projects/namespaces operations are allowed on.
 */
export const ScopeConfigSchema = z
  .object({
    /** Single project restriction */
    project: z.string().optional().describe("Single project path (e.g., group/project)"),
    /** Namespace restriction (all projects in group) */
    namespace: z.string().optional().describe("Namespace/group path"),
    /** Explicit list of allowed projects */
    projects: z.array(z.string()).optional().describe("List of allowed project paths"),
  })
  .refine(
    data => {
      // At least one scope field must be set
      const hasProject = data.project !== undefined;
      const hasNamespace = data.namespace !== undefined;
      const hasProjects = data.projects !== undefined && data.projects.length > 0;
      return hasProject || hasNamespace || hasProjects;
    },
    { message: "Scope must define at least one of: project, namespace, or projects" }
  )
  .refine(
    data => {
      // Cannot combine project with projects
      if (data.project && data.projects && data.projects.length > 0) {
        return false;
      }
      return true;
    },
    { message: "Cannot combine 'project' with 'projects' - use one or the other" }
  );

/**
 * Project-level preset schema (.gitlab-mcp/preset.yaml)
 * Defines restrictions specific to this project repository.
 * These are applied ON TOP of user profiles/presets.
 */
export const ProjectPresetSchema = z
  .object({
    /** Human-readable description */
    description: z.string().optional().describe("Description of project restrictions"),

    /** Scope restriction - limits operations to specific projects/namespaces */
    scope: ScopeConfigSchema.optional().describe("Project/namespace scope restrictions"),

    /** Feature restrictions */
    features: FeatureFlagsSchema,

    /** Denied actions in format 'tool:action' */
    denied_actions: z
      .array(z.string())
      .optional()
      .describe("Denied actions in format 'tool:action'"),

    /** Denied tools (by name) */
    denied_tools: z.array(z.string()).optional().describe("List of denied tool names"),

    /** Enable read-only mode for this project */
    read_only: z.boolean().optional().describe("Enable read-only mode"),
  })
  .strict();

/**
 * Project-level profile schema (.gitlab-mcp/profile.yaml)
 * Defines tool selection and feature configuration for this project.
 * Can extend a built-in preset.
 */
export const ProjectProfileSchema = z
  .object({
    /** Human-readable description */
    description: z.string().optional().describe("Description of project configuration"),

    /** Inherit from a built-in preset */
    extends: z.string().optional().describe("Built-in preset name to inherit from"),

    /** Feature overrides (applied after extends) */
    features: FeatureFlagsSchema,

    /** Additional tools beyond base preset */
    additional_tools: z.array(z.string()).optional().describe("Additional tools to enable"),

    /** Tools to remove from base preset */
    denied_tools: z.array(z.string()).optional().describe("Tools to disable"),
  })
  .strict();

/**
 * Combined project configuration loaded from .gitlab-mcp/ directory
 */
export interface ProjectConfig {
  /** Path to the .gitlab-mcp/ directory */
  configPath: string;

  /** Preset from preset.yaml (restrictions) */
  preset?: ProjectPreset;

  /** Profile from profile.yaml (tool selection) */
  profile?: ProjectProfile;
}

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
export type ProjectPreset = z.infer<typeof ProjectPresetSchema>;
export type ProjectProfile = z.infer<typeof ProjectProfileSchema>;

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
