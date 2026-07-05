import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-mr-pipelines-test-token";
const TEST_PROJECT_ID = "123";
const TEST_MR_IID = "1";

async function callTool(
  toolName: string,
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv
) {
  return new Promise<any>((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...env,
        GITLAB_READ_ONLY_MODE: "true",
      },
    });

    let output = "";
    let errorOutput = "";
    proc.stdout?.on("data", d => output += d);
    proc.stderr?.on("data", d => errorOutput += d);

    proc.on("close", code => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
        return;
      }

      const line = output.split("\n").find(l => l.startsWith("{"));
      if (!line) {
        reject(new Error("No JSON output found"));
        return;
      }

      try {
        const response = JSON.parse(line);
        if (response.error) {
          reject(response.error);
          return;
        }

        const content = response.result?.content?.[0]?.text;
        resolve(content ? JSON.parse(content) : response.result);
      } catch (error) {
        reject(error);
      }
    });

    proc.stdin?.end(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }) + "\n");
  });
}

describe("list_merge_request_pipelines", () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;
  let lastQuery: Record<string, unknown> = {};

  before(async () => {
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/merge_requests/${TEST_MR_IID}/pipelines`,
      (req, res) => {
        lastQuery = { ...req.query };
        res.json([
          {
            id: 77,
            sha: "959e04d7c7a30600c894bd3c0cd0e1ce7f42c11d",
            ref: "main",
            status: "success",
          },
          {
            id: 78,
            sha: "a59e04d7c7a30600c894bd3c0cd0e1ce7f42c22e",
            ref: "refs/merge-requests/1/head",
            status: "running",
            source: "merge_request_event",
            web_url: "https://gitlab.mock/test/project/-/pipelines/78",
          },
        ]);
      }
    );

    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  test("lists pipelines for a merge request", async () => {
    const pipelines = await callTool(
      "list_merge_request_pipelines",
      {
        project_id: TEST_PROJECT_ID,
        merge_request_iid: TEST_MR_IID,
        page: 2,
        per_page: 10,
      },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.ok(Array.isArray(pipelines), "Response should be an array");
    assert.strictEqual(pipelines.length, 2);
    assert.strictEqual(pipelines[0].id, "77");
    assert.strictEqual(pipelines[0].status, "success");
    assert.strictEqual(pipelines[1].source, "merge_request_event");
    assert.strictEqual(lastQuery.page, "2");
    assert.strictEqual(lastQuery.per_page, "10");
  });
});
