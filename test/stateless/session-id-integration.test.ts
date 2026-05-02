/**
 * Integration test for stateless Mcp-Session-Id.
 *
 * Launches two MCP server processes sharing OAUTH_STATELESS_SECRET and a
 * single mock GitLab backend. Demonstrates the exact HPA scenario that
 * breaks without stateless mode: init on pod A, subsequent request on pod B.
 *
 * Uses REMOTE_AUTHORIZATION mode with a Private-Token because it exercises
 * the session-id code path with minimal OAuth machinery.
 */

import assert from "node:assert";
import { randomBytes } from "node:crypto";
import { request as httpRequest } from "node:http";
import { after, before, describe, test } from "node:test";

import {
  loadKeyMaterialFromEnv,
  mintSessionId,
  openSessionId,
} from "../../stateless/index.js";
import type { StatelessKeyMaterial } from "../../stateless/index.js";
import { MockGitLabServer, findMockServerPort } from "../utils/mock-gitlab-server.js";
import {
  cleanupServers,
  findAvailablePort,
  HOST,
  launchServer,
  ServerInstance,
  TransportMode,
} from "../utils/server-launcher.js";

const MOCK_TOKEN = "glpat-mockstateless-12345-abcdef";

// Use unusual port ranges to avoid colliding with other suites.
const MOCK_PORT_BASE = 9800;
const SERVER_PORT_BASE_A = 3800;
const SERVER_PORT_BASE_B = 3850;
const SERVER_PORT_BASE_TTL = 3900;

