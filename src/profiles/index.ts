/**
 * Profiles module - configuration profiles for GitLab MCP
 *
 * @example
 * ```typescript
 * import { loadAndApplyProfile, ProfileLoader } from './profiles';
 *
 * // Apply a profile by name
 * await loadAndApplyProfile('work');
 *
 * // Or use the loader directly
 * const loader = new ProfileLoader();
 * const profiles = await loader.listProfiles();
 * ```
 */

// Types
export {
  Profile,
  Preset,
  ProfilesConfig,
  ProfileInfo,
  ProfileValidationResult,
  AuthConfig,
  PatAuth,
  OAuthAuth,
  CookieAuth,
  FeatureFlags,
  ProfileSchema,
  PresetSchema,
  ProfilesConfigSchema,
  // Project-level types
  ProjectPreset,
  ProjectProfile,
  ProjectConfig,
  ProjectPresetSchema,
  ProjectProfileSchema,
} from "./types";

// Loader
export { ProfileLoader, loadProfile, getProfileNameFromEnv } from "./loader";

// Applicator
export {
  applyProfile,
  applyPreset,
  loadAndApplyProfile,
  loadAndApplyPreset,
  tryApplyProfileFromEnv,
  ApplyProfileResult,
  ApplyPresetResult,
} from "./applicator";

// Project-level config loader
export {
  loadProjectConfig,
  findProjectConfig,
  validateProjectPreset,
  validateProjectProfile,
  getProjectConfigSummary,
  PROJECT_CONFIG_DIR,
  PROJECT_PRESET_FILE,
  PROJECT_PROFILE_FILE,
} from "./project-loader";

// Scope enforcer
export {
  ScopeEnforcer,
  ScopeViolationError,
  ScopeConfig,
  extractProjectsFromArgs,
  enforceArgsScope,
} from "./scope-enforcer";
