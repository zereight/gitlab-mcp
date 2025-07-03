#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express, { Request, Response } from "express";
import {mcpserver } from "./src/mcpserver.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { config, validateConfiguration} from "./src/config.js";
import { configureAuthentication } from "./src/authentication.js";
import { logger } from "./src/logger.js";
import argon2 from "@node-rs/argon2";
import { randomUUID } from "crypto";


validateConfiguration()

enum TransportMode {
  STDIO = 'stdio',
  SSE = 'sse',
  STREAMABLE_HTTP = 'streamable-http'
}


/**
 * Determine the transport mode based on environment variables and availability
 *
 * Transport mode priority (highest to lowest):
 * 1. STREAMABLE_HTTP
 * 2. SSE
 * 3. STDIO
 */
function determineTransportMode(): TransportMode {
  // Check for streamable-http support (highest priority)
  if (config.STREAMABLE_HTTP) {
    return TransportMode.STREAMABLE_HTTP;
  }

  // Check for SSE support (medium priority)
  if (config.SSE) {
    return TransportMode.SSE;
  }

  // Default to stdio (lowest priority)
  return TransportMode.STDIO;
}

/**
 * Start server with stdio transport
 */
async function startStdioServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await mcpserver.connect(transport);
}

// used for the sse and streamable http transports to share auth
async function startExpressServer(mode: TransportMode): Promise<void> {
  const app = express();

  const authMiddleware = await configureAuthentication(app);
  const argon2Salt = new TextEncoder().encode(config.ARGON2_SALT)
  if(mode === TransportMode.SSE) {
    const transports: {
      [sessionId: string]: {
        transport: SSEServerTransport
        tokenHash?: string
      }
    } = {};
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

  } else if (mode === TransportMode.STREAMABLE_HTTP) {
  const transports : { [sessionId: string]: {
    transport: StreamableHTTPServerTransport
    tokenHash?: string
  }} = {};
    // Streamable HTTP endpoint - handles both session creation and message handling
    app.post('/mcp', authMiddleware, async (req: Request, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string;
      try {
        let transport: StreamableHTTPServerTransport
        if (sessionId && transports[sessionId]) {
          // Reuse existing transport for ongoing session
          const session = transports[sessionId];
          if(session.tokenHash) {
            if(!req.auth) {
              res.status(401).send("No authorization information sent");
              return;
            }
            const gitlabToken = req.auth.token;
            if(!gitlabToken) {
              res.status(401).send("No valid token info found in request");
              return;
            }
            const verified = await argon2.verify(session.tokenHash, gitlabToken, {
              salt: argon2Salt,
            });
            if(!verified) {
              res.status(401).send("Token does not match session");
              return;
            }
          }
          transport = session.transport;
          await transport.handleRequest(req, res, req.body);
        } else {
          // Create new transport for new session
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (newSessionId: string) => {
              transports[newSessionId] = {
                transport,
              };
              // if we have a valid auth info here, either obtained from the passthrough token or oauth, we tie it to a session.
              if(req.auth) {
                transports[newSessionId].tokenHash = argon2.hashSync(req.auth.token, {
                  salt: argon2Salt,
                });
              }
              logger.warn(`Streamable HTTP session initialized: ${newSessionId}`);
            }
          });

          // Set up cleanup handler when transport closes
          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid && transports[sid]) {
              logger.warn(`Streamable HTTP transport closed for session ${sid}, cleaning up`);
              delete transports[sid];
            }
          };

          // Connect transport to MCP server before handling the request
          await mcpserver.connect(transport);
          await transport.handleRequest(req, res, req.body);
        }
      } catch (error) {
        logger.error('Streamable HTTP error:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

  } else {
    throw new Error("Unknown transport mode for express server: " +mode);
  }

  app.get("/health", (_: Request, res: Response) => {
    res.status(200).json({
      status: "healthy",
      version: process.env.npm_package_version || "unknown",
    });
  });


  app.listen(Number(config.PORT), config.HOST, () => {
    logger.log(`GitLab MCP Server running with ${mode} transport`);
    const colorGreen = "\x1b[32m";
    const colorReset = "\x1b[0m";
    logger.log(`${colorGreen}Endpoint: http://${config.HOST}:${config.PORT}/sse${colorReset}`);
  });
}

/**
 * Initialize server with specific transport mode
 * Handle transport-specific initialization logic
 */
async function initializeServerByTransportMode(mode: TransportMode): Promise<void> {
  logger.log('Initializing server with transport mode:', mode);
  switch (mode) {
    case TransportMode.STDIO:
      logger.warn('Starting GitLab MCP Server with stdio transport');
      await startStdioServer();
      break;
    case TransportMode.SSE:
    case TransportMode.STREAMABLE_HTTP:
      logger.warn('Starting GitLab MCP Server with SSE transport');
      await startExpressServer(mode);
      break;
    default:
      // This should never happen with proper enum usage, but TypeScript requires it
      const exhaustiveCheck: never = mode;
      throw new Error(`Unknown transport mode: ${exhaustiveCheck}`);
  }
}

/**
 * Initialize and run the server
 * Main entry point for server startup
 */
async function runServer() {
  try {
    const transportMode = determineTransportMode();
    await initializeServerByTransportMode(transportMode);
  } catch (error) {
    logger.error("Error initializing server:", error);
    process.exit(1);
  }
}

runServer().catch(error => {
  logger.error("Fatal error in main():", error);
  process.exit(1);
});
