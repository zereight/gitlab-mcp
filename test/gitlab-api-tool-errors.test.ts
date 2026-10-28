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
const MASKED_TOKEN = `glpat-${"x".repeat(24)}`;
const EXISTING_USER = {
  id: "7",
  username: "existing",
  name: "Existing User",
  avatar_url: null,
  web_url: "https://gitlab.example/existing",
};

interface ServerOptions {
  onStderr?: (text: string) => void;
  logFormat?: "json";
}

function createTransport(apiUrl: string, options: ServerOptions = {}): StdioClientTransport {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["build/index.js"],
    stderr: "pipe",
    env: {
      ...getDefaultEnvironment(),
      GITLAB_PERSONAL_ACCESS_TOKEN: "test-token",
      GITLAB_API_URL: apiUrl,
      GITLAB_PERMISSION_MODE: "modify",
      GITLAB_TOOLSETS: "projects,merge_requests,api,users",
      GITLAB_TOOLS: "execute_graphql,fork_repository,gitlab_api_request",
      GITLAB_MASKING_ENABLED: "true",
      GITLAB_DISABLE_VERSION_CHECK: "true",
      LOG_LEVEL: "error",
      ...(options.logFormat ? { LOG_FORMAT: options.logFormat } : {}),
    },
  });
  transport.stderr?.on("data", chunk => options.onStderr?.(chunk.toString()));
  return transport;
}

async function reserveClosedPort(): Promise<number> {
  const probe = http.createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const { port } = probe.address() as AddressInfo;
  await new Promise<void>(resolve => probe.close(() => resolve()));
  return port;
}

