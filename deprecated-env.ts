function shownEnvValue(rawValue: string): string {
  const singleLine = rawValue.replace(/[\r\n]/g, " ");
  if (singleLine.length <= 80) {
    return singleLine;
  }
  return `${singleLine.slice(0, 77)}...`;
}

const REMOVAL_VERSION = "v3.0.0";
const DEPRECATION_NOTICE_URL = "https://github.com/zereight/gitlab-mcp/issues/815";

// USE_PIPELINE exposes these two tools, but they live in the `ci` toolset, not `pipelines`.
// Suggesting `ci` would also turn on catalog tools the flag does not expose.
const LEGACY_TOOLS_OUTSIDE_NAMED_TOOLSET: Readonly<Record<string, string>> = {
  pipelines: "validate_ci_lint,validate_project_ci_lint",
};

function explicitToolsets(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return undefined;
  }
  return trimmed;
}

function settingName(envName: string, cliFlag: string, fromCli: boolean): string {
  if (fromCli) {
    return `\`--${cliFlag}\` (${envName})`;
  }
  return envName;
}

function gitlabToolsAssignment(extraTools: string, toolsRaw: string | undefined): string {
  const existing = explicitToolsets(toolsRaw);
  if (existing === undefined) {
    return `GITLAB_TOOLS=${extraTools}`;
  }
  const names = existing
    .split(",")
    .map(part => part.trim())
    .filter(part => part.length > 0);
  const merged = extraTools.split(",").reduce<string[]>((current, tool) => {
    if (current.includes(tool)) {
      return current;
    }
    return [...current, tool];
  }, names);
  return `GITLAB_TOOLS=${merged.join(",")}`;
}

function legacyToolsetHint(
  toolset: string,
  toolsetsRaw: string | undefined,
  toolsRaw: string | undefined,
  optional: boolean
): string {
  const extraTools = LEGACY_TOOLS_OUTSIDE_NAMED_TOOLSET[toolset];
  const toolsAssignment =
    extraTools === undefined ? undefined : gitlabToolsAssignment(extraTools, toolsRaw);
  const listed = explicitToolsets(toolsetsRaw);
  if (listed !== undefined) {
    const extra = toolsAssignment === undefined ? "" : ` and set ${toolsAssignment}`;
    const shown = shownEnvValue(listed);
    if (optional) {
      return (
        `Add \`${toolset}\` to the existing GITLAB_TOOLSETS list ("${shown}")${extra} ` +
        "only if you want those tools"
      );
    }
    return `Add \`${toolset}\` to the existing GITLAB_TOOLSETS list ("${shown}")${extra} instead`;
  }

  // An explicit GITLAB_TOOLSETS list replaces the default toolsets; it does not merge.
  // Legacy USE_* flags add tools on top of defaults, so the hint must keep `core`
  // only when the user has not set GITLAB_TOOLSETS.
  const toolsets = `GITLAB_TOOLSETS=core,${toolset}`;
  const replacement =
    toolsAssignment === undefined ? toolsets : `${toolsets} and ${toolsAssignment}`;
  if (optional) {
    return `Set ${replacement} only if you want those tools in addition to core`;
  }
  return `Use ${replacement} instead`;
}

function legacyToolsetWarning(
  envName: string,
  cliFlag: string,
  fromCli: boolean,
  rawValue: string,
  toolset: string,
  toolsetsRaw: string | undefined,
  toolsRaw: string | undefined
): string {
  const name = settingName(envName, cliFlag, fromCli);
  if (rawValue === "true") {
    return (
      `${name} is deprecated and will be removed in ${REMOVAL_VERSION}. ` +
      `${legacyToolsetHint(toolset, toolsetsRaw, toolsRaw, false)}.`
    );
  }
  const shown = shownEnvValue(rawValue);
  return (
    `${name} is set to "${shown}" and is deprecated and will be removed in ${REMOVAL_VERSION}. ` +
    `This value does not enable the ${toolset} toolset. Remove it. ` +
    `${legacyToolsetHint(toolset, toolsetsRaw, toolsRaw, true)}.`
  );
}

export interface DeprecatedEnvInput {
  readOnlyMode: boolean;
  /** Raw `--read-only` / GITLAB_READ_ONLY_MODE value, including non-true values such as "false". */
  readOnlyRaw?: string;
  readOnlyFromCli?: boolean;
  /** Value the user set for GITLAB_PERMISSION_MODE / --permission-mode, before GITLAB_READ_ONLY_MODE overrides it. */
  permissionModeRaw: string | undefined;
  allowedGroupsRaw: string | undefined;
  allowedGroupsFromCli?: boolean;
  oauthAllowedGroupsRaw: string | undefined;
  useWikiRaw: string | undefined;
  useWikiFromCli?: boolean;
  useMilestoneRaw: string | undefined;
  useMilestoneFromCli?: boolean;
  usePipelineRaw: string | undefined;
  usePipelineFromCli?: boolean;
  /** Effective GITLAB_TOOLSETS / --toolsets value when the user set one. */
  toolsetsRaw?: string;
  /** Effective GITLAB_TOOLS / --tools value when the user set one. */
  toolsRaw?: string;
}

function readOnlyRawValue(input: DeprecatedEnvInput): string | undefined {
  if (input.readOnlyRaw !== undefined && input.readOnlyRaw !== "") {
    return input.readOnlyRaw;
  }
  if (input.readOnlyMode) {
    return "true";
  }
  return undefined;
}

