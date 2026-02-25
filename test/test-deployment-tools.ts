import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-mock-token-12345";
const TEST_PROJECT_ID = "123";
const TEST_DEPLOYMENT_ID = "777";
const TEST_ENVIRONMENT_ID = "42";
const TEST_MERGE_REQUEST_IID = "88";
const TEST_MERGE_REQUEST_SHA = "merge-sha-6870";
const TEST_DIVERGED_COMMITS_COUNT = 35;
const TEST_SOURCE_COMMITS_COUNT = 6;
const TEST_APPROVER_USERNAME = "sergey.kravchenya";
const TEST_APPROVER_NAME = "Sergey Kravchenya";

const mrDeploymentsByCreatedAtAsc = Array.from({ length: 12 }, (_, index) => {
  const sequence = index + 1;
  const day = String(sequence).padStart(2, "0");
  return {
    id: `mr-deploy-${sequence}`,
    status: "success",
    ref: "main",
    sha: TEST_MERGE_REQUEST_SHA,
    created_at: `2026-02-${day}T10:00:00.000Z`,
    updated_at: `2026-02-${day}T10:05:00.000Z`,
    environment: {
      id: `mr-env-${sequence}`,
      name: sequence % 2 === 0 ? "prod" : "stage",
      external_url: sequence % 2 === 0 ? "https://api.prod.example.com" : "https://api.stage.example.com",
    },
    deployable: {
      id: `mr-job-${sequence}`,
      name: `Deploy ${sequence}`,
      status: "success",
      stage: "deploy",
      pipeline: {
        id: `mr-pipeline-${sequence}`,
        status: "success",
        ref: "main",
        sha: TEST_MERGE_REQUEST_SHA,
      },
    },
  };
});

const mrDeploymentsUnsorted = [
  mrDeploymentsByCreatedAtAsc[4],
  mrDeploymentsByCreatedAtAsc[0],
  mrDeploymentsByCreatedAtAsc[10],
  mrDeploymentsByCreatedAtAsc[2],
  mrDeploymentsByCreatedAtAsc[11],
  mrDeploymentsByCreatedAtAsc[7],
  mrDeploymentsByCreatedAtAsc[1],
  mrDeploymentsByCreatedAtAsc[9],
  mrDeploymentsByCreatedAtAsc[3],
  mrDeploymentsByCreatedAtAsc[6],
  mrDeploymentsByCreatedAtAsc[8],
  mrDeploymentsByCreatedAtAsc[5],
];

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

      const line = output.split("\n").find((l) => l.startsWith("{"));
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

