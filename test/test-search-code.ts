/**
 * Search Code Tools Test Suite
 *
 * Tests search_code, search_project_code, and search_group_code tools
 * using the mock GitLab server and streamable HTTP transport.
 */

import { describe, test, after, before } from "node:test";
import assert from "node:assert";
import {
  launchServer,
  findAvailablePort,
  cleanupServers,
  ServerInstance,
  TransportMode,
  HOST,
} from "./utils/server-launcher.js";
import {
  MockGitLabServer,
  findMockServerPort,
} from "./utils/mock-gitlab-server.js";
import { CustomHeaderClient } from "./clients/custom-header-client.js";

const MOCK_TOKEN = "glpat-search-test-token";

// Port bases that don't conflict with other test suites
const MOCK_PORT_BASE = 9300;
const MCP_PORT_BASE = 3300;

let portCounter = 0;

async function nextMcpPort(): Promise<number> {
  return findAvailablePort(MCP_PORT_BASE + portCounter++ * 10);
}

async function launchMcpServer(
  mockGitLabUrl: string,
  mcpPort: number,
  extraEnv: Record<string, string> = {}
): Promise<ServerInstance> {
  return launchServer({
    mode: TransportMode.STREAMABLE_HTTP,
    port: mcpPort,
    timeout: 10000,
    env: {
      STREAMABLE_HTTP: "true",
      REMOTE_AUTHORIZATION: "true",
      GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
      ...extraEnv,
    },
  });
}

async function getToolNames(mcpUrl: string): Promise<string[]> {
  const client = new CustomHeaderClient({
    authorization: `Bearer ${MOCK_TOKEN}`,
  });
  await client.connect(mcpUrl);
  const result = await client.listTools();
  await client.disconnect();
  return result.tools.map((t: { name: string }) => t.name);
}

async function callTool(
  mcpUrl: string,
  toolName: string,
  args: Record<string, any> = {}
): Promise<any> {
  const client = new CustomHeaderClient({
    authorization: `Bearer ${MOCK_TOKEN}`,
  });
  await client.connect(mcpUrl);
  const result = await client.callTool(toolName, args);
  await client.disconnect();

  // Parse the tool result content
  const content = (result as any)?.content?.[0]?.text;
  if (content) {
    return JSON.parse(content);
  }
  return result;
}

// --- Tests ---

let mockGitLab: MockGitLabServer;
let mockGitLabUrl: string;

