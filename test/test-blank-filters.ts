import { describe, test, before, after, afterEach } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-mock-token-12345";
const TEST_PROJECT_ID = "123";

// Cases below cover tools outside the default toolsets, so every toolset is enabled.
const TOOLSET_ENV = { GITLAB_TOOLSETS: "all" };

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

describe("blank query filters", () => {
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

  afterEach(() => {
    mockGitLab.clearCustomHandlers();
  });

  const env = () => ({
    GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
    GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
  });

  // Registers a handler that captures the request URL and answers with an empty list
  function captureRequest(path: string): () => string {
    let capturedUrl: string | undefined;
    mockGitLab.addMockHandler("get", path, (req, res) => {
      capturedUrl = req.originalUrl;
      res.json([]);
    });

    return () => {
      assert.ok(capturedUrl, "Mock handler should have received a request");
      return capturedUrl!;
    };
  }

  function searchOf(capturedUrl: string): string {
    return new URL(capturedUrl, "http://localhost").search;
  }

  test("list_labels omits blank filters", async () => {
    const capturedUrl = captureRequest(`/projects/${TEST_PROJECT_ID}/labels`);

    const labels = await callTool("list_labels", { project_id: TEST_PROJECT_ID, search: "" }, env());

    assert.deepStrictEqual(labels, []);
    assert.strictEqual(searchOf(capturedUrl()), "");
  });

  test("list_tags omits blank filters", async () => {
    const capturedUrl = captureRequest(`/projects/${TEST_PROJECT_ID}/repository/tags`);

    const tags = await callTool(
      "list_tags",
      { project_id: TEST_PROJECT_ID, search: "   " },
      env()
    );

    assert.deepStrictEqual(tags, []);
    assert.strictEqual(searchOf(capturedUrl()), "");
  });

  test("list_pipelines omits blank filters", async () => {
    const capturedUrl = captureRequest(`/projects/${TEST_PROJECT_ID}/pipelines`);

    const pipelines = await callTool(
      "list_pipelines",
      { project_id: TEST_PROJECT_ID, ref: "" },
      env()
    );

    assert.deepStrictEqual(pipelines, []);
    assert.strictEqual(searchOf(capturedUrl()), "");
  });

  test("list_deployments omits blank filters", async () => {
    const capturedUrl = captureRequest(`/projects/${TEST_PROJECT_ID}/deployments`);

    const deployments = await callTool(
      "list_deployments",
      { project_id: TEST_PROJECT_ID, environment: "", ref: "\t" },
      env()
    );

    assert.deepStrictEqual(deployments, []);
    assert.strictEqual(searchOf(capturedUrl()), "");
  });

  test("list_environments omits blank filters", async () => {
    const capturedUrl = captureRequest(`/projects/${TEST_PROJECT_ID}/environments`);

    const environments = await callTool(
      "list_environments",
      { project_id: TEST_PROJECT_ID, name: " ", search: "" },
      env()
    );

    assert.deepStrictEqual(environments, []);
    assert.strictEqual(searchOf(capturedUrl()), "");
  });

  test("list_job_artifacts omits blank filters", async () => {
    const capturedUrl = captureRequest(`/projects/${TEST_PROJECT_ID}/jobs/7/artifacts/tree`);

    const artifacts = await callTool(
      "list_job_artifacts",
      { project_id: TEST_PROJECT_ID, job_id: "7", path: "" },
      env()
    );

    assert.deepStrictEqual(artifacts, []);
    assert.strictEqual(searchOf(capturedUrl()), "");
  });

  test("list_events omits blank filters", async () => {
    const capturedUrl = captureRequest("/events");

    const events = await callTool("list_events", { action: "", scope: " \t" }, env());

    assert.deepStrictEqual(events, []);
    assert.strictEqual(searchOf(capturedUrl()), "");
  });

  test("list_project_variables omits blank nested filters", async () => {
    const capturedUrl = captureRequest(`/projects/${TEST_PROJECT_ID}/variables`);

    const variables = await callTool(
      "list_project_variables",
      { project_id: TEST_PROJECT_ID, filter: { environment_scope: "  " } },
      env()
    );

    assert.deepStrictEqual(variables, []);
    assert.strictEqual(searchOf(capturedUrl()), "");
  });

  test("list_labels keeps a non-blank filter", async () => {
    const capturedUrl = captureRequest(`/projects/${TEST_PROJECT_ID}/labels`);

    await callTool("list_labels", { project_id: TEST_PROJECT_ID, search: "bug" }, env());

    const params = new URL(capturedUrl(), "http://localhost").searchParams;

    assert.deepStrictEqual(params.getAll("search"), ["bug"]);
  });

  test("list_project_variables keeps a non-blank nested filter", async () => {
    const capturedUrl = captureRequest(`/projects/${TEST_PROJECT_ID}/variables`);

    await callTool(
      "list_project_variables",
      { project_id: TEST_PROJECT_ID, filter: { environment_scope: "production" } },
      env()
    );

    const params = new URL(capturedUrl(), "http://localhost").searchParams;

    assert.deepStrictEqual(params.getAll("filter[environment_scope]"), ["production"]);
  });
});
