/**
 * Enhanced fetch utilities for GitLab MCP Server
 *
 * Node.js v24 compatible implementation using Undici's dispatcher pattern.
 * Supports:
 * - TLS verification bypass (SKIP_TLS_VERIFY)
 * - Custom CA certificates (GITLAB_CA_CERT_PATH)
 * - HTTP/HTTPS proxy support (HTTP_PROXY, HTTPS_PROXY)
 * - Cookie authentication (GITLAB_AUTH_COOKIE_PATH)
 * - OAuth per-request token context
 * - Configurable timeout handling
 */

import * as fs from "fs";
import { logger } from "../logger";
import {
  SKIP_TLS_VERIFY,
  GITLAB_AUTH_COOKIE_PATH,
  GITLAB_CA_CERT_PATH,
  HTTP_PROXY,
  HTTPS_PROXY,
  NODE_TLS_REJECT_UNAUTHORIZED,
  GITLAB_TOKEN,
  API_TIMEOUT_MS,
} from "../config";
import { isOAuthEnabled, getTokenContext } from "../oauth/index";

// Dynamic require to avoid TypeScript analyzing complex undici types at compile time
/* eslint-disable no-undef, no-unused-vars */
const undici = require("undici") as {
  Agent: new (opts?: Record<string, unknown>) => unknown;
  ProxyAgent: new (opts: string | Record<string, unknown>) => unknown;
};
/* eslint-enable no-undef, no-unused-vars */

/**
 * Cookie handling - parse cookies from file and format for HTTP Cookie header
 */
function loadCookieHeader(): string | null {
  if (!GITLAB_AUTH_COOKIE_PATH) {
    return null;
  }

  try {
    const cookieString = fs.readFileSync(GITLAB_AUTH_COOKIE_PATH, "utf-8");
    const cookies: string[] = [];

    cookieString.split("\n").forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const parts = trimmed.split("\t");
        if (parts.length >= 7) {
          const name = parts[5];
          const value = parts[6];
          cookies.push(`${name}=${value}`);
        }
      }
    });

    return cookies.length > 0 ? cookies.join("; ") : null;
  } catch (error: unknown) {
    logger.warn({ err: error }, "Failed to load GitLab authentication cookies");
    return null;
  }
}

/**
 * Load custom CA certificate
 */
function loadCACertificate(): Buffer | undefined {
  if (!GITLAB_CA_CERT_PATH) {
    return undefined;
  }

  try {
    const ca = fs.readFileSync(GITLAB_CA_CERT_PATH);
    logger.info(`Custom CA certificate loaded from ${GITLAB_CA_CERT_PATH}`);
    return ca;
  } catch (error: unknown) {
    logger.error({ err: error }, `Failed to load CA certificate from ${GITLAB_CA_CERT_PATH}`);
    return undefined;
  }
}

/**
 * Check if URL is a SOCKS proxy
 */
function isSocksProxy(url: string): boolean {
  return url.startsWith("socks4://") || url.startsWith("socks5://") || url.startsWith("socks://");
}

/**
 * Create Undici dispatcher for fetch requests
 */
function createDispatcher(): unknown {
  const proxyUrl = HTTPS_PROXY ?? HTTP_PROXY;

  // Build TLS options
  const tlsOptions: Record<string, unknown> = {};
  if (SKIP_TLS_VERIFY || NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    tlsOptions.rejectUnauthorized = false;
    if (SKIP_TLS_VERIFY) {
      logger.warn("TLS certificate verification disabled via SKIP_TLS_VERIFY");
    }
    if (NODE_TLS_REJECT_UNAUTHORIZED === "0") {
      logger.warn("TLS certificate verification disabled via NODE_TLS_REJECT_UNAUTHORIZED");
    }
  }

  const ca = loadCACertificate();
  if (ca) {
    tlsOptions.ca = ca;
  }

  const hasTlsConfig = Object.keys(tlsOptions).length > 0;

  // SOCKS proxy not supported with native fetch
  if (proxyUrl && isSocksProxy(proxyUrl)) {
    logger.info(`Using SOCKS proxy: ${proxyUrl}`);
    logger.warn("SOCKS proxy not supported with native fetch. Consider HTTP/HTTPS proxy.");
    return undefined;
  }

  // HTTP/HTTPS proxy
  if (proxyUrl) {
    logger.info(`Using proxy: ${proxyUrl}`);
    return new undici.ProxyAgent({
      uri: proxyUrl,
      requestTls: hasTlsConfig ? tlsOptions : undefined,
    });
  }

  // Custom TLS config without proxy
  if (hasTlsConfig) {
    return new undici.Agent({ connect: tlsOptions });
  }

  return undefined;
}

/** Cached dispatcher */
let cachedDispatcher: unknown;
let dispatcherInitialized = false;

function getDispatcher(): unknown {
  if (!dispatcherInitialized) {
    cachedDispatcher = createDispatcher();
    dispatcherInitialized = true;
  }
  return cachedDispatcher;
}

/**
 * Base HTTP headers
 */
export const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent": "GitLab MCP Server",
  "Content-Type": "application/json",
  Accept: "application/json",
};

function getGitLabToken(): string | undefined {
  if (isOAuthEnabled()) {
    const context = getTokenContext();
    return context?.gitlabToken;
  }
  return GITLAB_TOKEN;
}

export function getAuthorizationHeader(): string | undefined {
  const token = getGitLabToken();
  return token ? `Bearer ${token}` : undefined;
}

/** @deprecated Use enhancedFetch() directly */
export function createFetchOptions(): Record<string, unknown> {
  const dispatcher = getDispatcher();
  return dispatcher ? { dispatcher } : {};
}

/**
 * Enhanced fetch with GitLab support and Node.js v24 compatibility
 */
export async function enhancedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const dispatcher = getDispatcher();
  const cookieHeader = loadCookieHeader();

  const headers: Record<string, string> = { ...DEFAULT_HEADERS };

  const authHeader = getAuthorizationHeader();
  if (authHeader) {
    headers.Authorization = authHeader;
  }

  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      for (const [key, value] of options.headers) {
        headers[key] = value;
      }
    } else {
      Object.assign(headers, options.headers);
    }
  }

  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  const fetchOptions: Record<string, unknown> = {
    ...options,
    headers,
    signal: controller.signal,
  };

  if (dispatcher) {
    fetchOptions.dispatcher = dispatcher;
  }

  try {
    const response = await fetch(url, fetchOptions as RequestInit);
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`GitLab API timeout after ${API_TIMEOUT_MS}ms`);
    }
    throw error;
  }
}

export function resetDispatcherCache(): void {
  cachedDispatcher = undefined;
  dispatcherInitialized = false;
}
