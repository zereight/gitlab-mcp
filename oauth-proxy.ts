/**
 * MCP OAuth Proxy — GitLab upstream
 *
 * Builds an OAuthServerProvider that handles the MCP spec OAuth flow while
 * delegating actual authentication to a GitLab instance.
 *
 * ### Why not pure GitLab DCR?
 *
 * GitLab restricts dynamically registered (unverified) applications to the
 * `mcp` scope, which is insufficient for API calls (need `api` or `read_api`).
 * To work around this, the MCP server uses a **pre-registered GitLab OAuth
 * application** (set via GITLAB_OAUTH_APP_ID env var) with the required scopes,
 * and handles DCR locally — each MCP client gets a unique virtual client_id
 * mapped to the real GitLab app.
 *
 * ### Flow
 *
 * 1. MCP client calls POST /register (DCR) — proxy stores redirect_uris locally
 *    and returns a virtual client_id.
 * 2. MCP client redirects to /authorize — proxy replaces the virtual client_id
 *    with the real GitLab app client_id and forwards to GitLab.
 * 3. User authorizes on GitLab — redirect comes back with auth code.
 * 4. MCP client calls POST /token — proxy exchanges the code with GitLab using
 *    the real client_id.
 *
 * Activated when GITLAB_MCP_OAUTH=true. All other auth modes are unaffected.
 */

