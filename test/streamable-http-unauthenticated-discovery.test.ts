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
  body: object,
  headers: Record<string, string> = {}
): Promise<{ status: number; data: any; sessionId: string | null; text: string }> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  const sessionId = response.headers.get("mcp-session-id");
  if (response.status === 202 || response.status === 204) {
    return { status: response.status, data: null, sessionId, text: "" };
  }

  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    const dataLines = text
      .split("\n")
      .filter(line => line.startsWith("data: "))
      .map(line => line.slice(6));
    return {
      status: response.status,
      data: dataLines.length > 0 ? JSON.parse(dataLines.at(-1)!) : null,
      sessionId,
      text,
    };
  }

  return {
    status: response.status,
    data: text ? JSON.parse(text) : null,
    sessionId,
    text,
  };
}

const initializeBody = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "unauth-discovery-test", version: "1.0.0" },
  },
};

async function initialize(mcpUrl: string) {
  const response = await rawMcpRequest(mcpUrl, initializeBody);
  assert.strictEqual(response.status, 200, response.text);
  assert.ok(response.sessionId, "initialize should return Mcp-Session-Id");
  return response.sessionId;
}

let portOffset = 0;

async function launchRemoteAuthServer(extraEnv: Record<string, string> = {}) {
  // Keep above remote-auth-simple-test timeout suite (3500+) to avoid parallel bind races.
  const port = await findAvailablePort(3600 + portOffset++ * 10);
  const server = await launchServer({
    mode: TransportMode.STREAMABLE_HTTP,
    port,
    timeout: 10_000,
    env: {
      STREAMABLE_HTTP: "true",
      REMOTE_AUTHORIZATION: "true",
      GITLAB_API_URL: "https://gitlab.example.com/api/v4",
      ...extraEnv,
    },
  });
  return { server, mcpUrl: `http://${HOST}:${port}/mcp` };
}

