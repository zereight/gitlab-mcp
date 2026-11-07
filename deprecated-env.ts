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

function isAllToolsets(raw: string): boolean {
  return raw.trim().toLowerCase() === "all";
}

function settingName(envName: string, cliFlag: string, fromCli: boolean): string {
  if (fromCli) {
    return `\`--${cliFlag}\` (${envName})`;
  }
  return envName;
}

function gitlabToolsAssignment(
  extraTools: string,
  toolsRaw: string | undefined,
  toolsFromCli: boolean
): string {
  const prefix = toolsFromCli ? "--tools=" : "GITLAB_TOOLS=";
  const existing = explicitToolsets(toolsRaw);
  if (existing === undefined) {
    return `${prefix}${extraTools}`;
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
  return `${prefix}${merged.join(",")}`;
}

function legacyToolsetHint(
  toolset: string,
  toolsetsRaw: string | undefined,
  toolsetsFromCli: boolean,
  toolsRaw: string | undefined,
  toolsFromCli: boolean,
  optional: boolean
): string {
  const extraTools = LEGACY_TOOLS_OUTSIDE_NAMED_TOOLSET[toolset];
  const toolsAssignment =
    extraTools === undefined
      ? undefined
      : gitlabToolsAssignment(extraTools, toolsRaw, toolsFromCli);
  const listed = explicitToolsets(toolsetsRaw);
  const toolsetsLabel = toolsetsFromCli && listed !== undefined ? "--toolsets" : "GITLAB_TOOLSETS";
  if (listed !== undefined) {
    const shown = shownEnvValue(listed);
    // parseEnabledToolsets treats only the exact value "all" as every toolset.
    // "all,pipelines" is not "all"; unknown token "all" is dropped and pipelines remains.
    if (isAllToolsets(listed)) {
      return `Keep the existing ${toolsetsLabel} value ("${shown}") and remove the deprecated setting`;
    }
    const extra = toolsAssignment === undefined ? "" : ` and set ${toolsAssignment}`;
    if (optional) {
      return (
        `Add \`${toolset}\` to the existing ${toolsetsLabel} list ("${shown}")${extra} ` +
        "only if you want those tools"
      );
    }
    return `Add \`${toolset}\` to the existing ${toolsetsLabel} list ("${shown}")${extra} instead`;
  }

  // An explicit toolset list replaces the default toolsets; it does not merge.
  // Legacy USE_* flags add tools on top of defaults, so the hint must keep `core`
  // only when the user has not set a toolset list.
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
  toolsetsFromCli: boolean,
  toolsRaw: string | undefined,
  toolsFromCli: boolean
): string {
  const name = settingName(envName, cliFlag, fromCli);
  if (rawValue === "true") {
    return (
      `${name} is deprecated and will be removed in ${REMOVAL_VERSION}. ` +
      `${legacyToolsetHint(toolset, toolsetsRaw, toolsetsFromCli, toolsRaw, toolsFromCli, false)}.`
    );
  }
  const shown = shownEnvValue(rawValue);
  return (
    `${name} is set to "${shown}" and is deprecated and will be removed in ${REMOVAL_VERSION}. ` +
    `This value does not enable the ${toolset} toolset. Remove it. ` +
    `${legacyToolsetHint(toolset, toolsetsRaw, toolsetsFromCli, toolsRaw, toolsFromCli, true)}.`
  );
}

export interface DeprecatedEnvInput {
  useWikiRaw: string | undefined;
  useWikiFromCli?: boolean;
  useMilestoneRaw: string | undefined;
  useMilestoneFromCli?: boolean;
  usePipelineRaw: string | undefined;
  usePipelineFromCli?: boolean;
  /** Effective GITLAB_TOOLSETS / --toolsets value when the user set one. */
  toolsetsRaw?: string;
  /** True when toolsetsRaw came from --toolsets, which wins over GITLAB_TOOLSETS. */
  toolsetsFromCli?: boolean;
  /** Effective GITLAB_TOOLS / --tools value when the user set one. */
  toolsRaw?: string;
  /** True when toolsRaw came from --tools, which wins over GITLAB_TOOLS. */
  toolsFromCli?: boolean;
}

/**
 * Builds startup warnings for deprecated env vars / CLI flags.
 * Pure function so the messages and conflict detection are unit-testable.
 */
export function getDeprecatedEnvWarnings(input: DeprecatedEnvInput): string[] {
  const warnings: string[] = [];

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
    // An empty value (e.g. `USE_PIPELINE=${USE_PIPELINE}` in docker-compose with the
    // variable unset) is not a configured flag.
    if (flag.rawValue !== undefined && flag.rawValue !== "") {
      warnings.push(
        legacyToolsetWarning(
          flag.envName,
          flag.cliFlag,
          flag.fromCli,
          flag.rawValue,
          flag.toolset,
          input.toolsetsRaw,
          input.toolsetsFromCli === true,
          input.toolsRaw,
          input.toolsFromCli === true
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
  return {
    useWikiRaw: readSuppliedSetting(parsedArgs, env, "use-wiki", "USE_GITLAB_WIKI"),
    useWikiFromCli: Boolean(parsedArgs["use-wiki"]),
    useMilestoneRaw: readSuppliedSetting(parsedArgs, env, "use-milestone", "USE_MILESTONE"),
    useMilestoneFromCli: Boolean(parsedArgs["use-milestone"]),
    usePipelineRaw: readSuppliedSetting(parsedArgs, env, "use-pipeline", "USE_PIPELINE"),
    usePipelineFromCli: Boolean(parsedArgs["use-pipeline"]),
    toolsetsRaw: readSuppliedSetting(parsedArgs, env, "toolsets", "GITLAB_TOOLSETS"),
    toolsetsFromCli: Boolean(parsedArgs["toolsets"]),
    toolsRaw: readSuppliedSetting(parsedArgs, env, "tools", "GITLAB_TOOLS"),
    toolsFromCli: Boolean(parsedArgs["tools"]),
  };
}
