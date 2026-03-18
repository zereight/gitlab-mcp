/**
 * GitLab OAuth Proxy for MCP OAuth
 *
 * Implements an OAuthServerProvider that acts as an OAuth proxy between
 * MCP clients (e.g. Claude.ai) and a GitLab instance.
 *
 * Why not native GitLab DCR?
 * GitLab restricts dynamically registered applications to the `mcp` scope,
 * which is insufficient for API calls. This proxy uses a pre-registered
 * GitLab OAuth application with the necessary scopes (api, read_api, read_user),
 * while handling Dynamic Client Registration (DCR) locally. Each MCP client
 * receives a unique virtual client_id that maps to the real GitLab application.
 */

import { Response } from "express";
import type {
  OAuthServerProvider,
  AuthorizationParams,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { randomUUID } from "node:crypto";
import { pino } from "pino";

const logger = pino({
  name: "gitlab-mcp-oauth-proxy",
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      levelFirst: true,
      destination: 2,
    },
  },
});

// Bounded LRU client cache – stores up to 1,000 registered virtual clients

const MAX_CLIENTS = 1_000;

class LRUClientCache implements OAuthRegisteredClientsStore {
  private clients = new Map<string, OAuthClientInformationFull>();

  getClient(clientId: string): OAuthClientInformationFull | undefined {
    const client = this.clients.get(clientId);
    if (client) {
      // Move to end (most-recently-used)
      this.clients.delete(clientId);
      this.clients.set(clientId, client);
    }
    return client;
  }

  registerClient(
    clientMetadata: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">
  ): OAuthClientInformationFull {
    // Evict oldest if at capacity
    if (this.clients.size >= MAX_CLIENTS) {
      const oldestKey = this.clients.keys().next().value as string;
      this.clients.delete(oldestKey);
      logger.debug({ evictedClientId: oldestKey }, "Evicted oldest client from LRU cache");
    }

    const clientId = `mcp-${randomUUID()}`;
    const client: OAuthClientInformationFull = {
      ...clientMetadata,
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };

    this.clients.set(clientId, client);
    logger.info({ clientId }, "Registered new virtual MCP client");
    return client;
  }
}

// In-memory maps for auth codes and tokens

interface PendingAuthorization {
  gitlabState: string;
  codeChallenge: string;
  redirectUri: string;
  clientId: string;
  mcpState?: string;
  scopes?: string[];
  createdAt: number;
}

interface StoredToken {
  gitlabAccessToken: string;
  gitlabRefreshToken?: string;
  clientId: string;
  scopes: string[];
  expiresAt?: number;
  createdAt: number;
}

// GitLabOAuthServerProvider

export interface GitLabOAuthProxyConfig {
  /** The GitLab instance base URL (e.g. https://gitlab.com) */
  gitlabApiUrl: string;
  /** The pre-registered GitLab OAuth Application ID */
  gitlabOAuthAppId: string;
  /** Optional: The GitLab OAuth Application secret (for confidential apps) */
  gitlabOAuthAppSecret?: string;
  /** The public URL of this MCP server (used as redirect_uri for GitLab) */
  mcpServerUrl: string;
  /** OAuth scopes to request from GitLab (default: "api") */
  scopes?: string;
}

export class GitLabOAuthServerProvider implements OAuthServerProvider {
  readonly clientsStore: OAuthRegisteredClientsStore;
  readonly skipLocalPkceValidation = true; // GitLab handles PKCE

  private config: GitLabOAuthProxyConfig;

  // Maps GitLab state -> pending authorization
  private pendingAuths = new Map<string, PendingAuthorization>();
  // Maps MCP authorization code -> { gitlabCode, codeChallenge, clientId, redirectUri }
  private authCodes = new Map<
    string,
    {
      gitlabCode: string;
      codeChallenge: string;
      clientId: string;
      redirectUri: string;
      codeVerifier?: string;
    }
  >();
  // Maps MCP access token -> stored token info
  private tokens = new Map<string, StoredToken>();
  // Maps MCP refresh token -> MCP access token
  private refreshTokens = new Map<string, string>();

