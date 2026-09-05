import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-work-item-iteration-test";
const PROJECT_ID = "9";
const WORK_ITEM_IID = 1;

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

describe("update_work_item iteration widget", () => {
  let mockServer: MockGitLabServer;
  let mutationInput: Record<string, unknown> | undefined;

  before(async () => {
    const port = await findMockServerPort();
    mockServer = new MockGitLabServer({ port, validTokens: [MOCK_TOKEN] });

    mockServer.addMockHandler("get", `/projects/${PROJECT_ID}`, (_req, res) => {
      res.json({ id: Number(PROJECT_ID), path_with_namespace: "test-group/test-project" });
    });

    mockServer.addRootHandler("post", "/api/graphql", (req, res) => {
      const { query, variables } = req.body;

      if (typeof query === "string" && query.includes("workItem(iid: $iid)")) {
        res.json({
          data: { namespace: { workItem: { id: "gid://gitlab/WorkItem/1" } } },
        });
        return;
      }

      if (typeof query === "string" && query.includes("workItemUpdate")) {
        mutationInput = variables;
        res.json({
          data: {
            workItemUpdate: {
              workItem: {
                id: variables.id,
                iid: String(WORK_ITEM_IID),
                title: "Work item",
                state: "OPEN",
                webUrl: "https://gitlab.mock/-/work_items/1",
                workItemType: { name: "Issue" },
                widgets: [
                  {
                    __typename: "WorkItemWidgetIteration",
                    iteration: variables.iterationId
                      ? { id: variables.iterationId, iid: "13", title: "Sprint 1" }
                      : null,
                  },
                ],
              },
              errors: [],
            },
          },
        });
        return;
      }

      res.status(500).json({ message: `Unexpected GraphQL query: ${query}` });
    });

    await mockServer.start();
  });

  beforeEach(() => {
    mutationInput = undefined;
  });

  after(async () => {
    await mockServer.stop();
  });

  const env = () => ({
    GITLAB_API_URL: `${mockServer.getUrl()}/api/v4`,
    GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
    GITLAB_PROJECT_ID: PROJECT_ID,
  });

  test("assigns an iteration by ID", async () => {
    const result = await callTool(
      "update_work_item",
      { project_id: PROJECT_ID, iid: WORK_ITEM_IID, iteration_id: "53" },
      env()
    );

    assert.equal(mutationInput?.iterationId, "gid://gitlab/Iteration/53");
    assert.deepEqual(result.iteration, {
      id: "gid://gitlab/Iteration/53",
      iid: "13",
      title: "Sprint 1",
    });
  });

  test("removes the iteration association with remove_iteration", async () => {
    const result = await callTool(
      "update_work_item",
      { project_id: PROJECT_ID, iid: WORK_ITEM_IID, remove_iteration: true },
      env()
    );

    assert.equal(mutationInput?.iterationId, undefined);
    assert.equal(result.iteration, null);
  });

  test("rejects passing both iteration_id and remove_iteration", async () => {
    await assert.rejects(
      () =>
        callTool(
          "update_work_item",
          {
            project_id: PROJECT_ID,
            iid: WORK_ITEM_IID,
            iteration_id: "53",
            remove_iteration: true,
          },
          env()
        ),
      /iteration_id or remove_iteration/
    );
    assert.equal(mutationInput, undefined);
  });
});
