import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-mock-token-webhooks";
const TEST_PROJECT_ID = "123";
const TEST_GROUP_ID = "my-group";
const TEST_HOOK_ID = 42;

const MOCK_PROJECT_HOOK = {
  id: TEST_HOOK_ID,
  url: "https://example.com/hook",
  name: "AI Hook",
  description: "Registered by MCP",
  project_id: Number(TEST_PROJECT_ID),
  push_events: true,
  issues_events: false,
  enable_ssl_verification: true,
};

const MOCK_GROUP_HOOK = {
  id: TEST_HOOK_ID,
  url: "https://example.com/group-hook",
  name: "Group Hook",
  group_id: 3,
  push_events: true,
  member_events: true,
  enable_ssl_verification: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function callTool(
  toolName: string,
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): Promise<unknown> {
  return new Promise((resolve, reject) => {
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

describe("When managing webhooks", () => {
  let mockServer: MockGitLabServer;
  let baseEnv: NodeJS.ProcessEnv;
  let lastCreateBody: Record<string, unknown> | undefined;
  let lastUpdateBody: Record<string, unknown> | undefined;
  let lastDeletePath: string | undefined;

  before(async () => {
    mockServer = new MockGitLabServer({
      port: await findMockServerPort(),
      validTokens: [MOCK_TOKEN],
    });

    mockServer.addMockHandler("post", `/projects/${TEST_PROJECT_ID}/hooks`, (req, res) => {
      lastCreateBody = isRecord(req.body) ? req.body : undefined;
      res.status(201).json({ ...MOCK_PROJECT_HOOK, ...lastCreateBody });
    });

    mockServer.addMockHandler(
      "put",
      `/projects/${TEST_PROJECT_ID}/hooks/${TEST_HOOK_ID}`,
      (req, res) => {
        lastUpdateBody = isRecord(req.body) ? req.body : undefined;
        res.json({ ...MOCK_PROJECT_HOOK, ...lastUpdateBody, id: TEST_HOOK_ID });
      }
    );

    mockServer.addMockHandler(
      "delete",
      `/projects/${TEST_PROJECT_ID}/hooks/${TEST_HOOK_ID}`,
      (req, res) => {
        lastDeletePath = req.path;
        res.status(204).send();
      }
    );

    mockServer.addMockHandler("post", `/groups/${TEST_GROUP_ID}/hooks`, (req, res) => {
      lastCreateBody = isRecord(req.body) ? req.body : undefined;
      res.status(201).json({ ...MOCK_GROUP_HOOK, ...lastCreateBody });
    });

    mockServer.addMockHandler(
      "put",
      `/groups/${TEST_GROUP_ID}/hooks/${TEST_HOOK_ID}`,
      (req, res) => {
        lastUpdateBody = isRecord(req.body) ? req.body : undefined;
        res.json({ ...MOCK_GROUP_HOOK, ...lastUpdateBody, id: TEST_HOOK_ID });
      }
    );

    mockServer.addMockHandler(
      "delete",
      `/groups/${TEST_GROUP_ID}/hooks/${TEST_HOOK_ID}`,
      (req, res) => {
        lastDeletePath = req.path;
        res.status(204).send();
      }
    );

    await mockServer.start();
    baseEnv = {
      GITLAB_API_URL: mockServer.getUrl() + "/api/v4",
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      GITLAB_TOOLSETS: "webhooks",
      GITLAB_READ_ONLY_MODE: "false",
    };
  });

  after(async () => {
    if (mockServer) await mockServer.stop();
  });

  describe("with create_webhook on a project", () => {
    test("should create a webhook and return the GitLab response", async () => {
      lastCreateBody = undefined;
      const result = await callTool(
        "create_webhook",
        {
          project_id: TEST_PROJECT_ID,
          url: "https://example.com/hook",
          name: "AI Hook",
          push_events: true,
          issues_events: true,
        },
        baseEnv
      );

      assert.deepStrictEqual(lastCreateBody, {
        url: "https://example.com/hook",
        name: "AI Hook",
        push_events: true,
        issues_events: true,
      });
      assert.ok(isRecord(result));
      assert.strictEqual(result.url, "https://example.com/hook");
      assert.strictEqual(result.name, "AI Hook");
    });
  });

  describe("with update_webhook on a project", () => {
    test("should update a webhook and return the GitLab response", async () => {
      lastUpdateBody = undefined;
      const result = await callTool(
        "update_webhook",
        {
          project_id: TEST_PROJECT_ID,
          hook_id: TEST_HOOK_ID,
          url: "https://example.com/hook-updated",
          name: "Renamed Hook",
        },
        baseEnv
      );

      assert.deepStrictEqual(lastUpdateBody, {
        url: "https://example.com/hook-updated",
        name: "Renamed Hook",
      });
      assert.ok(isRecord(result));
      assert.strictEqual(result.url, "https://example.com/hook-updated");
    });
  });

  describe("with delete_webhook on a project", () => {
    test("should delete a webhook and return a deleted status", async () => {
      lastDeletePath = undefined;
      const result = await callTool(
        "delete_webhook",
        {
          project_id: TEST_PROJECT_ID,
          hook_id: TEST_HOOK_ID,
        },
        baseEnv
      );

      assert.strictEqual(lastDeletePath, `/projects/${TEST_PROJECT_ID}/hooks/${TEST_HOOK_ID}`);
      assert.deepStrictEqual(result, { status: "deleted", hook_id: TEST_HOOK_ID });
    });
  });

  describe("with create_webhook on a group", () => {
    test("should create a group webhook", async () => {
      lastCreateBody = undefined;
      const result = await callTool(
        "create_webhook",
        {
          group_id: TEST_GROUP_ID,
          url: "https://example.com/group-hook",
          member_events: true,
        },
        baseEnv
      );

      assert.ok(lastCreateBody);
      assert.strictEqual(lastCreateBody["url"], "https://example.com/group-hook");
      assert.strictEqual(lastCreateBody["member_events"], true);
      assert.ok(isRecord(result));
      assert.strictEqual(result["url"], "https://example.com/group-hook");
    });
  });

  describe("with update_webhook on a group", () => {
    test("should update a group webhook", async () => {
      lastUpdateBody = undefined;
      const result = await callTool(
        "update_webhook",
        {
          group_id: TEST_GROUP_ID,
          hook_id: TEST_HOOK_ID,
          url: "https://example.com/group-hook-updated",
          name: "Renamed Group Hook",
        },
        baseEnv
      );

      assert.deepStrictEqual(lastUpdateBody, {
        url: "https://example.com/group-hook-updated",
        name: "Renamed Group Hook",
      });
      assert.ok(isRecord(result));
      assert.strictEqual(result.url, "https://example.com/group-hook-updated");
    });
  });

  describe("with delete_webhook on a group", () => {
    test("should delete a group webhook", async () => {
      lastDeletePath = undefined;
      const result = await callTool(
        "delete_webhook",
        {
          group_id: TEST_GROUP_ID,
          hook_id: TEST_HOOK_ID,
        },
        baseEnv
      );

      assert.strictEqual(lastDeletePath, `/groups/${TEST_GROUP_ID}/hooks/${TEST_HOOK_ID}`);
      assert.deepStrictEqual(result, { status: "deleted", hook_id: TEST_HOOK_ID });
    });
  });

  describe("with invalid scope", () => {
    test("should reject when both project_id and group_id are provided", async () => {
      await assert.rejects(
        () =>
          callTool(
            "create_webhook",
            {
              project_id: TEST_PROJECT_ID,
              group_id: TEST_GROUP_ID,
              url: "https://example.com/hook",
            },
            baseEnv
          ),
        /project_id or group_id/
      );
    });
  });
});
