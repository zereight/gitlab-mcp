import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { StdioTestClient } from "./clients/stdio-client.js";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

// Issue #675: clients that validate tools/call results against the MCP SDK
// CallToolResultSchema fail with "expected record, received array" at
// structuredContent. GitLab returns top-level JSON arrays for the merge request
// diff tools, so these must never surface as a non-object structuredContent.
// StdioTestClient.callTool already runs the SDK's CallToolResultSchema parse,
// so a resolved call is itself the schema-validity assertion.

const MOCK_TOKEN = "glpat-mock-token-12345";
const TEST_PROJECT_ID = "123";
const SERVER_PATH = "build/index.js";

const ARRAY_RESULT_TOOLS: ReadonlyArray<{ name: string; args: Record<string, unknown> }> = [
  {
    name: "get_merge_request_diffs",
    args: { project_id: TEST_PROJECT_ID, merge_request_iid: "1" },
  },
  {
    name: "list_merge_request_diffs",
    args: { project_id: TEST_PROJECT_ID, merge_request_iid: "1" },
  },
  {
    name: "list_merge_request_changed_files",
    args: { project_id: TEST_PROJECT_ID, merge_request_iid: "1" },
  },
  { name: "list_merge_requests", args: { project_id: TEST_PROJECT_ID } },
];

function assertStructuredContentInvariant(result: Record<string, unknown>, label: string) {
  if (Object.prototype.hasOwnProperty.call(result, "structuredContent")) {
    const value = result.structuredContent;
    assert.ok(
      typeof value === "object" && value !== null && !Array.isArray(value),
      `${label}: structuredContent must be a JSON object when present, got ${
        Array.isArray(value) ? "array" : value === null ? "null" : typeof value
      }`
    );
  }
}

function firstText(result: Record<string, unknown>): string {
  const content = result.content as Array<{ type?: string; text?: string }>;
  assert.ok(Array.isArray(content) && content.length > 0, "content must be a non-empty array");
  assert.equal(content[0].type, "text");
  assert.equal(typeof content[0].text, "string");
  return content[0].text as string;
}

describe("tools/call structuredContent invariant (#675)", () => {
  let mockGitLab: MockGitLabServer;
  let baseEnv: Record<string, string>;

  before(async () => {
    const port = await findMockServerPort();
    mockGitLab = new MockGitLabServer({ port, validTokens: [MOCK_TOKEN] });
    await mockGitLab.start();
    baseEnv = {
      GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      GITLAB_READ_ONLY_MODE: "true",
    };
  });

  after(async () => {
    await mockGitLab.stop();
  });

  async function withClient<T>(
    env: Record<string, string>,
    run: (client: StdioTestClient) => Promise<T>
  ): Promise<T> {
    const client = new StdioTestClient();
    await client.connect(SERVER_PATH, env);
    try {
      return await run(client);
    } finally {
      await client.disconnect();
    }
  }

  test("no tool advertises an outputSchema", async () => {
    await withClient(baseEnv, async client => {
      const { tools } = await client.listTools();
      const advertising = tools
        .filter(tool => (tool as { outputSchema?: unknown }).outputSchema !== undefined)
        .map(tool => tool.name);
      assert.deepEqual(advertising, []);
    });
  });

  for (const { name, args } of ARRAY_RESULT_TOOLS) {
    test(`${name}: array payload stays in text content, structuredContent absent`, async () => {
      await withClient(baseEnv, async client => {
        const result = (await client.callTool(name, args)) as Record<string, unknown>;
        assert.notEqual(result.isError, true, `${name} returned isError`);
        assertStructuredContentInvariant(result, name);
        assert.equal(
          Object.prototype.hasOwnProperty.call(result, "structuredContent"),
          false,
          `${name} must not emit structuredContent (no outputSchema declared)`
        );
        const parsed: unknown = JSON.parse(firstText(result));
        assert.ok(Array.isArray(parsed), `${name} text content must still be a JSON array`);
        assert.ok((parsed as unknown[]).length > 0, `${name} text content must not be empty`);
      });
    });
  }

  test("GITLAB_MCP_LIST_SUMMARY_DEFAULT=true (#931) keeps the invariant for diff tools", async () => {
    await withClient({ ...baseEnv, GITLAB_MCP_LIST_SUMMARY_DEFAULT: "true" }, async client => {
      for (const { name, args } of ARRAY_RESULT_TOOLS) {
        const result = (await client.callTool(name, args)) as Record<string, unknown>;
        assert.notEqual(result.isError, true, `${name} returned isError`);
        assertStructuredContentInvariant(result, `${name} (summary default)`);
        assert.equal(Object.prototype.hasOwnProperty.call(result, "structuredContent"), false);
        assert.ok(Array.isArray(JSON.parse(firstText(result))));
      }
    });
  });

  test("jmespath wrapping the array into an object keeps text content as that object", async () => {
    await withClient(baseEnv, async client => {
      const result = (await client.callTool("get_merge_request_diffs", {
        project_id: TEST_PROJECT_ID,
        merge_request_iid: "1",
        jmespath: "{diffs: @}",
      })) as Record<string, unknown>;
      // A structuredContent reshaped by the filter may legitimately be an object here,
      // so only the object-or-absent invariant is asserted.
      assertStructuredContentInvariant(result, "get_merge_request_diffs jmespath");
      const parsed = JSON.parse(firstText(result)) as { diffs?: unknown };
      assert.ok(Array.isArray(parsed.diffs));
    });
  });

  test("error results keep the invariant", async () => {
    mockGitLab.addMockHandler("get", "/projects/123/merge_requests/404/changes", (_req, res) => {
      res.status(404).json({ message: "404 Merge Request Not Found" });
    });
    await withClient(baseEnv, async client => {
      const result = (await client.callTool("get_merge_request_diffs", {
        project_id: TEST_PROJECT_ID,
        merge_request_iid: "404",
      })) as Record<string, unknown>;
      assert.equal(result.isError, true);
      assertStructuredContentInvariant(result, "get_merge_request_diffs error");
      assert.equal(Object.prototype.hasOwnProperty.call(result, "structuredContent"), false);
      assert.equal(typeof firstText(result), "string");
    });
  });
});
