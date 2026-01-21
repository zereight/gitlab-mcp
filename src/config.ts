import * as path from "path";
import * as fs from "fs";
// Get package.json path
const packageJsonPath = path.resolve(process.cwd(), "package.json");

// Environment variables
export const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
export const GITLAB_AUTH_COOKIE_PATH = process.env.GITLAB_AUTH_COOKIE_PATH;
export const IS_OLD = process.env.GITLAB_IS_OLD === "true";
export const GITLAB_READ_ONLY_MODE = process.env.GITLAB_READ_ONLY_MODE === "true";
export const GITLAB_DENIED_TOOLS_REGEX = process.env.GITLAB_DENIED_TOOLS_REGEX
  ? new RegExp(process.env.GITLAB_DENIED_TOOLS_REGEX)
  : undefined;

/**
 * Parse denied actions from environment variable
 * Format: "tool_name:action,tool_name:action,..."
 * Example: "manage_milestone:delete,manage_milestone:promote,browse_events:user"
 * @returns Map of tool name to Set of denied action names
 */
function parseDeniedActions(envValue?: string): Map<string, Set<string>> {
  const deniedActions = new Map<string, Set<string>>();

  if (!envValue) {
    return deniedActions;
  }

  const pairs = envValue
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  for (const pair of pairs) {
    const colonIndex = pair.indexOf(":");
    if (colonIndex === -1) {
      // Invalid format, skip
      continue;
    }

    const toolName = pair.substring(0, colonIndex).toLowerCase();
    const actionName = pair.substring(colonIndex + 1).toLowerCase();

    if (!toolName || !actionName) {
      continue;
    }

    let actionSet = deniedActions.get(toolName);
    if (!actionSet) {
      actionSet = new Set();
      deniedActions.set(toolName, actionSet);
    }
    actionSet.add(actionName);
  }

  return deniedActions;
}

export const GITLAB_DENIED_ACTIONS = parseDeniedActions(process.env.GITLAB_DENIED_ACTIONS);

// Schema mode configuration
// - 'flat' (default): Flatten discriminated unions for AI clients that don't support oneOf well
// - 'discriminated': Keep oneOf structure for clients that properly support JSON Schema
// - 'auto': Detect schema mode from clientInfo during MCP initialize
//   NOTE: 'auto' is only reliable for stdio mode (single client). For HTTP/SSE with multiple
//   concurrent sessions, use explicit 'flat' or 'discriminated' mode instead.
export type SchemaMode = "flat" | "discriminated" | "auto";

function parseSchemaMode(value?: string): SchemaMode {
  const mode = value?.toLowerCase();
  if (mode === "discriminated") {
    return "discriminated";
  }
  if (mode === "auto") {
    return "auto";
  }
  return "flat"; // Default - best compatibility with current AI clients
}

export const GITLAB_SCHEMA_MODE: SchemaMode = parseSchemaMode(process.env.GITLAB_SCHEMA_MODE);

/**
 * Detect effective schema mode based on clientInfo from MCP initialize
 * Called during initialize to determine per-session schema mode when GITLAB_SCHEMA_MODE=auto
 *
 * NOTE: This detection is only reliable for stdio mode (single client per server instance).
 * For HTTP/SSE modes with multiple concurrent sessions, use explicit GITLAB_SCHEMA_MODE instead.
 *
 * @param clientName - Client name from clientInfo (e.g., "claude-code", "mcp-inspector")
 * @returns Effective schema mode for this client
 */
export function detectSchemaMode(clientName?: string): "flat" | "discriminated" {
  const name = clientName?.toLowerCase() ?? "";

  // Known clients that need flat schemas (don't support oneOf well)
  // Use exact match or prefix to avoid false positives (e.g., "my-claude-wrapper")
  if (
    name === "claude" ||
    name.startsWith("claude-") ||
    name === "cursor" ||
    name.startsWith("cursor-")
  ) {
    return "flat";
  }

  // Known clients that support discriminated unions
  // Use same pattern as above: exact match or dash-prefix
  if (
    name === "inspector" ||
    name.startsWith("inspector-") ||
    name === "mcp-inspector" ||
    name.startsWith("mcp-inspector-")
  ) {
    return "discriminated";
  }

  // Safe default for unknown clients
  return "flat";
}

