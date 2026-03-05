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
 * Extends ProxyOAuthServerProvider to add an in-memory client cache.
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
 * then return the cached entry from `getClient`.
 */
class GitLabProxyOAuthServerProvider extends ProxyOAuthServerProvider {
  private readonly _clientCache = new Map<string, OAuthClientInformationFull>();

  override get clientsStore(): OAuthRegisteredClientsStore {
    const base = super.clientsStore;
    const cache = this._clientCache;

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

      // Wrap registerClient to cache the GitLab DCR response.
      // The SDK forwards the DCR request to GitLab and returns its response;
      // we cache it here before passing it back so getClient works later.
      ...(base.registerClient && {
        registerClient: async (
          client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">
        ) => {
          const registered = await base.registerClient!(client);
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
 */
export function createGitLabOAuthProvider(
  gitlabBaseUrl: string
): GitLabProxyOAuthServerProvider {
  const endpoints = {
    authorizationUrl: `${gitlabBaseUrl}/oauth/authorize`,
    tokenUrl: `${gitlabBaseUrl}/oauth/token`,
    revocationUrl: `${gitlabBaseUrl}/oauth/revoke`,
    // GitLab supports open DCR — no auth required on /oauth/register
    registrationUrl: `${gitlabBaseUrl}/oauth/register`,
  };

  return new GitLabProxyOAuthServerProvider({
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
     * This is the base getClient — it only runs when the cache misses.
     * The GitLabProxyOAuthServerProvider.clientsStore getter wraps this
     * with cache lookup first, so this path only fires for unknown client_ids
     * (e.g. token exchange before a cached registration exists).
     */
    getClient: async (clientId: string) => {
      return {
        client_id: clientId,
        redirect_uris: [] as string[],
        token_endpoint_auth_method: "none" as const,
      };
    },
  });
}
