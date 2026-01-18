/**
 * OAuth Callback Endpoint
 *
 * Handles the callback from GitLab after user authorization in Authorization Code Flow.
 * This endpoint receives the GitLab authorization code, exchanges it for tokens,
 * creates a session, and redirects back to the client with an MCP authorization code.
 *
 * Flow:
 * 1. User completes GitLab authorization
 * 2. GitLab redirects to /oauth/callback with code and state
 * 3. We exchange GitLab code for GitLab tokens
 * 4. We create a session with GitLab tokens
 * 5. We generate an MCP authorization code
 * 6. We redirect to client's redirect_uri with MCP code
 */

import { Request, Response } from "express";
import { loadOAuthConfig } from "../config";
import { sessionStore } from "../session-store";
import { exchangeGitLabAuthCode, getGitLabUser } from "../gitlab-device-flow";
import { generateSessionId, generateAuthorizationCode, calculateTokenExpiry } from "../token-utils";
import { logger } from "../../logger";

/**
 * OAuth callback handler
 *
 * Handles GET /oauth/callback from GitLab after user authorization.
 *
 * Query parameters (from GitLab):
 * - code: GitLab authorization code
 * - state: Internal state we sent to GitLab (maps to AuthCodeFlowState)
 *
 * On success, redirects to client's redirect_uri with:
 * - code: MCP authorization code (for /token exchange)
 * - state: Original client state (for CSRF verification)
 */
export async function callbackHandler(req: Request, res: Response): Promise<void> {
  const config = loadOAuthConfig();
  if (!config) {
    res.status(500).json({
      error: "server_error",
      error_description: "OAuth not configured",
    });
    return;
  }

  const { code, state, error, error_description } = req.query as Record<string, string | undefined>;

  // Handle GitLab error responses
  if (error) {
    logger.warn({ error, error_description }, "GitLab authorization error");
    // Redirect to client with error if we can find the flow state
    if (state) {
      const flow = sessionStore.getAuthCodeFlow(state);
      if (flow) {
        sessionStore.deleteAuthCodeFlow(state);
        const redirectUrl = new URL(flow.clientRedirectUri);
        redirectUrl.searchParams.set("error", error);
        if (error_description) {
          redirectUrl.searchParams.set("error_description", error_description);
        }
        if (flow.clientState) {
          redirectUrl.searchParams.set("state", flow.clientState);
        }
        res.redirect(redirectUrl.toString());
        return;
      }
    }
    res.status(400).json({
      error: error,
      error_description: error_description ?? "GitLab authorization failed",
    });
    return;
  }

  // Validate required parameters
  if (!code) {
    res.status(400).json({
      error: "invalid_request",
      error_description: "Missing authorization code from GitLab",
    });
    return;
  }

  if (!state) {
    res.status(400).json({
      error: "invalid_request",
      error_description: "Missing state parameter",
    });
    return;
  }

  // Look up the auth code flow state
  const flow = sessionStore.getAuthCodeFlow(state);
  if (!flow) {
    res.status(400).json({
      error: "invalid_request",
      error_description: "Invalid or expired state. Please start authorization again.",
    });
    return;
  }

  // Check if flow has expired
  if (Date.now() > flow.expiresAt) {
    sessionStore.deleteAuthCodeFlow(state);
    res.status(400).json({
      error: "invalid_request",
      error_description: "Authorization flow expired. Please start again.",
    });
    return;
  }

  try {
    // Exchange GitLab authorization code for tokens
    const gitlabTokens = await exchangeGitLabAuthCode(code, flow.callbackUri, config);

    // Get GitLab user info
    const userInfo = await getGitLabUser(gitlabTokens.access_token);

    // Create session
    const sessionId = generateSessionId();
    const now = Date.now();

    // Generate MCP authorization code for the client
    const mcpAuthCode = generateAuthorizationCode();

    // Store MCP authorization code (single-use, expires in 10 minutes)
    sessionStore.storeAuthCode({
      code: mcpAuthCode,
      sessionId,
      clientId: flow.clientId,
      codeChallenge: flow.codeChallenge,
      codeChallengeMethod: flow.codeChallengeMethod,
      redirectUri: flow.clientRedirectUri,
      expiresAt: now + 10 * 60 * 1000, // 10 minutes
    });

    // Create session with GitLab tokens
    // MCP tokens will be set when the authorization code is exchanged via /token
    sessionStore.createSession({
      id: sessionId,
      mcpAccessToken: "", // Set on /token
      mcpRefreshToken: "", // Set on /token
      mcpTokenExpiry: 0, // Set on /token
      gitlabAccessToken: gitlabTokens.access_token,
      gitlabRefreshToken: gitlabTokens.refresh_token,
      gitlabTokenExpiry: calculateTokenExpiry(gitlabTokens.expires_in),
      gitlabUserId: userInfo.id,
      gitlabUsername: userInfo.username,
      clientId: flow.clientId,
      scopes: ["mcp:tools", "mcp:resources"],
      createdAt: now,
      updatedAt: now,
    });

    // Clean up the auth code flow state
    sessionStore.deleteAuthCodeFlow(state);

    logger.info(
      {
        sessionId: sessionId.substring(0, 8) + "...",
        userId: userInfo.id,
        username: userInfo.username,
      },
      "Authorization Code Flow completed successfully"
    );

    // Redirect to client with MCP authorization code
    const redirectUrl = new URL(flow.clientRedirectUri);
    redirectUrl.searchParams.set("code", mcpAuthCode);
    if (flow.clientState) {
      redirectUrl.searchParams.set("state", flow.clientState);
    }

    logger.debug(
      { redirectUri: flow.clientRedirectUri },
      "Redirecting to client with authorization code"
    );

    res.redirect(redirectUrl.toString());
  } catch (error: unknown) {
    logger.error({ err: error as Error }, "Failed to complete authorization code flow");

    // Clean up the flow state on error
    sessionStore.deleteAuthCodeFlow(state);

    // Try to redirect to client with error
    const redirectUrl = new URL(flow.clientRedirectUri);
    redirectUrl.searchParams.set("error", "server_error");
    redirectUrl.searchParams.set(
      "error_description",
      error instanceof Error ? error.message : "Failed to complete authorization"
    );
    if (flow.clientState) {
      redirectUrl.searchParams.set("state", flow.clientState);
    }

    res.redirect(redirectUrl.toString());
  }
}
