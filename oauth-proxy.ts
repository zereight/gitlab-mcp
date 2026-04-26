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
 * ### Flow (callback proxy mode — GITLAB_OAUTH_CALLBACK_PROXY=true)
 *
 * When callback proxy mode is enabled, the MCP server acts as a full OAuth
 * intermediary, similar to the Atlassian MCP's OAuthProxy pattern. Only ONE
 * fixed callback URL needs to be registered with GitLab, regardless of how
 * many MCP clients connect.
 *
 * 1. MCP client calls POST /register (DCR) — proxy stores redirect_uris locally
 *    and returns a virtual client_id.
 * 2. MCP client redirects to /authorize — proxy stores the client's original
 *    redirect_uri and state, generates its own PKCE pair, then redirects to
 *    GitLab using the MCP server's fixed /callback URL as redirect_uri.
 * 3. User authorizes on GitLab — GitLab redirects to the MCP server's /callback.
 * 4. /callback handler exchanges the code with GitLab for tokens, stores them
 *    server-side, generates a new proxy auth code, and redirects to the client's
 *    original redirect_uri with the proxy code.
 * 5. MCP client calls POST /token with the proxy code — proxy returns the
 *    stored GitLab tokens.
 *
 * ### Flow (passthrough mode — default)
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
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { pino } from "pino";
import type { Request } from "express";

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
// GitLab OAuth Server Provider
// ---------------------------------------------------------------------------

/**
 * Minimum GitLab scopes required for the MCP server to function.
 * Injected into the authorization request when the client does not request them.
 */
const REQUIRED_GITLAB_SCOPES_RW = ["api"];
const REQUIRED_GITLAB_SCOPES_RO = ["read_api"];

// ---------------------------------------------------------------------------
// Callback proxy mode — pending auth transactions
// ---------------------------------------------------------------------------

const PENDING_AUTH_MAX_SIZE = 1000;
const PENDING_AUTH_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CLIENT_CACHE_MAX_SIZE = 1000;

/** Stored while user is on GitLab consent screen. Keyed by `state`. */
interface PendingAuthTransaction {
  clientRedirectUri: string;
  clientState: string | undefined;
  clientCodeChallenge: string;
  proxyCodeVerifier: string;
  createdAt: number;
}

/** Stored after /callback exchanges the code. Keyed by proxy auth code. */
interface StoredTokenEntry {
  tokens: OAuthTokens;
  clientCodeChallenge: string; // for PKCE verification when client calls /token
  redirectUri: string; // the fixed callback URI used with GitLab
  createdAt: number;
}

class BoundedLRUMap<V> {
  private readonly _map = new Map<string, V>();
  private readonly _maxSize: number;

  constructor(maxSize: number) {
    this._maxSize = maxSize;
  }

  get(key: string): V | undefined {
    const v = this._map.get(key);
    if (v !== undefined) {
      this._map.delete(key);
      this._map.set(key, v);
    }
    return v;
  }

  /** Get and remove in one operation — for one-time-use entries. */
  getAndDelete(key: string): V | undefined {
    const v = this._map.get(key);
    if (v !== undefined) this._map.delete(key);
    return v;
  }

  set(key: string, value: V): void {
    if (this._map.has(key)) this._map.delete(key);
    else if (this._map.size >= this._maxSize) {
      const lruKey = this._map.keys().next().value;
      if (lruKey !== undefined) this._map.delete(lruKey);
    }
    this._map.set(key, value);
  }

  delete(key: string): boolean {
    return this._map.delete(key);
  }

  get size(): number {
    return this._map.size;
  }
}

class GitLabOAuthServerProvider implements OAuthServerProvider {
  /**
   * Tell the SDK not to validate PKCE locally.
   * - Passthrough mode: GitLab handles PKCE validation.
   * - Callback proxy mode: we verify the client's PKCE manually in
   *   exchangeAuthorizationCode() after looking up stored tokens.
   */
  readonly skipLocalPkceValidation = true;