import { InvalidTokenError, ServerError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type {
  OAuthClientInformationFull,
  OAuthTokens,
  OAuthTokenRevocationRequest,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { OAuthTokensSchema } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { AuthorizationParams, OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { Response } from "express";
import { randomUUID } from "node:crypto";
import { pino } from "pino";

const logger = pino({ name: "gitlab-mcp-oauth-proxy" });

/**
 * Shape of the response from GitLab's /oauth/token/info endpoint.
 * @see https://docs.gitlab.com/ee/api/oauth2.html#retrieve-the-token-information
 */
export interface GitLabTokenInfo {
  resource_owner_id: number;
  scopes: string[];
  expires_in_seconds: number | null;
  application: { uid: string } | null;
  created_at: number;
}

// ---------------------------------------------------------------------------
// Bounded LRU client cache
// ---------------------------------------------------------------------------

const CLIENT_CACHE_MAX_SIZE = 1000;

class BoundedClientCache {
  private readonly _map = new Map<string, OAuthClientInformationFull>();
  private readonly _maxSize: number;

  constructor(maxSize: number) {
    this._maxSize = maxSize;
  }

  get(clientId: string): OAuthClientInformationFull | undefined {
    const entry = this._map.get(clientId);
    if (entry) {
      this._map.delete(clientId);
      this._map.set(clientId, entry);
    }
    return entry;
  }

  set(clientId: string, client: OAuthClientInformationFull): void {
    if (this._map.has(clientId)) {
      this._map.delete(clientId);
    } else if (this._map.size >= this._maxSize) {
      const lruKey = this._map.keys().next().value;
      if (lruKey !== undefined) this._map.delete(lruKey);
    }
    this._map.set(clientId, client);
  }

  get size(): number {
    return this._map.size;
  }
}

// ---------------------------------------------------------------------------
// GitLab OAuth Server Provider
// ---------------------------------------------------------------------------

/**
 * Minimum GitLab scopes required for the MCP server to function.
 * Injected into the authorization request when the client does not request them.
 */
const REQUIRED_GITLAB_SCOPES_RW = ["api"];
const REQUIRED_GITLAB_SCOPES_RO = ["read_api"];

class GitLabOAuthServerProvider implements OAuthServerProvider {
  /**
   * Tell the SDK not to validate PKCE locally — GitLab handles it.
   */
  readonly skipLocalPkceValidation = true;

  private readonly _gitlabBaseUrl: string;
  private readonly _gitlabAppId: string;
  private readonly _resourceName: string;
  private readonly _requiredScopes: string[];
  private readonly _clientCache = new BoundedClientCache(CLIENT_CACHE_MAX_SIZE);

  constructor(gitlabBaseUrl: string, gitlabAppId: string, resourceName: string, readOnly: boolean) {
    this._gitlabBaseUrl = gitlabBaseUrl;
    this._gitlabAppId = gitlabAppId;
    this._resourceName = resourceName;
    this._requiredScopes = readOnly ? REQUIRED_GITLAB_SCOPES_RO : REQUIRED_GITLAB_SCOPES_RW;
  }

  // ---- Client store (local DCR) ------------------------------------------

  get clientsStore(): OAuthRegisteredClientsStore {
    const cache = this._clientCache;
    const resourceName = this._resourceName;

    return {
      getClient: async (clientId: string) => {
        const cached = cache.get(clientId);
        if (cached) return cached;

        // Unknown client — return a minimal stub so token exchange can proceed
        // (GitLab is the ultimate validator).
        return {
          client_id: clientId,
          redirect_uris: [],
          token_endpoint_auth_method: "none" as const,
        };
      },

      registerClient: async (
        client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">
      ) => {
        // Generate a virtual client_id; all real OAuth operations use _gitlabAppId.
        const virtualClientId = randomUUID();

        const registered: OAuthClientInformationFull = {
          client_id: virtualClientId,
          client_id_issued_at: Math.floor(Date.now() / 1000),
          redirect_uris: client.redirect_uris ?? [],
          token_endpoint_auth_method: "none",
          grant_types: client.grant_types ?? ["authorization_code"],
          client_name: client.client_name
            ? `${client.client_name} via ${resourceName}`
            : resourceName,
        };

        cache.set(virtualClientId, registered);
        logger.info(
          `DCR: registered virtual client ${virtualClientId} (name: ${registered.client_name})`
        );
        return registered;
      },
    };
  }

  // ---- Authorize ---------------------------------------------------------

  async authorize(
    _client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response
  ): Promise<void> {
    const scopes = params.scopes ?? [];
    const hasRequired = this._requiredScopes.some((s) => scopes.includes(s));
    const effectiveScopes = hasRequired
      ? scopes
      : [...new Set([...scopes, ...this._requiredScopes])];

    // Build the GitLab authorize URL with the REAL app client_id
    const targetUrl = new URL(`${this._gitlabBaseUrl}/oauth/authorize`);
    const searchParams = new URLSearchParams({
      client_id: this._gitlabAppId,
      response_type: "code",
      redirect_uri: params.redirectUri,
      code_challenge: params.codeChallenge,
      code_challenge_method: "S256",
    });

    if (params.state) searchParams.set("state", params.state);
    if (effectiveScopes.length) searchParams.set("scope", effectiveScopes.join(" "));
    if (params.resource) searchParams.set("resource", params.resource.href);

    targetUrl.search = searchParams.toString();

    logger.info(
      `authorize: redirecting to GitLab (app: ${this._gitlabAppId}, scopes: ${effectiveScopes.join(" ")})`
    );
    res.redirect(targetUrl.toString());
  }

  // ---- PKCE challenge (delegated to GitLab) ------------------------------

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    _authorizationCode: string
  ): Promise<string> {
    return "";
  }

  // ---- Token exchange ----------------------------------------------------

  async exchangeAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string,
    codeVerifier?: string,
    redirectUri?: string,
    resource?: URL
  ): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this._gitlabAppId,
      code: authorizationCode,
    });

    if (codeVerifier) params.append("code_verifier", codeVerifier);
    if (redirectUri) params.append("redirect_uri", redirectUri);
    if (resource) params.append("resource", resource.href);

    const response = await fetch(`${this._gitlabBaseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error(`Token exchange failed (${response.status}): ${body}`);
      throw new ServerError(`Token exchange failed: ${response.status}`);
    }

    const data = await response.json();
    return OAuthTokensSchema.parse(data);
  }

  // ---- Refresh token -----------------------------------------------------

  async exchangeRefreshToken(
    _client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL
  ): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this._gitlabAppId,
      refresh_token: refreshToken,
    });

    if (scopes?.length) params.set("scope", scopes.join(" "));
    if (resource) params.set("resource", resource.href);

    const response = await fetch(`${this._gitlabBaseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error(`Token refresh failed (${response.status}): ${body}`);
      throw new ServerError(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    return OAuthTokensSchema.parse(data);
  }

  // ---- Verify access token -----------------------------------------------

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const res = await fetch(`${this._gitlabBaseUrl}/oauth/token/info`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new InvalidTokenError("Invalid or expired GitLab OAuth token");
    }

    const info = (await res.json()) as GitLabTokenInfo;

    return {
      token,
      clientId: info.application?.uid ?? "dynamic",
      scopes: info.scopes ?? [],
      expiresAt:
        info.expires_in_seconds != null
          ? Math.floor(Date.now() / 1000) + info.expires_in_seconds
          : undefined,
    };
  }

  // ---- Revoke token ------------------------------------------------------

  async revokeToken(
    _client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest
  ): Promise<void> {
    const params = new URLSearchParams({
      token: request.token,
      client_id: this._gitlabAppId,
    });

    if (request.token_type_hint) {
      params.set("token_type_hint", request.token_type_hint);
    }

    const response = await fetch(`${this._gitlabBaseUrl}/oauth/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new ServerError(`Token revocation failed: ${response.status}`);
    }

    await response.body?.cancel();
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Build a GitLabOAuthServerProvider for the given GitLab instance.
 *
 * @param gitlabBaseUrl  Root URL of the GitLab instance (no trailing slash, no /api/v4).
 * @param gitlabAppId    Client ID of the pre-registered GitLab OAuth application.
 * @param resourceName   Human-readable name shown on the GitLab consent screen.
 */
export function createGitLabOAuthProvider(
  gitlabBaseUrl: string,
  gitlabAppId: string,
  resourceName = "GitLab MCP Server",
  readOnly = false
): GitLabOAuthServerProvider {
  return new GitLabOAuthServerProvider(gitlabBaseUrl, gitlabAppId, resourceName, readOnly);
}
