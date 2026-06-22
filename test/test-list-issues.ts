import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = `glpat-${"mock-token-12345"}`;
const TEST_PROJECT_ID = "123";

async function callListIssuesResult(args: Record<string, unknown> = {}, env: NodeJS.ProcessEnv) {
  return new Promise<{ data: unknown[]; text?: string }>((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...env,
        GITLAB_READ_ONLY_MODE: "true",
        GITLAB_TEST_MODE: "true",
        SSE: "false",
        STREAMABLE_HTTP: "false",
        REMOTE_AUTHORIZATION: "false",
        GITLAB_MCP_OAUTH: "false",
      },
    });

    let output = "";
    let errorOutput = "";
    proc.stdout?.on("data", d => (output += d));
    proc.stderr?.on("data", d => (errorOutput += d));

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
          reject(response.error);
        } else {
          const content = response.result?.content?.[0]?.text;
          if (content) {
            try {
              resolve({ data: JSON.parse(content), text: content });
            } catch {
              reject(new Error(`Failed to parse tool output JSON: ${content}`));
            }
          } else {
            resolve({ data: response.result });
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
        params: { name: "list_issues", arguments: args },
      }) + "\n"
    );
  });
}

async function callListIssues(args: Record<string, unknown> = {}, env: NodeJS.ProcessEnv) {
  return (await callListIssuesResult(args, env)).data;
}

describe("list_issues", () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;

  before(async () => {
    const mockPort = await findMockServerPort(9000);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  test("lists project-specific issues", async () => {
    const issues = await callListIssues(
      { project_id: TEST_PROJECT_ID },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.ok(Array.isArray(issues), "Response should be an array");
    assert.strictEqual(issues.length, 1, "Should return 1 mock issue");
    const firstIssue = issues[0];
    assert.ok(firstIssue && typeof firstIssue === "object" && "title" in firstIssue);
    const title = Reflect.get(firstIssue, "title");
    assert.strictEqual(title, "Test Issue 1");
  });

  test("returns compact JSON text", async () => {
    const result = await callListIssuesResult(
      { project_id: TEST_PROJECT_ID },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.ok(result.text, "Tool response should include text content");
    assert.doesNotMatch(result.text!, /\n\s+"/, "Tool response JSON should not be pretty-printed");
    assert.ok(Array.isArray(result.data), "Response should remain valid JSON");
  });

  test("prefers author_username over author_id when both are provided", async () => {
    let capturedUrl: string | undefined;
    mockGitLab.addMockHandler("get", `/projects/${TEST_PROJECT_ID}/issues`, (req, res) => {
      capturedUrl = req.originalUrl;
      res.json([]);
    });

    try {
      await callListIssues(
        {
          project_id: TEST_PROJECT_ID,
          author_id: "42",
          author_username: "alice",
        },
        {
          GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
          GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
        }
      );

      assert.ok(capturedUrl, "Mock handler should have received a request");
      assert.match(capturedUrl!, /author_username=alice/, "Request should include author_username");
      assert.doesNotMatch(capturedUrl!, /author_id=/, "Request should not include author_id");
    } finally {
      mockGitLab.clearCustomHandlers();
    }
  });
});
