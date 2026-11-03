import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { StdioTestClient } from "./clients/stdio-client.js";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

// #963: with GITLAB_MCP_LIST_SUMMARY_DEFAULT on and `summary` omitted, a summary-safe
// list tool is summarized and an excluded one returns its full reply, through the
// server's tool call path. `summary: true` still summarizes an excluded one.

const MOCK_TOKEN = "glpat-...2345";
const GROUP_ID = "5";
const PROJECT_ID = "9";

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

const ITERATION = {
  id: 53,
  iid: 13,
  sequence: 1,
  group_id: 5,
  title: "Sprint 1",
  description: "Initial goal",
  state: 2,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  start_date: "2026-09-01",
  due_date: "2026-09-07",
  web_url: "https://gitlab.mock/groups/test-group/-/iterations/13",
};

// GraphQL node; list_group_iteration_cadences maps it to snake_case fields.
const CADENCE_NODE = {
  id: "gid://gitlab/Iterations::Cadence/7",
  title: "Sprints",
  description: "Two-week sprints",
  automatic: true,
  active: true,
  startDate: "2026-09-01",
  durationInWeeks: 2,
  iterationsInAdvance: 3,
  rollOver: false,
};

const ITERATION_LIST_CALLS: ReadonlyArray<[string, Record<string, unknown>]> = [
  ["list_group_iterations", { group_id: GROUP_ID }],
  ["list_project_iterations", { project_id: PROJECT_ID }],
];

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
    mockGitLab.addMockHandler("get", `/groups/${GROUP_ID}/iterations`, (_req, res) => {
      res.json([ITERATION]);
    });
    mockGitLab.addMockHandler("get", `/projects/${PROJECT_ID}/iterations`, (_req, res) => {
      res.json([ITERATION]);
    });
    // list_group_iteration_cadences resolves the group path before its GraphQL query.
    mockGitLab.addMockHandler("get", `/groups/${GROUP_ID}`, (_req, res) => {
      res.json({ id: 5, full_path: NAMESPACE.full_path });
    });
    mockGitLab.addRootHandler("post", "/api/graphql", (req, res) => {
      const query = String(req.body.query ?? "");
      if (!query.includes("query GroupIterationCadences(")) {
        res.status(400).json({ errors: [{ message: `Unexpected GraphQL operation: ${query}` }] });
        return;
      }
      res.json({
        data: {
          group: {
            iterationCadences: {
              nodes: [CADENCE_NODE],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        },
      });
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

  test("summarizes list_namespaces when summary is true", async () => {
    const item = await callListTool(client, "list_namespaces", { summary: true });
    assert.strictEqual(item.id, String(NAMESPACE.id));
    assert.strictEqual(item.name, NAMESPACE.name);
    assert.strictEqual("full_path" in item, false, "list_namespaces summary should drop full_path");
    assert.strictEqual("path" in item, false, "list_namespaces summary should drop path");
    assert.strictEqual("kind" in item, false, "list_namespaces summary should drop kind");
  });

  for (const [tool, args] of ITERATION_LIST_CALLS) {
    test(`returns the full ${tool} reply with start_date and due_date`, async () => {
      const item = await callListTool(client, tool, args);
      assert.strictEqual(item.id, String(ITERATION.id));
      assert.strictEqual(item.start_date, ITERATION.start_date);
      assert.strictEqual(item.due_date, ITERATION.due_date);
    });

    test(`summarizes ${tool} when summary is true`, async () => {
      const item = await callListTool(client, tool, { ...args, summary: true });
      assert.strictEqual(item.id, String(ITERATION.id));
      assert.strictEqual(item.title, ITERATION.title);
      assert.strictEqual("start_date" in item, false, `${tool} summary should drop start_date`);
      assert.strictEqual("due_date" in item, false, `${tool} summary should drop due_date`);
    });
  }

  test("returns the full list_group_iteration_cadences reply with the cadence settings", async () => {
    const item = await callListTool(client, "list_group_iteration_cadences", {
      group_id: GROUP_ID,
    });
    assert.strictEqual(item.id, CADENCE_NODE.id);
    assert.strictEqual(item.start_date, CADENCE_NODE.startDate);
    assert.strictEqual(item.duration_in_weeks, CADENCE_NODE.durationInWeeks);
    assert.strictEqual(item.iterations_in_advance, CADENCE_NODE.iterationsInAdvance);
    assert.strictEqual(item.automatic, CADENCE_NODE.automatic);
    assert.strictEqual(item.active, CADENCE_NODE.active);
    assert.strictEqual(item.roll_over, CADENCE_NODE.rollOver);
  });

  test("summarizes list_group_iteration_cadences when summary is true", async () => {
    const item = await callListTool(client, "list_group_iteration_cadences", {
      group_id: GROUP_ID,
      summary: true,
    });
    assert.strictEqual(item.id, CADENCE_NODE.id);
    assert.strictEqual(item.title, CADENCE_NODE.title);
    assert.strictEqual(
      "start_date" in item,
      false,
      "list_group_iteration_cadences summary should drop start_date"
    );
    assert.strictEqual(
      "duration_in_weeks" in item,
      false,
      "list_group_iteration_cadences summary should drop duration_in_weeks"
    );
  });
});