  private gitlabBaseUrl: string;

  constructor(config: GitLabOAuthProxyConfig) {
    this.config = config;
    this.clientsStore = new LRUClientCache();

    // Derive GitLab base URL (strip /api/v4 if present)
    this.gitlabBaseUrl = config.gitlabApiUrl.replace(/\/api\/v4\/?$/, "");
  }

  /**
   * Redirect the user's browser to GitLab's authorization endpoint.
   * We generate a unique state to correlate the callback.
   */
  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response
  ): Promise<void> {
    const gitlabState = randomUUID();

    // Store pending authorization keyed by GitLab state
    this.pendingAuths.set(gitlabState, {
      gitlabState,
      codeChallenge: params.codeChallenge,
      redirectUri: params.redirectUri,
      clientId: client.client_id,
      mcpState: params.state,
      scopes: params.scopes,
      createdAt: Date.now(),
    });

    // Build GitLab authorization URL
    const gitlabAuthUrl = new URL(`${this.gitlabBaseUrl}/oauth/authorize`);
    gitlabAuthUrl.searchParams.set("client_id", this.config.gitlabOAuthAppId);
    gitlabAuthUrl.searchParams.set("redirect_uri", `${this.config.mcpServerUrl}/gitlab/callback`);
    gitlabAuthUrl.searchParams.set("response_type", "code");
    gitlabAuthUrl.searchParams.set("state", gitlabState);
    gitlabAuthUrl.searchParams.set("scope", this.config.scopes ?? "api");

    // Forward PKCE to GitLab
    gitlabAuthUrl.searchParams.set("code_challenge", params.codeChallenge);
    gitlabAuthUrl.searchParams.set("code_challenge_method", "S256");

    logger.info(
      { clientId: client.client_id, gitlabState },
      "Redirecting to GitLab for authorization"
    );

    res.redirect(gitlabAuthUrl.toString());
  }

  /**
   * Handle the callback from GitLab and redirect back to the MCP client
   * with a locally-generated authorization code.
   *
   * This is called by the Express route handler, not by the SDK directly.
   */
  async handleGitLabCallback(
    gitlabCode: string,
    gitlabState: string,
    res: Response
  ): Promise<void> {
    const pending = this.pendingAuths.get(gitlabState);
    if (!pending) {
      logger.warn({ gitlabState }, "Unknown state in GitLab callback");
      res.status(400).send("Unknown state parameter");
      return;
    }

    this.pendingAuths.delete(gitlabState);

    // Generate a local MCP authorization code
    const mcpCode = randomUUID();

    this.authCodes.set(mcpCode, {
      gitlabCode,
      codeChallenge: pending.codeChallenge,
      clientId: pending.clientId,
      redirectUri: pending.redirectUri,
    });

    // Redirect back to MCP client's redirect_uri with the MCP code
    const redirectUrl = new URL(pending.redirectUri);
    redirectUrl.searchParams.set("code", mcpCode);
    if (pending.mcpState) {
      redirectUrl.searchParams.set("state", pending.mcpState);
    }

    logger.info(
      { clientId: pending.clientId, mcpCode },
      "GitLab callback handled, redirecting to MCP client"
    );

    res.redirect(redirectUrl.toString());
  }

  /**
   * Return the code_challenge associated with an authorization code.
   */
  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string
  ): Promise<string> {
    const stored = this.authCodes.get(authorizationCode);
    if (!stored) {
      throw new Error("Unknown authorization code");
    }
    return stored.codeChallenge;
  }

  /**
   * Exchange an MCP authorization code for tokens by proxying to GitLab.
   */
  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    codeVerifier?: string,
    redirectUri?: string,
    _resource?: URL
  ): Promise<OAuthTokens> {
    const stored = this.authCodes.get(authorizationCode);
    if (!stored) {
      throw new Error("Unknown authorization code");
    }

    // Verify the requesting client is the same one that initiated the flow
    if (stored.clientId !== client.client_id) {
      logger.warn(
        { expected: stored.clientId, actual: client.client_id },
        "Client ID mismatch during code exchange"
      );
      this.authCodes.delete(authorizationCode);
      throw new Error("Authorization code was not issued to this client");
    }

    // Verify redirect_uri matches the one used during authorization
    if (redirectUri && stored.redirectUri !== redirectUri) {
      logger.warn(
        { expected: stored.redirectUri, actual: redirectUri },
        "Redirect URI mismatch during code exchange"
      );
      this.authCodes.delete(authorizationCode);
      throw new Error("Redirect URI mismatch");
    }

    this.authCodes.delete(authorizationCode);

    // Exchange with GitLab
    const tokenUrl = `${this.gitlabBaseUrl}/oauth/token`;
    const params = new URLSearchParams({
      client_id: this.config.gitlabOAuthAppId,
      code: stored.gitlabCode,
      grant_type: "authorization_code",
      redirect_uri: `${this.config.mcpServerUrl}/gitlab/callback`,
    });

    // Forward code_verifier to GitLab for PKCE validation
    if (codeVerifier) {
      params.set("code_verifier", codeVerifier);
    }

    if (this.config.gitlabOAuthAppSecret) {
      params.set("client_secret", this.config.gitlabOAuthAppSecret);
    }

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, error: errorText }, "GitLab token exchange failed");
      throw new Error(`GitLab token exchange failed: ${response.status} ${errorText}`);
    }

    const gitlabTokens = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type: string;
      scope?: string;
    };

    // Generate MCP-level tokens
    const mcpAccessToken = `mcp-at-${randomUUID()}`;
    const mcpRefreshToken = `mcp-rt-${randomUUID()}`;
    const expiresIn = gitlabTokens.expires_in || 7200;

    // Store the mapping
    this.tokens.set(mcpAccessToken, {
      gitlabAccessToken: gitlabTokens.access_token,
      gitlabRefreshToken: gitlabTokens.refresh_token,
      clientId: client.client_id,
      scopes: gitlabTokens.scope?.split(" ") || ["api"],
      expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
      createdAt: Date.now(),
    });

    this.refreshTokens.set(mcpRefreshToken, mcpAccessToken);

    logger.info({ clientId: client.client_id }, "Token exchange successful");

    return {
      access_token: mcpAccessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
      refresh_token: mcpRefreshToken,
    };
  }

  /**
   * Exchange a refresh token by proxying to GitLab.
   */
  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    _resource?: URL
  ): Promise<OAuthTokens> {
    const mcpAccessToken = this.refreshTokens.get(refreshToken);
    if (!mcpAccessToken) {
      throw new Error("Unknown refresh token");
    }

    const storedToken = this.tokens.get(mcpAccessToken);
    if (!storedToken || !storedToken.gitlabRefreshToken) {
      throw new Error("No GitLab refresh token available");
    }

    // Verify the requesting client owns this refresh token
    if (storedToken.clientId !== client.client_id) {
      logger.warn(
        { expected: storedToken.clientId, actual: client.client_id },
        "Client ID mismatch during token refresh"
      );
      throw new Error("Refresh token was not issued to this client");
    }

    // Refresh with GitLab
    const tokenUrl = `${this.gitlabBaseUrl}/oauth/token`;
    const params = new URLSearchParams({
      client_id: this.config.gitlabOAuthAppId,
      refresh_token: storedToken.gitlabRefreshToken,
      grant_type: "refresh_token",
    });

    if (this.config.gitlabOAuthAppSecret) {
      params.set("client_secret", this.config.gitlabOAuthAppSecret);
    }

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, error: errorText }, "GitLab token refresh failed");
      throw new Error(`GitLab token refresh failed: ${response.status} ${errorText}`);
    }

    const gitlabTokens = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type: string;
      scope?: string;
    };

    // Remove old tokens
    this.tokens.delete(mcpAccessToken);
    this.refreshTokens.delete(refreshToken);

    // Generate new MCP tokens
    const newMcpAccessToken = `mcp-at-${randomUUID()}`;
    const newMcpRefreshToken = `mcp-rt-${randomUUID()}`;
    const expiresIn = gitlabTokens.expires_in || 7200;

    this.tokens.set(newMcpAccessToken, {
      gitlabAccessToken: gitlabTokens.access_token,
      gitlabRefreshToken: gitlabTokens.refresh_token || storedToken.gitlabRefreshToken,
      clientId: client.client_id,
      scopes: gitlabTokens.scope?.split(" ") || storedToken.scopes,
      expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
      createdAt: Date.now(),
    });

    this.refreshTokens.set(newMcpRefreshToken, newMcpAccessToken);

    logger.info({ clientId: client.client_id }, "Token refresh successful");

    return {
      access_token: newMcpAccessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
      refresh_token: newMcpRefreshToken,
    };
  }

  /**
   * Verify an MCP access token. Optionally validates against GitLab's
   * /oauth/token/info endpoint.
   */
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const stored = this.tokens.get(token);
    if (!stored) {
      throw new Error("Invalid access token");
    }

    // Check local expiry
    if (stored.expiresAt && Date.now() / 1000 > stored.expiresAt) {
      this.tokens.delete(token);
      throw new Error("Access token expired");
    }

    // Verify against GitLab's token info endpoint
    try {
      const infoUrl = `${this.gitlabBaseUrl}/oauth/token/info`;
      const response = await fetch(infoUrl, {
        headers: { Authorization: `Bearer ${stored.gitlabAccessToken}` },
      });

      if (!response.ok) {
        logger.warn({ status: response.status }, "GitLab token info verification failed");
        this.tokens.delete(token);
        throw new Error("GitLab token verification failed");
      }
    } catch (error) {
      if (error instanceof Error && error.message === "GitLab token verification failed") {
        throw error;
      }
      // Network errors during verification are non-fatal; trust local state
      logger.debug("GitLab token info check failed (network), trusting local state");
    }

    return {
      token,
      clientId: stored.clientId,
      scopes: stored.scopes,
      expiresAt: stored.expiresAt,
    };
  }

  /**
   * Revoke a token by proxying to GitLab's revocation endpoint.
   */
  async revokeToken(
    _client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest
  ): Promise<void> {
    const tokenToRevoke = request.token;

    // Determine if it's an access token or refresh token
    let gitlabToken: string | undefined;

    const storedAccess = this.tokens.get(tokenToRevoke);
    if (storedAccess) {
      gitlabToken = storedAccess.gitlabAccessToken;
      this.tokens.delete(tokenToRevoke);
    }

    const mcpAccessToken = this.refreshTokens.get(tokenToRevoke);
    if (mcpAccessToken) {
      const storedForRefresh = this.tokens.get(mcpAccessToken);
      if (storedForRefresh?.gitlabRefreshToken) {
        gitlabToken = storedForRefresh.gitlabRefreshToken;
      }
      this.refreshTokens.delete(tokenToRevoke);
    }

    // Revoke on GitLab side if we found a corresponding token
    if (gitlabToken) {
      try {
        const revokeUrl = `${this.gitlabBaseUrl}/oauth/revoke`;
        const params = new URLSearchParams({
          client_id: this.config.gitlabOAuthAppId,
          token: gitlabToken,
        });

        if (this.config.gitlabOAuthAppSecret) {
          params.set("client_secret", this.config.gitlabOAuthAppSecret);
        }

        await fetch(revokeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        });

        logger.info("Token revoked on GitLab");
      } catch (error) {
        logger.warn({ error }, "Failed to revoke token on GitLab (non-fatal)");
      }
    }
  }

  /**
   * Get the GitLab access token for a given MCP access token.
   * Used by the MCP server to make API calls on behalf of the user.
   */
  getGitLabToken(mcpAccessToken: string): string | undefined {
    return this.tokens.get(mcpAccessToken)?.gitlabAccessToken;
  }
}

// Factory function

export function createGitLabOAuthProvider(
  config: GitLabOAuthProxyConfig
): GitLabOAuthServerProvider {
  return new GitLabOAuthServerProvider(config);
}
