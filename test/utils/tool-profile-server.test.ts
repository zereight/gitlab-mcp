import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { StdioTestClient } from "../clients/stdio-client.js";

const SERVER_PATH = path.resolve("build/index.js");

function serverEnv(overrides: Record<string, string>): Record<string, string> {
  return {
    GITLAB_PERSONAL_ACCESS_TOKEN: "glpat-tool-profile-test-token",
    GITLAB_API_URL: "https://gitlab.example.com/api/v4",
    GITLAB_DISABLE_VERSION_CHECK: "true",
    LOG_FORMAT: "json",
    LOG_LEVEL: "error",
    GITLAB_TOOLSETS: "",
    GITLAB_TOOLS: "",
    GITLAB_TOOL_PROFILE: "full",
    GITLAB_PERMISSION_MODE: "full",
    GITLAB_READ_ONLY_MODE: "false",
    GITLAB_DENIED_TOOLS_REGEX: "",
    GITLAB_TOOL_POLICY_HIDDEN: "",
    GITLAB_TOOL_POLICY_APPROVE: "",
    USE_PIPELINE: "false",
    USE_MILESTONE: "false",
    USE_GITLAB_WIKI: "false",
    SSE: "false",
    STREAMABLE_HTTP: "false",
    REMOTE_AUTHORIZATION: "false",
    GITLAB_USE_OAUTH: "false",
    GITLAB_MCP_OAUTH: "false",
    ...overrides,
  };
}

function hasJmespathArgument(schema: unknown): boolean {
  if (typeof schema !== "object" || schema === null || !("properties" in schema)) {
    return false;
  }
  const properties = schema.properties;
  return typeof properties === "object" && properties !== null && "jmespath" in properties;
}

async function withServer(
  env: Record<string, string>,
  run: (client: StdioTestClient) => Promise<void>
): Promise<void> {
  const client = new StdioTestClient();
  await client.connect(SERVER_PATH, env);
  try {
    await run(client);
  } finally {
    await client.disconnect();
  }
}

describe("When the stdio server lists tools", () => {
  describe("with the default profile", () => {
    it("should keep label tools and decorate schemas once per revision", async () => {
      await withServer(serverEnv({}), async client => {
        const first = await client.listTools();
        const second = await client.listTools();
        const issue = second.tools.find(tool => tool.name === "list_issues");

        assert.equal(first.tools.some(tool => tool.name === "list_labels"), true);
        assert.equal(hasJmespathArgument(issue?.inputSchema), true);
      });
    });
  });

  describe("with GITLAB_TOOL_PROFILE=slim", () => {
    it("should hide slim tools even after discover_tools", async () => {
      await withServer(serverEnv({ GITLAB_TOOL_PROFILE: "slim" }), async client => {
        const discovered = await client.callTool("discover_tools", { category: "labels" });
        const text = discovered.content
          .map(block => (block.type === "text" ? block.text : ""))
          .join("\n");
        const names = (await client.listTools()).tools.map(tool => tool.name);
        const slimHolds =
          text.includes("already active") &&
          names.includes("list_issues") &&
          names.includes("discover_tools") &&
          !names.includes("list_labels") &&
          !names.includes("create_group");

        assert.equal(slimHolds, true);
      });
    });
  });
});
