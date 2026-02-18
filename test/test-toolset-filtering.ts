/**
 * Toolset Filtering Test Suite
 *
 * Tests GITLAB_TOOLSETS, GITLAB_TOOLS, and their interaction with
 * legacy flags (USE_GITLAB_WIKI, USE_PIPELINE, USE_MILESTONE),
 * GITLAB_READ_ONLY_MODE, and GITLAB_DENIED_TOOLS_REGEX.
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

const MOCK_TOKEN = "glpat-toolset-test-token";

// Port bases (offset from other test suites to avoid collisions)
const MOCK_PORT_BASE = 9200;
const MCP_PORT_BASE = 3200;

// Known tool counts per toolset (from TOOLSET_DEFINITIONS)
const TOOLSET_TOOL_COUNTS: Record<string, number> = {
  merge_requests: 31,
  issues: 14,
  repositories: 7,
  branches: 4,
  projects: 8,
  labels: 5,
  pipelines: 12,
  milestones: 9,
  wiki: 5,
  releases: 7,
  users: 5,
};

const DEFAULT_TOOLSETS = [
  "merge_requests",
  "issues",
  "repositories",
  "branches",
  "projects",
  "labels",
  "releases",
  "users",
];

const NON_DEFAULT_TOOLSETS = ["pipelines", "milestones", "wiki"];

const DEFAULT_TOOL_COUNT = DEFAULT_TOOLSETS.reduce(
  (sum, id) => sum + TOOLSET_TOOL_COUNTS[id],
  0
);

const ALL_TOOLSET_TOOL_COUNT = Object.values(TOOLSET_TOOL_COUNTS).reduce(
  (sum, c) => sum + c,
  0
);

// Representative tools per toolset for spot-checking
const TOOLSET_SAMPLE_TOOLS: Record<string, string[]> = {
  merge_requests: ["merge_merge_request", "create_merge_request_thread", "list_draft_notes"],
  issues: ["create_issue", "list_issues", "create_note"],
  repositories: ["search_repositories", "get_file_contents", "push_files"],
  branches: ["create_branch", "list_commits"],
  projects: ["get_project", "list_namespaces", "list_group_iterations"],
  labels: ["list_labels", "create_label"],
  pipelines: ["list_pipelines", "create_pipeline", "cancel_pipeline_job"],
  milestones: ["list_milestones", "create_milestone", "get_milestone_burndown_events"],
  wiki: ["list_wiki_pages", "create_wiki_page"],
  releases: ["list_releases", "create_release", "download_release_asset"],
  users: ["get_users", "upload_markdown", "download_attachment"],
};

// --- Helpers ---

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

function assertContainsAll(actual: string[], expected: string[], label: string) {
  for (const name of expected) {
    assert.ok(actual.includes(name), `${label}: expected tool "${name}" to be present`);
  }
}

function assertContainsNone(actual: string[], excluded: string[], label: string) {
  for (const name of excluded) {
    assert.ok(!actual.includes(name), `${label}: expected tool "${name}" to be absent`);
  }
}

// --- Tests ---

let mockGitLab: MockGitLabServer;
let mockGitLabUrl: string;
let portCounter = 0;

async function nextMcpPort(): Promise<number> {
  return findAvailablePort(MCP_PORT_BASE + portCounter++ * 10);
}

describe("Toolset Filtering", () => {
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

  // ---- 1. Default behavior (no GITLAB_TOOLSETS / GITLAB_TOOLS) ----

  describe("defaults (no GITLAB_TOOLSETS)", () => {
    let server: ServerInstance;
    let tools: string[];

    before(async () => {
      const port = await nextMcpPort();
      server = await launchMcpServer(mockGitLabUrl, port);
      tools = await getToolNames(`http://${HOST}:${port}/mcp`);
    });

    after(() => cleanupServers([server]));

    test("returns expected default tool count", () => {
      assert.strictEqual(tools.length, DEFAULT_TOOL_COUNT);
    });

    test("includes tools from every default toolset", () => {
      for (const id of DEFAULT_TOOLSETS) {
        assertContainsAll(tools, TOOLSET_SAMPLE_TOOLS[id], id);
      }
    });

    test("excludes non-default toolsets (pipelines, milestones, wiki)", () => {
      for (const id of NON_DEFAULT_TOOLSETS) {
        assertContainsNone(tools, TOOLSET_SAMPLE_TOOLS[id], id);
      }
    });

    test("excludes execute_graphql (not in any toolset)", () => {
      assertContainsNone(tools, ["execute_graphql"], "unassigned");
    });
  });

  // ---- 2. Single toolset ----

  describe("GITLAB_TOOLSETS=issues", () => {
    let server: ServerInstance;
    let tools: string[];

    before(async () => {
      const port = await nextMcpPort();
      server = await launchMcpServer(mockGitLabUrl, port, {
        GITLAB_TOOLSETS: "issues",
      });
      tools = await getToolNames(`http://${HOST}:${port}/mcp`);
    });

    after(() => cleanupServers([server]));

    test("returns only issue tools", () => {
      assert.strictEqual(tools.length, TOOLSET_TOOL_COUNTS.issues);
    });

    test("includes issue sample tools", () => {
      assertContainsAll(tools, TOOLSET_SAMPLE_TOOLS.issues, "issues");
    });

    test("excludes merge_requests tools", () => {
      assertContainsNone(tools, TOOLSET_SAMPLE_TOOLS.merge_requests, "merge_requests");
    });
  });

  // ---- 3. GITLAB_TOOLSETS=all ----

  describe("GITLAB_TOOLSETS=all", () => {
    let server: ServerInstance;
    let tools: string[];

    before(async () => {
      const port = await nextMcpPort();
      server = await launchMcpServer(mockGitLabUrl, port, {
        GITLAB_TOOLSETS: "all",
      });
      tools = await getToolNames(`http://${HOST}:${port}/mcp`);
    });

    after(() => cleanupServers([server]));

    test("returns all toolset tools", () => {
      assert.strictEqual(tools.length, ALL_TOOLSET_TOOL_COUNT);
    });

    test("includes pipelines, milestones, and wiki", () => {
      for (const id of NON_DEFAULT_TOOLSETS) {
        assertContainsAll(tools, TOOLSET_SAMPLE_TOOLS[id], id);
      }
    });

    test("still excludes execute_graphql", () => {
      assertContainsNone(tools, ["execute_graphql"], "unassigned");
    });
  });

  // ---- 4. GITLAB_TOOLS (individual tools, additive) ----

  describe("GITLAB_TOOLS=list_pipelines,execute_graphql", () => {
    let server: ServerInstance;
    let tools: string[];

    before(async () => {
      const port = await nextMcpPort();
      server = await launchMcpServer(mockGitLabUrl, port, {
        GITLAB_TOOLS: "list_pipelines,execute_graphql",
      });
      tools = await getToolNames(`http://${HOST}:${port}/mcp`);
    });

    after(() => cleanupServers([server]));

    test("returns default tools plus the two individual tools", () => {
      assert.strictEqual(tools.length, DEFAULT_TOOL_COUNT + 2);
    });

    test("includes the individually added tools", () => {
      assertContainsAll(tools, ["list_pipelines", "execute_graphql"], "individual");
    });

    test("does not include other pipeline tools", () => {
      assertContainsNone(
        tools,
        ["create_pipeline", "cancel_pipeline"],
        "other pipelines"
      );
    });
  });

  // ---- 5. Toolset + individual tools combined ----

  describe("GITLAB_TOOLSETS=issues + GITLAB_TOOLS=list_pipelines,get_pipeline", () => {
    let server: ServerInstance;
    let tools: string[];

    before(async () => {
      const port = await nextMcpPort();
      server = await launchMcpServer(mockGitLabUrl, port, {
        GITLAB_TOOLSETS: "issues",
        GITLAB_TOOLS: "list_pipelines,get_pipeline",
      });
      tools = await getToolNames(`http://${HOST}:${port}/mcp`);
    });

    after(() => cleanupServers([server]));

    test("returns issue tools + 2 individual pipeline tools", () => {
      assert.strictEqual(tools.length, TOOLSET_TOOL_COUNTS.issues + 2);
    });

    test("includes issue tools and the two pipeline tools", () => {
      assertContainsAll(tools, TOOLSET_SAMPLE_TOOLS.issues, "issues");
      assertContainsAll(tools, ["list_pipelines", "get_pipeline"], "individual");
    });

    test("excludes other pipeline tools", () => {
      assertContainsNone(tools, ["create_pipeline", "cancel_pipeline"], "other pipelines");
    });
  });

  // ---- 6. Legacy flag USE_PIPELINE as additive override ----

  describe("GITLAB_TOOLSETS=issues + USE_PIPELINE=true", () => {
    let server: ServerInstance;
    let tools: string[];

    before(async () => {
      const port = await nextMcpPort();
      server = await launchMcpServer(mockGitLabUrl, port, {
        GITLAB_TOOLSETS: "issues",
        USE_PIPELINE: "true",
      });
      tools = await getToolNames(`http://${HOST}:${port}/mcp`);
    });

    after(() => cleanupServers([server]));

    test("returns issue tools + all pipeline tools", () => {
      assert.strictEqual(
        tools.length,
        TOOLSET_TOOL_COUNTS.issues + TOOLSET_TOOL_COUNTS.pipelines
      );
    });

    test("includes all pipeline tools via legacy flag", () => {
      assertContainsAll(tools, TOOLSET_SAMPLE_TOOLS.pipelines, "pipelines");
    });
  });

  // ---- 7. Legacy flag USE_GITLAB_WIKI ----

  describe("USE_GITLAB_WIKI=true (no GITLAB_TOOLSETS)", () => {
    let server: ServerInstance;
    let tools: string[];

    before(async () => {
      const port = await nextMcpPort();
      server = await launchMcpServer(mockGitLabUrl, port, {
        USE_GITLAB_WIKI: "true",
      });
      tools = await getToolNames(`http://${HOST}:${port}/mcp`);
    });

    after(() => cleanupServers([server]));

    test("returns default tools + wiki tools", () => {
      assert.strictEqual(
        tools.length,
        DEFAULT_TOOL_COUNT + TOOLSET_TOOL_COUNTS.wiki
      );
    });

    test("includes wiki tools", () => {
      assertContainsAll(tools, TOOLSET_SAMPLE_TOOLS.wiki, "wiki");
    });
  });

  // ---- 8. Read-only mode applied after toolset filter ----

  describe("GITLAB_TOOLSETS=issues + GITLAB_READ_ONLY_MODE=true", () => {
    let server: ServerInstance;
    let tools: string[];

    // Read-only issue tools (from readOnlyTools set in index.ts)
    const readOnlyIssueTools = [
      "list_issues",
      "my_issues",
      "get_issue",
      "list_issue_links",
      "list_issue_discussions",
      "get_issue_link",
    ];

    const writeIssueTools = [
      "create_issue",
      "update_issue",
      "delete_issue",
      "create_issue_note",
      "update_issue_note",
      "create_issue_link",
      "delete_issue_link",
      "create_note",
    ];

    before(async () => {
      const port = await nextMcpPort();
      server = await launchMcpServer(mockGitLabUrl, port, {
        GITLAB_TOOLSETS: "issues",
        GITLAB_READ_ONLY_MODE: "true",
      });
      tools = await getToolNames(`http://${HOST}:${port}/mcp`);
    });

    after(() => cleanupServers([server]));

    test("includes only read-only issue tools", () => {
      assertContainsAll(tools, readOnlyIssueTools, "read-only issues");
    });

    test("excludes write issue tools", () => {
      assertContainsNone(tools, writeIssueTools, "write issues");
    });

    test("returns correct count", () => {
      assert.strictEqual(tools.length, readOnlyIssueTools.length);
    });
  });

  // ---- 9. GITLAB_DENIED_TOOLS_REGEX applied after toolset filter ----

  describe("GITLAB_TOOLSETS=issues + GITLAB_DENIED_TOOLS_REGEX=^(create_|delete_)", () => {
    let server: ServerInstance;
    let tools: string[];

    before(async () => {
      const port = await nextMcpPort();
      server = await launchMcpServer(mockGitLabUrl, port, {
        GITLAB_TOOLSETS: "issues",
        GITLAB_DENIED_TOOLS_REGEX: "^(create_|delete_)",
      });
      tools = await getToolNames(`http://${HOST}:${port}/mcp`);
    });

    after(() => cleanupServers([server]));

    test("excludes tools matching the denial regex", () => {
      const denied = tools.filter(
        (t) => t.startsWith("create_") || t.startsWith("delete_")
      );
      assert.strictEqual(denied.length, 0, `Should have no create_/delete_ tools, found: ${denied}`);
    });

    test("keeps non-matching issue tools", () => {
      assertContainsAll(
        tools,
        ["list_issues", "my_issues", "get_issue", "update_issue", "update_issue_note"],
        "non-denied issues"
      );
    });
  });

  // ---- 10. Full combination: toolset + individual + legacy + read-only ----

  describe("GITLAB_TOOLSETS=issues + GITLAB_TOOLS=list_pipelines + USE_GITLAB_WIKI=true + GITLAB_READ_ONLY_MODE=true", () => {
    let server: ServerInstance;
    let tools: string[];

    before(async () => {
      const port = await nextMcpPort();
      server = await launchMcpServer(mockGitLabUrl, port, {
        GITLAB_TOOLSETS: "issues",
        GITLAB_TOOLS: "list_pipelines",
        USE_GITLAB_WIKI: "true",
        GITLAB_READ_ONLY_MODE: "true",
      });
      tools = await getToolNames(`http://${HOST}:${port}/mcp`);
    });

    after(() => cleanupServers([server]));

    test("includes read-only issue tools", () => {
      assertContainsAll(tools, ["list_issues", "get_issue"], "read-only issues");
    });

    test("includes list_pipelines (read-only individual tool)", () => {
      assertContainsAll(tools, ["list_pipelines"], "individual pipeline");
    });

    test("includes read-only wiki tools from legacy flag", () => {
      assertContainsAll(tools, ["list_wiki_pages", "get_wiki_page"], "read-only wiki");
    });

    test("excludes write tools across all sources", () => {
      assertContainsNone(
        tools,
        ["create_issue", "create_pipeline", "create_wiki_page"],
        "write tools"
      );
    });
  });

  // ---- 11. Redundant legacy flag (toolset already includes it) ----

  describe("GITLAB_TOOLSETS=pipelines + USE_PIPELINE=true (redundant)", () => {
    let server: ServerInstance;
    let tools: string[];

    before(async () => {
      const port = await nextMcpPort();
      server = await launchMcpServer(mockGitLabUrl, port, {
        GITLAB_TOOLSETS: "pipelines",
        USE_PIPELINE: "true",
      });
      tools = await getToolNames(`http://${HOST}:${port}/mcp`);
    });

    after(() => cleanupServers([server]));

    test("returns exactly pipeline tool count (no duplicates)", () => {
      assert.strictEqual(tools.length, TOOLSET_TOOL_COUNTS.pipelines);
    });
  });

  // ---- 12. GITLAB_TOOLS with tool already in enabled toolset (no dupes) ----

  describe("GITLAB_TOOLSETS=issues + GITLAB_TOOLS=list_issues (already included)", () => {
    let server: ServerInstance;
    let tools: string[];

    before(async () => {
      const port = await nextMcpPort();
      server = await launchMcpServer(mockGitLabUrl, port, {
        GITLAB_TOOLSETS: "issues",
        GITLAB_TOOLS: "list_issues",
      });
      tools = await getToolNames(`http://${HOST}:${port}/mcp`);
    });

    after(() => cleanupServers([server]));

    test("returns exactly issue tool count (no duplicates)", () => {
      assert.strictEqual(tools.length, TOOLSET_TOOL_COUNTS.issues);
    });
  });

  // ---- 13. Invalid toolset ID is silently ignored ----

  describe("GITLAB_TOOLSETS=issues,nonexistent_toolset", () => {
    let server: ServerInstance;
    let tools: string[];

    before(async () => {
      const port = await nextMcpPort();
      server = await launchMcpServer(mockGitLabUrl, port, {
        GITLAB_TOOLSETS: "issues,nonexistent_toolset",
      });
      tools = await getToolNames(`http://${HOST}:${port}/mcp`);
    });

    after(() => cleanupServers([server]));

    test("returns only issue tools (invalid toolset ignored)", () => {
      assert.strictEqual(tools.length, TOOLSET_TOOL_COUNTS.issues);
    });
  });

  // ---- 14. GITLAB_TOOLS case-insensitive matching ----

  describe("GITLAB_TOOLS with mixed-case tool names", () => {
    let server: ServerInstance;
    let tools: string[];

    before(async () => {
      const port = await nextMcpPort();
      server = await launchMcpServer(mockGitLabUrl, port, {
        GITLAB_TOOLS: "List_Pipelines,Execute_GraphQL",
      });
      tools = await getToolNames(`http://${HOST}:${port}/mcp`);
    });

    after(() => cleanupServers([server]));

    test("resolves mixed-case tool names to lowercase equivalents", () => {
      assertContainsAll(tools, ["list_pipelines", "execute_graphql"], "case-insensitive tools");
    });

    test("returns default tools plus the two individual tools", () => {
      assert.strictEqual(tools.length, DEFAULT_TOOL_COUNT + 2);
    });
  });

  // ---- 15. GITLAB_TOOLS with unknown tool names ----

  describe("GITLAB_TOOLS with unknown tool names", () => {
    let server: ServerInstance;
    let tools: string[];

    before(async () => {
      const port = await nextMcpPort();
      server = await launchMcpServer(mockGitLabUrl, port, {
        GITLAB_TOOLS: "list_pipelines,nonexistent_tool_xyz",
      });
      tools = await getToolNames(`http://${HOST}:${port}/mcp`);
    });

    after(() => cleanupServers([server]));

    test("server starts normally and returns tools without crashing", () => {
      assert.ok(tools.length > 0, "Should return at least some tools");
    });

    test("includes the valid individual tool but ignores the unknown one", () => {
      assertContainsAll(tools, ["list_pipelines"], "valid individual tool");
      assertContainsNone(tools, ["nonexistent_tool_xyz"], "unknown tool");
    });
  });
});
