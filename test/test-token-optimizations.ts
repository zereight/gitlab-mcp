/**
 * Token Optimization Test Suite
 *
 * Tests for Proposals C (Schema Slimming), F (3-Tier Policy), and H (Dynamic Discovery).
 */

import { describe, test, after, before } from "node:test";
import assert from "node:assert";
import { z } from "zod";
import { toJSONSchema } from "../utils/schema.js";
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

const MOCK_TOKEN = "glpat-token-opt-test";

// Port bases (offset to avoid collision with other suites)
const MOCK_PORT_BASE = 9400;
const MCP_PORT_BASE = 3400;
let portCounter = 0;

async function nextMcpPort(): Promise<number> {
  return findAvailablePort(MCP_PORT_BASE + portCounter++ * 10);
}

// Shared helpers (hoisted to outer scope to satisfy lint)
async function launchMcp(
  mockGitLabUrl: string,
  extraEnv: Record<string, string> = {}
): Promise<ServerInstance> {
  const port = await nextMcpPort();
  return launchServer({
    mode: TransportMode.STREAMABLE_HTTP,
    port,
    timeout: 10000,
    env: {
      STREAMABLE_HTTP: "true",
      REMOTE_AUTHORIZATION: "true",
      GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
      ...extraEnv,
    },
  });
}

async function getClient(port: number): Promise<CustomHeaderClient> {
  const client = new CustomHeaderClient({
    authorization: `Bearer ${MOCK_TOKEN}`,
  });
  await client.connect(`http://${HOST}:${port}/mcp`);
  return client;
}

async function rawMcpRequest(
  url: string,
  body: object,
  headers: Record<string, string> = {}
): Promise<{ data: any; sessionId: string | null }> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const sessionId = response.headers.get("mcp-session-id");
  // Notifications return 202/204 with no body
  if (response.status === 202 || response.status === 204) {
    return { data: null, sessionId };
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    const text = await response.text();
    const lines = text.split("\n");
    let lastData = "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        lastData = line.slice(6);
      }
    }
    return { data: lastData ? JSON.parse(lastData) : null, sessionId };
  }
  return { data: await response.json(), sessionId };
}

// ============================================================================
// Suite 1: Schema Slimming (Proposal C)
// ============================================================================

describe("Schema Slimming (Proposal C)", () => {
  test("strips $schema key from root", () => {
    const schema = z.object({ name: z.string() });
    const result = toJSONSchema(schema);
    assert.strictEqual(result.$schema, undefined, "$schema should be removed");
  });

  test("strips additionalProperties from root object", () => {
    const schema = z.object({ name: z.string() });
    const result = toJSONSchema(schema);
    assert.strictEqual(
      result.additionalProperties,
      undefined,
      "additionalProperties should be removed"
    );
  });

  test("strips additionalProperties from nested objects", () => {
    const schema = z.object({
      outer: z.object({
        inner: z.string(),
      }),
    });
    const result = toJSONSchema(schema);
    // Check nested object
    const outerProp = result.properties?.outer;
    assert.ok(outerProp, "outer property should exist");
    assert.strictEqual(
      outerProp.additionalProperties,
      undefined,
      "nested additionalProperties should be removed"
    );
  });

  test("preserves type, properties, and required fields", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
    });
    const result = toJSONSchema(schema);
    assert.strictEqual(result.type, "object");
    assert.ok(result.properties?.name, "name property should exist");
    assert.ok(result.properties?.age, "age property should exist");
    // name is required, age is optional
    assert.ok(
      Array.isArray(result.required) && result.required.includes("name"),
      "name should be required"
    );
  });

  test("handles nullable fields correctly (not marked as required)", () => {
    const schema = z.object({
      required_field: z.string(),
      nullable_field: z.string().nullable().optional(),
    });
    const result = toJSONSchema(schema);
    const required = result.required || [];
    assert.ok(required.includes("required_field"), "required_field should be required");
    assert.ok(
      !required.includes("nullable_field"),
      "nullable_field should NOT be required"
    );
  });
});

