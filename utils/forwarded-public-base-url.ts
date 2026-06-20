import type { Request } from "express";

function getLastHeaderValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[value.length - 1] : value;
  if (!raw) return undefined;

  const parts = raw.split(",").map(part => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : undefined;
}

function unquoteHeaderValue(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return value;
}

export function getForwardedPublicBaseUrl(req: Request, trustProxy: boolean): string | undefined {
  if (!trustProxy) return undefined;

  const forwarded = getLastHeaderValue(req.headers.forwarded);
  const forwardedValues: Record<string, string> = {};

  if (forwarded) {
    for (const part of forwarded.split(";")) {
      const separator = part.indexOf("=");
      if (separator <= 0) continue;

      const key = part.slice(0, separator).trim().toLowerCase();
      const value = unquoteHeaderValue(part.slice(separator + 1).trim());
      if (key && value) forwardedValues[key] = value;
    }
  }

  const proto = (forwardedValues.proto || getLastHeaderValue(req.headers["x-forwarded-proto"]))?.toLowerCase();
  const host = forwardedValues.host || getLastHeaderValue(req.headers["x-forwarded-host"]);
  if (!proto || !host || !/^https?$/.test(proto)) return undefined;
  if (/[\s/\\]/.test(host)) return undefined;

  const prefix = getLastHeaderValue(req.headers["x-forwarded-prefix"]);
  const safePrefix =
    prefix &&
    prefix.startsWith("/") &&
    !prefix.startsWith("//") &&
    !prefix.includes("://") &&
    !/[\s\\]/.test(prefix)
      ? prefix.replace(/\/+$/, "")
      : undefined;

  try {
    const baseUrl = new URL(`${proto}://${host}`);
    if (baseUrl.username || baseUrl.password || baseUrl.pathname !== "/" || baseUrl.search || baseUrl.hash) {
      return undefined;
    }
    if (safePrefix) baseUrl.pathname = safePrefix;
    return baseUrl.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}
