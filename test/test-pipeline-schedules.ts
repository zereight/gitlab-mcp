import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-mock-token-pipeline-schedules";
const TEST_PROJECT_ID = "123";
const TEST_SCHEDULE_ID = "13";
const MISSING_SCHEDULE_ID = "999";
const TEST_VAR_KEY = "NIGHTLY_TARGET";

const MOCK_OWNER = {
  name: "Administrator",
  username: "root",
  id: 1,
  state: "active",
  avatar_url: "https://gitlab.example.com/uploads/-/system/user/avatar/1/avatar.png",
  web_url: "https://gitlab.example.com/root",
};

const MOCK_SCHEDULE = {
  id: Number(TEST_SCHEDULE_ID),
  description: "Nightly build",
  ref: "refs/heads/main",
  cron: "0 1 * * *",
  cron_timezone: "UTC",
  next_run_at: "2026-09-01T01:00:00.000Z",
  active: true,
  created_at: "2026-08-01T13:31:08.849Z",
  updated_at: "2026-08-01T13:40:17.727Z",
  owner: MOCK_OWNER,
};

const MOCK_INACTIVE_SCHEDULE = {
  ...MOCK_SCHEDULE,
  id: 14,
  description: "Paused weekly deploy",
  cron: "0 3 * * 5",
  active: false,
};

const MOCK_SCHEDULE_DETAIL = {
  ...MOCK_SCHEDULE,
  last_pipeline: {
    id: 332,
    sha: "0e788619d0b5ec17388dffb973ecd505946156db",
    ref: "refs/heads/main",
    status: "success",
  },
  variables: [{ key: TEST_VAR_KEY, variable_type: "env_var", value: "staging", raw: false }],
  inputs: [{ name: "deploy_strategy", value: "blue-green" }],
};

const MOCK_SCHEDULE_PIPELINE = {
  id: 47,
  iid: 12,
  project_id: Number(TEST_PROJECT_ID),
  status: "success",
  source: "schedule",
  ref: "refs/heads/main",
  sha: "a91957a858320c0e17f3a0eca7cfacbff50ea29a",
  web_url: "https://gitlab.example.com/foo/bar/-/pipelines/47",
  created_at: "2026-08-20T11:28:34.085Z",
  updated_at: "2026-08-20T11:32:35.169Z",
};

const MOCK_VARIABLE = {
  key: TEST_VAR_KEY,
  variable_type: "env_var",
  value: "staging",
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

/** Tools that return JSON return it as the first content block's text. */
async function callToolJson(
  toolName: string,
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): Promise<any> {
  const result = await callTool(toolName, args, env);
  const content = result?.content?.[0]?.text;
  return content ? JSON.parse(content) : result;
}

/** Tools that return a human summary return it as the first content block's text. */
async function callToolText(
  toolName: string,
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): Promise<string> {
  const result = await callTool(toolName, args, env);
  return result?.content?.[0]?.text ?? "";
}

function listTools(env: NodeJS.ProcessEnv): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });

    let output = "";
    proc.stdout?.on("data", (d: Buffer) => (output += d));
    proc.on("close", () => {
      try {
        const line = output.split("\n").find(l => l.startsWith("{"));
        if (!line) return reject(new Error("No JSON output found"));
        const response = JSON.parse(line);
        resolve((response.result?.tools ?? []).map((t: { name: string }) => t.name));
      } catch (e) {
        reject(e);
      }
    });

    proc.stdin?.end(
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }) + "\n"
    );
  });
}