export const USE_GITLAB_WIKI = process.env.USE_GITLAB_WIKI !== "false";
export const USE_MILESTONE = process.env.USE_MILESTONE !== "false";
export const USE_PIPELINE = process.env.USE_PIPELINE !== "false";
export const USE_WORKITEMS = process.env.USE_WORKITEMS !== "false";
export const USE_LABELS = process.env.USE_LABELS !== "false";
export const USE_MRS = process.env.USE_MRS !== "false";
export const USE_FILES = process.env.USE_FILES !== "false";
export const USE_VARIABLES = process.env.USE_VARIABLES !== "false";
export const USE_SNIPPETS = process.env.USE_SNIPPETS !== "false";
export const USE_WEBHOOKS = process.env.USE_WEBHOOKS !== "false";
export const USE_INTEGRATIONS = process.env.USE_INTEGRATIONS !== "false";
export const USE_RELEASES = process.env.USE_RELEASES !== "false";
export const HOST = process.env.HOST ?? "0.0.0.0";
export const PORT = process.env.PORT ?? 3002;

// TLS/SSL configuration for direct HTTPS termination
export const SSL_CERT_PATH = process.env.SSL_CERT_PATH;
export const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
export const SSL_CA_PATH = process.env.SSL_CA_PATH;
export const SSL_PASSPHRASE = process.env.SSL_PASSPHRASE;

// Reverse proxy configuration
// Values: 'true', 'false', 'loopback', 'linklocal', 'uniquelocal', or specific IPs
export const TRUST_PROXY = process.env.TRUST_PROXY;

// API timeout configuration (in milliseconds)
export const API_TIMEOUT_MS = parseInt(process.env.GITLAB_API_TIMEOUT_MS ?? "20000", 10);

// Rate limiting configuration
// Per-IP rate limiting (for anonymous requests) - enabled by default
export const RATE_LIMIT_IP_ENABLED = process.env.RATE_LIMIT_IP_ENABLED !== "false";
export const RATE_LIMIT_IP_WINDOW_MS = parseInt(process.env.RATE_LIMIT_IP_WINDOW_MS ?? "60000", 10); // 1 minute
export const RATE_LIMIT_IP_MAX_REQUESTS = parseInt(
  process.env.RATE_LIMIT_IP_MAX_REQUESTS ?? "100",
  10
);

// Per-session rate limiting (for authenticated requests) - disabled by default
export const RATE_LIMIT_SESSION_ENABLED = process.env.RATE_LIMIT_SESSION_ENABLED === "true";
export const RATE_LIMIT_SESSION_WINDOW_MS = parseInt(
  process.env.RATE_LIMIT_SESSION_WINDOW_MS ?? "60000",
  10
);
export const RATE_LIMIT_SESSION_MAX_REQUESTS = parseInt(
  process.env.RATE_LIMIT_SESSION_MAX_REQUESTS ?? "300",
  10
);

// Transport mode selection:
// - If PORT env var is present: HTTP mode with dual transport (SSE + StreamableHTTP)
// - If no PORT env var: stdio mode for direct MCP communication

// TLS/SSL configuration
export const SKIP_TLS_VERIFY = process.env.SKIP_TLS_VERIFY === "true";

// Proxy configuration
export const HTTP_PROXY = process.env.HTTP_PROXY;
export const HTTPS_PROXY = process.env.HTTPS_PROXY;
export const NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
export const GITLAB_CA_CERT_PATH = process.env.GITLAB_CA_CERT_PATH;

// GitLab base URL configuration (without /api/v4)
function normalizeGitLabBaseUrl(url?: string): string {
  if (!url) {
    return "https://gitlab.com";
  }

  if (url.endsWith("/")) {
    url = url.slice(0, -1);
  }

  // Remove /api/v4 if user accidentally added it
  if (url.endsWith("/api/v4")) {
    url = url.slice(0, -7);
  }

  return url;
}

export const GITLAB_BASE_URL = normalizeGitLabBaseUrl(process.env.GITLAB_API_URL ?? "");
export const GITLAB_API_URL = `${GITLAB_BASE_URL}/api/v4`;
export const GITLAB_PROJECT_ID = process.env.GITLAB_PROJECT_ID;
export const GITLAB_ALLOWED_PROJECT_IDS =
  process.env.GITLAB_ALLOWED_PROJECT_IDS?.split(",").map(id => id.trim()) ?? [];

export function getEffectiveProjectId(projectId: string): string {
  if (GITLAB_PROJECT_ID) {
    return GITLAB_PROJECT_ID;
  }

  if (GITLAB_ALLOWED_PROJECT_IDS.length > 0) {
    if (!GITLAB_ALLOWED_PROJECT_IDS.includes(projectId)) {
      throw new Error(
        `Project ID ${projectId} is not allowed. Allowed project IDs: ${GITLAB_ALLOWED_PROJECT_IDS.join(", ")}`
      );
    }
  }

  return projectId;
}

