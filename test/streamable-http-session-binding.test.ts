/**
 * Stateful Streamable HTTP sessions in MCP OAuth mode belong to the GitLab user
 * whose credential opened them, and session ids stay out of the logs.
 */

import { after, before, describe, test } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import http from "node:http";
import * as path from "node:path";
import {
  cleanupServers,
  findAvailablePort,
  HOST,
  launchServer,
  ServerInstance,
  TransportMode,
} from "./utils/server-launcher.js";
import { findMockServerPort, MockGitLabServer } from "./utils/mock-gitlab-server.js";

const TOKEN_A = "oauth-binding-owner-a-0123456789";
const TOKEN_A_REFRESHED = "oauth-binding-owner-a-refreshed-0123";
const TOKEN_B = "oauth-binding-owner-b-0123456789";
const PAT_A = "glpat-binding-owner-a-0123456789";
const PAT_A_ROTATED = "glpat-binding-owner-a-rotated-0123";
const PAT_B = "glpat-binding-owner-b-0123456789";

// GitLab user id behind each credential
const OWNERS: Record<string, number> = {
  [TOKEN_A]: 1,
  [TOKEN_A_REFRESHED]: 1,
  [TOKEN_B]: 2,
  [PAT_A]: 1,
  [PAT_A_ROTATED]: 1,
  [PAT_B]: 2,
};

interface PostResult {
  status: number;
  sid: string | null;
  text: string;
}

async function post(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string>
): Promise<PostResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: "2.0", ...body }),
  });
  const text = (await res.text()).slice(0, 200);
  return { status: res.status, sid: res.headers.get("mcp-session-id"), text };
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function initSession(url: string, headers: Record<string, string>): Promise<string> {
  const res = await post(
    url,
    {
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "session-binding-test", version: "1.0.0" },
      },
    },
    headers
  );
  assert.strictEqual(res.status, 200, res.text);
  assert.ok(res.sid, "initialize must return an Mcp-Session-Id");
  const initialized = await post(
    url,
    { method: "notifications/initialized" },
    { ...headers, "mcp-session-id": res.sid }
  );
  assert.strictEqual(initialized.status, 202, initialized.text);
  return res.sid;
}

function listTools(url: string, headers: Record<string, string>): Promise<PostResult> {
  return post(url, { id: 2, method: "tools/list" }, headers);
}

/** Opens GET /mcp, returns the status and closes the stream right away. */
async function openStream(url: string, headers: Record<string, string>): Promise<number> {
  const controller = new AbortController();
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "text/event-stream", ...headers },
      signal: controller.signal,
    });
    return res.status;
  } finally {
    controller.abort();
    // Let the server see the closed stream before the next GET on this session.
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

async function deleteSession(url: string, headers: Record<string, string>): Promise<number> {
  const res = await fetch(url, { method: "DELETE", headers });
  await res.text();
  return res.status;
}

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return predicate();
}

function captureStderr(child: { stderr: NodeJS.ReadableStream | null }): () => string {
  let output = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  return () => output;
}

/** Waits for a log line, then checks that only the short id form was logged. */
async function assertSessionIdsRedacted(
  stderr: () => string,
  marker: string,
  sids: string[]
): Promise<void> {
  assert.ok(await waitFor(() => stderr().includes(marker)), `expected a "${marker}" log line`);
  // Give the buffered logger a flush interval for lines written next to the marker.
  await new Promise(resolve => setTimeout(resolve, 300));
  for (const sid of sids) {
    assert.ok(!stderr().includes(sid), `full session id ${sid.slice(0, 8)}… must not be logged`);
    assert.ok(stderr().includes(sid.slice(0, 8)), "the short session id form should be logged");
  }
}

function addOwnerAwareGitLab(mockGitLab: MockGitLabServer): void {
  mockGitLab.addRootHandler("get", "/oauth/token/info", (req, res) => {
    const token = (req.headers["authorization"] as string | undefined)?.replace(/^Bearer\s+/i, "");
    const owner = token ? OWNERS[token] : undefined;
    if (owner === undefined || token?.startsWith("glpat-")) {
      res.status(401).json({ error: "invalid_token" });
      return;
    }
    res.json({
      resource_owner_id: owner,
      scopes: ["api"],
      expires_in_seconds: 7200,
      application: { uid: "session-binding-app" },
      created_at: Math.floor(Date.now() / 1000),
    });
  });
  mockGitLab.addMockHandler("get", "/user", (req, res) => {
    const token = (req as { gitlabToken?: string }).gitlabToken ?? "";
    res.json({ id: OWNERS[token] ?? 1, username: `user_${OWNERS[token] ?? 1}`, state: "active" });
  });
}

