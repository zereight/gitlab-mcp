/**
 * Per-request GitLab context shared by the tool handlers: the session auth store,
 * the auth headers, the effective API URL and project allowlist, and the fetch
 * config built from them.
 *
 * index.ts owns the values this module reads (the default API URL, the allowlist,
 * the client pool, the OAuth token, and the logger) and hands them over once with
 * configureGitLabRequestContext(). The getters are read at call time, as the free
 * variables they replace were.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { Logger } from "pino";
import type { Dispatcher } from "undici";
import {
  ENABLE_DYNAMIC_API_URL,
  ENABLE_DYNAMIC_PROJECT_SCOPE,
  GITLAB_JOB_TOKEN,
  GITLAB_MCP_OAUTH,
  GITLAB_PERSONAL_ACCESS_TOKEN,
  IS_OLD,
  REMOTE_AUTHORIZATION,
} from "../config.js";
import { redactUrlSecretsInText } from "../utils/redact-url.js";
import { redactSessionIdForLog } from "./request-helpers.js";

export interface GitLabRequestContextDeps {
  logger: Logger;
  /** First GITLAB_API_URL entry; used when no session API URL applies. */
  getDefaultApiUrl: () => string;
  /** GITLAB_ALLOWED_PROJECT_IDS; used when no session scope applies. */
  getDefaultAllowedProjectIds: () => string[];
  getDispatcherForUrl: (apiUrl: string) => Dispatcher;
  /** Token from GITLAB_USE_OAUTH, refreshed by index.ts before each tool call. */
  getOAuthAccessToken: () => string | null;
}

let deps: GitLabRequestContextDeps | undefined;

export function configureGitLabRequestContext(next: GitLabRequestContextDeps): void {
  deps = next;
}

function requireDeps(): GitLabRequestContextDeps {
  if (!deps) {
    throw new Error("GitLab request context used before configureGitLabRequestContext()");
  }
  return deps;
}

// Session auth context for remote authorization
export interface SessionAuth {
  sessionId: string;
  header: "Authorization" | "Private-Token" | "JOB-TOKEN";
  token: string;
  lastUsed: number;
  apiUrl: string; // The API URL for the current request
  publicBaseUrl?: string;
  allowedProjectIds?: string[]; // Session-narrowed project allowlist; undefined means env config
}

export interface AuthData {
  header: "Authorization" | "Private-Token" | "JOB-TOKEN";
  token: string;
  lastUsed: number;
  apiUrl: string;
  publicBaseUrl?: string;
  allowedProjectIds?: string[];
}

export const sessionAuthStore = new AsyncLocalStorage<SessionAuth>();

// Session context map for storing auth data by session ID
// This survives async boundaries where AsyncLocalStorage might not
export const authBySession: Record<string, AuthData> = {};

export function withPublicBaseUrl(
  authData: AuthData,
  publicBaseUrl?: string,
  previous?: AuthData
): AuthData {
  const effectivePublicBaseUrl = publicBaseUrl || previous?.publicBaseUrl;
  return effectivePublicBaseUrl ? { ...authData, publicBaseUrl: effectivePublicBaseUrl } : authData;
}

export function updateSessionPublicBaseUrl(
  sessionId: string | undefined,
  publicBaseUrl?: string
): void {
  if (sessionId && publicBaseUrl && authBySession[sessionId]) {
    authBySession[sessionId].publicBaseUrl = publicBaseUrl;
  }
}

// Base headers without authentication
export const BASE_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

/**
 * Build authentication headers dynamically based on context
 * In REMOTE_AUTHORIZATION or GITLAB_MCP_OAUTH mode, reads from AsyncLocalStorage session context
 * Otherwise, uses environment token (OAuth token is refreshed lazily before each tool call)
 */
