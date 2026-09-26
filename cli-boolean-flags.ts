// Boolean flags accept `--flag` or `--flag=true`. They must not consume the
// following positional command (`--use-oauth mr list` is `mr`, not `list`).
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
