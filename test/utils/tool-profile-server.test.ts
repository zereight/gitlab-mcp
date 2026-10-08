import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { StdioTestClient } from "../clients/stdio-client.js";

const SERVER_PATH = path.resolve("build/index.js");

function serverEnv(overrides: Record<string, string>): Record<string, string> {
  return {
    GITLAB_PERSONAL_ACCESS_TOKEN: "test-token-tool-profile-0000",
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

function toolResultText(result: {
  content: ReadonlyArray<{ type: string; text?: string }>;
}): string {
  return result.content.map(block => (block.type === "text" ? (block.text ?? "") : "")).join("\n");
}

async function callText(
  client: StdioTestClient,
  name: string,
  args: Record<string, unknown> = {}
): Promise<string> {
  try {
    const result = await client.callTool(name, args);
    return toolResultText(result);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function categoryIsActive(text: string, id: string): boolean {
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null || !("categories" in parsed)) {
    throw new Error(`discover_tools response has no categories: ${text}`);
  }
  const categories: unknown = parsed.categories;
  if (!Array.isArray(categories)) {
    throw new Error(`discover_tools categories is not a list: ${text}`);
  }
  for (const category of categories) {
    if (typeof category !== "object" || category === null) {
      continue;
    }
    if (!("id" in category) || !("active" in category)) {
      continue;
    }
    if (category.id === id && typeof category.active === "boolean") {
      return category.active;
    }
  }
  throw new Error(`missing category ${id}: ${text}`);
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

        assert.equal(
          first.tools.some(tool => tool.name === "list_labels"),
          true
        );
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

    it("should explain a slim-excluded core tool without suggesting discover_tools", async () => {
      await withServer(serverEnv({ GITLAB_TOOL_PROFILE: "slim" }), async client => {
        const text = await callText(client, "list_labels", { project_id: "1" });
        const explained =
          text.includes("The slim tool profile excludes it.") &&
          text.includes("GITLAB_TOOL_PROFILE=full") &&
          !text.includes("discover_tools");

        assert.equal(explained, true, text);
      });
    });

    it("should explain a slim-excluded opt-in tool without suggesting discover_tools", async () => {
      await withServer(serverEnv({ GITLAB_TOOL_PROFILE: "slim" }), async client => {
        const text = await callText(client, "create_label", { project_id: "1", name: "bug" });
        const explained =
          text.includes("The slim tool profile excludes it.") &&
          text.includes("GITLAB_TOOLSETS") &&
          !text.includes("GITLAB_TOOL_PROFILE=full") &&
          !text.includes("discover_tools");

        assert.equal(explained, true, text);
      });
    });
  });

  describe("with readonly mode after the labels category is activated", () => {
    it("should mark labels active", async () => {
      await withServer(serverEnv({ GITLAB_PERMISSION_MODE: "readonly" }), async client => {
        await client.callTool("discover_tools", { category: "labels" });
        const text = await callText(client, "discover_tools");

        assert.equal(categoryIsActive(text, "labels"), true);
      });
    });
  });

  describe("with a hidden tool inside an enabled toolset", () => {
    it("should mark the category active", async () => {
      await withServer(
        serverEnv({
          GITLAB_TOOLSETS: "labels",
          GITLAB_TOOL_POLICY_HIDDEN: "create_label",
        }),
        async client => {
          const text = await callText(client, "discover_tools");

          assert.equal(categoryIsActive(text, "labels"), true);
        }
      );
    });
  });
});
