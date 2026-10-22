import { after, before, describe, test } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";
import { expectToolError } from "./utils/tool-error.js";

const MOCK_TOKEN = "glpat-mock-token-protected-branches";
const TEST_PROJECT_ID = "123";
const TEST_BRANCH = "main";
// Already protected: POST returns 409, so only PATCH can change it.
const EXISTING_BRANCH = "stable";
const WILDCARD_BRANCH = "release/*";

function buildProtectedBranch(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: TEST_BRANCH,
    push_access_levels: [
      {
        id: 101,
        access_level: 30,
        access_level_description: "Developers + Maintainers",
        user_id: null,
        group_id: null,
      },
    ],
    merge_access_levels: [
      {
        id: 201,
        access_level: 40,
        access_level_description: "Maintainers",
        user_id: null,
        group_id: null,
      },
    ],
    unprotect_access_levels: [
      {
        id: 301,
        access_level: 60,
        access_level_description: "Administrators",
        user_id: null,
        group_id: null,
      },
    ],
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
      if (response.result?.isError === true) {
        resolve(response.result);
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
  let existingBranchPosts = 0;
  let existingBranchPatchBody: unknown;

  before(async () => {
    const mockPort = await findMockServerPort();
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
        if (req.body.name === EXISTING_BRANCH) {
          existingBranchPosts += 1;
          res.status(409).json({ message: `Protected branch '${EXISTING_BRANCH}' already exists` });
          return;
        }
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
      "patch",
      `/projects/${TEST_PROJECT_ID}/protected_branches/${EXISTING_BRANCH}`,
      (req, res) => {
        existingBranchPatchBody = req.body;
        res.json(
          buildProtectedBranch({
            name: EXISTING_BRANCH,
            push_access_levels: [
              {
                id: 102,
                access_level: 0,
                access_level_description: "No one",
                user_id: null,
                group_id: null,
                deploy_key_id: null,
              },
            ],
          })
        );
      }
    );

    mockGitLab.addMockHandler(
      "patch",
      `/projects/${TEST_PROJECT_ID}/protected_branches/${encodeURIComponent(WILDCARD_BRANCH)}`,
      (req, res) => {
        assert.deepStrictEqual(req.body, {
          allow_force_push: true,
          code_owner_approval_required: false,
          allowed_to_push: [{ deploy_key_id: 7 }],
          allowed_to_merge: [{ id: 201, user_id: 5 }],
          allowed_to_unprotect: [{ group_id: 9 }],
        });
        res.json(buildProtectedBranch({ name: WILDCARD_BRANCH, allow_force_push: true }));
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
    // update_protected_branch needs these record ids for { id, _destroy: true }
    assert.strictEqual(result.push_access_levels[0].id, 101);
    assert.strictEqual(result.merge_access_levels[0].id, 201);
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
    await expectToolError(
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

  test("protect_branch on an existing rule surfaces GitLab's 409", async () => {
    await expectToolError(
      callTool(
        "protect_branch",
        { project_id: TEST_PROJECT_ID, branch_name: EXISTING_BRANCH, push_access_level: 0 },
        env()
      ),
      /409/
    );
    assert.strictEqual(existingBranchPosts, 1);
  });

  test("update_protected_branch PATCHes an existing rule that protect_branch cannot recreate", async () => {
    const before = existingBranchPosts;
    const result = await callTool(
      "update_protected_branch",
      {
        project_id: TEST_PROJECT_ID,
        branch_name: EXISTING_BRANCH,
        allowed_to_push: [
          // Fields copied from get_protected_branch output are dropped or ignored.
          {
            id: 101,
            _destroy: "true",
            access_level_description: "Developers + Maintainers",
            user_id: null,
            group_id: null,
          },
          { access_level: "0" },
        ],
      },
      env()
    );

    assert.deepStrictEqual(existingBranchPatchBody, {
      allowed_to_push: [{ id: 101, _destroy: true }, { access_level: 0 }],
    });
    assert.strictEqual(existingBranchPosts, before, "update must not POST a new rule");
    assert.strictEqual(result.name, EXISTING_BRANCH);
    assert.strictEqual(result.push_access_levels[0].id, 102);
    assert.strictEqual(result.push_access_levels[0].access_level, 0);
  });

  test("update_protected_branch encodes a wildcard name and sends every setting", async () => {
    const result = await callTool(
      "update_protected_branch",
      {
        project_id: TEST_PROJECT_ID,
        branch_name: WILDCARD_BRANCH,
        allow_force_push: "true",
        code_owner_approval_required: false,
        allowed_to_push: [{ deploy_key_id: 7 }],
        allowed_to_merge: [{ id: 201, user_id: 5 }],
        allowed_to_unprotect: [{ group_id: 9 }],
      },
      env()
    );

    assert.strictEqual(result.name, WILDCARD_BRANCH);
    assert.strictEqual(result.allow_force_push, true);
  });

  for (const [label, args, pattern] of [
    ["no setting", {}, /at least one protected branch setting/],
    ["_destroy without id", { allowed_to_push: [{ _destroy: true }] }, /_destroy requires id/],
    [
      "deploy_key_id outside allowed_to_push",
      { allowed_to_merge: [{ deploy_key_id: 7 }] },
      /deploy_key_id is only valid in allowed_to_push/,
    ],
    [
      "No access in allowed_to_unprotect",
      { allowed_to_unprotect: [{ access_level: 0 }] },
      /not valid for allowed_to_unprotect/,
    ],
    [
      "two targets in one entry",
      { allowed_to_push: [{ access_level: 40, user_id: 5 }] },
      /Set only one of/,
    ],
  ] as const) {
    test(`update_protected_branch rejects ${label} before calling GitLab`, async () => {
      await expectToolError(
        callTool(
          "update_protected_branch",
          { project_id: TEST_PROJECT_ID, branch_name: EXISTING_BRANCH, ...args },
          env()
        ),
        pattern
      );
    });
  }

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
