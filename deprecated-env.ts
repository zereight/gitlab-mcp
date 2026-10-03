export interface DeprecatedEnvInput {
  readOnlyMode: boolean;
  /** Raw (unvalidated-as-effective) value of GITLAB_PERMISSION_MODE / --permission-mode. */
  permissionModeRaw: string | undefined;
  allowedGroupsRaw: string | undefined;
  oauthAllowedGroupsRaw: string | undefined;
  useWiki: boolean;
  useMilestone: boolean;
  usePipeline: boolean;
}

/**
 * Builds startup warnings for deprecated env vars / CLI flags.
 * Pure function so the messages and conflict detection are unit-testable.
 */
export function getDeprecatedEnvWarnings(input: DeprecatedEnvInput): string[] {
  const warnings: string[] = [];

  if (input.readOnlyMode) {
    const conflict =
      input.permissionModeRaw !== undefined && input.permissionModeRaw !== "readonly"
        ? ` It OVERRIDES the configured permission mode "${input.permissionModeRaw}"; the server runs as "readonly".`
        : "";
    warnings.push(
      "GITLAB_READ_ONLY_MODE is deprecated and will be removed in the next major version. " +
        `Use GITLAB_PERMISSION_MODE=readonly or --permission-mode=readonly instead.${conflict}`
    );
  }

  if (input.allowedGroupsRaw) {
    warnings.push(
      input.oauthAllowedGroupsRaw
        ? "GITLAB_ALLOWED_GROUPS is deprecated and ignored because GITLAB_OAUTH_ALLOWED_GROUPS is set. Remove it."
        : "GITLAB_ALLOWED_GROUPS is deprecated and will be removed in the next major version. Use GITLAB_OAUTH_ALLOWED_GROUPS instead."
    );
  }

  const legacyToolsetFlags: Array<[boolean, string, string]> = [
    [input.useWiki, "USE_GITLAB_WIKI", "wiki"],
    [input.useMilestone, "USE_MILESTONE", "milestones"],
    [input.usePipeline, "USE_PIPELINE", "pipelines"],
  ];
  for (const [enabled, envName, toolset] of legacyToolsetFlags) {
    if (enabled) {
      warnings.push(
        `${envName} is deprecated and will be removed in the next major version. Use GITLAB_TOOLSETS=${toolset} instead.`
      );
    }
  }

  return warnings;
}
