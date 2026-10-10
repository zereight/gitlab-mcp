// Boolean flags accept `--flag`, `--flag=true`, or `--flag false`.
// They must not consume the following positional command
// (`--use-oauth mr list` is `mr`, not `list`).
export const BOOLEAN_CLI_FLAG_NAMES = new Set([
  "use-oauth",
  "is-old",
  "read-only",
  "masking-enabled",
  "use-wiki",
  "use-milestone",
  "use-pipeline",
  "disable-version-check",
  "sse",
  "streamable-http",
  "remote-auth",
  "mcp-oauth",
  "allow-unauthenticated-tool-discovery",
  "mcp-trust-proxy",
  "oauth-callback-proxy",
  "enable-dynamic-api-url",
  "enable-dynamic-project-scope",
  "enable-strict-project-scope",
  "oauth-stateless-mode",
  "compact-results",
]);

const BOOLEAN_FLAG_LITERALS = new Set(["true", "false", "1", "0"]);

export function isBooleanFlagLiteral(value: string | undefined): value is string {
  if (value === undefined || value.startsWith("-")) {
    return false;
  }
  return BOOLEAN_FLAG_LITERALS.has(value.toLowerCase());
}

export function nextBooleanFlagValue(nextToken: string | undefined): {
  readonly value: string;
  readonly consumeNext: boolean;
} {
  if (isBooleanFlagLiteral(nextToken)) {
    return { value: nextToken, consumeNext: true };
  }
  return { value: "true", consumeNext: false };
}

/** Same flag parse as startup config: CLI values only, positionals ignored. */
export function parseCliArgs(argv: readonly string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const eqIndex = arg.indexOf("=");
    if (eqIndex !== -1) {
      const key = arg.slice(2, eqIndex);
      const value = arg.slice(eqIndex + 1);
      if (value) {
        parsed[key] = value;
      }
      continue;
    }
    const key = arg.slice(2);
    if (BOOLEAN_CLI_FLAG_NAMES.has(key)) {
      const next = nextBooleanFlagValue(argv[index + 1]);
      parsed[key] = next.value;
      if (next.consumeNext) {
        index += 1;
      }
      continue;
    }
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      index += 1;
      parsed[key] = next;
    }
  }
  return parsed;
}
