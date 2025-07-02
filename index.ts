#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express, { Request, Response } from "express";
import {mcpserver} from "./src/mcpserver.js";
import { config, validateConfiguration} from "./src/config.js";
import { createOAuth2Router, createTokenVerifier, handleOAuthCallback } from "./src/oauth.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { logger } from "./src/logger.js";
import argon2 from "@node-rs/argon2";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";


validateConfiguration()

/**
 * Initialize and run the server
 * 서버 초기화 및 실행
 */
async function runServer() {
  try {
    // Server startup banner removed - inappropriate use of console.error for logging
    // Server version banner removed - inappropriate use of console.error for logging
    // API URL banner removed - inappropriate use of console.error for logging
    // Server startup banner removed - inappropriate use of console.error for logging
    if (!config.SSE) {
      const transport = new StdioServerTransport();
      await mcpserver.connect(transport);
    } else {
      const app = express();
      const transports: {
        [sessionId: string]: {
          transport: SSEServerTransport
          tokenHash?: string
        }
      } = {};

      // TODO: this should be refactored into a function that returns the auth middleware and mount any required middleware
      let authMiddleware: express.RequestHandler  = (_req: Request, _res: Response, next: express.NextFunction) => {
        next();
      }
      app.use((req, res, next) => {
        logger.debug(`got request ${req.method} ${req.url}`);
        next();
      })
      // if gitlab oauth client id is set, then we attempt to enable the oauth proxy
      // NOTE: this is... incredibly insecure. you shouldn't really be using this until more has been worked on it and some semi-proper security review.
      if (config.GITLAB_OAUTH2_CLIENT_ID) {
        // Add the callback handler route BEFORE the OAuth router
        app.get("/callback", handleOAuthCallback);

        const oauth2Proxy = createOAuth2Router()
        console.log("Gitlab OAuth2 proxy enabled");
        app.use(oauth2Proxy);

        const tokenVerifier = createTokenVerifier()
        const bearerAuthMiddleware = requireBearerAuth({
          verifier:tokenVerifier,
          resourceMetadataUrl: `${config.GITLAB_OAUTH2_BASE_URL}/.well-known/oauth-protected-resource`
        })
        authMiddleware = (req: Request, res: Response, next: express.NextFunction) => {
          const gitlabToken = req.headers["gitlab-token"];
          if(gitlabToken) {
            res.status(401).send("Gitlab-Token header must not be set when MCP is running in OAuth2 mode");
            return;
          }
          bearerAuthMiddleware(req, res, next)
          const authState = req.auth
          if(authState)  {
            // so this means that auth was successful and we have a token
            // supposedly, if our server is implemented correctly, we would issue the token that corresponded to the correct user token on the gitlab side
            res.locals["gitlabAuthToken"] = authState.token
          }
        }
      } else if(config.GITLAB_PAT_PASSTHROUGH) {
        console.log("Gitlab PAT passthrough enabled");
        authMiddleware  = (req: Request, res: Response, next: express.NextFunction) => {
          // check the Gitlab-Token header
          const token = req.headers["gitlab-token"];
          if(!token) {
            res.status(401).send("Please set a Gitlab-Token header in your request");
            return;
          }
          if(typeof token !== "string") {
            res.status(401).send("Gitlab-Token must only be set once");
            return;
          }
          req.auth = {
            token: token,
            clientId: "!passthrough",
            scopes: [],
          }
          next();
        }
      }else if(config.GITLAB_PERSONAL_ACCESS_TOKEN){
        console.log("Using GITLAB_PERSONAL_ACCESS_TOKEN for all requests")
        const accessToken = config.GITLAB_PERSONAL_ACCESS_TOKEN
        authMiddleware  = (req: Request, res: Response, next: express.NextFunction) => {
          req.auth = {
            token: accessToken,
            clientId: "!global",
            scopes: [],
          }
          next();
        }
      }
      const argon2Salt = new TextEncoder().encode(config.ARGON2_SALT)

      app.get("/sse", authMiddleware, async (req: Request, res: Response) => {
        const transport = new SSEServerTransport("/messages", res);
        transports[transport.sessionId] = {
          transport,
        };
        // if we have a valid auth info here, either obtained from the passthrough token or oauth, we tie it to a session.
        if(req.auth) {
          transports[transport.sessionId].tokenHash = await argon2.hash(req.auth.token, {
            salt: argon2Salt,
          });
        }
        console.log("accessed with token hash", transports[transport.sessionId].tokenHash);
        res.on("close", () => {
          delete transports[transport.sessionId];
        });
        await mcpserver.connect(transport);
      });

      app.post("/messages",authMiddleware,  async (req: Request, res: Response) => {
        const sessionId = req.query.sessionId as string;
        const transportDetails = transports[sessionId];
        if(!transportDetails) {
          res.status(400).send("No transport found for sessionId");
          return;
        }
        const {transport, tokenHash} = transportDetails
        // means we have a token hash to verify.
        if(tokenHash) {
          // NOTE: at this point, we assume that this req.auth is a "valid" AuthInfo
          // TODO: consider the security implications of this when verifying dcr clients.
          if(!req.auth) {
            res.status(401).send("No authorization information sent");
            return;
          }
          const gitlabToken = req.auth.token;
          if(!gitlabToken) {
            res.status(401).send("No valid token info found in request");
            return;
          }
          const verified = await argon2.verify(tokenHash, gitlabToken, {
            salt: argon2Salt,
          });
          if(!verified) {
            res.status(401).send("Token does not match session");
            return;
          }
        }
        if (transport) {
          await transport.handlePostMessage(req, res);
        }
      });

      app.get("/health", (_: Request, res: Response) => {
        res.status(200).json({
          status: "healthy",
          version: process.env.npm_package_version || "unknown",
        });
      });

      const PORT = process.env.PORT || 3002;
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
    }
  } catch (error) {
    console.error("Error initializing server:", error);
    process.exit(1);
  }
}

runServer().catch(error => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
