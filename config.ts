// Parse CLI arguments before anything else
const args = process.argv.slice(2);
export const cliArgs: Record<string, string> = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith("--")) {
    const [key, value] = arg.slice(2).split("=");
    if (value) {
      cliArgs[key] = value;
    } else if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
      cliArgs[key] = args[++i];
    }
  }
}

// Helper function to get config value (CLI args take precedence over env vars)
export function getConfig(cliKey: string, envKey: string): string | undefined;
export function getConfig(cliKey: string, envKey: string, defaultValue: string): string;
export function getConfig(
  cliKey: string,
  envKey: string,
  defaultValue?: string
): string | undefined {
  return cliArgs[cliKey] || process.env[envKey] || defaultValue;
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export const GITLAB_PERSONAL_ACCESS_TOKEN = getConfig("token", "GITLAB_PERSONAL_ACCESS_TOKEN");
export const GITLAB_JOB_TOKEN = getConfig("job-token", "GITLAB_JOB_TOKEN");
export const GITLAB_AUTH_COOKIE_PATH = getConfig("cookie-path", "GITLAB_AUTH_COOKIE_PATH");
export const USE_OAUTH = getConfig("use-oauth", "GITLAB_USE_OAUTH") === "true";
export const IS_OLD = getConfig("is-old", "GITLAB_IS_OLD") === "true";

// ---------------------------------------------------------------------------
// Behavior flags
// ---------------------------------------------------------------------------

export const GITLAB_READ_ONLY_MODE = getConfig("read-only", "GITLAB_READ_ONLY_MODE") === "true";
export const USE_GITLAB_WIKI = getConfig("use-wiki", "USE_GITLAB_WIKI") === "true";
export const USE_MILESTONE = getConfig("use-milestone", "USE_MILESTONE") === "true";
export const USE_PIPELINE = getConfig("use-pipeline", "USE_PIPELINE") === "true";

// ---------------------------------------------------------------------------
// Tool filtering
// ---------------------------------------------------------------------------

export const GITLAB_TOOLSETS_RAW = getConfig("toolsets", "GITLAB_TOOLSETS");
export const GITLAB_TOOLS_RAW = getConfig("tools", "GITLAB_TOOLS");

// Tool policy: comma-separated tool names
// approve = exposed but requires confirmation; hidden = not exposed at all
export const GITLAB_TOOL_POLICY_APPROVE_RAW = getConfig(
  "tool-policy-approve",
  "GITLAB_TOOL_POLICY_APPROVE"
);
export const GITLAB_TOOL_POLICY_HIDDEN_RAW = getConfig(
  "tool-policy-hidden",
  "GITLAB_TOOL_POLICY_HIDDEN"
);

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

export const SSE = getConfig("sse", "SSE") === "true";
export const STREAMABLE_HTTP = getConfig("streamable-http", "STREAMABLE_HTTP") === "true";
export const REMOTE_AUTHORIZATION = getConfig("remote-auth", "REMOTE_AUTHORIZATION") === "true";
export const GITLAB_MCP_OAUTH = getConfig("mcp-oauth", "GITLAB_MCP_OAUTH") === "true";

// ---------------------------------------------------------------------------
// OAuth / MCP OAuth
// ---------------------------------------------------------------------------

export const MCP_SERVER_URL = getConfig("mcp-server-url", "MCP_SERVER_URL");
export const GITLAB_OAUTH_APP_ID = getConfig("oauth-app-id", "GITLAB_OAUTH_APP_ID");
export const GITLAB_OAUTH_SCOPES_RAW = getConfig("oauth-scopes", "GITLAB_OAUTH_SCOPES");
export const GITLAB_OAUTH_SCOPES =
  GITLAB_OAUTH_SCOPES_RAW
    ? GITLAB_OAUTH_SCOPES_RAW.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
export const GITLAB_OAUTH_CALLBACK_PROXY =
  getConfig("oauth-callback-proxy", "GITLAB_OAUTH_CALLBACK_PROXY") === "true";
export const ENABLE_DYNAMIC_API_URL =
  getConfig("enable-dynamic-api-url", "ENABLE_DYNAMIC_API_URL") === "true";

// ---------------------------------------------------------------------------
// Stateless mode (multi-pod safe OAuth / session encoding)
// ---------------------------------------------------------------------------

/** Master switch — when true, opaque OAuth values carry the state instead of
 * an in-memory per-pod cache. Requires OAUTH_STATELESS_SECRET. */
export const OAUTH_STATELESS_MODE =
  getConfig("oauth-stateless-mode", "OAUTH_STATELESS_MODE") === "true";

/**
 * Per-surface TTLs (seconds). Defaults apply when the env var is unset.
 *
 * Both the parsed raw value AND the fallback are validated as finite
 * positive integers. Without the fallback guard, a caller that computes
 * its fallback from another (unvalidated) env var could smuggle `NaN`
 * through here — e.g. `parseInt(SESSION_TIMEOUT_SECONDS, 10)` returns
 * NaN when the operator sets `SESSION_TIMEOUT_SECONDS=not-a-number`.
 * That NaN would silently disable TTL checks downstream (see `checkIat`
 * in stateless/codec.ts: `ttlSec > 0` is false for NaN), breaking the
 * documented inactivity timeout for sealed sids and OAuth proxy values.
 *
 * `safeFallback` picks the supplied fallback only when it is itself a
 * valid positive integer; otherwise a hardcoded secondary default is
 * used (the same constant each caller passes for its "first-choice"
 * default). This keeps misconfigurations loud-and-safe instead of
 * silent-and-unbounded.
 */
function _intEnv(
  name: string,
  cliKey: string,
  fallback: number,
  safeFallback: number = fallback
): number {
  const safe =
    Number.isFinite(fallback) && fallback > 0 ? fallback : safeFallback;
  const raw = getConfig(cliKey, name);
  if (!raw) return safe;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : safe;
}

export const OAUTH_STATELESS_CLIENT_TTL_SECONDS = _intEnv(
  "OAUTH_STATELESS_CLIENT_TTL_SECONDS",
  "oauth-stateless-client-ttl",
  86_400
);
export const OAUTH_STATELESS_PENDING_TTL_SECONDS = _intEnv(
  "OAUTH_STATELESS_PENDING_TTL_SECONDS",
  "oauth-stateless-pending-ttl",
  600
);
export const OAUTH_STATELESS_STORED_TTL_SECONDS = _intEnv(
  "OAUTH_STATELESS_STORED_TTL_SECONDS",
  "oauth-stateless-stored-ttl",
  600
);

// ---------------------------------------------------------------------------
// Session / server settings
// ---------------------------------------------------------------------------

/** Default inactivity window for in-memory session state (seconds). */
const _SESSION_TIMEOUT_DEFAULT = 3600;

/**
 * Sanitized session timeout. Invalid values (non-numeric, zero, negative,
 * NaN) fall back to _SESSION_TIMEOUT_DEFAULT so downstream consumers —
 * notably the stateless codec's TTL check — always see a finite positive
 * number. A silent NaN here would disable the inactivity timeout for
 * sealed Mcp-Session-Id values.
 */
export const SESSION_TIMEOUT_SECONDS = _intEnv(
  "SESSION_TIMEOUT_SECONDS",
  "session-timeout",
  _SESSION_TIMEOUT_DEFAULT
);

/**
 * Defaults to SESSION_TIMEOUT_SECONDS when unset. Both the direct env/CLI
 * value and the fallback are validated inside _intEnv, so a broken
 * SESSION_TIMEOUT_SECONDS cannot poison this value. Declared in the
 * session-settings section so the SESSION_TIMEOUT_SECONDS reference is
 * guaranteed to be initialized; logically it belongs to the stateless
 * mode above.
 */
export const OAUTH_STATELESS_SESSION_TTL_SECONDS = _intEnv(
  "OAUTH_STATELESS_SESSION_TTL_SECONDS",
  "oauth-stateless-session-ttl",
  SESSION_TIMEOUT_SECONDS,
  _SESSION_TIMEOUT_DEFAULT
);

export const HOST = getConfig("host", "HOST") || "127.0.0.1";

/** Default HTTP port for the MCP server. */
const _PORT_DEFAULT = 3002;
export const PORT = _intEnv("PORT", "port", _PORT_DEFAULT);

// ---------------------------------------------------------------------------
// Proxy configuration
// ---------------------------------------------------------------------------

export const HTTP_PROXY = getConfig("http-proxy", "HTTP_PROXY");
export const HTTPS_PROXY = getConfig("https-proxy", "HTTPS_PROXY");
export const NO_PROXY = getConfig("no-proxy", "NO_PROXY");
export const NODE_TLS_REJECT_UNAUTHORIZED = getConfig(
  "tls-reject-unauthorized",
  "NODE_TLS_REJECT_UNAUTHORIZED"
);
export const GITLAB_CA_CERT_PATH = getConfig("ca-cert-path", "GITLAB_CA_CERT_PATH");
const _poolMaxSizeRaw = getConfig("pool-max-size", "GITLAB_POOL_MAX_SIZE");
export const GITLAB_POOL_MAX_SIZE = _poolMaxSizeRaw ? Number.parseInt(_poolMaxSizeRaw, 10) : 100;
