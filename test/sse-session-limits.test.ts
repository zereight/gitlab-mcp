import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { afterEach, describe, test } from "node:test";
import * as path from "node:path";
import { findAvailablePort } from "./utils/server-launcher.js";

const LOOPBACK = "127.0.0.1";
const SSE_TOKEN = "mcp_sse_secret";
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
      SSE_AUTH_TOKEN: SSE_TOKEN,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  running.add(child);
  child.once("exit", () => running.delete(child));
  return child;
}

async function waitForHealth(port: number, timeoutMs = 10000) {
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

interface OpenSseConnection {
  readonly statusCode: number | undefined;
  close: () => void;
  ended: Promise<void>;
}

function openSseConnection(port: number): OpenSseConnection {
  let statusCode: number | undefined;
  let resolveEnded: () => void = () => {};
  const ended = new Promise<void>(resolve => {
    resolveEnded = resolve;
  });

  const request = http.get(
    {
      host: LOOPBACK,
      port,
      path: "/sse",
      headers: { Authorization: `Bearer ${SSE_TOKEN}`, Accept: "text/event-stream" },
    },
    response => {
      statusCode = response.statusCode;
      response.on("data", () => {});
      response.on("end", () => resolveEnded());
      response.on("close", () => resolveEnded());
    }
  );

  request.on("error", () => resolveEnded());

  return {
    get statusCode() {
      return statusCode;
    },
    close: () => {
      request.destroy();
      resolveEnded();
    },
    ended,
  };
}

async function waitFor(predicate: () => boolean, timeoutMs = 5000, stepMs = 50) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise(resolve => setTimeout(resolve, stepMs));
  }
  return predicate();
}

afterEach(() => {
  for (const child of running) {
    if (!child.killed) child.kill("SIGTERM");
  }
  running.clear();
});

describe("SSE session limits", { concurrency: 1 }, () => {
  test("rejects new SSE connections once MAX_SESSIONS is reached", async () => {
    const port = await findAvailablePort(4500);
    startSseServer({ MAX_SESSIONS: "2" }, port);
    await waitForHealth(port);

    const first = openSseConnection(port);
    const second = openSseConnection(port);

    const bothConnected = await waitFor(
      () => first.statusCode === 200 && second.statusCode === 200,
      5000
    );
    assert.ok(bothConnected, "expected the first two SSE connections to be accepted");

    const rejected = await fetch(`http://${LOOPBACK}:${port}/sse`, {
      headers: { Authorization: `Bearer ${SSE_TOKEN}`, Accept: "text/event-stream" },
    });
    assert.equal(rejected.status, 503);
    const body = (await rejected.json()) as { error?: string };
    assert.match(body.error ?? "", /capacity/i);

    first.close();
    second.close();
  });

  test("closes SSE sessions that stay idle", async () => {
    const port = await findAvailablePort(4510);
    startSseServer({ SESSION_TIMEOUT_SECONDS: "2" }, port);
    await waitForHealth(port);

    const connection = openSseConnection(port);
    assert.ok(
      await waitFor(() => connection.statusCode === 200, 5000),
      "expected the SSE connection to be accepted"
    );

    const closedByIdleTimeout = await Promise.race([
      connection.ended.then(() => true),
      new Promise<boolean>(resolve => setTimeout(() => resolve(false), 12000)),
    ]);

    assert.equal(closedByIdleTimeout, true, "idle SSE session should be closed by the server");
    connection.close();
  });
});
