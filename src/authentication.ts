import { Request, Response, NextFunction, RequestHandler, Express } from 'express';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { config } from './config.js';
import { createGitLabOAuthProvider } from './oauth.js';
import { logger } from './logger.js';
import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

// Extend Express Request type to include auth property
declare global {
  namespace Express {
    interface Request {
      auth?: AuthInfo;
    }
  }
}

/**
 * Configure authentication middleware based on the configuration
 * Supports OAuth2, PAT passthrough, and static PAT modes
 */
export async function configureAuthentication(app: Express): Promise<RequestHandler> {
  // Default middleware that does nothing
  let authMiddleware: RequestHandler = (_req: Request, _res: Response, next: NextFunction) => {
    next();
  };

  // OAuth2 mode
  if (config.GITLAB_OAUTH2_CLIENT_ID) {
    logger.warn("Configuring GitLab OAuth2 proxy authentication");
    logger.warn("Please note that GitLab OAuth2 proxy authentication is not yet fully supported. Use this feature at your own risk");

    // Create the provider
    const provider = await createGitLabOAuthProvider();

    // Add the callback handler route BEFORE the OAuth router
    app.get("/callback", (req, res) => provider.handleOAuthCallback(req, res));

    // Set up OAuth2 proxy router
    const oauth2Router = provider.createOAuth2Router();
    app.use(oauth2Router);

    // Create token verifier and bearer auth middleware
    const tokenVerifier = provider.createTokenVerifier();
    const bearerAuthMiddleware = requireBearerAuth({
      verifier: tokenVerifier,
      resourceMetadataUrl: `${config.GITLAB_OAUTH2_BASE_URL}/.well-known/oauth-protected-resource`
    });

    authMiddleware = (req: Request, res: Response, next: NextFunction) => {
      // Ensure GitLab-Token header is not set in OAuth2 mode
      const gitlabToken = req.headers["gitlab-token"];
      if (gitlabToken) {
        res.status(401).send("Gitlab-Token header must not be set when MCP is running in OAuth2 mode");
        return;
      }
      bearerAuthMiddleware(req, res, next);
    };
  }
  // PAT passthrough mode
  else if (config.GITLAB_PAT_PASSTHROUGH) {
    logger.info("Configuring GitLab PAT passthrough authentication. Users must set the Gitlab-Token header in their requests");

    authMiddleware = (req: Request, res: Response, next: NextFunction) => {
      // Check the Gitlab-Token header
      const token = req.headers["gitlab-token"];
      if (!token) {
        res.status(401).send("Please set a Gitlab-Token header in your request");
        return;
      }
      if (typeof token !== "string") {
        res.status(401).send("Gitlab-Token must only be set once");
        return;
      }

      req.auth = {
        token: token,
        clientId: "!passthrough",
        scopes: [],
      };
      next();
    };
  }
  // Static PAT mode
  else if (config.GITLAB_PERSONAL_ACCESS_TOKEN) {
    logger.info("Configuring static GitLab Personal Access Token authentication");

    const accessToken = config.GITLAB_PERSONAL_ACCESS_TOKEN;
    authMiddleware = (req: Request, res: Response, next: NextFunction) => {
      req.auth = {
        token: accessToken,
        clientId: "!global",
        scopes: [],
      };
      next();
    };
  }

  return authMiddleware;
}
