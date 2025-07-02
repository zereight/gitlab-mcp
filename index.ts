#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express, { Request, Response } from "express";
import {mcpserver} from "./src/mcpserver.js";
import { config } from "./src/config.js";
import { createOAuth2Router, createTokenVerifier } from "./src/oauth.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";

const SSE = process.env.SSE === "true";

// ensure there is a valid configuration
if (config.GITLAB_PERSONAL_ACCESS_TOKEN) {
  if (config.GITLAB_OAUTH2_CLIENT_ID) {
    console.error("only one of GITLAB_OAUTH2_CLIENT_ID or GITLAB_PERSONAL_ACCESS_TOKEN must be set");
    process.exit(1);
  }
}else {
  if(!config.GITLAB_OAUTH2_CLIENT_ID) {
    console.error("one of GITLAB_OAUTH2_CLIENT_ID or GITLAB_PERSONAL_ACCESS_TOKEN must be set");
    process.exit(1);
  }
}

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
    if (!SSE) {
      const transport = new StdioServerTransport();
      await mcpserver.connect(transport);
    } else {
      const app = express();
      const transports: { [sessionId: string]: SSEServerTransport } = {};

      let authMiddleware: express.RequestHandler  = (req: Request, res: Response, next: express.NextFunction) => {
        next();
      }
      // if gitlab oauth client id is set, then we attempt to enable the oauth proxy
      if (config.GITLAB_OAUTH2_CLIENT_ID) {
        const oauth2Proxy = createOAuth2Router()
        console.log("Gitlab OAuth2 proxy enabled");
        app.use(oauth2Proxy);

        const tokenVerifier = createTokenVerifier()
        authMiddleware = requireBearerAuth({
          verifier:tokenVerifier,
        })
      }

      app.get("/sse", authMiddleware, async (req: Request, res: Response) => {
        const transport = new SSEServerTransport("/messages", res);
        transports[transport.sessionId] = transport;
        res.on("close", () => {
          delete transports[transport.sessionId];
        });
        await mcpserver.connect(transport);
      });

      app.post("/messages",authMiddleware,  async (req: Request, res: Response) => {
        const sessionId = req.query.sessionId as string;
        const transport = transports[sessionId];
        if (transport) {
          await transport.handlePostMessage(req, res);
        } else {
          res.status(400).send("No transport found for sessionId");
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
