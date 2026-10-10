import assert from "node:assert/strict";
import http from "node:http";
import { describe, test, type TestContext } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";

const ALLOWED_PROJECT_ID = "123";
const DENIED_PROJECT_ID = "999";
const DENIED_MESSAGE = `Access denied: Project ${DENIED_PROJECT_ID} is not in the allowed project list: ${ALLOWED_PROJECT_ID}`;

interface AllowlistServer {
  client: Client;
  requests: string[];
  readStderr: () => string;
}

function boundPort(server: http.Server): number {
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("mock GitLab server did not bind to a TCP port");
  }
  return address.port;
}

function requestPath(url: string): string {
  const queryIndex = url.indexOf("?");
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}

function resultText(result: Awaited<ReturnType<Client["callTool"]>>): string {
  assert.ok("content" in result && Array.isArray(result.content), "expected tool content");
  const block = result.content.find(
    (item: unknown): item is { type: "text"; text: string } =>
      typeof item === "object" &&
      item !== null &&
      "type" in item &&
      item.type === "text" &&
      "text" in item &&
      typeof item.text === "string"
  );
  assert.ok(block, "expected a text tool result");
  return block.text;
}

function projectIdFrom(text: string): number {
  const parsed: unknown = JSON.parse(text);
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    !("id" in parsed) ||
    typeof parsed.id !== "number"
  ) {
    throw new Error("expected a project payload with a numeric id");
  }
  return parsed.id;
}

function loggedToolError(stderr: string): string | undefined {
  for (const line of stderr.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) {
      continue;
    }
    let entry: unknown;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (
      entry !== null &&
      typeof entry === "object" &&
      "msg" in entry &&
      typeof entry.msg === "string" &&
      entry.msg.startsWith("tool_call_error:") &&
      "error" in entry &&
      typeof entry.error === "string"
    ) {
      return entry.error;
    }
  }
  return undefined;
}

async function startAllowlistServer(t: TestContext): Promise<AllowlistServer> {
  const requests: string[] = [];
  const api = http.createServer((req, res) => {
    const path = requestPath(req.url ?? "");
    requests.push(path);
    res.setHeader("Content-Type", "application/json");
    if (req.method === "GET" && path === `/api/v4/projects/${ALLOWED_PROJECT_ID}`) {
      res.end(JSON.stringify({ id: Number(ALLOWED_PROJECT_ID), name: "Allowed" }));
      return;
    }
    res.statusCode = 500;
    res.end(JSON.stringify({ message: "unexpected GitLab request" }));
  });

  await new Promise<void>((resolve, reject) => {
    api.once("error", reject);
    api.listen(0, "127.0.0.1", () => resolve());
  });

  const stderrChunks: Buffer[] = [];
  const client = new Client({ name: "allowed-project-access-denied-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["build/index.js"],
    stderr: "pipe",
    env: {
      ...getDefaultEnvironment(),
      GITLAB_PERSONAL_ACCESS_TOKEN: "test-token",
      GITLAB_API_URL: `http://127.0.0.1:${boundPort(api)}/api/v4`,
      GITLAB_ALLOWED_PROJECT_IDS: ALLOWED_PROJECT_ID,
      GITLAB_TOOLSETS: "projects",
      GITLAB_MASKING_ENABLED: "true",
      GITLAB_DISABLE_VERSION_CHECK: "true",
      LOG_LEVEL: "error",
      LOG_FORMAT: "json",
    },
  });
  transport.stderr?.on("data", (chunk: Buffer) => {
    stderrChunks.push(chunk);
  });

  t.after(async () => {
    try {
      await client.close();
    } finally {
      api.closeAllConnections();
      await new Promise<void>(resolve => api.close(() => resolve()));
    }
  });

  await client.connect(transport);

  return {
    client,
    requests,
    readStderr: () => Buffer.concat(stderrChunks).toString("utf8"),
  };
}

function deniedProjectWasRequested(requests: string[]): boolean {
  return requests.some(path => path.includes(`/projects/${DENIED_PROJECT_ID}`));
}

describe("When GITLAB_ALLOWED_PROJECT_IDS is set", () => {
  describe("with get_project for a project outside the allowlist", () => {
    test("should return an isError result and not call GitLab", async t => {
      const server = await startAllowlistServer(t);

      const denied = await server.client.callTool({
        name: "get_project",
        arguments: { project_id: DENIED_PROJECT_ID },
      });

      assert.equal(denied.isError, true);
      assert.equal(resultText(denied), DENIED_MESSAGE);
      assert.equal(deniedProjectWasRequested(server.requests), false);
      assert.equal(loggedToolError(server.readStderr()), DENIED_MESSAGE);
    });
  });

  describe("with get_project for an allowed project", () => {
    test("should return the project from GitLab", async t => {
      const server = await startAllowlistServer(t);

      const allowed = await server.client.callTool({
        name: "get_project",
        arguments: { project_id: ALLOWED_PROJECT_ID },
      });

      assert.notEqual(allowed.isError, true);
      assert.equal(projectIdFrom(resultText(allowed)), Number(ALLOWED_PROJECT_ID));
      assert.ok(server.requests.includes(`/api/v4/projects/${ALLOWED_PROJECT_ID}`));
    });
  });
});
