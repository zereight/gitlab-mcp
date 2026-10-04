function shownEnvValue(rawValue: string): string {
  const singleLine = rawValue.replace(/[\r\n]/g, " ");
  if (singleLine.length <= 80) {
    return singleLine;
  }
  return `${singleLine.slice(0, 77)}...`;
}

function legacyToolsetWarning(envName: string, rawValue: string, toolset: string): string {
  if (rawValue === "true") {
    return (
      `${envName} is deprecated and will be removed in the next major version. ` +
      `Use GITLAB_TOOLSETS=${toolset} instead.`
    );
  }
  const shown = shownEnvValue(rawValue);
  return (
    `${envName} is set to "${shown}" and is deprecated. ` +
    `This value does not enable the ${toolset} toolset. Remove it. ` +
    `Set GITLAB_TOOLSETS=${toolset} only if you want those tools enabled.`
  );
}

export interface DeprecatedEnvInput {
  readOnlyMode: boolean;
  /** Value the user set for GITLAB_PERMISSION_MODE / --permission-mode, before GITLAB_READ_ONLY_MODE overrides it. */
  permissionModeRaw: string | undefined;
  allowedGroupsRaw: string | undefined;
  oauthAllowedGroupsRaw: string | undefined;
  useWikiRaw: string | undefined;
  useMilestoneRaw: string | undefined;
  usePipelineRaw: string | undefined;
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

  const legacyToolsetFlags: Array<[string | undefined, string, string]> = [
    [input.useWikiRaw, "USE_GITLAB_WIKI", "wiki"],
    [input.useMilestoneRaw, "USE_MILESTONE", "milestones"],
    [input.usePipelineRaw, "USE_PIPELINE", "pipelines"],
  ];
  for (const [rawValue, envName, toolset] of legacyToolsetFlags) {
    if (rawValue !== undefined) {
      warnings.push(legacyToolsetWarning(envName, rawValue, toolset));
    }
  }

  return warnings;
}
