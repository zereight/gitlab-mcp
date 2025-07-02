import { ProxyOAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js';
import { config } from './config.js';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { OAuthClientInformationFull, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { Request, Response } from 'express';
import { logger } from './logger.js';

// Custom provider that handles dynamic registration and maps to GitLab OAuth
class GitLabProxyProvider extends ProxyOAuthServerProvider {
  // Store for dynamically registered clients
  private clientRegistry = new Map<string, OAuthClientInformationFull>();

  // Map client IDs to their redirect URIs
  private clientRedirectUris = new Map<string, string[]>();

  // Map OAuth state parameters to client redirect URIs with timestamps
  private stateToRedirectUri = new Map<string, { redirectUri: string; timestamp: number }>();

  // Map access tokens to auth info
  private tokenToAuthInfo = new Map<string, { authInfo: AuthInfo; gitlabToken: string; timestamp: number }>();

  // State expiry time in milliseconds (15 minutes)
  private readonly STATE_EXPIRY_MS = 15 * 60 * 1000;

  // Token expiry time in milliseconds (1 hour)
  private readonly TOKEN_EXPIRY_MS = 60 * 60 * 1000;

  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout;

  constructor(options: any) {
    super(options);

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();

      // Clean up expired state mappings
      for (const [state, mapping] of this.stateToRedirectUri.entries()) {
        if (now - mapping.timestamp > this.STATE_EXPIRY_MS) {
          this.stateToRedirectUri.delete(state);
          logger.debug(`Cleaned up expired state mapping: ${state}`);
        }
      }

      // Clean up expired tokens
      for (const [token, info] of this.tokenToAuthInfo.entries()) {
        if (now - info.timestamp > this.TOKEN_EXPIRY_MS) {
          this.tokenToAuthInfo.delete(token);
          logger.debug(`Cleaned up expired token`);
        }
      }
    }, 5 * 60 * 1000);
  }
  get clientsStore() {
    return {
      getClient: async (clientId: string) => {
        // Check if this is a registered dynamic client
        const client = this.clientRegistry.get(clientId);
        if (client) {
          return client;
        }

        // Check if this is the actual GitLab client
        if (clientId === config.GITLAB_OAUTH2_CLIENT_ID) {
          return {
            client_id: config.GITLAB_OAUTH2_CLIENT_ID!,
            client_secret: config.GITLAB_OAUTH2_CLIENT_SECRET!,
            redirect_uris: [config.GITLAB_OAUTH2_REDIRECT_URL!],
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            token_endpoint_auth_method: 'client_secret_post'
          };
        }

        return undefined;
      },

      registerClient: async (clientMetadata: any) => {
        // Generate a unique client ID for this MCP client
        const clientId = `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Store the client's redirect URIs
        this.clientRedirectUris.set(clientId, clientMetadata.redirect_uris || []);

        // Create the client registration
        const client: OAuthClientInformationFull = {
          ...clientMetadata,
          client_id: clientId,
          client_secret: `secret_${Math.random().toString(36).substr(2, 20)}`,
          client_id_issued_at: Math.floor(Date.now() / 1000),
          grant_types: clientMetadata.grant_types || ['authorization_code', 'refresh_token'],
          response_types: clientMetadata.response_types || ['code'],
          token_endpoint_auth_method: clientMetadata.token_endpoint_auth_method || 'client_secret_post'
        };

        // Store the client
        this.clientRegistry.set(clientId, client);

        return client;
      }
    };
  }

  // Override authorization to use GitLab OAuth credentials
  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    // Store the mapping between state and client's actual redirect URI with timestamp
    if (params.state && params.redirectUri) {
      this.stateToRedirectUri.set(params.state, {
        redirectUri: params.redirectUri,
        timestamp: Date.now()
      });
      console.log(`Stored state mapping: ${params.state} -> ${params.redirectUri} at ${new Date().toISOString()}`);
    }

    // Construct the authorization URL directly to ensure proper formatting
    const authUrl = new URL(this._endpoints.authorizationUrl);

    // Add required OAuth parameters
    authUrl.searchParams.set('client_id', config.GITLAB_OAUTH2_CLIENT_ID!);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', config.GITLAB_OAUTH2_REDIRECT_URL!.trim());
    authUrl.searchParams.set('code_challenge', params.codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    // Add optional parameters
    if (params.state) {
      authUrl.searchParams.set('state', params.state);
    }


    const gitlabScopes = ['api', 'openid','profile','email'];
    authUrl.searchParams.set('scope', gitlabScopes.join(' '));

    // GitLab doesn't support the 'resource' parameter, so we skip it

    console.log(`Redirecting to GitLab OAuth:`, {
      url: authUrl.toString(),
      scopes: gitlabScopes,
      requested_scopes: params.scopes
    });

    // Redirect to GitLab
    res.redirect(authUrl.toString());
  }

  // Method to get redirect URI from state
  getRedirectUriFromState(state: string): { redirectUri: string; timestamp: number } | undefined {
    return this.stateToRedirectUri.get(state);
  }

  // Method to delete state mapping
  deleteStateMapping(state: string): void {
    this.stateToRedirectUri.delete(state);
  }

  // Method to verify token
  verifyToken(token: string): { authInfo: AuthInfo; gitlabToken: string; timestamp: number } | undefined {
    const tokenInfo = this.tokenToAuthInfo.get(token);

    if (!tokenInfo) {
      return undefined;
    }

    // Check if token has expired
    if (Date.now() - tokenInfo.timestamp > this.TOKEN_EXPIRY_MS) {
      this.tokenToAuthInfo.delete(token);
      return undefined;
    }

    // Check if token has an explicit expiry time
    if (tokenInfo.authInfo.expiresAt && tokenInfo.authInfo.expiresAt < Math.floor(Date.now() / 1000)) {
      this.tokenToAuthInfo.delete(token);
      return undefined;
    }

    return tokenInfo;
  }

  // Override token exchange to use GitLab OAuth credentials
  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    codeVerifier?: string,
    redirectUri?: string,
    resource?: URL
  ): Promise<OAuthTokens> {
    // Use GitLab OAuth credentials for token exchange
    const gitlabClient = {
      ...client,
      client_id: config.GITLAB_OAUTH2_CLIENT_ID!,
      client_secret: config.GITLAB_OAUTH2_CLIENT_SECRET!,
      redirect_uris: [config.GITLAB_OAUTH2_REDIRECT_URL!]
    };

    // Use GitLab's redirect URI for the token exchange
    const tokens = await super.exchangeAuthorizationCode(
      gitlabClient,
      authorizationCode,
      codeVerifier,
      config.GITLAB_OAUTH2_REDIRECT_URL!,
      resource
    );

    // Store the token mapping for our own verification
    if (tokens.access_token) {
      const authInfo: AuthInfo = {
        token: tokens.access_token,
        clientId: client.client_id,
        scopes: tokens.scope ? tokens.scope.split(' ') : [],
        expiresAt: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : undefined
      };

      this.tokenToAuthInfo.set(tokens.access_token, {
        authInfo,
        gitlabToken: tokens.access_token, // The GitLab token is the same as our proxy token
        timestamp: Date.now()
      });
    }

    return tokens;
  }

  // Override verifyAccessToken to use our internal token store
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const tokenInfo = this.verifyToken(token);

    if (!tokenInfo) {
      throw new Error('Invalid or expired token');
    }

    return tokenInfo.authInfo;
  }

  // Handle OAuth callback and redirect to client's actual callback URL
  handleOAuthCallback = (req: Request, res: Response): void => {
    const { code, state, error, error_description } = req.query;

    logger.debug('OAuth callback received:', { code: !!code, state, error });

    if (!state) {
      res.status(400).send('Missing state parameter');
      return;
    }

    // Get the client's actual redirect URI with timestamp
    const stateMapping = this.getRedirectUriFromState(state as string);

    if (!stateMapping) {
      console.error(`No redirect URI found for state: ${state}`);
      res.status(400).send('Invalid state parameter');
      return;
    }

    // Check if the state mapping has expired
    if (Date.now() - stateMapping.timestamp > this.STATE_EXPIRY_MS) {
      console.error(`State mapping expired for state: ${state}`);
      this.deleteStateMapping(state as string);
      res.status(400).send('State parameter expired');
      return;
    }

    const clientRedirectUri = stateMapping.redirectUri;

    // Clean up the state mapping
    this.deleteStateMapping(state as string);

    // Build the redirect URL with all parameters
    const redirectUrl = new URL(clientRedirectUri);

    // Pass through all query parameters
    if (code) redirectUrl.searchParams.set('code', code as string);
    if (state) redirectUrl.searchParams.set('state', state as string);
    if (error) redirectUrl.searchParams.set('error', error as string);
    if (error_description) redirectUrl.searchParams.set('error_description', error_description as string);

    logger.debug(`Redirecting to client callback: ${redirectUrl.toString()}`);

    // Redirect to the client's actual callback URL
    res.redirect(redirectUrl.toString());
  }

  // Create OAuth2 router
  createOAuth2Router() {
    if (!config.GITLAB_OAUTH2_BASE_URL) {
      throw new Error("GITLAB_OAUTH2_BASE_URL is not set")
    }

    return mcpAuthRouter({
      issuerUrl: new URL(config.GITLAB_OAUTH2_BASE_URL),
      baseUrl: new URL(config.GITLAB_OAUTH2_BASE_URL),
      authorizationOptions: {
      },
      provider: this,
    })
  }

  // Create token verifier
  createTokenVerifier() {
    const tokenVerifier = {
      verifyAccessToken: async (token: string) => {
        return this.verifyAccessToken(token);
      }
    }

    return tokenVerifier
  }

  // Get GitLab token from our proxy token
  getGitLabTokenFromProxyToken(proxyToken: string): string | undefined {
    const tokenInfo = this.verifyToken(proxyToken);
    return tokenInfo?.gitlabToken;
  }
}

// Export the provider class
export { GitLabProxyProvider };

// Create the GitLab OAuth provider
export const createGitLabOAuthProvider = () => {
  if(!config.GITLAB_OAUTH2_AUTHORIZATION_URL) {
    throw new Error("GITLAB_OAUTH2_AUTHORIZATION_URL is not set")
  }
  if(!config.GITLAB_OAUTH2_CLIENT_ID) {
    throw new Error("GITLAB_OAUTH2_CLIENT_ID is not set")
  }
  if(!config.GITLAB_OAUTH2_REDIRECT_URL) {
    throw new Error("GITLAB_OAUTH2_REDIRECT_URIS is not set")
  }
  if(!config.GITLAB_OAUTH2_TOKEN_URL) {
    throw new Error("GITLAB_OAUTH2_TOKEN_URL is not set")
  }
  if(!config.GITLAB_OAUTH2_ISSUER_URL) {
    throw new Error("GITLAB_OAUTH2_ISSUER_URL is not set")
  }
  if (!config.GITLAB_OAUTH2_BASE_URL) {
    throw new Error("GITLAB_OAUTH2_BASE_URL is not set")
  }

  const provider = new GitLabProxyProvider({
    endpoints: {
      authorizationUrl: config.GITLAB_OAUTH2_AUTHORIZATION_URL,
      tokenUrl: config.GITLAB_OAUTH2_TOKEN_URL,
      revocationUrl: config.GITLAB_OAUTH2_REVOCATION_URL,
    },
    verifyAccessToken: async () => {
      // This will be overridden by the class method
      throw new Error('Should not be called');
    },
    getClient: async (client_id: string) => {
      // This is handled by our custom provider's clientsStore
      return undefined;
    }
  })

  return provider;
}


