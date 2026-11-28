import type { SSEServerTransport as SseServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { NextFunction, Request, Response } from "express";
import { URL } from "node:url";
import {
  getConfig,
  GITLAB_MCP_REQUEST_BODY_LIMIT,
  getMaxRequestsPerMinute,
  getMaxSessions,
  HOST,
  MCP_SERVER_URL,
  MCP_TRUST_PROXY,
  PORT,
  SESSION_TIMEOUT_SECONDS,
} from "../config.js";
import { getForwardedRequestHost } from "../utils/forwarded-public-base-url.js";
import { normalizeProxyClientIpForRateLimit } from "../utils/proxy-client-ip.js";
import { createHttpErrorHandler } from "./http-error-handler.js";
import { loadRemoteHttpStack } from "./remote-http-stack.js";
import { redactSessionIdForLog } from "./request-helpers.js";
import { TransportMode } from "./transport-mode.js";
import {
  colorGreen,
  colorReset,
  isConstantTimeSecretMatch,
  type TransportDeps,
} from "./transport-shared.js";
import { SERVER_VERSION } from "./version.js";

/**
 * Start server with traditional SSE transport
 */
export async function startSSEServer(deps: TransportDeps): Promise<void> {
  const { createServer, logger, clientPool, registerDownloadProxyRoutes } = deps;
  const { express, rateLimit, ipKeyGenerator, SSEServerTransport } = await loadRemoteHttpStack();
  const app = express();
  const sseJsonBodyParser = express.json({ limit: GITLAB_MCP_REQUEST_BODY_LIMIT });
  const sseAuthToken = getConfig("sse-auth-token", "SSE_AUTH_TOKEN");

  if (MCP_TRUST_PROXY) {
    app.set("trust proxy", 1);
  }

  const requireSseAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!sseAuthToken) return next();

    const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || "");
    if (isConstantTimeSecretMatch(match?.[1], sseAuthToken)) return next();

    res.status(401).json({ error: "SSE authentication required" });
  };

  const allowedHosts = new Set([
    `${HOST}:${PORT}`,
    `127.0.0.1:${PORT}`,
    `localhost:${PORT}`,
    `[::1]:${PORT}`,
  ]);
  if (MCP_SERVER_URL) allowedHosts.add(new URL(MCP_SERVER_URL).host);

  const getEffectiveAllowedHosts = (req: Request): Set<string> => {
    const effectiveHosts = new Set(allowedHosts);
    if (MCP_TRUST_PROXY) {
      const forwardedHost = getForwardedRequestHost(req, true);
      if (forwardedHost) {
        effectiveHosts.add(forwardedHost);
      }
    }
    return effectiveHosts;
  };

  const rejectDnsRebinding = (req: Request, res: Response, next: NextFunction) => {
    const effectiveHosts = getEffectiveAllowedHosts(req);
    const host = req.headers.host;
    const forwardedHost = MCP_TRUST_PROXY ? getForwardedRequestHost(req, true) : undefined;
    const requestHosts = [host, forwardedHost].filter((value): value is string => Boolean(value));

    if (
      requestHosts.length === 0 ||
      !requestHosts.some(requestHost => effectiveHosts.has(requestHost))
    ) {
      res.status(403).json({ error: "Invalid Host header" });
      return;
    }

    const origin = req.headers.origin;
    if (origin) {
      try {
        if (!effectiveHosts.has(new URL(origin).host)) {
          res.status(403).json({ error: "Invalid Origin header" });
          return;
        }
      } catch {
        res.status(403).json({ error: "Invalid Origin header" });
        return;
      }
    }

    next();
  };

  // Session IDs are untrusted map keys (POST /messages?sessionId=). A null
  // prototype prevents inherited names such as "constructor" from masquerading
  // as live transports, matching the Streamable HTTP transport.
  const transports: Record<string, SseServerTransport> = Object.create(null);
  const sessionLastActivity = new Map<string, number>();
  let shuttingDown = false;

  // Mirror the Streamable HTTP controls so the SSE transport cannot be used to
  // exhaust the process: a session cap, a per-IP creation rate limit and an idle
  // timeout that closes connections which never send anything.
  const maxSessions = getMaxSessions();
  const maxSseConnectionsPerMinute = getMaxRequestsPerMinute();
  const idleTimeoutMs = Math.max(SESSION_TIMEOUT_SECONDS, 1) * 1000;

  const sseConnectionRateLimit = rateLimit({
    windowMs: 60_000,
    limit: maxSseConnectionsPerMinute,
    keyGenerator: (req: Request) =>
      ipKeyGenerator(normalizeProxyClientIpForRateLimit(req.ip ?? "")),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        error: "Rate limit exceeded",
        message: `Maximum ${maxSseConnectionsPerMinute} SSE connections per minute allowed`,
      });
    },
  });

  /**
   * Reclaim SSE sessions that have not received a POST /messages request within
   * the idle timeout.
   *
   * On /sse it is correct to idle-close an open GET: the stream alone is not
   * proof of a live client, so a client that connects and never sends anything
   * would otherwise hold a MAX_SESSIONS slot forever. This intentionally
   * differs from the Streamable HTTP GET /mcp handler, which pauses inactivity
   * expiry while its stream is open so list_changed can still be pushed - do
   * not copy that rule here.
   */
  const closeIdleSseSessions = () => {
    const now = Date.now();
    for (const [sessionId, lastActivity] of sessionLastActivity) {
      if (now - lastActivity < idleTimeoutMs) continue;
      const transport = transports[sessionId];
      delete transports[sessionId];
      sessionLastActivity.delete(sessionId);
      const sidPrefix = redactSessionIdForLog(sessionId);
      logger.info(
        { sidPrefix, event: "sse_session_idle_closed" },
        `SSE session ${sidPrefix} closed after ${SESSION_TIMEOUT_SECONDS}s of inactivity`
      );
      if (transport) {
        void transport.close().catch(error => {
          logger.error({ err: error }, "Error closing idle SSE transport");
        });
      }
    }
  };

  const idleSweep = setInterval(closeIdleSseSessions, Math.min(idleTimeoutMs, 60_000));
  idleSweep.unref();

  app.get(
    "/sse",
    rejectDnsRebinding,
    requireSseAuth,
    sseConnectionRateLimit,
    async (req: Request, res: Response) => {
      if (Object.keys(transports).length >= maxSessions) {
        res.status(503).json({
          error: "Server capacity reached",
          message: `Maximum ${maxSessions} concurrent sessions allowed. Please try again later.`,
        });
        return;
      }

      const serverInstance = createServer();
      const effectiveHosts = getEffectiveAllowedHosts(req);
      const transport = new SSEServerTransport("/messages", res, {
        enableDnsRebindingProtection: true,
        allowedHosts: [...effectiveHosts],
        allowedOrigins: [...effectiveHosts].flatMap(host => [`http://${host}`, `https://${host}`]),
      });
      const sessionId = transport.sessionId;
      transports[sessionId] = transport;
      sessionLastActivity.set(sessionId, Date.now());
      res.on("close", () => {
        delete transports[sessionId];
        sessionLastActivity.delete(sessionId);
      });

      try {
        await serverInstance.connect(transport);
      } catch (error) {
        logger.error(
          { err: error, sidPrefix: redactSessionIdForLog(sessionId) },
          "SSE connection error"
        );
        // Release the capacity slot immediately instead of waiting for the
        // client to disconnect or the idle sweep to run.
        delete transports[sessionId];
        sessionLastActivity.delete(sessionId);
        if (!res.headersSent) {
          res.status(500).json({
            error: "Internal server error",
            message: error instanceof Error ? error.message : "Unknown error",
          });
        } else {
          res.end();
        }
      }
    }
  );

  const requireSseSession = (req: Request, res: Response, next: NextFunction) => {
    const sessionId = req.query.sessionId;
    if (typeof sessionId !== "string" || !transports[sessionId]) {
      res.status(400).send("No transport found for sessionId");
      return;
    }
    next();
  };

  app.post(
    "/messages",
    rejectDnsRebinding,
    requireSseAuth,
    requireSseSession,
    sseJsonBodyParser,
    async (req: Request, res: Response) => {
      const sessionId = req.query.sessionId as string;
      const transport = transports[sessionId];
      if (transport) {
        sessionLastActivity.set(sessionId, Date.now());
        await transport.handlePostMessage(req, res, req.body);
      } else {
        res.status(400).send("No transport found for sessionId");
      }
    }
  );

  registerDownloadProxyRoutes(app);

  app.get("/health", (_: Request, res: Response) => {
    const activeSessions = Object.keys(transports).length;
    const isHealthy = activeSessions < maxSessions;
    if (!isHealthy) {
      logger.warn(
        { activeSessions, maxSessions },
        "Health check degraded: active SSE session capacity reached"
      );
    }
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? "healthy" : "degraded",
      version: SERVER_VERSION,
      transport: TransportMode.SSE,
      activeSessions,
      maxSessions,
      uptime: process.uptime(),
    });
  });

  app.use(createHttpErrorHandler(logger));

  const httpServer = app.listen(Number(PORT), HOST, () => {
    logger.info("GitLab MCP Server running with SSE transport");
    logger.info(`${colorGreen}Endpoint: http://${HOST}:${PORT}/sse${colorReset}`);
  });

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down SSE server...`);
    clearInterval(idleSweep);
    httpServer.close(() => logger.info("SSE HTTP server closed"));
    await Promise.allSettled(
      Object.values(transports).map(async transport => {
        try {
          await transport.close();
        } catch (error) {
          logger.error({ err: error }, "Error closing SSE transport");
        }
      })
    );
    clientPool.closeAll();
    process.exit(0);
  };

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
}
