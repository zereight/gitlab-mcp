/**
 * Profile Applicator - applies profile settings to environment and config
 *
 * Converts profile configuration into environment variables and runtime settings
 * that the rest of the application understands.
 */

import { Profile, Preset, ProfileValidationResult } from "./types";
import { ProfileLoader } from "./loader";
import { logger } from "../logger";

// ============================================================================
// Environment Variable Mapping
// ============================================================================

/**
 * Map of profile feature flags to USE_* environment variables
 */
const FEATURE_ENV_MAP: Record<string, string> = {
  wiki: "USE_GITLAB_WIKI",
  milestones: "USE_MILESTONE",
  pipelines: "USE_PIPELINE",
  labels: "USE_LABELS",
  mrs: "USE_MRS",
  files: "USE_FILES",
  variables: "USE_VARIABLES",
  workitems: "USE_WORKITEMS",
  webhooks: "USE_WEBHOOKS",
  snippets: "USE_SNIPPETS",
  integrations: "USE_INTEGRATIONS",
};

// ============================================================================
// Profile Application Result
// ============================================================================

export interface ApplyProfileResult {
  success: boolean;
  profileName: string;
  host: string;
  appliedSettings: string[];
  validation: ProfileValidationResult;
}

export interface ApplyPresetResult {
  success: boolean;
  presetName: string;
  appliedSettings: string[];
  validation: ProfileValidationResult;
}

// ============================================================================
// Apply Profile
// ============================================================================

/**
 * Apply a profile's settings to environment variables
 *
 * This function sets environment variables based on the profile configuration.
 * The rest of the application reads from environment variables, so this bridges
 * the gap between profile config and runtime behavior.
 *
 * @param profile - The profile to apply
 * @param profileName - Name of the profile (for logging)
 * @returns Result of applying the profile
 */
