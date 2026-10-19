import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { StdioTestClient } from "../clients/stdio-client.js";

const SERVER_PATH = path.resolve("build/index.js");

function serverEnv(): Record<string, string> {
  return {
    GITLAB_PERSONAL_ACCESS_TOKEN: "test-token-mcp-resources-0000",
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
  };
}

async function withServer(run: (client: StdioTestClient) => Promise<void>): Promise<void> {
  const client = new StdioTestClient();
  await client.connect(SERVER_PATH, serverEnv());
  try {
    await run(client);
  } finally {
    await client.disconnect();
  }
}

describe("When the stdio server exposes docs resources", () => {
  describe("with a fake local token and stdio transport", () => {
    it("should advertise resources as an empty capability object", async () => {
      await withServer(async client => {
        const capabilities = await client.serverCapabilities();

        assert.deepEqual(capabilities?.resources, {});
      });
    });

    it("should list auth-setup, toolsets, and permission-modes in order", async () => {
      await withServer(async client => {
        const listed = await client.listResources();

        assert.deepEqual(
          listed.resources.map(resource => resource.uri),
          [
            "gitlab-mcp://docs/auth-setup",
            "gitlab-mcp://docs/toolsets",
            "gitlab-mcp://docs/permission-modes",
          ]
        );
      });
    });

    it("should return an empty resource templates list", async () => {
      await withServer(async client => {
        const listed = await client.listResourceTemplates();

        assert.deepEqual(listed.resourceTemplates, []);
      });
    });

    it("should return toolsets text that includes GITLAB_TOOLSETS", async () => {
      await withServer(async client => {
        const result = await client.readResource("gitlab-mcp://docs/toolsets");
        const text = result.contents
          .map(content => ("text" in content ? content.text : ""))
          .join("");

        assert.equal(text.includes("GITLAB_TOOLSETS"), true);
      });
    });
  });
});
