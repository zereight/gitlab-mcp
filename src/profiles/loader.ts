/**
 * Profile Loader - loads profiles and presets from user config and built-in directory
 *
 * Two types of configurations:
 * 1. Profiles (user-defined): Full configuration with host, auth, and settings
 *    Location: ~/.config/gitlab-mcp/profiles.yaml
 *
 * 2. Presets (built-in): Only settings/restrictions, NO host/auth
 *    Location: embedded in package (src/profiles/builtin/)
 *    Presets are applied ON TOP of existing environment configuration.
 *
 * SECURITY: Built-in presets NEVER contain host or auth to prevent
 * accidental requests to wrong GitLab instances during testing.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as yaml from "yaml";
import {
  Profile,
  Preset,
  ProfilesConfig,
  ProfilesConfigSchema,
  PresetSchema,
  ProfileInfo,
  ProfileValidationResult,
} from "./types";
import { logger } from "../logger";

// ============================================================================
// Constants
// ============================================================================

const USER_CONFIG_DIR = path.join(os.homedir(), ".config", "gitlab-mcp");
const USER_PROFILES_PATH = path.join(USER_CONFIG_DIR, "profiles.yaml");

/**
 * Get the built-in presets directory path.
 * Works in both compiled (dist/) and development (src/) environments.
 * Tests always provide their own paths, so this is only used at runtime.
 *
 * Resolution order:
 * 1. __dirname/builtin - works when installed from npm (dist/src/profiles/builtin)
 * 2. process.cwd()/dist/src/profiles/builtin - compiled location from project root
 * 3. process.cwd()/src/profiles/builtin - source location for development
 */
function getBuiltinDir(): string {
  const candidates = [
    // Primary: relative to this module (works when installed from npm)
    path.join(__dirname, "builtin"),
    // Fallback: compiled location from project root
    path.join(process.cwd(), "dist", "src", "profiles", "builtin"),
    // Fallback: source location for development
    path.join(process.cwd(), "src", "profiles", "builtin"),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }

  // Return first candidate path for error message clarity
  return candidates[0];
}

// ============================================================================
// Profile Loader Class
// ============================================================================

export class ProfileLoader {
  private userConfigPath: string;
  private builtinDir: string;
  private profileCache: Map<string, Profile> = new Map();
  private presetCache: Map<string, Preset> = new Map();
  private configCache: ProfilesConfig | null = null;

  constructor(userConfigPath: string = USER_PROFILES_PATH, builtinDir?: string) {
    this.userConfigPath = userConfigPath;
    this.builtinDir = builtinDir ?? getBuiltinDir();
  }

  /**
   * Load a full profile by name (user profiles only)
   * Full profiles include host and auth configuration.
   */
  async loadProfile(name: string): Promise<Profile> {
    // Check cache first
    const cached = this.profileCache.get(name);
    if (cached) {
      return cached;
    }

    // Only user profiles are full profiles
    const userProfile = await this.loadUserProfile(name);
    if (userProfile) {
      this.profileCache.set(name, userProfile);
      return userProfile;
    }

    throw new Error(
      `Profile '${name}' not found. Full profiles must be defined in user config. ` +
        `For built-in presets (settings only), use loadPreset('${name}').`
    );
  }

  /**
   * Load a preset by name (built-in presets only)
   * Presets contain only settings, NO host/auth.
   */
  async loadPreset(name: string): Promise<Preset> {
    // Check cache first
    const cached = this.presetCache.get(name);
    if (cached) {
      return cached;
    }

    const preset = await this.loadBuiltinPreset(name);
    if (preset) {
      this.presetCache.set(name, preset);
      return preset;
    }

    throw new Error(`Preset '${name}' not found in built-in presets`);
  }

  /**
   * Load either a profile or preset by name
   * Returns { type: 'profile', data: Profile } or { type: 'preset', data: Preset }
   */
  async loadAny(
    name: string
  ): Promise<{ type: "profile"; data: Profile } | { type: "preset"; data: Preset }> {
    // Try user profile first
    try {
      const profile = await this.loadProfile(name);
      return { type: "profile", data: profile };
    } catch {
      // Not a user profile, try preset
    }

    // Try built-in preset
    const preset = await this.loadBuiltinPreset(name);
    if (preset) {
      return { type: "preset", data: preset };
    }

    throw new Error(
      `'${name}' not found as user profile or built-in preset. ` +
        `Use 'yarn list-tools --profiles' to see available options.`
    );
  }