function readOnlyWarning(input: DeprecatedEnvInput): string | undefined {
  const raw = readOnlyRawValue(input);
  if (raw === undefined) {
    return undefined;
  }
  const name = settingName("GITLAB_READ_ONLY_MODE", "read-only", input.readOnlyFromCli === true);
  if (raw === "true") {
    const conflict =
      input.permissionModeRaw !== undefined && input.permissionModeRaw !== "readonly"
        ? ` It OVERRIDES the configured permission mode "${input.permissionModeRaw}"; the server runs as "readonly".`
        : "";
    return (
      `${name} is deprecated and will be removed in ${REMOVAL_VERSION}. ` +
      `Use GITLAB_PERMISSION_MODE=readonly or --permission-mode=readonly instead.${conflict}`
    );
  }
  return (
    `${name} is set to "${shownEnvValue(raw)}" and is deprecated and will be removed in ${REMOVAL_VERSION}. ` +
    "This value does not enable legacy read-only mode. The effective permission mode comes from GITLAB_PERMISSION_MODE or --permission-mode. Remove it."
  );
}

/**
 * Builds startup warnings for deprecated env vars / CLI flags.
 * Pure function so the messages and conflict detection are unit-testable.
 */
export function getDeprecatedEnvWarnings(input: DeprecatedEnvInput): string[] {
  const warnings: string[] = [];
  const readOnly = readOnlyWarning(input);
  if (readOnly !== undefined) {
    warnings.push(readOnly);
  }

  if (input.allowedGroupsRaw) {
    const name = settingName(
      "GITLAB_ALLOWED_GROUPS",
      "allowed-groups",
      input.allowedGroupsFromCli === true
    );
    warnings.push(
      input.oauthAllowedGroupsRaw
        ? `${name} is deprecated and ignored because GITLAB_OAUTH_ALLOWED_GROUPS is set. Remove it. It will be removed in ${REMOVAL_VERSION}.`
        : `${name} is deprecated and will be removed in ${REMOVAL_VERSION}. Use GITLAB_OAUTH_ALLOWED_GROUPS instead.`
    );
  }

  const legacyToolsetFlags: ReadonlyArray<{
    readonly rawValue: string | undefined;
    readonly envName: string;
    readonly cliFlag: string;
    readonly fromCli: boolean;
    readonly toolset: string;
  }> = [
    {
      rawValue: input.useWikiRaw,
      envName: "USE_GITLAB_WIKI",
      cliFlag: "use-wiki",
      fromCli: input.useWikiFromCli === true,
      toolset: "wiki",
    },
    {
      rawValue: input.useMilestoneRaw,
      envName: "USE_MILESTONE",
      cliFlag: "use-milestone",
      fromCli: input.useMilestoneFromCli === true,
      toolset: "milestones",
    },
    {
      rawValue: input.usePipelineRaw,
      envName: "USE_PIPELINE",
      cliFlag: "use-pipeline",
      fromCli: input.usePipelineFromCli === true,
      toolset: "pipelines",
    },
  ];
  for (const flag of legacyToolsetFlags) {
    if (flag.rawValue !== undefined) {
      warnings.push(
        legacyToolsetWarning(
          flag.envName,
          flag.cliFlag,
          flag.fromCli,
          flag.rawValue,
          flag.toolset,
          input.toolsetsRaw,
          input.toolsRaw
        )
      );
    }
  }

  return warnings.map(warning => `${warning} See ${DEPRECATION_NOTICE_URL} for migration details.`);
}

function readSuppliedSetting(
  parsedArgs: Readonly<Record<string, string>>,
  env: NodeJS.ProcessEnv,
  cliKey: string,
  envKey: string
): string | undefined {
  return parsedArgs[cliKey] || env[envKey];
}

/**
 * Warning snapshot for one command. CLI flags in `parsedArgs` win over `env`,
 * matching getConfig, and neither source is read from the process globals.
 */
export function deprecatedEnvInputFromSources(
  parsedArgs: Readonly<Record<string, string>>,
  env: NodeJS.ProcessEnv
): DeprecatedEnvInput {
  const readOnlyRaw = readSuppliedSetting(parsedArgs, env, "read-only", "GITLAB_READ_ONLY_MODE");
  return {
    readOnlyMode: readOnlyRaw === "true",
    readOnlyRaw,
    readOnlyFromCli: Boolean(parsedArgs["read-only"]),
    permissionModeRaw: readSuppliedSetting(
      parsedArgs,
      env,
      "permission-mode",
      "GITLAB_PERMISSION_MODE"
    ),
    allowedGroupsRaw: readSuppliedSetting(
      parsedArgs,
      env,
      "allowed-groups",
      "GITLAB_ALLOWED_GROUPS"
    ),
    allowedGroupsFromCli: Boolean(parsedArgs["allowed-groups"]),
    oauthAllowedGroupsRaw: readSuppliedSetting(
      parsedArgs,
      env,
      "oauth-allowed-groups",
      "GITLAB_OAUTH_ALLOWED_GROUPS"
    ),
    useWikiRaw: readSuppliedSetting(parsedArgs, env, "use-wiki", "USE_GITLAB_WIKI"),
    useWikiFromCli: Boolean(parsedArgs["use-wiki"]),
    useMilestoneRaw: readSuppliedSetting(parsedArgs, env, "use-milestone", "USE_MILESTONE"),
    useMilestoneFromCli: Boolean(parsedArgs["use-milestone"]),
    usePipelineRaw: readSuppliedSetting(parsedArgs, env, "use-pipeline", "USE_PIPELINE"),
    usePipelineFromCli: Boolean(parsedArgs["use-pipeline"]),
    toolsetsRaw: readSuppliedSetting(parsedArgs, env, "toolsets", "GITLAB_TOOLSETS"),
    toolsRaw: readSuppliedSetting(parsedArgs, env, "tools", "GITLAB_TOOLS"),
  };
}
