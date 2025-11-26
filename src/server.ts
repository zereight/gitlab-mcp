import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Express } from "express";
import { HOST, PORT } from "./config";
import { TransportMode } from "./types";
import { packageName, packageVersion } from "./config";
import { setupHandlers } from "./handlers";
import { logger } from "./logger";

// OAuth imports
import {
  loadOAuthConfig,
  validateStaticConfig,
  isOAuthEnabled,
  getAuthModeDescription,
  metadataHandler,
  authorizeHandler,
  pollHandler,
  tokenHandler,
  healthHandler,
} from "./oauth/index";
// Note: oauthAuthMiddleware is available for future use on protected endpoints
// import { oauthAuthMiddleware } from "./middleware/index";

// Create server instance
export const server = new Server(
  {
    name: packageName,
    version: packageVersion,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Terminal colors for logging (currently unused)
// const colorGreen = '\x1b[32m';
// const colorReset = '\x1b[0m';

/**
 * Register OAuth endpoints on an Express app
 *
 * Adds:
 * - /.well-known/oauth-authorization-server - OAuth metadata
 * - /authorize - Authorization endpoint (initiates device flow)
 * - /oauth/poll - Device flow polling endpoint
 * - /token - Token exchange endpoint
 * - /health - Health check endpoint
 *
 * @param app - Express application
 */
function registerOAuthEndpoints(app: Express): void {
  // OAuth discovery metadata (no auth required)
  app.get("/.well-known/oauth-authorization-server", metadataHandler);

  // Authorization endpoint - initiates device flow (no auth required)
  app.get("/authorize", authorizeHandler);

  // Device flow polling endpoint (no auth required)
  app.get("/oauth/poll", pollHandler);

  // Token endpoint - exchange code for tokens (no auth required)
  // Uses URL-encoded body as per OAuth spec
  app.post("/token", express.urlencoded({ extended: true }), tokenHandler);

  // Health check endpoint
  app.get("/health", healthHandler);

  logger.info("OAuth endpoints registered");
}

function determineTransportMode(): TransportMode {
  const args = process.argv.slice(2);

  logger.info(`Transport mode detection: args=${JSON.stringify(args)}, PORT=${PORT}`);

  // Check for explicit stdio mode first
  if (args.includes("stdio")) {
    logger.info("Selected stdio mode (explicit argument)");
    return "stdio" as TransportMode;
  }

  // If PORT environment variable is present, start in dual transport mode (SSE + StreamableHTTP)
  if (process.env.PORT) {
    logger.info(
      "Selected dual transport mode (SSE + StreamableHTTP) - PORT environment variable detected"
    );
    return "dual" as TransportMode;
  }

  // Default to stdio mode when no PORT is specified
  logger.info("Selected stdio mode (no PORT environment variable)");
  return "stdio" as TransportMode;
}

export async function startServer(): Promise<void> {
  // Validate configuration based on auth mode
  const oauthConfig = loadOAuthConfig();
  if (oauthConfig) {
    logger.info("Starting in OAuth mode (per-user authentication)");
    logger.info(`OAuth client ID: ${oauthConfig.gitlabClientId}`);
  } else {
    // Validate static token configuration
    validateStaticConfig();
    logger.info("Starting in static token mode (shared GITLAB_TOKEN)");
  }

  logger.info(`Authentication mode: ${getAuthModeDescription()}`);

  // Setup request handlers
  await setupHandlers(server);

  const transportMode = determineTransportMode();

  switch (transportMode) {
    case "stdio": {
      const transport = new StdioServerTransport();
      await server.connect(transport);
      logger.info("GitLab MCP Server running on stdio");
      break;
    }

    case "sse": {
      logger.info("Setting up SSE mode with MCP SDK...");
      const app = express();
      app.use(express.json());

      // Register OAuth endpoints if OAuth mode is enabled
      if (isOAuthEnabled()) {
        registerOAuthEndpoints(app);
      }

      const sseTransports: { [sessionId: string]: SSEServerTransport } = {};

      // SSE endpoint for establishing the stream
      app.get("/sse", async (req, res) => {
        logger.debug("SSE endpoint hit!");
        const transport = new SSEServerTransport("/messages", res);

        // Connect the server to this transport (this calls start() automatically)
        await server.connect(transport);

        // Store transport by session ID for message routing
        const sessionId = transport.sessionId;
        sseTransports[sessionId] = transport;
        logger.debug(`SSE transport created with session: ${sessionId}`);
      });

      // Messages endpoint for receiving JSON-RPC messages
      app.post("/messages", async (req, res) => {
        logger.debug("Messages endpoint hit!");
        const sessionId = req.query.sessionId as string;

        if (!sessionId || !sseTransports[sessionId]) {
          return res.status(404).json({ error: "Session not found" });
        }

        try {
          const transport = sseTransports[sessionId];
          await transport.handlePostMessage(req, res, req.body);
        } catch (error: unknown) {
          logger.error({ err: error }, "Error handling SSE message");
          res.status(500).json({ error: "Internal server error" });
        }
      });

      app.listen(Number(PORT), HOST, () => {
        const url = `http://${HOST}:${PORT}`;
        logger.info(`GitLab MCP Server SSE running on ${url}`);
        logger.info("SSE server started successfully");
      });
      break;
    }

    case "streamable-http": {
      const app = express();
      app.use(express.json());

      // Register OAuth endpoints if OAuth mode is enabled
      if (isOAuthEnabled()) {
        registerOAuthEndpoints(app);
      }

      const streamableTransports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

      // Single endpoint that handles both GET (SSE) and POST (JSON-RPC) requests
      // This follows MCP SDK pattern where StreamableHTTP transport handles both internally
      app.all("/mcp", async (req, res) => {
        const sessionId = req.headers["mcp-session-id"] as string;
        try {
          let transport: StreamableHTTPServerTransport;

          if (sessionId && sessionId in streamableTransports) {
            // Use existing transport for this session
            transport = streamableTransports[sessionId];
            await transport.handleRequest(req, res, req.body);
          } else {
            // Create new transport (handles both SSE and JSON-RPC internally)
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => Math.random().toString(36).substring(7),
              onsessioninitialized: (newSessionId: string) => {
                streamableTransports[newSessionId] = transport;
                logger.info(`MCP session initialized: ${newSessionId} (method: ${req.method})`);
              },
              onsessionclosed: (closedSessionId: string) => {
                delete streamableTransports[closedSessionId];
                logger.info(`MCP session closed: ${closedSessionId}`);
              },
            });
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
          }
        } catch (error: unknown) {
          logger.error({ err: error }, "Error in StreamableHTTP transport");
          res.status(500).json({ error: "Internal server error" });
        }
      });

      app.listen(Number(PORT), HOST, () => {
        const url = `http://${HOST}:${PORT}`;
        logger.info(`GitLab MCP Server running on ${url}/mcp`);
        logger.info("Supports both SSE (GET) and JSON-RPC (POST) on same endpoint");
      });
      break;
    }

    case "dual": {
      logger.info("Setting up dual transport mode (SSE + StreamableHTTP)...");
      const app = express();
      app.use(express.json());

      // Register OAuth endpoints if OAuth mode is enabled
      if (isOAuthEnabled()) {
        registerOAuthEndpoints(app);
      }

      // Transport storage for both SSE and StreamableHTTP
      const sseTransports: { [sessionId: string]: SSEServerTransport } = {};
      const streamableTransports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

      // SSE Transport Endpoints (backwards compatibility)
      app.get("/sse", async (req, res) => {
        logger.debug("SSE endpoint hit!");
        const transport = new SSEServerTransport("/messages", res);
        await server.connect(transport);

        const sessionId = transport.sessionId;
        sseTransports[sessionId] = transport;
        logger.debug(`SSE transport created with session: ${sessionId}`);
      });

      app.post("/messages", async (req, res) => {
        logger.debug("SSE messages endpoint hit!");
        const sessionId = req.query.sessionId as string;

        if (!sessionId || !sseTransports[sessionId]) {
          return res.status(404).json({ error: "Session not found" });
        }

        try {
          const transport = sseTransports[sessionId];
          await transport.handlePostMessage(req, res, req.body);
        } catch (error: unknown) {
          logger.error({ err: error }, "Error handling SSE message");
          res.status(500).json({ error: "Internal server error" });
        }
      });

      // StreamableHTTP Transport Endpoint (modern, supports both GET SSE and POST JSON-RPC)
      app.all("/mcp", async (req, res) => {
        const sessionId = req.headers["mcp-session-id"] as string;
        try {
          let transport: StreamableHTTPServerTransport;

          if (sessionId && sessionId in streamableTransports) {
            transport = streamableTransports[sessionId];
            await transport.handleRequest(req, res, req.body);
          } else {
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => Math.random().toString(36).substring(7),
              onsessioninitialized: (newSessionId: string) => {
                streamableTransports[newSessionId] = transport;
                logger.info(`MCP session initialized: ${newSessionId} (method: ${req.method})`);
              },
              onsessionclosed: (closedSessionId: string) => {
                delete streamableTransports[closedSessionId];
                logger.info(`MCP session closed: ${closedSessionId}`);
              },
            });
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
          }
        } catch (error: unknown) {
          logger.error({ err: error }, "Error in StreamableHTTP transport");
          res.status(500).json({ error: "Internal server error" });
        }
      });

      app.listen(Number(PORT), HOST, () => {
        const url = `http://${HOST}:${PORT}`;
        logger.info(`GitLab MCP Server running on ${url}`);
        logger.info("Dual Transport Mode Active:");
        logger.info(`  SSE endpoint: ${url}/sse (backwards compatibility)`);
        logger.info(`  StreamableHTTP endpoint: ${url}/mcp (modern, supports SSE + JSON-RPC)`);
        if (isOAuthEnabled()) {
          logger.info("OAuth Mode Active:");
          logger.info(`  OAuth metadata: ${url}/.well-known/oauth-authorization-server`);
          logger.info(`  Authorization: ${url}/authorize`);
          logger.info(`  Token exchange: ${url}/token`);
        }
        logger.info("Clients can use either transport as needed");
      });
      break;
    }
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  logger.info("Shutting down GitLab MCP Server...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Shutting down GitLab MCP Server...");
  process.exit(0);
});
