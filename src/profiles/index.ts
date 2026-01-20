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
