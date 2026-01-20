/**
 * Project-level configuration loader
 *
 * Loads configuration from .gitlab-mcp/ directory in a project repository.
 * Project configs provide:
 * - Scope restrictions (limit operations to specific projects)
 * - Feature overrides
 * - Tool selection
 *
 * Security notes:
 * - Project configs can only RESTRICT, never expand permissions
 * - No secrets in project files - auth comes from env/profiles
 * - Ignored in OAuth mode (server-side)
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as yaml from "yaml";
import {
  ProjectConfig,
  ProjectPreset,
  ProjectProfile,
  ProjectPresetSchema,
  ProjectProfileSchema,
  ProfileValidationResult,
} from "./types";
import { logger } from "../logger";

// ============================================================================
// Constants
// ============================================================================

/** Directory name for project-level configs */
export const PROJECT_CONFIG_DIR = ".gitlab-mcp";

/** Preset file name (restrictions) */
export const PROJECT_PRESET_FILE = "preset.yaml";

/** Profile file name (tool selection) */
export const PROJECT_PROFILE_FILE = "profile.yaml";

// ============================================================================
// Project Config Loader
// ============================================================================

/**
 * Load project configuration from .gitlab-mcp/ directory
 *
 * @param repoPath Path to the repository root (directory containing .gitlab-mcp/)
 * @returns ProjectConfig or null if no config exists
 */
export async function loadProjectConfig(repoPath: string): Promise<ProjectConfig | null> {
  const configDir = path.join(repoPath, PROJECT_CONFIG_DIR);

  // Check if .gitlab-mcp/ directory exists
  try {
    const stat = await fs.stat(configDir);
    if (!stat.isDirectory()) {
      logger.warn({ path: configDir }, "Project config path exists but is not a directory");
      return null;
    }
  } catch {
    logger.debug({ path: configDir }, "No project config directory found");
    return null;
  }

  const config: ProjectConfig = {
    configPath: configDir,
  };

  // Load preset.yaml (restrictions)
  const presetPath = path.join(configDir, PROJECT_PRESET_FILE);
  try {
    const content = await fs.readFile(presetPath, "utf8");
    const parsed = yaml.parse(content) as unknown;
    config.preset = ProjectPresetSchema.parse(parsed);
    logger.debug({ path: presetPath }, "Loaded project preset");
  } catch (error) {
    // File doesn't exist - that's OK
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message, path: presetPath }, "Failed to parse project preset");
      throw new Error(`Invalid project preset at ${presetPath}: ${message}`);
    }
  }

  // Load profile.yaml (tool selection)
  const profilePath = path.join(configDir, PROJECT_PROFILE_FILE);
  try {
    const content = await fs.readFile(profilePath, "utf8");
    const parsed = yaml.parse(content) as unknown;
    config.profile = ProjectProfileSchema.parse(parsed);
    logger.debug({ path: profilePath }, "Loaded project profile");
  } catch (error) {
    // File doesn't exist - that's OK
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message, path: profilePath }, "Failed to parse project profile");
      throw new Error(`Invalid project profile at ${profilePath}: ${message}`);
    }
  }

  // Return null if neither file exists
  if (!config.preset && !config.profile) {
    logger.debug(
      { path: configDir },
      "Project config directory exists but contains no config files"
    );
    return null;
  }

  logger.info(
    {
      path: configDir,
      hasPreset: !!config.preset,
      hasProfile: !!config.profile,
    },
    "Loaded project configuration"
  );

  return config;
}

/**
 * Find project config by walking up directory tree
 *
 * Useful when running from a subdirectory of a repository.
 * Stops at filesystem root or when .git is found without .gitlab-mcp.
 *
 * @param startPath Starting directory path
 * @returns ProjectConfig or null if not found
 */
export async function findProjectConfig(startPath: string): Promise<ProjectConfig | null> {
  let currentPath = path.resolve(startPath);
  const root = path.parse(currentPath).root;

  while (currentPath !== root) {
    // Check if .gitlab-mcp/ exists at this level
    const configDir = path.join(currentPath, PROJECT_CONFIG_DIR);
    try {
      await fs.access(configDir);
      return loadProjectConfig(currentPath);
    } catch {
      // Directory doesn't exist, continue searching
    }

    // Stop if we hit a .git directory without finding .gitlab-mcp
    const gitDir = path.join(currentPath, ".git");
    try {
      await fs.access(gitDir);
      logger.debug({ path: currentPath }, "Found .git without .gitlab-mcp, stopping search");
      return null;
    } catch {
      // .git doesn't exist, continue up the tree
    }

    // Move up one directory
    currentPath = path.dirname(currentPath);
  }

  return null;
}

/**
 * Validate a project preset configuration
 */
export function validateProjectPreset(preset: ProjectPreset): ProfileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate scope configuration
  // Note: Combining 'project' with 'projects' is already prevented by the Zod schema refinement
  if (preset.scope) {
    const { project, namespace, projects } = preset.scope;

    // Warn about broad namespace scope
    if (namespace && !project && !projects?.length) {
      warnings.push(
        `Scope restricts to namespace '${namespace}' - all projects in this group are allowed`
      );
    }
  }

  // Validate denied_actions format
  if (preset.denied_actions) {
    for (const action of preset.denied_actions) {
      const colonIndex = action.indexOf(":");
      if (colonIndex === -1) {
        errors.push(`Invalid denied_action format '${action}', expected 'tool:action'`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a project profile configuration
 */
export function validateProjectProfile(
  profile: ProjectProfile,
  availablePresets: string[]
): ProfileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate extends references valid preset
  if (profile.extends) {
    if (!availablePresets.includes(profile.extends)) {
      errors.push(`Unknown preset '${profile.extends}' in extends field`);
    }
  }

  // Warn about conflicting tool settings
  if (profile.additional_tools && profile.denied_tools) {
    const overlap = profile.additional_tools.filter(t => profile.denied_tools?.includes(t));
    if (overlap.length > 0) {
      warnings.push(
        `Tools appear in both additional_tools and denied_tools: ${overlap.join(", ")}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get a summary of project configuration for display
 */
export function getProjectConfigSummary(config: ProjectConfig): {
  presetSummary: string | null;
  profileSummary: string | null;
} {
  let presetSummary: string | null = null;
  let profileSummary: string | null = null;

  if (config.preset) {
    const parts: string[] = [];
    if (config.preset.description) {
      parts.push(config.preset.description);
    }
    if (config.preset.scope?.project) {
      parts.push(`scope: ${config.preset.scope.project}`);
    } else if (config.preset.scope?.namespace) {
      parts.push(`scope: ${config.preset.scope.namespace}/*`);
    } else if (config.preset.scope?.projects) {
      parts.push(`scope: ${config.preset.scope.projects.length} projects`);
    }
    if (config.preset.read_only) {
      parts.push("read-only");
    }
    if (config.preset.denied_actions?.length) {
      parts.push(`${config.preset.denied_actions.length} denied actions`);
    }
    presetSummary = parts.join(", ") || "custom restrictions";
  }

  if (config.profile) {
    const parts: string[] = [];
    if (config.profile.description) {
      parts.push(config.profile.description);
    }
    if (config.profile.extends) {
      parts.push(`extends: ${config.profile.extends}`);
    }
    if (config.profile.additional_tools?.length) {
      parts.push(`+${config.profile.additional_tools.length} tools`);
    }
    if (config.profile.denied_tools?.length) {
      parts.push(`-${config.profile.denied_tools.length} tools`);
    }
    profileSummary = parts.join(", ") || "custom tool selection";
  }

  return { presetSummary, profileSummary };
}
