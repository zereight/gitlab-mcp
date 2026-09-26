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
