import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-ci-lint-test-token";
const TEST_PROJECT_ID = "123";

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
        USE_PIPELINE: "true",
      },
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
      if (!line) return reject(new Error("No JSON output found"));

      try {
        const response = JSON.parse(line);
        if (response.error) {
          reject(response.error);
        } else {
          const content = response.result?.content?.[0]?.text;
          resolve(content ? JSON.parse(content) : response.result);
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

async function listToolNames(env: NodeJS.ProcessEnv): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...env,
      },
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
      if (!line) return reject(new Error("No JSON output found"));

      try {
        const response = JSON.parse(line);
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response.result.tools.map((tool: { name: string }) => tool.name));
        }
      } catch (e) {
        reject(e);
      }
    });

    proc.stdin?.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }) + "\n"
    );
  });
}

describe("GitLab CI lint tools", () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;

  before(async () => {
    const mockPort = await findMockServerPort(9260);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });

    mockGitLab.addMockHandler("post", `/projects/${TEST_PROJECT_ID}/ci/lint`, (req, res) => {
      assert.strictEqual(req.body.content, "stages: [test]\ntest:\n  script: echo ok");
      assert.strictEqual(req.body.dry_run, true);
      assert.strictEqual(req.body.include_jobs, true);
      assert.strictEqual(req.body.ref, "main");
      res.json({
        valid: true,
        errors: [],
        warnings: [],
        merged_yaml: "test:\n  script: echo ok\n",
        includes: [],
        jobs: [{ name: "test", stage: "test" }],
      });
    });

    mockGitLab.addMockHandler("get", `/projects/${TEST_PROJECT_ID}/ci/lint`, (req, res) => {
      assert.strictEqual(req.query.content_ref, "feature/test");
      assert.strictEqual(req.query.dry_run, "true");
      assert.strictEqual(req.query.dry_run_ref, "main");
      assert.strictEqual(req.query.include_jobs, "true");
      res.json({
        valid: true,
        errors: [],
        warnings: [],
        merged_yaml: "include-job:\n  script: echo included\n",
        includes: [{ type: "local", location: "include.yml" }],
        jobs: [{ name: "include-job", stage: "test" }],
      });
    });

    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  test("validate_ci_lint posts CI YAML content and returns lint result", async () => {
    const result = await callTool(
      "validate_ci_lint",
      {
        project_id: TEST_PROJECT_ID,
        content: "stages: [test]\ntest:\n  script: echo ok",
        dry_run: true,
        include_jobs: true,
        ref: "main",
      },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.errors, []);
    assert.strictEqual(result.jobs[0].name, "test");
  });

  test("validate_ci_lint surfaces invalid lint responses", async () => {
    mockGitLab.addMockHandler("post", `/projects/999/ci/lint`, (req, res) => {
      res.json({
        valid: false,
        errors: ["jobs config should contain at least one visible job"],
        warnings: [],
      });
    });

    const result = await callTool(
      "validate_ci_lint",
      {
        project_id: "999",
        content: ".hidden:\n  script: echo hidden",
      },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.strictEqual(result.valid, false);
    assert.deepStrictEqual(result.errors, ["jobs config should contain at least one visible job"]);
  });

  test("validate_project_ci_lint sends GET query parameters", async () => {
    const result = await callTool(
      "validate_project_ci_lint",
      {
        project_id: TEST_PROJECT_ID,
        content_ref: "feature/test",
        dry_run: true,
        dry_run_ref: "main",
        include_jobs: true,
      },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      }
    );

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.includes[0].location, "include.yml");
    assert.strictEqual(result.jobs[0].name, "include-job");
  });

  test("CI lint tools are visible by default in read-only mode", async () => {
    const tools = await listToolNames({
      GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      GITLAB_READ_ONLY_MODE: "true",
    });

    assert.ok(tools.includes("validate_ci_lint"));
    assert.ok(tools.includes("validate_project_ci_lint"));
  });
});
