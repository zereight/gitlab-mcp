import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { afterEach, describe, test } from "node:test";
import * as path from "node:path";
import { findAvailablePort } from "./utils/server-launcher.js";

// Streamable HTTP with a server-side token (no REMOTE_AUTHORIZATION, no GITLAB_MCP_OAUTH):
// sessions must expire after SESSION_TIMEOUT_SECONDS of inactivity so that clients which
// disconnect without DELETE /mcp do not exhaust MAX_SESSIONS (#975).

const HOST = process.env.HOST || "127.0.0.1";
const SERVER_PATH = path.resolve(process.cwd(), "build/index.js");
const MCP_TOKEN = "mcp_static_secret";
const TIMEOUT_SECONDS = 2;

const running = new Set<ReturnType<typeof spawn>>();

function startServer(port: number) {
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
      GITLAB_PERSONAL_ACCESS_TOKEN: "glpat_test",
      GITLAB_JOB_TOKEN: "",
      GITLAB_AUTH_COOKIE_PATH: "",
      MCP_SERVER_URL: "",
      GITLAB_OAUTH_APP_ID: "",
      STREAMABLE_HTTP_AUTH_TOKEN: MCP_TOKEN,
      SESSION_TIMEOUT_SECONDS: String(TIMEOUT_SECONDS),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = { text: "" };
  child.stdout?.on("data", chunk => (output.text += chunk.toString()));
  child.stderr?.on("data", chunk => (output.text += chunk.toString()));
  running.add(child);
  child.once("exit", () => running.delete(child));
  return output;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function waitForHealth(port: number, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://${HOST}:${port}/health`);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await sleep(100);
  }
  throw new Error("server did not become healthy");
}

async function post(port: number, body: unknown, sessionId?: string) {
  const response = await fetch(`http://${HOST}:${port}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${MCP_TOKEN}`,
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify(body),
  });
  await response.text();
  return response;
}

async function initialize(port: number): Promise<string> {
  const response = await post(port, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "static-session-expiry-test", version: "1.0.0" },
    },
  });
  assert.equal(response.status, 200);
  const sessionId = response.headers.get("mcp-session-id");
  assert.ok(sessionId, "initialize must return Mcp-Session-Id");
  const initialized = await post(
    port,
    { jsonrpc: "2.0", method: "notifications/initialized" },
    sessionId
  );
  assert.equal(initialized.status, 202);
  return sessionId;
}

const ping = (port: number, sessionId: string) =>
  post(port, { jsonrpc: "2.0", id: 2, method: "ping" }, sessionId);

async function metrics(port: number) {
  const response = await fetch(`http://${HOST}:${port}/metrics.json`);
  return (await response.json()) as { activeSessions: number; expiredSessions: number };
}

// Poll until the server reports `expired` expired sessions, instead of sleeping a fixed time.
async function waitForExpired(port: number, expired: number, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await metrics(port)).expiredSessions >= expired) return;
    await sleep(200);
  }
  assert.fail(`expected ${expired} expired session(s) within ${timeoutMs}ms`);
}

function openStream(port: number, sessionId: string, signal: AbortSignal) {
  return fetch(`http://${HOST}:${port}/mcp`, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${MCP_TOKEN}`,
      "Mcp-Session-Id": sessionId,
    },
    signal,
  });
}

afterEach(async () => {
  const children = [...running];
  running.clear();
  await Promise.all(
    children.map(async child => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = once(child, "exit");
      child.kill("SIGTERM");
      await exited;
    })
  );
});

describe("Streamable HTTP server-token mode session expiry", { timeout: 60_000 }, () => {
  test("releases an idle session, keeps a busy one, and lets the client re-initialize", async () => {
    const port = await findAvailablePort(4340);
    const output = startServer(port);
    await waitForHealth(port);

    const idle = await initialize(port);
    const busy = await initialize(port);
    assert.equal((await metrics(port)).activeSessions, 2);

    // Keep `busy` active while `idle` sends nothing, until `idle` has expired.
    const deadline = Date.now() + 10_000;
    while ((await metrics(port)).expiredSessions < 1) {
      assert.ok(Date.now() < deadline, "idle session did not expire");
      assert.equal((await ping(port, busy)).status, 200);
      await sleep(500);
    }

    assert.equal((await ping(port, idle)).status, 404, "expired session must answer 404");
    assert.equal((await ping(port, busy)).status, 200, "active session must be kept");

    const snapshot = await metrics(port);
    assert.equal(snapshot.activeSessions, 1);
    assert.equal(snapshot.expiredSessions, 1);
    // The logger writes asynchronously; give the expiry line a moment to arrive.
    const logLine = new RegExp(`closed after ${TIMEOUT_SECONDS}s of inactivity`);
    for (let i = 0; i < 25 && !logLine.test(output.text); i++) await sleep(200);
    assert.match(output.text, logLine);

    // The client recovers by initializing a new session.
    const fresh = await initialize(port);
    assert.notEqual(fresh, idle);
    assert.equal((await ping(port, fresh)).status, 200);
  });

  test("an open GET stream pauses expiry until the session goes idle again", async () => {
    const port = await findAvailablePort(4350);
    startServer(port);
    await waitForHealth(port);

    const sessionId = await initialize(port);
    const abort = new AbortController();
    const stream = await openStream(port, sessionId, abort.signal);
    assert.equal(stream.status, 200);

    // No POST traffic for twice the timeout: the open stream keeps the session.
    await sleep(TIMEOUT_SECONDS * 2 * 1000);
    let snapshot = await metrics(port);
    assert.equal(snapshot.activeSessions, 1);
    assert.equal(snapshot.expiredSessions, 0);

    // Close the stream; with no further activity the session expires.
    abort.abort();
    await waitForExpired(port, 1);
    assert.equal((await ping(port, sessionId)).status, 404);
    snapshot = await metrics(port);
    assert.equal(snapshot.activeSessions, 0);
  });

  test("a POST sent while a GET stream is open re-arms expiry, as in the auth modes", async () => {
    const port = await findAvailablePort(4355);
    startServer(port);
    await waitForHealth(port);

    const sessionId = await initialize(port);
    const abort = new AbortController();
    const stream = await openStream(port, sessionId, abort.signal);
    assert.equal(stream.status, 200);

    // The last POST starts the inactivity window even while the stream stays open, so a
    // client whose connection silently died cannot hold its slot forever.
    assert.equal((await ping(port, sessionId)).status, 200);
    await waitForExpired(port, 1);
    assert.equal((await ping(port, sessionId)).status, 404);
    assert.equal((await metrics(port)).activeSessions, 0);
    abort.abort();
  });

  test("DELETE /mcp releases the session without a later expiry", async () => {
    const port = await findAvailablePort(4360);
    startServer(port);
    await waitForHealth(port);

    const sessionId = await initialize(port);
    const response = await fetch(`http://${HOST}:${port}/mcp`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${MCP_TOKEN}`, "Mcp-Session-Id": sessionId },
    });
    assert.equal(response.status, 204);

    await sleep(TIMEOUT_SECONDS * 2 * 1000);
    const snapshot = await metrics(port);
    assert.equal(snapshot.activeSessions, 0);
    assert.equal(snapshot.expiredSessions, 0, "a deleted session must not be counted as expired");
  });
});
