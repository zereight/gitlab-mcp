import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";
import type { ListGroupMergeRequestsOptions } from "../schemas.js";

const MOCK_TOKEN = "glpat-mock-token-12345";
const TEST_GROUP_ID = "my-group/sub-group";

const groupMergeRequests = [
  {
    id: 1,
    iid: 10,
    project_id: 123,
    title: "Group MR 1",
    description: "First MR of the group",
    state: "opened",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
    merged_at: null,
    closed_at: null,
    target_branch: "main",
    source_branch: "feature/one",
    web_url: "https://gitlab.mock/my-group/project-a/-/merge_requests/10",
    merge_commit_sha: null,
    author: {
      id: 1,
      username: "test-user",
      name: "Test User",
    },
  },
  {
    id: 2,
    iid: 4,
    project_id: 456,
    title: "Group MR 2",
    description: "Second MR of the group",
    state: "opened",
    created_at: "2024-01-03T00:00:00Z",
    updated_at: "2024-01-04T00:00:00Z",
    merged_at: null,
    closed_at: null,
    target_branch: "main",
    source_branch: "feature/two",
    web_url: "https://gitlab.mock/my-group/project-b/-/merge_requests/4",
    merge_commit_sha: null,
    author: {
      id: 2,
      username: "other-user",
      name: "Other User",
    },
  },
];

async function callListGroupMergeRequests(
  args: ListGroupMergeRequestsOptions,
  env: NodeJS.ProcessEnv
) {
  return new Promise<any[]>((resolve, reject) => {
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
    proc.stdout?.on("data", d => (output += d));
    proc.stderr?.on("data", d => (errorOutput += d));

    proc.on("close", code => {
      if (code !== 0) return reject(new Error(`Process exited with code ${code}: ${errorOutput}`));

      const line = output.split("\n").find(l => l.startsWith("{"));
      if (!line) return reject(new Error("No JSON output found"));

      try {
        const response = JSON.parse(line);
        if (response.error) {
          reject(response.error);
        } else {
          const content = response.result?.content?.[0]?.text;
          if (content) {
            try {
              resolve(JSON.parse(content));
            } catch (e) {
              reject(new Error(`Failed to parse tool output JSON: ${content}`));
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
        params: { name: "list_group_merge_requests", arguments: args },
      }) + "\n"
    );
  });
}

describe("list_group_merge_requests", () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;
  let capturedUrl: string | undefined;

  before(async () => {
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();

    mockGitLab.addMockHandler(
      "get",
      `/groups/${encodeURIComponent(TEST_GROUP_ID)}/merge_requests`,
      (req, res) => {
        capturedUrl = req.originalUrl;
        res.json(groupMergeRequests);
      }
    );
  });

  beforeEach(() => {
    capturedUrl = undefined;
  });

  after(async () => {
    await mockGitLab.stop();
  });

  test("lists merge requests of every project in the group", async () => {
    const mrs = await callListGroupMergeRequests(
      { group_id: TEST_GROUP_ID },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.ok(Array.isArray(mrs), "Response should be an array");
    assert.strictEqual(mrs.length, 2, "Should return the 2 mock MRs");
    assert.strictEqual(mrs[0].title, "Group MR 1");
    assert.notStrictEqual(
      String(mrs[0].project_id),
      String(mrs[1].project_id),
      "MRs should come from different projects"
    );
  });

  test("forwards group-specific and shared filters as query parameters", async () => {
    await callListGroupMergeRequests(
      {
        group_id: TEST_GROUP_ID,
        state: "opened",
        non_archived: true,
        source_project_id: "123",
        labels: ["backend", "urgent"],
        approved_by_usernames: ["alice", "bob"],
      },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.ok(capturedUrl, "Mock handler should have received a request");
    assert.match(capturedUrl!, /state=opened/, "Request URL should carry state");
    assert.match(capturedUrl!, /non_archived=true/, "Request URL should carry non_archived");
    assert.match(
      capturedUrl!,
      /source_project_id=123/,
      "Request URL should carry source_project_id"
    );
    assert.match(capturedUrl!, /labels=backend%2Curgent/, "Labels should be comma-joined");
    assert.match(
      capturedUrl!,
      /approved_by_usernames%5B%5D=alice/,
      "approved_by_usernames should use bracket-array form (URL-encoded)"
    );
    assert.match(capturedUrl!, /approved_by_usernames%5B%5D=bob/);
  });

  test("drops the mutually exclusive *_id filter when a *_username is given", async () => {
    await callListGroupMergeRequests(
      { group_id: TEST_GROUP_ID, author_id: "7", author_username: "alice" },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.ok(capturedUrl, "Mock handler should have received a request");
    assert.match(capturedUrl!, /author_username=alice/, "author_username should be forwarded");
    assert.doesNotMatch(capturedUrl!, /author_id=/, "author_id should be dropped");
  });
});
