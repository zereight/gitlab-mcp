interface RemovedConfig {
  readonly env: string;
  readonly cliFlag: string;
  readonly replacement: string;
  /** Flags that were on/off switches; any other value means "set". */
  readonly boolean: boolean;
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
    replacement: "GITLAB_OAUTH_ALLOWED_GROUPS (or --oauth-allowed-groups)",
    boolean: false,
  },
  {
    env: "USE_GITLAB_WIKI",
    cliFlag: "use-wiki",
    replacement: "GITLAB_TOOLSETS=wiki (or --toolsets=wiki)",
    boolean: true,
  },
  {
    env: "USE_MILESTONE",
    cliFlag: "use-milestone",
    replacement: "GITLAB_TOOLSETS=milestones (or --toolsets=milestones)",
    boolean: true,
  },
  {
    env: "USE_PIPELINE",
    cliFlag: "use-pipeline",
    replacement: "GITLAB_TOOLSETS=pipelines (or --toolsets=pipelines)",
    boolean: true,
  },
];

function isEnvSet(entry: RemovedConfig, env: NodeJS.ProcessEnv): boolean {
  const value = env[entry.env]?.trim();
  if (!value) return false;
  return entry.boolean ? value.toLowerCase() === "true" : true;
}

function isCliFlagSet(entry: RemovedConfig, argv: readonly string[]): boolean {
  const flag = `--${entry.cliFlag}`;
  const index = argv.findIndex(arg => arg === flag || arg.startsWith(`${flag}=`));
  if (index === -1) return false;
  const inline = argv[index].startsWith(`${flag}=`) ? argv[index].slice(flag.length + 1) : null;
  if (!entry.boolean) return inline === null || inline !== "";
  const value = inline ?? argv[index + 1];
  return value?.toLowerCase() !== "false" && inline !== "";
}

/**
 * Removed settings must fail loudly, never be ignored: silently dropping
 * GITLAB_READ_ONLY_MODE or GITLAB_ALLOWED_GROUPS would widen access.
 */
export function getRemovedConfigErrors(env: NodeJS.ProcessEnv, argv: readonly string[]): string[] {
  return REMOVED_CONFIGS.filter(entry => isEnvSet(entry, env) || isCliFlagSet(entry, argv)).map(
    entry => `${entry.env} (--${entry.cliFlag}) was removed. Use ${entry.replacement} instead.`
  );
}

export function assertNoRemovedConfig(env: NodeJS.ProcessEnv, argv: readonly string[]): void {
  const errors = getRemovedConfigErrors(env, argv);
  if (errors.length > 0) {
    throw new Error(`Removed configuration detected:\n- ${errors.join("\n- ")}`);
  }
}
