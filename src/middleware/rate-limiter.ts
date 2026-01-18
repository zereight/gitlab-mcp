/**
 * Rate Limiting Middleware
 *
 * Protects the MCP server from excessive anonymous requests.
 * Authenticated users are NOT rate limited to avoid impacting legitimate usage.
 *
 * Design principles:
 * - Per-IP rate limiting for anonymous requests (enabled by default)
 * - Authenticated users skip rate limiting (they've proven who they are)
 * - Standard rate limit headers (X-RateLimit-*)
 */

import { Request, Response, NextFunction, RequestHandler } from "express";
import {
  RATE_LIMIT_IP_ENABLED,
  RATE_LIMIT_IP_WINDOW_MS,
  RATE_LIMIT_IP_MAX_REQUESTS,
  RATE_LIMIT_SESSION_ENABLED,
  RATE_LIMIT_SESSION_WINDOW_MS,
  RATE_LIMIT_SESSION_MAX_REQUESTS,
} from "../config";
import { logger } from "../logger";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory storage for rate limit tracking
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval (run every minute)
const CLEANUP_INTERVAL_MS = 60000;
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the cleanup interval for expired entries
 */
function startCleanup(): void {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt <= now) {
        rateLimitStore.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Rate limiter cleanup: removed ${cleaned} expired entries`);
    }
  }, CLEANUP_INTERVAL_MS);

  // Don't prevent process exit
  cleanupInterval.unref();
}

/**
 * Stop the cleanup interval
 */
export function stopCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Get the IP address from a request
 */
function getIpAddress(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

/**
 * Check if request is authenticated (has valid session)
 */
function isAuthenticated(req: Request, res: Response): boolean {
  // Check for OAuth session ID set by auth middleware
  const oauthSessionId = res.locals.oauthSessionId as string | undefined;
  if (oauthSessionId) {
    return true;
  }

  // Check for MCP session ID header (indicates active session)
  const mcpSessionId = req.headers["mcp-session-id"] as string | undefined;
  if (mcpSessionId) {
    return true;
  }

  return false;
}

/**
 * Check and update rate limit for a key
 */
function checkRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number
): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  total: number;
} {
  const now = Date.now();
  let entry = rateLimitStore.get(key);

  // Create or reset entry if expired
  if (!entry || entry.resetAt <= now) {
    entry = {
      count: 0,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(key, entry);
  }

  // Check if limit exceeded
  const allowed = entry.count < maxRequests;

  // Increment count if allowed
  if (allowed) {
    entry.count++;
  }

  return {
    allowed,
    remaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.resetAt,
    total: maxRequests,
  };
}

/**
 * Set rate limit headers on response
 */
function setRateLimitHeaders(
  res: Response,
  info: { remaining: number; resetAt: number; total: number }
): void {
  res.set("X-RateLimit-Limit", info.total.toString());
  res.set("X-RateLimit-Remaining", info.remaining.toString());
  res.set("X-RateLimit-Reset", Math.ceil(info.resetAt / 1000).toString());
}

/**
 * Express middleware for rate limiting
 *
 * Behavior:
 * - Authenticated requests: NOT rate limited (trusted users)
 * - Anonymous requests: Rate limited by IP address
 *
 * When rate limit is exceeded, returns HTTP 429 with:
 * - Retry-After header
 * - JSON error body with details
 * - Standard rate limit headers
 */
export function rateLimiterMiddleware(): RequestHandler {
  // Start cleanup on first use
  startCleanup();

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip health check endpoint (monitoring should always work)
    if (req.path === "/health") {
      next();
      return;
    }

    // Check if user is authenticated
    const authenticated = isAuthenticated(req, res);

    // Authenticated users skip rate limiting by default
    // (they've proven who they are and shouldn't suffer security measures)
    if (authenticated) {
      // Only apply session rate limit if explicitly enabled
      if (!RATE_LIMIT_SESSION_ENABLED) {
        next();
        return;
      }

      // Apply per-session rate limiting (optional)
      const sessionId =
        (res.locals.oauthSessionId as string) || (req.headers["mcp-session-id"] as string);
      const key = `session:${sessionId}`;
      const info = checkRateLimit(
        key,
        RATE_LIMIT_SESSION_WINDOW_MS,
        RATE_LIMIT_SESSION_MAX_REQUESTS
      );

      setRateLimitHeaders(res, info);

      if (!info.allowed) {
        const retryAfter = Math.ceil((info.resetAt - Date.now()) / 1000);
        logger.warn(`Session rate limit exceeded for ${sessionId}`);

        res.set("Retry-After", retryAfter.toString());
        res.status(429).json({
          error: "Too Many Requests",
          message: "Session rate limit exceeded. Please slow down your requests.",
          retryAfter,
          limit: info.total,
          remaining: info.remaining,
          resetAt: new Date(info.resetAt).toISOString(),
        });
        return;
      }

      next();
      return;
    }

    // Anonymous request - apply IP-based rate limiting
    if (!RATE_LIMIT_IP_ENABLED) {
      next();
      return;
    }

    const ip = getIpAddress(req);
    const key = `ip:${ip}`;
    const info = checkRateLimit(key, RATE_LIMIT_IP_WINDOW_MS, RATE_LIMIT_IP_MAX_REQUESTS);

    setRateLimitHeaders(res, info);

    if (!info.allowed) {
      const retryAfter = Math.ceil((info.resetAt - Date.now()) / 1000);
      logger.warn(`IP rate limit exceeded for ${ip}`);

      res.set("Retry-After", retryAfter.toString());
      res.status(429).json({
        error: "Too Many Requests",
        message: "Rate limit exceeded. Please authenticate or slow down your requests.",
        retryAfter,
        limit: info.total,
        remaining: info.remaining,
        resetAt: new Date(info.resetAt).toISOString(),
      });
      return;
    }

    next();
  };
}

/**
 * Get current rate limit stats (for debugging/monitoring)
 */
export function getRateLimitStats(): {
  totalEntries: number;
  entries: Array<{ key: string; count: number; resetAt: Date }>;
} {
  const entries = Array.from(rateLimitStore.entries()).map(([key, entry]) => ({
    key,
    count: entry.count,
    resetAt: new Date(entry.resetAt),
  }));

  return {
    totalEntries: rateLimitStore.size,
    entries,
  };
}
