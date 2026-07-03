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
  const port = await findAvailablePort(3470 + portOffset++ * 10);
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
