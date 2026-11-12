/**
 * Regression test: get_merge_request_conflicts used to call a REST endpoint
 * (GET /projects/:id/merge_requests/:iid/conflicts) that does not exist on
 * GitLab's REST API v4, so every call failed with 404. Conflict data is only
 * available over GraphQL (MergeRequest.conflicts/conflictStatus/conflictFiles).
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";
import { expectToolError } from "./utils/tool-error.js";

const MOCK_TOKEN = "glpat-mock-token-conflicts";
const TEST_PROJECT_ID = "456";
const TEST_PROJECT_FULL_PATH = "test-group/test-project";
const TEST_MR_IID = "42";
const TEST_MR_IID_LEGACY = "43";
const TEST_MR_IID_MISSING = "44";

async function callTool(
  toolName: string,
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
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
      if (!line) {
        return reject(new Error("No JSON output found"));
      }

      try {
        const response = JSON.parse(line);
        if (response.error) {
          reject(new Error(response.error?.message ?? String(response.error)));
          return;
        }
        if (response.result?.isError === true) {
          resolve(response.result);
          return;
        }
        const content = response.result?.content?.[0]?.text;
        resolve(content ? JSON.parse(content) : response.result);
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

describe("get_merge_request_conflicts", () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;
  let lastVariables: any = null;

  const baseEnv = () => ({
    GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
    GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
    GITLAB_TOOLSETS: "merge_requests",
  });

  before(async () => {
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });

    mockGitLab.addRootHandler("post", "/api/graphql", (req, res) => {
      const query: string = req.body.query || "";
      const variables = req.body.variables || {};
      lastVariables = variables;

      if (variables.iid === TEST_MR_IID_MISSING) {
        res.json({ data: { project: { mergeRequest: null } } });
        return;
      }

      if (variables.iid === TEST_MR_IID_LEGACY) {
        if (query.includes("conflictStatus") || query.includes("conflictFiles")) {
          res.status(200).json({
            errors: [
              { message: "Field 'conflictStatus' doesn't exist on type 'MergeRequest'" },
              { message: "Field 'conflictFiles' doesn't exist on type 'MergeRequest'" },
            ],
          });
          return;
        }
        res.json({
          data: { project: { mergeRequest: { conflicts: true } } },
        });
        return;
      }

      res.json({
        data: {
          project: {
            mergeRequest: {
              conflicts: true,
              conflictStatus: "HAS_CONFLICTS",
              conflictFiles: [
                {
                  ourPath: "src/app.ts",
                  theirPath: "src/app.ts",
                  content: "<<<<<<< ours\n=======\n>>>>>>> theirs",
                },
              ],
            },
          },
        },
      });
    });

    mockGitLab.addMockHandler("get", `/projects/${TEST_PROJECT_ID}`, (_req, res) => {
      res.json({
        id: Number(TEST_PROJECT_ID),
        path_with_namespace: TEST_PROJECT_FULL_PATH,
      });
    });

    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  test("resolves numeric project ID to full path for the GraphQL query", async () => {
    lastVariables = null;

    await callTool(
      "get_merge_request_conflicts",
      { project_id: TEST_PROJECT_ID, merge_request_iid: TEST_MR_IID },
      baseEnv()
    );

    assert.ok(lastVariables, "GraphQL variables should have been captured");
    assert.strictEqual(lastVariables.fullPath, TEST_PROJECT_FULL_PATH);
    assert.strictEqual(lastVariables.iid, TEST_MR_IID);
  });

  test("returns conflict status and files when the instance supports them", async () => {
    const result = await callTool(
      "get_merge_request_conflicts",
      { project_id: TEST_PROJECT_ID, merge_request_iid: TEST_MR_IID },
      baseEnv()
    );

    assert.strictEqual(result.has_conflicts, true);
    assert.strictEqual(result.conflict_status, "HAS_CONFLICTS");
    assert.strictEqual(result.conflict_files.length, 1);
    assert.strictEqual(result.conflict_files[0].ourPath, "src/app.ts");
  });

  test("falls back to the conflicts boolean when the instance lacks conflictStatus/conflictFiles", async () => {
    const result = await callTool(
      "get_merge_request_conflicts",
      { project_id: TEST_PROJECT_ID, merge_request_iid: TEST_MR_IID_LEGACY },
      baseEnv()
    );

    assert.strictEqual(result.has_conflicts, true);
    assert.strictEqual(result.conflict_status, undefined);
    assert.strictEqual(result.conflict_files, undefined);
  });

  test("errors clearly when the merge request does not exist", async () => {
    // A tool result (not a JSON-RPC error) that keeps the old text and adds a hint.
    const text = await expectToolError(
      callTool(
        "get_merge_request_conflicts",
        { project_id: TEST_PROJECT_ID, merge_request_iid: TEST_MR_IID_MISSING },
        baseEnv()
      ),
      new RegExp(`^Merge request !${TEST_MR_IID_MISSING} not found in project \\S+\\nNext: `)
    );
    assert.match(text, /check merge_request_iid/);
    assert.strictEqual(text.split("\nNext: ").length, 2);
  });
});
