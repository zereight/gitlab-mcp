import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { afterEach, describe, test } from "node:test";
import * as path from "node:path";
import { findAvailablePort } from "./utils/server-launcher.js";

const LOOPBACK = "127.0.0.1";
const SSE_TOKEN = "mcp_sse_secret";
const SERVER_PATH = path.resolve(process.cwd(), "build/index.js");
// Keeps connection churn from tripping the per-IP creation limit in tests that
// are not about rate limiting.
const UNTHROTTLED = "1000";

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
  readonly streamText: () => string;
  close: () => void;
  ended: Promise<void>;
}

function openSseConnection(port: number): OpenSseConnection {
  let statusCode: number | undefined;
  let text = "";
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
      response.on("data", chunk => {
        text += chunk.toString();
      });
      response.on("end", () => resolveEnded());
      response.on("close", () => resolveEnded());
    }
  );

  request.on("error", () => resolveEnded());

  return {
    get statusCode() {
      return statusCode;
    },
    streamText: () => text,
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

/** Resolves true when the server ends the stream within the window. */
async function endedWithin(connection: OpenSseConnection, ms: number): Promise<boolean> {
  return Promise.race([
    connection.ended.then(() => true),
    new Promise<boolean>(resolve => setTimeout(() => resolve(false), ms)),
  ]);
}

/** Reads the session id the transport advertises in its opening `endpoint` event. */
async function readSessionId(connection: OpenSseConnection, timeoutMs = 5000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = /data: \/messages\?sessionId=([^\s]+)/.exec(connection.streamText());
    if (match) return match[1];
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`SSE stream did not advertise a session id: ${connection.streamText()}`);
}

async function postSseMessage(port: number, sessionId: string, body: unknown): Promise<number> {
  const response = await fetch(`http://${LOOPBACK}:${port}/messages?sessionId=${sessionId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SSE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await response.arrayBuffer();
  return response.status;
}

async function getSseStatus(port: number): Promise<number> {
  const response = await fetch(`http://${LOOPBACK}:${port}/sse`, {
    headers: { Authorization: `Bearer ${SSE_TOKEN}`, Accept: "text/event-stream" },
  });
  await response.arrayBuffer();
  return response.status;
}

/**
 * Connection attempts are rate-limited per IP, so a capacity slot released
 * asynchronously has to be polled for instead of raced with a single request.
 */
