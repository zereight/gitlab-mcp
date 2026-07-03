import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { afterEach, describe, test } from "node:test";
import * as path from "node:path";
import { findAvailablePort } from "./utils/server-launcher.js";

const ERROR_MESSAGE =
  "SSE=true requires SSE_AUTH_TOKEN (or explicitly set SSE_DANGEROUSLY_ALLOW_UNAUTHENTICATED_REMOTE=true)";
const LOOPBACK = "127.0.0.1";
const SERVER_PATH = path.resolve(process.cwd(), "build/index.js");

const running = new Set<ReturnType<typeof spawn>>();

function startSseServer(env: Record<string, string>, port: number) {
  const child = spawn("node", [SERVER_PATH], {
    env: {
      ...process.env,
      GITLAB_API_URL: "https://gitlab.example.com/api/v4",
      HOST: "0.0.0.0",
      PORT: String(port),
      SSE: "true",
      STREAMABLE_HTTP: "false",
      REMOTE_AUTHORIZATION: "false",
      GITLAB_MCP_OAUTH: "false",
      GITLAB_USE_OAUTH: "false",
      GITLAB_PERSONAL_ACCESS_TOKEN: "glpat_test",
      GITLAB_JOB_TOKEN: "",
      GITLAB_AUTH_COOKIE_PATH: "",
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

  let timeoutHandle: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(`server did not exit within ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  try {
    const [code] = (await Promise.race([once(child, "exit"), timeout])) as [number | null];
    return { code, output };
  } finally {
    clearTimeout(timeoutHandle!);
  }
}

async function waitForHealth(port: number, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://${LOOPBACK}:${port}/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error(`server did not become healthy: ${String(lastError)}`);
}

afterEach(() => {
  for (const child of running) {
    if (!child.killed) child.kill("SIGTERM");
  }
  running.clear();
});

describe("SSE remote auth guard", () => {
  test("refuses unauthenticated SSE", async () => {
    const port = await findAvailablePort(4400);
    const child = startSseServer({}, port);

    const { code, output } = await waitForExit(child);

    assert.notEqual(code, 0);
    assert.match(output, new RegExp(ERROR_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  test("requires bearer auth on SSE endpoints when SSE_AUTH_TOKEN is configured", async () => {
    const port = await findAvailablePort(4410);
    startSseServer({ SSE_AUTH_TOKEN: "mcp_sse_secret" }, port);
    await waitForHealth(port);

    const sseResponse = await fetch(`http://${LOOPBACK}:${port}/sse`);
    assert.equal(sseResponse.status, 401);

    const unauthenticatedMessage = await fetch(
      `http://${LOOPBACK}:${port}/messages?sessionId=missing`,
      { method: "POST" }
    );
    assert.equal(unauthenticatedMessage.status, 401);

    const authenticatedMessage = await fetch(
      `http://${LOOPBACK}:${port}/messages?sessionId=missing`,
      { method: "POST", headers: { Authorization: "Bearer mcp_sse_secret" } }
    );
    assert.equal(authenticatedMessage.status, 400);
  });
});
