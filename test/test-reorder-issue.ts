/**
 * Tests for the reorder_issue tool (issue #958).
 * PUT /projects/:id/issues/:issue_iid/reorder moves an issue in the manual
 * sort order used by issue boards. move_after_id / move_before_id are global
 * issue ids, at least one is required, and the tool is a write tool.
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

const MOCK_TOKEN = "glpat-reorder-issue-test-token";
const TEST_PROJECT_ID = "123";
const TEST_ISSUE_IID = "17";
const MCP_PORT_BASE = 3850;

interface RecordedRequest {
  method: string;
  path: string;
  body: Record<string, unknown>;
}

function mockIssue(iid: string) {
  return {
    id: 9000 + Number(iid),
    iid: Number(iid),
    project_id: Number(TEST_PROJECT_ID),
    title: `Issue ${iid}`,
    description: "A board card",
    state: "opened",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    closed_at: null,
    web_url: `https://gitlab.mock/project/${TEST_PROJECT_ID}/issues/${iid}`,
    author: {
      id: 1,
      username: "test-user",
      name: "Test User",
      avatar_url: null,
      web_url: "https://gitlab.mock/test-user",
    },
    assignees: [],
    labels: [],
    milestone: null,
  };
}

function resultText(result: { content: unknown }): string {
  return (result.content as Array<{ text?: string }>)[0]?.text ?? "";
}

describe("reorder_issue", () => {
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

  before(async () => {
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });
    mockGitLab.addMockHandler(
      "put",
      `/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_IID}/reorder`,
      (req, res) => {
        requests.push({
          method: req.method,
          path: req.path,
          body: (req.body ?? {}) as Record<string, unknown>,
        });
        res.json(mockIssue(TEST_ISSUE_IID));
      }
    );
    mockGitLab.addMockHandler(
      "put",
      `/projects/${TEST_PROJECT_ID}/issues/404/reorder`,
      (_req, res) => {
        res.status(404).json({ message: "404 Issue Not Found" });
      }
    );
    await mockGitLab.start();

    server = await launch();
    client = await connect(server);
  });

  after(async () => {
    await client?.disconnect();
    cleanupServers([server]);
    await mockGitLab?.stop();
  });

  test("is listed as a write tool in the issues toolset", async () => {
    const names = (await client.listTools()).tools.map(t => t.name);
    assert.ok(names.includes("reorder_issue"), "reorder_issue should be listed");
    const tool = (await client.listTools()).tools.find(t => t.name === "reorder_issue");
    assert.strictEqual(
      tool?.annotations?.readOnlyHint,
      undefined,
      "reorder_issue must not advertise readOnlyHint"
    );
    assert.match(tool?.description ?? "", /global id/i);
    assert.match(tool?.description ?? "", /not its iid/i);
  });

  test("sends PUT .../issues/:iid/reorder with move_after_id only", async () => {
    requests.length = 0;
    const result = await client.callTool("reorder_issue", {
      project_id: TEST_PROJECT_ID,
      issue_iid: TEST_ISSUE_IID,
      move_after_id: 9042,
    });
    assert.notStrictEqual(result.isError, true, resultText(result));

    assert.strictEqual(requests.length, 1);
    assert.strictEqual(requests[0].method, "PUT");
    assert.strictEqual(
      requests[0].path,
      `/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_IID}/reorder`
    );
    assert.deepStrictEqual(requests[0].body, { move_after_id: 9042 });

    const issue = JSON.parse(resultText(result));
    assert.strictEqual(issue.iid, TEST_ISSUE_IID);
    assert.strictEqual(issue.id, String(9000 + Number(TEST_ISSUE_IID)));
    assert.ok(issue.web_url, "updated issue should be returned");
    assert.strictEqual(issue.title, `Issue ${TEST_ISSUE_IID}`);
  });

  test("sends move_before_id only and omits move_after_id from the body", async () => {
    requests.length = 0;
    const result = await client.callTool("reorder_issue", {
      project_id: TEST_PROJECT_ID,
      issue_iid: TEST_ISSUE_IID,
      move_before_id: 9007,
    });
    assert.notStrictEqual(result.isError, true, resultText(result));
    assert.deepStrictEqual(requests[0].body, { move_before_id: 9007 });
  });

  test("sends both ids and coerces numeric strings", async () => {
    requests.length = 0;
    const result = await client.callTool("reorder_issue", {
      project_id: TEST_PROJECT_ID,
      issue_iid: TEST_ISSUE_IID,
      move_after_id: "9042",
      move_before_id: "9007",
    });
    assert.notStrictEqual(result.isError, true, resultText(result));
    assert.deepStrictEqual(requests[0].body, { move_after_id: 9042, move_before_id: 9007 });
  });

  test("does not leak project_id or issue_iid into the request body", async () => {
    requests.length = 0;
    await client.callTool("reorder_issue", {
      project_id: TEST_PROJECT_ID,
      issue_iid: TEST_ISSUE_IID,
      move_after_id: 9042,
    });
    assert.deepStrictEqual(Object.keys(requests[0].body).sort(), ["move_after_id"]);
  });

  test("rejects a call with neither move_after_id nor move_before_id before calling GitLab", async () => {
    requests.length = 0;
    const result = await client.callTool("reorder_issue", {
      project_id: TEST_PROJECT_ID,
      issue_iid: TEST_ISSUE_IID,
    });
    assert.strictEqual(result.isError, true, "missing both ids should be a tool error");
    assert.match(
      resultText(result),
      /^Invalid arguments for reorder_issue: At least one of 'move_after_id' or 'move_before_id' must be provided$/
    );
    assert.strictEqual(requests.length, 0, "GitLab must not be called");
  });

  test("surfaces GitLab errors for an unknown issue as a tool error", async () => {
    const result = await client.callTool("reorder_issue", {
      project_id: TEST_PROJECT_ID,
      issue_iid: "404",
      move_after_id: 9042,
    });
    assert.strictEqual(result.isError, true, "GitLab 404 should be a tool error");
    assert.match(resultText(result), /GitLab API error: 404/);
  });

  describe("GITLAB_PERMISSION_MODE=readonly", () => {
    let readonlyServer: ServerInstance;
    let readonlyClient: CustomHeaderClient;

    before(async () => {
      readonlyServer = await launch({ GITLAB_PERMISSION_MODE: "readonly" });
      readonlyClient = await connect(readonlyServer);
    });

    after(async () => {
      await readonlyClient?.disconnect();
      cleanupServers([readonlyServer]);
    });

    test("hides reorder_issue from tools/list", async () => {
      const names = (await readonlyClient.listTools()).tools.map(t => t.name);
      assert.ok(!names.includes("reorder_issue"), "reorder_issue must be hidden in readonly");
      assert.ok(names.includes("get_issue"), "read tools stay listed");
    });

    test("rejects reorder_issue calls", async () => {
      requests.length = 0;
      await assert.rejects(
        () =>
          readonlyClient.callTool("reorder_issue", {
            project_id: TEST_PROJECT_ID,
            issue_iid: TEST_ISSUE_IID,
            move_after_id: 9042,
          }),
        (error: Error) => error.message.includes("not allowed in read-only mode")
      );
      assert.strictEqual(requests.length, 0, "GitLab must not be called");
    });
  });

  describe("GITLAB_PERMISSION_MODE=modify", () => {
    let modifyServer: ServerInstance;
    let modifyClient: CustomHeaderClient;

    before(async () => {
      modifyServer = await launch({ GITLAB_PERMISSION_MODE: "modify" });
      modifyClient = await connect(modifyServer);
    });

    after(async () => {
      await modifyClient?.disconnect();
      cleanupServers([modifyServer]);
    });

    test("keeps reorder_issue available (reversible write, not destructive)", async () => {
      const names = (await modifyClient.listTools()).tools.map(t => t.name);
      assert.ok(names.includes("reorder_issue"), "reorder_issue should be listed in modify");
      assert.ok(!names.includes("delete_issue"), "delete_issue stays hidden in modify");
    });
  });
});
