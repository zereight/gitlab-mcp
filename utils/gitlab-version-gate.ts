/**
 * Call-time GitLab instance version gate.
 *
 * Use when a tool exposes optional params that only exist on newer GitLab.
 * Schemas stay static; check before the API call and throw a retryable error.
 * Fail-open when the instance version cannot be fetched or parsed.
 */

const VERSION_CORE = /^(\d+)\.(\d+)(?:\.(\d+))?/;

export type GitLabVersionParts = {
  major: number;
  minor: number;
  patch: number;
};

/** Minimum GitLab version required for a feature. */
export type GitLabVersionRequirement = {
  major: number;
  minor: number;
  /** What the caller is trying to use (shown in the error). */
  feature: string;
  /** How the agent should recover (shown in the error). */
  retryHint: string;
};

/** Returns the instance version string (e.g. "19.2.0-ee"), or null if unknown. */
export type GitLabVersionFetcher = () => Promise<string | null>;

/** Parse strings like "19.2.0-ee" / "17.5.3". Returns null if unparseable. */
export function parseGitLabVersion(version: string): GitLabVersionParts | null {
  const match = VERSION_CORE.exec(version.trim());
  if (!match) return null;

  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2], 10);
  const patch = match[3] ? Number.parseInt(match[3], 10) : 0;
  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) {
    return null;
  }

  return { major, minor, patch };
}

/**
 * Compare a GitLab version string against a major.minor floor.
 * Returns null when the version string cannot be parsed.
 */
export function isGitLabVersionAtLeast(
  version: string,
  major: number,
  minor: number
): boolean | null {
  const parsed = parseGitLabVersion(version);
  if (!parsed) return null;
  if (parsed.major !== major) return parsed.major > major;
  return parsed.minor >= minor;
}

/**
 * Throws when the instance is known to be older than `requirement`.
 * Does nothing when the version is unknown (fail-open).
 */
export async function assertGitLabVersionAtLeast(
  requirement: GitLabVersionRequirement,
  fetchVersion: GitLabVersionFetcher
): Promise<void> {
  const current = await fetchVersion();
  if (current === null) return;

  const ok = isGitLabVersionAtLeast(current, requirement.major, requirement.minor);
  if (ok === null || ok) return;

  throw new Error(
    `GitLab ${requirement.major}.${requirement.minor}+ required for ${requirement.feature} ` +
      `(instance reports ${current}). ${requirement.retryHint}`
  );
}
