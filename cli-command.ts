import { BOOLEAN_CLI_FLAG_NAMES, isBooleanFlagLiteral } from "./cli-boolean-flags.js";

const SCRIPT_PATH_PATTERN = /\.(cjs|mjs|js|cts|mts|ts)$/;
const FLAGS_WITHOUT_VALUE = new Set([
  "--help",
  "-h",
  "--yes",
  ...[...BOOLEAN_CLI_FLAG_NAMES].map(name => `--${name}`),
]);

function isScriptPath(arg: string): boolean {
  return SCRIPT_PATH_PATTERN.test(arg);
}

/**
 * Read the first positional CLI command (not a flag, not a script path).
 * `tsx index.ts auth` and `node build/index.js auth` both resolve to `auth`.
 * Space-separated option values such as `--api-url https://...` are skipped.
 * Flags such as --token stay on the MCP server path.
 */
export function getPositionalCliCommand(argv: readonly string[]): string | undefined {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--") && arg.includes("=")) {
      continue;
    }
    if (arg.startsWith("-")) {
      if (FLAGS_WITHOUT_VALUE.has(arg)) {
        if (BOOLEAN_CLI_FLAG_NAMES.has(arg.replace(/^--/, "")) && isBooleanFlagLiteral(args[i + 1])) {
          i += 1;
        }
        continue;
      }
      if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
        i += 1;
      }
      continue;
    }
    if (isScriptPath(arg)) {
      continue;
    }
    return arg;
  }
  return undefined;
}
