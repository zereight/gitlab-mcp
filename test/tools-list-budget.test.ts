/**
 * Default tools/list size budget.
 *
 * A client sends the whole tools/list result to the model at the start of every
 * session, so its size is a fixed token cost before the first tool call. This test
 * starts build/index.js over stdio with the default configuration (no
 * GITLAB_TOOLSETS, no GITLAB_TOOLS, profile and permission mode at their defaults)
 * and fails when the JSON of the listed tools grows past DEFAULT_TOOLS_LIST_MAX_BYTES.
 *
 * Measured on 2026-10-23: 39 tools, 54,887 bytes. GITLAB_TOOLSETS=all lists 275
 * tools and 320,643 bytes, so a tool that lands in a default toolset by mistake, or
 * a shared schema that grows on every tool, shows up here first.
 *
 * Raise the ceiling only for an intended change to the default tool set, a
 * description, or a schema, and say so in the PR. Prefer trimming the text first.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { StdioTestClient } from "./clients/stdio-client.js";

const SERVER_PATH = path.resolve("build/index.js");

/** About 27% headroom over the 2026-10-23 measurement (54,887 bytes). */
const DEFAULT_TOOLS_LIST_MAX_BYTES = 70_000;

/** Sanity range for the default tool count (39 on 2026-10-23, including discover_tools). */
const DEFAULT_TOOL_COUNT_MIN = 30;
const DEFAULT_TOOL_COUNT_MAX = 50;

type ListedTool = Awaited<ReturnType<StdioTestClient["listTools"]>>["tools"][number];

/** Same isolation as test/tools-list-golden.test.ts: unset every exposure knob. */
function defaultServerEnv(): Record<string, string> {
  return {
    GITLAB_PERSONAL_ACCESS_TOKEN: "test-token-tools-list-budget-0000",
    GITLAB_API_URL: "https://gitlab.example.com/api/v4",
    GITLAB_DISABLE_VERSION_CHECK: "true",
    LOG_FORMAT: "json",
    LOG_LEVEL: "error",
    GITLAB_TOOLSETS: "",
    GITLAB_TOOLS: "",
    GITLAB_TOOL_PROFILE: "",
    GITLAB_PERMISSION_MODE: "",
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

async function listDefaultTools(): Promise<ListedTool[]> {
  const client = new StdioTestClient();
  await client.connect(SERVER_PATH, defaultServerEnv());
  try {
    return (await client.listTools()).tools;
  } finally {
    await client.disconnect();
  }
}

function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function largestTools(tools: ListedTool[], count: number): string {
  return [...tools]
    .map(tool => ({ name: tool.name, bytes: jsonBytes(tool) }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, count)
    .map(({ name, bytes }) => `  ${name}: ${bytes} bytes`)
    .join("\n");
}

describe("When the stdio server lists tools with the default configuration", () => {
  it("should stay within the tools/list byte budget", async t => {
    const tools = await listDefaultTools();
    const bytes = jsonBytes({ tools });
    t.diagnostic(`default tools/list: ${tools.length} tools, ${bytes} bytes of JSON`);

    assert.ok(
      tools.length >= DEFAULT_TOOL_COUNT_MIN && tools.length <= DEFAULT_TOOL_COUNT_MAX,
      `default tools/list has ${tools.length} tools, expected ` +
        `${DEFAULT_TOOL_COUNT_MIN}-${DEFAULT_TOOL_COUNT_MAX}. Check the default toolsets.`
    );
    assert.ok(
      tools.some(tool => tool.name === "discover_tools"),
      "default tools/list should include discover_tools"
    );
    assert.ok(
      bytes <= DEFAULT_TOOLS_LIST_MAX_BYTES,
      `default tools/list is ${bytes} bytes of JSON, over the ${DEFAULT_TOOLS_LIST_MAX_BYTES} ` +
        `byte budget. Largest tools:\n${largestTools(tools, 5)}\n` +
        "Trim descriptions or schemas, or raise DEFAULT_TOOLS_LIST_MAX_BYTES " +
        "in test/tools-list-budget.test.ts with the reason in the PR."
    );
  });
});
