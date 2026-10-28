import assert from "node:assert/strict";
import { afterEach, describe, it, test } from "node:test";
import {
  cleanupServers,
  findAvailablePort,
  launchServer,
  ServerInstance,
  TransportMode,
} from "./utils/server-launcher.js";

const HOST = process.env.HOST || "127.0.0.1";
const GITLAB_NOTE_CHARACTER_LIMIT = 1_000_000;
const TWENTY_KIB = 20 * 1024;
const PARSE_ERROR_LEAK_PROBE = "approval_password_leak_probe_948";

const servers: ServerInstance[] = [];

function noteRequest(bodyLength: number): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "create_merge_request_note",
      arguments: {
        project_id: "group/project",
        merge_request_iid: 1,
        body: "a".repeat(bodyLength),
      },
    },
  });
}

function noteRequestWithEncodedLength(encodedLength: number): string {
  const emptyRequest = noteRequest(0);
  const fixedLength = Buffer.byteLength(emptyRequest);

  assert.ok(encodedLength >= fixedLength);
  const request = noteRequest(encodedLength - fixedLength);
  assert.equal(Buffer.byteLength(request), encodedLength);
  return request;
}

async function startServer(basePort: number, env: Record<string, string> = {}): Promise<string> {
  const port = await findAvailablePort(basePort);
  const server = await launchServer({
    mode: TransportMode.STREAMABLE_HTTP,
    port,
    env: {
      GITLAB_API_URL: "https://gitlab.example.com/api/v4",
      REMOTE_AUTHORIZATION: "true",
      ...env,
    },
  });
  servers.push(server);
  return `http://${HOST}:${port}/mcp`;
}

async function postNoteRequest(mcpUrl: string, body: string): Promise<Response> {
  return fetch(mcpUrl, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    },
    body,
  });
}

function captureStderr(child: { stderr: NodeJS.ReadableStream | null }): () => string {
  let output = "";
  child.stderr?.on("data", chunk => {
    output += chunk.toString();
  });
  return () => output;
}

async function waitFor(predicate: () => boolean, timeoutMs = 3000, stepMs = 50): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise(resolve => setTimeout(resolve, stepMs));
  }
  return predicate();
}

function lastLaunchedServer(): ServerInstance {
  const server = servers.at(-1);
  if (server === undefined) {
    throw new Error("expected a launched server");
  }
  return server;
}

afterEach(() => {
  cleanupServers(servers);
  servers.length = 0;
});

describe("Streamable HTTP request body limit", () => {
  test("parses a note at GitLab's character limit by default", async () => {
    const mcpUrl = await startServer(4590);
    const response = await postNoteRequest(mcpUrl, noteRequest(GITLAB_NOTE_CHARACTER_LIMIT));

    assert.equal(response.status, 401);
  });

  test("honors a configured request body limit", async () => {
    const mcpUrl = await startServer(4600, { GITLAB_MCP_REQUEST_BODY_LIMIT: "20kb" });

    const accepted = await postNoteRequest(mcpUrl, noteRequestWithEncodedLength(TWENTY_KIB));
    assert.equal(accepted.status, 401);

    const rejected = await postNoteRequest(mcpUrl, noteRequestWithEncodedLength(TWENTY_KIB + 1));
    assert.equal(rejected.status, 413);

    const unrelatedRoute = await postNoteRequest(
      mcpUrl.replace(/\/mcp$/, "/health"),
      noteRequestWithEncodedLength(TWENTY_KIB + 1)
    );
    assert.equal(unrelatedRoute.status, 404);
  });

  test("rate-limits an oversized request before parsing it", async () => {
    const mcpUrl = await startServer(4610, {
      GITLAB_MCP_REQUEST_BODY_LIMIT: "20kb",
      MAX_REQUESTS_PER_MINUTE: "1",
    });

    const first = await postNoteRequest(mcpUrl, noteRequest(1));
    assert.equal(first.status, 401);

    const rateLimited = await postNoteRequest(mcpUrl, noteRequestWithEncodedLength(TWENTY_KIB + 1));
    assert.equal(rateLimited.status, 429);
  });
});

describe("When posting broken JSON to /mcp", () => {
  describe("with a secret field in the raw body", () => {
    it("should return a JSON-RPC parse error without logging the body", async () => {
      const mcpUrl = await startServer(4620, { LOG_FORMAT: "json" });
      const stderr = captureStderr(lastLaunchedServer().process);
      const brokenBody = `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"arguments":{"approval_password":"${PARSE_ERROR_LEAK_PROBE}"}`;

      const response = await postNoteRequest(mcpUrl, brokenBody);
      const payload: unknown = await response.json();

      assert.equal(response.status, 400);
      assert.deepEqual(payload, {
        jsonrpc: "2.0",
        error: { code: -32700, message: "Parse error" },
        id: null,
      });
      assert.equal(await waitFor(() => stderr().includes("HTTP request error")), true);
      assert.equal(stderr().includes(PARSE_ERROR_LEAK_PROBE), false);
      assert.equal(stderr().includes("entity.parse.failed"), true);
    });
  });
});
