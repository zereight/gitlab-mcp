/**
 * Regression test for #959: work item tools fail on GitLab CE because the
 * GraphQL documents select Premium-only widget fragments and fields.
 *
 * The CE mock validates every document like GitLab does: unknown fragment
 * conditions and unknown fields are reported in document order, at most five
 * per response (GitLab's `validate_max_errors 5`). The Premium mock accepts
 * everything, so it also proves the Premium document is sent unchanged.
 */
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-work-item-ce-widgets-test";
const PROJECT_ID = "9";
const PROJECT_PATH = "test-group/test-project";
const WORK_ITEM_IID = 1;

type ToolCall = { name: string; args: Record<string, unknown> };

/**
 * Run one MCP server process and send the tool calls one after another, so the
 * per-endpoint memory of unsupported selections carries over between calls.
 */
async function callTools(calls: ToolCall[], env: NodeJS.ProcessEnv): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
    const results: any[] = [];
    let buffered = "";
    let errorOutput = "";
    let next = 0;

    const send = () => {
      proc.stdin?.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: next + 1,
          method: "tools/call",
          params: { name: calls[next].name, arguments: calls[next].args },
        }) + "\n"
      );
    };

    proc.stderr?.on("data", data => (errorOutput += data));
    proc.stdout?.on("data", data => {
      buffered += data;
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("{")) continue;
        const response = JSON.parse(line);
        if (response.id !== next + 1) continue;
        if (response.error) {
          reject(new Error(response.error?.message ?? String(response.error)));
          proc.kill();
          return;
        }
        const content = response.result?.content?.[0]?.text;
        if (response.result?.isError) {
          reject(new Error(content ?? "Tool call failed"));
          proc.kill();
          return;
        }
        results.push(content ? JSON.parse(content) : response.result);
        next++;
        if (next < calls.length) {
          send();
        } else {
          proc.stdin?.end();
        }
      }
    });

    proc.on("close", code => {
      if (results.length === calls.length) {
        resolve(results);
        return;
      }
      reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
    });

    send();
  });
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): Promise<any> {
  const [result] = await callTools([{ name, args }], env);
  return result;
}

// Widget types that exist on GitLab CE (app/graphql/types/work_items/widgets).
const CE_FRAGMENT_TYPES = new Set([
  "WorkItemWidgetAssignees",
  "WorkItemWidgetDevelopment",
  "WorkItemWidgetHierarchy",
  "WorkItemWidgetLabels",
  "WorkItemWidgetLinkedItems",
  "WorkItemWidgetMilestone",
  "WorkItemWidgetNotes",
  "WorkItemWidgetStartAndDueDate",
  "WorkItemWidgetTimeTracking",
]);

// Fields that EE adds to CE widget types (ee/app/graphql/ee/types/work_items/widgets).
const EE_ONLY_FIELDS: Record<string, string[]> = {
  WorkItemWidgetLinkedItems: ["blocked", "blockedByCount", "blockingCount"],
  WorkItemWidgetDevelopment: ["featureFlags"],
};

const EE_ONLY_FRAGMENT_TYPES = [
  "WorkItemWidgetStatus",
  "WorkItemWidgetCustomFields",
  "WorkItemWidgetWeight",
  "WorkItemWidgetHealthStatus",
  "WorkItemWidgetIteration",
  "WorkItemWidgetProgress",
  "WorkItemWidgetColor",
];

function closingBrace(source: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return i;
  }
  return source.length;
}