export function buildAuthHeaders(): Record<string, string> {
  const { logger, getOAuthAccessToken } = requireDeps();
  if (REMOTE_AUTHORIZATION || GITLAB_MCP_OAUTH) {
    const ctx = sessionAuthStore.getStore();
    logger.debug(
      {
        sidPrefix: redactSessionIdForLog(ctx?.sessionId),
        header: ctx?.header,
        apiUrl: ctx?.apiUrl === undefined ? undefined : redactUrlSecretsInText(ctx.apiUrl),
      },
      "buildAuthHeaders: session context"
    );
    if (ctx?.token) {
      return {
        [ctx.header]: ctx.header === "Authorization" ? `Bearer ${ctx.token}` : ctx.token,
      };
    }
    return {}; // No auth headers if no session context
  }

  // Standard mode: PAT preferred over job token (broader permissions).
  // OAuth token takes priority over PAT when both are set.
  // NOTE: Changed in PR #400 — previously GITLAB_JOB_TOKEN had highest priority.
  // If both GITLAB_PERSONAL_ACCESS_TOKEN and GITLAB_JOB_TOKEN are set, PAT wins.
  // OAuth tokens always travel as `Authorization: Bearer`, even with GITLAB_IS_OLD: the HTTP
  // client strips `Authorization` on cross-origin redirects but not `Private-Token`.
  const oauthAccessToken = getOAuthAccessToken();
  if (oauthAccessToken) {
    return { Authorization: `Bearer ${oauthAccessToken}` };
  }

  if (GITLAB_PERSONAL_ACCESS_TOKEN) {
    return IS_OLD
      ? { "Private-Token": String(GITLAB_PERSONAL_ACCESS_TOKEN) }
      : { Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}` };
  }

  // Fall back to CI job token
  if (GITLAB_JOB_TOKEN) {
    return { "JOB-TOKEN": String(GITLAB_JOB_TOKEN) };
  }

  return {};
}

export function usesJobTokenHeader(): boolean {
  if (GITLAB_JOB_TOKEN) return true;
  if (REMOTE_AUTHORIZATION || GITLAB_MCP_OAUTH) {
    const ctx = sessionAuthStore.getStore();
    return ctx?.header === "JOB-TOKEN";
  }
  return false;
}

/**
 * Get the effective GitLab API URL for the current request
 * In REMOTE_AUTHORIZATION mode with ENABLE_DYNAMIC_API_URL, reads from session context
 * Otherwise, uses environment GITLAB_API_URL
 */
export function getEffectiveApiUrl(): string {
  const { logger, getDefaultApiUrl } = requireDeps();
  if (ENABLE_DYNAMIC_API_URL) {
    const ctx = sessionAuthStore.getStore();
    if (ctx?.apiUrl) {
      return ctx.apiUrl;
    }
    logger.warn(
      {
        sidPrefix: redactSessionIdForLog(ctx?.sessionId),
        header: ctx?.header,
        apiUrl: ctx?.apiUrl === undefined ? undefined : redactUrlSecretsInText(ctx.apiUrl),
      },
      "getEffectiveApiUrl: No context or apiUrl found, falling back to default"
    );
  }
  return getDefaultApiUrl();
}

/**
 * Get the effective project allowlist for the current request
 * In REMOTE_AUTHORIZATION mode with ENABLE_DYNAMIC_PROJECT_SCOPE, reads the scope
 * narrowed via the X-GitLab-Allowed-Project-Ids header from session context
 * (already validated against GITLAB_ALLOWED_PROJECT_IDS by parseAuthHeaders)
 * Otherwise, uses environment GITLAB_ALLOWED_PROJECT_IDS
 */
export function getEffectiveAllowedProjectIds(): string[] {
  const { getDefaultAllowedProjectIds } = requireDeps();
  if (ENABLE_DYNAMIC_PROJECT_SCOPE) {
    const ctx = sessionAuthStore.getStore();
    if (ctx?.allowedProjectIds && ctx.allowedProjectIds.length > 0) {
      return ctx.allowedProjectIds;
    }
  }
  return getDefaultAllowedProjectIds();
}

/**
 * Keep a dynamic project scope bound to its session
 * A request that omits X-GitLab-Allowed-Project-Ids keeps the session scope, and a
 * request naming a different scope is refused (null). An unscoped session may be
 * narrowed. Re-initialize to change the scope.
 */
export function bindSessionProjectScope(
  requested: string[] | undefined,
  sessionScope: string[] | undefined
): string[] | undefined | null {
  if (!sessionScope || sessionScope.length === 0) {
    return requested;
  }
  if (requested === undefined) {
    return sessionScope;
  }
  const want = new Set(requested);
  const have = new Set(sessionScope);
  return want.size === have.size && [...want].every(id => have.has(id)) ? sessionScope : null;
}

export const SESSION_PROJECT_SCOPE_MISMATCH = {
  error: "Project scope mismatch",
  message:
    "X-GitLab-Allowed-Project-Ids does not match the project scope of this session. Re-initialize to change it.",
};

/**
 * Constructs the fetch configuration dynamically.
 * This function is called immediately before each `fetch` to ensure it runs
 * within the correct AsyncLocalStorage context, capturing the necessary auth
 * and API URL information for the current request.
 * Uses connection pooling when dynamic API URLs are enabled.
 */
export const getFetchConfig = (): { headers: Record<string, string>; dispatcher: Dispatcher } => {
  const effectiveApiUrl = getEffectiveApiUrl();
  const dispatcher = requireDeps().getDispatcherForUrl(effectiveApiUrl);

  return {
    headers: { ...BASE_HEADERS, ...buildAuthHeaders() },
    dispatcher,
  };
};
