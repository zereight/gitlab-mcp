/** Single source for the v3.0 migration pointer every removed-setting refusal prints. */
export const MIGRATION_GUIDE_URL =
  "https://github.com/zereight/gitlab-mcp/blob/main/docs/migration/v2-to-v3.md";
export const REMOVED_CONFIG_ISSUE_URL = "https://github.com/zereight/gitlab-mcp/issues/815";

interface RemovedConfig {
  readonly env: string;
  readonly cliFlag: string;
  readonly replacement: string;
  /** Flags that were on/off switches; any other value means "set". */
  readonly boolean: boolean;
  /** Extra guidance printed after the replacement. */
  readonly detail?: string;
}

/**
 * v2 exposed core only when GITLAB_TOOLSETS was unset or had no valid name, or when the
 * list named core. Adding core to any other list would expose tools v2 did not.
 */
function toolsetDetail(toolset: string, extra = ""): string {
  return (
    `Append ${toolset} to your existing toolset list (--toolsets when non-empty, otherwise GITLAB_TOOLSETS) and keep its other toolsets, without adding core. ` +
    `Use core,${toolset} only if that list was unset or had no valid toolset name (v2 then exposed core). ` +
    extra +
    "Leave exactly `all` unchanged. See the migration guide."
  );
}

const REMOVED_CONFIGS: readonly RemovedConfig[] = [
  {
    env: "GITLAB_READ_ONLY_MODE",
    cliFlag: "read-only",
    replacement: "GITLAB_PERMISSION_MODE=readonly (or --permission-mode=readonly)",
    boolean: true,
  },
  {
    env: "GITLAB_ALLOWED_GROUPS",
    cliFlag: "allowed-groups",
    replacement:
      "GITLAB_OAUTH_ALLOWED_GROUPS (or --oauth-allowed-groups; enforced only with GITLAB_MCP_OAUTH=true)",
    boolean: false,
  },
  {
    env: "USE_GITLAB_WIKI",
    cliFlag: "use-wiki",
    replacement: "wiki in GITLAB_TOOLSETS (or --toolsets)",
    boolean: true,
    detail: toolsetDetail("wiki"),
  },
  {
    env: "USE_MILESTONE",
    cliFlag: "use-milestone",
    replacement: "milestones in GITLAB_TOOLSETS (or --toolsets)",
    boolean: true,
    detail: toolsetDetail("milestones"),
  },
  {
    env: "USE_PIPELINE",
    cliFlag: "use-pipeline",
    replacement: "pipelines in GITLAB_TOOLSETS (or --toolsets)",
    boolean: true,
    detail: toolsetDetail(
      "pipelines",
      "If you use CI lint, also append validate_ci_lint,validate_project_ci_lint to your tool list (--tools when non-empty, otherwise GITLAB_TOOLS). "
    ),
  },
];

function isEnvSet(entry: RemovedConfig, env: NodeJS.ProcessEnv): boolean {
  const value = env[entry.env]?.trim();
  if (!value) return false;
  return entry.boolean ? value.toLowerCase() === "true" : true;
}

function isCliFlagSet(entry: RemovedConfig, argv: readonly string[]): boolean {
  const flag = `--${entry.cliFlag}`;
  return argv.some((arg, index) => {
    if (arg !== flag && !arg.startsWith(`${flag}=`)) return false;
    const inline = arg.startsWith(`${flag}=`) ? arg.slice(flag.length + 1) : null;
    if (!entry.boolean) return inline === null || inline !== "";
    const value = inline ?? argv[index + 1];
    return value?.toLowerCase() !== "false" && inline !== "";
  });
}

/**
 * Removed settings must fail loudly, never be ignored: silently dropping
 * GITLAB_READ_ONLY_MODE or GITLAB_ALLOWED_GROUPS would widen access.
 */
export function getRemovedConfigErrors(env: NodeJS.ProcessEnv, argv: readonly string[]): string[] {
  return REMOVED_CONFIGS.filter(entry => isEnvSet(entry, env) || isCliFlagSet(entry, argv)).map(
    entry =>
      `${entry.env} (--${entry.cliFlag}) was removed. Use ${entry.replacement} instead.` +
      (entry.detail ? ` ${entry.detail}` : "")
  );
}

export function assertNoRemovedConfig(env: NodeJS.ProcessEnv, argv: readonly string[]): void {
  const errors = getRemovedConfigErrors(env, argv);
  if (errors.length > 0) {
    throw new Error(
      [
        `Removed configuration detected:`,
        ...errors.map(error => `- ${error}`),
        `Migration guide: ${MIGRATION_GUIDE_URL}`,
        `Tracking issue: ${REMOVED_CONFIG_ISSUE_URL}`,
      ].join("\n")
    );
  }
}
