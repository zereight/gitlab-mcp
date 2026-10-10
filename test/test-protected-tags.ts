import { after, before, describe, test } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-mock-token-protected-tags";
const TEST_PROJECT_ID = "123";
const TEST_TAG = "v*";

function buildProtectedTag(overrides: Record<string, unknown> = {}) {
  return {
    name: TEST_TAG,
    create_access_levels: [
      {
        id: 1,
        access_level: 40,
        access_level_description: "Maintainers",
        deploy_key_id: null,
        user_id: null,
        group_id: null,
      },
    ],
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

describe("protected tag tools", () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;
  const protectRequests: Array<Record<string, unknown>> = [];

  before(async () => {
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });

    mockGitLab.addMockHandler("get", `/projects/${TEST_PROJECT_ID}/protected_tags`, (req, res) => {
      assert.strictEqual(req.query.page, "2");
      assert.strictEqual(req.query.per_page, "10");
      assert.strictEqual(req.query.search, undefined);
      res.json([buildProtectedTag()]);
    });

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/protected_tags/${TEST_TAG}`,
      (_req, res) => {
        res.json(buildProtectedTag());
      }
    );

    mockGitLab.addMockHandler("post", `/projects/${TEST_PROJECT_ID}/protected_tags`, (req, res) => {
      protectRequests.push(req.body);
      res.status(201).json(buildProtectedTag({ name: req.body.name }));
    });

    mockGitLab.addMockHandler(
      "delete",
      `/projects/${TEST_PROJECT_ID}/protected_tags/${TEST_TAG}`,
      (_req, res) => {
        res.status(204).send();
      }
    );

    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  const env = () => ({
    GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
    GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
    GITLAB_TOOLSETS: "tags",
  });

  test("list_protected_tags forwards pagination and does not send search", async () => {
    const result = await callTool(
      "list_protected_tags",
      { project_id: TEST_PROJECT_ID, page: 2, per_page: 10 },
      env()
    );

    assert.ok(Array.isArray(result));
    assert.strictEqual(result[0].name, TEST_TAG);
    assert.strictEqual(result[0].create_access_levels[0].user_id, null);
  });

  test("get_protected_tag parses a wildcard protected tag", async () => {
    const result = await callTool(
      "get_protected_tag",
      { project_id: TEST_PROJECT_ID, tag_name: TEST_TAG },
      env()
    );

    assert.strictEqual(result.name, TEST_TAG);
    assert.strictEqual(result.create_access_levels[0].access_level, 40);
  });

  test("protect_tag posts the wildcard name and coerced create_access_level", async () => {
    const result = await callTool(
      "protect_tag",
      {
        project_id: TEST_PROJECT_ID,
        tag_name: TEST_TAG,
        create_access_level: "30",
      },
      env()
    );

    assert.strictEqual(result.name, TEST_TAG);
    assert.deepStrictEqual(protectRequests.at(-1), {
      name: TEST_TAG,
      create_access_level: 30,
    });
  });

  test("protect_tag accepts the name alias and omits create_access_level when unset", async () => {
    const result = await callTool(
      "protect_tag",
      { project_id: TEST_PROJECT_ID, name: TEST_TAG },
      env()
    );

    assert.strictEqual(result.name, TEST_TAG);
    assert.deepStrictEqual(protectRequests.at(-1), { name: TEST_TAG });
  });

  test("protect_tag rejects access levels outside the protected tag API", async () => {
    await assert.rejects(
      () =>
        callTool(
          "protect_tag",
          {
            project_id: TEST_PROJECT_ID,
            tag_name: TEST_TAG,
            create_access_level: 60,
          },
          env()
        ),
      /Access level must be one of 0 \(No access\), 30 \(Developer\), or 40 \(Maintainer\)/
    );
  });

  test("unprotect_tag sends DELETE and returns status", async () => {
    const result = await callTool(
      "unprotect_tag",
      { project_id: TEST_PROJECT_ID, tag_name: TEST_TAG },
      env()
    );

    assert.deepStrictEqual(result, { status: "unprotected", tag: TEST_TAG });
  });
});
