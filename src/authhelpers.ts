import { config } from "./config.js";
import { CookieJar, parse as parseCookie } from "tough-cookie";
import fs from "fs";
import path from "path";

// Create cookie jar with clean Netscape file parsing
export const createCookieJar = (): CookieJar | undefined=> {
  if (!config.GITLAB_AUTH_COOKIE_PATH) return undefined;

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
    return undefined;
  }
};
