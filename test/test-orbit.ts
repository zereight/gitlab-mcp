import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-mock-token-12345";

const mockSchema = {
  nodes: [{ name: "Project", properties: ["id", "name"] }],
  edges: [{ name: "HAS_MERGE_REQUEST", from: "Project", to: "MergeRequest" }],
};

const mockStatus = {
  status: "ready",
  last_indexed_at: "2026-09-05T10:00:00Z",
  indexed_groups: 3,
};

const mockTools = {
  tools: [{ name: "orbit_query", description: "Execute a graph query" }],
};

const mockQueryRaw = {
  results: [{ project: "group/a", failures: 7 }],
};

const mockQueryLlm = "Top failing project: group/a (7 failures).";

function baseEnv(mockGitLabUrl: string): NodeJS.ProcessEnv {
  return {
    GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
    GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
    GITLAB_TOOLSETS: "orbit",
  };
}

async function callToolAsync(
  env: NodeJS.ProcessEnv,
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });

    let output = "";
    let errorOutput = "";
    proc.stdout?.on("data", (chunk: Buffer) => (output += chunk));
    proc.stderr?.on("data", (chunk: Buffer) => (errorOutput += chunk));

    proc.on("close", code => {
      if (code !== 0) {
        return reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
      }

      const line = output.split("\n").find(entry => entry.startsWith("{"));
      if (!line) {
        return reject(new Error("No JSON output found"));
      }

      try {
        const response = JSON.parse(line);
        if (response.error) {
          reject(new Error(JSON.stringify(response.error)));
          return;
        }

        const content = response.result?.content?.[0]?.text;
        if (content === undefined) {
          reject(new Error("No tool result content"));
          return;
        }

        resolve(content);
      } catch (error) {
        reject(error);
      }
    });

    proc.stdin?.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args },
      }) + "\n"
    );
  });
}

describe("orbit tools", () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;
  let lastQueryBody: Record<string, unknown> | null = null;

  before(async () => {
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });

    mockGitLab.addMockHandler("get", "/orbit/schema", (_req, res) => {
      res.json(mockSchema);
    });
    mockGitLab.addMockHandler("get", "/orbit/status", (_req, res) => {
      res.json(mockStatus);
    });
    mockGitLab.addMockHandler("get", "/orbit/tools", (_req, res) => {
      res.json(mockTools);
    });
    mockGitLab.addMockHandler("post", "/orbit/query", (req, res) => {
      lastQueryBody = req.body;
      if (req.body?.format === "raw") {
        res.json(mockQueryRaw);
        return;
      }
      res.type("text/plain").send(mockQueryLlm);
    });

    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  test("orbit_get_schema returns the graph schema", async () => {
    const text = await callToolAsync(baseEnv(mockGitLabUrl), "orbit_get_schema", {});
    assert.deepEqual(JSON.parse(text), mockSchema);
  });

  test("orbit_get_status returns indexing status", async () => {
    const text = await callToolAsync(baseEnv(mockGitLabUrl), "orbit_get_status", {});
    assert.deepEqual(JSON.parse(text), mockStatus);
  });

  test("orbit_list_tools returns tool definitions", async () => {
    const text = await callToolAsync(baseEnv(mockGitLabUrl), "orbit_list_tools", {});
    assert.deepEqual(JSON.parse(text), mockTools);
  });

  test("orbit_query with format=raw returns structured JSON", async () => {
    const query = { node: "Project", limit: 5 };
    const text = await callToolAsync(baseEnv(mockGitLabUrl), "orbit_query", {
      query,
      format: "raw",
    });
    assert.deepEqual(JSON.parse(text), mockQueryRaw);
    assert.deepEqual(lastQueryBody, { query, format: "raw" });
  });

  test("orbit_query defaults to llm format and passes text through", async () => {
    const query = { node: "Project", limit: 5 };
    const text = await callToolAsync(baseEnv(mockGitLabUrl), "orbit_query", { query });
    assert.equal(text, mockQueryLlm);
    assert.deepEqual(lastQueryBody, { query, format: "llm" });
  });

  for (const toolName of [
    "orbit_query",
    "orbit_get_schema",
    "orbit_get_status",
    "orbit_list_tools",
  ]) {
    test(`${toolName} is refused under strict project scope`, async () => {
      const env: NodeJS.ProcessEnv = {
        ...baseEnv(mockGitLabUrl),
        ENABLE_STRICT_PROJECT_SCOPE: "true",
        GITLAB_ALLOWED_PROJECT_IDS: "1,2",
      };
      const args = toolName === "orbit_query" ? { query: {} } : {};
      let message = "";
      try {
        message = await callToolAsync(env, toolName, args);
      } catch (error) {
        message = (error as Error).message;
      }
      assert.match(message, /not allowed while a project allowlist is in effect/);
    });
  }
});