describe("Stateless Mcp-Session-Id — cross-pod integration", () => {
  let servers: ServerInstance[] = [];
  let mockGitLab: MockGitLabServer;
  let urlA: string;
  let urlB: string;
  const sharedSecret = randomBytes(32).toString("base64url");

  before(async () => {
    const mockPort = await findMockServerPort(MOCK_PORT_BASE);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });
    await mockGitLab.start();
    const mockUrl = mockGitLab.getUrl();

    const portA = await findAvailablePort(SERVER_PORT_BASE_A);
    const portB = await findAvailablePort(SERVER_PORT_BASE_B);

    const commonEnv = {
      STREAMABLE_HTTP: "true",
      REMOTE_AUTHORIZATION: "true",
      GITLAB_API_URL: `${mockUrl}/api/v4`,
      GITLAB_READ_ONLY_MODE: "true",
      OAUTH_STATELESS_MODE: "true",
      OAUTH_STATELESS_SECRET: sharedSecret,
    };

    const sA = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: portA,
      timeout: 5000,
      env: { ...commonEnv },
    });
    servers.push(sA);
    urlA = `http://${HOST}:${portA}/mcp`;

    const sB = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: portB,
      timeout: 5000,
      env: { ...commonEnv },
    });
    servers.push(sB);
    urlB = `http://${HOST}:${portB}/mcp`;

    console.log(`Stateless pod A: ${urlA}`);
    console.log(`Stateless pod B: ${urlB}`);
  });

  after(async () => {
    cleanupServers(servers);
    if (mockGitLab) {
      await mockGitLab.stop();
    }
  });

  // ---------------------------------------------------------------------
  // Direct HTTP helpers — we deliberately avoid the SDK client because we
  // need to assert precise behaviour of Mcp-Session-Id across calls to two
  // different origins.
  // ---------------------------------------------------------------------

  interface PostResult {
    status: number;
    sid: string | null;
    bodyText: string;
  }

  async function post(
    url: string,
    body: unknown,
    headers: Record<string, string> = {}
  ): Promise<PostResult> {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...headers,
      },
      body: JSON.stringify(body),
    });
    const sid = res.headers.get("mcp-session-id");
    const bodyText = await res.text();
    return { status: res.status, sid, bodyText };
  }

  function initRequest() {
    return {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "stateless-integration-test", version: "1.0.0" },
      },
    };
  }

  function listToolsRequest(id: number) {
    return { jsonrpc: "2.0", id, method: "tools/list", params: {} };
  }

  // ---------------------------------------------------------------------
  // Tests
  // ---------------------------------------------------------------------

  test("init on pod A returns a stateless Mcp-Session-Id", async () => {
    const result = await post(urlA, initRequest(), {
      "private-token": MOCK_TOKEN,
    });
    assert.equal(result.status, 200);
    assert.ok(result.sid, "init response must include Mcp-Session-Id");
    assert.ok(
      result.sid!.startsWith("v1.sid."),
      `sid should be a stateless sealed value, got: ${result.sid!.slice(0, 20)}…`
    );
  });

  test("subsequent request on pod B (different pod) succeeds with A's sid", async () => {
    // Init on A (with token)
    const initRes = await post(urlA, initRequest(), {
      "private-token": MOCK_TOKEN,
    });
    assert.equal(initRes.status, 200);
    const sidFromA = initRes.sid!;
    assert.ok(sidFromA);

    // List tools on B using sid from A, WITHOUT re-supplying the token.
    // This is the critical test: pod B has never seen this session before
    // and does not share any in-memory state with pod A.
    const listRes = await post(urlB, listToolsRequest(2), {
      "mcp-session-id": sidFromA,
    });
    assert.equal(
      listRes.status,
      200,
      `pod B should accept pod A's sealed sid, got status ${listRes.status}: ${listRes.bodyText.slice(0, 200)}`
    );
    // The response body should contain a tools list, not an error.
    assert.match(
      listRes.bodyText,
      /tools/,
      "response body should include the tools/list result"
    );
  });

  test("pod B rejects a tampered sid with 404 (session ended)", async () => {
    const initRes = await post(urlA, initRequest(), {
      "private-token": MOCK_TOKEN,
    });
    const sid = initRes.sid!;
    // Flip a byte in the middle of the blob
    const parts = sid.split(".");
    const blob = Buffer.from(parts[2], "base64url");
    blob[Math.floor(blob.length / 2)] ^= 0xff;
    parts[2] = blob.toString("base64url");
    const tampered = parts.join(".");

    const listRes = await post(urlB, listToolsRequest(3), {
      "mcp-session-id": tampered,
    });
    // 404 (not 401) per MCP Streamable HTTP: a tampered / unknown sid looks
    // identical to a terminated session from the client's perspective; 404
    // tells it to re-initialize, whereas 401 would trip the auth-failure
    // path and break automatic recovery.
    assert.equal(listRes.status, 404);
  });

  test("request without sid or auth header is 401", async () => {
    // A non-init request with no auth at all — stateless mode has no way to
    // derive the caller's identity.
    const listRes = await post(urlA, listToolsRequest(4));
    assert.equal(listRes.status, 401);
  });

  test("fresh Authorization header on subsequent request rotates the sid", async () => {
    const initRes = await post(urlA, initRequest(), {
      "private-token": MOCK_TOKEN,
    });
    const sidFromA = initRes.sid!;

    // Supply BOTH the old sid and a fresh Private-Token header. Our handler
    // prefers the fresh header and mints a new sid. The handler now also
    // emits the freshly minted sid on non-init responses (so clients can
    // adopt it) — assert it changed.
    const listRes = await post(urlB, listToolsRequest(5), {
      "mcp-session-id": sidFromA,
      "private-token": MOCK_TOKEN,
    });
    assert.equal(listRes.status, 200);
    assert.ok(listRes.sid, "non-init response should now carry a rotated sid");
    assert.notEqual(
      listRes.sid,
      sidFromA,
      "fresh auth must rotate the sid on every request"
    );
  });

  test("sid-only request also rotates the sid (inactivity-TTL semantics)", async () => {
    const initRes = await post(urlA, initRequest(), {
      "private-token": MOCK_TOKEN,
    });
    const sid0 = initRes.sid!;

    // Sid-only: no live auth headers. Prior to the fix the server would
    // reuse sid0 verbatim, freezing the embedded iat. After the fix the
    // server mints a fresh sid with an advanced iat on every request.
    const listRes = await post(urlB, listToolsRequest(6), {
      "mcp-session-id": sid0,
    });
    assert.equal(listRes.status, 200);
    assert.ok(listRes.sid, "sid-only response must carry a rotated sid");
    assert.notEqual(
      listRes.sid,
      sid0,
      "iat must advance → sid value must differ"
    );
  });
});

