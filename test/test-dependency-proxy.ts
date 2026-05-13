import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-mock-token-dependency-proxy";
const TEST_GROUP_PATH = "my-group";

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

describe("dependency proxy tools", () => {
  let mockServer: MockGitLabServer;
  let mockPort: number;
  let baseEnv: NodeJS.ProcessEnv;

  before(async () => {
    mockPort = await findMockServerPort();
    mockServer = new MockGitLabServer({ port: mockPort, validTokens: [MOCK_TOKEN] });

    // Mock GraphQL endpoint for get/list operations
    mockServer.addRootHandler("post", "/api/graphql", (req, res) => {
      const { query } = req.body as { query: string; variables: Record<string, unknown> };

      if (query.includes("updateDependencyProxySettings")) {
        res.json({ data: { updateDependencyProxySettings: { errors: [] } } });
      } else if (query.includes("dependencyProxySetting")) {
        res.json({
          data: {
            group: {
              dependencyProxySetting: { enabled: true },
              dependencyProxyBlobCount: 3,
              dependencyProxyTotalSize: "15728640",
              dependencyProxyImagePrefix:
                `localhost:${mockPort}/my-group/dependency_proxy/containers`,
              dependencyProxyImageTtlPolicy: { enabled: true, ttl: 90 },
            },
          },
        });
      } else if (query.includes("dependencyProxyBlobs")) {
        res.json({
          data: {
            group: {
              dependencyProxyBlobs: {
                nodes: [
                  { fileName: "sha256:abc123", size: "5 MiB", createdAt: "2026-01-01T00:00:00Z" },
                  { fileName: "sha256:def456", size: "10 MiB", createdAt: "2026-01-02T00:00:00Z" },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        });
      } else {
        res.status(400).json({ errors: [{ message: "Unexpected GraphQL query" }] });
      }
    });

    // Mock REST endpoint for purge
    mockServer.addMockHandler(
      "delete",
      `/groups/${TEST_GROUP_PATH}/dependency_proxy/cache`,
      (_req, res) => {
        res.status(202).send();
      }
    );

    await mockServer.start();

    baseEnv = {
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      GITLAB_API_URL: `http://localhost:${mockPort}/api/v4`,
      GITLAB_TOOLSETS: "dependency_proxy",
    };
  });

  after(async () => {
    await mockServer.stop();
  });

  test("get_dependency_proxy_settings returns enabled status and blob info", async () => {
    const result = await callTool("get_dependency_proxy_settings", { group_id: TEST_GROUP_PATH }, baseEnv);
    assert.strictEqual(result.enabled, true);
    assert.strictEqual(result.blob_count, 3);
    assert.strictEqual(result.total_size, "15728640");
    assert.ok(result.ttl_policy?.enabled);
  });

  test("list_dependency_proxy_blobs returns blobs with string sizes", async () => {
    const result = await callTool("list_dependency_proxy_blobs", { group_id: TEST_GROUP_PATH }, baseEnv);
    assert.ok(Array.isArray(result.blobs));
    assert.strictEqual(result.blobs.length, 2);
    assert.strictEqual(typeof result.blobs[0].size, "string");
    assert.strictEqual(result.blobs[0].file_name, "sha256:abc123");
  });

  test("purge_dependency_proxy_cache returns scheduled status", async () => {
    const result = await callTool("purge_dependency_proxy_cache", { group_id: TEST_GROUP_PATH }, baseEnv);
    assert.strictEqual(result.status, "success");
    assert.ok(result.message.includes("scheduled"));
  });

  test("update_dependency_proxy_settings enables the proxy and returns settings", async () => {
    const result = await callTool(
      "update_dependency_proxy_settings",
      { group_id: TEST_GROUP_PATH, enabled: true },
      baseEnv
    );
    assert.strictEqual(result.enabled, true);
  });

  test("update_dependency_proxy_settings rejects empty options", async () => {
    await assert.rejects(
      () => callTool("update_dependency_proxy_settings", { group_id: TEST_GROUP_PATH }, baseEnv),
      /At least one of enabled, identity, or secret must be provided/
    );
  });

  test("dependency_proxy tools are absent when toolset is not activated", async () => {
    return new Promise<void>((resolve, reject) => {
      const proc = spawn("node", ["build/index.js"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
          GITLAB_API_URL: `http://localhost:${mockPort}/api/v4`,
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
          const tools: { name: string }[] = response.result?.tools ?? [];
          const names = tools.map(t => t.name);
          assert.ok(!names.includes("get_dependency_proxy_settings"), "tool should not be in default toolset");
          assert.ok(!names.includes("purge_dependency_proxy_cache"), "tool should not be in default toolset");
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
          assert.ok(!names.includes("purge_dependency_proxy_cache"), "purge should be absent in read-only mode");
          assert.ok(!names.includes("update_dependency_proxy_settings"), "update should be absent in read-only mode");
          assert.ok(names.includes("get_dependency_proxy_settings"), "get should be present in read-only mode");
          assert.ok(names.includes("list_dependency_proxy_blobs"), "list should be present in read-only mode");
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
