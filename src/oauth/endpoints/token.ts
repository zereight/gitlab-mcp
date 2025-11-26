/**
 * OAuth Token Endpoint
 *
 * Handles token requests for:
 * - authorization_code: Exchange authorization code for tokens
 * - refresh_token: Refresh expired access tokens
 *
 * This endpoint issues MCP tokens (JWTs) to clients after successful
 * GitLab authentication.
 */

import { Request, Response } from "express";
import { loadOAuthConfig, OAuthConfig } from "../config";
import { sessionStore } from "../session-store";
import {
  verifyCodeChallenge,
  createJWT,
  generateRefreshToken,
  calculateTokenExpiry,
  isTokenExpiringSoon,
} from "../token-utils";
import { refreshGitLabToken } from "../gitlab-device-flow";
import { getBaseUrl } from "./metadata";
import { logger } from "../../logger";
import { MCPTokenResponse, OAuthErrorResponse, OAuthSession } from "../types";

/**
 * Token endpoint handler
 *
 * Handles POST /token requests for token operations.
 *
 * Supported grant types:
 * - authorization_code: Exchange code for tokens (requires code_verifier for PKCE)
 * - refresh_token: Refresh access token
 */
export async function tokenHandler(req: Request, res: Response): Promise<void> {
  const config = loadOAuthConfig();
  if (!config) {
    sendError(res, 500, "server_error", "OAuth not configured");
    return;
  }

  const { grant_type } = req.body as { grant_type?: string };

  switch (grant_type) {
    case "authorization_code":
      await handleAuthorizationCode(req, res, config);
      break;

    case "refresh_token":
      await handleRefreshToken(req, res, config);
      break;

    default:
      sendError(res, 400, "unsupported_grant_type", `Grant type "${grant_type}" is not supported`);
  }
}

/**
 * Handle authorization code grant
 *
 * Exchanges an authorization code for access and refresh tokens.
 * Requires PKCE code_verifier to match the original code_challenge.
 */
async function handleAuthorizationCode(
  req: Request,
  res: Response,
  config: OAuthConfig
): Promise<void> {
  const { code, code_verifier, redirect_uri } = req.body as {
    code?: string;
    code_verifier?: string;
    redirect_uri?: string;
  };

  // Validate required parameters
  if (!code) {
    sendError(res, 400, "invalid_request", "Missing authorization code");
    return;
  }

  if (!code_verifier) {
    sendError(res, 400, "invalid_request", "Missing code_verifier (PKCE required)");
    return;
  }

  // Look up authorization code
  const authCode = sessionStore.getAuthCode(code);
  if (!authCode) {
    sendError(res, 400, "invalid_grant", "Invalid or expired authorization code");
    return;
  }

  // Check if code has expired
  if (Date.now() > authCode.expiresAt) {
    sessionStore.deleteAuthCode(code);
    sendError(res, 400, "invalid_grant", "Authorization code has expired");
    return;
  }

  // Verify PKCE code challenge
  if (!verifyCodeChallenge(code_verifier, authCode.codeChallenge, authCode.codeChallengeMethod)) {
    sendError(res, 400, "invalid_grant", "Invalid code_verifier");
    return;
  }

  // Verify redirect_uri matches (if it was provided in authorization)
  if (authCode.redirectUri && redirect_uri !== authCode.redirectUri) {
    sendError(res, 400, "invalid_grant", "redirect_uri does not match");
    return;
  }

  // Get the session created during device flow
  const session = sessionStore.getSession(authCode.sessionId);
  if (!session) {
    sendError(res, 400, "invalid_grant", "Session not found");
    return;
  }

  // Generate MCP tokens
  const baseUrl = getBaseUrl(req);

  const accessToken = createJWT(
    {
      iss: baseUrl,
      sub: session.gitlabUserId.toString(),
      aud: authCode.clientId,
      sid: session.id,
      scope: session.scopes.join(" "),
      gitlab_user: session.gitlabUsername,
    },
    config.sessionSecret,
    config.tokenTtl
  );

  const refreshToken = generateRefreshToken();

  // Update session with MCP tokens
  sessionStore.updateSession(session.id, {
    mcpAccessToken: accessToken,
    mcpRefreshToken: refreshToken,
    mcpTokenExpiry: calculateTokenExpiry(config.tokenTtl),
  });

  // Delete authorization code (single use)
  sessionStore.deleteAuthCode(code);

  logger.info(
    {
      sessionId: session.id.substring(0, 8) + "...",
      userId: session.gitlabUserId,
    },
    "MCP tokens issued via authorization_code grant"
  );

  // Return token response
  const response: MCPTokenResponse = {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: config.tokenTtl,
    refresh_token: refreshToken,
    scope: session.scopes.join(" "),
  };

  res.json(response);
}

