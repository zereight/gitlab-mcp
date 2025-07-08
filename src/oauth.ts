import { ProxyOAuthServerProvider, ProxyOptions } from '@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js';
import { config } from './config.js';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { OAuthClientInformationFull, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import { Request, Response } from 'express';
import { logger } from './logger.js';
import { Database } from 'better-sqlite3';
import argon2 from '@node-rs/argon2';
import { randomBytes } from 'crypto';

// Custom provider that handles dynamic registration and maps to GitLab OAuth
class GitLabProxyProvider extends ProxyOAuthServerProvider {
  // Static async factory method
  static async New(options: any): Promise<GitLabProxyProvider> {
    // we put this here so we dont initialize this unless we are using the oauth provider
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(config.GITLAB_OAUTH2_DB_PATH);

    // Create tables if they don't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS oauth_clients (
        client_id TEXT PRIMARY KEY,
        client_secret TEXT NOT NULL,
        redirect_uris TEXT NOT NULL,
        grant_types TEXT NOT NULL,
        response_types TEXT NOT NULL,
        token_endpoint_auth_method TEXT NOT NULL,
        client_id_issued_at INTEGER NOT NULL,
        metadata TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS client_redirect_uris (
        client_id TEXT PRIMARY KEY,
        redirect_uris TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS state_mappings (
        state TEXT PRIMARY KEY,
        redirect_uri TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS access_tokens (
        token_hash TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        scopes TEXT NOT NULL,
        expires_at INTEGER,
        timestamp INTEGER NOT NULL
      );
    `);

    const provider = new GitLabProxyProvider(options, db);
    return provider;
  }

  // State expiry time in milliseconds (15 minutes)
  private readonly STATE_EXPIRY_MS = 15 * 60 * 1000;

  // Token expiry time in milliseconds (7 days)
  private readonly TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout;

  private db: Database

  constructor(options: ProxyOptions, db: Database) {
    super(options);
    this.db = db;

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();

      try {
        // Clean up expired state mappings
        db.prepare('DELETE FROM state_mappings WHERE timestamp < ?').run(now - this.STATE_EXPIRY_MS);

        // Clean up expired tokens
        db.prepare('DELETE FROM access_tokens WHERE timestamp < ? OR (expires_at IS NOT NULL AND expires_at < ?)')
          .run(now - this.TOKEN_EXPIRY_MS, Math.floor(now / 1000));
      } catch (err) {
        logger.error('Error during cleanup:', err);
      }
    }, 5 * 60 * 1000);
  }
  get clientsStore(): OAuthRegisteredClientsStore {
    return {
      getClient: async (clientId: string) => {
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

        // Check if this is a registered dynamic client
        const row = this.db.prepare('SELECT * FROM oauth_clients WHERE client_id = ?').get(clientId) as {
          client_id: string;
          client_secret: string;
          redirect_uris: string;
          grant_types: string;
          response_types: string;
          token_endpoint_auth_method: string;
          client_id_issued_at: number;
          metadata: string;
        } | undefined;

        if (!row) {
          return undefined;
        }

        const client: OAuthClientInformationFull = {
          ...JSON.parse(row.metadata),
          client_id: row.client_id,
          client_secret: row.client_secret,
          redirect_uris: JSON.parse(row.redirect_uris),
          grant_types: JSON.parse(row.grant_types),
          response_types: JSON.parse(row.response_types),
          token_endpoint_auth_method: row.token_endpoint_auth_method,
          client_id_issued_at: row.client_id_issued_at
        };

        return client;
      },

      registerClient: async (clientMetadata: any) => {
        // Generate a unique client ID for this MCP client using crypto-safe random
        const randomId = randomBytes(16).toString('hex');
        const clientId = `mcp_${Date.now()}_${randomId}`;

        // Generate a secure client secret
        const randomSecret = randomBytes(32).toString('hex');

        // Create the client registration
        const client: OAuthClientInformationFull = {
          ...clientMetadata,
          client_id: clientId,
          client_secret: `secret_${randomSecret}`,
          client_id_issued_at: Math.floor(Date.now() / 1000),
          grant_types: clientMetadata.grant_types || ['authorization_code', 'refresh_token'],
          response_types: clientMetadata.response_types || ['code'],
          token_endpoint_auth_method: clientMetadata.token_endpoint_auth_method || 'client_secret_post'
        };

        // Store the client in database
        try {
          // Store client
          this.db.prepare(`
            INSERT INTO oauth_clients
            (client_id, client_secret, redirect_uris, grant_types, response_types,
             token_endpoint_auth_method, client_id_issued_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            client.client_id,
            client.client_secret,
            JSON.stringify(client.redirect_uris),
            JSON.stringify(client.grant_types),
            JSON.stringify(client.response_types),
            client.token_endpoint_auth_method,
            client.client_id_issued_at,
            JSON.stringify(clientMetadata)
          );

          // Store redirect URIs
          this.db.prepare('INSERT INTO client_redirect_uris (client_id, redirect_uris) VALUES (?, ?)')
            .run(clientId, JSON.stringify(clientMetadata.redirect_uris || []));

          return client;
        } catch (err) {
          throw err;
        }
      }
    };
  }

  // Override authorization to use GitLab OAuth credentials
  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    // Store the mapping between state and client's actual redirect URI with timestamp
    if (params.state && params.redirectUri) {
      try {
        this.db.prepare('INSERT OR REPLACE INTO state_mappings (state, redirect_uri, timestamp) VALUES (?, ?, ?)')
          .run(params.state, params.redirectUri, Date.now());
        logger.debug(`Stored state mapping: ${params.state} -> ${params.redirectUri} at ${new Date().toISOString()}`);
      } catch (err) {
        logger.error('Error storing state mapping:', err);
        throw err;
      }
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

    logger.debug(`Redirecting to GitLab OAuth:`, {
      url: authUrl.toString(),
      scopes: gitlabScopes,
      requested_scopes: params.scopes
    });

    // Redirect to GitLab
    res.redirect(authUrl.toString());
  }

  // Method to get redirect URI from state
  async getRedirectUriFromState(state: string): Promise<{ redirectUri: string; timestamp: number } | undefined> {
    const row = this.db.prepare('SELECT redirect_uri, timestamp FROM state_mappings WHERE state = ?').get(state) as {
      redirect_uri: string;
      timestamp: number;
    } | undefined;

    if (!row) {
      return undefined;
    }

    return {
      redirectUri: row.redirect_uri,
      timestamp: row.timestamp
    };
  }

  // Method to delete state mapping
  async deleteStateMapping(state: string): Promise<void> {
    this.db.prepare('DELETE FROM state_mappings WHERE state = ?').run(state);
  }

  // Method to verify token
  async verifyToken(token: string): Promise<{ authInfo: AuthInfo; gitlabToken: string; timestamp: number } | undefined> {
    // Get all token hashes to check against
    const rows = this.db.prepare('SELECT * FROM access_tokens').all() as Array<{
      token_hash: string;
      client_id: string;
      scopes: string;
      expires_at: number | null;
      timestamp: number;
    }>;

    // Find the matching token by verifying against each hash
    let matchingRow = null;
    for (const row of rows) {
      try {
        if (await argon2.verify(row.token_hash, token)) {
          matchingRow = row;
          break;
        }
      } catch (err) {
        // Skip invalid hashes
        continue;
      }
    }

    if (!matchingRow) {
      return undefined;
    }

    const now = Date.now();

    // Check if token has expired by timestamp
    if (now - matchingRow.timestamp > this.TOKEN_EXPIRY_MS) {
      await this.deleteAccessTokenByHash(matchingRow.token_hash);
      return undefined;
    }

    // Check if token has an explicit expiry time
    if (matchingRow.expires_at && matchingRow.expires_at < Math.floor(now / 1000)) {
      await this.deleteAccessTokenByHash(matchingRow.token_hash);
      return undefined;
    }

    const authInfo: AuthInfo = {
      token: token, // Return the original token
      clientId: matchingRow.client_id,
      scopes: JSON.parse(matchingRow.scopes),
      expiresAt: matchingRow.expires_at ?? undefined
    };

    return {
      authInfo,
      gitlabToken: token, // Return the original token since we don't store gitlab_token anymore
      timestamp: matchingRow.timestamp
    };
  }

  // Helper method to delete access token by hash
  private async deleteAccessTokenByHash(tokenHash: string): Promise<void> {
    this.db.prepare('DELETE FROM access_tokens WHERE token_hash = ?').run(tokenHash);
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
      const expiresAt = tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : null;
      const scopes = tokens.scope ? tokens.scope.split(' ') : [];

      try {
        // Hash the token before storing
        const tokenHash = await argon2.hash(tokens.access_token);

        this.db.prepare(`
          INSERT OR REPLACE INTO access_tokens
          (token_hash, client_id, scopes, expires_at, timestamp)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          tokenHash,
          client.client_id,
          JSON.stringify(scopes),
          expiresAt,
          Date.now()
        );
      } catch (err) {
        logger.error('Error storing access token:', err);
        throw err;
      }
    }

    return tokens;
  }

  // Override verifyAccessToken to use our internal token store
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const tokenInfo = await this.verifyToken(token);

    if (!tokenInfo) {
      throw new Error('Invalid or expired token');
    }

    return tokenInfo.authInfo;
  }

  // Handle OAuth callback and redirect to client's actual callback URL
  handleOAuthCallback = async (req: Request, res: Response): Promise<void> => {
    const { code, state, error, error_description } = req.query;

    logger.debug('OAuth callback received:', { code: !!code, state, error });

    if (!state) {
      res.status(400).send('Missing state parameter');
      return;
    }

    try {
      // Get the client's actual redirect URI with timestamp
      const stateMapping = await this.getRedirectUriFromState(state as string);

      if (!stateMapping) {
        logger.error(`No redirect URI found for state: ${state}`);
        res.status(400).send('Invalid state parameter');
        return;
      }

      // Check if the state mapping has expired
      if (Date.now() - stateMapping.timestamp > this.STATE_EXPIRY_MS) {
        logger.error(`State mapping expired for state: ${state}`);
        await this.deleteStateMapping(state as string);
        res.status(400).send('State parameter expired');
        return;
      }

      const clientRedirectUri = stateMapping.redirectUri;

      // Clean up the state mapping
      await this.deleteStateMapping(state as string);

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
    } catch (err) {
      logger.error('Error handling OAuth callback:', err);
      res.status(500).send('Internal server error');
    }
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
}

// Export the provider class
export { GitLabProxyProvider };

// Create the GitLab OAuth provider
export const createGitLabOAuthProvider = async () => {
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

  const provider = await GitLabProxyProvider.New({
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


