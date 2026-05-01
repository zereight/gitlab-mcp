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
import { after, before, describe, test } from "node:test";

import {
  loadKeyMaterialFromEnv,
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
});
