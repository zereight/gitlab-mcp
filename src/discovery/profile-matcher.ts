/**
 * Profile matcher for auto-discovery
 *
 * Matches GitLab host from git remote to user-defined profiles.
 */

import { ProfileLoader, ProfileInfo } from "../profiles";
import { logger } from "../logger";

// ============================================================================
// Types
// ============================================================================

export interface ProfileMatchResult {
  /** Matched profile name */
  profileName: string;
  /** Profile info */
  profile: ProfileInfo;
  /** How the match was made */
  matchType: "exact" | "subdomain";
}

// ============================================================================
// Matching Logic
// ============================================================================

/**
 * Match a host to a user-defined profile
 *
 * Match priority:
 * 1. Exact host match (gitlab.company.com === gitlab.company.com)
 * 2. Subdomain match (gitlab.company.com matches profile with host company.com)
 *
 * @param host Host to match
 * @param profiles Available profiles
 * @returns Match result or null
 */
export function matchProfileByHost(
  host: string,
  profiles: ProfileInfo[]
): ProfileMatchResult | null {
  const normalizedHost = host.toLowerCase();

  // Only consider user profiles (with host defined)
  // Type guard ensures profile.host is string (not undefined)
  const userProfiles = profiles.filter(
    (p): p is ProfileInfo & { host: string } => typeof p.host === "string" && !p.isPreset
  );

  // 1. Try exact match first
  for (const profile of userProfiles) {
    const profileHost = profile.host.toLowerCase();
    if (normalizedHost === profileHost) {
      logger.debug(
        { host, profile: profile.name, matchType: "exact" },
        "Matched profile by exact host"
      );
      return {
        profileName: profile.name,
        profile,
        matchType: "exact",
      };
    }
  }

  // 2. Try subdomain match
  // e.g., git.company.com should match profile with host company.com
  for (const profile of userProfiles) {
    const profileHost = profile.host.toLowerCase();
    if (normalizedHost.endsWith(`.${profileHost}`)) {
      logger.debug(
        { host, profile: profile.name, matchType: "subdomain" },
        "Matched profile by subdomain"
      );
      return {
        profileName: profile.name,
        profile,
        matchType: "subdomain",
      };
    }
  }

  logger.debug({ host, availableHosts: userProfiles.map(p => p.host) }, "No profile match found");
  return null;
}

/**
 * Find a profile matching the given host using ProfileLoader
 *
 * @param host Host to match
 * @param loader Profile loader (optional, creates default if not provided)
 * @returns Match result or null
 */
export async function findProfileByHost(
  host: string,
  loader?: ProfileLoader
): Promise<ProfileMatchResult | null> {
  const profileLoader = loader ?? new ProfileLoader();
  const profiles = await profileLoader.listProfiles();
  return matchProfileByHost(host, profiles);
}
