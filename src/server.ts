import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Express } from "express";
import * as http from "http";
import * as https from "https";
import * as fs from "fs";
import {
  HOST,
  PORT,
  SSL_CERT_PATH,
  SSL_KEY_PATH,
  SSL_CA_PATH,
  SSL_PASSPHRASE,
  TRUST_PROXY,
} from "./config";
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
  protectedResourceHandler,
  authorizeHandler,
  pollHandler,
  callbackHandler,
  tokenHandler,
  healthHandler,
  registerHandler,
  sessionStore,
  runWithTokenContext,
} from "./oauth/index";
// Middleware imports
import { oauthAuthMiddleware, rateLimiterMiddleware } from "./middleware/index";

// Schema mode auto-detection
import { setDetectedSchemaMode } from "./utils/schema-utils";

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

// Auto-detect schema mode from clientInfo after initialization
// Used when GITLAB_SCHEMA_MODE=auto to determine flat vs discriminated
// NOTE: This works correctly for stdio mode (single client). For HTTP/SSE with multiple
// concurrent sessions, auto-detection will use the most recent client's preference for
// all sessions. Use explicit GITLAB_SCHEMA_MODE=flat|discriminated for multi-session deployments.
server.oninitialized = () => {
  const clientVersion = server.getClientVersion();
  setDetectedSchemaMode(clientVersion?.name);
};

// Terminal colors for logging (currently unused)
// const colorGreen = '\x1b[32m';
// const colorReset = '\x1b[0m';

/**
 * Register OAuth endpoints on an Express app
 *
 * Adds:
 * - /.well-known/oauth-authorization-server - OAuth metadata
 * - /.well-known/oauth-protected-resource - Protected resource metadata (RFC 9470)
 * - /authorize - Authorization endpoint (supports both Device Flow and Authorization Code Flow)
 * - /oauth/poll - Device flow polling endpoint
 * - /oauth/callback - Authorization Code Flow callback from GitLab
 * - /token - Token exchange endpoint
 * - /health - Health check endpoint
 *
 * @param app - Express application
 */
function registerOAuthEndpoints(app: Express): void {
  // NOTE: Rate limiting is applied via rateLimiterMiddleware() BEFORE this function is called.
  // All routes registered here are protected by the global rate limiter middleware.

  // OAuth discovery metadata (no auth required)
  app.get("/.well-known/oauth-authorization-server", metadataHandler);

  // Protected Resource Metadata (RFC 9470) - required by Claude.ai custom connectors
  app.get("/.well-known/oauth-protected-resource", protectedResourceHandler);

  // Authorization endpoint - supports both flows:
  // - Device Flow (no redirect_uri) - returns HTML page
  // - Authorization Code Flow (with redirect_uri) - redirects to GitLab
  app.get("/authorize", authorizeHandler);

  // Device flow polling endpoint (no auth required)
  app.get("/oauth/poll", pollHandler);

  // Authorization Code Flow callback from GitLab
  // GitLab redirects here after user authorizes, then we redirect to client
  app.get("/oauth/callback", callbackHandler);

  // Token endpoint - exchange code for tokens (no auth required)
  // Uses URL-encoded body as per OAuth spec
  app.post("/token", express.urlencoded({ extended: true }), tokenHandler);

  // Dynamic Client Registration endpoint (RFC 7591) - required by Claude.ai
  app.post("/register", express.json(), registerHandler);

  // Health check endpoint
  app.get("/health", healthHandler);

  logger.info("OAuth endpoints registered");
}

/**
 * Check if TLS/HTTPS is enabled via SSL certificate configuration
 */
function isTLSEnabled(): boolean {
  return !!(SSL_CERT_PATH && SSL_KEY_PATH);
}

/**
 * Load TLS options from certificate files
 */
