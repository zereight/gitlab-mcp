/**
 * MCP OAuth Tests
 * Tests for the GITLAB_MCP_OAUTH=true server-side OAuth proxy mode.
 *
 * The suite uses a mock GitLab server that implements the minimal OAuth
 * endpoints (token/info, DCR register, well-known metadata) so no live
 * GitLab instance is required.
 */

import { describe, test, after, before } from "node:test";
import assert from "node:assert";
import {
  launchServer,
  findAvailablePort,
  cleanupServers,
  ServerInstance,
  TransportMode,
  HOST,
} from "./utils/server-launcher.js";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOCK_OAUTH_TOKEN = "ya29.mock-oauth-token-abcdef123456";
const MOCK_CLIENT_ID = "mock-app-uid-from-dcr";

const MOCK_GITLAB_PORT_BASE = 9200;
const MCP_SERVER_PORT_BASE = 3200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Add minimal OAuth endpoints to a MockGitLabServer.
 *
 * GitLab serves these at the instance root (not under /api/v4), so we use
 * addRootHandler rather than addMockHandler.
 *
 * Endpoints added:
 *   GET  /oauth/token/info  — token introspection (Bearer header required)
 *   POST /oauth/register    — Dynamic Client Registration stub
 *   GET  /.well-known/oauth-authorization-server — AS metadata
 */
function addOAuthEndpoints(
  mockGitLab: MockGitLabServer,
  validToken: string,
  clientId: string,
  baseUrl: string
): void {
  // Token introspection — called by verifyAccessToken()
  mockGitLab.addRootHandler("get", "/oauth/token/info", (req, res) => {
    const auth = req.headers["authorization"] as string | undefined;
    const token = auth?.replace(/^Bearer\s+/i, "");

    if (token !== validToken) {
      res.status(401).json({ error: "invalid_token" });
      return;
    }

    res.json({
      resource_owner_id: 42,
      scopes: ["api"],
      expires_in_seconds: 7200,
      application: { uid: clientId },
      created_at: Math.floor(Date.now() / 1000),
    });
  });

  // Dynamic Client Registration — proxied by mcpAuthRouter
  mockGitLab.addRootHandler("post", "/oauth/register", (req, res) => {
    res.status(201).json({
      client_id: clientId,
      client_name: req.body?.client_name ?? "test",
      redirect_uris: req.body?.redirect_uris ?? [],
      token_endpoint_auth_method: "none",
      require_pkce: true,
    });
  });

  // OAuth Authorization Server well-known metadata
  mockGitLab.addRootHandler("get", "/.well-known/oauth-authorization-server", (_req, res) => {
    res.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      registration_endpoint: `${baseUrl}/oauth/register`,
      revocation_endpoint: `${baseUrl}/oauth/revoke`,
      scopes_supported: ["api", "read_api", "read_user"],
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
    });
  });
}

// ---------------------------------------------------------------------------
// Test suite: Discovery endpoints
// ---------------------------------------------------------------------------

describe("MCP OAuth — Discovery Endpoints", () => {
  let mcpUrl: string;
  let mcpBaseUrl: string;
  let mockGitLab: MockGitLabServer;
  let servers: ServerInstance[] = [];

  before(async () => {
    const mockPort = await findMockServerPort(MOCK_GITLAB_PORT_BASE);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_OAUTH_TOKEN],
    });
    await mockGitLab.start();
    const mockGitLabUrl = mockGitLab.getUrl();

    addOAuthEndpoints(mockGitLab, MOCK_OAUTH_TOKEN, MOCK_CLIENT_ID, mockGitLabUrl);

    const mcpPort = await findAvailablePort(MCP_SERVER_PORT_BASE);
    mcpBaseUrl = `http://${HOST}:${mcpPort}`;
    mcpUrl = `${mcpBaseUrl}/mcp`;

    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 5000,
      env: {
        STREAMABLE_HTTP: "true",
        GITLAB_MCP_OAUTH: "true",
        GITLAB_OAUTH_APP_ID: "test-oauth-app-id",
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        MCP_SERVER_URL: mcpBaseUrl,
        MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL: "true",
      },
    });
    servers.push(server);

    console.log(`Mock GitLab: ${mockGitLabUrl}`);
    console.log(`MCP Server:  ${mcpBaseUrl}`);
  });

  after(async () => {
    cleanupServers(servers);
    if (mockGitLab) {
      await mockGitLab.stop();
    }
  });

  test("GET /.well-known/oauth-authorization-server returns AS metadata", async () => {
    const res = await fetch(`${mcpBaseUrl}/.well-known/oauth-authorization-server`);
    assert.strictEqual(res.status, 200, "Should return 200");

    const body = (await res.json()) as Record<string, unknown>;
    assert.ok(body.issuer, "Should have issuer");
    assert.ok(body.authorization_endpoint, "Should have authorization_endpoint");
    assert.ok(body.token_endpoint, "Should have token_endpoint");
    assert.ok(body.registration_endpoint, "Should have registration_endpoint");
    console.log("  ✓ AS metadata returned with all required fields");
  });

  test("GET /.well-known/oauth-protected-resource returns resource metadata", async () => {
    // The SDK mounts the protected resource metadata at
    // /.well-known/oauth-protected-resource{pathname} where pathname is derived
    // from resourceServerUrl (or issuerUrl). With issuerUrl = "http://host:port/"
    // the pathname "/" is stripped, yielding the bare endpoint.
    const res = await fetch(`${mcpBaseUrl}/.well-known/oauth-protected-resource`);
    assert.strictEqual(res.status, 200, "Should return 200");

    const body = (await res.json()) as Record<string, unknown>;
    assert.ok(body.resource, "Should have resource field");
    console.log("  ✓ Protected resource metadata returned");
  });
});

