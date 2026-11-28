import type { GitLabPermissionMode } from "../config.js";

/**
 * Inputs for the permission-mode gate. The mode and tool sets are injected by the caller
 * (index.ts builds one from GITLAB_PERMISSION_MODE, readOnlyTools, and deleteTools), so this
 * module never reads configuration itself.
 */
export interface PermissionModeConfig {
  readonly mode: GitLabPermissionMode;
  readonly readOnlyTools: ReadonlySet<string>;
  readonly deleteTools: ReadonlySet<string>;
}

// Permission mode gate: readonly exposes only read tools; modify blocks delete/teardown tools; full allows all
export function isToolAllowedByPermissionMode(
  config: PermissionModeConfig,
  toolName: string
): boolean {
  switch (config.mode) {
    case "readonly":
      return config.readOnlyTools.has(toolName);
    case "modify":
      return !config.deleteTools.has(toolName);
    default:
      return true;
  }
}

/** Single-argument view of the gate for callers that filter tool lists (selectExposedTools). */
export function createPermissionModeGate(
  config: PermissionModeConfig
): (toolName: string) => boolean {
  return toolName => isToolAllowedByPermissionMode(config, toolName);
}

/**
 * Dispatcher guard: throws for a tool the active mode does not allow.
 * Modes other than readonly/modify report the modify-mode text, matching the original guard.
 */
export function assertToolAllowedByPermissionMode(
  config: PermissionModeConfig,
  toolName: string
): void {
  if (!isToolAllowedByPermissionMode(config, toolName)) {
    throw new Error(
      config.mode === "readonly"
        ? `${toolName} is not allowed in read-only mode`
        : `${toolName} is not allowed in modify mode (delete and teardown operations are disabled)`
    );
  }
}
