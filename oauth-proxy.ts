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

import {
  CustomOAuthError,
  InsufficientScopeError,
  InvalidGrantError,
  InvalidRequestError,
  InvalidTokenError,
  ServerError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
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
import type { Request } from "express";

import {
  looksLikeStatelessClientId,
  mintClientId,
  openClientId,
} from "./stateless/client-id.js";
import {
  looksLikeStatelessState,
  mintPendingAuthState,
  openPendingAuthState,
} from "./stateless/pending-auth.js";
import {
  looksLikeStatelessStoredTokensCode,
  mintStoredTokensCode,
  openStoredTokensCode,
  ConsumedProxyCodeCache,
  PROXY_CODE_CACHE_FULL,
} from "./stateless/index.js";
import type { StatelessKeyMaterial } from "./stateless/index.js";
import { ConsentGate, DEFAULT_ALLOWED_REDIRECT_URIS, RedirectUriPolicy } from "./oauth-consent.js";
import { createLogger } from "./utils/logger.js";
import { redactUrlSecretsInText } from "./utils/redact-url.js";

const logger = createLogger("gitlab-mcp-oauth-proxy");

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
const GROUP_MEMBERSHIP_CACHE_MAX_SIZE = 1000;
const GROUP_MEMBERSHIP_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const GROUP_ACCESS_DENIED_MESSAGE = "Access denied: user is not a member of an allowed group";
const REFRESH_TOKEN_DISABLED_MESSAGE =
  "Refresh tokens are disabled on this server (OAUTH_DISABLE_REFRESH_TOKEN); start a new authorization";

/**
 * Maps a non-OK GitLab /oauth/token response. A rotated, revoked or expired
 * refresh token or authorization code is a 400 invalid_grant, which clients
 * must see as invalid_grant to restart authorization; anything else stays a
 * ServerError.
 */
function tokenEndpointError(operation: string, status: number, body: string): Error {
  let gitlabError: unknown;
  try {
    gitlabError = JSON.parse(body)?.error;
  } catch {
    gitlabError = undefined;
  }
  if (status === 400 && gitlabError === "invalid_grant") {
    return new InvalidGrantError(`${operation} rejected by GitLab; start a new authorization`);
  }
  return new ServerError(`${operation} failed: ${status}`);
}

function singleQueryParam(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function invalidQueryParam(value: unknown): boolean {
  return value != null && typeof value !== "string";
}

/**
 * Stateless-mode configuration for the OAuth provider.
 *
 * When `material` is set, DCR entries, callback-proxy pending-auth
 * transactions, and callback-proxy stored-token entries are serialised into
 * the opaque OAuth values themselves rather than held in a per-pod in-memory
 * cache. This makes the provider safe to run behind a load balancer that
 * distributes requests across multiple pods with no session affinity.
 */
export interface StatelessOAuthOptions {
  material: StatelessKeyMaterial;
  clientTtlSeconds: number;
  /** TTL for sealed OAuth `state` values (default 600s). */
  pendingTtlSeconds: number;
  /** TTL for sealed proxy authorization codes (default 120s). */
  storedTtlSeconds: number;
}

/** Stored while user is on GitLab consent screen. Keyed by `state`. */
interface PendingAuthTransaction {
  clientId: string;
  clientRedirectUri: string;
  clientState: string | undefined;
  clientCodeChallenge: string;
  proxyCodeVerifier: string;
  createdAt: number;
}

/** Stored after /callback exchanges the code. Keyed by proxy auth code. */
interface StoredTokenEntry {
  tokens: OAuthTokens;
  clientId: string;
  clientCodeChallenge: string; // for PKCE verification when client calls /token
  clientRedirectUri: string;
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
  /**
   * Per-pod replay-prevention cache for sealed (stateless) proxy authorization
   * codes. Keys are SHA-256 hashes of the code; entries are TTL-bound (never
   * LRU-evicted early) and hold pending→consumed state. Cross-pod replay
   * remains mitigated by the short stored-code TTL + PKCE.
   */
  private readonly _usedProxyCodes = new ConsumedProxyCodeCache(PENDING_AUTH_MAX_SIZE);

  // Stateless mode (optional). When set, DCR and callback-proxy state are
  // serialised into opaque OAuth values and the in-memory caches above are
  // bypassed. Enabled independently of callback-proxy mode.
  private readonly _stateless: StatelessOAuthOptions | null;

  // Group allowlist (optional). When set, tokens are rejected unless the
  // authenticated user is a direct or inherited member of at least one group.
  // Checked at token issuance, on refresh and on every verified request; the
  // result is cached per token (keyed by SHA-256) for GROUP_MEMBERSHIP_CACHE_TTL_MS.
  private readonly _allowedGroups: string[] | null;
  private readonly _groupMembershipCache = new BoundedLRUMap<{
    isMember: boolean;
    expiresAt: number;
  }>(GROUP_MEMBERSHIP_CACHE_MAX_SIZE);

  // Callback proxy safeguards (see oauth-consent.ts). Null in passthrough
  // mode, where GitLab checks redirect_uri against the app registration.
  private readonly _redirectPolicy: RedirectUriPolicy | null = null;
  private readonly _consent: ConsentGate | null = null;

  // OAUTH_DISABLE_REFRESH_TOKEN: issued tokens carry no refresh_token and the
  // refresh_token grant is rejected, so the client re-runs the browser
  // authorization once the GitLab access token expires.
  private readonly _disableRefreshToken: boolean;

  constructor(
    gitlabBaseUrl: string,
    gitlabAppId: string,
    resourceName: string,
    readOnly: boolean,
    customScopes?: string[],
    allowedGroups?: string[],
    callbackProxyEnabled = false,
    callbackUrl = "",
    stateless: StatelessOAuthOptions | null = null,
    allowedRedirectUris: readonly string[] = DEFAULT_ALLOWED_REDIRECT_URIS,
    disableRefreshToken = false
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
    this._allowedGroups = allowedGroups ?? null;
    this._callbackProxyEnabled = callbackProxyEnabled;
    this._callbackUrl = callbackUrl;
    this._stateless = stateless;
    this._disableRefreshToken = disableRefreshToken;

    if (callbackProxyEnabled && !callbackUrl) {
      throw new Error("callbackUrl is required when callbackProxyEnabled is true");
    }
    if (callbackProxyEnabled) {
      this._redirectPolicy = new RedirectUriPolicy(allowedRedirectUris);
      this._consent = new ConsentGate({
        resourceName,
        secureCookies: callbackUrl.startsWith("https:"),
        stateless: stateless?.material ?? null,
      });
      logger.info(
        `Callback proxy mode enabled — fixed callback URL: ${redactUrlSecretsInText(callbackUrl)}`
      );
      if (this._redirectPolicy.allowsAny) {
        logger.warn(
          "GITLAB_OAUTH_ALLOWED_REDIRECT_URIS contains \"*\": any registered client may receive " +
            "authorization codes; only the consent page stands between a phishing link and a user's GitLab token"
        );
      }
    }
    if (stateless) {
      logger.info(
        `Stateless mode enabled (client_id TTL: ${stateless.clientTtlSeconds}s, ` +
          `pending TTL: ${stateless.pendingTtlSeconds}s, ` +
          `stored TTL: ${stateless.storedTtlSeconds}s)`
      );
    }
    if (disableRefreshToken) {
      logger.info(
        "OAUTH_DISABLE_REFRESH_TOKEN enabled — refresh_token grant rejected; " +
          "clients must re-authorize in the browser when the GitLab access token expires"
      );
    }
  }

  // ---- Client store (local DCR) ------------------------------------------

  get clientsStore(): OAuthRegisteredClientsStore {
    const cache = this._clientCache;
    const resourceName = this._resourceName;
    const stateless = this._stateless;
    const redirectPolicy = this._redirectPolicy;
    const disableRefreshToken = this._disableRefreshToken;

    return {
      getClient: async (clientId: string) => {
        // Stateless path: a signed client_id carries the registration.
        // If verification succeeds, reconstruct the OAuthClientInformationFull.
        if (stateless && looksLikeStatelessClientId(clientId)) {
          const payload = openClientId(
            stateless.material,
            clientId,
            stateless.clientTtlSeconds
          );
          if (!payload) {
            logger.warn(`DCR: stateless client_id rejected (bad signature or expired)`);
            // Mimic legacy behaviour: return a stub so the SDK surfaces the
            // standard InvalidClientError path. We return null to let the SDK
            // handler emit a proper OAuth error.
            return undefined;
          }
          return {
            client_id: clientId,
            client_id_issued_at: payload.iat,
            redirect_uris: payload.ruris,
            token_endpoint_auth_method: "none",
            grant_types: payload.gt ?? ["authorization_code"],
            client_name: payload.cn ?? resourceName,
          };
        }

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
        let grantTypes = client.grant_types ?? ["authorization_code"];
        if (disableRefreshToken) {
          // OAUTH_DISABLE_REFRESH_TOKEN: match grant_types_supported in the metadata.
          const withoutRefresh = grantTypes.filter((gt) => gt !== "refresh_token");
          grantTypes = withoutRefresh.length > 0 ? withoutRefresh : ["authorization_code"];
        }
        const redirectUris = client.redirect_uris ?? [];

        // Callback proxy mode: GitLab never sees the client's redirect_uri, so
        // this server is the only place it can be checked.
        const rejected = redirectPolicy
          ? redirectUris.filter((uri) => !redirectPolicy.allows(uri))
          : [];
        if (rejected.length > 0) {
          logger.warn(
            `DCR: rejected redirect_uris not allowed by GITLAB_OAUTH_ALLOWED_REDIRECT_URIS: ${rejected
              .map((uri) => JSON.stringify(redactUrlSecretsInText(uri)))
              .join(", ")}`
          );
          throw new CustomOAuthError(
            "invalid_redirect_uri",
            `redirect_uri ${rejected[0]} is not allowed by this server. ` +
              "The server operator can add it to GITLAB_OAUTH_ALLOWED_REDIRECT_URIS."
          );
        }
        const clientName = client.client_name
          ? `${client.client_name} via ${resourceName}`
          : resourceName;

        // Stateless path: mint a signed client_id and return the registration
        // without touching the in-memory cache.
        if (stateless) {
          const issuedAt = Math.floor(Date.now() / 1000);
          const clientId = mintClientId(stateless.material, {
            redirectUris,
            grantTypes,
            clientName,
          });
          const registered: OAuthClientInformationFull = {
            client_id: clientId,
            client_id_issued_at: issuedAt,
            redirect_uris: redirectUris,
            token_endpoint_auth_method: "none",
            grant_types: grantTypes,
            client_name: clientName,
          };
          logger.info(
            `DCR (stateless): issued signed client_id (name: ${clientName}, ruris: ${redirectUris.length})`
          );
          return registered;
        }

        // Generate a virtual client_id; all real OAuth operations use _gitlabAppId.
        const virtualClientId = randomUUID();

        const registered: OAuthClientInformationFull = {
          client_id: virtualClientId,
          client_id_issued_at: Math.floor(Date.now() / 1000),
          redirect_uris: redirectUris,
          token_endpoint_auth_method: "none",
          grant_types: grantTypes,
          client_name: clientName,
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
    client: OAuthClientInformationFull,
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
      // Re-check the policy here too: signed client_ids minted before an
      // upgrade or allowlist change still carry their old redirect_uris.
      // Answer directly; redirecting the error would send the browser to
      // the URI we just refused.
      if (this._redirectPolicy && !this._redirectPolicy.allows(params.redirectUri)) {
        logger.warn(
          `authorize (callback proxy): refused redirect_uri ${JSON.stringify(
            redactUrlSecretsInText(params.redirectUri)
          )} (not in GITLAB_OAUTH_ALLOWED_REDIRECT_URIS)`
        );
        res.status(400).json({
          error: "invalid_request",
          error_description: "redirect_uri is not allowed by this server",
        });
        return;
      }
      // Ask the user before sending them to GitLab. Without this, any link
      // to /authorize gets the operator's GitLab app consent screen and the
      // resulting code goes to whichever client registered the link.
      if (this._consent && this._consent.check(client, params, res) === "handled") {
        return;
      }

      // Generate a proxy PKCE pair (MCP server ↔ GitLab)
      const proxyCodeVerifier = randomBytes(32).toString("base64url");
      const proxyCodeChallenge = createHash("sha256")
        .update(proxyCodeVerifier)
        .digest("base64url");

      // Correlate the callback via either a sealed state (stateless mode) or
      // a random UUID stored in the pendingAuth LRU (legacy mode).
      const stateless = this._stateless;
      const proxyState = stateless
        ? mintPendingAuthState(stateless.material, {
            clientId: client.client_id,
            clientRedirectUri: params.redirectUri,
            clientState: params.state,
            clientCodeChallenge: params.codeChallenge,
            proxyCodeVerifier,
          })
        : randomUUID();

      if (!stateless) {
        // Store the client's original params so /callback can redirect back.
        // Stateless mode carries these inside proxyState itself.
        this._pendingAuth.set(proxyState, {
          clientId: client.client_id,
          clientRedirectUri: params.redirectUri,
          clientState: params.state,
          clientCodeChallenge: params.codeChallenge,
          proxyCodeVerifier,
          createdAt: Date.now(),
        });
      }

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
    client: OAuthClientInformationFull,
    authorizationCode: string,
    codeVerifier?: string,
    redirectUri?: string,
    resource?: URL
  ): Promise<OAuthTokens> {
    let tokens: OAuthTokens;
    /** Reserved sealed-code hash + id; released on failure, committed on success. */
    let reservedProxyCode: { hash: string; id: string } | null = null;
    /**
     * Legacy (non-stateless) proxy code taken from `_storedTokens` before
     * binding checks. Restored on binding/PKCE failure so a wrong verifier
     * cannot burn the code for the legitimate client.
     */
    let legacyRestorable: { code: string; entry: StoredTokenEntry } | null = null;

    try {
      if (this._callbackProxyEnabled) {
        // --- Callback proxy mode ---
        // The authorizationCode is a proxy code we generated in handleCallback().
        // It is either a sealed token (stateless mode) or a random UUID that
        // keys into the _storedTokens LRU (legacy mode).
        // A code that is unknown, expired, already used, or fails the client,
        // redirect_uri or PKCE binding is invalid_grant, and a missing
        // code_verifier is invalid_request (RFC 6749 §5.2, RFC 7636 §4.6), so
        // the client restarts authorization. Only transient conditions
        // (exchange in progress, replay cache full) are ServerError.
        const stateless = this._stateless;
        let entry: {
          tokens: OAuthTokens;
          clientId: string;
          clientCodeChallenge: string;
          clientRedirectUri: string;
        } | null = null;

        if (stateless && looksLikeStatelessStoredTokensCode(authorizationCode)) {
          const codeHash = createHash("sha256").update(authorizationCode).digest("hex");
          let reserved;
          try {
            reserved = this._usedProxyCodes.tryReserve(
              codeHash,
              stateless.storedTtlSeconds
            );
            if (!reserved.ok) {
              if (reserved.reason === "pending") {
                throw new ServerError(
                  "Authorization code exchange in progress — please retry"
                );
              }
              throw new InvalidGrantError("Authorization code already used");
            }
          } catch (err) {
            if (err instanceof Error && err.message === PROXY_CODE_CACHE_FULL) {
              logger.warn(
                {
                  cacheSize: this._usedProxyCodes.size,
                  cacheMaxSize: this._usedProxyCodes.maxSize,
                },
                "Proxy code replay cache at capacity"
              );
              throw new ServerError(
                "Authorization server busy — please retry the OAuth flow"
              );
            }
            throw err;
          }
          reservedProxyCode = { hash: codeHash, id: reserved.reservationId };

          const payload = openStoredTokensCode(
            stateless.material,
            authorizationCode,
            stateless.storedTtlSeconds
          );
          if (!payload) {
            throw new InvalidGrantError("Invalid or expired authorization code");
          }
          entry = {
            tokens: payload.t,
            clientId: payload.cid,
            clientCodeChallenge: payload.ccc,
            clientRedirectUri: payload.cru,
          };
          // NOTE: Cross-pod one-time use still requires a shared store. Replay
          // across pods is mitigated by short TTL (default 120s) + client PKCE.
          // Documented in stateless/stored-tokens.ts.
        } else {
          // Atomic take: serialize concurrent exchanges. Restored below if
          // client/redirect/PKCE binding checks fail (DoS prevention).
          const lru = this._storedTokens.getAndDelete(authorizationCode);
          if (!lru) {
            throw new InvalidGrantError("Invalid or expired authorization code");
          }
          if (Date.now() - lru.createdAt > PENDING_AUTH_TTL_MS) {
            throw new InvalidGrantError("Authorization code expired — please restart the OAuth flow");
          }
          legacyRestorable = { code: authorizationCode, entry: lru };
          entry = {
            tokens: lru.tokens,
            clientId: lru.clientId,
            clientCodeChallenge: lru.clientCodeChallenge,
            clientRedirectUri: lru.clientRedirectUri,
          };
        }

        // Bind the proxy code to the client and redirect_uri that initiated
        // /authorize, preserving the normal OAuth authorization-code invariant.
        // Binding + PKCE run while consumption is only *reserved* (pending /
        // restorable); failed checks release so the legitimate client can retry.
        if (client.client_id !== entry.clientId) {
          throw new InvalidGrantError("Invalid client for authorization code");
        }
        if (redirectUri !== entry.clientRedirectUri) {
          throw new InvalidGrantError("Invalid redirect_uri for authorization code");
        }

        // Verify client PKCE: the client's code_verifier must match the
        // code_challenge stored during /authorize.
        if (entry.clientCodeChallenge) {
          if (!codeVerifier) {
            throw new InvalidRequestError("PKCE code_verifier is required");
          }
          const computed = createHash("sha256").update(codeVerifier).digest("base64url");
          if (computed !== entry.clientCodeChallenge) {
            throw new InvalidGrantError("PKCE verification failed");
          }
        }

        tokens = entry.tokens;
      } else {
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
          throw tokenEndpointError("Token exchange", response.status, body);
        }

        const data = await response.json();
        tokens = OAuthTokensSchema.parse(data);
      }

      if (!(await this.isAllowedGroupMember(tokens.access_token))) {
        logger.warn(
          { allowedGroups: this._allowedGroups },
          "Token issuance denied: user is not a member of any allowed group"
        );
        throw new InvalidGrantError(GROUP_ACCESS_DENIED_MESSAGE);
      }

      // All checks passed — permanently consume the proxy code.
      legacyRestorable = null;
      if (reservedProxyCode) {
        this._usedProxyCodes.commit(reservedProxyCode.hash, reservedProxyCode.id);
        reservedProxyCode = null;
      }

      if (this._disableRefreshToken) {
        // Without a refresh_token the client cannot renew silently and has to
        // restart authorization once the access token expires.
        const { refresh_token: _refreshToken, ...withoutRefresh } = tokens;
        return withoutRefresh;
      }
      return tokens;
    } catch (err) {
      if (legacyRestorable) {
        this._storedTokens.set(legacyRestorable.code, legacyRestorable.entry);
      }
      if (reservedProxyCode) {
        this._usedProxyCodes.release(reservedProxyCode.hash, reservedProxyCode.id);
      }
      throw err;
    }
  }

  /**
   * Returns true when no allowed groups are configured, or when the token
   * owner belongs to one of them (see _checkGroupMembership). Results are
   * cached per token for GROUP_MEMBERSHIP_CACHE_TTL_MS; failed lookups are not.
   */
  async isAllowedGroupMember(token: string): Promise<boolean> {
    if (!this._allowedGroups) return true;

    const key = createHash("sha256").update(token).digest("hex");
    const cached = this._groupMembershipCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.isMember;

    const isMember = await this._checkGroupMembership(token);
    this._groupMembershipCache.set(key, {
      isMember,
      expiresAt: Date.now() + GROUP_MEMBERSHIP_CACHE_TTL_MS,
    });
    return isMember;
  }

  /**
   * Returns true if the token owner belongs to at least one group whose
   * full_path equals or is a sub-path of any configured allowed group.
   *
   * Example: allowedGroups=["my-org"] allows members of "my-org",
   * "my-org/team-a", "my-org/team-a/squad-1", etc.
   *
   * Throws when GitLab is unavailable (5xx / 429) so the result is not cached.
   */
  private async _checkGroupMembership(token: string): Promise<boolean> {
    const allowedPaths = this._allowedGroups!.map((g) => g.toLowerCase());
    let page = 1;

    while (true) {
      const res = await fetch(`${this._gitlabBaseUrl}/api/v4/groups?min_access_level=10&per_page=100&page=${page}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });

      if (res.status >= 500 || res.status === 429) {
        await res.body?.cancel();
        throw new ServerError(`Group membership lookup failed: ${res.status}`);
      }
      if (!res.ok) break;

      const groups = (await res.json()) as Array<{ full_path: string }>;

      if (groups.length === 0) break;

      const matched = groups.some((g) => {
        const fp = g.full_path.toLowerCase();
        return allowedPaths.some((allowed) => fp === allowed || fp.startsWith(`${allowed}/`));
      });

      if (matched) return true;

      const totalPages = Number.parseInt(res.headers.get("x-total-pages") ?? "1", 10);

      if (page >= totalPages) break;

      page++;
    }

    return false;
  }

  // ---- Refresh token -----------------------------------------------------

  async exchangeRefreshToken(
    _client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL
  ): Promise<OAuthTokens> {
    if (this._disableRefreshToken) {
      // invalid_grant makes MCP clients drop stored tokens and restart the
      // authorization_code flow; GitLab is not contacted.
      throw new InvalidGrantError(REFRESH_TOKEN_DISABLED_MESSAGE);
    }

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
      throw tokenEndpointError("Token refresh", response.status, body);
    }

    const data = await response.json();
    const tokens = OAuthTokensSchema.parse(data);

    if (!(await this.isAllowedGroupMember(tokens.access_token))) {
      logger.warn(
        { allowedGroups: this._allowedGroups },
        "Token refresh denied: user is not a member of any allowed group"
      );
      throw new InvalidGrantError(GROUP_ACCESS_DENIED_MESSAGE);
    }

    return tokens;
  }

  // ---- Verify access token -----------------------------------------------

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    let res = await fetch(`${this._gitlabBaseUrl}/oauth/token/info`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      // Some GitLab instances sit behind an edge cache that strips the
      // Authorization header on /oauth/* paths (observed on
      // git.drupalcode.org, fronted by Varnish), so a valid token 401s
      // here while working fine against /api/v4. Doorkeeper also accepts
      // the RFC 6750 access_token query parameter — retry with that form
      // before rejecting the token.
      res = await fetch(
        `${this._gitlabBaseUrl}/oauth/token/info?access_token=${encodeURIComponent(token)}`
      );
    }

    if (!res.ok) {
      throw new InvalidTokenError("Invalid or expired GitLab OAuth token");
    }

    const info = (await res.json()) as GitLabTokenInfo;

    // 403 rather than 401: the token itself is valid, so asking the client to
    // re-authenticate as the same user would not help.
    if (!(await this.isAllowedGroupMember(token))) {
      throw new InsufficientScopeError(GROUP_ACCESS_DENIED_MESSAGE);
    }

    return {
      token,
      clientId: info.application?.uid ?? "dynamic",
      scopes: info.scopes ?? [],
      expiresAt:
        info.expires_in_seconds != null
          ? Math.floor(Date.now() / 1000) + info.expires_in_seconds
          : undefined,
      // GitLab user id; stateful /mcp sessions are bound to it.
      extra: { resourceOwnerId: info.resource_owner_id },
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

    if (
      invalidQueryParam(req.query.code) ||
      invalidQueryParam(req.query.state) ||
      invalidQueryParam(req.query.error) ||
      invalidQueryParam(req.query.error_description)
    ) {
      res.status(400).send("Invalid query parameter");
      return;
    }

    const code = singleQueryParam(req.query.code);
    const state = singleQueryParam(req.query.state);
    const error = singleQueryParam(req.query.error);
    const errorDescription = singleQueryParam(req.query.error_description) ?? "(no description)";

    if (error) {
      logger.error(`GitLab OAuth error: ${error} — ${errorDescription}`);
      res.status(400).send("Authorization failed");
      return;
    }

    if (!code || !state) {
      res.status(400).send("Missing code or state parameter");
      return;
    }

    // Look up the pending auth transaction. The sealed-state path carries
    // the transaction inline; the legacy path fetches it from the LRU.
    // Both produce the same normalized shape below.
    const stateless = this._stateless;
    let pending: {
      clientId: string;
      clientRedirectUri: string;
      clientState: string | undefined;
      clientCodeChallenge: string;
      proxyCodeVerifier: string;
    } | null = null;

    if (stateless && looksLikeStatelessState(state)) {
      const payload = openPendingAuthState(
        stateless.material,
        state,
        stateless.pendingTtlSeconds
      );
      if (!payload) {
        res.status(400).send("Unknown or expired state parameter");
        return;
      }
      pending = {
        clientId: payload.cid,
        clientRedirectUri: payload.cru,
        clientState: payload.cs,
        clientCodeChallenge: payload.ccc,
        proxyCodeVerifier: payload.pcv,
      };
    } else {
      const lru = this._pendingAuth.getAndDelete(state);
      if (!lru) {
        res.status(400).send("Unknown or expired state parameter");
        return;
      }
      if (Date.now() - lru.createdAt > PENDING_AUTH_TTL_MS) {
        res.status(400).send("Authorization request expired");
        return;
      }
      pending = {
        clientId: lru.clientId,
        clientRedirectUri: lru.clientRedirectUri,
        clientState: lru.clientState,
        clientCodeChallenge: lru.clientCodeChallenge,
        proxyCodeVerifier: lru.proxyCodeVerifier,
      };
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

      let tokens = OAuthTokensSchema.parse(await tokenResponse.json());
      if (this._disableRefreshToken) {
        // Drop the refresh_token before it is stored in the LRU or sealed into
        // the proxy code that travels through the browser.
        const { refresh_token: _refreshToken, ...withoutRefresh } = tokens;
        tokens = withoutRefresh;
      }

      // Generate a proxy auth code for the MCP client. Sealed in stateless
      // mode; random UUID + LRU entry in legacy mode.
      const proxyCode = stateless
        ? mintStoredTokensCode(stateless.material, {
            tokens,
            clientId: pending.clientId,
            clientRedirectUri: pending.clientRedirectUri,
            clientCodeChallenge: pending.clientCodeChallenge,
          })
        : (() => {
            const id = randomUUID();
            this._storedTokens.set(id, {
              tokens,
              clientId: pending!.clientId,
              clientCodeChallenge: pending!.clientCodeChallenge,
              clientRedirectUri: pending!.clientRedirectUri,
              createdAt: Date.now(),
            });
            return id;
          })();

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
 * @param stateless      Optional stateless-mode options. When set, DCR and later
 *                        callback-proxy state is encoded into opaque OAuth values
 *                        instead of an in-memory cache, enabling multi-pod deploys.
 * @param allowedRedirectUris  Callback proxy mode only: client redirect URIs that
 *                        may register and receive codes (see oauth-consent.ts).
 * @param disableRefreshToken  When true, issued tokens omit refresh_token and the
 *                        refresh_token grant fails with invalid_grant, so clients
 *                        re-authorize in the browser after access-token expiry.
 */
export function createGitLabOAuthProvider(
  gitlabBaseUrl: string,
  gitlabAppId: string,
  resourceName = "GitLab MCP Server",
  readOnly = false,
  customScopes?: string[],
  allowedGroups?: string[],
  callbackProxyEnabled = false,
  callbackUrl = "",
  stateless: StatelessOAuthOptions | null = null,
  allowedRedirectUris: readonly string[] = DEFAULT_ALLOWED_REDIRECT_URIS,
  disableRefreshToken = false
): GitLabOAuthServerProvider {
  return new GitLabOAuthServerProvider(
    gitlabBaseUrl,
    gitlabAppId,
    resourceName,
    readOnly,
    customScopes,
    allowedGroups,
    callbackProxyEnabled,
    callbackUrl,
    stateless,
    allowedRedirectUris,
    disableRefreshToken
  );
}
