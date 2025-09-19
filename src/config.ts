import * as path from 'path';
import * as fs from 'fs';
// Get package.json path
const packageJsonPath = path.resolve(process.cwd(), 'package.json');

// Environment variables
export const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
export const GITLAB_AUTH_COOKIE_PATH = process.env.GITLAB_AUTH_COOKIE_PATH;
export const IS_OLD = process.env.GITLAB_IS_OLD === 'true';
export const GITLAB_READ_ONLY_MODE = process.env.GITLAB_READ_ONLY_MODE === 'true';
export const GITLAB_DENIED_TOOLS_REGEX = process.env.GITLAB_DENIED_TOOLS_REGEX
  ? new RegExp(process.env.GITLAB_DENIED_TOOLS_REGEX)
  : undefined;
export const USE_GITLAB_WIKI = process.env.USE_GITLAB_WIKI !== 'false';
export const USE_MILESTONE = process.env.USE_MILESTONE !== 'false';
export const USE_PIPELINE = process.env.USE_PIPELINE !== 'false';
export const USE_WORKITEMS = process.env.USE_WORKITEMS !== 'false';
export const USE_LABELS = process.env.USE_LABELS !== 'false';
export const USE_MRS = process.env.USE_MRS !== 'false';
export const USE_FILES = process.env.USE_FILES !== 'false';
export const USE_VARIABLES = process.env.USE_VARIABLES !== 'false';
export const HOST = process.env.HOST ?? '0.0.0.0';
export const PORT = process.env.PORT ?? 3002;

// Transport mode selection:
// - If PORT env var is present: HTTP mode with dual transport (SSE + StreamableHTTP)
// - If no PORT env var: stdio mode for direct MCP communication

// TLS/SSL configuration
export const SKIP_TLS_VERIFY = process.env.SKIP_TLS_VERIFY === 'true';

// Proxy configuration
export const HTTP_PROXY = process.env.HTTP_PROXY;
export const HTTPS_PROXY = process.env.HTTPS_PROXY;
export const NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
export const GITLAB_CA_CERT_PATH = process.env.GITLAB_CA_CERT_PATH;

// GitLab base URL configuration (without /api/v4)
function normalizeGitLabBaseUrl(url?: string): string {
  if (!url) {
    return 'https://gitlab.com';
  }

  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }

  // Remove /api/v4 if user accidentally added it
  if (url.endsWith('/api/v4')) {
    url = url.slice(0, -7);
  }

  return url;
}

export const GITLAB_BASE_URL = normalizeGitLabBaseUrl(process.env.GITLAB_API_URL ?? '');
export const GITLAB_API_URL = `${GITLAB_BASE_URL}/api/v4`;
export const GITLAB_PROJECT_ID = process.env.GITLAB_PROJECT_ID;
export const GITLAB_ALLOWED_PROJECT_IDS =
  process.env.GITLAB_ALLOWED_PROJECT_IDS?.split(',').map((id) => id.trim()) ?? [];

export function getEffectiveProjectId(projectId: string): string {
  if (GITLAB_PROJECT_ID) {
    return GITLAB_PROJECT_ID;
  }

  if (GITLAB_ALLOWED_PROJECT_IDS.length > 0) {
    if (!GITLAB_ALLOWED_PROJECT_IDS.includes(projectId)) {
      throw new Error(
        `Project ID ${projectId} is not allowed. Allowed project IDs: ${GITLAB_ALLOWED_PROJECT_IDS.join(', ')}`,
      );
    }
  }

  return projectId;
}

// Package info
let packageName = 'gitlab-mcp';
let packageVersion = 'unknown';

try {
  const packageInfo = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
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
  const prefix = 'GITLAB_TOOL_';

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
