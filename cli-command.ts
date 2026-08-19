const SCRIPT_PATH_PATTERN = /\.(cjs|mjs|js|cts|mts|ts)$/;

function isScriptPath(arg: string): boolean {
  return SCRIPT_PATH_PATTERN.test(arg);
}

/**
 * Read the first positional CLI command (not a flag, not a script path).
 * `tsx index.ts auth` and `node build/index.js auth` both resolve to `auth`.
 * Flags such as --token stay on the MCP server path.
 */
export function getPositionalCliCommand(argv: readonly string[]): string | undefined {
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("-") || isScriptPath(arg)) {
      continue;
    }
    return arg;
  }
  return undefined;
}
