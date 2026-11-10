/**
 * Tests for list_issue_label_events and list_issue_state_events (issue #1003).
 * GET /projects/:id/issues/:issue_iid/resource_label_events and
 * .../resource_state_events return an issue's label and state history. Both
 * tools are read-only in every permission mode and reply with lean events.
 */

import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import {
  launchServer,
  findAvailablePort,
  cleanupServers,
  ServerInstance,
  TransportMode,
  HOST,
} from "./utils/server-launcher.js";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";
import { CustomHeaderClient } from "./clients/custom-header-client.js";

const MOCK_TOKEN = "glpat-issue-resource-events-test-token";
const TEST_PROJECT_ID = "123";
const TEST_ISSUE_IID = "17";
const MCP_PORT_BASE = 3900;
const EVENT_TOOLS = ["list_issue_label_events", "list_issue_state_events"];

function mockUser(id: number, username: string) {
  return {
    id,
    name: `User ${username}`,
    username,
    state: "active",
    avatar_url: `https://gitlab.mock/avatar/${id}.png`,
    web_url: `https://gitlab.mock/${username}`,
  };
}

const LABEL_EVENTS = [
  {
    id: 142,
    user: mockUser(1, "alice"),
    created_at: "2026-10-01T09:00:00.000Z",
    resource_type: "Issue",
    resource_id: 9017,
    label: {
      id: 73,
      name: "workflow::in progress",
      color: "#428BCA",
      description: "Being worked on",
    },
    action: "add",
  },
  {
    id: 143,
    user: mockUser(2, "bob"),
    created_at: "2026-10-02T10:30:00.000Z",
    resource_type: "Issue",
    resource_id: 9017,
    // The label was deleted after the event.
    label: null,
    action: "remove",
  },
];

const STATE_EVENTS = [
  {
    id: 201,
    user: mockUser(2, "bob"),
    created_at: "2026-10-03T08:00:00.000Z",
    resource_type: "Issue",
    resource_id: 9017,
    state: "closed",
  },
  {
    id: 202,
    user: null,
    created_at: "2026-10-04T12:00:00.000Z",
    resource_type: "Issue",
    resource_id: 9017,
    state: "reopened",
  },
];

const LEAN_LABEL_EVENTS = [
  {
    created_at: "2026-10-01T09:00:00.000Z",
    user: { username: "alice" },
    action: "add",
    label: { name: "workflow::in progress" },
  },
  {
    created_at: "2026-10-02T10:30:00.000Z",
    user: { username: "bob" },
    action: "remove",
    label: null,
  },
];

const LEAN_STATE_EVENTS = [
  { created_at: "2026-10-03T08:00:00.000Z", user: { username: "bob" }, state: "closed" },
  { created_at: "2026-10-04T12:00:00.000Z", user: null, state: "reopened" },
];

interface RecordedRequest {
  path: string;
  query: Record<string, unknown>;
}

function resultText(result: { content: unknown }): string {
  return (result.content as Array<{ text?: string }>)[0]?.text ?? "";
}

