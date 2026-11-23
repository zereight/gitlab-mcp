import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, test, type TestContext } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";

// GitLab answers an unknown release tag with its generic 404 body (checked on gitlab.com),
// so these tests serve that same body. The release hint must come from the tool path.
const GENERIC_NOT_FOUND = JSON.stringify({ message: "404 Not Found" });
const EXISTING_TAG = "v1.0.0";
const RELEASE_HINT =
  "Next: check project_id and that tag_name is the Git tag of an existing release; list_releases lists them.";
const GENERIC_IID_HINT =
  "Next: check project_id (numeric ID or group%2Fproject) and the resource iid.";

function createTransport(apiUrl: string, permissionMode: string): StdioClientTransport {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["build/index.js"],
    stderr: "pipe",
    env: {
      ...getDefaultEnvironment(),
      GITLAB_PERSONAL_ACCESS_TOKEN: "test-token",
      GITLAB_API_URL: apiUrl,
      GITLAB_PERMISSION_MODE: permissionMode,
      GITLAB_TOOLSETS: "releases",
      GITLAB_DISABLE_VERSION_CHECK: "true",
      LOG_LEVEL: "error",
    },
  });
  transport.stderr?.on("data", () => undefined);
  return transport;
}

async function startServer(t: TestContext, permissionMode = "full"): Promise<Client> {
  const api = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    const url = req.url ?? "";
    const tagPath = /^\/api\/v4\/projects\/[^/]+\/releases\/([^/?]+)/.exec(url);

    if (
      tagPath &&
      tagPath[1] === EXISTING_TAG &&
      req.method === "GET" &&
      !url.includes("/downloads/")
    ) {
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          tag_name: EXISTING_TAG,
          name: "Version 1.0.0",
          description: "First release",
          created_at: "2026-01-01T00:00:00.000Z",
        })
      );
      return;
    }

    res.statusCode = 404;
    res.end(GENERIC_NOT_FOUND);
  });

  await new Promise<void>((resolve, reject) => {
    api.once("error", reject);
    api.listen(0, "127.0.0.1", resolve);
  });

  const apiUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}/api/v4`;
  const client = new Client({ name: "release-tag-hint-test", version: "1.0.0" });
  const transport = createTransport(apiUrl, permissionMode);

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

/** Returns the error text whether the server reports it as an isError result or a thrown call error. */
async function errorText(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  try {
    const result = await client.callTool({ name, arguments: args });
    assert.strictEqual(result.isError, true, `${name} should fail`);
    const block = (result.content as Array<{ type?: string; text?: string }>)[0];
    return block?.text ?? "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe("GitLab release 404s name tag_name, not the iid", () => {
  test("get_release on a tag with no release gets the release hint", async t => {
    const client = await startServer(t, "readonly");
    const text = await errorText(client, "get_release", {
      project_id: "87",
      tag_name: "no-such-tag",
    });

    assert.match(text, /404/);
    assert.ok(text.includes(RELEASE_HINT), text);
    assert.ok(!text.includes("resource iid"), text);
  });

  test("update_release on a tag with no release gets the release hint", async t => {
    const client = await startServer(t);
    const text = await errorText(client, "update_release", {
      project_id: "87",
      tag_name: "no-such-tag",
      name: "renamed",
    });

    assert.ok(text.includes(RELEASE_HINT), text);
  });

  test("delete_release on a tag with no release gets the release hint", async t => {
    const client = await startServer(t);
    const text = await errorText(client, "delete_release", {
      project_id: "87",
      tag_name: "no-such-tag",
    });

    assert.ok(text.includes(RELEASE_HINT), text);
  });

  test("create_release_evidence on a tag with no release gets the release hint", async t => {
    const client = await startServer(t);
    const text = await errorText(client, "create_release_evidence", {
      project_id: "87",
      tag_name: "no-such-tag",
    });

    assert.ok(text.includes(RELEASE_HINT), text);
  });

  test("create_release keeps the generic hint, since it is not addressed by tag", async t => {
    const client = await startServer(t);
    const text = await errorText(client, "create_release", {
      project_id: "87",
      tag_name: "v9.9.9",
    });

    assert.ok(text.includes(GENERIC_IID_HINT), text);
    assert.ok(!text.includes("list_releases"), text);
  });

  test("download_release_asset keeps the generic hint", async t => {
    const client = await startServer(t, "readonly");
    const text = await errorText(client, "download_release_asset", {
      project_id: "87",
      tag_name: "no-such-tag",
      direct_asset_path: "bin/tool.tar.gz",
    });

    assert.ok(text.includes(GENERIC_IID_HINT), text);
  });

  test("get_release on an existing tag still returns the release unchanged", async t => {
    const client = await startServer(t, "readonly");
    const result = await client.callTool({
      name: "get_release",
      arguments: { project_id: "87", tag_name: EXISTING_TAG },
    });

    assert.notStrictEqual(result.isError, true);
    const block = (result.content as Array<{ type?: string; text?: string }>)[0];
    assert.strictEqual(block?.type, "text");
    assert.deepStrictEqual(JSON.parse(block?.text ?? "{}"), {
      tag_name: EXISTING_TAG,
      name: "Version 1.0.0",
      description: "First release",
      created_at: "2026-01-01T00:00:00.000Z",
    });
  });
});