/** GitLab CE validation: errors in document order, capped at five. */
function validateAgainstCE(query: string): string[] {
  const problems: Array<{ index: number; message: string }> = [];
  for (const match of query.matchAll(/\.\.\.\s*on\s+(\w+)\s*\{/g)) {
    const type = match[1];
    const index = match.index ?? 0;
    if (!CE_FRAGMENT_TYPES.has(type)) {
      problems.push({
        index,
        message: `No such type ${type}, so it can't be a fragment condition`,
      });
      continue;
    }
    const open = index + match[0].length - 1;
    const body = query.slice(open + 1, closingBrace(query, open));
    for (const field of EE_ONLY_FIELDS[type] ?? []) {
      const at = body.search(new RegExp(`\\b${field}\\b`));
      if (at >= 0) {
        problems.push({
          index: open + 1 + at,
          message: `Field '${field}' doesn't exist on type '${type}'`,
        });
      }
    }
  }
  return problems
    .sort((a, b) => a.index - b.index)
    .slice(0, 5)
    .map(problem => problem.message);
}

function hasEEOnlySelections(query: string): boolean {
  return (
    EE_ONLY_FRAGMENT_TYPES.some(type => query.includes(type)) ||
    Object.values(EE_ONLY_FIELDS)
      .flat()
      .some(field => new RegExp(`\\b${field}\\b`).test(query))
  );
}

const CE_WIDGETS = [
  {
    __typename: "WorkItemWidgetLabels",
    labels: { nodes: [{ id: "gid://gitlab/ProjectLabel/1", title: "bug", color: "#ff0000" }] },
  },
  {
    __typename: "WorkItemWidgetAssignees",
    assignees: { nodes: [{ id: "gid://gitlab/User/1", username: "alice", name: "Alice" }] },
  },
  { __typename: "WorkItemWidgetStartAndDueDate", startDate: "2026-01-01", dueDate: "2026-02-01" },
  {
    __typename: "WorkItemWidgetMilestone",
    milestone: { id: "gid://gitlab/Milestone/1", title: "v1" },
  },
  {
    __typename: "WorkItemWidgetLinkedItems",
    linkedItems: { nodes: [] },
  },
  { __typename: "WorkItemWidgetTimeTracking", timeEstimate: 3600, totalTimeSpent: 1800 },
];

const PREMIUM_WIDGETS = [
  ...CE_WIDGETS.filter(w => w.__typename !== "WorkItemWidgetLinkedItems"),
  {
    __typename: "WorkItemWidgetStatus",
    status: {
      id: "gid://gitlab/WorkItems::Statuses::Custom::Status/1",
      name: "In progress",
      category: "in_progress",
      color: "#1f75cb",
    },
  },
  { __typename: "WorkItemWidgetWeight", weight: 3, rolledUpWeight: 3, rolledUpCompletedWeight: 0 },
  { __typename: "WorkItemWidgetHealthStatus", healthStatus: "onTrack" },
  {
    __typename: "WorkItemWidgetLinkedItems",
    blocked: true,
    blockedByCount: 2,
    blockingCount: 0,
    linkedItems: { nodes: [] },
  },
];

function workItem(widgets: unknown[]) {
  return {
    id: `gid://gitlab/WorkItem/${WORK_ITEM_IID}`,
    iid: String(WORK_ITEM_IID),
    title: "Work item",
    state: "OPEN",
    description: "Body",
    webUrl: "https://gitlab.mock/-/work_items/1",
    confidential: false,
    author: { username: "alice" },
    createdAt: "2026-01-01T00:00:00Z",
    closedAt: null,
    workItemType: { name: "Issue" },
    widgets,
  };
}

function graphqlData(query: string, variables: Record<string, any>, widgets: unknown[]) {
  if (query.includes("workItemUpdate")) {
    return { workItemUpdate: { workItem: workItem(widgets), errors: [] } };
  }
  if (query.includes("workItems(")) {
    return {
      project: {
        workItems: {
          nodes: [workItem(widgets)],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    };
  }
  if (query.includes("widgets")) {
    return { namespace: { workItem: workItem(widgets) } };
  }
  // resolveWorkItemGID
  return { namespace: { workItem: { id: `gid://gitlab/WorkItem/${variables.iid}` } } };
}

describe("work item tools on GitLab CE (#959)", () => {
  let mockServer: MockGitLabServer;
  let edition: "ce" | "premium" = "ce";
  let queries: string[] = [];

  before(async () => {
    const port = await findMockServerPort();
    mockServer = new MockGitLabServer({ port, validTokens: [MOCK_TOKEN] });

    mockServer.addMockHandler("get", `/projects/${PROJECT_ID}`, (_req, res) => {
      res.json({ id: Number(PROJECT_ID), path_with_namespace: PROJECT_PATH });
    });

    mockServer.addRootHandler("post", "/api/graphql", (req, res) => {
      const { query, variables } = req.body;
      queries.push(query);

      if (edition === "ce") {
        const errors = validateAgainstCE(query);
        if (errors.length > 0) {
          res.json({ errors: errors.map(message => ({ message })) });
          return;
        }
      }

      res.json({
        data: graphqlData(query, variables, edition === "ce" ? CE_WIDGETS : PREMIUM_WIDGETS),
      });
    });

    await mockServer.start();
  });

  beforeEach(() => {
    queries = [];
  });

  after(async () => {
    await mockServer.stop();
  });

  const env = () => ({
    GITLAB_API_URL: `${mockServer.getUrl()}/api/v4`,
    GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
    GITLAB_PROJECT_ID: PROJECT_ID,
    // workitems is not a default toolset, so the test enables it explicitly.
    GITLAB_TOOLSETS: "workitems",
  });

  describe("on CE", () => {
    before(() => {
      edition = "ce";
    });

    test("get_work_item retries without the Premium-only selections and succeeds", async () => {
      const result = await callTool(
        "get_work_item",
        { project_id: PROJECT_ID, iid: WORK_ITEM_IID },
        env()
      );

      assert.equal(result.iid, String(WORK_ITEM_IID));
      assert.deepEqual(result.labels, ["bug"]);
      assert.deepEqual(result.assignees, ["alice"]);
      assert.equal(result.milestone?.title, "v1");
      for (const key of ["status", "weight", "healthStatus", "blocked", "blockedByCount"]) {
        assert.equal(key in result, false, `${key} must be absent on CE`);
      }

      // First document is the unchanged Premium one; the last one validates on CE.
      assert.ok(hasEEOnlySelections(queries[0]));
      assert.equal(hasEEOnlySelections(queries.at(-1)!), false);
      assert.deepEqual(validateAgainstCE(queries.at(-1)!), []);
      // The CE mock reports 14 problems (7 widget types, 3 nested CustomFields value
      // types, 4 fields), five per response: three retries, then success.
      assert.equal(queries.length, 4);
    });

    test("list_work_items succeeds and the retry is remembered for later calls", async () => {
      const [first, second] = await callTools(
        [
          { name: "list_work_items", args: { project_id: PROJECT_ID } },
          { name: "list_work_items", args: { project_id: PROJECT_ID } },
        ],
        env()
      );

      assert.equal(first.items.length, 1);
      assert.deepEqual(first.items[0].labels, ["bug"]);
      assert.equal("status" in first.items[0], false);
      assert.equal("weight" in first.items[0], false);
      assert.deepEqual(second, first);

      // Call 1: full document rejected, pruned document accepted. Call 2: pruned up front.
      assert.equal(queries.length, 3);
      assert.ok(hasEEOnlySelections(queries[0]));
      assert.equal(hasEEOnlySelections(queries[1]), false);
      assert.equal(hasEEOnlySelections(queries[2]), false);
    });

    test("get_work_item reuses what list_work_items learned", async () => {
      const [, item] = await callTools(
        [
          { name: "list_work_items", args: { project_id: PROJECT_ID } },
          { name: "get_work_item", args: { project_id: PROJECT_ID, iid: WORK_ITEM_IID } },
        ],
        env()
      );

      assert.equal(item.iid, String(WORK_ITEM_IID));
      // list taught Status/Weight/HealthStatus (2 requests). get_work_item skipped
      // those up front and learned the remaining 11 problems in three rounds of at
      // most five, then succeeded (4 requests).
      assert.equal(queries.length, 2 + 4);
    });

    test("update_work_item succeeds without the Premium-only response fragments", async () => {
      const result = await callTool(
        "update_work_item",
        { project_id: PROJECT_ID, iid: WORK_ITEM_IID, title: "Renamed" },
        env()
      );

      assert.equal(result.iid, String(WORK_ITEM_IID));
      assert.equal(result.status, null);
      assert.equal(result.weight, null);
      assert.deepEqual(result.labels, ["bug"]);

      const mutations = queries.filter(q => q.includes("workItemUpdate"));
      assert.equal(mutations.length, 2);
      assert.ok(hasEEOnlySelections(mutations[0]));
      assert.equal(hasEEOnlySelections(mutations[1]), false);
    });
  });

  describe("on Premium", () => {
    before(() => {
      edition = "premium";
    });

    test("get_work_item sends the full document once and returns the widget fields", async () => {
      const result = await callTool(
        "get_work_item",
        { project_id: PROJECT_ID, iid: WORK_ITEM_IID },
        env()
      );

      assert.equal(queries.length, 1);
      for (const type of EE_ONLY_FRAGMENT_TYPES) {
        assert.ok(queries[0].includes(`... on ${type}`), `${type} must still be requested`);
      }
      assert.ok(/blocked blockedByCount blockingCount/.test(queries[0]));
      assert.ok(queries[0].includes("featureFlags"));

      assert.equal(result.status?.name, "In progress");
      assert.equal(result.weight, 3);
      assert.equal(result.healthStatus, "onTrack");
      assert.equal(result.blocked, true);
      assert.equal(result.blockedByCount, 2);
      assert.deepEqual(result.labels, ["bug"]);
    });

    test("list_work_items sends the full document once and returns the widget fields", async () => {
      const result = await callTool("list_work_items", { project_id: PROJECT_ID }, env());

      assert.equal(queries.length, 1);
      assert.ok(queries[0].includes("... on WorkItemWidgetStatus"));
      assert.ok(queries[0].includes("... on WorkItemWidgetWeight"));
      assert.ok(queries[0].includes("... on WorkItemWidgetHealthStatus"));

      assert.equal(result.items[0].status, "In progress");
      assert.equal(result.items[0].weight, 3);
      assert.equal(result.items[0].healthStatus, "onTrack");
    });
  });

  test("unrelated GraphQL errors are not retried", async () => {
    edition = "premium";
    mockServer.addRootHandler("post", "/api/graphql", (req, res) => {
      queries.push(req.body.query);
      res.json({ errors: [{ message: "Field 'nope' doesn't exist on type 'Project'" }] });
    });

    await assert.rejects(
      () => callTool("get_work_item", { project_id: PROJECT_ID, iid: WORK_ITEM_IID }, env()),
      /doesn't exist on type 'Project'/
    );
    assert.equal(queries.length, 1);
  });
});