  /**
   * Get the default profile name from user config
   */
  async getDefaultProfileName(): Promise<string | undefined> {
    const config = await this.loadUserConfig();
    return config?.default_profile;
  }

  /**
   * Load user profiles config file
   */
  private async loadUserConfig(): Promise<ProfilesConfig | null> {
    if (this.configCache !== null) {
      return this.configCache;
    }

    if (!fs.existsSync(this.userConfigPath)) {
      logger.debug({ path: this.userConfigPath }, "User profiles config not found");
      return null;
    }

    try {
      const content = fs.readFileSync(this.userConfigPath, "utf8");
      const parsed = yaml.parse(content) as unknown;
      const validated = ProfilesConfigSchema.parse(parsed);
      this.configCache = validated;
      logger.debug(
        { path: this.userConfigPath, profiles: Object.keys(validated.profiles) },
        "Loaded user profiles config"
      );
      return validated;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message, path: this.userConfigPath }, "Failed to parse user profiles");
      throw new Error(`Invalid profiles config: ${message}`);
    }
  }

  /**
   * Load a specific profile from user config
   */
  private async loadUserProfile(name: string): Promise<Profile | null> {
    const config = await this.loadUserConfig();
    return config?.profiles[name] ?? null;
  }

  /**
   * Load a built-in preset by name
   */
  private async loadBuiltinPreset(name: string): Promise<Preset | null> {
    const presetPath = path.join(this.builtinDir, `${name}.yaml`);

    if (!fs.existsSync(presetPath)) {
      logger.debug({ name, path: presetPath }, "Built-in preset not found");
      return null;
    }

    try {
      const content = fs.readFileSync(presetPath, "utf8");
      const parsed = yaml.parse(content) as unknown;
      const validated = PresetSchema.parse(parsed);
      logger.debug({ name }, "Loaded built-in preset");
      return validated;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message, name }, "Failed to parse built-in preset");
      throw new Error(`Invalid built-in preset '${name}': ${message}`);
    }
  }

  /**
   * List all available profiles and presets
   */
  async listProfiles(): Promise<ProfileInfo[]> {
    const profiles: ProfileInfo[] = [];

    // Load user profiles (full profiles with host/auth)
    const userConfig = await this.loadUserConfig();
    if (userConfig) {
      for (const [name, profile] of Object.entries(userConfig.profiles)) {
        profiles.push({
          name,
          host: profile.host,
          authType: profile.auth.type,
          readOnly: profile.read_only ?? false,
          isBuiltIn: false,
          isPreset: false,
        });
      }
    }

    // Load built-in presets (settings only, no host/auth)
    if (fs.existsSync(this.builtinDir)) {
      const files = fs.readdirSync(this.builtinDir).filter(f => f.endsWith(".yaml"));
      for (const file of files) {
        const name = path.basename(file, ".yaml");

        try {
          const preset = await this.loadBuiltinPreset(name);
          if (preset) {
            profiles.push({
              name,
              readOnly: preset.read_only ?? false,
              isBuiltIn: true,
              isPreset: true,
              description: preset.description,
            });
          }
        } catch {
          // Skip invalid presets
          logger.warn({ name }, "Skipping invalid built-in preset");
        }
      }
    }

    return profiles.sort((a, b) => {
      // User profiles first, then presets
      if (a.isPreset !== b.isPreset) {
        return a.isPreset ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Validate denied_actions format (shared between profile and preset validation)
   */
  private validateDeniedActions(
    deniedActions: string[] | undefined,
    errors: string[],
    warnings: string[]
  ): void {
    if (!deniedActions) return;

    for (const action of deniedActions) {
      const colonIndex = action.indexOf(":");
      if (colonIndex === -1) {
        errors.push(`Invalid denied_action format '${action}', expected 'tool:action'`);
      } else {
        const tool = action.slice(0, colonIndex).trim();
        const act = action.slice(colonIndex + 1).trim();
        if (!tool || !act) {
          errors.push(`Invalid denied_action format '${action}', expected 'tool:action'`);
        } else if (action !== `${tool}:${act}`) {
          warnings.push(
            `denied_action '${action}' has extra whitespace, normalized to '${tool}:${act}'`
          );
        }
      }
    }
  }

  /**
   * Validate a full profile configuration
   */
  async validateProfile(profile: Profile): Promise<ProfileValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate auth config
    if (profile.auth.type === "pat" && profile.auth.token_env) {
      if (!process.env[profile.auth.token_env]) {
        warnings.push(`Environment variable '${profile.auth.token_env}' is not set`);
      }
    }

    if (profile.auth.type === "oauth" && profile.auth.client_id_env) {
      if (!process.env[profile.auth.client_id_env]) {
        warnings.push(`Environment variable '${profile.auth.client_id_env}' is not set`);
      }
    }

    if (profile.auth.type === "oauth" && profile.auth.client_secret_env) {
      if (!process.env[profile.auth.client_secret_env]) {
        warnings.push(`Environment variable '${profile.auth.client_secret_env}' is not set`);
      }
    }

    // Validate cookie auth path
    if (
      profile.auth.type === "cookie" &&
      "cookie_path" in profile.auth &&
      profile.auth.cookie_path
    ) {
      if (!fs.existsSync(profile.auth.cookie_path)) {
        errors.push(`Cookie file not found: ${profile.auth.cookie_path}`);
      }
    }

    // Validate TLS paths
    if (profile.ssl_cert_path && !fs.existsSync(profile.ssl_cert_path)) {
      errors.push(`SSL certificate not found: ${profile.ssl_cert_path}`);
    }

    if (profile.ssl_key_path && !fs.existsSync(profile.ssl_key_path)) {
      errors.push(`SSL key not found: ${profile.ssl_key_path}`);
    }

    if (profile.ca_cert_path && !fs.existsSync(profile.ca_cert_path)) {
      errors.push(`CA certificate not found: ${profile.ca_cert_path}`);
    }

    // Validate denied_tools_regex
    if (profile.denied_tools_regex) {
      try {
        new RegExp(profile.denied_tools_regex);
      } catch {
        errors.push(`Invalid regex in denied_tools_regex: ${profile.denied_tools_regex}`);
      }
    }

    // Validate denied_actions format
    this.validateDeniedActions(profile.denied_actions, errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a preset configuration
   */
  async validatePreset(preset: Preset): Promise<ProfileValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate denied_tools_regex
    if (preset.denied_tools_regex) {
      try {
        new RegExp(preset.denied_tools_regex);
      } catch {
        errors.push(`Invalid regex in denied_tools_regex: ${preset.denied_tools_regex}`);
      }
    }

    // Validate denied_actions format
    this.validateDeniedActions(preset.denied_actions, errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Ensure user config directory exists
   */
  static ensureConfigDir(): void {
    if (!fs.existsSync(USER_CONFIG_DIR)) {
      fs.mkdirSync(USER_CONFIG_DIR, { recursive: true });
      logger.info({ path: USER_CONFIG_DIR }, "Created config directory");
    }
  }

  /**
   * Get the path to user profiles config
   */
  static getUserConfigPath(): string {
    return USER_PROFILES_PATH;
  }

  /**
   * Clear internal caches (for testing)
   */
  clearCache(): void {
    this.profileCache.clear();
    this.presetCache.clear();
    this.configCache = null;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Load a profile by name using default paths
 */
export async function loadProfile(name: string): Promise<Profile> {
  const loader = new ProfileLoader();
  return loader.loadProfile(name);
}

/**
 * Load a preset by name using default paths
 */
export async function loadPreset(name: string): Promise<Preset> {
  const loader = new ProfileLoader();
  return loader.loadPreset(name);
}

/**
 * Get profile name from GITLAB_PROFILE environment variable
 */
export function getProfileNameFromEnv(): string | undefined {
  return process.env.GITLAB_PROFILE;
}