// ============================================================================
// Suite 2: Tool Policy (Proposal F) - Integration Tests
// ============================================================================

describe("Tool Policy (Proposal F)", { concurrency: 1 }, () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;

  before(async () => {
    const mockPort = await findMockServerPort(MOCK_PORT_BASE);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    if (mockGitLab) await mockGitLab.stop();
  });

  // ---- Hidden policy ----

  describe("GITLAB_TOOL_POLICY_HIDDEN", () => {
    let server: ServerInstance;
    let client: CustomHeaderClient;

    before(async () => {
      server = await launchMcp(mockGitLabUrl, {
        GITLAB_TOOL_POLICY_HIDDEN: "list_issues,get_issue",
      });
      client = await getClient(server.port ?? 0);
    });

    after(async () => {
      await client.disconnect();
      cleanupServers([server]);
    });

    test("hidden tools are not in tool list", async () => {
      const result = await client.listTools();
      const names = new Set(result.tools.map((t: any) => t.name));
      assert.ok(!names.has("list_issues"), "list_issues should be hidden");
      assert.ok(!names.has("get_issue"), "get_issue should be hidden");
    });

    test("non-hidden tools are still present", async () => {
      const result = await client.listTools();
      const names = new Set(result.tools.map((t: any) => t.name));
      assert.ok(names.has("create_issue"), "create_issue should be present");
    });
  });

  // ---- Approve policy ----

  describe("GITLAB_TOOL_POLICY_APPROVE", () => {
    let server: ServerInstance;
    let client: CustomHeaderClient;

    before(async () => {
      server = await launchMcp(mockGitLabUrl, {
        GITLAB_TOOLSETS: "issues",
        GITLAB_TOOL_POLICY_APPROVE: "create_issue",
      });
      client = await getClient(server.port ?? 0);
    });

    after(async () => {
      await client.disconnect();
      cleanupServers([server]);
    });

    test("approve tool is visible in tool list", async () => {
      const result = await client.listTools();
      const names = new Set(result.tools.map((t: any) => t.name));
      assert.ok(names.has("create_issue"), "create_issue should be in tool list");
    });

    test("approve tool returns confirmation prompt without _confirmed", async () => {
      const result = await client.callTool("create_issue", {
        project_id: "test/project",
        title: "test",
      });
      const text = (result.content as any)[0]?.text || "";
      assert.ok(
        text.includes("requires confirmation"),
        `Expected confirmation prompt, got: ${text}`
      );
    });
  });

  // ---- Raw HTTP annotations verification (bypasses SDK stripping) ----

  describe("Raw HTTP annotations", () => {
    let server: ServerInstance;
    let mcpUrl: string;
    let tools: any[] = [];

    before(async () => {
      server = await launchMcp(mockGitLabUrl, {
        GITLAB_TOOLSETS: "issues",
        GITLAB_TOOL_POLICY_APPROVE: "create_issue",
      });
      mcpUrl = `http://${HOST}:${server.port ?? 0}/mcp`;

      const authHeader = { authorization: `Bearer ${MOCK_TOKEN}` };

      // Initialize session
      const initRes = await rawMcpRequest(
        mcpUrl,
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "raw-test", version: "1.0.0" },
          },
        },
        authHeader
      );
      const sid = initRes.sessionId ?? "";

      // Send initialized notification
      await rawMcpRequest(
        mcpUrl,
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { "mcp-session-id": sid, ...authHeader }
      );

      // Get raw tools/list
      const listRes = await rawMcpRequest(
        mcpUrl,
        { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
        { "mcp-session-id": sid, ...authHeader }
      );
      tools = listRes.data.result?.tools ?? [];
    });

    after(async () => {
      cleanupServers([server]);
    });

    test("confirmationHint=true on approve-policy tools", () => {
      const createIssue = tools.find((t: any) => t.name === "create_issue");
      assert.ok(createIssue, "create_issue should be in raw response");
      assert.strictEqual(
        createIssue.annotations?.confirmationHint,
        true,
        "create_issue should have confirmationHint=true"
      );
    });

    test("readOnlyHint=true on read-only tools", () => {
      const listIssues = tools.find((t: any) => t.name === "list_issues");
      assert.ok(listIssues, "list_issues should be in raw response");
      assert.strictEqual(
        listIssues.annotations?.readOnlyHint,
        true,
        "list_issues should have readOnlyHint=true"
      );
    });

    test("readOnlyHint absent on write tools", () => {
      const createIssue = tools.find((t: any) => t.name === "create_issue");
      assert.ok(createIssue, "create_issue should exist");
      assert.strictEqual(
        createIssue.annotations?.readOnlyHint,
        undefined,
        "create_issue should NOT have readOnlyHint"
      );
    });

    test("destructiveHint=true on destructive tools", () => {
      const deleteIssue = tools.find((t: any) => t.name === "delete_issue");
      assert.ok(deleteIssue, "delete_issue should be in issues toolset");
      assert.strictEqual(
        deleteIssue.annotations?.destructiveHint,
        true,
        "delete_issue should have destructiveHint=true"
      );
    });

    test("destructiveHint absent on non-destructive tools", () => {
      const listIssues = tools.find((t: any) => t.name === "list_issues");
      assert.ok(listIssues, "list_issues should exist");
      assert.strictEqual(
        listIssues.annotations?.destructiveHint,
        undefined,
        "list_issues should NOT have destructiveHint"
      );
    });

    test("openWorldHint=true on all tools", () => {
      assert.ok(tools.length > 0, "Should have tools");
      for (const tool of tools) {
        assert.strictEqual(
          tool.annotations?.openWorldHint,
          true,
          `${tool.name} should have openWorldHint=true`
        );
      }
    });

    test("annotation combinations: destructive tool has destructive+openWorld but no readOnly", () => {
      const deleteIssue = tools.find((t: any) => t.name === "delete_issue");
      assert.ok(deleteIssue, "delete_issue should exist");
      const ann = deleteIssue.annotations;
      assert.strictEqual(ann?.destructiveHint, true, "destructiveHint should be true");
      assert.strictEqual(ann?.openWorldHint, true, "openWorldHint should be true");
      assert.strictEqual(ann?.readOnlyHint, undefined, "readOnlyHint should be absent");
    });
  });
});