// ---------------------------------------------------------------------------
// Test suite: /mcp auth enforcement
// ---------------------------------------------------------------------------

describe("MCP OAuth — /mcp Auth Enforcement", () => {
  let mcpUrl: string;
  let mcpBaseUrl: string;
  let mockGitLab: MockGitLabServer;
  let servers: ServerInstance[] = [];

  before(async () => {
    const mockPort = await findMockServerPort(MOCK_GITLAB_PORT_BASE + 50);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_OAUTH_TOKEN],
    });
    await mockGitLab.start();
    const mockGitLabUrl = mockGitLab.getUrl();

    addOAuthEndpoints(mockGitLab, MOCK_OAUTH_TOKEN, MOCK_CLIENT_ID, mockGitLabUrl);

    const mcpPort = await findAvailablePort(MCP_SERVER_PORT_BASE + 50);
    mcpBaseUrl = `http://${HOST}:${mcpPort}`;
    mcpUrl = `${mcpBaseUrl}/mcp`;

    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: mcpPort,
      timeout: 5000,
      env: {
        STREAMABLE_HTTP: "true",
        GITLAB_MCP_OAUTH: "true",
        GITLAB_OAUTH_APP_ID: "test-oauth-app-id",
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        MCP_SERVER_URL: mcpBaseUrl,
        MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL: "true",
      },
    });
    servers.push(server);
  });

  after(async () => {
    cleanupServers(servers);
    if (mockGitLab) {
      await mockGitLab.stop();
    }
  });

  test("POST /mcp without Authorization header returns 401 with WWW-Authenticate", async () => {
    const res = await fetch(mcpUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });

    assert.strictEqual(res.status, 401, "Should return 401 Unauthorized");

    const wwwAuth = res.headers.get("www-authenticate");
    assert.ok(wwwAuth, "Should have WWW-Authenticate header");
    assert.ok(
      wwwAuth.toLowerCase().startsWith("bearer"),
      "WWW-Authenticate should use Bearer scheme"
    );
    console.log("  ✓ 401 returned with WWW-Authenticate header (no auth)");
    console.log(`  ℹ️  WWW-Authenticate: ${wwwAuth}`);
  });

  test("POST /mcp with invalid token returns 401", async () => {
    const res = await fetch(mcpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid-token-xyz",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });

    assert.strictEqual(res.status, 401, "Should return 401 for invalid token");
    console.log("  ✓ 401 returned for invalid OAuth token");
  });

  test("POST /mcp with valid Bearer token returns non-401", async () => {
    const res = await fetch(mcpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MOCK_OAUTH_TOKEN}`,
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      }),
    });

    assert.notStrictEqual(res.status, 401, "Should not return 401 with valid token");
    assert.notStrictEqual(res.status, 403, "Should not return 403 with valid token");
    console.log(`  ✓ Valid token accepted (status: ${res.status})`);
  });
});

// ---------------------------------------------------------------------------
// Test suite: BoundedClientCache unit tests
// ---------------------------------------------------------------------------

describe("MCP OAuth — BoundedClientCache", () => {
  // Access the internal class via a minimal provider (it's not exported directly)
  // by driving it through the public clientsStore API.

  function makeClient(id: string, redirectUri = "https://example.com/cb"): Record<string, unknown> {
    return {
      client_id: id,
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none",
    };
  }

  async function buildCachingProvider() {
    // Spin up a DCR stub that returns a stable client_id from the request body.
    // The stub reads client_id from the incoming body (set by the SDK's register
    // handler before calling registerClient), so cache keys are predictable.
    const { createServer } = await import("node:http");
    const stub = createServer((req, res) => {
      let body = "";
      req.on("data", chunk => (body += chunk));
      req.on("end", () => {
        const parsed = JSON.parse(body || "{}");
        res.writeHead(201, { "Content-Type": "application/json" });
        // Echo client_id back so tests can look it up by a known key
        res.end(
          JSON.stringify({
            client_id: parsed.client_id ?? "unknown",
            client_name: parsed.client_name ?? "unnamed",
            redirect_uris: parsed.redirect_uris ?? [],
            token_endpoint_auth_method: "none",
          })
        );
      });
    });
    await new Promise<void>(resolve => stub.listen(0, "127.0.0.1", resolve));
    const addr = stub.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    const { createGitLabOAuthProvider } = await import("../oauth-proxy.js");
    const provider = createGitLabOAuthProvider(baseUrl, "test-app-id");

    return { provider, stub };
  }

  test("LRU: both clients remain cached after sequential registration", async () => {
    const { provider, stub } = await buildCachingProvider();

    try {
      const store = provider.clientsStore;

      // Register two clients — the provider generates a random UUID as client_id,
      // so we capture the returned client_id to look up the cache.
      const regA = await store.registerClient!({
        client_name: "Claude",
        redirect_uris: ["https://a.com/cb"],
        token_endpoint_auth_method: "none",
      });
      const regB = await store.registerClient!({
        client_name: "Cursor",
        redirect_uris: ["https://b.com/cb"],
        token_endpoint_auth_method: "none",
      });

      const a = await store.getClient(regA.client_id);
      const b = await store.getClient(regB.client_id);

      assert.deepStrictEqual(a!.redirect_uris, ["https://a.com/cb"], "client-A still cached");
      assert.deepStrictEqual(b!.redirect_uris, ["https://b.com/cb"], "client-B still cached");
      console.log("  ✓ Both clients remain cached after sequential registration");
    } finally {
      stub.close();
    }
  });

  test("cache: re-registration returns a new entry with its own client_id", async () => {
    const { provider, stub } = await buildCachingProvider();

    try {
      const store = provider.clientsStore;

      const first = await store.registerClient!({
        client_name: "Claude",
        redirect_uris: ["https://old.com/cb"],
        token_endpoint_auth_method: "none",
      });
      const firstLookup = await store.getClient(first.client_id);
      assert.deepStrictEqual(firstLookup!.redirect_uris, ["https://old.com/cb"]);

      const second = await store.registerClient!({
        client_name: "Claude",
        redirect_uris: ["https://new.com/cb"],
        token_endpoint_auth_method: "none",
      });
      const secondLookup = await store.getClient(second.client_id);
      assert.deepStrictEqual(
        secondLookup!.redirect_uris,
        ["https://new.com/cb"],
        "New registration cached under its own client_id"
      );

      // Both entries remain accessible
      const firstStill = await store.getClient(first.client_id);
      assert.deepStrictEqual(firstStill!.redirect_uris, ["https://old.com/cb"], "First entry still cached");
      console.log("  ✓ Re-registration creates a new cached entry");
    } finally {
      stub.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Test suite: createGitLabOAuthProvider unit tests
// ---------------------------------------------------------------------------

describe("MCP OAuth — createGitLabOAuthProvider", () => {
  test("verifyAccessToken throws on non-OK response", async () => {
    // Spin up a tiny local server that always returns 401
    const { createServer } = await import("node:http");
    const stub = createServer((req, res) => {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "invalid_token" }));
    });

    await new Promise<void>(resolve => stub.listen(0, "127.0.0.1", resolve));
    const addr = stub.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    try {
      const { createGitLabOAuthProvider } = await import("../oauth-proxy.js");
      const provider = createGitLabOAuthProvider(baseUrl, "test-app-id");

      await assert.rejects(
        () => provider.verifyAccessToken("bad-token"),
        /invalid or expired/i,
        "Should throw InvalidTokenError for non-OK response"
      );
      console.log("  ✓ verifyAccessToken throws for 401 from GitLab");
    } finally {
      stub.close();
    }
  });

  test("verifyAccessToken maps GitLab token info to AuthInfo", async () => {
    const createdAt = Math.floor(Date.now() / 1000);
    const { createServer } = await import("node:http");
    const stub = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          resource_owner_id: 7,
          scopes: ["api", "read_user"],
          expires_in_seconds: 3600,
          application: { uid: "app-uid-abc" },
          created_at: createdAt,
        })
      );
    });

    await new Promise<void>(resolve => stub.listen(0, "127.0.0.1", resolve));
    const addr = stub.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    try {
      const { createGitLabOAuthProvider } = await import("../oauth-proxy.js");
      const provider = createGitLabOAuthProvider(baseUrl, "test-app-id");
      const authInfo = await provider.verifyAccessToken("good-token");

      assert.strictEqual(authInfo.token, "good-token", "token must be preserved");
      assert.strictEqual(authInfo.clientId, "app-uid-abc", "clientId from application.uid");
      assert.deepStrictEqual(authInfo.scopes, ["api", "read_user"], "scopes forwarded");
      assert.ok(typeof authInfo.expiresAt === "number", "expiresAt must be a number");
      assert.ok(
        authInfo.expiresAt! > Math.floor(Date.now() / 1000),
        "expiresAt must be in the future"
      );
      console.log("  ✓ verifyAccessToken returns correct AuthInfo");
    } finally {
      stub.close();
    }
  });

  test("verifyAccessToken uses 'dynamic' clientId when application is null", async () => {
    const { createServer } = await import("node:http");
    const stub = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          resource_owner_id: 1,
          scopes: ["read_api"],
          expires_in_seconds: null,
          application: null,
          created_at: Math.floor(Date.now() / 1000),
        })
      );
    });

    await new Promise<void>(resolve => stub.listen(0, "127.0.0.1", resolve));
    const addr = stub.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    try {
      const { createGitLabOAuthProvider } = await import("../oauth-proxy.js");
      const provider = createGitLabOAuthProvider(baseUrl, "test-app-id");
      const authInfo = await provider.verifyAccessToken("tok");

      assert.strictEqual(authInfo.clientId, "dynamic", "clientId should fall back to 'dynamic'");
      assert.strictEqual(authInfo.expiresAt, undefined, "expiresAt should be undefined when null");
      console.log("  ✓ null application and null expires_in_seconds handled correctly");
    } finally {
      stub.close();
    }
  });

  test("getClient returns stub for unknown clientId", async () => {
    const { createGitLabOAuthProvider } = await import("../oauth-proxy.js");
    const provider = createGitLabOAuthProvider("https://gitlab.example.com", "test-app-id");

    const client = await provider.clientsStore.getClient("unknown-client-id");

    assert.ok(client, "Should return a client object");
    assert.strictEqual(client!.client_id, "unknown-client-id", "client_id should match input");
    assert.deepStrictEqual(
      client!.redirect_uris,
      [],
      "redirect_uris should be empty for unknown client"
    );
    assert.strictEqual(client!.token_endpoint_auth_method, "none", "Should be a public client");
    console.log("  ✓ getClient returns stub for unknown clientId");
  });

  test("clientsStore caches DCR response so getClient returns real redirect_uris", async () => {
    const REGISTERED_REDIRECT_URI = "https://claude.ai/api/mcp/auth_callback";

    const { createGitLabOAuthProvider } = await import("../oauth-proxy.js");
    const provider = createGitLabOAuthProvider("https://gitlab.example.com", "test-app-id", "My MCP Server");

    // Before registration: getClient returns a stub with empty redirect_uris
    const beforeReg = await provider.clientsStore.getClient("some-unknown-id");
    assert.deepStrictEqual(beforeReg!.redirect_uris, [], "Should be empty before registration");

    // Simulate DCR registration (as the SDK would call it).
    // The provider generates a virtual client_id (UUID) — it does NOT proxy to upstream.
    const registered = await provider.clientsStore.registerClient!({
      client_name: "Claude",
      redirect_uris: [REGISTERED_REDIRECT_URI],
      token_endpoint_auth_method: "none",
    });

    // client_id should be a UUID generated by the provider
    assert.ok(registered.client_id, "client_id should be set");
    assert.match(
      registered.client_id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      "client_id should be a UUID"
    );
    assert.deepStrictEqual(
      registered.redirect_uris,
      [REGISTERED_REDIRECT_URI],
      "redirect_uris preserved from input"
    );

    // client_name should be annotated with the resource name
    assert.ok(
      registered.client_name?.includes("Claude via My MCP Server"),
      `client_name should include 'Claude via My MCP Server', got: ${registered.client_name}`
    );

    // After registration: getClient with the returned client_id should return the cached entry
    const afterReg = await provider.clientsStore.getClient(registered.client_id);
    assert.deepStrictEqual(
      afterReg!.redirect_uris,
      [REGISTERED_REDIRECT_URI],
      "getClient should return real redirect_uris from cache after registration"
    );
    console.log(
      "  ✓ DCR response cached: getClient returns real redirect_uris after registration"
    );
    console.log(`  ✓ client_name annotated: ${registered.client_name}`);
  });
});
