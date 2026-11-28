/**
 * Session and token state for the GitLab connection: the shared fetch (the cookie jar
 * wrapped in the auth retry), the OAuth access token and client, and the cookie warmup
 * that runs before a request.
 *
 * index.ts owns the logger. It hands it over once with configureSessionStore(), which also
 * builds the initial fetch. `fetch` and getOAuthAccessToken() are read at call time, because
 * the cookie reload replaces `fetch`.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import fetchCookie from "fetch-cookie";
import type { Logger } from "pino";
import { CookieJar, parse as parseCookie } from "tough-cookie";
import { fetch as undiciFetch } from "undici";
import { GITLAB_AUTH_COOKIE_PATH, USE_OAUTH } from "../config.js";
import { wrapWithAuthRetry, type FetchFn } from "../auth-retry.js";
import { ensureOAuthToken, type GitLabOAuth } from "../oauth.js";
import {
  buildAuthHeaders,
  getEffectiveApiUrl,
  getFetchConfig,
} from "../server/gitlab-request-context.js";

export interface SessionStoreDeps {
  logger: Logger;
}

// Set by configureSessionStore() before any request reads it.
let logger!: Logger;

// Set by configureSessionStore(), then replaced by the cookie reload. Exported as a live
// binding: importers read the current value at call time.
export let fetch: FetchFn;

// Loaded from the OAuth token state; set by index.ts at startup (setOAuthClient).
let OAUTH_ACCESS_TOKEN: string | null = null;
let oauthClient: GitLabOAuth | null = null;

export function getOAuthAccessToken(): string | null {
  return OAUTH_ACCESS_TOKEN;
}

export function setOAuthClient(client: GitLabOAuth | null): void {
  oauthClient = client;
}

/**
 * Ensure the OAuth token is valid before making an API call.
 * Refreshes the token lazily (only when a tool is actually called).
 * This avoids background timers that cause issues with multiple instances.
 */
export async function ensureValidOAuthToken(): Promise<void> {
  try {
    await ensureOAuthToken(oauthClient, OAUTH_ACCESS_TOKEN, token => {
      OAUTH_ACCESS_TOKEN = token;
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to refresh OAuth token");
    throw error;
  }
}

// Create cookie jar with clean Netscape file parsing
// Resolve cookie path once using os.homedir() for cross-platform support
const resolvedCookiePath = GITLAB_AUTH_COOKIE_PATH
  ? GITLAB_AUTH_COOKIE_PATH.startsWith("~/")
    ? path.join(os.homedir(), GITLAB_AUTH_COOKIE_PATH.slice(2))
    : GITLAB_AUTH_COOKIE_PATH
  : null;

const createCookieJar = async (): Promise<CookieJar | null> => {
  if (!resolvedCookiePath) return null;

  let cookieContent: string;
  try {
    cookieContent = await fs.promises.readFile(resolvedCookiePath, "utf8");
  } catch (error) {
    logger.error({ error, path: resolvedCookiePath }, "Failed to read cookie file");
    return null;
  }

  const jar = new CookieJar();
  for (let line of cookieContent.split("\n")) {
    // Handle #HttpOnly_ prefix
    if (line.startsWith("#HttpOnly_")) {
      line = line.slice(10);
    }
    // Skip comments and empty lines
    if (line.startsWith("#") || !line.trim()) {
      continue;
    }

    // Parse Netscape format: domain, flag, path, secure, expires, name, value
    const parts = line.split("\t");
    if (parts.length >= 7) {
      const [domain, , cookiePath, secure, expires, name, value] = parts;

      // Build cookie string in standard format
      const secureFlag = secure === "TRUE" ? "; Secure" : "";
      const expiresFlag =
        expires === "0"
          ? ""
          : `; Expires=${new Date(Number.parseInt(expires, 10) * 1000).toUTCString()}`;
      const cookieStr = `${name}=${value}; Domain=${domain}; Path=${cookiePath}${secureFlag}${expiresFlag}`;

      // Use tough-cookie's parse function for robust parsing
      const cookie = parseCookie(cookieStr);
      if (cookie) {
        const url = `${secure === "TRUE" ? "https" : "http"}://${domain.startsWith(".") ? domain.slice(1) : domain}`;
        jar.setCookieSync(cookie, url);
      }
    }
  }

  return jar;
};

/** Build AuthRetryConfig from module globals (lazy — reads globals at call time). */
function defaultAuthRetryConfig() {
  return {
    isOAuthEnabled: () => USE_OAUTH && oauthClient != null,
    refreshToken: (force: boolean) => oauthClient!.getAccessToken(force),
    onTokenRefreshed: (token: string) => {
      OAUTH_ACCESS_TOKEN = token;
    },
    buildAuthHeaders,
    logger,
  };
}

/**
 * Hands over the logger, then builds the initial fetch (the auth retry wrapper, no cookie jar).
 * Call once at startup, before the first request.
 */
export function configureSessionStore(next: SessionStoreDeps): void {
  logger = next.logger;
  fetch = wrapWithAuthRetry(undiciFetch, defaultAuthRetryConfig());
}

// Cookie jar and fetch - reloaded when cookie file changes
let cookieJar: CookieJar | null = null;
let lastCookieMtime = 0;
let cookieReloadLock: Promise<void> | null = null; // Mutex to prevent parallel reloads
// Auth proxies may redirect and set cookies on the first request. We make a throwaway
// request so subsequent requests have the correct cookies. Reset when cookies reload.
let initialSessionRequestMade = false;

// Cookie jar is loaded on first request via reloadCookiesIfChanged (lastCookieMtime=0 triggers load)

async function reloadCookiesIfChanged(): Promise<void> {
  if (!resolvedCookiePath) return;
  if (cookieReloadLock) return cookieReloadLock;

  cookieReloadLock = (async () => {
    try {
      const mtime = (await fs.promises.stat(resolvedCookiePath)).mtimeMs;
      if (mtime !== lastCookieMtime) {
        logger.info(
          { oldMtime: lastCookieMtime, newMtime: mtime },
          lastCookieMtime === 0 ? "Loading cookie file" : "Cookie file changed, reloading"
        );
        lastCookieMtime = mtime;
        const newJar = await createCookieJar();
        cookieJar = newJar;
        fetch = wrapWithAuthRetry(
          newJar ? fetchCookie(undiciFetch, newJar) : undiciFetch,
          defaultAuthRetryConfig()
        );
        initialSessionRequestMade = false;
      }
    } catch {
      // File deleted or inaccessible - clear cached cookies
      if (cookieJar) {
        logger.info("Cookie file removed, clearing cached cookies");
        cookieJar = null;
        fetch = wrapWithAuthRetry(undiciFetch, defaultAuthRetryConfig());
        lastCookieMtime = 0;
        initialSessionRequestMade = false;
      }
    }
  })();

  try {
    await cookieReloadLock;
  } finally {
    cookieReloadLock = null;
  }
}

export async function ensureSessionForRequest(): Promise<void> {
  if (!resolvedCookiePath) return;

  await reloadCookiesIfChanged();

  if (!cookieJar || initialSessionRequestMade) return;

  try {
    const response = await fetch(`${getEffectiveApiUrl()}/user`, {
      ...getFetchConfig(),
      redirect: "follow",
    });
    // 401 means auth failed but the request completed - cookies were still exchanged
    // 403 means insufficient scope (e.g. missing User: Read) but auth is valid
    initialSessionRequestMade = response.ok || response.status === 401 || response.status === 403;
  } catch {
    logger.debug("Session warmup request failed, will retry on next request");
  }
}
