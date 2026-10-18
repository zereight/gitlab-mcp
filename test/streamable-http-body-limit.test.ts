import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
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
  });
});
