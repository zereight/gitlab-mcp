import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import {
  MCP_INSTRUCTIONS,
  MCP_INSTRUCTIONS_MAX_BYTES,
} from "../../server/mcp-instructions.js";
import { StdioTestClient } from "../clients/stdio-client.js";

const SERVER_PATH = path.resolve("build/index.js");

function instructionBytes(): number {
  return Buffer.byteLength(MCP_INSTRUCTIONS, "utf8");
}

function defaultServerEnv(): Record<string, string> {
  return {
    GITLAB_PERSONAL_ACCESS_TOKEN: "test-token-mcp-instructions-0000",
    GITLAB_API_URL: "https://gitlab.example.com/api/v4",
    GITLAB_DISABLE_VERSION_CHECK: "true",
    LOG_FORMAT: "json",
    LOG_LEVEL: "error",
  };
}

describe("When MCP initialize instructions are published", () => {
  describe("with the static briefing", () => {
    it("should stay within the 2KB handshake budget", () => {
      const bytes = instructionBytes();

      assert.ok(bytes > 0, "instructions should not be empty");
      assert.ok(
        bytes <= MCP_INSTRUCTIONS_MAX_BYTES,
        `instructions are ${bytes} bytes, over the ${MCP_INSTRUCTIONS_MAX_BYTES} byte budget`
      );
    });

    it("should name the progressive-disclosure and token-saving rules", () => {
      assert.match(MCP_INSTRUCTIONS, /discover_tools/);
      assert.match(MCP_INSTRUCTIONS, /list_merge_request_changed_files/);
      assert.match(MCP_INSTRUCTIONS, /jmespath/);
      assert.match(MCP_INSTRUCTIONS, /help/);
    });
  });

  describe("with a live stdio initialize handshake", () => {
    it("should send the same briefing on initialize", async () => {
      const client = new StdioTestClient();
      await client.connect(SERVER_PATH, defaultServerEnv());
      try {
        assert.equal(client.getInstructions(), MCP_INSTRUCTIONS);
      } finally {
        await client.disconnect();
      }
    });
  });
});
