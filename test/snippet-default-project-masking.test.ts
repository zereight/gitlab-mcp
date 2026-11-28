/**
 * Snippet tools can fall back to the server's default project when project_id is
 * omitted (GITLAB_PROJECT_ID, or a single allowed project). Managed masking must
 * select the policy of that default project, as it does for get_file_contents.
 *
 * Project 12 is bound to policy group "one" (masks ProjectOneSecret); the server's
 * default project is 12. The mock API serves project 12's snippets.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";

const SNIPPET = {
  id: 7,
  title: "ProjectOneSecret",
  file_name: "a.txt",
  project_id: 12,
  files: [{ path: "a.txt", raw_url: "http://example.test/-/snippets/7/raw/main/a.txt" }],
};

async function startServer(
  t: TestContext,
  options: { builtinFallback?: boolean; env?: Record<string, string> } = {}
) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-mask-snippet-"));
  const policyPath = path.join(workspace, "policies.json");
  const requests: string[] = [];
  const api = http.createServer((req, res) => {
    const url = req.url ?? "";
    requests.push(`${req.method} ${url}`);
    if (url.endsWith("/raw")) {
      res.setHeader("Content-Type", "text/plain");
      res.end("ProjectOneSecret");
      return;
    }
    res.setHeader("Content-Type", "application/json");
    if (req.method === "DELETE") {
      res.statusCode = 204;
      res.end();
      return;
    }
    const isList = req.method === "GET" && url.split("?")[0].endsWith("/snippets");
    res.end(JSON.stringify(isList ? [SNIPPET] : SNIPPET));
  });
  const client = new Client({ name: "snippet-masking-test", version: "1.0.0" });
  t.after(async () => {
    try {
      await client.close();
    } finally {
      api.closeAllConnections();
      await new Promise<void>(resolve => api.close(() => resolve()));
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
  await new Promise<void>((resolve, reject) => {
    api.once("error", reject);
    api.listen(0, "127.0.0.1", resolve);
  });
  const apiUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}/api/v4`;
  fs.writeFileSync(
    policyPath,
    JSON.stringify({
      version: 1,
      policyGroups: {
        one: {
          rules: [{ id: "one", type: "keyword", match: "ProjectOneSecret", replacement: "[one]" }],
        },
        two: {},
      },
      bindings: [
        { gitlabInstance: apiUrl, projectIds: [12], policyGroup: "one" },
        { gitlabInstance: apiUrl, projectIds: [13], policyGroup: "two" },
      ],
      ...(options.builtinFallback ? { unboundProjectBehavior: "builtin" } : {}),
    })
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve("build/index.js")],
    stderr: "pipe",
    env: {
      ...getDefaultEnvironment(),
      GITLAB_PERSONAL_ACCESS_TOKEN: "masking-test-token",
      GITLAB_API_URL: apiUrl,
      GITLAB_PROJECT_ID: "12",
      GITLAB_MASKING_ENABLED: "true",
      GITLAB_MASKING_POLICY_FILE: policyPath,
      GITLAB_MASKING_WORKSPACE_DIR: workspace,
      GITLAB_DISABLE_VERSION_CHECK: "true",
      GITLAB_TOOLSETS: "all",
      LOG_LEVEL: "error",
      ...options.env,
    },
  });
  transport.stderr?.on("data", () => undefined);
  await client.connect(transport);
  return { client, requests };
}

const text = (result: unknown) => JSON.stringify(result);

describe("snippet tools use the default project for managed masking", { timeout: 60_000 }, () => {
  test("control: an explicit project_id is masked with that project's policy", async t => {
    const { client, requests } = await startServer(t, { builtinFallback: true });
    const result = await client.callTool({
      name: "list_snippets",
      arguments: { project_id: "12" },
    });
    assert.match(text(result), /\[one\]/);
    assert.doesNotMatch(text(result), /ProjectOneSecret/);
    assert.deepEqual(requests, ["GET /api/v4/projects/12/snippets"]);
  });

  test("list_snippets without project_id is masked with the default project's policy", async t => {
    const { client, requests } = await startServer(t, { builtinFallback: true });
    const result = await client.callTool({ name: "list_snippets", arguments: {} });
    assert.deepEqual(requests, ["GET /api/v4/projects/12/snippets"]);
    assert.match(text(result), /\[one\]/);
    assert.doesNotMatch(text(result), /ProjectOneSecret/);
  });

  test("get_snippet with include_content masks metadata and raw content", async t => {
    const { client, requests } = await startServer(t, { builtinFallback: true });
    const result = await client.callTool({
      name: "get_snippet",
      arguments: { snippet_id: 7, include_content: true },
    });
    assert.ok(
      requests.every(r => r.includes("/projects/12/snippets/7")),
      requests.join(",")
    );
    assert.doesNotMatch(text(result), /ProjectOneSecret/);
    assert.match(text(result), /\[one\]/);
  });

  test("create, update and delete without project_id select the default project's policy", async t => {
    const { client, requests } = await startServer(t, { builtinFallback: true });
    const created = await client.callTool({
      name: "create_snippet",
      arguments: { title: "t", file_name: "a.txt", content: "c" },
    });
    const updated = await client.callTool({
      name: "update_snippet",
      arguments: { snippet_id: 7, title: "t2" },
    });
    await client.callTool({ name: "delete_snippet", arguments: { snippet_id: 7 } });
    assert.deepEqual(requests, [
      "POST /api/v4/projects/12/snippets",
      "PUT /api/v4/projects/12/snippets/7",
      "DELETE /api/v4/projects/12/snippets/7",
    ]);
    for (const result of [created, updated]) {
      assert.doesNotMatch(text(result), /ProjectOneSecret/);
      assert.match(text(result), /\[one\]/);
    }
  });

  test("without builtin fallback the default project's snippets stay reachable", async t => {
    const { client, requests } = await startServer(t);
    const result = await client.callTool({ name: "list_snippets", arguments: {} });
    assert.deepEqual(requests, ["GET /api/v4/projects/12/snippets"]);
    assert.match(text(result), /\[one\]/);
  });

  test("personal snippets stay project-less when no default project is configured", async t => {
    const { client, requests } = await startServer(t, {
      builtinFallback: true,
      env: { GITLAB_PROJECT_ID: "" },
    });
    const result = await client.callTool({ name: "list_snippets", arguments: {} });
    assert.deepEqual(requests, ["GET /api/v4/snippets"]);
    assert.doesNotMatch(text(result), /\[one\]/);
  });

  test("an unbound default project is rejected before the request", async t => {
    const { client, requests } = await startServer(t, {
      builtinFallback: true,
      env: { GITLAB_PROJECT_ID: "99" },
    });
    await assert.rejects(
      () => client.callTool({ name: "list_snippets", arguments: {} }),
      /No managed masking policy is bound/
    );
    assert.deepEqual(requests, []);
  });

  test("several allowed projects without project_id fail before any request (builtin)", async t => {
    const { client, requests } = await startServer(t, {
      builtinFallback: true,
      env: { GITLAB_PROJECT_ID: "", GITLAB_ALLOWED_PROJECT_IDS: "12,13" },
    });
    const result = await client.callTool({ name: "list_snippets", arguments: {} });
    assert.equal(result.isError, true, text(result));
    assert.match(
      text(result),
      /Multiple projects allowed \(12, 13\)\. Please specify a project ID\./
    );
    assert.deepEqual(requests, []);
  });

  test("several allowed projects without project_id fail before any request (default)", async t => {
    const { client, requests } = await startServer(t, {
      env: { GITLAB_PROJECT_ID: "", GITLAB_ALLOWED_PROJECT_IDS: "12,13" },
    });
    const result = await client.callTool({ name: "list_snippets", arguments: {} });
    assert.equal(result.isError, true, text(result));
    assert.match(
      text(result),
      /Multiple projects allowed \(12, 13\)\. Please specify a project ID\./
    );
    assert.deepEqual(requests, []);
  });
});