describe("deployment and environment tools", () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;

  before(async () => {
    const mockPort = await findMockServerPort(9300);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });

    mockGitLab.addMockHandler("get", `/projects/${TEST_PROJECT_ID}/deployments`, (req, res) => {
      const querySha = Array.isArray(req.query.sha) ? req.query.sha[0] : req.query.sha;

      if (querySha === TEST_MERGE_REQUEST_SHA) {
        res.json(mrDeploymentsUnsorted);
        return;
      }

      res.json([
        {
          id: TEST_DEPLOYMENT_ID,
          status: "success",
          ref: "master",
          sha: "abc123",
          created_at: "2026-02-20T16:27:59.348Z",
          updated_at: "2026-02-20T16:32:38.235Z",
          environment: { id: TEST_ENVIRONMENT_ID, name: "stage" },
          deployable: {
            id: "11",
            name: "Stage deploy",
            status: "success",
            stage: "deploy",
            pipeline: { id: "190349", status: "success", ref: "master", sha: "abc123" },
          },
        },
      ]);
    });

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/merge_requests/${TEST_MERGE_REQUEST_IID}`,
      (req, res) => {
        res.json({
          id: TEST_MERGE_REQUEST_IID,
          iid: TEST_MERGE_REQUEST_IID,
          project_id: TEST_PROJECT_ID,
          title: "Deployment summary test MR",
          description: "MR used by tests to validate deployment summary enrichment",
          state: "merged",
          author: {
            id: "1",
            username: "test-user",
            name: "Test User",
          },
          source_branch: "feature/deploy-summary",
          target_branch: "main",
          web_url: "https://gitlab.mock/project/123/merge_requests/88",
          created_at: "2026-02-01T10:00:00.000Z",
          updated_at: "2026-02-20T11:00:00.000Z",
          merged_at: "2026-02-20T11:05:00.000Z",
          closed_at: null,
          merge_commit_sha: TEST_MERGE_REQUEST_SHA,
          diverged_commits_count: TEST_DIVERGED_COMMITS_COUNT,
          rebase_in_progress: false,
        });
      }
    );

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/merge_requests/${TEST_MERGE_REQUEST_IID}/commits`,
      (req, res) => {
        const page = Number.parseInt(
          (Array.isArray(req.query.page) ? req.query.page[0] : req.query.page)?.toString() ?? "1",
          10
        );

        if (page > 1) {
          res.set("x-next-page", "");
          res.json([]);
          return;
        }

        res.set("x-next-page", "");
        res.json(
          Array.from({ length: TEST_SOURCE_COMMITS_COUNT }, (_, index) => ({
            id: `commit-${index + 1}`,
            short_id: `${index + 1}`,
            title: `Commit ${index + 1}`,
            author_name: "Test Author",
            author_email: "author@example.com",
            authored_date: "2026-02-20T10:00:00.000Z",
            committer_name: "Test Committer",
            committer_email: "committer@example.com",
            committed_date: "2026-02-20T10:00:00.000Z",
            web_url: `https://gitlab.mock/project/123/-/commit/${index + 1}`,
            parent_ids: [],
          }))
        );
      }
    );

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/merge_requests/${TEST_MERGE_REQUEST_IID}/approval_state`,
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
                  username: TEST_APPROVER_USERNAME,
                  name: TEST_APPROVER_NAME,
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

    mockGitLab.addMockHandler("get", `/projects/${TEST_PROJECT_ID}`, (req, res) => {
      res.json({
        id: TEST_PROJECT_ID,
        path_with_namespace: "test-group/test-project",
        merge_method: "merge",
      });
    });

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/deployments/${TEST_DEPLOYMENT_ID}`,
      (req, res) => {
        res.json({
          id: TEST_DEPLOYMENT_ID,
          status: "success",
          ref: "master",
          sha: "abc123",
          created_at: "2026-02-20T16:27:59.348Z",
          updated_at: "2026-02-20T16:32:38.235Z",
          environment: { id: TEST_ENVIRONMENT_ID, name: "stage" },
          deployable: {
            id: "11",
            name: "Stage deploy",
            status: "success",
            stage: "deploy",
            pipeline: { id: "190349", status: "success", ref: "master", sha: "abc123" },
          },
        });
      }
    );

    mockGitLab.addMockHandler("get", `/projects/${TEST_PROJECT_ID}/environments`, (req, res) => {
      res.json([
        {
          id: TEST_ENVIRONMENT_ID,
          name: "stage",
          slug: "stage",
          state: "available",
          external_url: "https://api.stage.example.com",
          last_deployment: {
            id: TEST_DEPLOYMENT_ID,
            status: "success",
            ref: "master",
            sha: "abc123",
            created_at: "2026-02-20T16:27:59.348Z",
          },
        },
      ]);
    });

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/environments/${TEST_ENVIRONMENT_ID}`,
      (req, res) => {
        res.json({
          id: TEST_ENVIRONMENT_ID,
          name: "stage",
          slug: "stage",
          state: "available",
          external_url: "https://api.stage.example.com",
          last_deployment: {
            id: TEST_DEPLOYMENT_ID,
            status: "success",
            ref: "master",
            sha: "abc123",
            created_at: "2026-02-20T16:27:59.348Z",
          },
        });
      }
    );

    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  test("list_deployments returns deployment list", async () => {
    const result = await callTool(
      "list_deployments",
      { project_id: TEST_PROJECT_ID, environment: "stage" },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.ok(Array.isArray(result), "Response should be an array");
    assert.strictEqual(result.length, 1, "Should return one deployment");
    assert.strictEqual(result[0].id, TEST_DEPLOYMENT_ID);
    assert.strictEqual(result[0].environment.name, "stage");
  });

  test("get_deployment returns one deployment", async () => {
    const result = await callTool(
      "get_deployment",
      { project_id: TEST_PROJECT_ID, deployment_id: TEST_DEPLOYMENT_ID },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.strictEqual(result.id, TEST_DEPLOYMENT_ID);
    assert.strictEqual(result.ref, "master");
    assert.strictEqual(result.status, "success");
  });

  test("list_environments returns environment list", async () => {
    const result = await callTool(
      "list_environments",
      { project_id: TEST_PROJECT_ID },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.ok(Array.isArray(result), "Response should be an array");
    assert.strictEqual(result.length, 1, "Should return one environment");
    assert.strictEqual(result[0].id, TEST_ENVIRONMENT_ID);
    assert.strictEqual(result[0].name, "stage");
  });

  test("get_environment returns one environment", async () => {
    const result = await callTool(
      "get_environment",
      { project_id: TEST_PROJECT_ID, environment_id: TEST_ENVIRONMENT_ID },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.strictEqual(result.id, TEST_ENVIRONMENT_ID);
    assert.strictEqual(result.name, "stage");
    assert.strictEqual(result.state, "available");
  });

  test("get_merge_request returns compact deployment summary sorted by created_at desc", async () => {
    const result = await callTool(
      "get_merge_request",
      { project_id: TEST_PROJECT_ID, merge_request_iid: TEST_MERGE_REQUEST_IID },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.ok(result.deployment_summary, "deployment_summary should be present");
    assert.strictEqual(
      result.diverged_commits_count,
      TEST_DIVERGED_COMMITS_COUNT,
      "diverged_commits_count should be requested and returned by default"
    );
    assert.strictEqual(result.deployment_summary.lookup_sha, TEST_MERGE_REQUEST_SHA);
    assert.ok(result.commit_addition_summary, "commit_addition_summary should be present");
    assert.strictEqual(
      result.commit_addition_summary.source_commits_count,
      TEST_SOURCE_COMMITS_COUNT
    );
    assert.strictEqual(result.commit_addition_summary.merge_method, "merge");
    assert.strictEqual(result.commit_addition_summary.merge_commit_count, 1);
    assert.strictEqual(
      result.commit_addition_summary.summary,
      "6 commits and 1 merge commit will be added to main."
    );
    assert.ok(result.approval_summary, "approval_summary should be present");
    assert.strictEqual(result.approval_summary.source_endpoint, "approval_state");
    assert.strictEqual(result.approval_summary.approved, true);
    assert.deepStrictEqual(result.approval_summary.approved_by_usernames, [TEST_APPROVER_USERNAME]);
    assert.strictEqual(result.approval_summary.approved_by.length, 1);
    assert.strictEqual(result.approval_summary.approved_by[0].name, TEST_APPROVER_NAME);
    assert.strictEqual(result.deployment_summary.sort, "created_at_desc");
    assert.strictEqual(result.deployment_summary.limit, 10);
    assert.strictEqual(result.deployment_summary.total_count, 12);
    assert.strictEqual(result.deployment_summary.returned_count, 10);
    assert.ok(Array.isArray(result.deployment_summary.records), "records should be an array");
    assert.strictEqual(result.deployment_summary.records.length, 10);
    assert.ok(
      result.deployment_summary.records.every(
        (record: { sha: string }) => record.sha === TEST_MERGE_REQUEST_SHA
      ),
      "all summary records should match MR sha"
    );

    for (let i = 1; i < result.deployment_summary.records.length; i++) {
      const previousCreatedAt = Date.parse(result.deployment_summary.records[i - 1].created_at);
      const currentCreatedAt = Date.parse(result.deployment_summary.records[i].created_at);
      assert.ok(
        previousCreatedAt >= currentCreatedAt,
        "records should be sorted by created_at descending"
      );
    }

    assert.strictEqual(
      result.deployment_summary.records[0].id,
      "mr-deploy-12",
      "latest deployment should be first"
    );
    assert.ok(
      !result.deployment_summary.records.some((record: { id: string }) => record.id === "mr-deploy-1"),
      "oldest deployment should be truncated"
    );
    assert.ok(
      !result.deployment_summary.records.some((record: { id: string }) => record.id === "mr-deploy-2"),
      "second oldest deployment should be truncated"
    );
  });

  test("get_merge_request always requests diverged_commits_count", async () => {
    const result = await callTool(
      "get_merge_request",
      {
        project_id: TEST_PROJECT_ID,
        merge_request_iid: TEST_MERGE_REQUEST_IID,
      },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.strictEqual(
      result.diverged_commits_count,
      TEST_DIVERGED_COMMITS_COUNT,
      "diverged_commits_count should always be included in get_merge_request response"
    );
  });
});
