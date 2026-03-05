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
 * any in-memory client store.
 */

import { ProxyOAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

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
 * Build a ProxyOAuthServerProvider wired to the given GitLab instance.
 *
 * @param gitlabBaseUrl  Root URL of the GitLab instance, e.g. "https://gitlab.com"
 *                       (no trailing slash, no /api/v4 suffix).
 */
export function createGitLabOAuthProvider(gitlabBaseUrl: string): ProxyOAuthServerProvider {
  const endpoints = {
    authorizationUrl: `${gitlabBaseUrl}/oauth/authorize`,
    tokenUrl: `${gitlabBaseUrl}/oauth/token`,
    revocationUrl: `${gitlabBaseUrl}/oauth/revoke`,
    // GitLab supports open DCR — no auth required on /oauth/register
    registrationUrl: `${gitlabBaseUrl}/oauth/register`,
  };

  return new ProxyOAuthServerProvider({
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
     * Return a minimal stub for dynamically registered clients.
     *
     * getClient is called by the SDK during token exchange to look up the client.
     * With open DCR + PKCE public clients, GitLab validates the client — the MCP
     * server never stores credentials. We return a stub so the SDK does not reject
     * unknown client_ids before forwarding the request upstream.
     */
    getClient: async (clientId: string) => {
      return {
        client_id: clientId,
        redirect_uris: [],
        // Public client — no secret, PKCE required
        token_endpoint_auth_method: "none" as const,
      };
    },
  });
}