// ============================================================================
// Suite 2b: Policy Edge Cases
// ============================================================================

describe("Policy Edge Cases", { concurrency: 1 }, () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;

  before(async () => {
    const mockPort = await findMockServerPort(MOCK_PORT_BASE + 50);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    if (mockGitLab) await mockGitLab.stop();
  });

  // Edge case 1: hidden beats approve when same tool in both
  test("hidden takes precedence over approve for same tool", async () => {
    const server = await launchMcp(mockGitLabUrl, {
      GITLAB_TOOLSETS: "issues",
      GITLAB_TOOL_POLICY_HIDDEN: "create_issue",
      GITLAB_TOOL_POLICY_APPROVE: "create_issue",
    });
    try {
      const client = await getClient(server.port ?? 0);
      const result = await client.listTools();
      const names = new Set(result.tools.map((t: any) => t.name));
      assert.ok(!names.has("create_issue"), "create_issue should be hidden even if also in approve");
      await client.disconnect();
    } finally {
      cleanupServers([server]);
    }
  });

  // Edge case 2: multiple approve tools (with whitespace) get confirmationHint via raw HTTP
  test("multiple approve tools with whitespace get confirmationHint", async () => {
    const server = await launchMcp(mockGitLabUrl, {
      GITLAB_TOOLSETS: "issues",
      GITLAB_TOOL_POLICY_APPROVE: " create_issue , update_issue ",
    });
    try {
      const mcpUrl = `http://${HOST}:${server.port ?? 0}/mcp`;
      const authHeader = { authorization: `Bearer ${MOCK_TOKEN}` };

      const initRes = await rawMcpRequest(
        mcpUrl,
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "raw-test", version: "1.0.0" },
          },
        },
        authHeader
      );
      const sid = initRes.sessionId ?? "";

      await rawMcpRequest(
        mcpUrl,
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { "mcp-session-id": sid, ...authHeader }
      );

      const listRes = await rawMcpRequest(
        mcpUrl,
        { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
        { "mcp-session-id": sid, ...authHeader }
      );
      const tools: any[] = listRes.data.result?.tools ?? [];

      const createIssue = tools.find((t: any) => t.name === "create_issue");
      const updateIssue = tools.find((t: any) => t.name === "update_issue");
      assert.ok(createIssue, "create_issue should exist");
      assert.ok(updateIssue, "update_issue should exist");
      assert.strictEqual(createIssue.annotations?.confirmationHint, true);
      assert.strictEqual(updateIssue.annotations?.confirmationHint, true);

      // non-approve tool should NOT have confirmationHint
      const listIssues = tools.find((t: any) => t.name === "list_issues");
      assert.ok(listIssues, "list_issues should exist");
      assert.strictEqual(listIssues.annotations?.confirmationHint, undefined);
    } finally {
      cleanupServers([server]);
    }
  });

  // Edge case 3: empty env vars - no crash, normal behavior
  test("empty policy env vars cause no side effects", async () => {
    const server = await launchMcp(mockGitLabUrl, {
      GITLAB_TOOLSETS: "issues",
      GITLAB_TOOL_POLICY_HIDDEN: "",
      GITLAB_TOOL_POLICY_APPROVE: "",
    });
    try {
      const client = await getClient(server.port ?? 0);
      const result = await client.listTools();
      const names = new Set(result.tools.map((t: any) => t.name));
      // All issues tools should be present
      assert.ok(names.has("create_issue"), "create_issue should be present");
      assert.ok(names.has("list_issues"), "list_issues should be present");
      assert.ok(names.has("delete_issue"), "delete_issue should be present");
      await client.disconnect();
    } finally {
      cleanupServers([server]);
    }
  });

  // Edge case 4: non-existent tool name in hidden - silently ignored
  test("non-existent tool name in hidden policy is silently ignored", async () => {
    const server = await launchMcp(mockGitLabUrl, {
      GITLAB_TOOLSETS: "issues",
      GITLAB_TOOL_POLICY_HIDDEN: "nonexistent_tool_xyz_123",
    });
    try {
      const client = await getClient(server.port ?? 0);
      const result = await client.listTools();
      const names = new Set(result.tools.map((t: any) => t.name));
      // Real tools should be unaffected
      assert.ok(names.has("create_issue"), "create_issue should be present");
      assert.ok(names.has("list_issues"), "list_issues should be present");
      await client.disconnect();
    } finally {
      cleanupServers([server]);
    }
  });

  // Edge case 5: hide all tools in toolset - only discover_tools survives
  test("hiding all toolset tools leaves only discover_tools", async () => {
    const allIssueTools = [
      "create_issue", "list_issues", "my_issues", "get_issue",
      "update_issue", "delete_issue", "create_issue_note", "update_issue_note",
      "list_issue_links", "list_issue_discussions", "get_issue_link",
      "create_issue_link", "delete_issue_link", "create_note",
    ].join(",");

    const server = await launchMcp(mockGitLabUrl, {
      GITLAB_TOOLSETS: "issues",
      GITLAB_TOOL_POLICY_HIDDEN: allIssueTools,
    });
    try {
      const client = await getClient(server.port ?? 0);
      const result = await client.listTools();
      const names = result.tools.map((t: any) => t.name);
      // Only discover_tools should remain (always injected)
      assert.strictEqual(names.length, 1, `Expected only discover_tools, got: ${names.join(", ")}`);
      assert.strictEqual(names[0], "discover_tools");
      await client.disconnect();
    } finally {
      cleanupServers([server]);
    }
  });

  // Edge case 6: approve tool with _confirmed=true bypasses confirmation prompt
  test("approve tool executes when _confirmed is true", async () => {
    const server = await launchMcp(mockGitLabUrl, {
      GITLAB_TOOLSETS: "issues",
      GITLAB_TOOL_POLICY_APPROVE: "create_issue",
    });
    try {
      const client = await getClient(server.port ?? 0);
      // Without _confirmed  -> confirmation prompt
      const blocked = await client.callTool("create_issue", {
        project_id: "test/project",
        title: "test issue",
      });
      const blockedText = (blocked.content as any)[0]?.text || "";
      assert.ok(blockedText.includes("requires confirmation"), "without _confirmed should get prompt");

      // With _confirmed -> bypasses confirmation, may hit mock 404 (expected)
      let passedThrough = false;
      try {
        const result = await client.callTool("create_issue", {
          project_id: "test/project",
          title: "test issue",
          _confirmed: true,
        });
        const text = (result.content as any)[0]?.text || "";
        // If we get here, the tool executed (no confirmation prompt)
        passedThrough = !text.includes("requires confirmation");
      } catch {
        // Mock 404 / API error = tool DID execute past confirmation gate
        passedThrough = true;
      }
      assert.ok(passedThrough, "_confirmed=true should bypass confirmation gate");
      await client.disconnect();
    } finally {
      cleanupServers([server]);
    }
  });

  // Edge case 7: DENIED_TOOLS_REGEX + hidden applied together
  test("regex denial and hidden policy combine correctly", async () => {
    const server = await launchMcp(mockGitLabUrl, {
      GITLAB_TOOLSETS: "issues",
      GITLAB_DENIED_TOOLS_REGEX: "^delete_",
      GITLAB_TOOL_POLICY_HIDDEN: "create_issue",
    });
    try {
      const client = await getClient(server.port ?? 0);
      const result = await client.listTools();
      const names = new Set(result.tools.map((t: any) => t.name));
      // delete_issue blocked by regex
      assert.ok(!names.has("delete_issue"), "delete_issue should be denied by regex");
      // delete_issue_link also blocked by regex
      assert.ok(!names.has("delete_issue_link"), "delete_issue_link should be denied by regex");
      // create_issue blocked by hidden
      assert.ok(!names.has("create_issue"), "create_issue should be hidden");
      // Other tools survive
      assert.ok(names.has("list_issues"), "list_issues should be present");
      assert.ok(names.has("get_issue"), "get_issue should be present");
      await client.disconnect();
    } finally {
      cleanupServers([server]);
    }
  });

  // Edge case 8: approve on read-only tool - both readOnlyHint + confirmationHint
  // Edge case 9: approve on destructive tool - both destructiveHint + confirmationHint
  describe("approve annotation overlap via raw HTTP", () => {
    let server: ServerInstance;
    let tools: any[] = [];

    before(async () => {
      server = await launchMcp(mockGitLabUrl, {
        GITLAB_TOOLSETS: "issues",
        GITLAB_TOOL_POLICY_APPROVE: "list_issues,delete_issue",
      });
      const mcpUrl = `http://${HOST}:${server.port ?? 0}/mcp`;
      const authHeader = { authorization: `Bearer ${MOCK_TOKEN}` };

      const initRes = await rawMcpRequest(
        mcpUrl,
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "raw-test", version: "1.0.0" },
          },
        },
        authHeader
      );
      const sid = initRes.sessionId ?? "";

      await rawMcpRequest(
        mcpUrl,
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { "mcp-session-id": sid, ...authHeader }
      );

      const listRes = await rawMcpRequest(
        mcpUrl,
        { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
        { "mcp-session-id": sid, ...authHeader }
      );
      tools = listRes.data.result?.tools ?? [];
    });

    after(async () => {
      cleanupServers([server]);
    });

    test("read-only + approve: both readOnlyHint and confirmationHint present", () => {
      const listIssues = tools.find((t: any) => t.name === "list_issues");
      assert.ok(listIssues, "list_issues should exist");
      const ann = listIssues.annotations;
      assert.strictEqual(ann?.readOnlyHint, true, "readOnlyHint should be true");
      assert.strictEqual(ann?.confirmationHint, true, "confirmationHint should be true");
      assert.strictEqual(ann?.destructiveHint, undefined, "destructiveHint should be absent");
    });

    test("destructive + approve: both destructiveHint and confirmationHint present", () => {
      const deleteIssue = tools.find((t: any) => t.name === "delete_issue");
      assert.ok(deleteIssue, "delete_issue should exist");
      const ann = deleteIssue.annotations;
      assert.strictEqual(ann?.destructiveHint, true, "destructiveHint should be true");
      assert.strictEqual(ann?.confirmationHint, true, "confirmationHint should be true");
      assert.strictEqual(ann?.readOnlyHint, undefined, "readOnlyHint should be absent");
    });
  });

  // Edge case 10: hidden tools are invisible but still callable (hidden = ListTools only)
  test("hidden tool is absent from listing but still callable", async () => {
    const server = await launchMcp(mockGitLabUrl, {
      GITLAB_TOOLSETS: "issues",
      GITLAB_TOOL_POLICY_HIDDEN: "list_issues",
    });
    try {
      const client = await getClient(server.port ?? 0);
      // Not visible in tool list
      const result = await client.listTools();
      const names = new Set(result.tools.map((t: any) => t.name));
      assert.ok(!names.has("list_issues"), "list_issues should be absent from listing");

      // But still callable (hidden only affects ListTools, not CallTool)
      const callResult = await client.callTool("list_issues", {
        project_id: "test/project",
      });
      const text = (callResult.content as any)[0]?.text || "";
      // Should get real response (even if error from mock), NOT "unknown tool"
      assert.ok(!text.includes("Unknown tool"), "hidden tool should still be callable");
      await client.disconnect();
    } finally {
      cleanupServers([server]);
    }
  });
});