describe("list_issue_label_events and list_issue_state_events", () => {
  let mockGitLab: MockGitLabServer;
  let server: ServerInstance;
  let client: CustomHeaderClient;
  const requests: RecordedRequest[] = [];

  async function launch(extraEnv: Record<string, string> = {}): Promise<ServerInstance> {
    return launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: await findAvailablePort(MCP_PORT_BASE + Math.floor(Math.random() * 50)),
      timeout: 10000,
      env: {
        STREAMABLE_HTTP: "true",
        REMOTE_AUTHORIZATION: "true",
        GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
        GITLAB_ACCESS_TOKEN: MOCK_TOKEN,
        GITLAB_TOOLSETS: "issues",
        ...extraEnv,
      },
    });
  }

  async function connect(target: ServerInstance): Promise<CustomHeaderClient> {
    const c = new CustomHeaderClient({
      headers: { authorization: `Bearer ${MOCK_TOKEN}` },
    });
    await c.connect(`http://${HOST}:${target.port ?? 0}/mcp`);
    return c;
  }

  async function assertListedReadOnly(target: CustomHeaderClient): Promise<void> {
    const tools = (await target.listTools()).tools;
    for (const name of EVENT_TOOLS) {
      const tool = tools.find(t => t.name === name);
      assert.ok(tool, `${name} should be listed`);
      assert.strictEqual(tool.annotations?.readOnlyHint, true, `${name} must be read-only`);
    }
  }

  before(async () => {
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });
    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_IID}/resource_label_events`,
      (req, res) => {
        requests.push({ path: req.path, query: { ...req.query } });
        res.json(LABEL_EVENTS);
      }
    );
    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_IID}/resource_state_events`,
      (req, res) => {
        requests.push({ path: req.path, query: { ...req.query } });
        res.json(STATE_EVENTS);
      }
    );
    for (const resource of ["resource_label_events", "resource_state_events"]) {
      mockGitLab.addMockHandler(
        "get",
        `/projects/${TEST_PROJECT_ID}/issues/404/${resource}`,
        (_req, res) => {
          res.status(404).json({ message: "404 Issue Not Found" });
        }
      );
    }
    await mockGitLab.start();

    server = await launch();
    client = await connect(server);
  });

  after(async () => {
    await client?.disconnect();
    cleanupServers([server]);
    await mockGitLab?.stop();
  });

  test("are listed as read-only tools in the issues toolset", async () => {
    await assertListedReadOnly(client);
  });

  test("list_issue_label_events returns lean events, deleted labels as null", async () => {
    requests.length = 0;
    const result = await client.callTool("list_issue_label_events", {
      project_id: TEST_PROJECT_ID,
      issue_iid: TEST_ISSUE_IID,
    });
    assert.notStrictEqual(result.isError, true, resultText(result));
    assert.deepStrictEqual(JSON.parse(resultText(result)), LEAN_LABEL_EVENTS);
    assert.strictEqual(requests.length, 1);
    assert.strictEqual(
      requests[0].path,
      `/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_IID}/resource_label_events`
    );
    assert.deepStrictEqual(requests[0].query, {});
  });

  test("list_issue_state_events returns lean events, missing users as null", async () => {
    requests.length = 0;
    const result = await client.callTool("list_issue_state_events", {
      project_id: TEST_PROJECT_ID,
      issue_iid: TEST_ISSUE_IID,
    });
    assert.notStrictEqual(result.isError, true, resultText(result));
    assert.deepStrictEqual(JSON.parse(resultText(result)), LEAN_STATE_EVENTS);
    assert.strictEqual(requests.length, 1);
    assert.strictEqual(
      requests[0].path,
      `/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_IID}/resource_state_events`
    );
  });

  test("pass page and per_page to GitLab as query params", async () => {
    requests.length = 0;
    const labelResult = await client.callTool("list_issue_label_events", {
      project_id: TEST_PROJECT_ID,
      issue_iid: TEST_ISSUE_IID,
      page: 2,
      per_page: 50,
    });
    assert.notStrictEqual(labelResult.isError, true, resultText(labelResult));
    const stateResult = await client.callTool("list_issue_state_events", {
      project_id: TEST_PROJECT_ID,
      issue_iid: TEST_ISSUE_IID,
      page: "3",
      per_page: "10",
    });
    assert.notStrictEqual(stateResult.isError, true, resultText(stateResult));

    assert.deepStrictEqual(
      requests.map(r => r.query),
      [
        { page: "2", per_page: "50" },
        { page: "3", per_page: "10" },
      ]
    );
  });

  test("surface a GitLab 404 as a tool error", async () => {
    const results = [
      await client.callTool("list_issue_label_events", {
        project_id: TEST_PROJECT_ID,
        issue_iid: "404",
      }),
      await client.callTool("list_issue_state_events", {
        project_id: TEST_PROJECT_ID,
        issue_iid: "404",
      }),
    ];
    for (const result of results) {
      assert.strictEqual(result.isError, true, "GitLab 404 should be a tool error");
      assert.match(resultText(result), /GitLab API error: 404/);
    }
  });

  test("reject a dot path segment as issue_iid before calling GitLab", async () => {
    requests.length = 0;
    await assert.rejects(
      client.callTool("list_issue_label_events", {
        project_id: TEST_PROJECT_ID,
        issue_iid: "..",
      }),
      /Cannot use value as a GitLab URL path segment/
    );
    await assert.rejects(
      client.callTool("list_issue_state_events", {
        project_id: TEST_PROJECT_ID,
        issue_iid: "..",
      }),
      /Cannot use value as a GitLab URL path segment/
    );
    assert.strictEqual(requests.length, 0, "GitLab must not be called");
  });

  for (const mode of ["readonly", "modify"]) {
    describe(`GITLAB_PERMISSION_MODE=${mode}`, () => {
      let modeServer: ServerInstance;
      let modeClient: CustomHeaderClient;

      before(async () => {
        modeServer = await launch({ GITLAB_PERMISSION_MODE: mode });
        modeClient = await connect(modeServer);
      });

      after(async () => {
        await modeClient?.disconnect();
        cleanupServers([modeServer]);
      });

      test("lists both tools as read-only", async () => {
        await assertListedReadOnly(modeClient);
      });

      test("serves list_issue_label_events", async () => {
        const result = await modeClient.callTool("list_issue_label_events", {
          project_id: TEST_PROJECT_ID,
          issue_iid: TEST_ISSUE_IID,
        });
        assert.notStrictEqual(result.isError, true, resultText(result));
        assert.deepStrictEqual(JSON.parse(resultText(result)), LEAN_LABEL_EVENTS);
      });
    });
  }

  describe("summary: true", () => {
    test("keeps the lean label events complete", async () => {
      const result = await client.callTool("list_issue_label_events", {
        project_id: TEST_PROJECT_ID,
        issue_iid: TEST_ISSUE_IID,
        summary: true,
      });
      assert.notStrictEqual(result.isError, true, resultText(result));
      assert.deepStrictEqual(JSON.parse(resultText(result)), LEAN_LABEL_EVENTS);
    });

    test("keeps the lean state events complete", async () => {
      const result = await client.callTool("list_issue_state_events", {
        project_id: TEST_PROJECT_ID,
        issue_iid: TEST_ISSUE_IID,
        summary: true,
      });
      assert.notStrictEqual(result.isError, true, resultText(result));
      assert.deepStrictEqual(JSON.parse(resultText(result)), LEAN_STATE_EVENTS);
    });
  });
});