async function startServer(t: TestContext, options: ServerOptions = {}) {
  const api = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");

    if (req.url === "/api/v4/namespaces/throttled") {
      res.statusCode = 429;
      res.setHeader("Retry-After", "42");
      res.end(JSON.stringify({ message: "429 Too Many Requests" }));
      return;
    }

    if (req.url === "/api/v4/namespaces/throttled-date") {
      res.statusCode = 429;
      res.setHeader("Retry-After", "Wed, 21 Oct 2026 07:28:00 GMT");
      res.end(JSON.stringify({ message: "429 Too Many Requests" }));
      return;
    }

    if (req.url === "/api/v4/namespaces/throttled-masked") {
      res.statusCode = 429;
      res.setHeader("Retry-After", "10.20.30.40");
      res.end(JSON.stringify({ message: "429 Too Many Requests" }));
      return;
    }

    if (req.url === "/api/v4/namespaces/throttled-secret") {
      res.statusCode = 429;
      res.setHeader("Retry-After", "https://user:secret@example.test/wait");
      res.end(JSON.stringify({ message: "429 Too Many Requests" }));
      return;
    }

    if (req.method === "POST" && req.url === "/api/v4/projects/masked/fork") {
      res.statusCode = 429;
      res.setHeader("Retry-After", `${MASKED_TOKEN} ${MASKED_IP}`);
      // Secrets appear only in the header, not in the body or error message.
      res.end(JSON.stringify({ message: "429 Too Many Requests" }));
      return;
    }

    if (req.method === "POST" && req.url === "/api/v4/projects/123/fork") {
      res.statusCode = 429;
      res.setHeader("Retry-After", "42");
      res.end(JSON.stringify({ message: "429 Too Many Requests" }));
      return;
    }

    if (req.url === "/api/v4/users?username=existing") {
      res.end(JSON.stringify([EXISTING_USER]));
      return;
    }

    if (req.url === "/api/v4/users?username=missing") {
      res.end(JSON.stringify([]));
      return;
    }

    if ((req.url ?? "").startsWith("/api/v4/users?username=")) {
      res.statusCode = 429;
      res.setHeader("Retry-After", "42");
      res.end(JSON.stringify({ message: "429 Too Many Requests" }));
      return;
    }

    if (req.method === "POST" && req.url === "/api/graphql") {
      res.statusCode = 429;
      res.setHeader("Retry-After", "42");
      res.end(JSON.stringify({ message: "429 Too Many Requests" }));
      return;
    }

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

    if (req.url === "/api/v4/namespaces/malformed/exists") {
      res.end(JSON.stringify({ exists: true, suggests: "nope" }));
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
  const transport = createTransport(apiUrl, options);

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
    // Every GitLab HTTP error now carries its status as structured content.
    assert.deepEqual((notFound as { structuredContent?: unknown }).structuredContent, {
      status: 404,
    });

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

  test("preserves Retry-After on a GitLab 429 as structured error content", async t => {
    const client = await startServer(t);

    const throttled = await client.callTool({
      name: "get_namespace",
      arguments: { namespace_id: "throttled" },
    });
    assert.equal(throttled.isError, true);
    assert.match(resultText(throttled), /GitLab API error: 429 Too Many Requests/);
    assert.deepEqual((throttled as { structuredContent?: unknown }).structuredContent, {
      status: 429,
      retryAfter: "42",
    });

    // Retry-After may be an HTTP-date; it passes through verbatim.
    const throttledDate = await client.callTool({
      name: "get_namespace",
      arguments: { namespace_id: "throttled-date" },
    });
    assert.equal(throttledDate.isError, true);
    assert.deepEqual((throttledDate as { structuredContent?: unknown }).structuredContent, {
      status: 429,
      retryAfter: "Wed, 21 Oct 2026 07:28:00 GMT",
    });

    const recovery = await client.callTool({
      name: "verify_namespace",
      arguments: { path: "core" },
    });
    assert.notEqual(recovery.isError, true);
  });

  test("masks a Retry-After value that matches a masking rule", async t => {
    const client = await startServer(t);

    const throttled = await client.callTool({
      name: "get_namespace",
      arguments: { namespace_id: "throttled-masked" },
    });
    assert.equal(throttled.isError, true);
    assert.deepEqual((throttled as { structuredContent?: unknown }).structuredContent, {
      status: 429,
      retryAfter: "[IP address]",
    });
  });

  test("redacts URL secrets in a Retry-After value", async t => {
    const client = await startServer(t);

    const throttled = await client.callTool({
      name: "get_namespace",
      arguments: { namespace_id: "throttled-secret" },
    });
    assert.equal(throttled.isError, true);
    const structuredContent = (throttled as { structuredContent?: { retryAfter?: string } })
      .structuredContent;
    assert.equal(structuredContent?.retryAfter, "https://[REDACTED]@example.test/wait");
  });

  test("execute_graphql and fork_repository keep Retry-After on a GitLab 429", async t => {
    const client = await startServer(t);

    const graphql = await client.callTool({
      name: "execute_graphql",
      arguments: { query: "query { currentUser { id } }" },
    });
    assert.equal(graphql.isError, true);
    assert.match(resultText(graphql), /GraphQL request failed: GitLab API error: 429/);
    assert.deepEqual((graphql as { structuredContent?: unknown }).structuredContent, {
      status: 429,
      retryAfter: "42",
    });

    const fork = await client.callTool({
      name: "fork_repository",
      arguments: { project_id: "123" },
    });
    assert.equal(fork.isError, true);
    assert.match(resultText(fork), /Failed to fork repository: GitLab API error: 429/);
    assert.deepEqual((fork as { structuredContent?: unknown }).structuredContent, {
      status: 429,
      retryAfter: "42",
    });
  });

  for (const logFormat of [undefined, "json"] as const) {
    test(`fork errors do not log retry header secrets (${logFormat ?? "pretty"})`, async t => {
      let stderr = "";
      const client = await startServer(t, {
        logFormat,
        onStderr: text => {
          stderr += text;
        },
      });
      const result = await client.callTool({
        name: "fork_repository",
        arguments: { project_id: "masked" },
      });
      assert.equal(result.isError, true);
      assert.deepEqual(result.structuredContent, {
        status: 429,
        retryAfter: "[Token masked] [IP address]",
      });
      // Closing drains the subprocess pipes before inspecting all log output.
      await client.close();
      assert.match(stderr, /Error forking repository/);
      assert.ok(!stderr.includes(MASKED_TOKEN), "retry token leaked to stderr");
      assert.ok(!stderr.includes(MASKED_IP), "retry IP leaked to stderr");
    });
  }

  test("get_users keeps successful users and genuinely missing users", async t => {
    const client = await startServer(t);
    const result = await client.callTool({
      name: "get_users",
      arguments: { usernames: ["existing", "missing"] },
    });
    assert.notEqual(result.isError, true);
    assert.equal(result.structuredContent, undefined);
    assert.deepEqual(JSON.parse(resultText(result)), {
      existing: EXISTING_USER,
      missing: null,
    });
  });

  test("get_users reports a GitLab 429 instead of a silent null user", async t => {
    const client = await startServer(t);

    const throttled = await client.callTool({
      name: "get_users",
      arguments: { usernames: ["existing", "alice"] },
    });
    assert.equal(throttled.isError, true);
    assert.match(resultText(throttled), /GitLab API error: 429 Too Many Requests/);
    assert.deepEqual((throttled as { structuredContent?: unknown }).structuredContent, {
      status: 429,
      retryAfter: "42",
    });
  });

  test("gitlab_api_request preserves Retry-After on a GitLab 429", async t => {
    const client = await startServer(t);

    const throttled = await client.callTool({
      name: "gitlab_api_request",
      arguments: { method: "GET", path: "/namespaces/throttled" },
    });
    assert.equal(throttled.isError, true);
    assert.match(resultText(throttled), /GitLab API error: 429 Too Many Requests/);
    assert.deepEqual((throttled as { structuredContent?: unknown }).structuredContent, {
      status: 429,
      retryAfter: "42",
    });
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
    // A validation error carries no GitLab HTTP fields.
    assert.equal(
      (invalidMergeRequest as { structuredContent?: unknown }).structuredContent,
      undefined
    );

    const recovery = await client.callTool({
      name: "verify_namespace",
      arguments: { path: "core" },
    });
    assert.notEqual(recovery.isError, true);
    assert.deepEqual(JSON.parse(resultText(recovery)), { exists: true, suggests: [] });
  });

  test("returns argument validation failures as a tool error", async t => {
    const client = await startServer(t);

    const invalidArguments = await client.callTool({
      name: "verify_namespace",
      arguments: { parent_id: "abc" },
    });
    assert.equal(invalidArguments.isError, true);
    const text = resultText(invalidArguments);
    assert.match(text, /^Invalid arguments for verify_namespace: path: .+; parent_id: .+$/);

    const recovery = await client.callTool({
      name: "verify_namespace",
      arguments: { path: "core" },
    });
    assert.notEqual(recovery.isError, true);
    assert.deepEqual(JSON.parse(resultText(recovery)), { exists: true, suggests: [] });
  });

  test("does not report a malformed GitLab response as invalid arguments", async t => {
    const client = await startServer(t);

    await assert.rejects(
      client.callTool({ name: "verify_namespace", arguments: { path: "malformed" } }),
      (error: Error) => {
        assert.match(error.message, /Unexpected GitLab response for verify_namespace: suggests: /);
        assert.doesNotMatch(error.message, /Invalid arguments/);
        return true;
      }
    );

    const recovery = await client.callTool({
      name: "verify_namespace",
      arguments: { path: "core" },
    });
    assert.notEqual(recovery.isError, true);
    assert.deepEqual(JSON.parse(resultText(recovery)), { exists: true, suggests: [] });
  });

  test("names the reason when GitLab gives no HTTP response", async t => {
    const port = await reserveClosedPort();
    const client = new Client({ name: "gitlab-api-tool-error-test", version: "1.0.0" });
    t.after(() => client.close());
    await client.connect(createTransport(`http://127.0.0.1:${port}/api/v4`));

    await assert.rejects(
      client.callTool({ name: "verify_namespace", arguments: { path: "core" } }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(
          error.message,
          /GitLab request failed before an HTTP response \(ECONNREFUSED\)/
        );
        assert.match(error.message, /Check the GitLab API URL/);
        assert.doesNotMatch(error.message, /127\.0\.0\.1/);
        assert.doesNotMatch(error.message, /test-token/);
        return true;
      }
    );
  });

  test("names the reason in tools that return their own fetch error text", async t => {
    const port = await reserveClosedPort();
    const client = new Client({ name: "gitlab-api-tool-error-test", version: "1.0.0" });
    t.after(() => client.close());
    await client.connect(createTransport(`http://127.0.0.1:${port}/api/v4`));

    const calls = [
      { name: "execute_graphql", arguments: { query: "query { currentUser { id } }" } },
      { name: "fork_repository", arguments: { project_id: "123" } },
    ];
    for (const call of calls) {
      const result = await client.callTool(call);
      assert.equal(result.isError, undefined, `${call.name}: preserve non-HTTP behavior`);
      assert.equal(result.structuredContent, undefined);
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? "";
      assert.match(
        text,
        /GitLab request failed before an HTTP response \(ECONNREFUSED\)/,
        `${call.name}: ${text}`
      );
      assert.doesNotMatch(text, /127\.0\.0\.1/);
    }
  });
});
