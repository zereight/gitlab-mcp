/**
 * tools/list size budget.
 *
 * A client sends the whole tools/list result to the model at the start of every
 * session, so its size is a fixed token cost before the first tool call. This
 * suite starts build/index.js over stdio and fails when the JSON of the listed
 * tools grows past the profile budget.
 *
 * Raise a ceiling only for an intended change to the tool set, a description,
 * or a schema, and say so in the PR. Prefer trimming the text first.
 *
 * Token estimate is UTF-8 bytes / 4 (common MCP list-size approximation).
 */
import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { StdioTestClient } from "./clients/stdio-client.js";

const SERVER_PATH = path.resolve("build/index.js");

/**
 * Default (core + discover_tools). Measured 2026-10-23 after description
 * shortening: 39 tools, 48,069 bytes (~12,018 tokens). ~16% headroom.
 */
const DEFAULT_TOOLS_LIST_MAX_BYTES = 56_000;
const DEFAULT_TOOL_COUNT_MIN = 30;
const DEFAULT_TOOL_COUNT_MAX = 50;

/**
 * GITLAB_TOOL_PROFILE=slim on the default toolsets. Measured 2026-10-23:
 * 38 tools, 47,199 bytes (~11,800 tokens). ~16% headroom.
 */
const SLIM_TOOLS_LIST_MAX_BYTES = 55_000;
const SLIM_TOOL_COUNT_MIN = 25;
const SLIM_TOOL_COUNT_MAX = 50;

/**
 * GITLAB_TOOLSETS=all (discoverable toolsets + discover_tools, not api).
 * Measured 2026-10-23: 275 tools, 274,896 bytes (~68,724 tokens). ~16% headroom.
 */
const ALL_TOOLS_LIST_MAX_BYTES = 320_000;
const ALL_TOOL_COUNT_MIN = 250;
const ALL_TOOL_COUNT_MAX = 300;

type ListedTool = Awaited<ReturnType<StdioTestClient["listTools"]>>["tools"][number];

interface ToolsListMeasurement {
  readonly tools: ListedTool[];
  readonly bytes: number;
  readonly tokens: number;
}

/** Same isolation as test/tools-list-golden.test.ts: unset every exposure knob. */
function serverEnv(overrides: Record<string, string> = {}): Record<string, string> {
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
    ...overrides,
  };
}

async function measureToolsList(
  overrides: Record<string, string> = {}
): Promise<ToolsListMeasurement> {
  const client = new StdioTestClient();
  await client.connect(SERVER_PATH, serverEnv(overrides));
  try {
    const tools = (await client.listTools()).tools;
    const bytes = jsonBytes({ tools });
    return { tools, bytes, tokens: estimateTokens(bytes) };
  } finally {
    await client.disconnect();
  }
}

function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function estimateTokens(bytes: number): number {
  return Math.ceil(bytes / 4);
}

function largestTools(tools: ListedTool[], count: number): string {
  return [...tools]
    .map(tool => ({ name: tool.name, bytes: jsonBytes(tool) }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, count)
    .map(({ name, bytes }) => `  ${name}: ${bytes} bytes`)
    .join("\n");
}

function assertToolsListBudget(
  measurement: ToolsListMeasurement,
  options: {
    readonly label: string;
    readonly minCount: number;
    readonly maxCount: number;
    readonly maxBytes: number;
  }
): void {
  const { tools, bytes } = measurement;
  assert.ok(
    tools.length >= options.minCount && tools.length <= options.maxCount,
    `${options.label} tools/list has ${tools.length} tools, expected ` +
      `${options.minCount}-${options.maxCount}. Check the toolsets.`
  );
  assert.ok(
    tools.some(tool => tool.name === "discover_tools"),
    `${options.label} tools/list should include discover_tools`
  );
  assert.ok(
    bytes <= options.maxBytes,
    `${options.label} tools/list is ${bytes} bytes of JSON, over the ${options.maxBytes} ` +
      `byte budget. Largest tools:\n${largestTools(tools, 5)}\n` +
      "Trim descriptions or schemas, or raise the budget constant " +
      "in test/tools-list-budget.test.ts with the reason in the PR."
  );
}

describe("When the stdio server lists tools", () => {
  describe("with the default configuration", () => {
    it("should stay within the tools/list byte budget", async t => {
      const measurement = await measureToolsList();
      t.diagnostic(
        `default tools/list: ${measurement.tools.length} tools, ${measurement.bytes} bytes, ` +
          `~${measurement.tokens} tokens`
      );
      assertToolsListBudget(measurement, {
        label: "default",
        minCount: DEFAULT_TOOL_COUNT_MIN,
        maxCount: DEFAULT_TOOL_COUNT_MAX,
        maxBytes: DEFAULT_TOOLS_LIST_MAX_BYTES,
      });
    });
  });

  describe("with GITLAB_TOOL_PROFILE=slim", () => {
    it("should stay within the slim tools/list byte budget", async t => {
      const measurement = await measureToolsList({ GITLAB_TOOL_PROFILE: "slim" });
      t.diagnostic(
        `slim tools/list: ${measurement.tools.length} tools, ${measurement.bytes} bytes, ` +
          `~${measurement.tokens} tokens`
      );
      assertToolsListBudget(measurement, {
        label: "slim",
        minCount: SLIM_TOOL_COUNT_MIN,
        maxCount: SLIM_TOOL_COUNT_MAX,
        maxBytes: SLIM_TOOLS_LIST_MAX_BYTES,
      });
    });
  });

  describe("with GITLAB_TOOLSETS=all", () => {
    it("should stay within the all-toolsets tools/list byte budget", async t => {
      const measurement = await measureToolsList({ GITLAB_TOOLSETS: "all" });
      t.diagnostic(
        `all tools/list: ${measurement.tools.length} tools, ${measurement.bytes} bytes, ` +
          `~${measurement.tokens} tokens`
      );
      assertToolsListBudget(measurement, {
        label: "all",
        minCount: ALL_TOOL_COUNT_MIN,
        maxCount: ALL_TOOL_COUNT_MAX,
        maxBytes: ALL_TOOLS_LIST_MAX_BYTES,
      });
    });
  });
});