describe("Streamable HTTP unauthenticated tool discovery", { timeout: 20_000 }, () => {
  let servers: ServerInstance[] = [];

  after(() => {
    cleanupServers(servers);
    servers = [];
  });

  test("keeps unauthenticated initialize blocked by default", async () => {
    const { server, mcpUrl } = await launchRemoteAuthServer();
    servers.push(server);

    const initResponse = await rawMcpRequest(mcpUrl, initializeBody);

    assert.strictEqual(initResponse.status, 401, initResponse.text);
    assert.strictEqual(initResponse.sessionId, null);
  });

  test("rejects invalid auth headers even when unauthenticated discovery is enabled", async () => {
    const { server, mcpUrl } = await launchRemoteAuthServer({
      GITLAB_ALLOW_UNAUTHENTICATED_TOOL_DISCOVERY: "true",
    });
    servers.push(server);

    const initResponse = await rawMcpRequest(mcpUrl, initializeBody, {
      Authorization: "Bearer definitely-not-valid",
    });

    assert.strictEqual(initResponse.status, 401, initResponse.text);
    assert.strictEqual(initResponse.sessionId, null);
  });

  test("allows unauthenticated tools/list when explicitly enabled", async () => {
    const { server, mcpUrl } = await launchRemoteAuthServer({
      GITLAB_ALLOW_UNAUTHENTICATED_TOOL_DISCOVERY: "true",
    });
    servers.push(server);

    const sessionId = await initialize(mcpUrl);
    const initialized = await rawMcpRequest(
      mcpUrl,
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { "mcp-session-id": sessionId }
    );
    assert.ok([200, 202, 204].includes(initialized.status), initialized.text);

    const listResponse = await rawMcpRequest(
      mcpUrl,
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      { "mcp-session-id": sessionId }
    );

    assert.strictEqual(listResponse.status, 200, listResponse.text);
    assert.ok(Array.isArray(listResponse.data.result?.tools), "tools/list should return tools");
    assert.ok(listResponse.data.result.tools.length > 0, "tools/list should not be empty");
  });

  test("allows unauthenticated server/discover in individual and batch requests", async () => {
    const { server, mcpUrl } = await launchRemoteAuthServer({
      GITLAB_ALLOW_UNAUTHENTICATED_TOOL_DISCOVERY: "true",
    });
    servers.push(server);

    const preInitDiscover = await rawMcpRequest(mcpUrl, {
      jsonrpc: "2.0",
      id: 10,
      method: "server/discover",
      params: {},
    });
    assert.strictEqual(preInitDiscover.status, 400, preInitDiscover.text);
    assert.match(
      preInitDiscover.data?.error?.message ?? "",
      /Server not initialized/i,
      "server/discover should pass the auth gate before MCP initialization errors"
    );

    const sessionId = await initialize(mcpUrl);
    const initialized = await rawMcpRequest(
      mcpUrl,
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { "mcp-session-id": sessionId }
    );
    assert.ok([200, 202, 204].includes(initialized.status), initialized.text);

    const discoverResponse = await rawMcpRequest(
      mcpUrl,
      { jsonrpc: "2.0", id: 11, method: "server/discover", params: {} },
      { "mcp-session-id": sessionId }
    );
    assert.strictEqual(discoverResponse.status, 200, discoverResponse.text);
    assert.strictEqual(discoverResponse.data?.id, 11);
    assert.strictEqual(discoverResponse.data?.error?.code, -32601);
    assert.match(discoverResponse.data?.error?.message ?? "", /Method not found/i);

    const batchResponse = await rawMcpRequest(
      mcpUrl,
      [
        { jsonrpc: "2.0", id: 12, method: "server/discover", params: {} },
        { jsonrpc: "2.0", id: 13, method: "tools/list", params: {} },
      ],
      { "mcp-session-id": sessionId }
    );
    assert.strictEqual(batchResponse.status, 200, batchResponse.text);
    assert.ok(Array.isArray(batchResponse.data.result?.tools), "batch tools/list should return tools");
    assert.ok(batchResponse.data.result.tools.length > 0, "batch tools/list should not be empty");
  });

  test("rejects unauthenticated discovery batch when tools/call is included", async () => {
    const { server, mcpUrl } = await launchRemoteAuthServer({
      GITLAB_ALLOW_UNAUTHENTICATED_TOOL_DISCOVERY: "true",
    });
    servers.push(server);

    const response = await rawMcpRequest(mcpUrl, [
      { jsonrpc: "2.0", id: 20, method: "server/discover", params: {} },
      {
        jsonrpc: "2.0",
        id: 21,
        method: "tools/call",
        params: {
          name: "get_project",
          arguments: { project_id: "123" },
        },
      },
    ]);

    assert.strictEqual(response.status, 401, response.text);
  });

  test("expires unauthenticated discovery sessions and frees capacity", async () => {
    const { server, mcpUrl } = await launchRemoteAuthServer({
      GITLAB_ALLOW_UNAUTHENTICATED_TOOL_DISCOVERY: "true",
      MAX_SESSIONS: "1",
      MAX_REQUESTS_PER_MINUTE: "1",
      MCP_TRUST_PROXY: "true",
      SESSION_TIMEOUT_SECONDS: "1",
    });
    servers.push(server);

    const expiredSessionId = await initialize(mcpUrl);
    await new Promise(resolve => setTimeout(resolve, 2_000));

    const expiredResponse = await rawMcpRequest(
      mcpUrl,
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      { "mcp-session-id": expiredSessionId }
    );
    assert.strictEqual(expiredResponse.status, 404, expiredResponse.text);
    assert.deepStrictEqual(expiredResponse.data, { error: "Session not found" });

    const healthResponse = await fetch(mcpUrl.replace("/mcp", "/health"));
    assert.strictEqual(healthResponse.status, 200);

    const nextSession = await rawMcpRequest(mcpUrl, initializeBody, {
      "x-forwarded-for": "192.0.2.10",
    });
    assert.strictEqual(nextSession.status, 200, nextSession.text);
    assert.ok(nextSession.sessionId, "expired discovery session should free capacity");
  });

  test("rejects inherited object-property names as unknown session IDs", async () => {
    const { server, mcpUrl } = await launchRemoteAuthServer({
      GITLAB_ALLOW_UNAUTHENTICATED_TOOL_DISCOVERY: "true",
    });
    servers.push(server);

    for (const sessionId of ["constructor", "toString", "__proto__"]) {
      const response = await rawMcpRequest(
        mcpUrl,
        { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
        { "mcp-session-id": sessionId }
      );

      assert.strictEqual(response.status, 404, `${sessionId}: ${response.text}`);
      assert.deepStrictEqual(response.data, { error: "Session not found" });
    }
  });

  test("still blocks unauthenticated tools/call when discovery is enabled", async () => {
    const { server, mcpUrl } = await launchRemoteAuthServer({
      GITLAB_ALLOW_UNAUTHENTICATED_TOOL_DISCOVERY: "true",
    });
    servers.push(server);

    const sessionId = await initialize(mcpUrl);
    const callResponse = await rawMcpRequest(
      mcpUrl,
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "get_project",
          arguments: { project_id: "123" },
        },
      },
      { "mcp-session-id": sessionId }
    );

    assert.strictEqual(callResponse.status, 401, callResponse.text);
  });
});
