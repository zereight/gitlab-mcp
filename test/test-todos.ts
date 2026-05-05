import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-todos-test-token";

async function callTool(
  toolName: string,
  args: Record<string, any>,
  env: NodeJS.ProcessEnv
): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...env,
      },
    });

    let output = "";
    let errorOutput = "";
    proc.stdout?.on("data", (d: Buffer) => (output += d));
    proc.stderr?.on("data", (d: Buffer) => (errorOutput += d));

    proc.on("close", code => {
      if (code !== 0) {
        return reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
      }

      const line = output.split("\n").find(l => l.startsWith("{"));
      if (!line) return reject(new Error("No JSON output found"));

      try {
        const response = JSON.parse(line);
        if (response.error) {
          reject(response.error);
        } else {
          const content = response.result?.content?.[0]?.text;
          resolve(content ? JSON.parse(content) : response.result);
        }
      } catch (e) {
        reject(e);
      }
    });

    proc.stdin?.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: toolName, arguments: args },
      }) + "\n"
    );
  });
}

async function listToolNames(env: NodeJS.ProcessEnv): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...env,
      },
    });

    let output = "";
    let errorOutput = "";
    proc.stdout?.on("data", (d: Buffer) => (output += d));
    proc.stderr?.on("data", (d: Buffer) => (errorOutput += d));

    proc.on("close", code => {
      if (code !== 0) {
        return reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
      }

      const line = output.split("\n").find(l => l.startsWith("{"));
      if (!line) return reject(new Error("No JSON output found"));

      try {
        const response = JSON.parse(line);
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response.result.tools.map((tool: { name: string }) => tool.name));
        }
      } catch (e) {
        reject(e);
      }
    });

    proc.stdin?.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }) + "\n"
    );
  });
}

function todoFixture(id: number, state = "pending") {
  return {
    id,
    project: { id: 123, path_with_namespace: "group/project" },
    author: { id: 1, username: "root" },
    action_name: "marked",
    target_type: "MergeRequest",
    target: { id: 34, iid: 7, project_id: 123, title: "Review this MR" },
    target_url: "https://gitlab.example.com/group/project/-/merge_requests/7",
    body: "Review this MR",
    state,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("GitLab todos tools", () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;

  before(async () => {
    const mockPort = await findMockServerPort(9250);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });

    mockGitLab.addMockHandler("get", "/todos", (req, res) => {
      assert.strictEqual(req.query.state, "pending");
      assert.strictEqual(req.query.action, "assigned");
      assert.strictEqual(req.query.project_id, "123");
      assert.strictEqual(req.query.page, "2");
      assert.strictEqual(req.query.per_page, "5");
      res.json([todoFixture(102)]);
    });

    mockGitLab.addMockHandler("post", "/todos/102/mark_as_done", (req, res) => {
      res.json(todoFixture(102, "done"));
    });

    mockGitLab.addMockHandler("post", "/todos/mark_as_done", (req, res) => {
      res.status(204).send();
    });

    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  test("list_todos sends filters and returns todos", async () => {
    const result = await callTool(
      "list_todos",
      {
        state: "pending",
        action: "assigned",
        project_id: 123,
        page: 2,
        per_page: 5,
      },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.ok(Array.isArray(result));
    assert.strictEqual(result[0].id, 102);
    assert.strictEqual(result[0].state, "pending");
  });

  test("mark_todo_done marks one todo done", async () => {
    const result = await callTool(
      "mark_todo_done",
      { id: 102 },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.strictEqual(result.id, 102);
    assert.strictEqual(result.state, "done");
  });

  test("mark_all_todos_done reports success", async () => {
    const result = await callTool(
      "mark_all_todos_done",
      {},
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.deepStrictEqual(result, {
      status: "success",
      message: "All pending to-do items marked as done",
    });
  });

  test("todo tools are visible in the default issues toolset", async () => {
    const tools = await listToolNames({
      GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
    });

    assert.ok(tools.includes("list_todos"));
    assert.ok(tools.includes("mark_todo_done"));
    assert.ok(tools.includes("mark_all_todos_done"));
  });

  test("read-only mode keeps list_todos and hides todo mutations", async () => {
    const tools = await listToolNames({
      GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      GITLAB_READ_ONLY_MODE: "true",
    });

    assert.ok(tools.includes("list_todos"));
    assert.ok(!tools.includes("mark_todo_done"));
    assert.ok(!tools.includes("mark_all_todos_done"));
  });
});
