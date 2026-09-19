/**
 * Permission Mode Test Suite
 *
 * Tests GITLAB_PERMISSION_MODE (readonly / modify / full), its interaction with
 * the legacy GITLAB_READ_ONLY_MODE flag, and enforcement at list_tools,
 * call_tool, and execute_graphql levels.
 */

import { describe, test, after, before } from "node:test";
import assert from "node:assert";
import { allTools, deleteTools, destructiveTools } from "../tools/registry.js";
import {
  launchServer,
  findAvailablePort,
  cleanupServers,
  ServerInstance,
  TransportMode,
  HOST,
} from "./utils/server-launcher.js";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";
import { CustomHeaderClient } from "./clients/custom-header-client.js";

const MOCK_TOKEN = "glpat-permission-mode-test";

const MOCK_PORT_BASE = 9700;
const MCP_PORT_BASE = 3700;

let mockGitLab: MockGitLabServer;
let mockGitLabUrl: string;
let portCounter = 0;

async function nextMcpPort(): Promise<number> {
  return findAvailablePort(MCP_PORT_BASE + portCounter++ * 10);
}

async function launchMcpServer(extraEnv: Record<string, string> = {}): Promise<ServerInstance> {
  const port = await nextMcpPort();
  return launchServer({
    mode: TransportMode.STREAMABLE_HTTP,
    port,
    timeout: 10000,
    env: {
      STREAMABLE_HTTP: "true",
      REMOTE_AUTHORIZATION: "true",
      GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
      GITLAB_TOOLSETS: "all",
      ...extraEnv,
    },
  });
}

function mcpUrl(server: ServerInstance): string {
  return `http://${HOST}:${server.port}/mcp`;
}

async function connectClient(server: ServerInstance): Promise<CustomHeaderClient> {
  const client = new CustomHeaderClient({
    authorization: `Bearer ${MOCK_TOKEN}`,
  });
  await client.connect(mcpUrl(server));
  return client;
}

async function getToolNames(server: ServerInstance): Promise<string[]> {
  const client = await connectClient(server);
  const result = await client.listTools();
  await client.disconnect();
  return result.tools.map((t: { name: string }) => t.name);
}

const DELETE_SAMPLE_TOOLS = [
  "delete_issue",
  "delete_branch",
  "delete_label",
  "delete_wiki_page",
  "delete_milestone",
  "delete_group_milestone",
  "delete_project_variable",
  "delete_webhook",
];

// Destructive teardown tools whose names do not start with `delete_`. All five are listed
// here (list-hiding) and exercised with explicit `callTool` literals below (call-rejection),
// so the tool-coverage detector sees the call path too.
const DESTRUCTIVE_SAMPLE_TOOLS = [
  "cancel_pipeline",
  "cancel_pipeline_job",
  "stop_environment",
  "stop_stale_environments",
  "unprotect_branch",
];

const MODIFY_SAMPLE_TOOLS = [
  "create_issue",
  "update_issue",
  "create_merge_request",
  "create_branch",
  "push_files",
  "merge_merge_request",
];

const READ_SAMPLE_TOOLS = ["list_issues", "get_project", "list_merge_requests"];

describe("Modify-mode deny list invariants", () => {
  test("deleteTools is a subset of destructiveTools", () => {
    for (const name of deleteTools) {
      assert.ok(
        destructiveTools.has(name),
        `"${name}" is blocked in modify mode but missing from destructiveTools`
      );
    }
  });

  test("every blocked tool exists in the registry", () => {
    const names = new Set(allTools.map(tool => tool.name));
    for (const name of deleteTools) {
      assert.ok(names.has(name), `"${name}" is in deleteTools but not in allTools`);
    }
  });

  test("every destructive sample tool is in the modify-mode deny list", () => {
    for (const name of DESTRUCTIVE_SAMPLE_TOOLS) {
      assert.ok(deleteTools.has(name), `"${name}" should be blocked in modify mode`);
    }
  });
});

