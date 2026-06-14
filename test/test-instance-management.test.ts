import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { describe, test, afterEach } from "node:test";
import * as path from "node:path";
import * as fs from "node:fs";
import { findAvailablePort } from "./utils/server-launcher.js";

const HOST = process.env.HOST || "127.0.0.1";
const SERVER_PATH = path.resolve(process.cwd(), "build/index.js");
const TEST_CONFIG_PATH = path.resolve(process.cwd(), "instances.test.json");

const running = new Set<ReturnType<typeof spawn>>();

function startServer(env: Record<string, string>, port: number) {
  const child = spawn("node", [SERVER_PATH], {
    env: {
      ...process.env,
      GITLAB_API_URL: "https://gitlab.example.com",
      HOST,
      PORT: String(port),
      STREAMABLE_HTTP: "true",
      REMOTE_AUTHORIZATION: "true",
      GITLAB_MCP_OAUTH: "false",
      GITLAB_PERSONAL_ACCESS_TOKEN: "glpat-master-token",
      GITLAB_CONFIG_PATH: TEST_CONFIG_PATH,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  running.add(child);
  child.once("exit", () => running.delete(child));
  return child;
}

async function waitForHealth(port: number, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://${HOST}:${port}/health`);
      if (response.ok) return;
    } catch {
      // ignore
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`server did not become healthy on port ${port}`);
}

async function parseMcpResponse(response: Response) {
  const contentType = response.headers.get("content-type");
  const sessionId = response.headers.get("mcp-session-id");
  
  if (contentType?.includes("text/event-stream")) {
    const text = await response.text();
    const lines = text.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          return { result: JSON.parse(line.slice(6)), sessionId };
        } catch {
          // ignore
        }
      }
    }
    return { result: null, sessionId };
  }
  
  return { result: await response.json(), sessionId };
}

async function callTool(port: number, sessionId: string, name: string, args: any) {
  const response = await fetch(`http://${HOST}:${port}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "Mcp-Session-Id": sessionId,
      "Authorization": "Bearer glpat-this-is-a-long-enough-token-12345"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Math.floor(Math.random() * 1000),
      method: "tools/call",
      params: {
        name,
        arguments: args,
      },
    }),
  });
  return parseMcpResponse(response);
}

describe("Instance Management Security", () => {

  test("disallows alias switching when REMOTE_AUTHORIZATION is active", async () => {
    // Setup mock instances.test.json
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
      active_alias: "default",
      instances: {
        secret: {
          url: "https://gitlab.secret.com/api/v4",
          token: "glpat-secret-token-long-enough-12345",
          description: "Should not be accessible by alias in remote mode"
        }
      }
    }));

    try {
      const port = await findAvailablePort(4400);
      const child = startServer({ REMOTE_AUTHORIZATION: "true" }, port);
      
      await waitForHealth(port);

      // Initialize to get session id
      const response = await fetch(`http://${HOST}:${port}/mcp`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          "Authorization": "Bearer glpat-this-is-a-long-enough-token-12345"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1" } },
        }),
      });
      const { sessionId } = await parseMcpResponse(response);
      assert.ok(sessionId, "Should have received a session id");

      // Try to switch by alias
      const { result } = await callTool(port, sessionId!, "gitlab_switch_instance", { alias: "secret" });
      
      // In this server, some tool errors are returned as JSON-RPC errors
      assert.ok(result.error, `Should have returned a JSON-RPC error. Result: ${JSON.stringify(result)}`);
      assert.match(result.error.message, /Alias-based instance switching is disabled in remote\/OAuth modes/);

    } finally {
      if (fs.existsSync(TEST_CONFIG_PATH)) {
        fs.unlinkSync(TEST_CONFIG_PATH);
      }
    }
  });

  test("allows switching by direct apiUrl and token in remote mode", async () => {
    const port = await findAvailablePort(4410);
    startServer({ REMOTE_AUTHORIZATION: "true" }, port);
    await waitForHealth(port);

    const response = await fetch(`http://${HOST}:${port}/mcp`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "Authorization": "Bearer glpat-this-is-a-long-enough-token-12345"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1" } },
      }),
    });
    const { sessionId } = await parseMcpResponse(response);
    assert.ok(sessionId, "Should have received a session id");

    const { result } = await callTool(port, sessionId!, "gitlab_switch_instance", {
      apiUrl: "https://gitlab.custom.com",
      token: "glpat-custom-token-long-enough-12345"
    });

    if (result.error) {
      throw new Error(`RPC error: ${JSON.stringify(result.error)}`);
    }
    const content = result.result?.content?.[0];
    assert.ok(content, `Should have returned content. Result: ${JSON.stringify(result)}`);
    assert.ok(!content.isError, `Should not have returned an error content: ${content.text}`);
    assert.match(content.text, /Successfully switched/);
  });
});

afterEach(() => {
  for (const child of running) {
    if (!child.killed) child.kill("SIGTERM");
  }
  running.clear();
  if (fs.existsSync(TEST_CONFIG_PATH)) {
    fs.unlinkSync(TEST_CONFIG_PATH);
  }
});
