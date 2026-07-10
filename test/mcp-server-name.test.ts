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
): Promise<{ status: number; data: any; text: string }> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify(body),
  });

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
      text,
    };
  }

  return {
    status: response.status,
    data: text ? JSON.parse(text) : null,
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
    clientInfo: { name: "server-name-test", version: "1.0.0" },
  },
};

let portOffset = 0;

async function launchWithServerName(mcpServerName?: string) {
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
      ...(mcpServerName !== undefined ? { MCP_SERVER_NAME: mcpServerName } : {}),
    },
  });
  return { server, mcpUrl: `http://${HOST}:${port}/mcp` };
}

describe("MCP_SERVER_NAME", { timeout: 20_000 }, () => {
  let servers: ServerInstance[] = [];

  after(() => {
    cleanupServers(servers);
    servers = [];
  });

  test("defaults to zereight-gitlab-mcp-server when unset", async () => {
    const { server, mcpUrl } = await launchWithServerName();
    servers.push(server);

    const response = await rawMcpRequest(mcpUrl, initializeBody);

    assert.strictEqual(response.status, 200, response.text);
    assert.strictEqual(response.data?.result?.serverInfo?.name, "zereight-gitlab-mcp-server");
  });

  test("reports the overridden name when MCP_SERVER_NAME is set", async () => {
    const { server, mcpUrl } = await launchWithServerName("gitlab-selfhosted-readonly");
    servers.push(server);

    const response = await rawMcpRequest(mcpUrl, initializeBody);

    assert.strictEqual(response.status, 200, response.text);
    assert.strictEqual(response.data?.result?.serverInfo?.name, "gitlab-selfhosted-readonly");
  });

  test("treats a whitespace-only MCP_SERVER_NAME as unset", async () => {
    const { server, mcpUrl } = await launchWithServerName("   ");
    servers.push(server);

    const response = await rawMcpRequest(mcpUrl, initializeBody);

    assert.strictEqual(response.status, 200, response.text);
    assert.strictEqual(response.data?.result?.serverInfo?.name, "zereight-gitlab-mcp-server");
  });
});