async function waitForAcceptedConnection(
  port: number,
  timeoutMs = 5000
): Promise<OpenSseConnection> {
  const deadline = Date.now() + timeoutMs;
  let connection = openSseConnection(port);
  for (;;) {
    await waitFor(() => connection.statusCode !== undefined, 2000, 25);
    if (connection.statusCode === 200) return connection;
    connection.close();
    if (Date.now() >= deadline) return connection;
    await new Promise(resolve => setTimeout(resolve, 100));
    connection = openSseConnection(port);
  }
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
    startSseServer({ MAX_SESSIONS: "2", MAX_REQUESTS_PER_MINUTE: UNTHROTTLED }, port);
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

  test("frees the capacity slot when a client closes the stream", async () => {
    const port = await findAvailablePort(4510);
    startSseServer({ MAX_SESSIONS: "2", MAX_REQUESTS_PER_MINUTE: UNTHROTTLED }, port);
    await waitForHealth(port);

    const first = openSseConnection(port);
    const second = openSseConnection(port);
    assert.ok(
      await waitFor(() => first.statusCode === 200 && second.statusCode === 200, 5000),
      "expected the first two SSE connections to be accepted"
    );
    assert.equal(await getSseStatus(port), 503, "expected the server to be at capacity");

    first.close();

    // SESSION_TIMEOUT_SECONDS is left at its 3600s default, so the slot can
    // only come back through the response "close" handler - not the idle sweep.
    const reclaimed = await waitForAcceptedConnection(port);
    assert.equal(
      reclaimed.statusCode,
      200,
      "closing a client connection should free its capacity slot"
    );

    reclaimed.close();
    second.close();
  });

  test("rate-limits SSE connection creation per client IP", async () => {
    const port = await findAvailablePort(4520);
    startSseServer({ MAX_REQUESTS_PER_MINUTE: "2" }, port);
    await waitForHealth(port);

    const first = openSseConnection(port);
    const second = openSseConnection(port);
    assert.ok(
      await waitFor(() => first.statusCode === 200 && second.statusCode === 200, 5000),
      "expected the first two SSE connections to be accepted"
    );

    const rejected = await fetch(`http://${LOOPBACK}:${port}/sse`, {
      headers: { Authorization: `Bearer ${SSE_TOKEN}`, Accept: "text/event-stream" },
    });
    assert.equal(rejected.status, 429);
    const body = (await rejected.json()) as { error?: string; message?: string };
    assert.equal(body.error, "Rate limit exceeded");
    assert.match(body.message ?? "", /per minute/i);

    first.close();
    second.close();
  });

  test("closes SSE sessions that stay idle", async () => {
    const port = await findAvailablePort(4530);
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

  test("POST /messages keeps an SSE session alive past the idle timeout", async () => {
    const port = await findAvailablePort(4540);
    startSseServer({ SESSION_TIMEOUT_SECONDS: "2" }, port);
    await waitForHealth(port);

    const connection = openSseConnection(port);
    assert.ok(
      await waitFor(() => connection.statusCode === 200, 5000),
      "expected the SSE connection to be accepted"
    );
    const sessionId = await readSessionId(connection);

    // Ping across several idle windows; every POST /messages must reset activity.
    const pingStatuses: number[] = [];
    const keepAlive = setInterval(() => {
      void postSseMessage(port, sessionId, { jsonrpc: "2.0", id: 1, method: "ping" })
        .then(status => pingStatuses.push(status))
        .catch(() => undefined);
    }, 400);

    try {
      await new Promise(resolve => setTimeout(resolve, 6000));
    } finally {
      clearInterval(keepAlive);
    }

    assert.ok(
      pingStatuses.length >= 8,
      `expected keep-alive pings to be sent, saw ${pingStatuses.length}`
    );
    assert.ok(
      pingStatuses.every(status => status === 202),
      `expected every ping to be accepted, saw ${JSON.stringify(pingStatuses)}`
    );
    assert.match(connection.streamText(), /"result"/, "expected a ping response on the stream");
    assert.equal(
      await endedWithin(connection, 300),
      false,
      "POST /messages activity should keep the SSE session open"
    );

    assert.equal(
      await endedWithin(connection, 8000),
      true,
      "the session should close once POST /messages activity stops"
    );
    connection.close();
  });

  test("treats inherited object keys as unknown SSE sessions", async () => {
    const port = await findAvailablePort(4560);
    startSseServer({}, port);
    await waitForHealth(port);

    const response = await fetch(`http://${LOOPBACK}:${port}/messages?sessionId=constructor`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SSE_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
      signal: AbortSignal.timeout(3000),
    });

    assert.equal(response.status, 400);
    assert.match(await response.text(), /No transport found/);
  });

  test("reports degraded health while SSE capacity is exhausted", async () => {
    const port = await findAvailablePort(4550);
    startSseServer({ MAX_SESSIONS: "1" }, port);
    await waitForHealth(port);

    const connection = openSseConnection(port);
    assert.ok(
      await waitFor(() => connection.statusCode === 200, 5000),
      "expected the SSE connection to be accepted"
    );

    const degraded = await fetch(`http://${LOOPBACK}:${port}/health`);
    const body = (await degraded.json()) as {
      status?: string;
      activeSessions?: number;
      maxSessions?: number;
    };

    assert.equal(degraded.status, 503);
    assert.equal(body.status, "degraded");
    assert.equal(body.activeSessions, 1);
    assert.equal(body.maxSessions, 1);

    connection.close();
  });
});
