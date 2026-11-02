import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { StdioTestClient } from "./clients/stdio-client.js";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

// #963: with GITLAB_MCP_LIST_SUMMARY_DEFAULT on and `summary` omitted, a summary-safe
// list tool is summarized and an excluded one returns its full reply, through the
// server's tool call path.

const MOCK_TOKEN = "glpat-...2345";

const NAMESPACE = {
  id: 1,
  name: "Test Group",
  path: "test-group",
  kind: "group",
  full_path: "test-group",
  parent_id: null,
  avatar_url: null,
  web_url: "https://gitlab.mock/groups/test-group",
};

async function callListTool(
  client: StdioTestClient,
  tool: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const result = await client.callTool(tool, args);
  assert.notStrictEqual(result.isError, true, `${tool} failed: ${JSON.stringify(result)}`);
  const block = result.content?.[0];
  assert.ok(block && block.type === "text", `${tool} should return text content`);
  const items: unknown = JSON.parse(block.text);
  assert.ok(Array.isArray(items) && items.length === 1, `${tool} should return one item`);
  return items[0] as Record<string, unknown>;
}

describe("list summary default through the tool call path (#963)", () => {
  let mockGitLab: MockGitLabServer;
  let client: StdioTestClient;

  before(async () => {
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({ port: mockPort, validTokens: [MOCK_TOKEN] });
    mockGitLab.addMockHandler("get", "/namespaces", (_req, res) => {
      res.json([NAMESPACE]);
    });
    await mockGitLab.start();
    client = new StdioTestClient();
    await client.connect("build/index.js", {
      GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      GITLAB_READ_ONLY_MODE: "true",
      GITLAB_TOOLSETS: "projects",
      GITLAB_MCP_LIST_SUMMARY_DEFAULT: "true",
    });
  });

  after(async () => {
    await client.disconnect();
    await mockGitLab.stop();
  });

  test("summarizes list_projects and keeps id and path_with_namespace", async () => {
    const item = await callListTool(client, "list_projects", {});
    assert.strictEqual(item.id, "123");
    assert.strictEqual(item.path_with_namespace, "test-group/test-project");
    assert.strictEqual(
      "description" in item,
      false,
      "list_projects summary should drop description"
    );
  });

  test("returns the full list_namespaces reply", async () => {
    const item = await callListTool(client, "list_namespaces", {});
    assert.strictEqual(item.full_path, NAMESPACE.full_path);
    assert.strictEqual(item.path, NAMESPACE.path);
    assert.strictEqual(item.kind, NAMESPACE.kind);
  });
});
