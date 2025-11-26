/**
 * OAuth Authentication Middleware
 *
 * Validates Bearer tokens on MCP endpoints and sets up the token context
 * for per-request GitLab API access.
 *
 * This middleware:
 * 1. Extracts and validates the Bearer token from Authorization header
 * 2. Verifies the JWT signature and expiration
 * 3. Loads the associated session
 * 4. Refreshes GitLab token if needed
 * 5. Sets up token context for the request
 */

import { Request, Response, NextFunction } from "express";
import { loadOAuthConfig } from "../oauth/config";
import { sessionStore } from "../oauth/session-store";
import { verifyMCPToken, isTokenExpiringSoon, calculateTokenExpiry } from "../oauth/token-utils";
import { runWithTokenContext } from "../oauth/token-context";
import { refreshGitLabToken } from "../oauth/gitlab-device-flow";
import { logger } from "../logger";
import { OAuthErrorResponse } from "../oauth/types";

/**
 * OAuth authentication middleware for Express
 *
 * Apply this middleware to routes that require OAuth authentication.
 * It validates the Bearer token and sets up the token context.
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export async function oauthAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const config = loadOAuthConfig();
  if (!config) {
    sendUnauthorized(res, "server_error", "OAuth not configured");
    return;
  }

  // Extract Bearer token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    sendUnauthorized(res, "unauthorized", "Missing Authorization header");
    return;
  }

  if (!authHeader.startsWith("Bearer ")) {
    sendUnauthorized(
      res,
      "unauthorized",
      "Invalid Authorization header format. Expected: Bearer <token>"
    );
    return;
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  if (!token) {
    sendUnauthorized(res, "unauthorized", "Empty Bearer token");
    return;
  }

  // Verify JWT token
  const payload = verifyMCPToken(token, config.sessionSecret);
  if (!payload) {
    sendUnauthorized(res, "invalid_token", "Token is invalid or expired");
    return;
  }

  // Get session from token
  const sessionId = payload.sid;
  const session = sessionStore.getSession(sessionId);

  if (!session) {
    sendUnauthorized(res, "invalid_token", "Session not found or expired");
    return;
  }

  // Verify token matches session
  if (session.mcpAccessToken !== token) {
    // Token might have been rotated
    sendUnauthorized(res, "invalid_token", "Token has been superseded");
    return;
  }

  // Refresh GitLab token if it's expiring soon (5 minute buffer)
  if (isTokenExpiringSoon(session.gitlabTokenExpiry)) {
    try {
      const newTokens = await refreshGitLabToken(session.gitlabRefreshToken, config);

      sessionStore.updateSession(sessionId, {
        gitlabAccessToken: newTokens.access_token,
        gitlabRefreshToken: newTokens.refresh_token,
        gitlabTokenExpiry: calculateTokenExpiry(newTokens.expires_in),
      });

      logger.debug(
        { sessionId: sessionId.substring(0, 8) + "..." },
        "GitLab token refreshed during request"
      );
    } catch (error: unknown) {
      logger.error({ err: error as Error }, "Failed to refresh GitLab token during request");
      sendUnauthorized(
        res,
        "invalid_token",
        "GitLab token refresh failed. Please re-authenticate."
      );
      return;
    }
  }

  // Get potentially updated session
  const updatedSession = sessionStore.getSession(sessionId);
  if (!updatedSession) {
    sendUnauthorized(res, "invalid_token", "Session lost during token refresh");
    return;
  }

  // Set up token context and continue
  // All code in the request handler will have access to the GitLab token via getGitLabTokenFromContext()
  try {
    await runWithTokenContext(
      {
        gitlabToken: updatedSession.gitlabAccessToken,
        gitlabUserId: updatedSession.gitlabUserId,
        gitlabUsername: updatedSession.gitlabUsername,
        sessionId: updatedSession.id,
      },
      async () => {
        // Call next() inside the context so all downstream code has access to the token
        next();
      }
    );
  } catch (error: unknown) {
    logger.error({ err: error as Error }, "Error in OAuth-authenticated request");
    throw error;
  }
}

/**
 * Create OAuth middleware for specific routes
 *
 * Returns the middleware function configured for OAuth authentication.
 * Use this when you need to programmatically apply the middleware.
 */
export function createOAuthMiddleware(): typeof oauthAuthMiddleware {
  return oauthAuthMiddleware;
}

/**
 * Optional OAuth middleware
 *
 * Like oauthAuthMiddleware, but doesn't require authentication.
 * If a valid token is provided, sets up the context.
 * If no token or invalid token, continues without context.
 *
 * Useful for endpoints that work with or without authentication.
 */
export async function optionalOAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const config = loadOAuthConfig();
  if (!config) {
    // OAuth not configured, continue without context
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    // No token provided, continue without context
    next();
    return;
  }

  const token = authHeader.slice(7);
  if (!token) {
    next();
    return;
  }

  // Try to validate token
  const payload = verifyMCPToken(token, config.sessionSecret);
  if (!payload) {
    // Invalid token, but this is optional auth, so continue
    next();
    return;
  }

  const session = sessionStore.getSession(payload.sid);
  if (session?.mcpAccessToken !== token) {
    next();
    return;
  }

  // Valid token - set up context
  try {
    await runWithTokenContext(
      {
        gitlabToken: session.gitlabAccessToken,
        gitlabUserId: session.gitlabUserId,
        gitlabUsername: session.gitlabUsername,
        sessionId: session.id,
      },
      async () => {
        next();
      }
    );
  } catch (error: unknown) {
    logger.error({ err: error as Error }, "Error in optional OAuth request");
    throw error;
  }
}

/**
 * Send unauthorized response with OAuth error format
 */
function sendUnauthorized(res: Response, error: string, description: string): void {
  const response: OAuthErrorResponse = {
    error,
    error_description: description,
  };

  // Set WWW-Authenticate header as per OAuth spec
  res.setHeader("WWW-Authenticate", 'Bearer realm="gitlab-mcp"');
  res.status(401).json(response);
}
