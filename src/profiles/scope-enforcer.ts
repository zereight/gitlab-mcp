/**
 * Scope Enforcer - enforces project/namespace restrictions
 *
 * When a project config defines a scope, the ScopeEnforcer ensures
 * that all operations are limited to the allowed projects/namespaces.
 *
 * Security model:
 * - Scope is ADDITIVE RESTRICTION only - can only narrow, never expand
 * - Applied at tool invocation time, not registration time
 * - Throws clear error when operation would exceed scope
 */

import { ProjectPreset } from "./types";
import { logger } from "../logger";

/**
 * Scope configuration extracted from ProjectPreset
 */
export interface ScopeConfig {
  /** Single project restriction */
  project?: string;
  /** Namespace restriction (all projects in group) */
  namespace?: string;
  /** Explicit list of allowed projects */
  projects?: string[];
}

/**
 * Error thrown when an operation exceeds the allowed scope
 */
export class ScopeViolationError extends Error {
  constructor(
    public readonly attemptedTarget: string,
    public readonly allowedScope: ScopeConfig
  ) {
    const scopeDescription = getScopeDescription(allowedScope);
    super(`Operation on '${attemptedTarget}' is outside the allowed scope (${scopeDescription})`);
    this.name = "ScopeViolationError";
  }
}

/**
 * Get a human-readable description of the scope
 */
function getScopeDescription(scope: ScopeConfig): string {
  if (scope.project) {
    return `project: ${scope.project}`;
  }
  if (scope.namespace) {
    return `namespace: ${scope.namespace}/*`;
  }
  if (scope.projects && scope.projects.length > 0) {
    if (scope.projects.length <= 3) {
      return `projects: ${scope.projects.join(", ")}`;
    }
    return `${scope.projects.length} allowed projects`;
  }
  return "unrestricted";
}

/**
 * Normalize a project path for comparison
 *
 * - Removes leading/trailing slashes
 * - Converts to lowercase
 * - Handles numeric IDs (returns as-is)
 */
function normalizeProjectPath(path: string): string {
  const trimmed = path.trim().replace(/^\/+|\/+$/g, "");
  // If it's a numeric ID, return as-is
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed.toLowerCase();
}

/**
 * Check if a project path matches a namespace
 *
 * Examples:
 * - "mygroup/project" matches namespace "mygroup"
 * - "mygroup/subgroup/project" matches namespace "mygroup"
 * - "mygroup/subgroup/project" matches namespace "mygroup/subgroup"
 * - "other/project" does NOT match namespace "mygroup"
 */
function isInNamespace(projectPath: string, namespace: string): boolean {
  const normalizedProject = normalizeProjectPath(projectPath);
  const normalizedNamespace = normalizeProjectPath(namespace);

  // Project must start with namespace followed by /
  return (
    normalizedProject === normalizedNamespace ||
    normalizedProject.startsWith(normalizedNamespace + "/")
  );
}

/**
 * Scope Enforcer class
 *
 * Enforces project/namespace restrictions defined in project config.
 * Use isAllowed() to check before operations, or enforce() to throw on violation.
 */
export class ScopeEnforcer {
  private readonly scope: ScopeConfig;
  private readonly allowedProjectsSet: Set<string>;

  constructor(scope: ScopeConfig) {
    this.scope = scope;
    this.allowedProjectsSet = new Set((scope.projects ?? []).map(p => normalizeProjectPath(p)));

    // Add single project to set if specified
    if (scope.project) {
      this.allowedProjectsSet.add(normalizeProjectPath(scope.project));
    }

    logger.debug(
      {
        scope: getScopeDescription(scope),
        allowedCount: this.allowedProjectsSet.size,
      },
      "ScopeEnforcer initialized"
    );
  }

  /**
   * Create a ScopeEnforcer from a ProjectPreset
   * Returns null if preset has no scope restrictions
   */
  static fromPreset(preset: ProjectPreset): ScopeEnforcer | null {
    if (!preset.scope) {
      return null;
    }
    return new ScopeEnforcer(preset.scope);
  }

  /**
   * Check if a project path is within the allowed scope
   *
   * @param projectPath Project path or ID to check (e.g., "group/project" or "123")
   * @returns true if allowed, false if outside scope
   */
  isAllowed(projectPath: string): boolean {
    const normalized = normalizeProjectPath(projectPath);

    // Check explicit project list (includes single project from scope.project if set)
    if (this.allowedProjectsSet.size > 0 && this.allowedProjectsSet.has(normalized)) {
      return true;
    }

    // Check namespace
    if (this.scope.namespace && isInNamespace(projectPath, this.scope.namespace)) {
      return true;
    }

    // Check if numeric ID is in allowed projects (can't validate without API call)
    // For security, we deny numeric IDs unless they're in the explicit list
    if (/^\d+$/.test(normalized)) {
      logger.warn(
        { projectId: normalized },
        "Numeric project ID not in allowed scope - denying access"
      );
      return false;
    }

    return false;
  }

  /**
   * Enforce scope restriction, throwing if violated
   *
   * @param projectPath Project path to check
   * @throws ScopeViolationError if outside allowed scope
   */
  enforce(projectPath: string): void {
    if (!this.isAllowed(projectPath)) {
      logger.warn(
        {
          attempted: projectPath,
          scope: getScopeDescription(this.scope),
        },
        "Scope violation attempted"
      );
      throw new ScopeViolationError(projectPath, this.scope);
    }
  }

  /**
   * Get the scope configuration
   */
  getScope(): ScopeConfig {
    return this.scope;
  }

  /**
   * Get scope description for display
   */
  getScopeDescription(): string {
    return getScopeDescription(this.scope);
  }

  /**
   * Check if scope has any restrictions
   */
  hasRestrictions(): boolean {
    const hasProject = Boolean(this.scope.project);
    const hasNamespace = Boolean(this.scope.namespace);
    const hasProjects = Boolean(this.scope.projects && this.scope.projects.length > 0);
    return hasProject || hasNamespace || hasProjects;
  }
}

/**
 * Extract project path from tool arguments
 *
 * Tools may specify project in different ways:
 * - project_id: "group/project" or "123"
 * - namespace: "group/project"
 * - projectId: "group/project"
 *
 * @param args Tool arguments object
 * @returns Array of project paths found in arguments
 */
export function extractProjectsFromArgs(args: Record<string, unknown>): string[] {
  const projects: string[] = [];

  // Common parameter names for project identification
  const projectFields = [
    "project_id",
    "projectId",
    "project",
    "namespace",
    "namespacePath",
    "fullPath",
  ];

  for (const field of projectFields) {
    const value = args[field];
    if (typeof value === "string" && value.trim()) {
      projects.push(value.trim());
    }
  }

  return projects;
}

/**
 * Enforce scope on tool arguments
 *
 * Checks all project-related fields in arguments against the scope.
 *
 * @param enforcer ScopeEnforcer instance
 * @param args Tool arguments
 * @throws ScopeViolationError if any project is outside scope
 */
export function enforceArgsScope(enforcer: ScopeEnforcer, args: Record<string, unknown>): void {
  const projects = extractProjectsFromArgs(args);

  for (const project of projects) {
    enforcer.enforce(project);
  }
}