/**
 * Handle refresh token grant
 *
 * Issues new access and refresh tokens using a valid refresh token.
 * Also refreshes the underlying GitLab token if needed.
 */
async function handleRefreshToken(req: Request, res: Response, config: OAuthConfig): Promise<void> {
  const { refresh_token } = req.body as { refresh_token?: string };

  if (!refresh_token) {
    sendError(res, 400, "invalid_request", "Missing refresh_token");
    return;
  }

  // Find session by refresh token
  const session = sessionStore.getSessionByRefreshToken(refresh_token);
  if (!session) {
    sendError(res, 400, "invalid_grant", "Invalid refresh token");
    return;
  }

  // Refresh GitLab token if it's expiring soon (5 minute buffer)
  let updatedSession: OAuthSession = session;

  if (isTokenExpiringSoon(session.gitlabTokenExpiry)) {
    try {
      const newTokens = await refreshGitLabToken(session.gitlabRefreshToken, config);

      sessionStore.updateSession(session.id, {
        gitlabAccessToken: newTokens.access_token,
        gitlabRefreshToken: newTokens.refresh_token,
        gitlabTokenExpiry: calculateTokenExpiry(newTokens.expires_in),
      });

      // Get updated session
      const refreshedSession = sessionStore.getSession(session.id);
      if (!refreshedSession) {
        sendError(res, 400, "invalid_grant", "Session lost during refresh");
        return;
      }
      updatedSession = refreshedSession;

      logger.debug({ sessionId: session.id.substring(0, 8) + "..." }, "GitLab token refreshed");
    } catch (error: unknown) {
      logger.error({ err: error as Error }, "Failed to refresh GitLab token");
      sendError(res, 400, "invalid_grant", "Failed to refresh underlying GitLab token");
      return;
    }
  }

  // Generate new MCP tokens
  const baseUrl = getBaseUrl(req);

  const accessToken = createJWT(
    {
      iss: baseUrl,
      sub: updatedSession.gitlabUserId.toString(),
      aud: updatedSession.clientId,
      sid: updatedSession.id,
      scope: updatedSession.scopes.join(" "),
      gitlab_user: updatedSession.gitlabUsername,
    },
    config.sessionSecret,
    config.tokenTtl
  );

  const newRefreshToken = generateRefreshToken();

  // Update session with new MCP tokens
  sessionStore.updateSession(updatedSession.id, {
    mcpAccessToken: accessToken,
    mcpRefreshToken: newRefreshToken,
    mcpTokenExpiry: calculateTokenExpiry(config.tokenTtl),
  });

  logger.info(
    {
      sessionId: updatedSession.id.substring(0, 8) + "...",
      userId: updatedSession.gitlabUserId,
    },
    "MCP tokens refreshed via refresh_token grant"
  );

  // Return token response
  const response: MCPTokenResponse = {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: config.tokenTtl,
    refresh_token: newRefreshToken,
    scope: updatedSession.scopes.join(" "),
  };

  res.json(response);
}

/**
 * Send an OAuth error response
 */
function sendError(res: Response, status: number, error: string, description: string): void {
  const response: OAuthErrorResponse = {
    error,
    error_description: description,
  };
  res.status(status).json(response);
}
