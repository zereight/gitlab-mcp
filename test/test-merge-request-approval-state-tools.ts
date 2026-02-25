import { after, before, describe, test } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-mock-token-approval";
const TEST_PROJECT_ID = "123";
const TEST_MR_IID_WITH_FALLBACK = "88";
const TEST_MR_IID_WITH_APPROVAL_STATE = "89";

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
        GITLAB_READ_ONLY_MODE: "true",
        USE_PIPELINE: "true",
      },
    });

    let output = "";
    let errorOutput = "";
    proc.stdout?.on("data", (d: Buffer) => (output += d));
    proc.stderr?.on("data", (d: Buffer) => (errorOutput += d));

    proc.on("close", (code) => {
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
          reject(response.error);
        } else {
          const content = response.result?.content?.[0]?.text;
          if (content) {
            try {
              resolve(JSON.parse(content));
            } catch {
              resolve(content);
            }
          } else {
            resolve(response.result);
          }
        }
      } catch (error) {
        reject(error);
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

describe("merge request approval state tools", () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;

  before(async () => {
    const mockPort = await findMockServerPort(9400);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/merge_requests/${TEST_MR_IID_WITH_FALLBACK}/approval_state`,
      (_req, res) => {
        res.status(404).json({ error: "404 Not Found" });
      }
    );

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/merge_requests/${TEST_MR_IID_WITH_FALLBACK}/approvals`,
      (_req, res) => {
        res.json({
          approved: true,
          user_has_approved: false,
          user_can_approve: true,
          approved_by: [
            {
              user: {
                id: "35",
                username: "sergey.kravchenya",
                name: "Sergey Kravchenya",
                state: "active",
                avatar_url: "https://gitlab.mock/uploads/avatar.png",
                web_url: "https://gitlab.mock/sergey.kravchenya",
              },
            },
          ],
        });
      }
    );

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/merge_requests/${TEST_MR_IID_WITH_APPROVAL_STATE}/approval_state`,
      (_req, res) => {
        res.json({
          approval_rules_overwritten: false,
          rules: [
            {
              id: "101",
              name: "Default rule",
              rule_type: "regular",
              approvals_required: 1,
              approved: true,
              approved_by: [
                {
                  id: "35",
                  username: "sergey.kravchenya",
                  name: "Sergey Kravchenya",
                  state: "active",
                  avatar_url: "https://gitlab.mock/uploads/avatar.png",
                  web_url: "https://gitlab.mock/sergey.kravchenya",
                },
              ],
            },
            {
              id: "102",
              name: "Code owners",
              rule_type: "code_owner",
              approvals_required: 1,
              approved: true,
              approved_by: [
                {
                  id: "35",
                  username: "sergey.kravchenya",
                  name: "Sergey Kravchenya",
                  state: "active",
                  avatar_url: "https://gitlab.mock/uploads/avatar.png",
                  web_url: "https://gitlab.mock/sergey.kravchenya",
                },
              ],
            },
          ],
        });
      }
    );

    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  test("falls back to approvals endpoint when approval_state is unavailable", async () => {
    const result = await callTool(
      "get_merge_request_approval_state",
      {
        project_id: TEST_PROJECT_ID,
        merge_request_iid: TEST_MR_IID_WITH_FALLBACK,
      },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.strictEqual(result.source_endpoint, "approvals");
    assert.strictEqual(result.approved, true);
    assert.deepStrictEqual(result.approved_by_usernames, ["sergey.kravchenya"]);
    assert.ok(Array.isArray(result.approved_by));
    assert.strictEqual(result.approved_by[0].username, "sergey.kravchenya");
  });

  test("returns deduplicated approvers from approval_state rules", async () => {
    const result = await callTool(
      "get_merge_request_approval_state",
      {
        project_id: TEST_PROJECT_ID,
        merge_request_iid: TEST_MR_IID_WITH_APPROVAL_STATE,
      },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.strictEqual(result.source_endpoint, "approval_state");
    assert.strictEqual(result.rules.length, 2);
    assert.deepStrictEqual(result.approved_by_usernames, ["sergey.kravchenya"]);
    assert.ok(Array.isArray(result.approved_by));
    assert.strictEqual(result.approved_by.length, 1);
    assert.strictEqual(result.approved_by[0].username, "sergey.kravchenya");
  });
});