function loadTLSOptions(): https.ServerOptions | undefined {
  if (!SSL_CERT_PATH || !SSL_KEY_PATH) {
    return undefined;
  }

  try {
    const options: https.ServerOptions = {
      cert: fs.readFileSync(SSL_CERT_PATH),
      key: fs.readFileSync(SSL_KEY_PATH),
    };

    if (SSL_CA_PATH) {
      options.ca = fs.readFileSync(SSL_CA_PATH);
      logger.info(`CA certificate loaded from ${SSL_CA_PATH}`);
    }

    if (SSL_PASSPHRASE) {
      options.passphrase = SSL_PASSPHRASE;
    }

    logger.info(`TLS certificates loaded from ${SSL_CERT_PATH}`);
    return options;
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to load TLS certificates");
    throw new Error(`Failed to load TLS certificates: ${String(error)}`);
  }
}

/**
 * Configure Express trust proxy setting for reverse proxy deployments
 */
function configureTrustProxy(app: Express): void {
  if (!TRUST_PROXY) {
    return;
  }

  // Parse trust proxy value
  let trustValue: boolean | string | number = TRUST_PROXY;
  if (TRUST_PROXY === "true" || TRUST_PROXY === "1") {
    trustValue = true;
  } else if (TRUST_PROXY === "false" || TRUST_PROXY === "0") {
    trustValue = false;
  } else if (!isNaN(Number(TRUST_PROXY))) {
    trustValue = Number(TRUST_PROXY);
  }

  app.set("trust proxy", trustValue);
  logger.info(`Trust proxy configured: ${String(trustValue)}`);
}

/**
 * Start an HTTP or HTTPS server based on TLS configuration
 */
function startHttpServer(app: Express, callback: () => void): void {
  const tlsOptions = loadTLSOptions();

  if (tlsOptions) {
    const httpsServer = https.createServer(tlsOptions, app as http.RequestListener);
    httpsServer.listen(Number(PORT), HOST, callback);
  } else {
    app.listen(Number(PORT), HOST, callback);
  }
}

/**
 * Get the protocol prefix for URLs
 */
