/**
 * Express, SSE, and Streamable HTTP stay off the stdio startup path.
 * The entry imports this module, but the packages load only when a remote
 * transport actually starts.
 */
type ExpressFactory = typeof import("express");

function isExpressFactory(value: unknown): value is ExpressFactory {
  return typeof value === "function" && "json" in value;
}

function loadExpressFactory(moduleNamespace: unknown): ExpressFactory {
  if (isExpressFactory(moduleNamespace)) {
    return moduleNamespace;
  }
  if (
    typeof moduleNamespace === "object" &&
    moduleNamespace !== null &&
    "default" in moduleNamespace &&
    isExpressFactory(moduleNamespace.default)
  ) {
    return moduleNamespace.default;
  }
  throw new Error("express did not export an application factory");
}

interface RemoteHttpStack {
  readonly express: ExpressFactory;
  readonly rateLimit: typeof import("express-rate-limit").default;
  readonly ipKeyGenerator: typeof import("express-rate-limit").ipKeyGenerator;
  readonly SSEServerTransport: typeof import("@modelcontextprotocol/sdk/server/sse.js").SSEServerTransport;
  readonly StreamableHTTPServerTransport: typeof import("@modelcontextprotocol/sdk/server/streamableHttp.js").StreamableHTTPServerTransport;
  readonly mcpAuthRouter: typeof import("@modelcontextprotocol/sdk/server/auth/router.js").mcpAuthRouter;
  readonly createOAuthMetadata: typeof import("@modelcontextprotocol/sdk/server/auth/router.js").createOAuthMetadata;
  readonly metadataHandler: typeof import("@modelcontextprotocol/sdk/server/auth/handlers/metadata.js").metadataHandler;
  readonly requireBearerAuth: typeof import("@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js").requireBearerAuth;
}

const remoteHttpStackCache: { current?: RemoteHttpStack } = {};

export async function loadRemoteHttpStack(): Promise<RemoteHttpStack> {
  if (remoteHttpStackCache.current) {
    return remoteHttpStackCache.current;
  }

  const [
    expressModule,
    rateLimitModule,
    sseModule,
    streamableModule,
    authRouterModule,
    metadataModule,
    bearerModule,
  ] = await Promise.all([
    import("express"),
    import("express-rate-limit"),
    import("@modelcontextprotocol/sdk/server/sse.js"),
    import("@modelcontextprotocol/sdk/server/streamableHttp.js"),
    import("@modelcontextprotocol/sdk/server/auth/router.js"),
    import("@modelcontextprotocol/sdk/server/auth/handlers/metadata.js"),
    import("@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js"),
  ]);

  remoteHttpStackCache.current = {
    express: loadExpressFactory(expressModule),
    rateLimit: rateLimitModule.default,
    ipKeyGenerator: rateLimitModule.ipKeyGenerator,
    SSEServerTransport: sseModule.SSEServerTransport,
    StreamableHTTPServerTransport: streamableModule.StreamableHTTPServerTransport,
    mcpAuthRouter: authRouterModule.mcpAuthRouter,
    createOAuthMetadata: authRouterModule.createOAuthMetadata,
    metadataHandler: metadataModule.metadataHandler,
    requireBearerAuth: bearerModule.requireBearerAuth,
  };
  return remoteHttpStackCache.current;
}
