import { after, before, describe, test } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = `glpat-${"mock-token-protected-branches"}`;
const TEST_PROJECT_ID = "123";
const TEST_BRANCH = "main";

function buildProtectedBranch(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: TEST_BRANCH,
    push_access_levels: [
      { access_level: 30, access_level_description: "Developers + Maintainers" },
    ],
    merge_access_levels: [{ access_level: 40, access_level_description: "Maintainers" }],
    unprotect_access_levels: [{ access_level: 60, access_level_description: "Administrators" }],
    allow_force_push: false,
    code_owner_approval_required: false,
    ...overrides,
  };
}

async function callTool(
  toolName: string,
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...env,
        SSE: "false",
        STREAMABLE_HTTP: "false",
        REMOTE_AUTHORIZATION: "false",
        GITLAB_MCP_OAUTH: "false",
      },
    });

    let output = "";
    let errorOutput = "";
    proc.stdout?.on("data", (d: Buffer) => (output += d));
    proc.stderr?.on("data", (d: Buffer) => (errorOutput += d));

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

      const response = JSON.parse(line);
      if (response.error) {
        reject(new Error(response.error.message ?? JSON.stringify(response.error)));
        return;
      }

      const content = response.result?.content?.[0]?.text;
      if (!content) {
        resolve(response.result);
        return;
      }

      try {
        resolve(JSON.parse(content));
      } catch {
        resolve(content);
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

describe("protected branch tools", () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;

  before(async () => {
    const mockPort = await findMockServerPort(20500, 50);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/protected_branches`,
      (req, res) => {
        assert.strictEqual(req.query.search, "main");
        assert.strictEqual(req.query.page, "2");
        assert.strictEqual(req.query.per_page, "10");
        res.json([buildProtectedBranch()]);
      }
    );

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/protected_branches/${TEST_BRANCH}`,
      (_req, res) => {
        res.json(buildProtectedBranch());
      }
    );

    mockGitLab.addMockHandler(
      "post",
      `/projects/${TEST_PROJECT_ID}/protected_branches`,
      (req, res) => {
        assert.deepStrictEqual(req.body, {
          name: TEST_BRANCH,
          push_access_level: 30,
          merge_access_level: 40,
          unprotect_access_level: 60,
          allow_force_push: false,
          code_owner_approval_required: false,
        });
        res.status(201).json(buildProtectedBranch());
      }
    );

    mockGitLab.addMockHandler(
      "delete",
      `/projects/${TEST_PROJECT_ID}/protected_branches/${TEST_BRANCH}`,
      (_req, res) => {
        res.status(204).send();
      }
    );

    mockGitLab.addMockHandler("put", `/projects/${TEST_PROJECT_ID}`, (req, res) => {
      assert.deepStrictEqual(req.body, { default_branch: TEST_BRANCH });
      res.json({ id: Number(TEST_PROJECT_ID), default_branch: TEST_BRANCH });
    });

    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  const env = () => ({
    GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
    GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
    GITLAB_TOOLSETS: "branches",
  });

  test("list_protected_branches forwards search and pagination", async () => {
    const result = await callTool(
      "list_protected_branches",
      { project_id: TEST_PROJECT_ID, search: "main", page: 2, per_page: 10 },
      env()
    );

    assert.ok(Array.isArray(result));
    assert.strictEqual(result[0].name, TEST_BRANCH);
  });

  test("get_protected_branch parses a single protected branch", async () => {
    const result = await callTool(
      "get_protected_branch",
      { project_id: TEST_PROJECT_ID, branch_name: TEST_BRANCH },
      env()
    );

    assert.strictEqual(result.name, TEST_BRANCH);
    assert.strictEqual(result.allow_force_push, false);
  });

  test("protect_branch posts normalized branch name, access levels, and false booleans", async () => {
    const result = await callTool(
      "protect_branch",
      {
        project_id: TEST_PROJECT_ID,
        branch_name: TEST_BRANCH,
        push_access_level: "30",
        merge_access_level: 40,
        unprotect_access_level: 60,
        allow_force_push: "false",
        code_owner_approval_required: "false",
      },
      env()
    );

    assert.strictEqual(result.name, TEST_BRANCH);
  });

  test("protect_branch rejects invalid access levels before calling GitLab", async () => {
    await assert.rejects(
      () =>
        callTool(
          "protect_branch",
          {
            project_id: TEST_PROJECT_ID,
            branch_name: TEST_BRANCH,
            push_access_level: 99,
          },
          env()
        ),
      /Access level must be one of/
    );
  });

  test("unprotect_branch sends DELETE and returns status", async () => {
    const result = await callTool(
      "unprotect_branch",
      { project_id: TEST_PROJECT_ID, branch_name: TEST_BRANCH },
      env()
    );

    assert.deepStrictEqual(result, { status: "unprotected", branch: TEST_BRANCH });
  });

  test("update_default_branch sends the expected PUT body", async () => {
    const result = await callTool(
      "update_default_branch",
      { project_id: TEST_PROJECT_ID, default_branch: TEST_BRANCH },
      env()
    );

    assert.strictEqual(result.status, "updated");
    assert.strictEqual(result.default_branch, TEST_BRANCH);
  });
});