// Package info
let packageName = "gitlab-mcp";
let packageVersion = "unknown";

try {
  const packageInfo = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
    name?: string;
    version?: string;
  };
  packageName = packageInfo.name ?? packageName;
  packageVersion = packageInfo.version ?? packageVersion;
} catch {
  // Ignore errors when reading package.json
}

export { packageName, packageVersion };

/**
 * Parse tool description overrides from environment variables
 * Environment variables should follow the pattern: GITLAB_TOOL_{TOOL_NAME}="Custom description"
 * @returns Map of tool name to custom description
 */
export function getToolDescriptionOverrides(): Map<string, string> {
  const overrides = new Map<string, string>();
  const prefix = "GITLAB_TOOL_";

  // Scan all environment variables for tool description overrides
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(prefix) && value) {
      // Extract tool name from environment variable
      // Convert from GITLAB_TOOL_LIST_PROJECTS to list_projects
      const toolName = key.substring(prefix.length).toLowerCase();

      overrides.set(toolName, value);
    }
  }

  return overrides;
}

/**
 * Parse action description overrides from environment variables
 * Environment variables should follow the pattern: GITLAB_ACTION_{TOOL}_{ACTION}="Custom description"
 * Example: GITLAB_ACTION_MANAGE_MILESTONE_DELETE="Remove a milestone permanently"
 * @returns Map of "tool:action" to custom description
 */
export function getActionDescriptionOverrides(): Map<string, string> {
  const overrides = new Map<string, string>();
  const prefix = "GITLAB_ACTION_";

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(prefix) && value) {
      // Extract tool and action from environment variable
      // GITLAB_ACTION_MANAGE_MILESTONE_DELETE -> manage_milestone:delete
      const rest = key.substring(prefix.length).toLowerCase();

      // Find the last underscore to split tool from action
      // This handles tool names with underscores (e.g., manage_milestone)
      const lastUnderscoreIndex = rest.lastIndexOf("_");
      if (lastUnderscoreIndex === -1) {
        continue;
      }

      const toolName = rest.substring(0, lastUnderscoreIndex);
      const actionName = rest.substring(lastUnderscoreIndex + 1);

      if (!toolName || !actionName) {
        continue;
      }

      overrides.set(`${toolName}:${actionName}`, value);
    }
  }

  return overrides;
}

/**
 * Parse parameter description overrides from environment variables
 * Environment variables should follow the pattern: GITLAB_PARAM_{TOOL}_{PARAM}="Custom description"
 * Example: GITLAB_PARAM_MANAGE_MILESTONE_TITLE="The milestone title (required for create)"
 * @returns Map of "tool:param" to custom description
 */
export function getParamDescriptionOverrides(): Map<string, string> {
  const overrides = new Map<string, string>();
  const prefix = "GITLAB_PARAM_";

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(prefix) && value) {
      // Extract tool and param from environment variable
      // GITLAB_PARAM_MANAGE_MILESTONE_TITLE -> manage_milestone:title
      const rest = key.substring(prefix.length).toLowerCase();

      // Find the last underscore to split tool from param
      const lastUnderscoreIndex = rest.lastIndexOf("_");
      if (lastUnderscoreIndex === -1) {
        continue;
      }

      const toolName = rest.substring(0, lastUnderscoreIndex);
      const paramName = rest.substring(lastUnderscoreIndex + 1);

      if (!toolName || !paramName) {
        continue;
      }

      overrides.set(`${toolName}:${paramName}`, value);
    }
  }

  return overrides;
}

/**
 * Check if a specific action is denied for a tool
 * @param toolName - The tool name (e.g., "manage_milestone")
 * @param actionName - The action name (e.g., "delete")
 * @returns true if the action is denied
 */
export function isActionDenied(toolName: string, actionName: string): boolean {
  const deniedActions = GITLAB_DENIED_ACTIONS.get(toolName.toLowerCase());
  if (!deniedActions) {
    return false;
  }
  return deniedActions.has(actionName.toLowerCase());
}

/**
 * Get allowed actions for a tool by filtering out denied actions
 * @param toolName - The tool name (e.g., "manage_milestone")
 * @param allActions - Array of all possible actions
 * @returns Array of allowed actions
 */
export function getAllowedActions(toolName: string, allActions: string[]): string[] {
  const deniedActions = GITLAB_DENIED_ACTIONS.get(toolName.toLowerCase());
  if (!deniedActions || deniedActions.size === 0) {
    return allActions;
  }
  return allActions.filter(action => !deniedActions.has(action.toLowerCase()));
}
