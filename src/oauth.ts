import { ProxyOAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js';
import { config } from './config.js';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';

export const createOAuth2Router = () => {
  if(!config.GITLAB_OAUTH2_AUTHORIZATION_URL) {
    throw new Error("GITLAB_OAUTH2_AUTHORIZATION_URL is not set")
  }
  if(!config.GITLAB_OAUTH2_CLIENT_ID) {
    throw new Error("GITLAB_OAUTH2_CLIENT_ID is not set")
  }
  const clientId = config.GITLAB_OAUTH2_CLIENT_ID
  if(!config.GITLAB_OAUTH2_CLIENT_SECRET) {
    throw new Error("GITLAB_OAUTH2_CLIENT_SECRET is not set")
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

  return  mcpAuthRouter({
    issuerUrl: new URL(config.GITLAB_OAUTH2_ISSUER_URL),
    baseUrl: new URL(config.GITLAB_OAUTH2_BASE_URL),
    authorizationOptions: {
    },
    resourceName: "https://gfx.cafe",
    provider: new ProxyOAuthServerProvider({
      endpoints: {
        authorizationUrl: config.GITLAB_OAUTH2_AUTHORIZATION_URL,
        tokenUrl: config.GITLAB_OAUTH2_TOKEN_URL,
        revocationUrl: config.GITLAB_OAUTH2_REVOCATION_URL,
        registrationUrl: config.GITLAB_OAUTH2_REGISTRATION_URL,
      },
      verifyAccessToken: async (token) => {
        return {
          token,
          clientId: clientId,
          scopes: ["openid", "email", "profile"],
        }
      },
      getClient: async (client_id) => {
        return {
          client_id,
          client_secret: config.GITLAB_OAUTH2_CLIENT_SECRET,
          redirect_uris: [redirectUrl],
        }
      }
    })
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
