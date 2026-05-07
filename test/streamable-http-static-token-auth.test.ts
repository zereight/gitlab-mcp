import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { afterEach, describe, test } from "node:test";
import * as path from "node:path";
import { findAvailablePort } from "./utils/server-launcher.js";

const ERROR_MESSAGE =
  "STREAMABLE_HTTP=true with GITLAB_PERSONAL_ACCESS_TOKEN or GITLAB_JOB_TOKEN requires REMOTE_AUTHORIZATION=true or GITLAB_MCP_OAUTH=true";

const HOST = process.env.HOST || "127.0.0.1";
const SERVER_PATH = path.resolve(process.cwd(), "build/index.js");

const running = new Set<ReturnType<typeof spawn>>();

function startServer(env: Record<string, string>, port: number) {
  const child = spawn("node", [SERVER_PATH], {
    env: {
      ...process.env,
      GITLAB_API_URL: "https://gitlab.example.com",
      HOST,
      PORT: String(port),
      STREAMABLE_HTTP: "true",
      REMOTE_AUTHORIZATION: "false",
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

async function waitForExit(child: ReturnType<typeof spawn>, timeoutMs = 5000) {
  let output = "";
  child.stdout?.on("data", chunk => {
    output += chunk.toString();
  });
  child.stderr?.on("data", chunk => {
    output += chunk.toString();
  });

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`server did not exit within ${timeoutMs}ms`)), timeoutMs);
  });

  const [code] = (await Promise.race([once(child, "exit"), timeout])) as [number | null];
  return { code, output };
}

async function waitForHealth(port: number, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://${HOST}:${port}/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error(`server did not become healthy: ${String(lastError)}`);
}

async function postMcpWithoutAuth(port: number) {
  return fetch(`http://${HOST}:${port}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "static-token-auth-test", version: "1.0.0" },
      },
    }),
  });
}

async function postMcpWithSessionWithoutAuth(port: number, sessionId: string) {
  return fetch(`http://${HOST}:${port}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "Mcp-Session-Id": sessionId,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    }),
  });
}

afterEach(() => {
  for (const child of running) {
    if (!child.killed) child.kill("SIGTERM");
  }
  running.clear();
});

describe("Streamable HTTP static server token auth", () => {
  test("refuses startup with PAT and no MCP-layer auth", async () => {
    const port = await findAvailablePort(4300);
    const child = startServer({ GITLAB_PERSONAL_ACCESS_TOKEN: "glpat_test" }, port);

    const { code, output } = await waitForExit(child);

    assert.notEqual(code, 0);
    assert.match(output, new RegExp(ERROR_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  test("refuses startup with JOB-TOKEN and no MCP-layer auth", async () => {
    const port = await findAvailablePort(4310);
    const child = startServer({ GITLAB_JOB_TOKEN: "job_test" }, port);

    const { code, output } = await waitForExit(child);

    assert.notEqual(code, 0);
    assert.match(output, new RegExp(ERROR_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  test("allows startup with PAT when REMOTE_AUTHORIZATION is enabled", async () => {
    const port = await findAvailablePort(4320);
    startServer(
      {
        GITLAB_PERSONAL_ACCESS_TOKEN: "glpat_test",
        REMOTE_AUTHORIZATION: "true",
      },
      port
    );

    await waitForHealth(port);

    const initResponse = await postMcpWithoutAuth(port);
    assert.equal(initResponse.status, 200);

    const sessionId = initResponse.headers.get("mcp-session-id");
    assert.ok(sessionId);

    const followUpResponse = await postMcpWithSessionWithoutAuth(port, sessionId);
    assert.equal(followUpResponse.status, 401);
  });

  test("allows startup with PAT when GITLAB_MCP_OAUTH is enabled", async () => {
    const port = await findAvailablePort(4330);
    startServer(
      {
        GITLAB_PERSONAL_ACCESS_TOKEN: "glpat_test",
        GITLAB_MCP_OAUTH: "true",
        MCP_SERVER_URL: `http://${HOST}:${port}`,
        GITLAB_OAUTH_APP_ID: "oauth-app-id",
      },
      port
    );

    await waitForHealth(port);

    const response = await postMcpWithoutAuth(port);
    assert.equal(response.status, 401);
  });
});
