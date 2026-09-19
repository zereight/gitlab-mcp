import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-mock-token-12345";
const TEST_PROJECT_ID = "123";
const TEST_GROUP_ID = "my-group";

// Milestone tools live in the non-default "milestones" toolset
const TOOLSET_ENV = { GITLAB_TOOLSETS: "milestones" };

// Helper to run an MCP tool through the stdio server
async function callTool(
  toolName: string,
  args: Record<string, any>,
  env: NodeJS.ProcessEnv
): Promise<any> {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...TOOLSET_ENV,
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
          reject(new Error(JSON.stringify(response.error)));
          return;
        }

        const content = response.result?.content?.[0]?.text;
        if (content) {
          try {
            resolve(JSON.parse(content));
          } catch {
            reject(new Error(`Failed to parse tool output JSON: ${content}`));
          }
        } else {
          resolve(response.result);
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

describe("milestone list iids filters", () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;

  before(async () => {
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({ port: mockPort, validTokens: [MOCK_TOKEN] });
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  const env = () => ({
    GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
    GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
  });

  test("omits an empty iids filter for list_milestones", async () => {
    let capturedUrl: string | undefined;
    mockGitLab.addMockHandler("get", `/projects/${TEST_PROJECT_ID}/milestones`, (req, res) => {
      capturedUrl = req.originalUrl;
      res.json([]);
    });

    try {
      const milestones = await callTool(
        "list_milestones",
        { project_id: TEST_PROJECT_ID, iids: [] },
        env()
      );

      assert.deepStrictEqual(milestones, []);
      assert.ok(capturedUrl, "Mock handler should have received a request");
      assert.strictEqual(
        new URL(capturedUrl!, "http://localhost").search,
        "",
        "An empty iids array should not be serialized as `iids=`"
      );
    } finally {
      mockGitLab.clearCustomHandlers();
    }
  });

  test("forwards non-empty iids in bracket-array form", async () => {
    let capturedUrl: string | undefined;
    mockGitLab.addMockHandler("get", `/projects/${TEST_PROJECT_ID}/milestones`, (req, res) => {
      capturedUrl = req.originalUrl;
      res.json([]);
    });

    try {
      await callTool("list_milestones", { project_id: TEST_PROJECT_ID, iids: [1, 2] }, env());

      assert.ok(capturedUrl, "Mock handler should have received a request");
      const params = new URL(capturedUrl!, "http://localhost").searchParams;

      assert.deepStrictEqual(params.getAll("iids[]"), ["1", "2"]);
    } finally {
      mockGitLab.clearCustomHandlers();
    }
  });

  test("omits blank milestone filters", async () => {
    let capturedUrl: string | undefined;
    mockGitLab.addMockHandler("get", `/projects/${TEST_PROJECT_ID}/milestones`, (req, res) => {
      capturedUrl = req.originalUrl;
      res.json([]);
    });

    try {
      await callTool(
        "list_milestones",
        { project_id: TEST_PROJECT_ID, iids: [], title: "  ", search: "" },
        env()
      );

      assert.ok(capturedUrl, "Mock handler should have received a request");
      assert.strictEqual(
        new URL(capturedUrl!, "http://localhost").search,
        "",
        "Blank milestone filters should not be serialized"
      );
    } finally {
      mockGitLab.clearCustomHandlers();
    }
  });

  test("omits an empty iids filter for list_group_milestones", async () => {
    let capturedUrl: string | undefined;
    mockGitLab.addMockHandler("get", `/groups/${TEST_GROUP_ID}/milestones`, (req, res) => {
      capturedUrl = req.originalUrl;
      res.json([]);
    });

    try {
      const milestones = await callTool(
        "list_group_milestones",
        { group_id: TEST_GROUP_ID, iids: [], state: "active" },
        env()
      );

      assert.deepStrictEqual(milestones, []);
      assert.ok(capturedUrl, "Mock handler should have received a request");
      const params = new URL(capturedUrl!, "http://localhost").searchParams;

      assert.equal(
        params.has("iids"),
        false,
        "An empty iids array should not be serialized as `iids=`"
      );
      assert.deepStrictEqual(params.getAll("iids[]"), []);
      assert.deepStrictEqual(params.getAll("state"), ["active"]);
    } finally {
      mockGitLab.clearCustomHandlers();
    }
  });
});