export async function applyProfile(
  profile: Profile,
  profileName: string
): Promise<ApplyProfileResult> {
  const appliedSettings: string[] = [];
  const loader = new ProfileLoader();
  const validation = await loader.validateProfile(profile);

  // Log warnings but continue
  for (const warning of validation.warnings) {
    logger.warn({ profile: profileName }, warning);
  }

  // Stop on errors
  if (!validation.valid) {
    logger.error({ profile: profileName, errors: validation.errors }, "Profile validation failed");
    return {
      success: false,
      profileName,
      host: profile.host,
      appliedSettings,
      validation,
    };
  }

  // Apply connection settings
  const apiUrl = profile.api_url ?? `https://${profile.host}`;
  process.env.GITLAB_API_URL = apiUrl;
  appliedSettings.push(`GITLAB_API_URL=${apiUrl}`);

  // Apply authentication
  switch (profile.auth.type) {
    case "pat":
      if (profile.auth.token_env) {
        const token = process.env[profile.auth.token_env];
        if (token) {
          process.env.GITLAB_TOKEN = token;
          appliedSettings.push(`GITLAB_TOKEN=<from ${profile.auth.token_env}>`);
        }
      }
      break;

    case "oauth":
      if (profile.auth.client_id_env) {
        const clientId = process.env[profile.auth.client_id_env];
        if (clientId) {
          process.env.GITLAB_OAUTH_CLIENT_ID = clientId;
          appliedSettings.push(`GITLAB_OAUTH_CLIENT_ID=<from ${profile.auth.client_id_env}>`);
        }
      }
      if (profile.auth.client_secret_env) {
        const clientSecret = process.env[profile.auth.client_secret_env];
        if (clientSecret) {
          process.env.GITLAB_OAUTH_CLIENT_SECRET = clientSecret;
          appliedSettings.push(
            `GITLAB_OAUTH_CLIENT_SECRET=<from ${profile.auth.client_secret_env}>`
          );
        }
      }
      process.env.OAUTH_ENABLED = "true";
      appliedSettings.push("OAUTH_ENABLED=true");
      break;

    case "cookie":
      if (profile.auth.cookie_path) {
        process.env.GITLAB_AUTH_COOKIE_PATH = profile.auth.cookie_path;
        appliedSettings.push(`GITLAB_AUTH_COOKIE_PATH=${profile.auth.cookie_path}`);
      }
      break;
  }

  // Apply access control
  if (profile.read_only) {
    process.env.GITLAB_READ_ONLY_MODE = "true";
    appliedSettings.push("GITLAB_READ_ONLY_MODE=true");
  }

  if (profile.allowed_projects && profile.allowed_projects.length > 0) {
    process.env.GITLAB_ALLOWED_PROJECT_IDS = profile.allowed_projects.join(",");
    appliedSettings.push(`GITLAB_ALLOWED_PROJECT_IDS=${profile.allowed_projects.join(",")}`);
  }

  if (profile.allowed_groups && profile.allowed_groups.length > 0) {
    process.env.GITLAB_ALLOWED_GROUP_IDS = profile.allowed_groups.join(",");
    appliedSettings.push(`GITLAB_ALLOWED_GROUP_IDS=${profile.allowed_groups.join(",")}`);
  }

  if (profile.allowed_tools && profile.allowed_tools.length > 0) {
    process.env.GITLAB_ALLOWED_TOOLS = profile.allowed_tools.join(",");
    appliedSettings.push(`GITLAB_ALLOWED_TOOLS=${profile.allowed_tools.join(",")}`);
  }

  if (profile.denied_tools_regex) {
    process.env.GITLAB_DENIED_TOOLS_REGEX = profile.denied_tools_regex;
    appliedSettings.push(`GITLAB_DENIED_TOOLS_REGEX=${profile.denied_tools_regex}`);
  }

  if (profile.denied_actions && profile.denied_actions.length > 0) {
    process.env.GITLAB_DENIED_ACTIONS = profile.denied_actions.join(",");
    appliedSettings.push(`GITLAB_DENIED_ACTIONS=${profile.denied_actions.join(",")}`);
  }

  // Apply feature flags
  if (profile.features) {
    for (const [feature, envVar] of Object.entries(FEATURE_ENV_MAP)) {
      const value = profile.features[feature as keyof typeof profile.features];
      if (value !== undefined) {
        process.env[envVar] = value ? "true" : "false";
        appliedSettings.push(`${envVar}=${value}`);
      }
    }
  }

  // Apply timeout
  if (profile.timeout_ms) {
    process.env.GITLAB_API_TIMEOUT_MS = String(profile.timeout_ms);
    appliedSettings.push(`GITLAB_API_TIMEOUT_MS=${profile.timeout_ms}`);
  }

  // Apply TLS settings
  if (profile.skip_tls_verify) {
    process.env.SKIP_TLS_VERIFY = "true";
    appliedSettings.push("SKIP_TLS_VERIFY=true");
  }

  if (profile.ssl_cert_path) {
    process.env.SSL_CERT_PATH = profile.ssl_cert_path;
    appliedSettings.push(`SSL_CERT_PATH=${profile.ssl_cert_path}`);
  }

  if (profile.ssl_key_path) {
    process.env.SSL_KEY_PATH = profile.ssl_key_path;
    appliedSettings.push(`SSL_KEY_PATH=${profile.ssl_key_path}`);
  }

  if (profile.ca_cert_path) {
    process.env.GITLAB_CA_CERT_PATH = profile.ca_cert_path;
    appliedSettings.push(`GITLAB_CA_CERT_PATH=${profile.ca_cert_path}`);
  }

  // Apply default project/namespace
  if (profile.default_project) {
    process.env.GITLAB_PROJECT_ID = profile.default_project;
    appliedSettings.push(`GITLAB_PROJECT_ID=${profile.default_project}`);
  }

  if (profile.default_namespace) {
    process.env.GITLAB_DEFAULT_NAMESPACE = profile.default_namespace;
    appliedSettings.push(`GITLAB_DEFAULT_NAMESPACE=${profile.default_namespace}`);
  }

  logger.info(
    {
      profile: profileName,
      host: profile.host,
      authType: profile.auth.type,
      readOnly: profile.read_only ?? false,
      settingsCount: appliedSettings.length,
    },
    "Profile applied successfully"
  );

  return {
    success: true,
    profileName,
    host: profile.host,
    appliedSettings,
    validation,
  };
}

// ============================================================================
// Apply Preset
// ============================================================================

/**
 * Apply a preset's settings to environment variables
 *
 * Presets are applied ON TOP of existing environment configuration.
 * They do NOT set host or auth - those must already be configured via
 * GITLAB_API_URL and GITLAB_TOKEN environment variables.
 *
 * @param preset - The preset to apply
 * @param presetName - Name of the preset (for logging)
 * @returns Result of applying the preset
 */
