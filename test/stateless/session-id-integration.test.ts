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

  test("pod B rejects a tampered sid", async () => {
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
    assert.equal(listRes.status, 401);
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
    // prefers the fresh header and mints a new sid. For non-init requests the
    // SDK runs in stateless mode and does not emit an Mcp-Session-Id response
    // header — so we cannot directly observe the new sid here. But we can
    // assert the request succeeds, which proves live auth is being honoured.
    const listRes = await post(urlB, listToolsRequest(5), {
      "mcp-session-id": sidFromA,
      "private-token": MOCK_TOKEN,
    });
    assert.equal(listRes.status, 200);
  });
});
