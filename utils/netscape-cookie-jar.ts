import { isIP } from "node:net";
import { type CookieJar, parse as parseCookie } from "tough-cookie";

export interface CookieJarWarnLogger {
  warn: (obj: Record<string, unknown>, msg: string) => void;
}

/**
 * True when a Netscape cookie domain is an IPv4 or IPv6 address.
 * Accepts a leading `.` and IPv6 with or without wrapping brackets.
 */
export function isIpCookieDomain(domain: string): boolean {
  let host = domain.startsWith(".") ? domain.slice(1) : domain;
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }
  return isIP(host) !== 0;
}

/**
 * Load Netscape cookie file content into `jar`.
 *
 * Each cookie is set with `Domain=<domain>`. tough-cookie throws on an IPv4
 * domain, which stops the load, and stores an IPv6 domain without ever
 * returning it. A warning with the cookie name and domain (never the value)
 * is logged before such a cookie is passed to the jar.
 */
export function loadNetscapeCookies(
  content: string,
  jar: CookieJar,
  log: CookieJarWarnLogger
): void {
  for (let line of content.split("\n")) {
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
        if (isIpCookieDomain(domain)) {
          log.warn(
            { cookieName: name, domain },
            "Cookie file entry uses an IP address as its domain, so this cookie will not be used. An IPv4 domain makes the cookie file fail to load; an IPv6 domain is stored but never sent. Use a hostname instead."
          );
        }
        jar.setCookieSync(cookie, url);
      }
    }
  }
}
