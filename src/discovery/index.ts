/**
 * Discovery module - auto-detection of GitLab configuration
 *
 * @example
 * ```typescript
 * import { autoDiscover, formatDiscoveryResult } from './discovery';
 *
 * // Auto-discover and apply configuration
 * const result = await autoDiscover();
 * if (result) {
 *   console.log(`Detected: ${result.host}/${result.projectPath}`);
 * }
 *
 * // Dry run - see what would be detected
 * const result = await autoDiscover({ dryRun: true });
 * if (result) {
 *   console.log(formatDiscoveryResult(result));
 * }
 * ```
 */

// Git remote parsing
export {
  parseGitRemote,
  parseRemoteUrl,
  parseGitConfig,
  selectBestRemote,
  listGitRemotes,
  GitRemoteInfo,
  ParseGitRemoteOptions,
} from "./git-remote";

// Profile matching
export { matchProfileByHost, findProfileByHost, ProfileMatchResult } from "./profile-matcher";

// Auto-discovery orchestrator
export {
  autoDiscover,
  formatDiscoveryResult,
  AutoDiscoveryOptions,
  AutoDiscoveryResult,
} from "./auto";