describe("Search Code Tools", () => {
  before(async () => {
    const mockPort = await findMockServerPort(MOCK_PORT_BASE);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
    console.log(`Mock GitLab: ${mockGitLabUrl}`);
  });

  after(async () => {
    if (mockGitLab) await mockGitLab.stop();
  });

  // ---- 1. search toolset exposes exactly 4 tools ----

  describe("search toolset exposes exactly 4 tools", () => {
    let server: ServerInstance;
    let tools: string[];

    before(async () => {
      const port = await nextMcpPort();
      server = await launchMcpServer(mockGitLabUrl, port, {
        GITLAB_TOOLSETS: "search",
      });
      tools = await getToolNames(`http://${HOST}:${port}/mcp`);
    });

    after(() => cleanupServers([server]));

    test("returns exactly 4 tools", () => {
      assert.strictEqual(tools.length, 4, `Expected 4 tools but got ${tools.length}: ${tools.join(", ")}`);
    });

    test("includes search_code", () => {
      assert.ok(tools.includes("search_code"), "Expected search_code to be present");
    });

    test("includes search_project_code", () => {
      assert.ok(tools.includes("search_project_code"), "Expected search_project_code to be present");
    });

    test("includes search_group_code", () => {
      assert.ok(tools.includes("search_group_code"), "Expected search_group_code to be present");
    });

    test("includes discover_tools", () => {
      assert.ok(tools.includes("discover_tools"), "Expected discover_tools to be present");
    });
  });

  // ---- 2. search_code returns blob results ----

  describe("search_code returns blob results", () => {
    let server: ServerInstance;
    let mcpUrl: string;

    before(async () => {
      const port = await nextMcpPort();
      server = await launchMcpServer(mockGitLabUrl, port, {
        GITLAB_TOOLSETS: "search",
      });
      mcpUrl = `http://${HOST}:${port}/mcp`;
    });

    after(() => cleanupServers([server]));

    test("returns array with blob fields", async () => {
      const result = await callTool(mcpUrl, "search_code", { search: "searchResult" });
      assert.ok(Array.isArray(result), "Response should be an array");
      assert.ok(result.length > 0, "Response should have at least one result");
      const first = result[0];
      assert.ok("filename" in first, "Result should have filename field");
      assert.ok("path" in first, "Result should have path field");
      assert.ok("startline" in first, "Result should have startline field");
    });

    test("result has correct filename", async () => {
      const result = await callTool(mcpUrl, "search_code", { search: "searchResult" });
      assert.strictEqual(result[0].filename, "index.ts");
    });

    test("result has correct path", async () => {
      const result = await callTool(mcpUrl, "search_code", { search: "searchResult" });
      assert.strictEqual(result[0].path, "src/index.ts");
    });

    test("result has correct startline", async () => {
      const result = await callTool(mcpUrl, "search_code", { search: "searchResult" });
      assert.strictEqual(result[0].startline, 42);
    });
  });

  // ---- 3. search_project_code returns blob results for project ----

  describe("search_project_code returns blob results for project", () => {
    let server: ServerInstance;
    let mcpUrl: string;

    before(async () => {
      const port = await nextMcpPort();
      server = await launchMcpServer(mockGitLabUrl, port, {
        GITLAB_TOOLSETS: "search",
      });
      mcpUrl = `http://${HOST}:${port}/mcp`;
    });

    after(() => cleanupServers([server]));

    test("returns array with project_id", async () => {
      const result = await callTool(mcpUrl, "search_project_code", {
        project_id: "123",
        search: "searchResult",
      });
      assert.ok(Array.isArray(result), "Response should be an array");
      assert.ok(result.length > 0, "Response should have at least one result");
    });

    test("result includes the correct project_id", async () => {
      const result = await callTool(mcpUrl, "search_project_code", {
        project_id: "123",
        search: "searchResult",
      });
      assert.strictEqual(String(result[0].project_id), "123", "project_id should match requested project");
    });
  });

  // ---- 3b. search_project_code handles URL-encoded namespaced paths ----

  describe("search_project_code handles URL-encoded namespaced paths", () => {
    let server: ServerInstance;
    let mcpUrl: string;

    before(async () => {
      const port = await nextMcpPort();
      server = await launchMcpServer(mockGitLabUrl, port, {
        GITLAB_TOOLSETS: "search",
      });
      mcpUrl = `http://${HOST}:${port}/mcp`;
    });

    after(() => cleanupServers([server]));

    test("URL-encoded project path is not double-encoded", async () => {
      // Pass a URL-encoded namespaced path (e.g. "my-group%2Fmy-project")
      // The mock echoes back req.params.id (which Express decodes from the URL).
      // Correct: decode → "my-group/my-project" → encode → "my-group%2Fmy-project" → Express decodes to "my-group/my-project"
      // Double-encoded: encode "my-group%2Fmy-project" → "my-group%252Fmy-project" → Express decodes to "my-group%2Fmy-project"
      const result = await callTool(mcpUrl, "search_project_code", {
        project_id: "my-group%2Fmy-project",
        search: "searchResult",
      });
      assert.ok(Array.isArray(result), "Response should be an array");
      assert.ok(result.length > 0, "Response should have at least one result");
      assert.strictEqual(
        result[0].project_id,
        "my-group/my-project",
        "project_id should be decoded (not double-encoded as 'my-group%2Fmy-project')"
      );
    });

    test("plain numeric project_id still works", async () => {
      const result = await callTool(mcpUrl, "search_project_code", {
        project_id: "123",
        search: "searchResult",
      });
      assert.strictEqual(result[0].project_id, "123");
    });
  });

  // ---- 4. search_group_code returns blob results for group ----

  describe("search_group_code returns blob results for group", () => {
    let server: ServerInstance;
    let mcpUrl: string;

    before(async () => {
      const port = await nextMcpPort();
      server = await launchMcpServer(mockGitLabUrl, port, {
        GITLAB_TOOLSETS: "search",
      });
      mcpUrl = `http://${HOST}:${port}/mcp`;
    });

    after(() => cleanupServers([server]));

    test("returns array of results", async () => {
      const result = await callTool(mcpUrl, "search_group_code", {
        group_id: "456",
        search: "searchResult",
      });
      assert.ok(Array.isArray(result), "Response should be an array");
      assert.ok(result.length > 0, "Response should have at least one result");
    });

    test("result has expected blob fields", async () => {
      const result = await callTool(mcpUrl, "search_group_code", {
        group_id: "456",
        search: "searchResult",
      });
      const first = result[0];
      assert.ok("filename" in first, "Result should have filename field");
      assert.ok("path" in first, "Result should have path field");
    });
  });

  // ---- 4b. search_group_code handles URL-encoded namespaced paths ----

  describe("search_group_code handles URL-encoded namespaced paths", () => {
    let server: ServerInstance;
    let mcpUrl: string;

    before(async () => {
      const port = await nextMcpPort();
      server = await launchMcpServer(mockGitLabUrl, port, {
        GITLAB_TOOLSETS: "search",
      });
      mcpUrl = `http://${HOST}:${port}/mcp`;
    });

    after(() => cleanupServers([server]));

    test("URL-encoded group path is not double-encoded", async () => {
      // The mock echoes back req.params.id in the ref field.
      // Correct: decode → "my-org/my-group" → encode → "my-org%2Fmy-group" → Express decodes to "my-org/my-group"
      // Double-encoded: encode "my-org%2Fmy-group" → "my-org%252Fmy-group" → Express decodes to "my-org%2Fmy-group"
      const result = await callTool(mcpUrl, "search_group_code", {
        group_id: "my-org%2Fmy-group",
        search: "searchResult",
      });
      assert.ok(Array.isArray(result), "Response should be an array");
      assert.ok(result.length > 0, "Response should have at least one result");
      assert.strictEqual(
        result[0].ref,
        "my-org/my-group",
        "ref should contain decoded group path (not double-encoded as 'my-org%2Fmy-group')"
      );
    });
  });

  // ---- 5. search tools are not available without search toolset enabled ----

  describe("search tools are not available without search toolset enabled", () => {
    let server: ServerInstance;
    let tools: string[];

    before(async () => {
      const port = await nextMcpPort();
      // Launch without GITLAB_TOOLSETS=search (use a different toolset instead)
      server = await launchMcpServer(mockGitLabUrl, port, {
        GITLAB_TOOLSETS: "issues",
      });
      tools = await getToolNames(`http://${HOST}:${port}/mcp`);
    });

    after(() => cleanupServers([server]));

    test("search_code is NOT in tool list", () => {
      assert.ok(!tools.includes("search_code"), "search_code should NOT be present without search toolset");
    });

    test("search_project_code is NOT in tool list", () => {
      assert.ok(!tools.includes("search_project_code"), "search_project_code should NOT be present without search toolset");
    });

    test("search_group_code is NOT in tool list", () => {
      assert.ok(!tools.includes("search_group_code"), "search_group_code should NOT be present without search toolset");
    });
  });
});
