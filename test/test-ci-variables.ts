import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-mock-token-ci-variables";
const TEST_PROJECT_ID = "123";
const TEST_GROUP_ID = "my-group";
const TEST_VAR_KEY = "DB_URL";
const TEST_GROUP_VAR_KEY = "SHARED_SECRET";
const TEST_HIDDEN_VAR_KEY = "HIDDEN_VAR";
const TEST_SCOPE = "production";

const MOCK_PROJECT_VARIABLE = {
  variable_type: "env_var",
  key: TEST_VAR_KEY,
  value: "postgres://localhost/db",
  protected: false,
  masked: true,
  raw: false,
  environment_scope: "*",
  description: "Database connection URL",
};

const MOCK_GROUP_VARIABLE = {
  variable_type: "env_var",
  key: TEST_GROUP_VAR_KEY,
  value: "s3cr3t",
  protected: false,
  masked: true,
  raw: false,
  environment_scope: "*",
  description: null,
};

const MOCK_HIDDEN_PROJECT_VARIABLE = {
  ...MOCK_PROJECT_VARIABLE,
  key: TEST_HIDDEN_VAR_KEY,
  value: null,
  hidden: true,
  description: null,
};

async function callTool(
  toolName: string,
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
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
          reject(new Error(response.error?.message ?? String(response.error)));
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

describe("CI/CD variable tools", () => {
  let mockServer: MockGitLabServer;
  let mockApiUrl: string;
  let baseEnv: NodeJS.ProcessEnv;
  let lastReceivedFilterScope: string | undefined;

  before(async () => {
    mockServer = new MockGitLabServer({
      port: await findMockServerPort(),
      validTokens: [MOCK_TOKEN],
    });

    // --- Project variable endpoints ---
    mockServer.addMockHandler("get", `/projects/${TEST_PROJECT_ID}/variables`, (_req, res) => {
      res.json([MOCK_PROJECT_VARIABLE]);
    });

    mockServer.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/variables/${TEST_VAR_KEY}`,
      (req, res) => {
        const scope = (req.query as Record<string, string>)["filter[environment_scope]"];
        lastReceivedFilterScope = scope;
        res.json({ ...MOCK_PROJECT_VARIABLE, environment_scope: scope ?? "*" });
      }
    );

    mockServer.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/variables/${TEST_HIDDEN_VAR_KEY}`,
      (_req, res) => {
        res.json(MOCK_HIDDEN_PROJECT_VARIABLE);
      }
    );

    mockServer.addMockHandler("post", `/projects/${TEST_PROJECT_ID}/variables`, (req, res) => {
      res.status(201).json({ ...MOCK_PROJECT_VARIABLE, ...(req.body as object) });
    });

    mockServer.addMockHandler(
      "put",
      `/projects/${TEST_PROJECT_ID}/variables/${TEST_VAR_KEY}`,
      (req, res) => {
        const scope = (req.query as Record<string, string>)["filter[environment_scope]"];
        lastReceivedFilterScope = scope;
        res.json({ ...MOCK_PROJECT_VARIABLE, ...(req.body as object), environment_scope: scope ?? "*" });
      }
    );

    mockServer.addMockHandler(
      "delete",
      `/projects/${TEST_PROJECT_ID}/variables/${TEST_VAR_KEY}`,
      (req, res) => {
        lastReceivedFilterScope = (req.query as Record<string, string>)["filter[environment_scope]"];
        res.status(204).send();
      }
    );

    // --- Group variable endpoints ---
    mockServer.addMockHandler("get", `/groups/${TEST_GROUP_ID}/variables`, (_req, res) => {
      res.json([MOCK_GROUP_VARIABLE]);
    });

    mockServer.addMockHandler(
      "get",
      `/groups/${TEST_GROUP_ID}/variables/${TEST_GROUP_VAR_KEY}`,
      (_req, res) => {
        res.json(MOCK_GROUP_VARIABLE);
      }
    );

    mockServer.addMockHandler("post", `/groups/${TEST_GROUP_ID}/variables`, (req, res) => {
      res.status(201).json({ ...MOCK_GROUP_VARIABLE, ...(req.body as object) });
    });

    mockServer.addMockHandler(
      "put",
      `/groups/${TEST_GROUP_ID}/variables/${TEST_GROUP_VAR_KEY}`,
      (req, res) => {
        res.json({ ...MOCK_GROUP_VARIABLE, ...(req.body as object) });
      }
    );

    mockServer.addMockHandler(
      "delete",
      `/groups/${TEST_GROUP_ID}/variables/${TEST_GROUP_VAR_KEY}`,
      (_req, res) => {
        res.status(204).send();
      }
    );

    await mockServer.start();
    mockApiUrl = `${mockServer.getUrl()}/api/v4`;

    baseEnv = {
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      GITLAB_API_URL: mockApiUrl,
      GITLAB_TOOLSETS: "variables",
    };
  });

  after(async () => {
    await mockServer.stop();
  });

  // --- Project variable tests ---

  test("list_project_variables returns variable array", async () => {
    const result = await callTool(
      "list_project_variables",
      { project_id: TEST_PROJECT_ID },
      baseEnv
    );
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].key, TEST_VAR_KEY);
    assert.strictEqual(result[0].value, MOCK_PROJECT_VARIABLE.value);
    assert.strictEqual(result[0].masked, true);
  });

  test("get_project_variable returns single variable", async () => {
    const result = await callTool(
      "get_project_variable",
      { project_id: TEST_PROJECT_ID, key: TEST_VAR_KEY },
      baseEnv
    );
    assert.strictEqual(result.key, TEST_VAR_KEY);
    assert.strictEqual(result.environment_scope, "*");
    assert.strictEqual(result.variable_type, "env_var");
  });

  test("get_project_variable returns hidden variable with null value", async () => {
    const result = await callTool(
      "get_project_variable",
      { project_id: TEST_PROJECT_ID, key: TEST_HIDDEN_VAR_KEY },
      baseEnv
    );
    assert.strictEqual(result.key, TEST_HIDDEN_VAR_KEY);
    assert.strictEqual(result.value, null);
    assert.strictEqual(result.hidden, true);
  });

  test("create_project_variable returns created variable", async () => {
    const result = await callTool(
      "create_project_variable",
      {
        project_id: TEST_PROJECT_ID,
        key: TEST_VAR_KEY,
        value: "new-value",
        masked: true,
      },
      baseEnv
    );
    assert.strictEqual(result.key, TEST_VAR_KEY);
    assert.strictEqual(result.value, "new-value");
  });

  test("update_project_variable returns updated variable", async () => {
    const result = await callTool(
      "update_project_variable",
      {
        project_id: TEST_PROJECT_ID,
        key: TEST_VAR_KEY,
        value: "updated-value",
      },
      baseEnv
    );
    assert.strictEqual(result.value, "updated-value");
  });

  test("delete_project_variable returns success status", async () => {
    const result = await callTool(
      "delete_project_variable",
      { project_id: TEST_PROJECT_ID, key: TEST_VAR_KEY },
      baseEnv
    );
    assert.strictEqual(result.status, "success");
    assert.ok(result.message.includes(TEST_VAR_KEY));
  });

  // --- Group variable tests ---

  test("list_group_variables returns variable array", async () => {
    const result = await callTool(
      "list_group_variables",
      { group_id: TEST_GROUP_ID },
      baseEnv
    );
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].key, TEST_GROUP_VAR_KEY);
    assert.strictEqual(result[0].masked, true);
  });

  test("get_group_variable returns single variable", async () => {
    const result = await callTool(
      "get_group_variable",
      { group_id: TEST_GROUP_ID, key: TEST_GROUP_VAR_KEY },
      baseEnv
    );
    assert.strictEqual(result.key, TEST_GROUP_VAR_KEY);
    assert.strictEqual(result.variable_type, "env_var");
  });

  test("create_group_variable returns created variable", async () => {
    const result = await callTool(
      "create_group_variable",
      {
        group_id: TEST_GROUP_ID,
        key: TEST_GROUP_VAR_KEY,
        value: "new-secret",
        masked: true,
      },
      baseEnv
    );
    assert.strictEqual(result.key, TEST_GROUP_VAR_KEY);
    assert.strictEqual(result.value, "new-secret");
  });

  test("update_group_variable returns updated variable", async () => {
    const result = await callTool(
      "update_group_variable",
      {
        group_id: TEST_GROUP_ID,
        key: TEST_GROUP_VAR_KEY,
        value: "updated-secret",
      },
      baseEnv
    );
    assert.strictEqual(result.value, "updated-secret");
  });

  test("delete_group_variable returns success status", async () => {
    const result = await callTool(
      "delete_group_variable",
      { group_id: TEST_GROUP_ID, key: TEST_GROUP_VAR_KEY },
      baseEnv
    );
    assert.strictEqual(result.status, "success");
    assert.ok(result.message.includes(TEST_GROUP_VAR_KEY));
  });

  // --- filter[environment_scope] tests ---

  test("get_project_variable passes filter[environment_scope] to GitLab", async () => {
    lastReceivedFilterScope = undefined;
    const result = await callTool(
      "get_project_variable",
      { project_id: TEST_PROJECT_ID, key: TEST_VAR_KEY, filter: { environment_scope: TEST_SCOPE } },
      baseEnv
    );
    assert.strictEqual(lastReceivedFilterScope, TEST_SCOPE);
    assert.strictEqual(result.environment_scope, TEST_SCOPE);
  });

  test("update_project_variable passes filter[environment_scope] to GitLab", async () => {
    lastReceivedFilterScope = undefined;
    const result = await callTool(
      "update_project_variable",
      {
        project_id: TEST_PROJECT_ID,
        key: TEST_VAR_KEY,
        value: "scoped-value",
        filter: { environment_scope: TEST_SCOPE },
      },
      baseEnv
    );
    assert.strictEqual(lastReceivedFilterScope, TEST_SCOPE);
    assert.strictEqual(result.environment_scope, TEST_SCOPE);
  });

  test("delete_project_variable passes filter[environment_scope] to GitLab", async () => {
    lastReceivedFilterScope = undefined;
    const result = await callTool(
      "delete_project_variable",
      { project_id: TEST_PROJECT_ID, key: TEST_VAR_KEY, filter: { environment_scope: TEST_SCOPE } },
      baseEnv
    );
    assert.strictEqual(lastReceivedFilterScope, TEST_SCOPE);
    assert.strictEqual(result.status, "success");
  });

  // --- Toolset behaviour ---

  test("variables tools are absent when toolset is not activated", async () => {
    return new Promise<void>((resolve, reject) => {
      const proc = spawn("node", ["build/index.js"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
          GITLAB_API_URL: mockApiUrl,
          // No GITLAB_TOOLSETS — default toolsets only
        },
      });

      let output = "";
      proc.stdout?.on("data", (d: Buffer) => (output += d));
      proc.on("close", () => {
        try {
          const line = output.split("\n").find(l => l.startsWith("{"));
          if (!line) return reject(new Error("No JSON output found"));
          const response = JSON.parse(line);
          const names: string[] = (response.result?.tools ?? []).map((t: { name: string }) => t.name);
          assert.ok(!names.includes("list_project_variables"), "tool should not be in default toolset");
          assert.ok(!names.includes("create_project_variable"), "tool should not be in default toolset");
          assert.ok(!names.includes("list_group_variables"), "tool should not be in default toolset");
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      proc.stdin?.end(
        JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }) + "\n"
      );
    });
  });

  test("write tools are absent from tools/list in read-only mode", async () => {
    return new Promise<void>((resolve, reject) => {
      const proc = spawn("node", ["build/index.js"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...baseEnv, GITLAB_READ_ONLY_MODE: "true" },
      });

      let output = "";
      proc.stdout?.on("data", (d: Buffer) => (output += d));
      proc.on("close", () => {
        try {
          const line = output.split("\n").find(l => l.startsWith("{"));
          if (!line) return reject(new Error("No JSON output found"));
          const response = JSON.parse(line);
          const names: string[] = (response.result?.tools ?? []).map((t: { name: string }) => t.name);
          assert.ok(!names.includes("create_project_variable"), "create should be absent in read-only mode");
          assert.ok(!names.includes("update_project_variable"), "update should be absent in read-only mode");
          assert.ok(!names.includes("delete_project_variable"), "delete should be absent in read-only mode");
          assert.ok(!names.includes("create_group_variable"), "create should be absent in read-only mode");
          assert.ok(!names.includes("delete_group_variable"), "delete should be absent in read-only mode");
          assert.ok(names.includes("list_project_variables"), "list should be present in read-only mode");
          assert.ok(names.includes("get_project_variable"), "get should be present in read-only mode");
          assert.ok(names.includes("list_group_variables"), "list should be present in read-only mode");
          assert.ok(names.includes("get_group_variable"), "get should be present in read-only mode");
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      proc.stdin?.end(
        JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }) + "\n"
      );
    });
  });
});