describe("Streamable HTTP sessions in MCP OAuth mode", () => {
  let mockGitLab: MockGitLabServer;
  const servers: ServerInstance[] = [];
  let mcpUrl = "";
  let stderr: () => string = () => "";

  before(async () => {
    mockGitLab = new MockGitLabServer({
      port: await findMockServerPort(),
      validTokens: Object.keys(OWNERS),
    });
    await mockGitLab.start();
    addOwnerAwareGitLab(mockGitLab);

    const port = await findAvailablePort(3860);
    const baseUrl = `http://${HOST}:${port}`;
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port,
      timeout: 10_000,
      env: {
        STREAMABLE_HTTP: "true",
        GITLAB_MCP_OAUTH: "true",
        GITLAB_OAUTH_APP_ID: "session-binding-app-id",
        GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
        MCP_SERVER_URL: baseUrl,
        MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL: "true",
        LOG_LEVEL: "debug",
      },
    });
    servers.push(server);
    stderr = captureStderr(server.process);
    mcpUrl = `${baseUrl}/mcp`;
  });

  after(async () => {
    cleanupServers(servers);
    await mockGitLab?.stop();
  });

  test("a POST with another user's token is rejected and the session keeps working", async () => {
    const sid = await initSession(mcpUrl, bearer(TOKEN_A));

    const foreign = await listTools(mcpUrl, { ...bearer(TOKEN_B), "mcp-session-id": sid });
    assert.strictEqual(foreign.status, 404, foreign.text);

    const own = await listTools(mcpUrl, { ...bearer(TOKEN_A), "mcp-session-id": sid });
    assert.strictEqual(own.status, 200, own.text);
  });

  test("a DELETE with another user's token is rejected and the session survives", async () => {
    const sid = await initSession(mcpUrl, bearer(TOKEN_A));

    assert.strictEqual(
      await deleteSession(mcpUrl, { ...bearer(TOKEN_B), "mcp-session-id": sid }),
      404
    );

    const own = await listTools(mcpUrl, { ...bearer(TOKEN_A), "mcp-session-id": sid });
    assert.strictEqual(own.status, 200, own.text);
  });

  test("a GET stream with another user's token is rejected", async () => {
    const sid = await initSession(mcpUrl, bearer(TOKEN_A));

    assert.strictEqual(
      await openStream(mcpUrl, { ...bearer(TOKEN_B), "mcp-session-id": sid }),
      404
    );
    assert.strictEqual(
      await openStream(mcpUrl, { ...bearer(TOKEN_A), "mcp-session-id": sid }),
      200
    );

    const own = await listTools(mcpUrl, { ...bearer(TOKEN_A), "mcp-session-id": sid });
    assert.strictEqual(own.status, 200, own.text);
  });

  test("a refreshed token for the same user keeps working", async () => {
    const sid = await initSession(mcpUrl, bearer(TOKEN_A));
    const headers = { ...bearer(TOKEN_A_REFRESHED), "mcp-session-id": sid };

    const refreshed = await listTools(mcpUrl, headers);
    assert.strictEqual(refreshed.status, 200, refreshed.text);
    assert.strictEqual(await openStream(mcpUrl, headers), 200);
    assert.strictEqual(await deleteSession(mcpUrl, headers), 204);
  });

  test("header auth is bound to the session owner too", async () => {
    const bearerSid = await initSession(mcpUrl, bearer(TOKEN_A));
    const foreignPat = await listTools(mcpUrl, {
      "Private-Token": PAT_B,
      "mcp-session-id": bearerSid,
    });
    assert.strictEqual(foreignPat.status, 404, foreignPat.text);
    const ownPat = await listTools(mcpUrl, { "Private-Token": PAT_A, "mcp-session-id": bearerSid });
    assert.strictEqual(ownPat.status, 200, ownPat.text);

    const patSid = await initSession(mcpUrl, { "Private-Token": PAT_A });
    const foreignBearer = await listTools(mcpUrl, { ...bearer(TOKEN_B), "mcp-session-id": patSid });
    assert.strictEqual(foreignBearer.status, 404, foreignBearer.text);
    const rotatedPat = await listTools(mcpUrl, {
      "Private-Token": PAT_A_ROTATED,
      "mcp-session-id": patSid,
    });
    assert.strictEqual(rotatedPat.status, 200, rotatedPat.text);
  });

  test("session ids are not written to the log", async () => {
    const sid = await initSession(mcpUrl, bearer(TOKEN_A));
    const patSid = await initSession(mcpUrl, { "Private-Token": PAT_A });
    assert.strictEqual(
      await deleteSession(mcpUrl, { ...bearer(TOKEN_A), "mcp-session-id": sid }),
      204
    );
    assert.strictEqual(
      await deleteSession(mcpUrl, { "Private-Token": PAT_A, "mcp-session-id": patSid }),
      204
    );

    await assertSessionIdsRedacted(stderr, "cleaned up auth mapping on DELETE", [sid, patSid]);
  });
});

