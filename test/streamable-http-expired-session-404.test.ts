import { after, describe, test } from "node:test";
import assert from "node:assert";
import {
  cleanupServers,
  findAvailablePort,
  HOST,
  launchServer,
  ServerInstance,
  TransportMode,
} from "./utils/server-launcher.js";

async function rawMcpRequest(
  url: string,
  method: string,
  body: object | null,
  headers: Record<string, string> = {}
): Promise<{ status: number; data: any; text: string }> {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null, text };
}

const initializeBody = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "expired-session-test", version: "1.0.0" },
  },
};

async function initialize(mcpUrl: string, headers: Record<string, string> = {}) {
  const response = await fetch(mcpUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify(initializeBody),
  });
  assert.strictEqual(response.status, 200, await response.text());
  const sessionId = response.headers.get("mcp-session-id");
  assert.ok(sessionId, "initialize should return Mcp-Session-Id");
  return sessionId!;
}

let portOffset = 0;

async function launchExpiringSessionServer() {
  const port = await findAvailablePort(3700 + portOffset++ * 10);
  const server = await launchServer({
    mode: TransportMode.STREAMABLE_HTTP,
    port,
    timeout: 10_000,
    env: {
      STREAMABLE_HTTP: "true",
      REMOTE_AUTHORIZATION: "true",
      GITLAB_ALLOW_UNAUTHENTICATED_TOOL_DISCOVERY: "true",
      GITLAB_API_URL: "https://gitlab.example.com/api/v4",
      SESSION_TIMEOUT_SECONDS: "1",
      MAX_REQUESTS_PER_MINUTE: "1",
    },
  });
  return { server, mcpUrl: `http://${HOST}:${port}/mcp` };
}

describe("Expired stateful session returns 404", { timeout: 20_000 }, () => {
  let servers: ServerInstance[] = [];

  after(() => {
    cleanupServers(servers);
    servers = [];
  });

  test("POST with an expired Mcp-Session-Id gets 404 even once the rate limit is exhausted", async () => {
    const { server, mcpUrl } = await launchExpiringSessionServer();
    servers.push(server);

    const sessionId = await initialize(mcpUrl);
    await new Promise(resolve => setTimeout(resolve, 2_000));

    // First request after expiry burns the single-request-per-minute budget.
    const first = await rawMcpRequest(
      mcpUrl,
      "POST",
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      { "mcp-session-id": sessionId }
    );
    assert.strictEqual(first.status, 404, first.text);
    assert.strictEqual(first.data?.error, "Session not found");

    // Rate limit is now exhausted for this client, but the stale session
    // must still surface as 404, not 429.
    const second = await rawMcpRequest(
      mcpUrl,
      "POST",
      { jsonrpc: "2.0", id: 3, method: "tools/list", params: {} },
      { "mcp-session-id": sessionId }
    );
    assert.strictEqual(second.status, 404, second.text);
  });

  test("a fresh initialization (no session id) still succeeds normally", async () => {
    const { server, mcpUrl } = await launchExpiringSessionServer();
    servers.push(server);

    const sessionId = await initialize(mcpUrl);
    assert.ok(sessionId);
  });

  test("GET and DELETE with an expired Mcp-Session-Id also get 404", async () => {
    const { server, mcpUrl } = await launchExpiringSessionServer();
    servers.push(server);

    const sessionId = await initialize(mcpUrl);
    await new Promise(resolve => setTimeout(resolve, 2_000));

    const getResponse = await rawMcpRequest(mcpUrl, "GET", null, {
      "mcp-session-id": sessionId,
      Accept: "text/event-stream",
    });
    assert.strictEqual(getResponse.status, 404, getResponse.text);

    const deleteResponse = await rawMcpRequest(mcpUrl, "DELETE", null, {
      "mcp-session-id": sessionId,
    });
    assert.strictEqual(deleteResponse.status, 404, deleteResponse.text);
  });
});