// =============================================================================
// TTL / inactivity semantics
// =============================================================================
//
// These tests exercise the rotation + TTL behaviour that makes
// OAUTH_STATELESS_SESSION_TTL_SECONDS an inactivity timeout rather than an
// absolute-age cap. They run a single dedicated server with a deliberately
// small TTL (3 s) so the whole suite completes in a few seconds of wall-clock
// time — no fake-clock plumbing required.

describe("Stateless Mcp-Session-Id — inactivity-TTL semantics", () => {
  const servers: ServerInstance[] = [];
  let mockGitLab: MockGitLabServer;
  let url: string;
  let material: StatelessKeyMaterial;
  const sharedSecret = randomBytes(32).toString("base64url");
  const TTL_SECONDS = 3;

  before(async () => {
    const mockPort = await findMockServerPort(MOCK_PORT_BASE + 100);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });
    await mockGitLab.start();
    const mockUrl = mockGitLab.getUrl();

    const port = await findAvailablePort(SERVER_PORT_BASE_TTL);

    const s = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port,
      timeout: 5000,
      env: {
        STREAMABLE_HTTP: "true",
        REMOTE_AUTHORIZATION: "true",
        GITLAB_API_URL: `${mockUrl}/api/v4`,
        GITLAB_READ_ONLY_MODE: "true",
        OAUTH_STATELESS_MODE: "true",
        OAUTH_STATELESS_SECRET: sharedSecret,
        OAUTH_STATELESS_SESSION_TTL_SECONDS: String(TTL_SECONDS),
      },
    });
    servers.push(s);
    url = `http://${HOST}:${port}/mcp`;

    // Load key material locally so the test can decode sid payloads
    // (specifically to read back iat and verify it advances).
    material = loadKeyMaterialFromEnv(true, {
      OAUTH_STATELESS_SECRET: sharedSecret,
    } as NodeJS.ProcessEnv)!;
    assert.ok(material, "test failed to load stateless key material");
  });

  after(async () => {
    cleanupServers(servers);
    if (mockGitLab) {
      await mockGitLab.stop();
    }
  });

  async function post(
    body: unknown,
    headers: Record<string, string> = {}
  ): Promise<{ status: number; sid: string | null; bodyText: string }> {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...headers,
      },
      body: JSON.stringify(body),
    });
    const sid = res.headers.get("mcp-session-id");
    const bodyText = await res.text();
    return { status: res.status, sid, bodyText };
  }

  function initRequest() {
    return {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "ttl-test", version: "1.0.0" },
      },
    };
  }

  function listToolsRequest(id: number) {
    return { jsonrpc: "2.0", id, method: "tools/list", params: {} };
  }

  // ---------------------------------------------------------------------
  // (a) iat advances on sid-only authenticated requests
  // ---------------------------------------------------------------------
  test("iat advances on sid-only authenticated requests", async () => {
    const initRes = await post(initRequest(), { "private-token": MOCK_TOKEN });
    assert.equal(initRes.status, 200);
    const sid1 = initRes.sid!;
    const opened1 = openSessionId(material, sid1, 3600);
    assert.ok(opened1, "init sid must decode");
    const iat1 = opened1!.iat;

    // Wait long enough that a 1s-granularity iat can plausibly change, but
    // well under the TTL so the session itself is still valid.
    await new Promise((r) => setTimeout(r, 1500));

    const sidOnlyRes = await post(listToolsRequest(2), {
      "mcp-session-id": sid1,
    });
    assert.equal(sidOnlyRes.status, 200);
    assert.ok(
      sidOnlyRes.sid,
      "sid-only request should emit a rotated Mcp-Session-Id header"
    );
    assert.notEqual(
      sidOnlyRes.sid,
      sid1,
      "handler must mint a fresh sid on sid-only requests"
    );
    const opened2 = openSessionId(material, sidOnlyRes.sid!, 3600);
    assert.ok(opened2, "rotated sid must decode");
    assert.ok(
      opened2!.iat > iat1,
      `iat must advance: initial=${iat1}, rotated=${opened2!.iat}`
    );
  });

  // ---------------------------------------------------------------------
  // (b) continuously-used session survives past TTL
  // ---------------------------------------------------------------------
  test("continuously-used session survives past TTL", async () => {
    const initRes = await post(initRequest(), { "private-token": MOCK_TOKEN });
    assert.equal(initRes.status, 200);
    let sid = initRes.sid!;
    const startTs = Date.now();

    // Run sid-only requests with spacing < TTL, for a total window > TTL.
    // Step = TTL/2 (seconds). Iterations ≥ 2*TTL + 1 → total elapsed > TTL.
    const stepMs = Math.floor((TTL_SECONDS * 1000) / 2);
    const iterations = TTL_SECONDS * 2 + 1;
    for (let i = 0; i < iterations; i++) {
      await new Promise((r) => setTimeout(r, stepMs));
      const res = await post(listToolsRequest(100 + i), {
        "mcp-session-id": sid,
      });
      assert.equal(
        res.status,
        200,
        `iteration ${i}: continuously-used session must stay alive past TTL`
      );
      assert.ok(res.sid, `iteration ${i}: must emit rotated sid`);
      sid = res.sid!;
    }

    const totalElapsedSec = (Date.now() - startTs) / 1000;
    assert.ok(
      totalElapsedSec > TTL_SECONDS,
      `test must span more than TTL (${TTL_SECONDS}s), actual=${totalElapsedSec}s`
    );

    // Final sid must still validate.
    const finalOpened = openSessionId(material, sid, TTL_SECONDS);
    assert.ok(
      finalOpened,
      "final sid must still validate despite total elapsed > TTL"
    );
  });

  // ---------------------------------------------------------------------
  // (c) statelessSidRotated counter does not bump on sid-only mints
  // ---------------------------------------------------------------------
  //
  // We cannot introspect the child-process counter directly, so we instead
  // verify the contract by observing that the *response sid* changes on
  // sid-only requests (as in test (a)) — which means minting occurs — while
  // the counter-bump gate (`freshAuthPresent`) was false. If the counter
  // had bumped, freshAuthPresent would have been true, which means live
  // headers were honoured — but sid-only requests carry no live headers,
  // so the counter path is unreachable for them by construction of the
  // handler. This test documents that invariant at the HTTP surface.
  test("sid-only request mints without marking freshAuthPresent (statelessSidRotated gate)", async () => {
    const initRes = await post(initRequest(), { "private-token": MOCK_TOKEN });
    assert.equal(initRes.status, 200);
    const sid1 = initRes.sid!;

    const sidOnlyRes = await post(listToolsRequest(3), {
      "mcp-session-id": sid1,
    });
    assert.equal(sidOnlyRes.status, 200);
    assert.ok(sidOnlyRes.sid);
    // Mint happened (different sid) but no live auth header was present.
    assert.notEqual(sidOnlyRes.sid, sid1);

    // Sanity: a request with a live header also rotates the sid — that path
    // *is* the path that bumps the counter in-process. Asserting both paths
    // rotate confirms our change is uniform.
    const freshRes = await post(listToolsRequest(4), {
      "mcp-session-id": sid1,
      "private-token": MOCK_TOKEN,
    });
    assert.equal(freshRes.status, 200);
    assert.ok(freshRes.sid);
    assert.notEqual(freshRes.sid, sid1);
  });

  // ---------------------------------------------------------------------
  // (d) still returns terminated-session response after inactivity > TTL
  // ---------------------------------------------------------------------
  test("returns 404 (session ended) after inactivity greater than TTL", async () => {
    const initRes = await post(initRequest(), { "private-token": MOCK_TOKEN });
    assert.equal(initRes.status, 200);
    const sid1 = initRes.sid!;

    // Sleep just past TTL with no traffic at all.
    await new Promise((r) => setTimeout(r, (TTL_SECONDS + 1) * 1000));

    const res = await post(listToolsRequest(5), { "mcp-session-id": sid1 });
    // Per MCP Streamable HTTP: 404 on a session-bound request means
    // "session ended, re-initialize". The client should start a fresh
    // handshake, not retry auth. This is the critical contract for
    // automatic recovery after inactivity TTL expiry in stateless mode.
    assert.equal(
      res.status,
      404,
      `expired sid must 404 (session ended), got ${res.status}: ${res.bodyText.slice(0, 200)}`
    );
  });

  // ---------------------------------------------------------------------
  // (e) request without any sid or auth still returns 401 (genuine auth)
  // ---------------------------------------------------------------------
  test("no sid and no auth headers is 401 (not 404)", async () => {
    // Guard: 404 must only be returned when the client presented a sid we
    // failed to open. With nothing at all, the client is unauthenticated
    // and 401 is the correct signal.
    const res = await post(listToolsRequest(6));
    assert.equal(res.status, 401);
  });

  // ---------------------------------------------------------------------
  // (f) expired sid + live auth headers → client auto-recovers
  // ---------------------------------------------------------------------
  test("expired sid with live auth headers still succeeds (auto-recovery)", async () => {
    const initRes = await post(initRequest(), { "private-token": MOCK_TOKEN });
    assert.equal(initRes.status, 200);
    const staleSid = initRes.sid!;

    await new Promise((r) => setTimeout(r, (TTL_SECONDS + 1) * 1000));

    // Client presents the stale sid AND fresh auth. Live headers take
    // priority, so the request succeeds and a fresh sid is minted.
    const res = await post(listToolsRequest(7), {
      "mcp-session-id": staleSid,
      "private-token": MOCK_TOKEN,
    });
    assert.equal(res.status, 200);
    assert.ok(res.sid);
    assert.notEqual(res.sid, staleSid, "a fresh sid must be minted");
  });

  // ---------------------------------------------------------------------
  // (g) duplicate Mcp-Session-Id must not 500
  // ---------------------------------------------------------------------
  test("duplicate Mcp-Session-Id headers do not crash the server", async () => {
    // Node's HTTP types allow repeated headers to arrive as string[]. The
    // old handler cast to `string` unconditionally and called .startsWith
    // on the array, throwing TypeError and yielding 500. This test sends a
    // request with two Mcp-Session-Id values using raw node:http (fetch
    // can't emit duplicate headers) and asserts the server responds with
    // a well-formed 401/404 — never 5xx.
    const u = new URL(url);
    const body = JSON.stringify(listToolsRequest(8));

    const status = await new Promise<number>((resolve, reject) => {
      const r = httpRequest(
        {
          hostname: u.hostname,
          port: Number(u.port),
          path: u.pathname,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
            "Content-Length": Buffer.byteLength(body),
            // Pass as array → node emits two separate header lines.
            "Mcp-Session-Id": ["v1.sid.aaaa.bbbb.cccc", "v1.sid.dddd.eeee.ffff"],
          },
        },
        (res) => {
          res.resume();
          res.on("end", () => resolve(res.statusCode ?? 0));
        }
      );
      r.on("error", reject);
      r.write(body);
      r.end();
    });

    assert.ok(
      status < 500,
      `duplicate Mcp-Session-Id must not yield 5xx, got ${status}`
    );
    // Either 401 (treated as "no sid presented", since array-valued sid is
    // rejected at normalization) or 404 (if future implementations treat
    // it as an invalid session) are both acceptable — only 5xx is a bug.
    assert.ok(
      status === 401 || status === 404,
      `expected 401 or 404, got ${status}`
    );
  });
});