describe("Streamable HTTP sessions with REMOTE_AUTHORIZATION", () => {
  const SESSION_TIMEOUT_SECONDS = 2;
  let mockGitLab: MockGitLabServer;
  const servers: ServerInstance[] = [];
  let mcpUrl = "";
  let stderr: () => string = () => "";

  before(async () => {
    mockGitLab = new MockGitLabServer({
      port: await findMockServerPort(),
      validTokens: [PAT_A, PAT_A_ROTATED],
    });
    await mockGitLab.start();

    const port = await findAvailablePort(3880);
    const server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port,
      timeout: 10_000,
      env: {
        STREAMABLE_HTTP: "true",
        REMOTE_AUTHORIZATION: "true",
        GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
        SESSION_TIMEOUT_SECONDS: String(SESSION_TIMEOUT_SECONDS),
        LOG_LEVEL: "debug",
      },
    });
    servers.push(server);
    stderr = captureStderr(server.process);
    mcpUrl = `http://${HOST}:${port}/mcp`;
  });

  after(async () => {
    cleanupServers(servers);
    await mockGitLab?.stop();
  });

  test("session ids are not written to the log", async () => {
    const closed = await initSession(mcpUrl, { "Private-Token": PAT_A });
    const rotated = await listTools(mcpUrl, {
      "Private-Token": PAT_A_ROTATED,
      "mcp-session-id": closed,
    });
    assert.strictEqual(rotated.status, 200, rotated.text);
    assert.strictEqual(
      await deleteSession(mcpUrl, { "Private-Token": PAT_A_ROTATED, "mcp-session-id": closed }),
      204
    );
    await assertSessionIdsRedacted(stderr, "cleaned up auth mapping on DELETE", [closed]);

    const expired = await initSession(mcpUrl, { "Private-Token": PAT_A });
    await assertSessionIdsRedacted(stderr, "auth token expired after", [expired]);
    await assertSessionIdsRedacted(stderr, "cleaned up auth mapping", [closed, expired]);
  });
});

describe("SSE sessions", () => {
  let child: ReturnType<typeof spawn> | null = null;

  after(() => {
    child?.kill("SIGTERM");
  });

  test("session ids are not written to the log", async () => {
    const port = await findAvailablePort(3900);
    child = spawn("node", [path.resolve(process.cwd(), "build/index.js")], {
      env: {
        ...process.env,
        GITLAB_API_URL: "https://gitlab.example.com/api/v4",
        HOST: "127.0.0.1",
        PORT: String(port),
        SSE: "true",
        STREAMABLE_HTTP: "false",
        REMOTE_AUTHORIZATION: "false",
        GITLAB_MCP_OAUTH: "false",
        GITLAB_USE_OAUTH: "false",
        GITLAB_PERSONAL_ACCESS_TOKEN: "glpat_test",
        SSE_AUTH_TOKEN: "sse-binding-test-secret",
        SESSION_TIMEOUT_SECONDS: "1",
        LOG_LEVEL: "debug",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stderr = captureStderr(child);
    assert.ok(await waitFor(() => stderr().includes("GitLab MCP Server running"), 10_000));

    let stream = "";
    const request = http.get(
      {
        host: "127.0.0.1",
        port,
        path: "/sse",
        headers: { Authorization: "Bearer sse-binding-test-secret", Accept: "text/event-stream" },
      },
      response => response.on("data", chunk => (stream += chunk.toString()))
    );
    request.on("error", () => {});
    try {
      assert.ok(await waitFor(() => /sessionId=[^\s]+/.test(stream)), stream);
      const sid = /sessionId=([^\s]+)/.exec(stream)?.[1] ?? "";
      assert.ok(sid);
      await assertSessionIdsRedacted(stderr, "closed after", [sid]);
    } finally {
      request.destroy();
    }
  });
});
