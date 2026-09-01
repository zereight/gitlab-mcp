/**
 * Pure helper functions for OAuth 401 auto-retry logic.
 *
 * Extracted into a separate module so they can be unit-tested without
 * importing index.ts (which has heavy side effects: starts the MCP server,
 * reads env vars, etc.).
 */

import { fetch as undiciFetch, type RequestInit as UndiciRequestInit } from "undici";

export type FetchFn = typeof undiciFetch;

function isTupleArray(headers: unknown): headers is [string, string][] {
  if (!Array.isArray(headers)) return false;
  return headers.every(
    entry =>
      Array.isArray(entry) &&
      entry.length >= 2 &&
      typeof entry[0] === "string" &&
      typeof entry[1] === "string"
  );
}

function hasForEach(
  headers: object
): headers is { forEach: (callback: (value: string, key: string) => void) => void } {
  return "forEach" in headers && typeof headers.forEach === "function";
}

function isPlainStringHeaders(headers: object): headers is Record<string, string> {
  return Object.values(headers).every(value => typeof value === "string");
}

/**
 * Convert various header representations to a plain Record<string, string>.
 */
export function headersToPlainObject(headers: unknown): Record<string, string> {
  if (!headers || typeof headers !== "object") return {};
  if (isTupleArray(headers)) {
    return Object.fromEntries(headers);
  }
  if (hasForEach(headers)) {
    const obj: Record<string, string> = {};
    headers.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }
  if (isPlainStringHeaders(headers)) {
    return headers;
  }
  return {};
}

/**
 * Detect request bodies that cannot be replayed (streams).
 */
function hasCallableMethod(body: object, name: string): boolean {
  return name in body && typeof Reflect.get(body, name) === "function";
}

export function isNonReplayableBody(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  if (hasCallableMethod(body, "pipe")) return true;
  if (hasCallableMethod(body, "read")) return true;
  if (hasCallableMethod(body, "getReader")) return true;
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
 */
export function wrapWithAuthRetry(baseFetch: FetchFn, config: AuthRetryConfig): FetchFn {
  let refreshLock: Promise<string> | null = null;
  const log = config.logger ?? { info: () => {}, error: () => {} };

  const wrapped: FetchFn = async (url, options) => {
    const response = await baseFetch(url, options);

    if (response.status === 401 && config.isOAuthEnabled()) {
      if (isNonReplayableBody(options?.body)) {
        log.info(
          "Received 401 but request body is not replayable (stream/FormData), skipping retry."
        );
        return response;
      }

      log.info("Received 401, force-refreshing OAuth token and retrying...");
      try {
        if (!refreshLock) {
          refreshLock = config.refreshToken(true).finally(() => {
            refreshLock = null;
          });
        }
        const token = await refreshLock;
        config.onTokenRefreshed(token);

        const retryOptions: UndiciRequestInit = {
          ...options,
          headers: { ...headersToPlainObject(options?.headers), ...config.buildAuthHeaders() },
        };
        return await baseFetch(url, retryOptions);
      } catch (refreshError) {
        log.error("OAuth token refresh failed, returning original 401 response:", refreshError);
      }
    }

    return response;
  };

  return wrapped;
}
