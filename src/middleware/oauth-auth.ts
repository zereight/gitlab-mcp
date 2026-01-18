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
import { refreshGitLabToken } from "../oauth/gitlab-device-flow";
import { getBaseUrl } from "../oauth/endpoints/metadata";
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
    sendUnauthorized(req, res, "server_error", "OAuth not configured");
    return;
  }

  // Extract Bearer token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    sendUnauthorized(req, res, "unauthorized", "Missing Authorization header");
    return;
  }

  if (!authHeader.startsWith("Bearer ")) {
    sendUnauthorized(
      req,
      res,
      "unauthorized",
      "Invalid Authorization header format. Expected: Bearer <token>"
    );
    return;
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  if (!token) {
    sendUnauthorized(req, res, "unauthorized", "Empty Bearer token");
    return;
  }

  // Verify JWT token
  const payload = verifyMCPToken(token, config.sessionSecret);
  if (!payload) {
    sendUnauthorized(req, res, "invalid_token", "Token is invalid or expired");
    return;
  }

  // Get session from token
  const sessionId = payload.sid;
  const session = sessionStore.getSession(sessionId);

  if (!session) {
    sendUnauthorized(req, res, "invalid_token", "Session not found or expired");
    return;
  }

  // Verify token matches session
  if (session.mcpAccessToken !== token) {
    // Token might have been rotated
    sendUnauthorized(req, res, "invalid_token", "Token has been superseded");
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
        req,
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
    sendUnauthorized(req, res, "invalid_token", "Session lost during token refresh");
    return;
  }

  // Store OAuth session info in res.locals for route handlers
  // This is used by:
  // 1. Transport handlers to associate MCP sessions with OAuth sessions
  // 2. Route handlers to set up token context around transport.handleRequest()
  //
  // NOTE: We do NOT use runWithTokenContext here because middleware's next() chain
  // breaks AsyncLocalStorage propagation to MCP SDK's internal handlers.
  // Instead, route handlers must wrap transport.handleRequest() with runWithTokenContext()
  // using the data stored here.
  res.locals.oauthSessionId = updatedSession.id;
  res.locals.gitlabToken = updatedSession.gitlabAccessToken;
  res.locals.gitlabUserId = updatedSession.gitlabUserId;
  res.locals.gitlabUsername = updatedSession.gitlabUsername;

  logger.debug(
    { sessionId: updatedSession.id.substring(0, 8) + "...", method: req.method, path: req.path },
    "OAuth session validated, passing to route handler"
  );

  // Continue to route handler - token context will be set up there
  next();
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
 * If a valid token is provided, sets up res.locals with session info.
 * If no token or invalid token, continues without setting res.locals.
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

  // Valid token - store session info in res.locals for route handler
  res.locals.oauthSessionId = session.id;
  res.locals.gitlabToken = session.gitlabAccessToken;
  res.locals.gitlabUserId = session.gitlabUserId;
  res.locals.gitlabUsername = session.gitlabUsername;

  next();
}

/**
 * Send unauthorized response with OAuth error format
 *
 * Includes WWW-Authenticate header with resource parameter (RFC 9470)
 * to help clients discover the authorization server.
 */
function sendUnauthorized(req: Request, res: Response, error: string, description: string): void {
  const response: OAuthErrorResponse = {
    error,
    error_description: description,
  };

  // Get base URL for resource_metadata parameter (MCP OAuth 2.1 spec)
  const baseUrl = getBaseUrl(req);

  // Set WWW-Authenticate header with resource_metadata parameter
  // Points to Protected Resource Metadata document per MCP spec
  res.setHeader(
    "WWW-Authenticate",
    `Bearer realm="gitlab-mcp", resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`
  );
  res.status(401).json(response);
}