  private readonly _gitlabBaseUrl: string;
  private readonly _gitlabAppId: string;
  private readonly _resourceName: string;
  private readonly _requiredScopes: string[];
  private readonly _clientCache = new BoundedLRUMap<OAuthClientInformationFull>(CLIENT_CACHE_MAX_SIZE);

  // Callback proxy mode fields
  private readonly _callbackProxyEnabled: boolean;
  private readonly _callbackUrl: string;
  private readonly _pendingAuth = new BoundedLRUMap<PendingAuthTransaction>(PENDING_AUTH_MAX_SIZE);
  private readonly _storedTokens = new BoundedLRUMap<StoredTokenEntry>(PENDING_AUTH_MAX_SIZE);

  constructor(
    gitlabBaseUrl: string,
    gitlabAppId: string,
    resourceName: string,
    readOnly: boolean,
    customScopes?: string[],
    callbackProxyEnabled = false,
    callbackUrl = ""
  ) {
    this._gitlabBaseUrl = gitlabBaseUrl;
    this._gitlabAppId = gitlabAppId;
    this._resourceName = resourceName;
    this._requiredScopes =
      customScopes && customScopes.length > 0
        ? customScopes
        : readOnly
          ? REQUIRED_GITLAB_SCOPES_RO
          : REQUIRED_GITLAB_SCOPES_RW;
    this._callbackProxyEnabled = callbackProxyEnabled;
    this._callbackUrl = callbackUrl;

    if (callbackProxyEnabled && !callbackUrl) {
      throw new Error("callbackUrl is required when callbackProxyEnabled is true");
    }
    if (callbackProxyEnabled) {
      logger.info(`Callback proxy mode enabled — fixed callback URL: ${callbackUrl}`);
    }
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

    if (this._callbackProxyEnabled) {
      // --- Callback proxy mode ---
      // Generate a proxy PKCE pair (MCP server ↔ GitLab)
      const proxyCodeVerifier = randomBytes(32).toString("base64url");
      const proxyCodeChallenge = createHash("sha256")
        .update(proxyCodeVerifier)
        .digest("base64url");

      // Use a unique state to correlate the callback
      const proxyState = randomUUID();

      // Store the client's original params so /callback can redirect back
      this._pendingAuth.set(proxyState, {
        clientRedirectUri: params.redirectUri,
        clientState: params.state,
        clientCodeChallenge: params.codeChallenge,
        proxyCodeVerifier,
        createdAt: Date.now(),
      });

      const searchParams = new URLSearchParams({
        client_id: this._gitlabAppId,
        response_type: "code",
        redirect_uri: this._callbackUrl,
        code_challenge: proxyCodeChallenge,
        code_challenge_method: "S256",
        state: proxyState,
      });

      if (effectiveScopes.length) searchParams.set("scope", effectiveScopes.join(" "));
      if (params.resource) searchParams.set("resource", params.resource.href);

      targetUrl.search = searchParams.toString();

      logger.info(
        `authorize (callback proxy): redirecting to GitLab with fixed callback URL (app: ${this._gitlabAppId}, scopes: ${effectiveScopes.join(" ")})`
      );
    } else {
      // --- Passthrough mode (original behavior) ---
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
    }

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
    if (this._callbackProxyEnabled) {
      // --- Callback proxy mode ---
      // The authorizationCode is a proxy code we generated in handleCallback().
      // Look up the stored tokens by proxy code.
      const entry = this._storedTokens.get(authorizationCode);
      if (!entry) {
        throw new ServerError("Invalid or expired authorization code");
      }

      // Check TTL before consuming — expired entries can't be retried anyway,
      // but we give a specific error so the client knows to restart the flow.
      if (Date.now() - entry.createdAt > PENDING_AUTH_TTL_MS) {
        this._storedTokens.delete(authorizationCode);
        throw new ServerError("Authorization code expired — please restart the OAuth flow");
      }

      // One-time use: delete after validation
      this._storedTokens.delete(authorizationCode);

      // Verify client PKCE: the client's code_verifier must match the
      // code_challenge stored during /authorize.
      if (entry.clientCodeChallenge) {
        if (!codeVerifier) {
          throw new ServerError("PKCE code_verifier is required");
        }
        const computed = createHash("sha256").update(codeVerifier).digest("base64url");
        if (computed !== entry.clientCodeChallenge) {
          throw new ServerError("PKCE verification failed");
        }
      }

      return entry.tokens;
    }

    // --- Passthrough mode (original behavior) ---
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

  // ---- Callback handler (callback proxy mode) ----------------------------

  /**
   * Handle the OAuth callback from GitLab.
   * Exchanges the auth code for tokens, stores them, generates a proxy code,
   * and redirects to the MCP client's original callback URL.
   *
   * Mount this as GET /callback in the Express app.
   */
  async handleCallback(req: Request, res: Response): Promise<void> {
    if (!this._callbackProxyEnabled) {
      res.status(404).send("Callback proxy mode is not enabled");
      return;
    }

    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const error = req.query.error as string | undefined;

    if (error) {
      logger.error(`GitLab OAuth error: ${error} — ${req.query.error_description ?? "(no description)"}`);
      res.status(400).send("Authorization failed");
      return;
    }

    if (!code || !state) {
      res.status(400).send("Missing code or state parameter");
      return;
    }

    // Look up the pending auth transaction
    const pending = this._pendingAuth.getAndDelete(state);
    if (!pending) {
      res.status(400).send("Unknown or expired state parameter");
      return;
    }

    // Check TTL
    if (Date.now() - pending.createdAt > PENDING_AUTH_TTL_MS) {
      res.status(400).send("Authorization request expired");
      return;
    }

    // Exchange the GitLab auth code for tokens using the proxy's PKCE verifier
    try {
      const tokenParams = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: this._gitlabAppId,
        code,
        redirect_uri: this._callbackUrl,
        code_verifier: pending.proxyCodeVerifier,
      });

      const tokenResponse = await fetch(`${this._gitlabBaseUrl}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenParams.toString(),
      });

      if (!tokenResponse.ok) {
        const body = await tokenResponse.text();
        logger.error(`Callback token exchange failed (${tokenResponse.status}): ${body}`);
        res.status(502).send("Token exchange with GitLab failed");
        return;
      }

      const tokens = OAuthTokensSchema.parse(await tokenResponse.json());

      // Generate a proxy auth code for the MCP client
      const proxyCode = randomUUID();
      this._storedTokens.set(proxyCode, {
        tokens,
        clientCodeChallenge: pending.clientCodeChallenge,
        redirectUri: this._callbackUrl,
        createdAt: Date.now(),
      });

      // Redirect to the MCP client's original callback URL
      const clientCallback = new URL(pending.clientRedirectUri);
      clientCallback.searchParams.set("code", proxyCode);
      if (pending.clientState) {
        clientCallback.searchParams.set("state", pending.clientState);
      }

      logger.info(
        `callback: exchanged code with GitLab, redirecting to client callback`
      );
      res.redirect(clientCallback.toString());
    } catch (err) {
      logger.error({ err }, "Callback handler error");
      res.status(500).send("Internal error during token exchange");
    }
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
 * @param readOnly       When true and customScopes is not set, restricts to read_api scope.
 * @param customScopes   Explicit list of GitLab scopes to require. Overrides readOnly when set.
 * @param callbackProxyEnabled  When true, the MCP server handles the OAuth callback internally.
 *                              Only ONE fixed callback URL needs to be registered with GitLab.
 * @param callbackUrl    The fixed callback URL (e.g. https://mcp.example.com/callback).
 *                        Required when callbackProxyEnabled is true.
 */
export function createGitLabOAuthProvider(
  gitlabBaseUrl: string,
  gitlabAppId: string,
  resourceName = "GitLab MCP Server",
  readOnly = false,
  customScopes?: string[],
  callbackProxyEnabled = false,
  callbackUrl = ""
): GitLabOAuthServerProvider {
  return new GitLabOAuthServerProvider(gitlabBaseUrl, gitlabAppId, resourceName, readOnly, customScopes, callbackProxyEnabled, callbackUrl);
}