describe("Permission Mode", { concurrency: 1 }, () => {
  before(async () => {
    const mockPort = await findMockServerPort();
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

  describe("full mode (default)", () => {
    let server: ServerInstance;
    const servers: ServerInstance[] = [];

    before(async () => {
      server = await launchMcpServer();
      servers.push(server);
    });

    after(() => cleanupServers(servers));

    test("exposes read, modify, and delete tools", async () => {
      const names = await getToolNames(server);
      for (const name of [
        ...READ_SAMPLE_TOOLS,
        ...MODIFY_SAMPLE_TOOLS,
        ...DELETE_SAMPLE_TOOLS,
        ...DESTRUCTIVE_SAMPLE_TOOLS,
      ]) {
        assert.ok(names.includes(name), `full mode: expected "${name}" to be present`);
      }
    });
  });

  describe("modify mode", () => {
    let server: ServerInstance;
    const servers: ServerInstance[] = [];

    before(async () => {
      server = await launchMcpServer({ GITLAB_PERMISSION_MODE: "modify" });
      servers.push(server);
    });

    after(() => cleanupServers(servers));

    test("hides delete tools but keeps read and modify tools", async () => {
      const names = await getToolNames(server);
      for (const name of DELETE_SAMPLE_TOOLS) {
        assert.ok(!names.includes(name), `modify mode: expected "${name}" to be absent`);
      }
      for (const name of [...READ_SAMPLE_TOOLS, ...MODIFY_SAMPLE_TOOLS]) {
        assert.ok(names.includes(name), `modify mode: expected "${name}" to be present`);
      }
      assert.ok(!names.some(n => n.startsWith("delete_")), "no delete_* tool should be listed");
    });

    test("hides destructive stop/cancel/unprotect tools", async () => {
      const names = await getToolNames(server);
      for (const name of DESTRUCTIVE_SAMPLE_TOOLS) {
        assert.ok(!names.includes(name), `modify mode: expected "${name}" to be absent`);
      }
    });

    test("rejects destructive stop/cancel/unprotect tool calls", async () => {
      const client = await connectClient(server);
      try {
        await assert.rejects(
          () => client.callTool("cancel_pipeline", { project_id: "1", pipeline_id: 1 }),
          (error: Error) => error.message.includes("not allowed in modify mode"),
          "cancel_pipeline should be rejected in modify mode"
        );
        await assert.rejects(
          () => client.callTool("cancel_pipeline_job", { project_id: "1", job_id: 1 }),
          (error: Error) => error.message.includes("not allowed in modify mode"),
          "cancel_pipeline_job should be rejected in modify mode"
        );
        await assert.rejects(
          () => client.callTool("stop_environment", { project_id: "1", environment_id: 1 }),
          (error: Error) => error.message.includes("not allowed in modify mode"),
          "stop_environment should be rejected in modify mode"
        );
        await assert.rejects(
          () =>
            client.callTool("stop_stale_environments", {
              project_id: "1",
              before: "2026-01-01T00:00:00Z",
            }),
          (error: Error) => error.message.includes("not allowed in modify mode"),
          "stop_stale_environments should be rejected in modify mode"
        );
        await assert.rejects(
          () => client.callTool("unprotect_branch", { project_id: "1", branch: "main" }),
          (error: Error) => error.message.includes("not allowed in modify mode"),
          "unprotect_branch should be rejected in modify mode"
        );
      } finally {
        await client.disconnect();
      }
    });

    test("hides purge_dependency_proxy_cache", async () => {
      const names = await getToolNames(server);
      assert.ok(
        !names.includes("purge_dependency_proxy_cache"),
        "modify mode: purge_dependency_proxy_cache should be absent"
      );
    });

    test("rejects direct delete tool calls", async () => {
      const client = await connectClient(server);
      try {
        await assert.rejects(
          () => client.callTool("delete_issue", { project_id: "1", issue_iid: 1 }),
          (error: Error) => error.message.includes("not allowed in modify mode"),
          "delete_issue should be rejected in modify mode"
        );
        await assert.rejects(
          () => client.callTool("purge_dependency_proxy_cache", { group_id: "my-group" }),
          (error: Error) => error.message.includes("not allowed in modify mode"),
          "purge_dependency_proxy_cache should be rejected in modify mode"
        );
      } finally {
        await client.disconnect();
      }
    });

    test("rejects delete mutations via execute_graphql", async () => {
      const client = await connectClient(server);
      try {
        await assert.rejects(
          () =>
            client.callTool("execute_graphql", {
              query: 'mutation { issueDelete(input: { projectPath: "g/p", iid: "1" }) { errors } }',
            }),
          (error: Error) => error.message.includes("delete mutations in modify mode"),
          "delete mutation should be rejected in modify mode"
        );
      } finally {
        await client.disconnect();
      }
    });

    test("rejects push_files delete actions", async () => {
      const client = await connectClient(server);
      try {
        await assert.rejects(
          () =>
            client.callTool("push_files", {
              project_id: "1",
              branch: "main",
              commit_message: "m",
              files: [{ file_path: "a.txt", action: "delete" }],
            }),
          (error: Error) => error.message.includes("delete or move actions in modify mode"),
          "push_files delete should be rejected in modify mode"
        );
      } finally {
        await client.disconnect();
      }
    });

    test("rejects push_files move actions", async () => {
      const client = await connectClient(server);
      try {
        await assert.rejects(
          () =>
            client.callTool("push_files", {
              project_id: "1",
              branch: "main",
              commit_message: "m",
              files: [{ file_path: "b.txt", action: "move", previous_path: "a.txt" }],
            }),
          (error: Error) => error.message.includes("delete or move actions in modify mode"),
          "push_files move should be rejected in modify mode"
        );
      } finally {
        await client.disconnect();
      }
    });

    test("does not apply the modify-mode guard to non-delete mutations", async () => {
      const client = await connectClient(server);
      try {
        // The mock GitLab server has no GraphQL endpoint, so the call may fail
        // downstream — but it must not fail with the modify-mode guard error.
        await client.callTool("execute_graphql", {
          query: "mutation { issueSetSeverity(input: { severity: HIGH }) { errors } }",
        });
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok(
          !error.message.includes("modify mode"),
          `non-delete mutation should pass the guard, got: ${error.message}`
        );
      } finally {
        await client.disconnect();
      }
    });

    test("does not apply the modify-mode guard when the alias looks destructive", async () => {
      const client = await connectClient(server);
      try {
        // "stop" is only the caller-chosen label here; the field is issueSetSeverity.
        await client.callTool("execute_graphql", {
          query: "mutation { stop: issueSetSeverity(input: { severity: HIGH }) { errors } }",
        });
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok(
          !error.message.includes("modify mode"),
          `an alias must not trigger the guard, got: ${error.message}`
        );
      } finally {
        await client.disconnect();
      }
    });

    test("rejects a destructive mutation hidden behind a harmless alias", async () => {
      const client = await connectClient(server);
      try {
        await assert.rejects(
          () =>
            client.callTool("execute_graphql", {
              query: "mutation { harmless: environmentStop(input: {}) { errors } }",
            }),
          (error: Error) => error.message.includes("delete mutations in modify mode"),
          "a destructive field must be rejected even when aliased"
        );
      } finally {
        await client.disconnect();
      }
    });
  });

  describe("readonly mode via GITLAB_PERMISSION_MODE", () => {
    let server: ServerInstance;
    const servers: ServerInstance[] = [];

    before(async () => {
      server = await launchMcpServer({ GITLAB_PERMISSION_MODE: "readonly" });
      servers.push(server);
    });

    after(() => cleanupServers(servers));

    test("exposes only read-only tools", async () => {
      const names = await getToolNames(server);
      for (const name of READ_SAMPLE_TOOLS) {
        assert.ok(names.includes(name), `readonly mode: expected "${name}" to be present`);
      }
      for (const name of [...MODIFY_SAMPLE_TOOLS, ...DELETE_SAMPLE_TOOLS]) {
        assert.ok(!names.includes(name), `readonly mode: expected "${name}" to be absent`);
      }
    });

    test("rejects write tool calls", async () => {
      const client = await connectClient(server);
      try {
        await assert.rejects(
          () => client.callTool("create_issue", { project_id: "1", title: "t" }),
          (error: Error) => error.message.includes("not allowed in read-only mode"),
          "create_issue should be rejected in readonly mode"
        );
      } finally {
        await client.disconnect();
      }
    });
  });

  describe("legacy GITLAB_READ_ONLY_MODE interaction", () => {
    const servers: ServerInstance[] = [];

    after(() => cleanupServers(servers));

    test("GITLAB_READ_ONLY_MODE=true still behaves as readonly", async () => {
      const server = await launchMcpServer({ GITLAB_READ_ONLY_MODE: "true" });
      servers.push(server);
      const names = await getToolNames(server);
      assert.ok(names.includes("list_issues"), "read tool should be present");
      assert.ok(!names.includes("create_issue"), "write tool should be absent");
      assert.ok(!names.includes("delete_issue"), "delete tool should be absent");
    });

    test("GITLAB_READ_ONLY_MODE=true wins over GITLAB_PERMISSION_MODE=full", async () => {
      const server = await launchMcpServer({
        GITLAB_READ_ONLY_MODE: "true",
        GITLAB_PERMISSION_MODE: "full",
      });
      servers.push(server);
      const names = await getToolNames(server);
      assert.ok(!names.includes("create_issue"), "legacy readonly should take precedence");
      assert.ok(!names.includes("delete_issue"), "legacy readonly should take precedence");
    });

    test("rejects invalid GITLAB_PERMISSION_MODE even when GITLAB_READ_ONLY_MODE=true", async () => {
      await assert.rejects(
        launchMcpServer({
          GITLAB_READ_ONLY_MODE: "true",
          GITLAB_PERMISSION_MODE: "write",
        }),
        (error: Error) => error.message.includes("Server process exited with code 1"),
        "invalid permission mode should fail startup before legacy override applies"
      );
    });
  });
});