function getProtocol(): string {
  return isTLSEnabled() ? "https" : "http";
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

  // Initialize session store (required for file-based and PostgreSQL persistence)
  if (oauthConfig) {
    await sessionStore.initialize();
  }

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

      // Configure trust proxy for reverse proxy deployments
      configureTrustProxy(app);

      // Rate limiting middleware (protects anonymous requests, authenticated users skip)
      app.use(rateLimiterMiddleware());

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
      app.post("/messages", async (req, res): Promise<void> => {
        logger.debug("Messages endpoint hit!");
        const sessionId = req.query.sessionId as string;

        if (!sessionId || !sseTransports[sessionId]) {
          res.status(404).json({ error: "Session not found" });
          return;
        }

        try {
          const transport = sseTransports[sessionId];
          await transport.handlePostMessage(req, res, req.body);
        } catch (error: unknown) {
          logger.error({ err: error }, "Error handling SSE message");
          res.status(500).json({ error: "Internal server error" });
        }
      });

      startHttpServer(app, () => {
        const url = `${getProtocol()}://${HOST}:${PORT}`;
        logger.info(`GitLab MCP Server SSE running on ${url}`);
        if (isTLSEnabled()) {
          logger.info("TLS/HTTPS enabled");
        }
        logger.info("SSE server started successfully");
      });
      break;
    }

    case "streamable-http": {
      const app = express();
      app.use(express.json());

      // Configure trust proxy for reverse proxy deployments
      configureTrustProxy(app);

      // Rate limiting middleware (protects anonymous requests, authenticated users skip)
      app.use(rateLimiterMiddleware());

      // Register OAuth endpoints if OAuth mode is enabled
      if (isOAuthEnabled()) {
        registerOAuthEndpoints(app);
      }

      // Middleware to ensure Accept header includes text/event-stream for MCP endpoints
      // This fixes compatibility with clients that don't send the full Accept header
      // as required by MCP spec (e.g., when headers are modified by reverse proxies)
      app.use("/mcp", (req, res, next) => {
        const accept = req.headers.accept ?? "";
        if (req.method === "POST" && !accept.includes("text/event-stream")) {
          req.headers.accept = accept
            ? `${accept}, text/event-stream`
            : "application/json, text/event-stream";
          logger.debug(
            { originalAccept: accept, newAccept: req.headers.accept },
            "Modified Accept header for MCP compatibility"
          );
        }
        next();
      });

      // OAuth authentication middleware for MCP endpoints (when OAuth mode is enabled)
      if (isOAuthEnabled()) {
        app.use("/mcp", oauthAuthMiddleware);
      }

      const streamableTransports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

      // Single endpoint that handles both GET (SSE) and POST (JSON-RPC) requests
      // This follows MCP SDK pattern where StreamableHTTP transport handles both internally
      app.all("/mcp", async (req, res) => {
        const sessionId = req.headers["mcp-session-id"] as string;

        // Get OAuth token info from middleware (stored in res.locals)
        const oauthSessionId = res.locals.oauthSessionId as string | undefined;
        const gitlabToken = res.locals.gitlabToken as string | undefined;
        const gitlabUserId = res.locals.gitlabUserId as number | undefined;
        const gitlabUsername = res.locals.gitlabUsername as string | undefined;

        // Helper to handle request with proper token context
        const handleWithContext = async (
          transport: StreamableHTTPServerTransport
        ): Promise<void> => {
          if (gitlabToken && oauthSessionId && gitlabUserId && gitlabUsername) {
            // Wrap transport.handleRequest in token context so MCP handlers have access
            await runWithTokenContext(
              {
                gitlabToken,
                gitlabUserId,
                gitlabUsername,
                sessionId: oauthSessionId,
              },
              async () => {
                await transport.handleRequest(req, res, req.body);
              }
            );
          } else {
            // No OAuth token - direct handling (static token mode or unauthenticated)
            await transport.handleRequest(req, res, req.body);
          }
        };

        try {
          let transport: StreamableHTTPServerTransport;

          if (sessionId && sessionId in streamableTransports) {
            // Use existing transport for this session
            transport = streamableTransports[sessionId];
            await handleWithContext(transport);
          } else {
            // Create new transport (handles both SSE and JSON-RPC internally)
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => Math.random().toString(36).substring(7),
              onsessioninitialized: (newSessionId: string) => {
                streamableTransports[newSessionId] = transport;
                logger.info(`MCP session initialized: ${newSessionId} (method: ${req.method})`);

                // Associate MCP session with OAuth session if authenticated
                if (oauthSessionId) {
                  sessionStore.associateMcpSession(newSessionId, oauthSessionId);
                }
              },
              onsessionclosed: (closedSessionId: string) => {
                delete streamableTransports[closedSessionId];
                sessionStore.removeMcpSessionAssociation(closedSessionId);
                logger.info(`MCP session closed: ${closedSessionId}`);
              },
            });
            await server.connect(transport);
            await handleWithContext(transport);
          }
        } catch (error: unknown) {
          logger.error({ err: error }, "Error in StreamableHTTP transport");
          res.status(500).json({ error: "Internal server error" });
        }
      });

      startHttpServer(app, () => {
        const url = `${getProtocol()}://${HOST}:${PORT}`;
        logger.info(`GitLab MCP Server running on ${url}/mcp`);
        if (isTLSEnabled()) {
          logger.info("TLS/HTTPS enabled");
        }
        logger.info("Supports both SSE (GET) and JSON-RPC (POST) on same endpoint");
      });
      break;
    }

    case "dual": {
      logger.info("Setting up dual transport mode (SSE + StreamableHTTP)...");
      const app = express();
      app.use(express.json());

      // Configure trust proxy for reverse proxy deployments
      configureTrustProxy(app);

      // Rate limiting middleware (protects anonymous requests, authenticated users skip)
      app.use(rateLimiterMiddleware());

      // Register OAuth endpoints if OAuth mode is enabled
      if (isOAuthEnabled()) {
        registerOAuthEndpoints(app);
      }

      // Middleware to ensure Accept header includes text/event-stream for MCP endpoints
      // This fixes compatibility with clients that don't send the full Accept header
      // as required by MCP spec (e.g., when headers are modified by reverse proxies)
      app.use(["/", "/mcp"], (req, res, next) => {
        const accept = req.headers.accept ?? "";
        if (req.method === "POST" && !accept.includes("text/event-stream")) {
          // Add text/event-stream to Accept header for POST requests
          req.headers.accept = accept
            ? `${accept}, text/event-stream`
            : "application/json, text/event-stream";
          logger.debug(
            { originalAccept: accept, newAccept: req.headers.accept },
            "Modified Accept header for MCP compatibility"
          );
        }
        next();
      });

      // OAuth authentication middleware for MCP endpoints (when OAuth mode is enabled)
      // Returns 401 with WWW-Authenticate header if no valid token, triggering OAuth flow
      if (isOAuthEnabled()) {
        app.use(["/", "/mcp"], oauthAuthMiddleware);
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

      app.post("/messages", async (req, res): Promise<void> => {
        logger.debug("SSE messages endpoint hit!");
        const sessionId = req.query.sessionId as string;

        if (!sessionId || !sseTransports[sessionId]) {
          res.status(404).json({ error: "Session not found" });
          return;
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
      // Also mounted at "/" for Claude.ai custom connector compatibility
      app.all(["/", "/mcp"], async (req, res) => {
        const sessionId = req.headers["mcp-session-id"] as string;

        // Get OAuth token info from middleware (stored in res.locals)
        const oauthSessionId = res.locals.oauthSessionId as string | undefined;
        const gitlabToken = res.locals.gitlabToken as string | undefined;
        const gitlabUserId = res.locals.gitlabUserId as number | undefined;
        const gitlabUsername = res.locals.gitlabUsername as string | undefined;

        logger.info(
          {
            method: req.method,
            path: req.path,
            mcpSessionId: sessionId || "none",
            hasOAuthSession: !!oauthSessionId,
            hasToken: !!gitlabToken,
          },
          "MCP endpoint request received"
        );

        // Helper to handle request with proper token context
        const handleWithContext = async (
          transport: StreamableHTTPServerTransport
        ): Promise<void> => {
          if (gitlabToken && oauthSessionId && gitlabUserId && gitlabUsername) {
            // Wrap transport.handleRequest in token context so MCP handlers have access
            await runWithTokenContext(
              {
                gitlabToken,
                gitlabUserId,
                gitlabUsername,
                sessionId: oauthSessionId,
              },
              async () => {
                await transport.handleRequest(req, res, req.body);
              }
            );
          } else {
            // No OAuth token - direct handling (static token mode or unauthenticated)
            await transport.handleRequest(req, res, req.body);
          }
        };

        try {
          let transport: StreamableHTTPServerTransport;

          if (sessionId && sessionId in streamableTransports) {
            transport = streamableTransports[sessionId];
            await handleWithContext(transport);
          } else {
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => Math.random().toString(36).substring(7),
              onsessioninitialized: (newSessionId: string) => {
                streamableTransports[newSessionId] = transport;
                logger.info(`MCP session initialized: ${newSessionId} (method: ${req.method})`);

                // Associate MCP session with OAuth session if authenticated
                if (oauthSessionId) {
                  sessionStore.associateMcpSession(newSessionId, oauthSessionId);
                }
              },
              onsessionclosed: (closedSessionId: string) => {
                delete streamableTransports[closedSessionId];
                sessionStore.removeMcpSessionAssociation(closedSessionId);
                logger.info(`MCP session closed: ${closedSessionId}`);
              },
            });
            await server.connect(transport);
            await handleWithContext(transport);
          }
        } catch (error: unknown) {
          logger.error({ err: error }, "Error in StreamableHTTP transport");
          res.status(500).json({ error: "Internal server error" });
        }
      });

      startHttpServer(app, () => {
        const url = `${getProtocol()}://${HOST}:${PORT}`;
        logger.info(`GitLab MCP Server running on ${url}`);
        if (isTLSEnabled()) {
          logger.info("TLS/HTTPS enabled");
        }
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

// Graceful shutdown - save sessions to storage backend before exit
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down GitLab MCP Server...");

  try {
    // Close session store (saves file-based sessions, disconnects PostgreSQL)
    await sessionStore.close();
    logger.info("Session store closed successfully");
  } catch (error) {
    logger.error({ err: error as Error }, "Error closing session store");
  }

  process.exit(0);
}

process.on("SIGINT", () => {
  gracefulShutdown("SIGINT").catch(err => {
    logger.error({ err }, "Error during graceful shutdown");
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  gracefulShutdown("SIGTERM").catch(err => {
    logger.error({ err }, "Error during graceful shutdown");
    process.exit(1);
  });
});
