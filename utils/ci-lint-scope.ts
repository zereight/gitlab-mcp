// GitLab's CI lint API expands `include:` entries with the token's permissions, so
// `include: project:` (and a nested `local:` inside such a file, or a CI/CD component)
// pulls files from projects other than the one being linted. Under a project
// allowlist, the expanded configuration must not carry content from a project outside
// it. The lint verdict (valid, errors, warnings) is kept; the expanded configuration
// (merged_yaml, includes, jobs) is dropped when any include comes from a project the
// allowlist does not cover, or when its source cannot be determined.

export interface CiLintIncludeEntry {
  type?: unknown;
  location?: unknown;
  extra?: unknown;
  context_project?: unknown;
}

export interface CiLintScopableResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
  merged_yaml?: string | null;
  includes?: unknown[] | null;
  jobs?: unknown[];
}

export const CI_LINT_OUT_OF_SCOPE_NOTE =
  "merged_yaml, includes, and jobs were removed because the configuration includes files from a project outside the allowed project list. The lint result (valid, errors, warnings) is unchanged.";

// Include types whose content never comes from a GitLab project.
const PROJECTLESS_INCLUDE_TYPES = new Set(["template", "remote"]);

/**
 * The project of a CI/CD component reference: `<host>/<project path>/<component>@<version>`.
 * Returns undefined when the location does not have that shape.
 */
export function ciComponentProjectPath(location: string): string | undefined {
  const withoutVersion = location.split("@")[0];
  const segments = withoutVersion.split("/").filter(Boolean);
  if (segments.length < 4) {
    return undefined;
  }
  return segments.slice(1, -1).join("/");
}

/**
 * The project paths an include entry reads from, or null when they cannot be
 * determined (an unknown include type or a missing field), which callers treat as out
 * of scope.
 */
export function ciLintIncludeProjects(entry: unknown): string[] | null {
  if (typeof entry !== "object" || entry === null) {
    return null;
  }
  const include = entry as CiLintIncludeEntry;
  const type = typeof include.type === "string" ? include.type : undefined;
  const contextProject =
    typeof include.context_project === "string" && include.context_project
      ? include.context_project
      : undefined;
  if (type === undefined || contextProject === undefined) {
    return null;
  }
  // The project whose configuration declared this include. A nested `local:` include
  // inside a file from another project reads from that other project.
  const projects = [contextProject];

  if (type === "local" || PROJECTLESS_INCLUDE_TYPES.has(type)) {
    return projects;
  }
  if (type === "file") {
    const extra = include.extra as { project?: unknown } | undefined;
    const project = typeof extra?.project === "string" ? extra.project : undefined;
    return project ? [...projects, project] : null;
  }
  if (type === "component") {
    const location = typeof include.location === "string" ? include.location : undefined;
    const project = location ? ciComponentProjectPath(location) : undefined;
    return project ? [...projects, project] : null;
  }
  return null;
}

/**
 * Drop the expanded configuration from a CI lint result when it may contain files from
 * a project outside the allowlist. `isProjectAllowed` decides for one project path.
 */
export async function scopeCiLintResult<T extends CiLintScopableResult>(
  result: T,
  isProjectAllowed: (projectPath: string) => Promise<boolean>
): Promise<T | (T & { scope_note: string })> {
  const hasExpandedConfig =
    (result.merged_yaml !== undefined && result.merged_yaml !== null) ||
    (Array.isArray(result.includes) && result.includes.length > 0) ||
    (Array.isArray(result.jobs) && result.jobs.length > 0);
  if (!hasExpandedConfig) {
    return result;
  }

  let inScope = Array.isArray(result.includes);
  for (const entry of result.includes ?? []) {
    const projects = ciLintIncludeProjects(entry);
    if (projects === null) {
      inScope = false;
      break;
    }
    for (const project of projects) {
      if (!(await isProjectAllowed(project))) {
        inScope = false;
        break;
      }
    }
    if (!inScope) {
      break;
    }
  }
  if (inScope) {
    return result;
  }

  const { merged_yaml: _mergedYaml, includes: _includes, jobs: _jobs, ...verdict } = result;
  return {
    ...(verdict as T),
    merged_yaml: null,
    includes: null,
    scope_note: CI_LINT_OUT_OF_SCOPE_NOTE,
  };
}
