import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { StdioTestClient } from "../clients/stdio-client.js";

const SERVER_PATH = path.resolve("build/index.js");

function serverEnv(): Record<string, string> {
  return {
    GITLAB_PERSONAL_ACCESS_TOKEN: "test-token-mcp-prompts-0000",
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

describe("When the stdio server exposes workflow prompts", () => {
  describe("with a fake local token and stdio transport", () => {
    it("should advertise prompts with listChanged capability", async () => {
      await withServer(async client => {
        const capabilities = await client.serverCapabilities();

        assert.deepEqual(capabilities?.prompts, { listChanged: true });
      });
    });

    it("should list review, pipeline triage, and vulnerability triage in order", async () => {
      await withServer(async client => {
        const listed = await client.listPrompts();

        assert.deepEqual(
          listed.prompts.map(prompt => prompt.name),
          ["review_merge_request", "triage_pipeline_failure", "triage_vulnerabilities"]
        );
      });
    });

    it("should render review_merge_request with the given arguments", async () => {
      await withServer(async client => {
        const result = await client.getPrompt("review_merge_request", {
          project_id: "group/app",
          merge_request_iid: "42",
        });
        const message = result.messages[0];

        assert.equal(result.messages.length, 1);
        assert.equal(message?.role, "user");
        assert.equal(message?.content.type, "text");
        assert.equal(
          message?.content.type === "text" ? message.content.text.split("\n")[0] : "",
          "Review merge request !42 in project group/app:"
        );
      });
    });

    it("should render placeholders when arguments are omitted", async () => {
      await withServer(async client => {
        const result = await client.getPrompt("triage_pipeline_failure");
        const message = result.messages[0];

        assert.equal(
          message?.content.type === "text" ? message.content.text.split("\n")[0] : "",
          "Diagnose pipeline <pipeline_id> in project <project_id>:"
        );
      });
    });

    it("should return an internal error for an unknown prompt", async () => {
      await withServer(async client => {
        await assert.rejects(client.getPrompt("nope"), (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /-32603/);
          assert.match(error.message, /Unknown prompt: nope/);
          return true;
        });
      });
    });
  });
});
