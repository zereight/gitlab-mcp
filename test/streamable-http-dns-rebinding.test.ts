import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { afterEach, describe, test } from "node:test";
import * as path from "node:path";
import { findAvailablePort } from "./utils/server-launcher.js";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const HOST = process.env.HOST || "127.0.0.1";
const SERVER_PATH = path.resolve(process.cwd(), "build/index.js");
const TEST_TOKEN = "test-token-123456789012345";

const running = new Set<ReturnType<typeof spawn>>();
const mockGitLabServers: MockGitLabServer[] = [];

function hostWithPort(host: string, port: number) {
  const normalized = host.trim();
  if (normalized.includes(":") && !normalized.startsWith("[")) return `[${normalized}]:${port}`;
  return `${normalized}:${port}`;
}

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
      GITLAB_USE_OAUTH: "false",
      GITLAB_PERSONAL_ACCESS_TOKEN: "",
      GITLAB_JOB_TOKEN: "",
      GITLAB_AUTH_COOKIE_PATH: "",
      MCP_SERVER_URL: "",
      GITLAB_OAUTH_APP_ID: "",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  running.add(child);
  child.once("exit", () => running.delete(child));
  return child;
}

async function startAuthenticatedServer(env: Record<string, string>, port: number) {
  const mockPort = await findMockServerPort(8800 + (port % 100));
  const mockGitLab = new MockGitLabServer({
    port: mockPort,
    validTokens: [TEST_TOKEN],
  });
  await mockGitLab.start();
  mockGitLabServers.push(mockGitLab);

  startServer(
    {
      GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
      ...env,
    },
    port
  );
}

async function waitForHealth(port: number, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://${hostWithPort(HOST, port)}/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error(`server did not become healthy: ${String(lastError)}`);
}

function postMcp(
  port: number,
  headers: Record<string, string>,
  body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "dns-rebinding-test", version: "1.0.0" },
    },
  })
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: HOST,
        port,
        path: "/mcp",
        method: "POST",
        headers: {
          Host: hostWithPort(HOST, port),
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "Private-Token": TEST_TOKEN,
          "Content-Length": Buffer.byteLength(body).toString(),
          ...headers,
        },
      },
      res => {
        let responseBody = "";
        res.setEncoding("utf8");
        res.on("data", chunk => {
          responseBody += chunk;
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: responseBody }));
      }
    );
    req.on("error", reject);
    req.end(body);
  });
}

afterEach(async () => {
  for (const child of running) {
    if (!child.killed) child.kill("SIGTERM");
  }
  running.clear();
  while (mockGitLabServers.length > 0) {
    const mockGitLab = mockGitLabServers.pop();
    if (mockGitLab) {
      await mockGitLab.stop();
    }
  }
});

describe("Streamable HTTP DNS rebinding protection", () => {
  test("rejects forged Host and Origin headers before handling /mcp", async () => {
    const port = await findAvailablePort(4700);
    await startAuthenticatedServer({}, port);
    await waitForHealth(port);

    const validHost = hostWithPort(HOST, port);

    const badJson = await postMcp(
      port,
      {
        Host: "attacker.example.test",
        Origin: `http://${validHost}`,
      },
      "{"
    );
    assert.equal(badJson.status, 403);
    assert.match(badJson.body, /Host header is not allowed/);
    assert.match(badJson.body, /MCP_ALLOWED_HOSTS/);

    const badHost = await postMcp(port, {
      Host: "attacker.example.test",
      Origin: `http://${validHost}`,
    });
    assert.equal(badHost.status, 403);
    assert.match(badHost.body, /Host header is not allowed/);
    assert.match(badHost.body, /MCP_ALLOWED_HOSTS/);

    const badOrigin = await postMcp(port, {
      Host: validHost,
      Origin: "https://attacker.example.test",
    });
    assert.equal(badOrigin.status, 403);
    assert.match(badOrigin.body, /Origin header is not allowed/);
    assert.match(badOrigin.body, /MCP_ALLOWED_ORIGINS/);

    const ok = await postMcp(port, { Host: validHost });
    assert.equal(ok.status, 200);
  });

  test("allows loopback Host and Origin on any port (Docker port mapping)", async () => {
    const port = await findAvailablePort(4720);
    await startAuthenticatedServer({}, port);
    await waitForHealth(port);

    // e.g. docker run -p 3333:3002 -> client sends Host: localhost:3333
    const remappedHost = await postMcp(port, { Host: `localhost:${port + 1000}` });
    assert.equal(remappedHost.status, 200);

    const remappedIpv4 = await postMcp(port, { Host: `127.0.0.1:${port + 1000}` });
    assert.equal(remappedIpv4.status, 200);

    const remappedOrigin = await postMcp(port, {
      Host: `localhost:${port + 1000}`,
      Origin: `http://localhost:${port + 1000}`,
    });
    assert.equal(remappedOrigin.status, 200);

    const bareLoopback = await postMcp(port, { Host: "localhost" });
    assert.equal(bareLoopback.status, 200);

    const loopbackHostBadOrigin = await postMcp(port, {
      Host: `localhost:${port + 1000}`,
      Origin: "http://attacker.example.test",
    });
    assert.equal(loopbackHostBadOrigin.status, 403);
    assert.match(loopbackHostBadOrigin.body, /Origin header is not allowed/);
    assert.match(loopbackHostBadOrigin.body, /MCP_ALLOWED_ORIGINS/);
  });

  test("allows the configured MCP_SERVER_URL host and origin", async () => {
    const port = await findAvailablePort(4710);
    await startAuthenticatedServer({ MCP_SERVER_URL: "https://mcp.example.test" }, port);
    await waitForHealth(port);

    const ok = await postMcp(port, {
      Host: "mcp.example.test",
      Origin: "https://mcp.example.test",
    });
    assert.equal(ok.status, 200);
  });
});
