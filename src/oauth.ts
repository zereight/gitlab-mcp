import { ProxyOAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js';
import { config } from './config.js';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { OAuthClientInformationFull, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { Request, Response } from 'express';

// Store for dynamically registered clients
const clientRegistry = new Map<string, OAuthClientInformationFull>();

// Map client IDs to their redirect URIs
const clientRedirectUris = new Map<string, string[]>();

// Map OAuth state parameters to client redirect URIs
const stateToRedirectUri = new Map<string, string>();

// Clean up expired state mappings every 5 minutes
setInterval(() => {
  const expirationTime = 10 * 60 * 1000; // 10 minutes
  const now = Date.now();
  
  // In a production system, you'd store timestamps with the state
  // For now, we'll just clear all mappings older than the interval
  if (stateToRedirectUri.size > 100) {
    console.log(`Clearing ${stateToRedirectUri.size} state mappings`);
    stateToRedirectUri.clear();
  }
}, 5 * 60 * 1000);

// Custom provider that handles dynamic registration and maps to GitLab OAuth
class GitLabProxyProvider extends ProxyOAuthServerProvider {
  get clientsStore() {
    return {
      getClient: async (clientId: string) => {
        // Check if this is a registered dynamic client
        const client = clientRegistry.get(clientId);
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
        clientRedirectUris.set(clientId, clientMetadata.redirect_uris || []);
        
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
        clientRegistry.set(clientId, client);
        
        return client;
      }
    };
  }
  
  // Override authorization to use GitLab OAuth credentials
  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    // Store the mapping between state and client's actual redirect URI
    if (params.state && params.redirectUri) {
      stateToRedirectUri.set(params.state, params.redirectUri);
      console.log(`Stored state mapping: ${params.state} -> ${params.redirectUri}`);
    }
    
    // Use GitLab OAuth credentials for the actual authorization
    const gitlabClient = {
      ...client,
      client_id: config.GITLAB_OAUTH2_CLIENT_ID!,
      client_secret: config.GITLAB_OAUTH2_CLIENT_SECRET!,
      // Use GitLab's registered redirect URI
      redirect_uris: [config.GITLAB_OAUTH2_REDIRECT_URL!]
    };
    
    // Use GitLab's redirect URI for the authorization
    const gitlabParams = {
      ...params,
      redirectUri: config.GITLAB_OAUTH2_REDIRECT_URL!
    };
    
    return super.authorize(gitlabClient, gitlabParams, res);
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
    return super.exchangeAuthorizationCode(
      gitlabClient,
      authorizationCode,
      codeVerifier,
      config.GITLAB_OAUTH2_REDIRECT_URL!,
      resource
    );
  }
}




// Handle OAuth callback and redirect to client's actual callback URL
export const handleOAuthCallback = (req: Request, res: Response): void => {
  const { code, state, error, error_description } = req.query;
  
  console.log('OAuth callback received:', { code: !!code, state, error });
  
  if (!state) {
    res.status(400).send('Missing state parameter');
    return;
  }
  
  // Get the client's actual redirect URI
  const clientRedirectUri = stateToRedirectUri.get(state as string);
  
  if (!clientRedirectUri) {
    console.error(`No redirect URI found for state: ${state}`);
    res.status(400).send('Invalid state parameter');
    return;
  }
  
  // Clean up the state mapping
  stateToRedirectUri.delete(state as string);
  
  // Build the redirect URL with all parameters
  const redirectUrl = new URL(clientRedirectUri);
  
  // Pass through all query parameters
  if (code) redirectUrl.searchParams.set('code', code as string);
  if (state) redirectUrl.searchParams.set('state', state as string);
  if (error) redirectUrl.searchParams.set('error', error as string);
  if (error_description) redirectUrl.searchParams.set('error_description', error_description as string);
  
  console.log(`Redirecting to client callback: ${redirectUrl.toString()}`);
  
  // Redirect to the client's actual callback URL
  res.redirect(redirectUrl.toString());
};

export const createOAuth2Router = () => {
  if(!config.GITLAB_OAUTH2_AUTHORIZATION_URL) {
    throw new Error("GITLAB_OAUTH2_AUTHORIZATION_URL is not set")
  }
  if(!config.GITLAB_OAUTH2_CLIENT_ID) {
    throw new Error("GITLAB_OAUTH2_CLIENT_ID is not set")
  }
  if(!config.GITLAB_OAUTH2_REDIRECT_URL) {
    throw new Error("GITLAB_OAUTH2_REDIRECT_URIS is not set")
  }
  const redirectUrl = config.GITLAB_OAUTH2_REDIRECT_URL
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
    verifyAccessToken: async (token: string) => {
      // Use the introspection endpoint to verify the token
      const tokenVerifier = createTokenVerifier();
      return await tokenVerifier.verifyAccessToken(token);
    },
    getClient: async (client_id: string) => {
      // This is handled by our custom provider's clientsStore
      return undefined;
    }
  })

  return  mcpAuthRouter({
    issuerUrl: new URL(config.GITLAB_OAUTH2_BASE_URL),
    baseUrl: new URL(config.GITLAB_OAUTH2_BASE_URL),
    authorizationOptions: {
    },
    provider: provider,
  })
}

export const createTokenVerifier = () => {
  if(!config.GITLAB_OAUTH2_INTROSPECTION_URL) {
    throw new Error("GITLAB_OAUTH2_INTROSPECTION_URL is not set")
  }
  const introspectionEndpoint = config.GITLAB_OAUTH2_INTROSPECTION_URL
  const tokenVerifier = {
    verifyAccessToken: async (token: string) => {

      const response = await fetch(introspectionEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token: token
        }).toString()
      });


      if (!response.ok) {
        throw new Error(`Invalid or expired token: ${await response.text()}`);
      }

      const data = await response.json();

      // NOTE: we don't implement "strict oauth" here yet, as per this example: https://github.com/modelcontextprotocol/typescript-sdk/blob/1b14bd7fa4dcc436df0fcb2718f86dc376cdd904/src/examples/server/simpleStreamableHttp.ts#L7

      // Convert the response to AuthInfo format
      return {
        token,
        clientId: data.client_id,
        scopes: data.scope ? data.scope.split(' ') : [],
        expiresAt: data.exp,
      };
    }
  }

  return tokenVerifier

}