describe("Pipeline schedule tools", () => {
  let mockServer: MockGitLabServer;
  let mockApiUrl: string;
  let baseEnv: NodeJS.ProcessEnv;
  let lastReceivedScope: string | undefined;
  let lastReceivedBody: Record<string, any> | undefined;
  let lastReceivedQuery: Record<string, string> | undefined;

  // Read through a function so control-flow narrowing from the `= undefined`
  // reset before each call does not collapse the type to `never`.
  const capturedBody = (): Record<string, any> | undefined => lastReceivedBody;
  const capturedQuery = (): Record<string, string> | undefined => lastReceivedQuery;

  const schedulesPath = `/projects/${TEST_PROJECT_ID}/pipeline_schedules`;
  const schedulePath = `${schedulesPath}/${TEST_SCHEDULE_ID}`;
  const variablesPath = `${schedulePath}/variables`;
  const variablePath = `${variablesPath}/${TEST_VAR_KEY}`;

  before(async () => {
    mockServer = new MockGitLabServer({
      port: await findMockServerPort(),
      validTokens: [MOCK_TOKEN],
    });

    // --- Schedule endpoints ---
    mockServer.addMockHandler("get", schedulesPath, (req, res) => {
      const scope = (req.query as Record<string, string>).scope;
      lastReceivedScope = scope;
      if (scope === "inactive") {
        res.json([MOCK_INACTIVE_SCHEDULE]);
      } else if (scope === "active") {
        res.json([MOCK_SCHEDULE]);
      } else {
        res.json([MOCK_SCHEDULE, MOCK_INACTIVE_SCHEDULE]);
      }
    });

    mockServer.addMockHandler("get", schedulePath, (_req, res) => {
      res.json(MOCK_SCHEDULE_DETAIL);
    });

    mockServer.addMockHandler("get", `${schedulesPath}/${MISSING_SCHEDULE_ID}`, (_req, res) => {
      res.status(404).json({ message: "404 Not found" });
    });

    mockServer.addMockHandler("get", `${schedulePath}/pipelines`, (req, res) => {
      lastReceivedQuery = req.query as Record<string, string>;
      res.json([MOCK_SCHEDULE_PIPELINE]);
    });

    mockServer.addMockHandler("post", schedulesPath, (req, res) => {
      lastReceivedBody = req.body as Record<string, any>;
      res.status(201).json({ ...MOCK_SCHEDULE, ...(req.body as object), id: 14 });
    });

    mockServer.addMockHandler("put", schedulePath, (req, res) => {
      lastReceivedBody = req.body as Record<string, any>;
      res.json({ ...MOCK_SCHEDULE, ...(req.body as object) });
    });

    mockServer.addMockHandler("delete", schedulePath, (_req, res) => {
      res.json(MOCK_SCHEDULE);
    });

    mockServer.addMockHandler("post", `${schedulePath}/play`, (_req, res) => {
      res.status(201).json({ message: "201 Created" });
    });

    mockServer.addMockHandler("post", `${schedulePath}/take_ownership`, (_req, res) => {
      res.json({
        ...MOCK_SCHEDULE,
        owner: { ...MOCK_OWNER, id: 50, name: "Ada", username: "ada" },
      });
    });

    // --- Schedule variable endpoints ---
    mockServer.addMockHandler("get", variablePath, (_req, res) => {
      res.json(MOCK_VARIABLE);
    });

    mockServer.addMockHandler("post", variablesPath, (req, res) => {
      lastReceivedBody = req.body as Record<string, any>;
      res.status(201).json({ ...MOCK_VARIABLE, ...(req.body as object) });
    });

    mockServer.addMockHandler("put", variablePath, (req, res) => {
      lastReceivedBody = req.body as Record<string, any>;
      res.json({ ...MOCK_VARIABLE, ...(req.body as object) });
    });

    // GitLab documents a 200 with the deleted variable, but self-managed
    // instances have been seen answering 204; neither body is parsed.
    mockServer.addMockHandler("delete", variablePath, (_req, res) => {
      res.status(204).send();
    });

    await mockServer.start();
    mockApiUrl = `${mockServer.getUrl()}/api/v4`;

    baseEnv = {
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      GITLAB_API_URL: mockApiUrl,
      GITLAB_TOOLSETS: "pipelines",
    };
  });

  after(async () => {
    await mockServer.stop();
  });

  // --- Reads ---

  test("list_pipeline_schedules returns every schedule when no scope is given", async () => {
    lastReceivedScope = undefined;
    const result = await callToolJson(
      "list_pipeline_schedules",
      { project_id: TEST_PROJECT_ID },
      baseEnv
    );
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].description, "Nightly build");
    assert.strictEqual(result[0].cron, "0 1 * * *");
    assert.strictEqual(result[0].active, true);
    assert.strictEqual(lastReceivedScope, undefined);
  });

  test("list_pipeline_schedules forwards scope to GitLab", async () => {
    lastReceivedScope = undefined;
    const result = await callToolJson(
      "list_pipeline_schedules",
      { project_id: TEST_PROJECT_ID, scope: "inactive" },
      baseEnv
    );
    assert.strictEqual(lastReceivedScope, "inactive");
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].active, false);
    assert.strictEqual(result[0].description, "Paused weekly deploy");
  });

  test("get_pipeline_schedule returns variables, inputs and last pipeline", async () => {
    const result = await callToolJson(
      "get_pipeline_schedule",
      { project_id: TEST_PROJECT_ID, pipeline_schedule_id: TEST_SCHEDULE_ID },
      baseEnv
    );
    assert.strictEqual(result.id, TEST_SCHEDULE_ID);
    assert.strictEqual(result.description, "Nightly build");
    assert.strictEqual(result.owner.username, "root");
    assert.strictEqual(result.last_pipeline.status, "success");
    assert.strictEqual(result.variables[0].key, TEST_VAR_KEY);
    assert.strictEqual(result.inputs[0].name, "deploy_strategy");
  });

  test("get_pipeline_schedule surfaces a 404 as an error", async () => {
    await assert.rejects(
      () =>
        callToolJson(
          "get_pipeline_schedule",
          { project_id: TEST_PROJECT_ID, pipeline_schedule_id: MISSING_SCHEDULE_ID },
          baseEnv
        ),
      /404/
    );
  });

  test("list_pipeline_schedule_pipelines returns the triggered pipelines", async () => {
    const result = await callToolJson(
      "list_pipeline_schedule_pipelines",
      { project_id: TEST_PROJECT_ID, pipeline_schedule_id: TEST_SCHEDULE_ID },
      baseEnv
    );
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, "47");
    assert.strictEqual(result[0].status, "success");
    assert.strictEqual(result[0].source, "schedule");
  });

  test("list_pipeline_schedule_pipelines forwards the endpoint's filters", async () => {
    lastReceivedQuery = undefined;
    await callToolJson(
      "list_pipeline_schedule_pipelines",
      {
        project_id: TEST_PROJECT_ID,
        pipeline_schedule_id: TEST_SCHEDULE_ID,
        scope: "finished",
        status: "success",
        sort: "desc",
        updated_after: "2026-08-01T00:00:00Z",
        created_before: "2026-08-31T00:00:00Z",
      },
      baseEnv
    );
    // Express exposes req.query as a null-prototype object; spread to compare.
    assert.deepStrictEqual(
      { ...capturedQuery() },
      {
        scope: "finished",
        status: "success",
        sort: "desc",
        updated_after: "2026-08-01T00:00:00Z",
        created_before: "2026-08-31T00:00:00Z",
      }
    );
  });

  // --- Mutations ---

  test("create_pipeline_schedule posts cron, description and ref", async () => {
    lastReceivedBody = undefined;
    const text = await callToolText(
      "create_pipeline_schedule",
      {
        project_id: TEST_PROJECT_ID,
        description: "Nightly build",
        ref: "refs/heads/main",
        cron: "0 1 * * *",
        cron_timezone: "Asia/Tokyo",
      },
      baseEnv
    );
    assert.strictEqual(capturedBody()?.cron, "0 1 * * *");
    assert.strictEqual(capturedBody()?.description, "Nightly build");
    assert.strictEqual(capturedBody()?.ref, "refs/heads/main");
    assert.strictEqual(capturedBody()?.cron_timezone, "Asia/Tokyo");
    assert.match(text, /Created pipeline schedule #14/);
  });

  test("create_pipeline_schedule sends active=false rather than coercing it to true", async () => {
    lastReceivedBody = undefined;
    await callToolText(
      "create_pipeline_schedule",
      {
        project_id: TEST_PROJECT_ID,
        description: "Paused weekly deploy",
        ref: "main",
        cron: "0 3 * * 5",
        active: "false",
      },
      baseEnv
    );
    assert.strictEqual(capturedBody()?.active, false);
  });

  test("create_pipeline_schedule accepts non-string values inside an input array", async () => {
    lastReceivedBody = undefined;
    await callToolText(
      "create_pipeline_schedule",
      {
        project_id: TEST_PROJECT_ID,
        description: "Nightly build",
        ref: "main",
        cron: "0 1 * * *",
        inputs: [
          { name: "retries", value: 3 },
          { name: "verbose", value: true },
          { name: "targets", value: ["staging", 7, { region: "eu" }] },
          { name: "matrix", value: { os: "linux" } },
        ],
      },
      baseEnv
    );
    assert.deepStrictEqual(capturedBody()?.inputs, [
      { name: "retries", value: 3 },
      { name: "verbose", value: true },
      { name: "targets", value: ["staging", 7, { region: "eu" }] },
      { name: "matrix", value: { os: "linux" } },
    ]);
  });

  test("update_pipeline_schedule sends only the supplied fields", async () => {
    lastReceivedBody = undefined;
    const text = await callToolText(
      "update_pipeline_schedule",
      {
        project_id: TEST_PROJECT_ID,
        pipeline_schedule_id: TEST_SCHEDULE_ID,
        cron: "0 2 * * *",
      },
      baseEnv
    );
    assert.deepStrictEqual(capturedBody(), { cron: "0 2 * * *" });
    assert.match(text, /Updated pipeline schedule #13/);
    assert.match(text, /0 2 \* \* \*/);
  });

  test("delete_pipeline_schedule reports the removed schedule id", async () => {
    const text = await callToolText(
      "delete_pipeline_schedule",
      { project_id: TEST_PROJECT_ID, pipeline_schedule_id: TEST_SCHEDULE_ID },
      baseEnv
    );
    assert.match(text, /Deleted pipeline schedule #13/);
  });

  test("play_pipeline_schedule reports GitLab's acknowledgement", async () => {
    const text = await callToolText(
      "play_pipeline_schedule",
      { project_id: TEST_PROJECT_ID, pipeline_schedule_id: TEST_SCHEDULE_ID },
      baseEnv
    );
    assert.match(text, /Ran pipeline schedule #13/);
    assert.match(text, /201 Created/);
    assert.match(text, /next scheduled run is unchanged/);
  });

  test("take_ownership_pipeline_schedule reports the new owner", async () => {
    const text = await callToolText(
      "take_ownership_pipeline_schedule",
      { project_id: TEST_PROJECT_ID, pipeline_schedule_id: TEST_SCHEDULE_ID },
      baseEnv
    );
    assert.match(text, /Took ownership of pipeline schedule #13/);
    assert.match(text, /ada/);
  });

  // --- Schedule variables ---

  test("get_pipeline_schedule_variable returns the variable", async () => {
    const result = await callToolJson(
      "get_pipeline_schedule_variable",
      {
        project_id: TEST_PROJECT_ID,
        pipeline_schedule_id: TEST_SCHEDULE_ID,
        key: TEST_VAR_KEY,
      },
      baseEnv
    );
    assert.strictEqual(result.key, TEST_VAR_KEY);
    assert.strictEqual(result.value, "staging");
    assert.strictEqual(result.variable_type, "env_var");
  });

  test("create_pipeline_schedule_variable posts key, value and type", async () => {
    lastReceivedBody = undefined;
    const text = await callToolText(
      "create_pipeline_schedule_variable",
      {
        project_id: TEST_PROJECT_ID,
        pipeline_schedule_id: TEST_SCHEDULE_ID,
        key: TEST_VAR_KEY,
        value: "production",
        variable_type: "env_var",
      },
      baseEnv
    );
    assert.deepStrictEqual(capturedBody(), {
      key: TEST_VAR_KEY,
      value: "production",
      variable_type: "env_var",
    });
    assert.match(text, new RegExp(`Created variable '${TEST_VAR_KEY}'`));
  });

  test("update_pipeline_schedule_variable puts the new value", async () => {
    lastReceivedBody = undefined;
    const text = await callToolText(
      "update_pipeline_schedule_variable",
      {
        project_id: TEST_PROJECT_ID,
        pipeline_schedule_id: TEST_SCHEDULE_ID,
        key: TEST_VAR_KEY,
        value: "production",
      },
      baseEnv
    );
    assert.deepStrictEqual(capturedBody(), { value: "production" });
    assert.match(text, new RegExp(`Updated variable '${TEST_VAR_KEY}'`));
  });

  test("delete_pipeline_schedule_variable reports the removed key", async () => {
    const text = await callToolText(
      "delete_pipeline_schedule_variable",
      {
        project_id: TEST_PROJECT_ID,
        pipeline_schedule_id: TEST_SCHEDULE_ID,
        key: TEST_VAR_KEY,
      },
      baseEnv
    );
    assert.match(text, new RegExp(`Deleted variable '${TEST_VAR_KEY}'`));
    assert.match(text, /pipeline schedule #13/);
  });

  // --- Toolset and permission behaviour ---

  test("pipeline schedule tools are absent when the pipelines toolset is not activated", async () => {
    const names = await listTools({
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      GITLAB_API_URL: mockApiUrl,
      // No GITLAB_TOOLSETS — pipelines is not a default toolset
    });
    assert.ok(!names.includes("list_pipeline_schedules"), "list should be opt-in");
    assert.ok(!names.includes("create_pipeline_schedule"), "create should be opt-in");
    assert.ok(!names.includes("delete_pipeline_schedule"), "delete should be opt-in");
  });

  test("USE_PIPELINE=true exposes the pipeline schedule tools", async () => {
    const names = await listTools({
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      GITLAB_API_URL: mockApiUrl,
      USE_PIPELINE: "true",
    });
    assert.ok(names.includes("list_pipeline_schedules"), "list should be exposed");
    assert.ok(names.includes("play_pipeline_schedule"), "play should be exposed");
    assert.ok(
      names.includes("delete_pipeline_schedule_variable"),
      "variable delete should be exposed"
    );
  });

  test("write tools are absent from tools/list in read-only mode", async () => {
    const names = await listTools({ ...baseEnv, GITLAB_READ_ONLY_MODE: "true" });
    for (const name of [
      "create_pipeline_schedule",
      "update_pipeline_schedule",
      "delete_pipeline_schedule",
      "play_pipeline_schedule",
      "take_ownership_pipeline_schedule",
      "create_pipeline_schedule_variable",
      "update_pipeline_schedule_variable",
      "delete_pipeline_schedule_variable",
    ]) {
      assert.ok(!names.includes(name), `${name} should be absent in read-only mode`);
    }
    for (const name of [
      "list_pipeline_schedules",
      "get_pipeline_schedule",
      "list_pipeline_schedule_pipelines",
      "get_pipeline_schedule_variable",
    ]) {
      assert.ok(names.includes(name), `${name} should be present in read-only mode`);
    }
  });

  test("read-only mode rejects a create_pipeline_schedule call", async () => {
    await assert.rejects(
      () =>
        callTool(
          "create_pipeline_schedule",
          {
            project_id: TEST_PROJECT_ID,
            description: "Nightly build",
            ref: "main",
            cron: "0 1 * * *",
          },
          { ...baseEnv, GITLAB_READ_ONLY_MODE: "true" }
        ),
      /read-only|not allowed|Unknown tool/i
    );
  });

  test("permission mode 'modify' blocks the delete tools", async () => {
    const names = await listTools({ ...baseEnv, GITLAB_PERMISSION_MODE: "modify" });
    assert.ok(
      !names.includes("delete_pipeline_schedule"),
      "delete_pipeline_schedule should be blocked in modify mode"
    );
    assert.ok(
      !names.includes("delete_pipeline_schedule_variable"),
      "delete_pipeline_schedule_variable should be blocked in modify mode"
    );
    assert.ok(
      names.includes("update_pipeline_schedule"),
      "update_pipeline_schedule should remain available in modify mode"
    );
  });
});