export async function applyPreset(preset: Preset, presetName: string): Promise<ApplyPresetResult> {
  const appliedSettings: string[] = [];
  const loader = new ProfileLoader();
  const validation = await loader.validatePreset(preset);

  // Log warnings but continue
  for (const warning of validation.warnings) {
    logger.warn({ preset: presetName }, warning);
  }

  // Stop on errors
  if (!validation.valid) {
    logger.error({ preset: presetName, errors: validation.errors }, "Preset validation failed");
    return {
      success: false,
      presetName,
      appliedSettings,
      validation,
    };
  }

  // Verify that host/auth are already configured (presets require existing connection)
  if (!process.env.GITLAB_API_URL && !process.env.GITLAB_TOKEN) {
    logger.warn(
      { preset: presetName },
      "Preset applied but GITLAB_API_URL/GITLAB_TOKEN not set - connection may fail"
    );
  }

  // Apply access control
  if (preset.read_only) {
    process.env.GITLAB_READ_ONLY_MODE = "true";
    appliedSettings.push("GITLAB_READ_ONLY_MODE=true");
  }

  if (preset.denied_tools_regex) {
    process.env.GITLAB_DENIED_TOOLS_REGEX = preset.denied_tools_regex;
    appliedSettings.push(`GITLAB_DENIED_TOOLS_REGEX=${preset.denied_tools_regex}`);
  }

  if (preset.denied_actions && preset.denied_actions.length > 0) {
    process.env.GITLAB_DENIED_ACTIONS = preset.denied_actions.join(",");
    appliedSettings.push(`GITLAB_DENIED_ACTIONS=${preset.denied_actions.join(",")}`);
  }

  if (preset.allowed_tools && preset.allowed_tools.length > 0) {
    process.env.GITLAB_ALLOWED_TOOLS = preset.allowed_tools.join(",");
    appliedSettings.push(`GITLAB_ALLOWED_TOOLS=${preset.allowed_tools.join(",")}`);
  }

  // Apply feature flags
  if (preset.features) {
    for (const [feature, envVar] of Object.entries(FEATURE_ENV_MAP)) {
      const value = preset.features[feature as keyof typeof preset.features];
      if (value !== undefined) {
        process.env[envVar] = value ? "true" : "false";
        appliedSettings.push(`${envVar}=${value}`);
      }
    }
  }

  // Apply timeout
  if (preset.timeout_ms) {
    process.env.GITLAB_API_TIMEOUT_MS = String(preset.timeout_ms);
    appliedSettings.push(`GITLAB_API_TIMEOUT_MS=${preset.timeout_ms}`);
  }

  logger.info(
    {
      preset: presetName,
      readOnly: preset.read_only ?? false,
      settingsCount: appliedSettings.length,
    },
    "Preset applied successfully"
  );

  return {
    success: true,
    presetName,
    appliedSettings,
    validation,
  };
}

// ============================================================================
// Load and Apply Profile/Preset
// ============================================================================

/**
 * Load and apply a profile by name
 *
 * Convenience function that combines loading and applying.
 *
 * @param profileName - Name of the profile to load and apply
 * @returns Result of applying the profile
 */
export async function loadAndApplyProfile(profileName: string): Promise<ApplyProfileResult> {
  const loader = new ProfileLoader();
  const profile = await loader.loadProfile(profileName);
  return applyProfile(profile, profileName);
}

/**
 * Load and apply a preset by name
 *
 * Convenience function that combines loading and applying.
 *
 * @param presetName - Name of the preset to load and apply
 * @returns Result of applying the preset
 */
export async function loadAndApplyPreset(presetName: string): Promise<ApplyPresetResult> {
  const loader = new ProfileLoader();
  const preset = await loader.loadPreset(presetName);
  return applyPreset(preset, presetName);
}

/**
 * Try to apply profile or preset from environment or CLI args
 *
 * Tries user profile first, then falls back to built-in preset.
 * This allows using built-in presets like "readonly" with --profile flag.
 *
 * @param cliProfileName - Profile/preset name from CLI argument (optional)
 * @returns Result if a profile/preset was applied, undefined otherwise
 */
export async function tryApplyProfileFromEnv(
  cliProfileName?: string
): Promise<ApplyProfileResult | ApplyPresetResult | undefined> {
  // Priority: CLI arg > env var > default profile
  const name = cliProfileName ?? process.env.GITLAB_PROFILE ?? (await getDefaultProfileName());

  if (!name) {
    logger.debug("No profile specified, using environment variables directly");
    return undefined;
  }

  try {
    const loader = new ProfileLoader();
    const loaded = await loader.loadAny(name);

    if (loaded.type === "profile") {
      return await applyProfile(loaded.data, name);
    } else {
      return await applyPreset(loaded.data, name);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ profile: name, error: message }, "Failed to apply profile/preset");
    throw error;
  }
}

/**
 * Get default profile name from user config
 */
async function getDefaultProfileName(): Promise<string | undefined> {
  const loader = new ProfileLoader();
  return loader.getDefaultProfileName();
}
