/**
 * End-to-end check for lazily built tool input schemas (tools/registry.ts).
 *
 * Runs build/index.js over stdio against a mock GitLab and checks that a schema
 * first read after startup (a tool activated with discover_tools, or a tool
 * called before any tools/list) is the same JSON Schema an eager toJSONSchema()
 * call builds, and still maps back to its Zod schema (used to tell invalid
 * arguments from a malformed GitLab response).
 */
import assert from "node:assert/strict";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { ListPipelinesSchema } from "../schemas.js";
import { toJSONSchema } from "../utils/schema.js";
import { StdioTestClient } from "./clients/stdio-client.js";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const SERVER_PATH = path.resolve("build/index.js");
const MOCK_TOKEN = "glpat-lazy-schema-e2e-0000";

describe("When tool input schemas are built lazily (stdio E2E)", () => {
  let mockGitLab: MockGitLabServer;
  let env: Record<string, string>;

  before(async () => {
    mockGitLab = new MockGitLabServer({
      port: await findMockServerPort(),
      validTokens: [MOCK_TOKEN],
    });
    await mockGitLab.start();
    mockGitLab.addMockHandler("get", "/namespaces/malformed/exists", (_req, res) => {
      res.json({ exists: true, suggests: "not-an-array" });
    });
    mockGitLab.addMockHandler("get", "/projects/123/pipelines", (_req, res) => {
      res.json([]);
    });
    env = {
      GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      GITLAB_DISABLE_VERSION_CHECK: "true",
      LOG_LEVEL: "error",
      GITLAB_TOOLSETS: "",
      GITLAB_TOOLS: "",
      GITLAB_TOOL_PROFILE: "full",
      USE_PIPELINE: "false",
      SSE: "false",
      STREAMABLE_HTTP: "false",
    };
  });

  after(async () => {
    await mockGitLab.stop();
  });

  async function withClient<T>(
    overrides: Record<string, string>,
    fn: (client: StdioTestClient) => Promise<T>
  ): Promise<T> {
    const client = new StdioTestClient();
    await client.connect(SERVER_PATH, { ...env, ...overrides });
    try {
      return await fn(client);
    } finally {
      await client.disconnect();
    }
  }

  it("should list a built object schema for every tool with GITLAB_TOOLSETS=all", async () => {
    const tools = await withClient(
      { GITLAB_TOOLSETS: "all" },
      async client => (await client.listTools()).tools
    );

    assert.ok(tools.length > 200, `expected the full registry, got ${tools.length} tools`);
    const broken = tools
      .filter(
        tool =>
          tool.inputSchema?.type !== "object" ||
          typeof tool.inputSchema.properties !== "object" ||
          tool.inputSchema.properties === null
      )
      .map(tool => tool.name);
    assert.deepEqual(broken, []);
  });

  it("should list the eager JSON Schema for a tool activated after startup", async () => {
    await withClient({}, async client => {
      const before = (await client.listTools()).tools.map(tool => tool.name);
      assert.equal(before.includes("list_pipelines"), false);

      const activation = await client.callTool("discover_tools", { category: "pipelines" });
      assert.notEqual(activation.isError, true);

      const listed = (await client.listTools()).tools.find(tool => tool.name === "list_pipelines");
      assert.ok(listed, "list_pipelines should be listed after discover_tools activates pipelines");
      // The server adds shared result options (jmespath, summary) to list tools;
      // every property the Zod schema defines must be listed exactly as eager conversion builds it.
      const eager = toJSONSchema(ListPipelinesSchema);
      const listedProperties = listed.inputSchema.properties ?? {};
      for (const [name, schema] of Object.entries(eager.properties ?? {})) {
        assert.deepEqual(listedProperties[name], schema, `list_pipelines.${name}`);
      }
      assert.deepEqual(listed.inputSchema.required, eager.required);

      const result = await client.callTool("list_pipelines", { project_id: "123", per_page: 5 });
      assert.notEqual(result.isError, true);
      assert.ok(mockGitLab.getRequestCount() > 0);
    });
  });

  it("should classify a malformed GitLab response on a tool called before any tools/list", async () => {
    await withClient({ GITLAB_TOOLSETS: "projects" }, async client => {
      await assert.rejects(
        client.callTool("verify_namespace", { path: "malformed" }),
        (error: Error) => {
          assert.match(error.message, /Unexpected GitLab response for verify_namespace/);
          assert.doesNotMatch(error.message, /Invalid arguments/);
          return true;
        }
      );
    });
  });
});
