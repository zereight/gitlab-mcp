import { config } from "./config.js";
import nodeFetch from "node-fetch";
import fetchCookie from "fetch-cookie";
import { CookieJar, parse as parseCookie } from "tough-cookie";
import { SocksProxyAgent } from "socks-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { HttpProxyAgent } from "http-proxy-agent";
import { Agent } from "http";
import { Agent as HttpsAgent } from "https";
import fs from "fs";
import path from "path";

let sslOptions = undefined;
if (config.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
  sslOptions = { rejectUnauthorized: false };
} else if (config.GITLAB_CA_CERT_PATH) {
  const ca = fs.readFileSync(config.GITLAB_CA_CERT_PATH);
  sslOptions = { ca };
}

// Configure proxy agents if proxies are set
let httpAgent: Agent | undefined = undefined;
let httpsAgent: Agent | undefined = undefined;

if (config.HTTP_PROXY) {
  if (config.HTTP_PROXY.startsWith("socks")) {
    httpAgent = new SocksProxyAgent(config.HTTP_PROXY);
  } else {
    httpAgent = new HttpProxyAgent(config.HTTP_PROXY);
  }
}
if (config.HTTPS_PROXY) {
  if (config.HTTPS_PROXY.startsWith("socks")) {
    httpsAgent = new SocksProxyAgent(config.HTTPS_PROXY);
  } else {
    httpsAgent = new HttpsProxyAgent(config.HTTPS_PROXY, sslOptions);
  }
}
httpsAgent = httpsAgent || new HttpsAgent(sslOptions);
httpAgent = httpAgent || new Agent();

// Create cookie jar with clean Netscape file parsing
const createCookieJar = (): CookieJar | null => {
  if (!config.GITLAB_AUTH_COOKIE_PATH) return null;

  try {
    const cookiePath = config.GITLAB_AUTH_COOKIE_PATH.startsWith("~/")
      ? path.join(process.env.HOME || "", config.GITLAB_AUTH_COOKIE_PATH.slice(2))
      : config.GITLAB_AUTH_COOKIE_PATH;

    const jar = new CookieJar();
    const cookieContent = fs.readFileSync(cookiePath, "utf8");

    cookieContent.split("\n").forEach(line => {
      // Handle #HttpOnly_ prefix
      if (line.startsWith("#HttpOnly_")) {
        line = line.slice(10);
      }
      // Skip comments and empty lines
      if (line.startsWith("#") || !line.trim()) {
        return;
      }

      // Parse Netscape format: domain, flag, path, secure, expires, name, value
      const parts = line.split("\t");
      if (parts.length >= 7) {
        const [domain, , path, secure, expires, name, value] = parts;

        // Build cookie string in standard format
        const cookieStr = `${name}=${value}; Domain=${domain}; Path=${path}${secure === "TRUE" ? "; Secure" : ""}${expires !== "0" ? `; Expires=${new Date(parseInt(expires) * 1000).toUTCString()}` : ""}`;

        // Use tough-cookie's parse function for robust parsing
        const cookie = parseCookie(cookieStr);
        if (cookie) {
          const url = `${secure === "TRUE" ? "https" : "http"}://${domain.startsWith(".") ? domain.slice(1) : domain}`;
          jar.setCookieSync(cookie, url);
        }
      }
    });

    return jar;
  } catch (error) {
    console.error("Error loading cookie file:", error);
    return null;
  }
};

// Initialize cookie jar and fetch
const cookieJar = createCookieJar();

// Ensure session is established for the current request
export async function ensureSessionForRequest(): Promise<void> {
  if (!cookieJar || !config.GITLAB_AUTH_COOKIE_PATH) return;

  // Extract the base URL from GITLAB_API_URL
  const apiUrl = new URL(config.GITLAB_API_URL);
  const baseUrl = `${apiUrl.protocol}//${apiUrl.hostname}`;

  // Check if we already have GitLab session cookies
  const gitlabCookies = cookieJar.getCookiesSync(baseUrl);
  const hasSessionCookie = gitlabCookies.some(cookie =>
    cookie.key === '_gitlab_session' || cookie.key === 'remember_user_token'
  );

  if (!hasSessionCookie) {
    try {
      // Establish session with a lightweight request
      await fetch(`${config.GITLAB_API_URL}/user`, {
        ...DEFAULT_FETCH_CONFIG,
        redirect: 'follow'
      }).catch(() => {
        // Ignore errors - the important thing is that cookies get set during redirects
      });

      // Small delay to ensure cookies are fully processed
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      // Ignore session establishment errors
    }
  }
}


export const fetch = cookieJar ? fetchCookie(nodeFetch, cookieJar) : nodeFetch;
// Modify DEFAULT_HEADERS to include agent configuration
export const DEFAULT_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

if (config.IS_OLD) {
  DEFAULT_HEADERS["Private-Token"] = `${config.GITLAB_PERSONAL_ACCESS_TOKEN}`;
} else {
  DEFAULT_HEADERS["Authorization"] = `Bearer ${config.GITLAB_PERSONAL_ACCESS_TOKEN}`;
}

export const DEFAULT_FETCH_CONFIG = {
  headers: DEFAULT_HEADERS,
  agent: (parsedUrl: URL) => {
    if (parsedUrl.protocol === "https:") {
      return httpsAgent;
    }
    return httpAgent;
  },
};

