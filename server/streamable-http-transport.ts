import type { StreamableHTTPServerTransport as StreamableTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { NextFunction, Request, Response } from "express";
import { createHash, randomUUID } from "node:crypto";
import { URL } from "node:url";
import {
  BASE_HEADERS,
  bindSessionProjectScope,
  getFetchConfig,
  SESSION_PROJECT_SCOPE_MISMATCH,
  sessionAuthStore,
  authBySession,
  updateSessionPublicBaseUrl,
  withPublicBaseUrl,
  type AuthData,
  type SessionAuth,
} from "./gitlab-request-context.js";
import {
  ENABLE_DYNAMIC_API_URL,
  ENABLE_DYNAMIC_PROJECT_SCOPE,
  GITLAB_ALLOW_UNAUTHENTICATED_TOOL_DISCOVERY,
  GITLAB_ALLOWED_PROJECT_IDS,
  GITLAB_MCP_OAUTH,
  GITLAB_MCP_REQUEST_BODY_LIMIT,
  GITLAB_OAUTH_ALLOWED_GROUPS,
  GITLAB_OAUTH_ALLOWED_REDIRECT_URIS_RAW,
  GITLAB_OAUTH_APP_ID,
  GITLAB_OAUTH_CALLBACK_PROXY,
  GITLAB_OAUTH_SCOPES,
  GITLAB_PERMISSION_MODE,
  getMaxRequestsPerMinute,
  getMaxSessions,
  getOauthRegisterRateLimitPerHour,
  HOST,
  MCP_SERVER_URL,
  MCP_TRUST_PROXY,
  OAUTH_DISABLE_REFRESH_TOKEN,
  OAUTH_STATELESS_CLIENT_TTL_SECONDS,
  OAUTH_STATELESS_MODE,
  OAUTH_STATELESS_PENDING_TTL_SECONDS,
  OAUTH_STATELESS_SESSION_TTL_SECONDS,
  OAUTH_STATELESS_STORED_TTL_SECONDS,
  PORT,
  REMOTE_AUTHORIZATION,
  SESSION_TIMEOUT_SECONDS,
} from "../config.js";
import { createGitLabOAuthProvider } from "../oauth-proxy.js";
import { parseAllowedRedirectUris } from "../oauth-consent.js";
import { getForwardedPublicBaseUrl } from "../utils/forwarded-public-base-url.js";
import { normalizeProxyClientIpForRateLimit } from "../utils/proxy-client-ip.js";
import { redactUrlSecretsInText } from "../utils/redact-url.js";
import {
  looksLikeStatelessSessionId,
  mintSessionId,
  openSessionId,
  type SessionAuthHeader,
  type StatelessKeyMaterial,
} from "../stateless/index.js";
import { createHttpErrorHandler } from "./http-error-handler.js";
import { loadRemoteHttpStack } from "./remote-http-stack.js";
import { formatPrometheusMetrics } from "./metrics.js";
import {
  isInitializationRequestBody,
  isUnauthenticatedDiscoveryRequestBody,
  parseProjectScopeHeader,
  readAcceptHeader,
  readMcpSessionIdHeader,
  redactSessionIdForLog,
} from "./request-helpers.js";
import {
  colorGreen,
  colorReset,
  isConstantTimeSecretMatch,
  type TransportDeps,
} from "./transport-shared.js";
import { SERVER_VERSION } from "./version.js";

/**
 * Start server with Streamable HTTP transport
 */
export async function startStreamableHTTPServer(deps: TransportDeps): Promise<void> {
  const {
    createServer,
    logger,
    clientPool,
    GITLAB_API_URL,
    STREAMABLE_HTTP_AUTH_TOKEN,
    STATELESS_MATERIAL,
    requireMcpHostAndOrigin,
    hasStatelessSessionId,
    getFetch,
    registerDownloadProxyRoutes,
    resolveTrustedGitLabApiUrl,
  } = deps;
  const {
    express,
    rateLimit,
    ipKeyGenerator,
    StreamableHTTPServerTransport,
    mcpAuthRouter,
    createOAuthMetadata,
    metadataHandler,
    requireBearerAuth,
  } = await loadRemoteHttpStack();
  const app = express();
  // Session IDs are untrusted map keys. A null prototype prevents inherited
  // names such as "constructor" from masquerading as live transports.
  const streamableTransports: Record<string, StreamableTransport> = Object.create(null);

  const authTimeouts: Record<string, NodeJS.Timeout> = {};
  // Sessions with an open GET /mcp stream. The SDK allows one stream per session and
  // rejects a second GET with 409; that request must not touch the session's timer.
  const openGetStreams = new Set<string>();

  // Configuration and limits
  const MAX_SESSIONS = getMaxSessions();
  const MAX_REQUESTS_PER_MINUTE = getMaxRequestsPerMinute();

  // Metrics tracking
  const metrics = {
    activeSessions: 0,
    totalSessions: 0,
    expiredSessions: 0,
    authFailures: 0,
    requestsProcessed: 0,
    rejectedByRateLimit: 0,
    rejectedByCapacity: 0,
    // Stateless-mode counters. Only non-zero when OAUTH_STATELESS_MODE=true.
    statelessRequests: 0,
    statelessAuthFromHeader: 0, // fresh Authorization/Private-Token/JOB-TOKEN present
    statelessAuthFromSealedSid: 0, // auth reconstructed from sealed Mcp-Session-Id
    statelessAuthFailures: 0, // neither source yielded usable auth
    statelessSidRotated: 0, // minted a new sid because fresh auth was present
  };

  // Rate limiting per session
  const sessionRequestCounts: Record<string, { count: number; resetAt: number }> = {};

  // MCP OAuth and REMOTE_AUTHORIZATION modes: the GitLab user each stateful
  // session belongs to. Once set, it only changes when the session is cleaned up.
  const sessionOwners: Record<string, string> = Object.create(null);

  /**
   * Validate token format and length
   */
  const validateToken = (token: string): boolean => {
    // GitLab PAT format: glpat-xxxxx (min 20 chars)
    if (token.length < 20) return false;
    if (!/^[-a-zA-Z0-9_.]+$/.test(token)) return false;
    return true;
  };

  /**
   * Check rate limit for session
   */
  const checkRateLimit = (sessionId: string): boolean => {
    const now = Date.now();
    const session = sessionRequestCounts[sessionId];

    if (!session || now > session.resetAt) {
      sessionRequestCounts[sessionId] = { count: 1, resetAt: now + 60000 };
      return true;
    }

    if (session.count >= MAX_REQUESTS_PER_MINUTE) {
      return false;
    }

    session.count++;
    return true;
  };

  /**
   * Check whether the request carries a raw header auth token (Private-Token or JOB-TOKEN).
   * Used to decide whether to bypass OAuth validation.
   */
  const hasHeaderAuth = (req: Request): boolean => {
    return !!(
      (req.headers["private-token"] as string | undefined) ||
      (req.headers["job-token"] as string | undefined)
    );
  };

  /**
   * Parse authentication from request headers
   * Returns null if no auth found or invalid format
   * Supports: Private-Token header, JOB-TOKEN header, Authorization Bearer header
   * Priority: Private-Token > JOB-TOKEN > Authorization Bearer
   */
  const parseAuthHeaders = (req: Request): AuthData | null => {
    const authHeader = (req.headers["authorization"] as string | undefined) || "";
    const privateToken = (req.headers["private-token"] as string | undefined) || "";
    const jobToken = (req.headers["job-token"] as string | undefined) || "";
    const dynamicApiUrl = (req.headers["x-gitlab-api-url"] as string | undefined)?.trim();
    const requestedProjectScope = (
      req.headers["x-gitlab-allowed-project-ids"] as string | undefined
    )?.trim();

    let apiUrl = GITLAB_API_URL; // Default API URL
    let allowedProjectIds: string[] | undefined;

    // Only process the requested project scope if the feature is enabled
    if (ENABLE_DYNAMIC_PROJECT_SCOPE && requestedProjectScope !== undefined) {
      const scope = parseProjectScopeHeader(requestedProjectScope, GITLAB_ALLOWED_PROJECT_IDS);
      if ("error" in scope) {
        logger.warn(scope.error);
        return null; // Reject an empty header, or one that tries to widen the configured allowlist
      }
      allowedProjectIds = scope.projectIds;
    }

    // Only process dynamic URL if the feature is enabled
    if (ENABLE_DYNAMIC_API_URL && dynamicApiUrl) {
      try {
        apiUrl = resolveTrustedGitLabApiUrl(dynamicApiUrl);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Invalid X-GitLab-API-URL";
        logger.warn(
          `Invalid X-GitLab-API-URL provided: ${redactUrlSecretsInText(dynamicApiUrl)}. ${reason}`
        );
        return null; // Reject if URL is malformed or not allowed
      }
    }

    // Extract token — priority: Private-Token > JOB-TOKEN > Authorization Bearer
    // PATs are preferred over job tokens because they carry broader permissions.
    let token: string | null = null;
    let header: "Authorization" | "Private-Token" | "JOB-TOKEN" | null = null;

    if (privateToken) {
      token = privateToken.trim();
      header = "Private-Token";
    } else if (jobToken) {
      token = jobToken.trim();
      header = "JOB-TOKEN";
    } else if (authHeader) {
      // Use \S+ instead of .+ to prevent ReDoS attacks
      // \S+ only matches non-whitespace, so trim() is technically unnecessary,
      // but we keep it for defensive coding and backward compatibility
      const match = /^Bearer\s+(\S+)$/i.exec(authHeader);
      if (match) {
        token = match[1].trim();
        header = "Authorization";
      }
    }

    // Validate token and return AuthData object
    if (token && header && validateToken(token)) {
      return { header, token, lastUsed: Date.now(), apiUrl, allowedProjectIds };
    }

    return null;
  };

  /**
   * Identify the GitLab user behind a credential. When GitLab does not report a
   * user id, fall back to a digest of the token so only that exact token matches.
   */
  const sessionOwnerKey = (apiUrl: string, userId: unknown, token: string): string =>
    typeof userId === "number" || typeof userId === "string"
      ? `${apiUrl.replace(/\/$/, "")}#${userId}`
      : `token:${createHash("sha256").update(token).digest("hex")}`;

  /**
   * Validate header auth against GitLab. Resolves to the session owner key of
   * the token, or null when GitLab rejects it.
   */
  const resolveAuthOwnerUpstream = async (authData: AuthData): Promise<string | null> => {
    const apiUrl = authData.apiUrl.replace(/\/$/, "");
    const paths = authData.header === "JOB-TOKEN" ? ["user", "job"] : ["user"];
    try {
      for (const path of paths) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const response = await getFetch()(`${apiUrl}/${path}`, {
            ...getFetchConfig(),
            headers: {
              ...BASE_HEADERS,
              [authData.header]:
                authData.header === "Authorization" ? `Bearer ${authData.token}` : authData.token,
            },
            signal: controller.signal as any,
          });
          if (response.ok) {
            const body = (await response.json().catch(() => undefined)) as
              { id?: unknown; user?: { id?: unknown } } | undefined;
            const userId = path === "job" ? body?.user?.id : body?.id;
            return sessionOwnerKey(apiUrl, userId, authData.token);
          }
        } finally {
          clearTimeout(timeout);
        }
      }
      return null;
    } catch (error) {
      logger.warn({ err: error }, "Remote auth token validation failed");
      return null;
    }
  };

  const validateAuthDataUpstream = async (authData: AuthData): Promise<boolean> =>
    (await resolveAuthOwnerUpstream(authData)) !== null;

  /**
   * With GITLAB_OAUTH_ALLOWED_GROUPS set in MCP OAuth mode, credentials that do
   * not pass through verifyAccessToken (Private-Token / JOB-TOKEN headers and
   * sealed stateless session ids) get the same group check, using the OAuth
   * provider's per-token membership cache. CI job tokens cannot list the
   * user's groups, so they are refused. Returns null when access is allowed.
   */
  const checkAllowedGroups = async (
    header: SessionAuthHeader,
    token: string
  ): Promise<{ status: number; body: { error: string; message: string } } | null> => {
    if (!GITLAB_MCP_OAUTH || !GITLAB_OAUTH_ALLOWED_GROUPS) return null;
    if (header === "JOB-TOKEN") {
      return {
        status: 403,
        body: {
          error: "JOB-TOKEN header not accepted",
          message:
            "GITLAB_OAUTH_ALLOWED_GROUPS is set and CI job tokens cannot be checked for group " +
            "membership. Use OAuth or a Private-Token header instead.",
        },
      };
    }
    const provider = (app as any)._mcpOAuthProvider as ReturnType<typeof createGitLabOAuthProvider>;
    try {
      if (await provider.isAllowedGroupMember(token)) return null;
    } catch (error) {
      logger.warn({ err: error }, "Group membership lookup failed");
      return {
        status: 503,
        body: {
          error: "Group membership check unavailable",
          message: "Could not verify group membership with GitLab. Please retry.",
        },
      };
    }
    return {
      status: 403,
      body: {
        error: "Access denied",
        message: "The token owner is not a member of an allowed group.",
      },
    };
  };

  const sessionAuthTokensMatch = (left: AuthData, right: AuthData): boolean =>
    left.header === right.header && left.token === right.token && left.apiUrl === right.apiUrl;

  /**
   * Store a session's credential and bind the session to the credential's owner
   * (`options.owner` when the caller already resolved it). A credential of another
   * user than the bound owner is refused as "foreign".
   */
  const storeValidatedSessionAuth = async (
    targetSessionId: string,
    authData: AuthData,
    publicBaseUrl?: string,
    existing?: AuthData,
    options?: { skipIfUnchanged?: boolean; owner?: string }
  ): Promise<"stored" | "unchanged" | "invalid" | "foreign"> => {
    const current = authBySession[targetSessionId];
    if (options?.skipIfUnchanged && current && sessionAuthTokensMatch(current, authData)) {
      authBySession[targetSessionId].lastUsed = Date.now();
      updateSessionPublicBaseUrl(targetSessionId, publicBaseUrl);
      setAuthTimeout(targetSessionId);
      return "unchanged";
    }
    const owner = options?.owner ?? (await resolveAuthOwnerUpstream(authData));
    if (owner === null) {
      return "invalid";
    }
    // Read after the GitLab lookup: a concurrent request may have bound the session meanwhile.
    const boundOwner = sessionOwners[targetSessionId];
    if (boundOwner !== undefined && boundOwner !== owner) {
      return "foreign";
    }
    sessionOwners[targetSessionId] = owner;
    authBySession[targetSessionId] = withPublicBaseUrl(
      authData,
      publicBaseUrl,
      existing ?? current
    );
    setAuthTimeout(targetSessionId);
    return "stored";
  };

  /**
   * Set or reset timeout for session auth.
   * After SESSION_TIMEOUT_SECONDS of inactivity, the auth token is removed
   * and the Streamable HTTP transport is closed so the session slot is released.
   */
  const setAuthTimeout = (sessionId: string) => {
    // Clear existing timeout if any
    clearAuthTimeout(sessionId);

    // Set new timeout
    authTimeouts[sessionId] = setTimeout(() => {
      const authData = authBySession[sessionId];
      const transport = streamableTransports[sessionId];
      if (authData || transport) {
        logger.info(
          authData
            ? `Session ${redactSessionIdForLog(sessionId)}: auth token expired after ${SESSION_TIMEOUT_SECONDS}s of inactivity`
            : REMOTE_AUTHORIZATION || GITLAB_MCP_OAUTH
              ? `Session ${redactSessionIdForLog(sessionId)}: unauthenticated discovery expired after ${SESSION_TIMEOUT_SECONDS}s`
              : `Session ${redactSessionIdForLog(sessionId)}: closed after ${SESSION_TIMEOUT_SECONDS}s of inactivity`
        );
        delete authBySession[sessionId];
        delete authTimeouts[sessionId];
        metrics.expiredSessions++;
        // Close the transport to free the slot; without this, stale sessions accumulate and exhaust MAX_SESSIONS.
        if (transport) {
          transport.close().catch(err => {
            logger.error(
              `Error closing transport for expired session ${redactSessionIdForLog(sessionId)}:`,
              err
            );
          });
        }
      }
    }, SESSION_TIMEOUT_SECONDS * 1000);
  };

  /**
   * Clear timeout for session auth
   */
  const clearAuthTimeout = (sessionId: string) => {
    const timeout = authTimeouts[sessionId];
    if (timeout) {
      clearTimeout(timeout);
      delete authTimeouts[sessionId];
    }
  };

  /**
   * Clean up session auth data
   */
  const cleanupSessionAuth = (sessionId: string) => {
    delete authBySession[sessionId];
    delete sessionOwners[sessionId];
    clearAuthTimeout(sessionId);
  };

  /**
   * Stateless-mode handler for /mcp POSTs.
   *
   * The MCP Streamable HTTP SDK can run in "stateless mode" when
   * `sessionIdGenerator` is undefined — it creates no session state and
   * short-circuits session validation. We exploit that by driving the
   * session identity ourselves via an AEAD-sealed `Mcp-Session-Id`:
   *
   *   1. Every request gets a freshly-instantiated transport (SDK-stateless).
   *   2. The caller's auth is derived from:
   *      - live request headers (preferred; handles OAuth token refresh),
   *      - or the sealed Mcp-Session-Id (for requests that omit headers).
   *   3. We assign `transport.sessionId = <sealed>` so the SDK emits the
   *      Mcp-Session-Id response header for the client to echo back.
   *   4. The AsyncLocalStorage auth context is populated from the derived
   *      auth, bypassing authBySession / authTimeouts entirely.
   *
   * Rate limiting is explicitly disabled in stateless mode (per-pod counters
   * would yield a loose global bound — operators can rate-limit upstream).
   */
  const handleStatelessMcpRequest = async (
    req: Request,
    res: Response,
    material: StatelessKeyMaterial,
    sessionTtlSeconds: number
  ): Promise<void> => {
    metrics.statelessRequests++;

    // Step 1: derive the effective auth for this request.
    // Priority: live headers > sealed sid. This lets clients refresh OAuth
    // tokens without re-initializing their MCP session.
    const incomingSid = readMcpSessionIdHeader(req);
    const isInit = isInitializationRequestBody(req.body);
    const headerAuth = parseAuthHeaders(req);
    const opened =
      incomingSid && looksLikeStatelessSessionId(incomingSid)
        ? openSessionId(material, incomingSid, sessionTtlSeconds)
        : null;

    // In GITLAB_MCP_OAUTH mode, req.auth may be populated by requireBearerAuth.
    // Use it when headerAuth is null (no Private-Token / JOB-TOKEN / Authorization).
    let effective: {
      header: SessionAuthHeader;
      token: string;
      apiUrl: string;
      allowedProjectIds?: string[];
    } | null = null;
    let freshAuthPresent = false;
    if (headerAuth) {
      let needsUpstreamValidation = isInit || !incomingSid;
      if (!needsUpstreamValidation && incomingSid && looksLikeStatelessSessionId(incomingSid)) {
        needsUpstreamValidation =
          !opened ||
          opened.h !== headerAuth.header ||
          opened.t !== headerAuth.token ||
          opened.u !== headerAuth.apiUrl;
      }
      if (needsUpstreamValidation && !(await validateAuthDataUpstream(headerAuth))) {
        metrics.authFailures++;
        metrics.statelessAuthFailures++;
        res.status(401).json({
          error: "Invalid GitLab authentication header",
          message: "The provided GitLab token was rejected by the configured GitLab API.",
        });
        return;
      }
      effective = {
        header: headerAuth.header,
        token: headerAuth.token,
        apiUrl: headerAuth.apiUrl,
        allowedProjectIds: headerAuth.allowedProjectIds,
      };
      freshAuthPresent = true;
    } else if (GITLAB_MCP_OAUTH) {
      const authInfo = req.auth;
      if (authInfo?.token) {
        effective = {
          header: "Authorization",
          token: authInfo.token,
          apiUrl: GITLAB_API_URL,
        };
        freshAuthPresent = true;
      }
    }
    if (freshAuthPresent) metrics.statelessAuthFromHeader++;

    // Fall back to the sealed sid when no live headers are present. Track
    // whether a sid was presented but rejected (expired / tampered / wrong
    // key / malformed) so we can return 404 below — the MCP Streamable HTTP
    // contract is that session-bound requests get 404 on a terminated session,
    // which tells the client to re-initialize. Returning 401 here would
    // instead trigger the client's auth-failure path and break automatic
    // recovery after inactivity TTL expiry.
    let sidPresentedButInvalid = false;
    if (!effective && incomingSid) {
      if (looksLikeStatelessSessionId(incomingSid)) {
        if (opened) {
          effective = {
            header: opened.h,
            token: opened.t,
            apiUrl: opened.u,
            allowedProjectIds: opened.p,
          };
          metrics.statelessAuthFromSealedSid++;
        } else {
          sidPresentedButInvalid = true;
        }
      } else {
        // Non-stateless-shaped sid (e.g. a UUID from a prior stateful run, or
        // garbage). From the caller's perspective the session is unknown — we
        // surface that as "session ended" rather than as an auth problem.
        sidPresentedButInvalid = true;
      }
    }

    if (!effective) {
      metrics.authFailures++;
      metrics.statelessAuthFailures++;
      if (sidPresentedButInvalid) {
        // Per MCP Streamable HTTP: a 404 on a session-bound request signals
        // "session ended, re-initialize". The inactivity TTL expiring looks
        // identical to a session the server no longer recognizes — in both
        // cases the client should start a fresh initialize handshake.
        res.status(404).json({
          error: "Session not found",
          message:
            "Stateless mode: Mcp-Session-Id is expired, invalid, or from a " +
            "different key. Re-initialize to obtain a new session id.",
        });
        return;
      }
      res.status(401).json({
        error: "Authentication required",
        message:
          "Stateless mode: provide Private-Token, JOB-TOKEN, or Authorization " +
          "header, or a valid Mcp-Session-Id from a previous response.",
      });
      return;
    }

    // Sid-only requests never reach verifyAccessToken or the header check in
    // mcpBearerAuth, so the sealed credential is checked here (cached per token).
    const groupDenial = await checkAllowedGroups(effective.header, effective.token);
    if (groupDenial) {
      metrics.authFailures++;
      metrics.statelessAuthFailures++;
      res.status(groupDenial.status).json(groupDenial.body);
      return;
    }

    // The project scope sealed into the sid belongs to the session: live headers
    // may refresh the token but cannot drop or replace the scope.
    if (ENABLE_DYNAMIC_PROJECT_SCOPE && freshAuthPresent && !isInit && opened) {
      const allowedProjectIds = bindSessionProjectScope(effective.allowedProjectIds, opened.p);
      if (allowedProjectIds === null) {
        metrics.authFailures++;
        metrics.statelessAuthFailures++;
        res.status(401).json(SESSION_PROJECT_SCOPE_MISMATCH);
        return;
      }
      effective.allowedProjectIds = allowedProjectIds;
    }

    // Always mint a fresh sid so the embedded iat advances on every request.
    // This makes OAUTH_STATELESS_SESSION_TTL_SECONDS behave as an inactivity
    // timeout rather than an absolute-age cap — matching the legacy
    // setAuthTimeout semantics. Reusing the incoming sid would regress
    // long-lived sessions that authenticate via sealed-sid replay (typical
    // REMOTE_AUTHORIZATION flow after init).
    const freshSid = mintSessionId(material, {
      header: effective.header,
      token: effective.token,
      apiUrl: effective.apiUrl,
      allowedProjectIds: effective.allowedProjectIds,
    });
    if (freshAuthPresent) {
      metrics.statelessSidRotated++;
    }

    logger.debug(
      {
        sidPrefix: redactSessionIdForLog(freshSid),
        freshAuthPresent,
        header: effective.header,
      },
      "stateless /mcp request"
    );

    // Step 3: build the AsyncLocalStorage context so buildAuthHeaders and
    // getEffectiveApiUrl read from the derived auth.
    const ctx: SessionAuth = {
      sessionId: freshSid,
      header: effective.header,
      token: effective.token,
      lastUsed: Date.now(),
      apiUrl: effective.apiUrl,
      publicBaseUrl: getForwardedPublicBaseUrl(req, MCP_TRUST_PROXY),
      allowedProjectIds: effective.allowedProjectIds,
    };

    // Step 4: create a fresh transport per request.
    // DNS rebinding protection is enforced by requireMcpHostAndOrigin middleware;
    // the SDK's allowedHosts exact-match cannot express loopback-on-any-port.
    const transport = isInit
      ? new StreamableHTTPServerTransport({
          sessionIdGenerator: () => freshSid,
        })
      : new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // SDK stateless mode for non-init
        });

    // For non-init requests the SDK runs in its internal stateless mode and
    // does not emit an Mcp-Session-Id response header. We pre-set the
    // freshly minted sid on the Express response so clients can adopt the
    // latest sid (and its advanced iat) on every response. Headers passed
    // to the SDK's writeHead() call are merged with pre-set headers per
    // Node.js semantics, so this does not clobber SDK-managed values.
    // Without this, the inactivity-timeout semantics of
    // OAUTH_STATELESS_SESSION_TTL_SECONDS silently regress to an
    // absolute-age cap for sid-only auth flows.
    if (!isInit) {
      res.setHeader("Mcp-Session-Id", freshSid);
    }

    const serverInstance = createServer();
    await serverInstance.connect(transport);

    await sessionAuthStore.run(ctx, async () => {
      try {
        await transport.handleRequest(req, res, req.body);
      } catch (err) {
        logger.error({ err }, "stateless /mcp error");
        if (!res.headersSent) {
          res.status(500).json({
            error: "Internal server error",
            message: err instanceof Error ? err.message : "Unknown error",
          });
        }
      } finally {
        // Fresh transport per request — always close to release any stream
        // resources. The SDK treats close() as idempotent.
        try {
          await transport.close();
        } catch {
          // ignore
        }
      }
    });
  };

  // Configure Express middleware
  if (MCP_TRUST_PROXY) {
    app.set("trust proxy", 1);
  }

  app.use("/mcp", requireMcpHostAndOrigin);
  const mcpJsonBodyParser = express.json({ limit: GITLAB_MCP_REQUEST_BODY_LIMIT });

  registerDownloadProxyRoutes(app);

  const mcpRateLimitKeyGenerator = (req: Request) =>
    ipKeyGenerator(normalizeProxyClientIpForRateLimit(req.ip ?? ""));
  const mcpRequestRateLimit = rateLimit({
    windowMs: 60_000,
    limit: MAX_REQUESTS_PER_MINUTE,
    keyGenerator: mcpRateLimitKeyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      metrics.rejectedByRateLimit++;
      res.status(429).json({
        error: "Rate limit exceeded",
        message: `Maximum ${MAX_REQUESTS_PER_MINUTE} requests per minute allowed`,
      });
    },
  });

  // MCP OAuth — mount auth router and prepare bearer-auth middleware
  if (GITLAB_MCP_OAUTH) {
    const gitlabBaseUrl = GITLAB_API_URL.replace(/\/api\/v4\/?$/, "").replace(/\/$/, "");
    const issuerUrl = new URL(MCP_SERVER_URL!);
    const callbackUrl = GITLAB_OAUTH_CALLBACK_PROXY
      ? `${issuerUrl.origin}${issuerUrl.pathname.replace(/\/$/, "")}/callback`
      : undefined;
    const statelessOptions =
      OAUTH_STATELESS_MODE && STATELESS_MATERIAL
        ? {
            material: STATELESS_MATERIAL,
            clientTtlSeconds: OAUTH_STATELESS_CLIENT_TTL_SECONDS,
            pendingTtlSeconds: OAUTH_STATELESS_PENDING_TTL_SECONDS,
            storedTtlSeconds: OAUTH_STATELESS_STORED_TTL_SECONDS,
          }
        : null;
    const oauthProvider = createGitLabOAuthProvider(
      gitlabBaseUrl,
      GITLAB_OAUTH_APP_ID!,
      "GitLab MCP Server",
      GITLAB_PERMISSION_MODE === "readonly",
      GITLAB_OAUTH_SCOPES,
      GITLAB_OAUTH_ALLOWED_GROUPS,
      GITLAB_OAUTH_CALLBACK_PROXY,
      callbackUrl,
      statelessOptions,
      parseAllowedRedirectUris(GITLAB_OAUTH_ALLOWED_REDIRECT_URIS_RAW),
      OAUTH_DISABLE_REFRESH_TOKEN
    );
    const scopesSupported = GITLAB_OAUTH_SCOPES ?? ["api", "read_api", "read_user"];
    const grantTypesSupported = OAUTH_DISABLE_REFRESH_TOKEN
      ? ["authorization_code"]
      : ["authorization_code", "refresh_token"];

    // When server URL has a path (e.g. behind Kong), the SDK's well-known metadata
    // advertises root-level endpoints. Override to use path-prefixed endpoints.
    const issuerPath = issuerUrl.pathname.replace(/\/$/, "");
    if (issuerPath) {
      const routedBaseUrl = `${issuerUrl.origin}${issuerPath}`;
      const authorizationServerMetadata = {
        issuer: issuerUrl.href,
        authorization_endpoint: `${routedBaseUrl}/authorize`,
        token_endpoint: `${routedBaseUrl}/token`,
        registration_endpoint: `${routedBaseUrl}/register`,
        revocation_endpoint: `${routedBaseUrl}/revoke`,
        response_types_supported: ["code"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
        grant_types_supported: grantTypesSupported,
        scopes_supported: scopesSupported,
        revocation_endpoint_auth_methods_supported: ["client_secret_post"],
      };
      const protectedResourceMetadata = {
        resource: issuerUrl.href,
        authorization_servers: [issuerUrl.href],
        scopes_supported: scopesSupported,
        resource_name: "GitLab MCP Server",
      };
      const authorizationMetadataRoutes = [
        "/.well-known/oauth-authorization-server",
        "/.well-known/oauth-authorization-server/*path",
      ];
      const protectedResourceRoutes = [
        "/.well-known/oauth-protected-resource",
        "/.well-known/oauth-protected-resource/*path",
      ];

      app.get(authorizationMetadataRoutes, (_req: Request, res: Response) => {
        res.json(authorizationServerMetadata);
      });

      app.get(protectedResourceRoutes, (_req: Request, res: Response) => {
        res.json(protectedResourceMetadata);
      });

      logger.info(
        { issuerPath },
        "Serving path-aware OAuth metadata for reverse-proxy deployments"
      );
    }

    // RFC 9728 path-suffixed discovery: clients connecting to /mcp will
    // request /.well-known/oauth-protected-resource/mcp to discover the
    // resource identifier. Register this route so the resource field matches
    // the actual transport URL the client connects to - regardless of
    // whether the server is deployed behind a path-stripping reverse proxy.
    if (!issuerPath) {
      const mcpResourceUrl = `${issuerUrl.origin}/mcp`;
      app.get("/.well-known/oauth-protected-resource/mcp", (_req: Request, res: Response) => {
        res.json({
          resource: mcpResourceUrl,
          authorization_servers: [issuerUrl.href],
          scopes_supported: scopesSupported,
          resource_name: "GitLab MCP Server",
        });
      });
    }

    // The SDK's root metadata always lists refresh_token; shadow it with the
    // same document minus that grant (CORS + GET/OPTIONS kept by metadataHandler).
    if (!issuerPath && OAUTH_DISABLE_REFRESH_TOKEN) {
      app.use(
        "/.well-known/oauth-authorization-server",
        metadataHandler({
          ...createOAuthMetadata({
            provider: oauthProvider,
            issuerUrl,
            baseUrl: issuerUrl,
            scopesSupported,
          }),
          grant_types_supported: grantTypesSupported,
        })
      );
    }

    // Mounts /.well-known/oauth-authorization-server (shadowed above when basePath set
    //        or OAUTH_DISABLE_REFRESH_TOKEN is on),
    //        /.well-known/oauth-protected-resource, /authorize, /token, /register, /revoke
    // Some proxies include the port in X-Forwarded-For (e.g. "1.2.3.4:5678" or
    // "[2001:db8::1]:5678"), which makes express-rate-limit throw
    // ERR_ERL_INVALID_IP_ADDRESS. Strip the port first, then delegate to
    // ipKeyGenerator for correct IPv6 subnet handling.
    const rateLimitOptions = { keyGenerator: mcpRateLimitKeyGenerator };
    const OAUTH_REGISTER_RATE_LIMIT_PER_HOUR = getOauthRegisterRateLimitPerHour();
    const clientRegistrationRateLimitOptions = {
      ...rateLimitOptions,
      windowMs: 60 * 60 * 1000, // 1 hour
      max: OAUTH_REGISTER_RATE_LIMIT_PER_HOUR,
    };
    app.use(
      mcpAuthRouter({
        provider: oauthProvider,
        issuerUrl,
        baseUrl: issuerUrl,
        scopesSupported,
        resourceName: "GitLab MCP Server",
        authorizationOptions: { rateLimit: rateLimitOptions },
        tokenOptions: { rateLimit: rateLimitOptions },
        revocationOptions: { rateLimit: rateLimitOptions },
        clientRegistrationOptions: { rateLimit: clientRegistrationRateLimitOptions },
      })
    );

    // Expose provider so the /mcp route middleware can reference it
    (app as any)._mcpOAuthProvider = oauthProvider;

    // Mount /callback route for callback proxy mode
    if (GITLAB_OAUTH_CALLBACK_PROXY) {
      app.get("/callback", (req: Request, res: Response, next: NextFunction) => {
        oauthProvider.handleCallback(req, res).catch(next);
      });
      logger.info(`Callback proxy mode enabled — /callback route mounted`);
    }
  }

  // Build bearer-auth middleware — no-op unless GITLAB_MCP_OAUTH is enabled.
  // Unauthenticated requests receive 401 + WWW-Authenticate header, which is
  // exactly what Claude.ai needs to trigger the OAuth browser flow.
  //
  // Header auth fallback: if Private-Token or JOB-TOKEN headers are present,
  // OAuth validation is skipped and the raw token is used directly per-session.
  // Note: Authorization: Bearer is always treated as an OAuth token and goes
  // through OAuth validation — use Private-Token for PAT-based header auth.
  const oauthBearerAuth = GITLAB_MCP_OAUTH
    ? requireBearerAuth({
        verifier: (app as any)._mcpOAuthProvider,
        requiredScopes: [],
      })
    : undefined;
  const staticMcpBearerAuth = (req: Request, res: Response, next: NextFunction) => {
    const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || "");
    if (isConstantTimeSecretMatch(match?.[1], STREAMABLE_HTTP_AUTH_TOKEN)) {
      next();
      return;
    }

    res.status(401).json({ error: "Streamable HTTP authentication required" });
  };
  const mcpBearerAuth = GITLAB_MCP_OAUTH
    ? async (req: Request, res: Response, next: NextFunction) => {
        const privateToken = (req.headers["private-token"] as string | undefined) || "";
        const jobToken = (req.headers["job-token"] as string | undefined) || "";
        if (privateToken || jobToken) {
          const authData = parseAuthHeaders(req);
          if (!authData) {
            res.status(401).json({
              error: "Invalid Private-Token or JOB-TOKEN header",
              message: "The provided token failed validation. Check the token value and format.",
            });
            return;
          }
          const sessionId = readMcpSessionIdHeader(req);
          const cached = sessionId ? authBySession[sessionId] : undefined;
          const owner =
            sessionId && cached && sessionAuthTokensMatch(cached, authData)
              ? sessionOwners[sessionId]
              : await resolveAuthOwnerUpstream(authData);
          if (owner === null) {
            res.status(401).json({
              error: "Invalid Private-Token or JOB-TOKEN header",
              message: "The provided token failed validation. Check the token value and format.",
            });
            return;
          }
          // Also runs for existing sessions so group removals take effect
          // once the cached membership result expires.
          const denial = await checkAllowedGroups(authData.header, authData.token);
          if (denial) {
            res.status(denial.status).json(denial.body);
            return;
          }
          res.locals.sessionOwner = owner;
          next();
          return;
        }

        // Stateless-mode sid bypass: when the client sends only an
        // Mcp-Session-Id (no live Authorization), let handleStatelessMcpRequest
        // open the sealed sid. Without this, requireBearerAuth would 401
        // before the handler can reconstruct auth from the sid — breaking
        // sid-only follow-up requests across pods under GITLAB_MCP_OAUTH.
        //
        // We still run oauthBearerAuth when an Authorization header IS
        // present alongside the sid, so a client refreshing its OAuth token
        // gets the new token validated normally. We also key this off
        // header *presence* (not validity): malformed / expired / legacy
        // sids still reach the handler and get the intended 404 Session
        // not found response rather than being masked by a 401 here.
        if (hasStatelessSessionId(req) && !req.headers.authorization) {
          next();
          return;
        }

        oauthBearerAuth!(req, res, next);
      }
    : STREAMABLE_HTTP_AUTH_TOKEN && !REMOTE_AUTHORIZATION
      ? staticMcpBearerAuth
      : (_req: Request, _res: Response, next: NextFunction) => next();

  const rejectUnknownStatefulSession = (req: Request, res: Response, next: NextFunction) => {
    const usesStatelessSessions =
      OAUTH_STATELESS_MODE && STATELESS_MATERIAL && (REMOTE_AUTHORIZATION || GITLAB_MCP_OAUTH);
    const sessionId = readMcpSessionIdHeader(req);
    if (!usesStatelessSessions && sessionId && !streamableTransports[sessionId]) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    next();
  };

  // Owner key of the credential mcpBearerAuth accepted for this request
  const readRequestOwner = (req: Request, res: Response): string | undefined => {
    if (hasHeaderAuth(req)) {
      return res.locals.sessionOwner as string | undefined;
    }
    const authInfo = req.auth;
    return authInfo?.token
      ? sessionOwnerKey(GITLAB_API_URL, authInfo.extra?.resourceOwnerId, authInfo.token)
      : undefined;
  };

  const bindSessionOwner = (sessionId: string, req: Request, res: Response) => {
    const owner = readRequestOwner(req, res);
    if (owner !== undefined) {
      sessionOwners[sessionId] = owner;
    }
  };

  // In MCP OAuth mode a stateful session belongs to the GitLab user who opened it.
  // A credential for another user gets the same 404 as an unknown session, so it
  // can neither use, stream from, nor close the session. A refreshed token for the
  // same user still matches.
  const rejectForeignOAuthSession = (req: Request, res: Response, next: NextFunction) => {
    const sessionId = readMcpSessionIdHeader(req);
    const owner = sessionId ? sessionOwners[sessionId] : undefined;
    if (owner !== undefined && readRequestOwner(req, res) !== owner) {
      metrics.authFailures++;
      res.status(404).json({ error: "Session not found" });
      return;
    }
    next();
  };

  // Same rule with REMOTE_AUTHORIZATION, where clients may leave out the headers:
  // a POST without credentials runs with the token stored for the session, while
  // GET and DELETE must carry a credential of the owner. Only a token that differs
  // from the stored one is looked up at GitLab.
  const rejectForeignRemoteSession = async (req: Request, res: Response, next: NextFunction) => {
    const sessionId = readMcpSessionIdHeader(req);
    const owner = sessionId ? sessionOwners[sessionId] : undefined;
    if (!sessionId || owner === undefined) {
      next();
      return;
    }
    const authData = parseAuthHeaders(req);
    if (!authData) {
      if (req.method === "POST") {
        next();
        return;
      }
      metrics.authFailures++;
      res.status(401).json({
        error: "Missing Private-Token, JOB-TOKEN, or Authorization header",
        message:
          "Remote authorization is enabled. Please provide Private-Token, JOB-TOKEN, or Authorization header.",
      });
      return;
    }
    const stored = authBySession[sessionId];
    const requestOwner =
      stored && sessionAuthTokensMatch(stored, authData)
        ? owner
        : await resolveAuthOwnerUpstream(authData);
    if (requestOwner === null) {
      metrics.authFailures++;
      res.status(401).json({
        error: "Invalid GitLab authentication header",
        message: "The provided GitLab token was rejected by the configured GitLab API.",
      });
      return;
    }
    if (requestOwner !== owner) {
      metrics.authFailures++;
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.locals.sessionOwner = requestOwner;
    next();
  };

  const rejectForeignSession = GITLAB_MCP_OAUTH
    ? rejectForeignOAuthSession
    : rejectForeignRemoteSession;

  // Streamable HTTP endpoint - handles both session creation and message handling
  app.post(
    "/mcp",
    rejectUnknownStatefulSession,
    mcpRequestRateLimit,
    mcpBearerAuth,
    rejectForeignSession,
    mcpJsonBodyParser,
    async (req: Request, res: Response) => {
      const sessionId = readMcpSessionIdHeader(req);
      const publicBaseUrl = getForwardedPublicBaseUrl(req, MCP_TRUST_PROXY);

      // Track request
      metrics.requestsProcessed++;

      // Stateless-mode branch: bypass authBySession / streamableTransports
      // entirely and derive the session auth from either the current request
      // headers (init) or a sealed Mcp-Session-Id (subsequent requests).
      // Rate limiting is disabled here because there is no shared counter.
      if (
        OAUTH_STATELESS_MODE &&
        STATELESS_MATERIAL &&
        (REMOTE_AUTHORIZATION || GITLAB_MCP_OAUTH)
      ) {
        await handleStatelessMcpRequest(
          req,
          res,
          STATELESS_MATERIAL,
          OAUTH_STATELESS_SESSION_TTL_SECONDS
        );
        return;
      }

      const newRemoteAuthData = !sessionId && REMOTE_AUTHORIZATION ? parseAuthHeaders(req) : null;
      let newRemoteAuthOwner: string | null = null;
      let unauthenticatedDiscoveryRequested = false;
      if (!sessionId && REMOTE_AUTHORIZATION) {
        const allowUnauthenticatedDiscovery =
          GITLAB_ALLOW_UNAUTHENTICATED_TOOL_DISCOVERY &&
          isUnauthenticatedDiscoveryRequestBody(req.body);
        unauthenticatedDiscoveryRequested = allowUnauthenticatedDiscovery && !newRemoteAuthData;

        if (!newRemoteAuthData && !allowUnauthenticatedDiscovery) {
          metrics.authFailures++;
          res.status(401).json({
            error: "Missing Private-Token, JOB-TOKEN, or Authorization header",
            message:
              "Remote authorization is enabled. Please provide Private-Token, JOB-TOKEN, or Authorization header.",
          });
          return;
        }

        if (newRemoteAuthData) {
          newRemoteAuthOwner = await resolveAuthOwnerUpstream(newRemoteAuthData);
          if (newRemoteAuthOwner === null) {
            metrics.authFailures++;
            res.status(401).json({
              error: "Invalid GitLab authentication header",
              message: "The provided GitLab token was rejected by the configured GitLab API.",
            });
            return;
          }
        }
      }

      // Rate limiting check for existing sessions
      if ((REMOTE_AUTHORIZATION || GITLAB_MCP_OAUTH) && sessionId && !checkRateLimit(sessionId)) {
        metrics.rejectedByRateLimit++;
        res.status(429).json({
          error: "Rate limit exceeded",
          message: `Maximum ${MAX_REQUESTS_PER_MINUTE} requests per minute allowed`,
        });
        return;
      }

      // Capacity check for new sessions
      if (!sessionId && Object.keys(streamableTransports).length >= MAX_SESSIONS) {
        metrics.rejectedByCapacity++;
        res.status(503).json({
          error: "Server capacity reached",
          message: `Maximum ${MAX_SESSIONS} concurrent sessions allowed. Please try again later.`,
        });
        return;
      }

      // Handle remote authorization: extract and store auth headers per session
      if (REMOTE_AUTHORIZATION) {
        const authData = parseAuthHeaders(req);
        const allowUnauthenticatedDiscovery =
          GITLAB_ALLOW_UNAUTHENTICATED_TOOL_DISCOVERY &&
          isUnauthenticatedDiscoveryRequestBody(req.body);

        if (sessionId && !authBySession[sessionId]) {
          // New session: require auth headers unless public discovery was explicitly enabled.
          if (!authData && !allowUnauthenticatedDiscovery) {
            metrics.authFailures++;
            res.status(401).json({
              error: "Missing Private-Token, JOB-TOKEN, or Authorization header",
              message:
                "Remote authorization is enabled. Please provide Private-Token, JOB-TOKEN, or Authorization header.",
            });
            return;
          }
          // Store auth only when provided. Public discovery intentionally leaves the session unauthenticated.
          if (authData) {
            const result = await storeValidatedSessionAuth(
              sessionId,
              authData,
              publicBaseUrl,
              undefined,
              { owner: res.locals.sessionOwner }
            );
            if (result === "invalid") {
              metrics.authFailures++;
              res.status(401).json({
                error: "Invalid GitLab authentication header",
                message: "The provided GitLab token was rejected by the configured GitLab API.",
              });
              return;
            }
            if (result === "foreign") {
              metrics.authFailures++;
              res.status(404).json({ error: "Session not found" });
              return;
            }
            if (result === "stored") {
              logger.info(
                `Session ${redactSessionIdForLog(sessionId)}: stored ${authData.header} header`
              );
            }
          } else if (allowUnauthenticatedDiscovery) {
            // Schedule cleanup for unauthenticated discovery sessions to prevent slot exhaustion
            setAuthTimeout(sessionId);
          }
        } else if (sessionId && authData) {
          const allowedProjectIds = bindSessionProjectScope(
            authData.allowedProjectIds,
            authBySession[sessionId].allowedProjectIds
          );
          if (allowedProjectIds === null) {
            metrics.authFailures++;
            res.status(401).json(SESSION_PROJECT_SCOPE_MISMATCH);
            return;
          }
          const result = await storeValidatedSessionAuth(
            sessionId,
            { ...authData, allowedProjectIds },
            publicBaseUrl,
            authBySession[sessionId],
            { skipIfUnchanged: true, owner: res.locals.sessionOwner }
          );
          if (result === "invalid") {
            metrics.authFailures++;
            res.status(401).json({
              error: "Invalid GitLab authentication header",
              message: "The provided GitLab token was rejected by the configured GitLab API.",
            });
            return;
          }
          if (result === "foreign") {
            metrics.authFailures++;
            res.status(404).json({ error: "Session not found" });
            return;
          }
          if (result === "stored") {
            logger.debug(
              `Session ${redactSessionIdForLog(sessionId)}: updated ${authData.header} header`
            );
          } else {
            // Same token: keep the stored auth but let an unscoped session narrow.
            authBySession[sessionId].allowedProjectIds = allowedProjectIds;
          }
        } else if (sessionId && authBySession[sessionId]) {
          // Existing session with stored auth: update last used time and reset timeout
          authBySession[sessionId].lastUsed = Date.now();
          updateSessionPublicBaseUrl(sessionId, publicBaseUrl);
          setAuthTimeout(sessionId);
        } else if (!sessionId && !authData) {
          // First request without session - will fail in initialization
        }
      }

      // MCP OAuth mode — either header auth (PAT/job token) or OAuth Bearer token.
      // Header auth takes precedence: if Private-Token or JOB-TOKEN is present the
      // OAuth middleware was bypassed and we store the raw token per-session.
      // Otherwise req.auth is populated by requireBearerAuth; store the OAuth token.
      if (GITLAB_MCP_OAUTH) {
        const headerAuthData = hasHeaderAuth(req) ? parseAuthHeaders(req) : null;

        if (headerAuthData) {
          if (headerAuthData && sessionId) {
            if (!authBySession[sessionId]) {
              authBySession[sessionId] = withPublicBaseUrl(headerAuthData, publicBaseUrl);
              bindSessionOwner(sessionId, req, res);
              logger.info(
                `Session ${redactSessionIdForLog(sessionId)}: stored ${headerAuthData.header} header (header auth)`
              );
              setAuthTimeout(sessionId);
            } else {
              const allowedProjectIds = bindSessionProjectScope(
                headerAuthData.allowedProjectIds,
                authBySession[sessionId].allowedProjectIds
              );
              if (allowedProjectIds === null) {
                metrics.authFailures++;
                res.status(401).json(SESSION_PROJECT_SCOPE_MISMATCH);
                return;
              }
              authBySession[sessionId] = withPublicBaseUrl(
                { ...headerAuthData, allowedProjectIds },
                publicBaseUrl,
                authBySession[sessionId]
              );
              setAuthTimeout(sessionId);
            }
          }
        } else {
          const authInfo = req.auth;
          if (authInfo?.token && sessionId) {
            if (!authBySession[sessionId]) {
              authBySession[sessionId] = {
                header: "Authorization",
                token: authInfo.token,
                lastUsed: Date.now(),
                apiUrl: GITLAB_API_URL,
                publicBaseUrl,
              };
              bindSessionOwner(sessionId, req, res);
              logger.info(
                `Session ${redactSessionIdForLog(sessionId)}: stored OAuth token (client: ${authInfo.clientId})`
              );
              setAuthTimeout(sessionId);
            } else {
              // Update token on every request — the client may have refreshed it
              authBySession[sessionId].token = authInfo.token;
              authBySession[sessionId].lastUsed = Date.now();
              updateSessionPublicBaseUrl(sessionId, publicBaseUrl);
              setAuthTimeout(sessionId);
            }
          }
        }
      }

      // Server-side token mode (no per-session auth): every POST to a live session is
      // activity, so reset its inactivity timer. Without this, clients that disconnect
      // without DELETE /mcp hold their slot until MAX_SESSIONS is exhausted.
      if (
        !REMOTE_AUTHORIZATION &&
        !GITLAB_MCP_OAUTH &&
        sessionId &&
        streamableTransports[sessionId]
      ) {
        setAuthTimeout(sessionId);
      }

      // Handle request with proper AsyncLocalStorage context
      const handleRequest = async () => {
        try {
          let transport: StreamableTransport;

          if (sessionId && streamableTransports[sessionId]) {
            // Reuse existing transport for ongoing session
            transport = streamableTransports[sessionId];

            await transport.handleRequest(req, res, req.body);
          } else {
            // Create new transport for new session
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => randomUUID(),
              onsessioninitialized: (newSessionId: string) => {
                streamableTransports[newSessionId] = transport;
                metrics.totalSessions++;
                metrics.activeSessions++;
                logger.warn(
                  `Streamable HTTP session initialized: ${redactSessionIdForLog(newSessionId)}`
                );

                // Server-side token mode: no per-session auth, but the session still
                // expires after SESSION_TIMEOUT_SECONDS without activity.
                if (!REMOTE_AUTHORIZATION && !GITLAB_MCP_OAUTH) {
                  setAuthTimeout(newSessionId);
                }

                // Store auth for newly created session in remote mode
                if (REMOTE_AUTHORIZATION && !authBySession[newSessionId]) {
                  const authData = parseAuthHeaders(req);
                  if (authData && newRemoteAuthOwner !== null) {
                    sessionOwners[newSessionId] = newRemoteAuthOwner;
                    authBySession[newSessionId] = withPublicBaseUrl(authData, publicBaseUrl);
                    logger.info(
                      `Session ${redactSessionIdForLog(newSessionId)}: stored ${authData.header} header`
                    );
                    setAuthTimeout(newSessionId);
                  } else if (unauthenticatedDiscoveryRequested) {
                    setAuthTimeout(newSessionId);
                  }
                }

                // Store OAuth token for newly created session in MCP OAuth mode.
                // If Private-Token or JOB-TOKEN headers are present, prefer them.
                if (GITLAB_MCP_OAUTH && !authBySession[newSessionId]) {
                  if (hasHeaderAuth(req)) {
                    const authData = parseAuthHeaders(req);
                    if (authData) {
                      authBySession[newSessionId] = withPublicBaseUrl(authData, publicBaseUrl);
                      bindSessionOwner(newSessionId, req, res);
                      logger.info(
                        `Session ${redactSessionIdForLog(newSessionId)}: stored ${authData.header} header (header auth)`
                      );
                      setAuthTimeout(newSessionId);
                    }
                  } else {
                    const authInfo = req.auth;
                    if (authInfo?.token) {
                      authBySession[newSessionId] = {
                        header: "Authorization",
                        token: authInfo.token,
                        lastUsed: Date.now(),
                        apiUrl: GITLAB_API_URL,
                        publicBaseUrl,
                      };
                      bindSessionOwner(newSessionId, req, res);
                      logger.info(
                        `Session ${redactSessionIdForLog(newSessionId)}: stored OAuth token (client: ${authInfo.clientId})`
                      );
                      setAuthTimeout(newSessionId);
                    }
                  }
                }
              },
            });

            // Set up cleanup handler when transport closes
            transport.onclose = () => {
              const sid = transport.sessionId;
              if (sid && streamableTransports[sid]) {
                logger.warn(
                  `Streamable HTTP transport closed for session ${redactSessionIdForLog(sid)}, cleaning up`
                );
                delete streamableTransports[sid];
                metrics.activeSessions--;
                openGetStreams.delete(sid);
                clearAuthTimeout(sid);
                if (REMOTE_AUTHORIZATION || GITLAB_MCP_OAUTH) {
                  cleanupSessionAuth(sid);
                  delete sessionRequestCounts[sid];
                  logger.info(`Session ${redactSessionIdForLog(sid)}: cleaned up auth mapping`);
                }
              }
            };

            // Create a new Server instance per session to prevent
            // cross-client data leakage (GHSA-345p-7cg4-v4c7)
            const serverInstance = createServer();
            await serverInstance.connect(transport);

            // Handle the request - context is already set up in the outer handleRequest wrapper
            await transport.handleRequest(req, res, req.body);
          }
        } catch (error) {
          logger.error({ err: error }, "Streamable HTTP error");
          res.status(500).json({
            error: "Internal server error",
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      };

      // Execute with auth context in remote mode (REMOTE_AUTHORIZATION or GITLAB_MCP_OAUTH)
      if ((REMOTE_AUTHORIZATION || GITLAB_MCP_OAUTH) && sessionId && authBySession[sessionId]) {
        const authData = authBySession[sessionId];
        const ctx: SessionAuth = {
          sessionId,
          header: authData.header,
          token: authData.token,
          lastUsed: authData.lastUsed,
          apiUrl: authData.apiUrl,
          publicBaseUrl: authData.publicBaseUrl,
          allowedProjectIds: authData.allowedProjectIds,
        };

        // Run the entire request handling within AsyncLocalStorage context
        await sessionAuthStore.run(ctx, handleRequest);
      } else {
        // Standard execution (no per-session auth or no session yet)
        await handleRequest();
      }
    }
  );

  // Streamable HTTP GET endpoint for listening to server-sent events (SSE)
  app.get(
    "/mcp",
    rejectUnknownStatefulSession,
    mcpRequestRateLimit,
    mcpBearerAuth,
    rejectForeignSession,
    async (req: Request, res: Response) => {
      const sessionId = readMcpSessionIdHeader(req);
      const acceptHeader = readAcceptHeader(req);

      if (!acceptHeader.includes("text/event-stream")) {
        res.setHeader("Allow", "GET, POST, DELETE");
        res.status(406).json({
          error: "Not Acceptable",
          message: "Client must accept text/event-stream for GET /mcp",
        });
        return;
      }

      if (!sessionId) {
        res.setHeader("Allow", "GET, POST, DELETE");
        res.status(400).json({
          error: "Bad Request",
          message: "Mcp-Session-Id header is required for GET /mcp",
        });
        return;
      }

      if (
        OAUTH_STATELESS_MODE &&
        STATELESS_MATERIAL &&
        (REMOTE_AUTHORIZATION || GITLAB_MCP_OAUTH)
      ) {
        res.setHeader("Allow", "POST");
        res.status(405).json({
          error: "Method Not Allowed",
          message:
            "GET /mcp SSE stream is not supported in stateless mode. Use POST to communicate with the MCP server.",
        });
        return;
      }

      const transport = streamableTransports[sessionId];
      if (!transport) {
        res.status(404).json({
          error: "Session not found",
        });
        return;
      }

      metrics.requestsProcessed++;

      const usesPerSessionAuth = REMOTE_AUTHORIZATION || GITLAB_MCP_OAUTH;
      if (usesPerSessionAuth && authBySession[sessionId]) {
        authBySession[sessionId].lastUsed = Date.now();
      }
      // Listening on GET /mcp is session activity. Pause inactivity expiry for
      // the life of the SSE stream so list_changed can still be pushed. A second GET
      // while a stream is open is rejected by the SDK and leaves the timer alone.
      const ownsStream = !openGetStreams.has(sessionId);
      if (ownsStream) {
        openGetStreams.add(sessionId);
        clearAuthTimeout(sessionId);
      }

      const handleGetRequest = async () => {
        try {
          await transport.handleRequest(req, res);
        } catch (error) {
          logger.error({ err: error }, "Streamable HTTP GET error");
          if (!res.headersSent) {
            res.status(500).json({
              error: "Internal server error",
              message: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      };

      try {
        if (usesPerSessionAuth && authBySession[sessionId]) {
          const authData = authBySession[sessionId];
          const ctx: SessionAuth = {
            sessionId,
            header: authData.header,
            token: authData.token,
            lastUsed: authData.lastUsed,
            apiUrl: authData.apiUrl,
            publicBaseUrl: authData.publicBaseUrl,
            allowedProjectIds: authData.allowedProjectIds,
          };
          await sessionAuthStore.run(ctx, handleGetRequest);
        } else {
          await handleGetRequest();
        }
      } finally {
        if (ownsStream) {
          openGetStreams.delete(sessionId);
          if (streamableTransports[sessionId]) {
            setAuthTimeout(sessionId);
          }
        }
      }
    }
  );

  const getMetricsSnapshot = () => ({
    ...metrics,
    activeSessions: Object.keys(streamableTransports).length,
    authenticatedSessions: Object.keys(authBySession).length,
    gitlabClientPool: clientPool.getStats(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    config: {
      maxSessions: MAX_SESSIONS,
      maxRequestsPerMinute: MAX_REQUESTS_PER_MINUTE,
      sessionTimeoutSeconds: SESSION_TIMEOUT_SECONDS,
      remoteAuthEnabled: REMOTE_AUTHORIZATION,
      mcpOAuthEnabled: GITLAB_MCP_OAUTH,
      statelessModeEnabled: OAUTH_STATELESS_MODE && STATELESS_MATERIAL !== null,
      statelessRotationKey: OAUTH_STATELESS_MODE && STATELESS_MATERIAL?.previous != null,
    },
  });

  // Metrics endpoint
  app.get("/metrics", (_req: Request, res: Response) => {
    res.type("text/plain; version=0.0.4").send(formatPrometheusMetrics(getMetricsSnapshot()));
  });

  app.get("/metrics.json", (_req: Request, res: Response) => {
    res.json(getMetricsSnapshot());
  });

  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    const activeSessions = Object.keys(streamableTransports).length;
    const isHealthy = activeSessions < MAX_SESSIONS;
    if (!isHealthy) {
      logger.warn(
        { activeSessions, maxSessions: MAX_SESSIONS },
        "Health check degraded: active session capacity reached"
      );
    }
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? "healthy" : "degraded",
      version: SERVER_VERSION,
      activeSessions,
      maxSessions: MAX_SESSIONS,
      uptime: process.uptime(),
    });
  });

  // to delete a mcp server session explicitly
  app.delete(
    "/mcp",
    rejectUnknownStatefulSession,
    mcpRequestRateLimit,
    mcpBearerAuth,
    rejectForeignSession,
    async (req: Request, res: Response) => {
      const sessionId = readMcpSessionIdHeader(req);

      if (!sessionId) {
        res.status(400).json({ error: "mcp-session-id header is required" });
        return;
      }

      const transport = streamableTransports[sessionId];

      if (transport) {
        try {
          await transport.close();
          logger.info(
            `Explicitly closed session via DELETE request: ${redactSessionIdForLog(sessionId)}`
          );
          if (REMOTE_AUTHORIZATION || GITLAB_MCP_OAUTH) {
            cleanupSessionAuth(sessionId);
            delete sessionRequestCounts[sessionId];
            logger.info(
              `Session ${redactSessionIdForLog(sessionId)}: cleaned up auth mapping on DELETE`
            );
          }
          res.status(204).send();
        } catch (error) {
          logger.error({ err: error }, `Error closing session ${redactSessionIdForLog(sessionId)}`);
          res.status(500).json({ error: "Failed to close session" });
        }
      } else {
        res.status(404).json({ error: "Session not found" });
      }
    }
  );

  // Reject unsupported methods on /mcp
  app.all("/mcp", (_req: Request, res: Response) => {
    res.setHeader("Allow", "GET, POST, DELETE");
    res.status(405).json({
      error: "Method Not Allowed",
      message: "Method Not Allowed. Use GET, POST, or DELETE to communicate with the MCP server.",
    });
  });

  app.use(createHttpErrorHandler(logger));

  // Start server
  const httpServer = app.listen(Number(PORT), HOST, () => {
    logger.info(`GitLab MCP Server running with Streamable HTTP transport`);
    logger.info(`${colorGreen}Endpoint: http://${HOST}:${PORT}/mcp${colorReset}`);
  });

  // Graceful shutdown handler
  const gracefulShutdown = async (signal: string) => {
    logger.info(`${signal} received, starting graceful shutdown...`);

    // Stop accepting new connections
    httpServer.close(() => {
      logger.info("HTTP server closed");
    });

    // Close all active sessions
    const sessionIds = Object.keys(streamableTransports);
    logger.info(`Closing ${sessionIds.length} active sessions...`);

    const closePromises = sessionIds.map(async sessionId => {
      try {
        const transport = streamableTransports[sessionId];
        if (transport) {
          await transport.close();
          if (REMOTE_AUTHORIZATION || GITLAB_MCP_OAUTH) {
            cleanupSessionAuth(sessionId);
            delete sessionRequestCounts[sessionId];
          }
        }
      } catch (error) {
        logger.error({ err: error }, `Error closing session ${redactSessionIdForLog(sessionId)}`);
      }
    });

    await Promise.allSettled(closePromises);

    // Clear all timeouts
    Object.keys(authTimeouts).forEach(sessionId => {
      clearAuthTimeout(sessionId);
    });

    clientPool.closeAll();
    logger.info("Graceful shutdown complete");
    process.exit(0);
  };

  // Register signal handlers
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}