// =============================================================================
// OAuth + stateless — sid-only follow-up across pods
// =============================================================================
//
// Regression coverage for the PR #442 review finding: the mcpBearerAuth
// middleware runs BEFORE handleStatelessMcpRequest and, without the bypass,
// requireBearerAuth returns 401 for sid-only requests in GITLAB_MCP_OAUTH
// mode — breaking the headline multi-pod OAuth use case of this PR.
//
// These tests launch two pods with GITLAB_MCP_OAUTH=true +
// OAUTH_STATELESS_MODE=true and a shared stateless secret, then:
//   1. initialize on pod A with Authorization: Bearer <token>, capture sid;
//   2. issue a sid-only POST on pod B — must succeed with 200 + rotated sid;
//   3. verify sid + invalid Authorization still 401s (bypass is guarded on
//      `!req.headers.authorization`);
//   4. verify a malformed sid reaches the handler and returns 404 (presence-
//      not-validity);
//   5. verify DELETE /mcp with sid-only reaches the handler (not 401 from
//      mcpBearerAuth), since DELETE is now gated by the same middleware.

describe("Stateless Mcp-Session-Id — OAuth + sid-only follow-up", () => {
  const MOCK_OAUTH_TOKEN = "ya29.mock-oauth-token-stateless-abcdef";
  const MOCK_CLIENT_ID = "mock-app-uid-oauth-stateless";
  const OAUTH_MOCK_PORT_BASE = 9950;
  const OAUTH_SERVER_PORT_BASE_A = 3950;
  const OAUTH_SERVER_PORT_BASE_B = 3970;

  const servers: ServerInstance[] = [];
  let mockGitLab: MockGitLabServer;
  let urlA: string;
  let urlB: string;
  let mockGitLabUrl: string;
  let material: StatelessKeyMaterial;
  const sharedSecret = randomBytes(32).toString("base64url");

  before(async () => {
    const mockPort = await findMockServerPort(OAUTH_MOCK_PORT_BASE);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_OAUTH_TOKEN],
    });
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();

    // Minimal OAuth endpoints — same pattern as test/mcp-oauth-tests.ts.
    // Only token/info is strictly required for these tests (the server's
    // OAuth verifier calls it to validate the bearer token). DCR +
    // well-known are added for parity so the server boots cleanly.
    mockGitLab.addRootHandler("get", "/oauth/token/info", (req, res) => {
      const auth = req.headers["authorization"] as string | undefined;
      const token = auth?.replace(/^Bearer\s+/i, "");
      if (token !== MOCK_OAUTH_TOKEN) {
        res.status(401).json({ error: "invalid_token" });
        return;
      }
      res.json({
        resource_owner_id: 42,
        scopes: ["api"],
        expires_in_seconds: 7200,
        application: { uid: MOCK_CLIENT_ID },
        created_at: Math.floor(Date.now() / 1000),
      });
    });
    mockGitLab.addRootHandler("post", "/oauth/register", (req, res) => {
      res.status(201).json({
        client_id: MOCK_CLIENT_ID,
        client_name: req.body?.client_name ?? "test",
        redirect_uris: req.body?.redirect_uris ?? [],
        token_endpoint_auth_method: "none",
        require_pkce: true,
      });
    });
    mockGitLab.addRootHandler(
      "get",
      "/.well-known/oauth-authorization-server",
      (_req, res) => {
        res.json({
          issuer: mockGitLabUrl,
          authorization_endpoint: `${mockGitLabUrl}/oauth/authorize`,
          token_endpoint: `${mockGitLabUrl}/oauth/token`,
          registration_endpoint: `${mockGitLabUrl}/oauth/register`,
          revocation_endpoint: `${mockGitLabUrl}/oauth/revoke`,
          scopes_supported: ["api", "read_api", "read_user"],
          response_types_supported: ["code"],
          grant_types_supported: ["authorization_code", "refresh_token"],
          code_challenge_methods_supported: ["S256"],
        });
      }
    );

    const portA = await findAvailablePort(OAUTH_SERVER_PORT_BASE_A);
    const portB = await findAvailablePort(OAUTH_SERVER_PORT_BASE_B);
    const baseUrlA = `http://${HOST}:${portA}`;
    const baseUrlB = `http://${HOST}:${portB}`;

    const commonEnv = {
      STREAMABLE_HTTP: "true",
      GITLAB_MCP_OAUTH: "true",
      GITLAB_OAUTH_APP_ID: "test-oauth-app-id",
      GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
      MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL: "true",
      OAUTH_STATELESS_MODE: "true",
      OAUTH_STATELESS_SECRET: sharedSecret,
    };

    const sA = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: portA,
      timeout: 5000,
      env: { ...commonEnv, MCP_SERVER_URL: baseUrlA },
    });
    servers.push(sA);
    urlA = `${baseUrlA}/mcp`;

    const sB = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: portB,
      timeout: 5000,
      env: { ...commonEnv, MCP_SERVER_URL: baseUrlB },
    });
    servers.push(sB);
    urlB = `${baseUrlB}/mcp`;

    // Load key material in-process so tests can decode sids for assertions.
    material = loadKeyMaterialFromEnv(true, {
      OAUTH_STATELESS_SECRET: sharedSecret,
    } as NodeJS.ProcessEnv)!;
    assert.ok(material, "test failed to load stateless key material");

    console.log(`OAuth+stateless pod A: ${urlA}`);
    console.log(`OAuth+stateless pod B: ${urlB}`);
  });

  after(async () => {
    cleanupServers(servers);
    if (mockGitLab) {
      await mockGitLab.stop();
    }
  });

  interface PostResult {
    status: number;
    sid: string | null;
    bodyText: string;
  }

  async function post(
    url: string,
    body: unknown,
    headers: Record<string, string> = {}
  ): Promise<PostResult> {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...headers,
      },
      body: JSON.stringify(body),
    });
    const sid = res.headers.get("mcp-session-id");
    const bodyText = await res.text();
    return { status: res.status, sid, bodyText };
  }

  function initRequest() {
    return {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "oauth-stateless-integration-test", version: "1.0.0" },
      },
    };
  }

  function listToolsRequest(id: number) {
    return { jsonrpc: "2.0", id, method: "tools/list", params: {} };
  }

  // ---------------------------------------------------------------------
  // Test 1 (CRITICAL): the PR #442 regression scenario.
  // Init on pod A with Authorization, follow-up on pod B with ONLY the sid.
  // Without the bypass in mcpBearerAuth, requireBearerAuth would 401 before
  // handleStatelessMcpRequest ever ran.
  // ---------------------------------------------------------------------
  test("init on pod A with Authorization → sid-only follow-up on pod B succeeds with rotated sid", async () => {
    const initRes = await post(urlA, initRequest(), {
      Authorization: `Bearer ${MOCK_OAUTH_TOKEN}`,
    });
    assert.equal(
      initRes.status,
      200,
      `init must succeed, got ${initRes.status}: ${initRes.bodyText.slice(0, 200)}`
    );
    const sid1 = initRes.sid!;
    assert.ok(sid1, "init response must include Mcp-Session-Id");
    assert.ok(
      sid1.startsWith("v1.sid."),
      `sid must be stateless-shaped, got: ${sid1.slice(0, 20)}…`
    );

    const opened1 = openSessionId(material, sid1, 3600);
    assert.ok(opened1, "init sid must decode");

    // Follow-up on pod B with ONLY the sid — no Authorization header.
    // This is the exact scenario zereight called out in the PR review.
    const followUp = await post(urlB, listToolsRequest(2), {
      "mcp-session-id": sid1,
    });
    assert.equal(
      followUp.status,
      200,
      `sid-only follow-up on pod B must succeed (was masked by 401 before fix), got ${followUp.status}: ${followUp.bodyText.slice(0, 200)}`
    );
    assert.ok(followUp.sid, "follow-up response must carry a rotated sid");
    assert.notEqual(
      followUp.sid,
      sid1,
      "sid must rotate on every authenticated request"
    );
    const opened2 = openSessionId(material, followUp.sid!, 3600);
    assert.ok(opened2, "rotated sid must decode");
    assert.ok(
      opened2!.iat >= opened1!.iat,
      `rotated iat must be >= original: initial=${opened1!.iat}, rotated=${opened2!.iat}`
    );
  });

  // ---------------------------------------------------------------------
  // Test 2: sid + INVALID Authorization still runs bearer validation.
  // The bypass is guarded on `!req.headers.authorization`, so the presence
  // of any Authorization header must fall through to oauthBearerAuth.
  // ---------------------------------------------------------------------
  test("sid + invalid Authorization still runs bearer validation (bypass guarded on !authorization)", async () => {
    const initRes = await post(urlA, initRequest(), {
      Authorization: `Bearer ${MOCK_OAUTH_TOKEN}`,
    });
    assert.equal(initRes.status, 200);
    const sid = initRes.sid!;

    const res = await post(urlB, listToolsRequest(3), {
      "mcp-session-id": sid,
      Authorization: "Bearer garbage-invalid-token",
    });
    assert.equal(
      res.status,
      401,
      `invalid bearer must 401 even with valid sid present, got ${res.status}`
    );
  });

  // ---------------------------------------------------------------------
  // Test 3: malformed sid without Authorization reaches the handler and
  // gets 404 (not 401). Proves the bypass keys off header PRESENCE, not
  // validity — malformed / expired / legacy sids must reach
  // handleStatelessMcpRequest to produce the intended "session ended"
  // signal per MCP Streamable HTTP.
  // ---------------------------------------------------------------------
  test("malformed sid without Authorization reaches handler → 404 (not 401)", async () => {
    const res = await post(urlA, listToolsRequest(4), {
      "mcp-session-id": "v1.sid.garbage.garbage.garbage",
    });
    assert.equal(
      res.status,
      404,
      `malformed sid must reach handler and get 404, got ${res.status}: ${res.bodyText.slice(0, 200)}`
    );
  });

  // ---------------------------------------------------------------------
  // Test 4: DELETE /mcp is now gated by mcpBearerAuth. A sid-only DELETE
  // must REACH the handler body (not 401 from the middleware). In
  // stateless mode the DELETE handler doesn't track the sid in
  // streamableTransports, so the handler responds 404 "Session not found".
  // The critical assertion is !=401 from mcpBearerAuth.
  // ---------------------------------------------------------------------
  test("DELETE /mcp with sid-only reaches handler (not 401 from mcpBearerAuth)", async () => {
    // Use a freshly-minted, valid sealed sid so the presence check
    // succeeds and the middleware does not 401.
    const sealedSid = mintSessionId(material, {
      header: "Authorization",
      token: MOCK_OAUTH_TOKEN,
      apiUrl: `${mockGitLabUrl}/api/v4`,
    });

    const res = await fetch(urlA, {
      method: "DELETE",
      headers: { "mcp-session-id": sealedSid },
    });
    assert.notEqual(
      res.status,
      401,
      `DELETE with sid must bypass mcpBearerAuth 401; got ${res.status}`
    );
    // Handler body returns 404 because the sid is not in streamableTransports.
    assert.equal(
      res.status,
      404,
      `DELETE handler should respond 404 Session not found in stateless mode, got ${res.status}`
    );
  });
});