// ============================================================================
// Suite 3: Dynamic Discovery (Proposal H) - Integration Tests
// ============================================================================

describe("Dynamic Discovery (Proposal H)", { concurrency: 1 }, () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;

  before(async () => {
    const mockPort = await findMockServerPort(MOCK_PORT_BASE + 100);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });
    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    if (mockGitLab) await mockGitLab.stop();
  });

  // ---- discover_tools always present ----

  describe("discover_tools availability", () => {
    let server: ServerInstance;
    let client: CustomHeaderClient;

    before(async () => {
      server = await launchMcp(mockGitLabUrl, {
        GITLAB_TOOLSETS: "issues",
      });
      client = await getClient(server.port ?? 0);
    });

    after(async () => {
      await client.disconnect();
      cleanupServers([server]);
    });

    test("discover_tools is in tool list even with limited toolsets", async () => {
      const result = await client.listTools();
      const names = new Set(result.tools.map((t: any) => t.name));
      assert.ok(
        names.has("discover_tools"),
        "discover_tools should always be present"
      );
    });

    test("discover_tools without category returns category list", async () => {
      const result = await client.callTool("discover_tools", {});
      const text = (result.content as any)[0]?.text || "";
      const data = JSON.parse(text);
      assert.ok(Array.isArray(data.categories), "Should return categories array");
      assert.ok(
        data.categories.length >= 14,
        `Should have at least 14 categories, got ${data.categories.length}`
      );
      // Verify each category has expected fields
      const first = data.categories[0];
      assert.ok("id" in first, "Category should have id");
      assert.ok("toolCount" in first, "Category should have toolCount");
      assert.ok("active" in first, "Category should have active status");
    });

    test("discover_tools with invalid category returns error", async () => {
      const result = await client.callTool("discover_tools", {
        category: "nonexistent",
      });
      const text = (result.content as any)[0]?.text || "";
      assert.ok(
        text.includes("Unknown category"),
        `Expected error message, got: ${text}`
      );
    });
  });

  // ---- Dynamic toolset activation ----

  describe("toolset activation", () => {
    let server: ServerInstance;
    let client: CustomHeaderClient;

    before(async () => {
      server = await launchMcp(mockGitLabUrl, {
        GITLAB_TOOLSETS: "issues",
      });
      client = await getClient(server.port ?? 0);
    });

    after(async () => {
      await client.disconnect();
      cleanupServers([server]);
    });

    test("pipelines tools not present before activation", async () => {
      const result = await client.listTools();
      const names = new Set(result.tools.map((t: any) => t.name));
      assert.ok(
        !names.has("list_pipelines"),
        "list_pipelines should NOT be present before activation"
      );
    });

    test("activating pipelines adds the tools", async () => {
      const activateResult = await client.callTool("discover_tools", {
        category: "pipelines",
      });
      const text = (activateResult.content as any)[0]?.text || "";
      const data = JSON.parse(text);
      assert.strictEqual(data.activated, "pipelines");
      assert.ok(
        data.addedTools.includes("list_pipelines"),
        "list_pipelines should be in addedTools"
      );

      // Verify tools now appear in ListTools
      const listResult = await client.listTools();
      const names = new Set(listResult.tools.map((t: any) => t.name));
      assert.ok(
        names.has("list_pipelines"),
        "list_pipelines should be present after activation"
      );
      assert.ok(
        names.has("get_pipeline"),
        "get_pipeline should be present after activation"
      );
    });

    test("re-activating already active toolset returns already-active message", async () => {
      const result = await client.callTool("discover_tools", {
        category: "pipelines",
      });
      const text = (result.content as any)[0]?.text || "";
      assert.ok(
        text.includes("already active"),
        `Expected already-active message, got: ${text}`
      );
    });
  });

  // ---- Hidden policy respected by discover_tools ----

  describe("discover_tools respects hidden policy", () => {
    let server: ServerInstance;
    let client: CustomHeaderClient;

    before(async () => {
      server = await launchMcp(mockGitLabUrl, {
        GITLAB_TOOLSETS: "issues",
        GITLAB_TOOL_POLICY_HIDDEN: "delete_issue,delete_issue_link",
      });
      client = await getClient(server.port ?? 0);
    });

    after(async () => {
      await client.disconnect();
      cleanupServers([server]);
    });

    test("hidden tools not present after discover_tools activation", async () => {
      // Re-activate issues toolset (partially active from GITLAB_TOOLSETS)
      // Force activation of a non-default toolset that also has hidden tools
      const listBefore = await client.listTools();
      const namesBefore = new Set(listBefore.tools.map((t: any) => t.name));
      assert.ok(!namesBefore.has("delete_issue"), "delete_issue should be hidden initially");
      assert.ok(!namesBefore.has("delete_issue_link"), "delete_issue_link should be hidden initially");

      // Activate pipelines (different toolset) to ensure discover_tools works
      await client.callTool("discover_tools", { category: "pipelines" });

      // Re-list tools - hidden tools from issues should still be absent
      const listAfter = await client.listTools();
      const namesAfter = new Set(listAfter.tools.map((t: any) => t.name));
      assert.ok(!namesAfter.has("delete_issue"), "delete_issue should remain hidden after discover_tools");
      assert.ok(!namesAfter.has("delete_issue_link"), "delete_issue_link should remain hidden after discover_tools");
      // Non-hidden issues tools should still be present
      assert.ok(namesAfter.has("list_issues"), "list_issues should still be present");
    });

    test("discover_tools with no new tools returns filtered message", async () => {
      // issues toolset already active from GITLAB_TOOLSETS, so re-activating should say already active
      const result = await client.callTool("discover_tools", { category: "issues" });
      const text = (result.content as any)[0]?.text || "";
      assert.ok(
        text.includes("already active") || text.includes("no additional tools"),
        `Expected already-active or no-additional message, got: ${text}`
      );
    });
  });
});
