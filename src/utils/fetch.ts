import * as https from "https";
import * as fs from "fs";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
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
        // Parse cookie line format: domain flag path secure expiration name value
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
 * Get proxy agent based on URL protocol
 */
function getProxyAgent():
  | HttpProxyAgent<string>
  | HttpsProxyAgent<string>
  | SocksProxyAgent
  | undefined {
  const proxyUrl = HTTPS_PROXY ?? HTTP_PROXY;
  if (!proxyUrl) {
    return undefined;
  }

  if (proxyUrl.startsWith("socks4://") || proxyUrl.startsWith("socks5://")) {
    return new SocksProxyAgent(proxyUrl);
  } else if (proxyUrl.startsWith("https://")) {
    return new HttpsProxyAgent(proxyUrl);
  } else {
    return new HttpProxyAgent(proxyUrl);
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
 * HTTP headers and configuration
 */
export const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent": "GitLab MCP Server",
  "Content-Type": "application/json",
  Accept: "application/json",
};

if (GITLAB_TOKEN) {
  DEFAULT_HEADERS.Authorization = `Bearer ${GITLAB_TOKEN}`;
}

/**
 * Create fetch options with all features: TLS, proxy, cookies, CA certs
 */
export function createFetchOptions(): RequestInit & {
  agent?: HttpProxyAgent<string> | HttpsProxyAgent<string> | SocksProxyAgent | https.Agent;
} {
  const options: RequestInit & {
    agent?: HttpProxyAgent<string> | HttpsProxyAgent<string> | SocksProxyAgent | https.Agent;
  } = {};

  // Proxy agent
  const proxyAgent = getProxyAgent();
  if (proxyAgent) {
    options.agent = proxyAgent;
    logger.info(`Using proxy: ${HTTPS_PROXY ?? HTTP_PROXY}`);
  }

  // TLS configuration
  if (SKIP_TLS_VERIFY || NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    const agent = new https.Agent({
      rejectUnauthorized: false,
    });
    options.agent = agent;

    if (SKIP_TLS_VERIFY) {
      logger.warn("TLS certificate verification disabled via SKIP_TLS_VERIFY");
    }
    if (NODE_TLS_REJECT_UNAUTHORIZED === "0") {
      logger.warn("TLS certificate verification disabled via NODE_TLS_REJECT_UNAUTHORIZED");
    }
  }

  // CA certificate
  const ca = loadCACertificate();
  if (ca) {
    if (!options.agent) {
      options.agent = new https.Agent({ ca });
    } else if (options.agent instanceof https.Agent) {
      options.agent.options.ca = ca;
    }
  }

  return options;
}

/**
 * Enhanced fetch function with full GitLab support:
 * - TLS verification bypass
 * - Cookie authentication
 * - Proxy support
 * - Custom CA certificates
 * - Configurable timeout handling
 */
export async function enhancedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const fetchOptions = createFetchOptions();
  const cookieHeader = loadCookieHeader();

  // Prepare headers
  const headers: Record<string, string> = {
    ...DEFAULT_HEADERS,
  };

  // Safely merge headers from options
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else {
      Object.assign(headers, options.headers);
    }
  }

  // Add cookies if available
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  // Create timeout controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, API_TIMEOUT_MS);

  // Merge all options with timeout signal
  const mergedOptions: RequestInit = {
    ...fetchOptions,
    ...options,
    headers,
    signal: controller.signal,
  };

  try {
    const response = await fetch(url, mergedOptions);
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
