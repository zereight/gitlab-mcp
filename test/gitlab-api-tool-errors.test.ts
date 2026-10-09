import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, test, type TestContext } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";

const MASKED_IP = "10.20.30.40";

async function startServer(t: TestContext) {
  const api = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");

    if (req.url === "/api/v4/namespaces/missing") {
      res.statusCode = 404;
      res.end(JSON.stringify({ message: "Namespace not found", host: MASKED_IP }));
      return;
    }

    if (req.url === "/api/v4/groups/10/members") {
      res.statusCode = 403;
      res.end(JSON.stringify({ message: "Forbidden" }));
      return;
    }

    if (req.method === "POST" && req.url === "/api/v4/projects/123/merge_requests") {
      res.statusCode = 400;
      res.end(JSON.stringify({ message: "Invalid merge request" }));
      return;
    }

    if (req.url === "/api/v4/namespaces/core/exists") {
      res.end(JSON.stringify({ exists: true, suggests: [] }));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ message: "Not found" }));
  });

  await new Promise<void>((resolve, reject) => {
    api.once("error", reject);
    api.listen(0, "127.0.0.1", resolve);
  });

  const apiUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}/api/v4`;
  const client = new Client({ name: "gitlab-api-tool-error-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["build/index.js"],
    stderr: "pipe",
    env: {
      ...getDefaultEnvironment(),
      GITLAB_PERSONAL_ACCESS_TOKEN: "test-token",
      GITLAB_API_URL: apiUrl,
      GITLAB_PERMISSION_MODE: "modify",
      GITLAB_TOOLSETS: "projects,merge_requests",
      GITLAB_MASKING_ENABLED: "true",
      GITLAB_DISABLE_VERSION_CHECK: "true",
      LOG_LEVEL: "error",
    },
  });
  transport.stderr?.on("data", () => undefined);

  t.after(async () => {
    try {
      await client.close();
    } finally {
      api.closeAllConnections();
      await new Promise<void>(resolve => api.close(() => resolve()));
    }
  });

  await client.connect(transport);

  return client;
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

describe("GitLab API tool errors", () => {
  test("returns HTTP failures as tool errors and keeps the MCP connection usable", async t => {
    const client = await startServer(t);

    const notFound = await client.callTool({
      name: "get_namespace",
      arguments: { namespace_id: "missing" },
    });
    assert.equal(notFound.isError, true);
    assert.match(resultText(notFound), /GitLab API error: 404 Not Found/);
    assert.doesNotMatch(resultText(notFound), new RegExp(MASKED_IP.replaceAll(".", "\\.")));
    assert.match(resultText(notFound), /\[IP address\]/);

    const forbidden = await client.callTool({
      name: "list_group_members",
      arguments: { group_id: "10" },
    });
    assert.equal(forbidden.isError, true);
    assert.match(resultText(forbidden), /GitLab API error: 403 Forbidden/);

    const invalidMergeRequest = await client.callTool({
      name: "create_merge_request",
      arguments: {
        project_id: "123",
        title: "Test MR",
        source_branch: "feature",
        target_branch: "main",
      },
    });
    assert.equal(invalidMergeRequest.isError, true);
    assert.match(resultText(invalidMergeRequest), /Invalid request/);

    const recovery = await client.callTool({
      name: "verify_namespace",
      arguments: { path: "core" },
    });
    assert.notEqual(recovery.isError, true);
    assert.deepEqual(JSON.parse(resultText(recovery)), { exists: true, suggests: [] });
  });

  test("returns missing merge request identifiers as a tool error", async t => {
    const client = await startServer(t);

    const invalidMergeRequest = await client.callTool({
      name: "get_merge_request",
      arguments: { project_id: "123", mergeRequestIid: 7102 },
    });
    assert.equal(invalidMergeRequest.isError, true);
    assert.match(
      resultText(invalidMergeRequest),
      /Either merge_request_iid or source_branch must be provided/
    );

    const recovery = await client.callTool({
      name: "verify_namespace",
      arguments: { path: "core" },
    });
    assert.notEqual(recovery.isError, true);
    assert.deepEqual(JSON.parse(resultText(recovery)), { exists: true, suggests: [] });
  });
});
