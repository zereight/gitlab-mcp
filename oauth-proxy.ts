/**
 * MCP OAuth Proxy — GitLab upstream
 *
 * Builds a ProxyOAuthServerProvider that delegates all OAuth operations
 * (authorize, token exchange, refresh, revocation, DCR) to a GitLab instance.
 *
 * Activated when GITLAB_MCP_OAUTH=true. All other auth modes are unaffected.
 *
 * GitLab supports open Dynamic Client Registration (no auth needed), so the
 * SDK's built-in DCR handler proxies POST /register straight to GitLab without
 * any in-memory client store — except that we must cache the DCR response so
 * the SDK's authorize handler can validate redirect_uris on subsequent requests.
 */

import { ProxyOAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";

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

/**
 * Maximum number of DCR client registrations to keep in memory.
 *
 * Each entry is ~500 bytes (client_id, redirect_uris, metadata).
 * At the limit this is ~500 KB — negligible — but the cap prevents
 * unbounded growth if POST /register is called abusively.
 *
 * Real-world usage: one entry per distinct MCP client app
 * (Claude.ai, Cursor, VS Code extension, …) — typically < 10.
 */
const CLIENT_CACHE_MAX_SIZE = 1000;

/**
 * Bounded LRU cache for OAuth client registrations.
 *
 * JavaScript's Map preserves insertion order and `delete` + re-`set`
 * moves an entry to the tail, giving O(1) LRU semantics without any
 * external dependency.
 */
class BoundedClientCache {
  private readonly _map = new Map<string, OAuthClientInformationFull>();
  private readonly _maxSize: number;

  constructor(maxSize: number) {
    this._maxSize = maxSize;
  }

  get(clientId: string): OAuthClientInformationFull | undefined {
    const entry = this._map.get(clientId);
    if (entry) {
      // Refresh to tail (most-recently-used)
      this._map.delete(clientId);
      this._map.set(clientId, entry);
    }
    return entry;
  }

  set(clientId: string, client: OAuthClientInformationFull): void {
    if (this._map.has(clientId)) {
      this._map.delete(clientId);
    } else if (this._map.size >= this._maxSize) {
      // Evict the least-recently-used entry (head of the Map)
      const lruKey = this._map.keys().next().value;
      if (lruKey !== undefined) this._map.delete(lruKey);
    }
    this._map.set(clientId, client);
  }

  get size(): number {
    return this._map.size;
  }
}

/**
 * Extends ProxyOAuthServerProvider to add a bounded LRU client cache.
 *
 * ### Why the cache is needed
 *
 * The SDK's authorize handler calls `clientsStore.getClient(clientId)` to
 * validate `redirect_uri` before invoking `provider.authorize()`. With pure
 * GitLab DCR, the client is stored in GitLab — the MCP server never keeps a
 * copy. If `getClient` returns an empty stub (redirect_uris: []), the SDK
 * rejects the request with "Unregistered redirect_uri" before the proxy can
 * forward the authorization request to GitLab.
 *
 * Solution: intercept `clientsStore.registerClient` to cache each DCR response,
 * then return the cached entry from `getClient`. The cache is capped at
 * CLIENT_CACHE_MAX_SIZE entries with LRU eviction to prevent memory growth.
 */
class GitLabProxyOAuthServerProvider extends ProxyOAuthServerProvider {
  private readonly _clientCache = new BoundedClientCache(CLIENT_CACHE_MAX_SIZE);
  private readonly _resourceName: string;

  constructor(
    options: ConstructorParameters<typeof ProxyOAuthServerProvider>[0],
    resourceName: string
  ) {
    super(options);
    this._resourceName = resourceName;
  }

  override get clientsStore(): OAuthRegisteredClientsStore {
    const base = super.clientsStore;
    const cache = this._clientCache;
    const resourceName = this._resourceName;

    return {
      // Return cached client when available; fall back to a public-client stub.
      // The stub covers the token-exchange path where GitLab is the validator.
      getClient: async (clientId: string) => {
        const cached = cache.get(clientId);
        if (cached) return cached;

        return {
          client_id: clientId,
          redirect_uris: [],
          token_endpoint_auth_method: "none" as const,
        };
      },

      // Wrap registerClient to:
      //   1. Annotate client_name so the GitLab consent screen reads
      //      "[Unverified Dynamic Application] <client> via <resourceName>"
      //      instead of just "[Unverified Dynamic Application] <client>".
      //   2. Cache the full GitLab DCR response so getClient() can return
      //      the real redirect_uris for authorize-handler validation.
      ...(base.registerClient && {
        registerClient: async (
          client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">
        ) => {
          const annotated = {
            ...client,
            client_name: client.client_name
              ? `${client.client_name} via ${resourceName}`
              : resourceName,
          };
          const registered = await base.registerClient!(annotated);
          cache.set(registered.client_id, registered);
          return registered;
        },
      }),
    };
  }
}

/**
 * Build a GitLabProxyOAuthServerProvider wired to the given GitLab instance.
 *
 * @param gitlabBaseUrl  Root URL of the GitLab instance, e.g. "https://gitlab.com"
 *                       (no trailing slash, no /api/v4 suffix).
 * @param resourceName   Human-readable server name appended to the client_name
 *                       sent to GitLab during DCR, e.g. "GitLab MCP Server".
 *                       GitLab displays this on the OAuth consent screen as:
 *                       "[Unverified Dynamic Application] <client> via <resourceName>"
 */
export function createGitLabOAuthProvider(
  gitlabBaseUrl: string,
  resourceName = "GitLab MCP Server"
): GitLabProxyOAuthServerProvider {
  const endpoints = {
    authorizationUrl: `${gitlabBaseUrl}/oauth/authorize`,
    tokenUrl: `${gitlabBaseUrl}/oauth/token`,
    revocationUrl: `${gitlabBaseUrl}/oauth/revoke`,
    // GitLab supports open DCR — no auth required on /oauth/register
    registrationUrl: `${gitlabBaseUrl}/oauth/register`,
  };

  return new GitLabProxyOAuthServerProvider(
    {
      endpoints,

      /**
       * Validate an access token by calling GitLab's lightweight token info endpoint.
       * Does not require client credentials — a Bearer token is sufficient.
       */
      verifyAccessToken: async (token: string): Promise<AuthInfo> => {
        const res = await fetch(`${gitlabBaseUrl}/oauth/token/info`, {
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
          // GitLab returns seconds remaining; convert to absolute epoch-seconds
          expiresAt:
            info.expires_in_seconds != null
              ? Math.floor(Date.now() / 1000) + info.expires_in_seconds
              : undefined,
        };
      },

      /**
       * Base getClient — runs only on cache miss (see GitLabProxyOAuthServerProvider).
       */
      getClient: async (clientId: string) => {
        return {
          client_id: clientId,
          redirect_uris: [] as string[],
          token_endpoint_auth_method: "none" as const,
        };
      },
    },
    resourceName
  );
}
