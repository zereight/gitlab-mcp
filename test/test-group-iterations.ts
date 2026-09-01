import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-group-iteration-test";
const GROUP_ID = "5";
const ITERATION_ID = "53";

type Iteration = {
  id: number;
  iid: number;
  sequence: number;
  group_id: number;
  title: string;
  description: string | null;
  state: number;
  created_at: string;
  updated_at: string;
  start_date: string;
  due_date: string;
  web_url: string;
};

const baseIteration = (): Iteration => ({
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
  web_url: "https://gitlab.example.com/groups/test-group/-/iterations/13",
});

async function callTool(
  name: string,
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): Promise<any> {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
    let output = "";
    let errorOutput = "";
    proc.stdout?.on("data", data => (output += data));
    proc.stderr?.on("data", data => (errorOutput += data));

    proc.on("close", code => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
        return;
      }
      const line = output.split("\n").find(value => value.startsWith("{"));
      if (!line) {
        reject(new Error("No JSON output found"));
        return;
      }
      const response = JSON.parse(line);
      if (response.error) {
        reject(new Error(response.error?.message ?? String(response.error)));
        return;
      }
      const content = response.result?.content?.[0]?.text;
      if (response.result?.isError) {
        reject(new Error(content ?? "Tool call failed"));
        return;
      }
      resolve(content ? JSON.parse(content) : response.result);
    });

    proc.stdin?.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args },
      }) + "\n"
    );
  });
}

describe("group iteration tools", () => {
  let mockServer: MockGitLabServer;
  let iteration: Iteration;
  let mutationErrors: string[];
  let mutationInput: Record<string, unknown> | undefined;

  before(async () => {
    const port = await findMockServerPort();
    mockServer = new MockGitLabServer({ port, validTokens: [MOCK_TOKEN] });

    mockServer.addMockHandler("get", `/groups/${GROUP_ID}/iterations`, (_req, res) => {
      res.json([iteration]);
    });
    mockServer.addMockHandler("get", `/groups/${GROUP_ID}`, (_req, res) => {
      res.json({ id: 5, full_path: "test-group" });
    });
    mockServer.addRootHandler("post", "/api/graphql", (req, res) => {
      mutationInput = req.body.variables.input as Record<string, unknown>;
      if (mutationErrors.length === 0) {
        iteration = {
          ...iteration,
          ...(mutationInput.title !== undefined ? { title: mutationInput.title as string } : {}),
          ...(mutationInput.description !== undefined
            ? { description: mutationInput.description as string | null }
            : {}),
          ...(mutationInput.startDate !== undefined
            ? { start_date: mutationInput.startDate as string }
            : {}),
          ...(mutationInput.dueDate !== undefined
            ? { due_date: mutationInput.dueDate as string }
            : {}),
          updated_at: "2026-09-01T12:00:00Z",
        };
      }
      res.json({
        data: {
          updateIteration: {
            iteration:
              mutationErrors.length === 0 ? { id: `gid://gitlab/Iteration/${ITERATION_ID}` } : null,
            errors: mutationErrors,
          },
        },
      });
    });
    await mockServer.start();
  });

  beforeEach(() => {
    iteration = baseIteration();
    mutationErrors = [];
    mutationInput = undefined;
  });

  after(async () => {
    await mockServer.stop();
  });

  const env = () => ({
    GITLAB_API_URL: `${mockServer.getUrl()}/api/v4`,
    GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
    GITLAB_TOOLSETS: "projects",
  });

  test("gets an iteration by ID, IID, or GraphQL GID", async () => {
    const byId = await callTool(
      "get_group_iteration",
      {
        group_id: GROUP_ID,
        iteration_id: ITERATION_ID,
      },
      env()
    );
    const byIid = await callTool(
      "get_group_iteration",
      {
        group_id: GROUP_ID,
        iteration_id: "13",
      },
      env()
    );
    const byGid = await callTool(
      "get_group_iteration",
      {
        group_id: GROUP_ID,
        iteration_id: `gid://gitlab/Iteration/${ITERATION_ID}`,
      },
      env()
    );

    assert.equal(byId.id, ITERATION_ID);
    assert.equal(byIid.id, ITERATION_ID);
    assert.equal(byGid.iid, "13");
  });

  test("updates an iteration through GraphQL and reads it back", async () => {
    const result = await callTool(
      "update_group_iteration",
      {
        group_id: GROUP_ID,
        iteration_id: "13",
        title: "Sprint Goal",
        description: "Goal and checkpoint",
        start_date: "2026-09-08",
        due_date: "2026-09-14",
      },
      env()
    );

    assert.deepEqual(mutationInput, {
      groupPath: "test-group",
      id: `gid://gitlab/Iteration/${ITERATION_ID}`,
      title: "Sprint Goal",
      description: "Goal and checkpoint",
      startDate: "2026-09-08",
      dueDate: "2026-09-14",
    });
    assert.equal(result.title, "Sprint Goal");
    assert.equal(result.description, "Goal and checkpoint");
    assert.equal(result.start_date, "2026-09-08");
    assert.equal(result.due_date, "2026-09-14");
  });

  test("rejects an empty update before calling GitLab", async () => {
    await assert.rejects(
      () =>
        callTool(
          "update_group_iteration",
          { group_id: GROUP_ID, iteration_id: ITERATION_ID },
          env()
        ),
      /Provide at least one iteration field/
    );
    assert.equal(mutationInput, undefined);
  });

  test("surfaces GitLab mutation errors", async () => {
    mutationErrors = ["Manual iteration updates are not allowed"];

    await assert.rejects(
      () =>
        callTool(
          "update_group_iteration",
          {
            group_id: GROUP_ID,
            iteration_id: ITERATION_ID,
            description: "New goal",
          },
          env()
        ),
      /Manual iteration updates are not allowed/
    );
  });
});
