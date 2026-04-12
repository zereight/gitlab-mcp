/**
 * Pure helper functions for OAuth 401 auto-retry logic.
 *
 * Extracted into a separate module so they can be unit-tested without
 * importing index.ts (which has heavy side effects: starts the MCP server,
 * reads env vars, etc.).
 */

import nodeFetch, { Headers } from "node-fetch";

/**
 * Convert various header representations to a plain Record<string, string>.
 */
export function headersToPlainObject(headers: unknown): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const obj: Record<string, string> = {};
    headers.forEach((value, key) => { obj[key] = value; });
    return obj;
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return headers as Record<string, string>;
}

/**
 * Detect request bodies that cannot be replayed (streams, FormData).
 */
export function isNonReplayableBody(body: unknown): boolean {
  if (!body) return false;
  // Stream-like objects (has .pipe or .read)
  if (typeof (body as any).pipe === "function" || typeof (body as any).read === "function") return true;
  // form-data instances (duck-type check since FormData is dynamically imported)
  if (typeof (body as any).getBuffer === "function" && typeof (body as any).getBoundary === "function") return true;
  return false;
}

export interface AuthRetryConfig {
  isOAuthEnabled: () => boolean;
  refreshToken: (force: boolean) => Promise<string>;
  onTokenRefreshed: (token: string) => void;
  buildAuthHeaders: () => Record<string, string>;
  logger?: { info: (...args: any[]) => void; error: (...args: any[]) => void };
}

/**
 * Wrap a fetch function with automatic OAuth token refresh on 401 responses.
 * On a 401, force-refreshes the OAuth token and retries the request once.
 * The retry calls baseFetch directly (not the wrapper), so infinite loops are impossible.
 * In non-OAuth mode, the wrapper is a transparent pass-through.
 *
 * When called without `config`, falls back to module globals in index.ts.
 * When called with `config` (tests), uses injected dependencies.
 */
export function wrapWithAuthRetry(
  baseFetch: typeof nodeFetch,
  config: AuthRetryConfig,
): typeof nodeFetch {
  let refreshLock: Promise<string> | null = null;
  const log = config.logger ?? { info: () => {}, error: () => {} };

  return (async (url: any, options?: any) => {
    const response = await baseFetch(url, options);

    if (response.status === 401 && config.isOAuthEnabled()) {
      // Skip retry for non-replayable bodies (streams, FormData) since the first request consumed them
      if (isNonReplayableBody(options?.body)) {
        log.info("Received 401 but request body is not replayable (stream/FormData), skipping retry.");
        return response;
      }

      log.info("Received 401, force-refreshing OAuth token and retrying...");
      try {
        // Mutex: coalesce concurrent refresh attempts into a single in-flight request
        if (!refreshLock) {
          refreshLock = config.refreshToken(true).finally(() => {
            refreshLock = null;
          });
        }
        const token = await refreshLock;
        config.onTokenRefreshed(token);

        const retryOptions = {
          ...options,
          headers: { ...headersToPlainObject(options?.headers), ...config.buildAuthHeaders() },
        };
        return await baseFetch(url, retryOptions);
      } catch (refreshError) {
        log.error("OAuth token refresh failed, returning original 401 response:", refreshError);
      }
    }

    return response;
  }) as typeof nodeFetch;
}
