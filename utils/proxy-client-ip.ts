/**
 * Normalize Express req.ip values from reverse proxies before rate limiting.
 *
 * Some proxies append the client port to X-Forwarded-For (e.g. "1.2.3.4:5678"
 * or "[2001:db8::1]:5678"). express-rate-limit rejects those unless stripped.
 */
export function normalizeProxyClientIpForRateLimit(ip: string): string {
  return ip
    .replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, "$1")
    .replace(/^\[([^\]]+)\](?::\d+)?$/, "$1");
}
