/**
 * Golden tools/list check.
 *
 * Compares what build/index.js lists over stdio against
 * test/fixtures/tools-list.golden.jsonl: tool order, which profiles list each
 * tool, input property names, required fields, annotations, and a hash of the
 * input schema without description text. Description edits do not fail it.
 *
 * Refactors (for example moving code out of index.ts or schemas.ts) should
 * leave the fixture unchanged. When a change is meant to alter tools/list,
 * regenerate the fixture and commit it:
 *
 *   npm run test:tools-list:update
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { StdioTestClient } from "./clients/stdio-client.js";

const SERVER_PATH = path.resolve("build/index.js");
const GOLDEN_PATH = path.resolve("test/fixtures/tools-list.golden.jsonl");
const UPDATE_COMMAND = "npm run test:tools-list:update";

type ListedTool = Awaited<ReturnType<StdioTestClient["listTools"]>>["tools"][number];

interface GoldenEntry {
  name: string;
  default: boolean;
  readonly: boolean;
  modify: boolean;
  properties: string[];
  required: string[];
  annotations: Record<string, unknown>;
  shape: string;
}

function serverEnv(overrides: Record<string, string>): Record<string, string> {
  return {
    GITLAB_PERSONAL_ACCESS_TOKEN: "test-token-tools-list-golden-0000",
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

async function listTools(overrides: Record<string, string>): Promise<ListedTool[]> {
  const client = new StdioTestClient();
  await client.connect(SERVER_PATH, serverEnv(overrides));
  try {
    return (await client.listTools()).tools;
  } finally {
    await client.disconnect();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Sorts keys and drops description strings. Property names are kept, even "description". */
function withoutDescriptions(value: unknown, isPropertyMap = false): unknown {
  if (Array.isArray(value)) {
    return value.map(item => withoutDescriptions(item));
  }
  if (!isRecord(value)) {
    return value;
  }
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    if (!isPropertyMap && key === "description" && typeof value[key] === "string") {
      continue;
    }
    result[key] = withoutDescriptions(value[key], !isPropertyMap && key === "properties");
  }
  return result;
}

function schemaShape(schema: unknown): string {
  const canonical = JSON.stringify(withoutDescriptions(schema));
  return createHash("sha256").update(canonical).digest("hex").slice(0, 12);
}

function sortedRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, value[key]])
  );
}

function toEntry(tool: ListedTool, names: Record<"default" | "readonly" | "modify", Set<string>>) {
  const schema = tool.inputSchema as Record<string, unknown>;
  const entry: GoldenEntry = {
    name: tool.name,
    default: names.default.has(tool.name),
    readonly: names.readonly.has(tool.name),
    modify: names.modify.has(tool.name),
    properties: isRecord(schema.properties) ? Object.keys(schema.properties) : [],
    required: Array.isArray(schema.required) ? schema.required.map(String) : [],
    annotations: sortedRecord(tool.annotations),
    shape: schemaShape(schema),
  };
  return JSON.stringify(entry);
}

function namesMissingFrom(names: Set<string>, listed: Set<string>): string[] {
  return [...names].filter(name => !listed.has(name));
}

function describeDrift(expected: string[], actual: string[]): string {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const removed = expected.filter(line => !actualSet.has(line));
  const added = actual.filter(line => !expectedSet.has(line));
  const sample = (lines: string[]) => lines.slice(0, 10).map(line => `  ${line}`);
  const parts = [`tools/list differs from ${path.relative(process.cwd(), GOLDEN_PATH)}.`];
  if (removed.length > 0) {
    parts.push(`Only in the fixture (${removed.length}):`, ...sample(removed));
  }
  if (added.length > 0) {
    parts.push(`Only in the server output (${added.length}):`, ...sample(added));
  }
  if (removed.length === 0 && added.length === 0) {
    parts.push("Same entries, different order.");
  }
  parts.push(`If the change is intended, run: ${UPDATE_COMMAND}`);
  return parts.join("\n");
}

describe("When the stdio server lists tools", () => {
  describe("with the default, all, readonly, and modify configurations", () => {
    it("should match the golden fixture", async t => {
      const defaultTools = await listTools({});
      const allTools = await listTools({ GITLAB_TOOLSETS: "all" });
      const readonlyTools = await listTools({
        GITLAB_TOOLSETS: "all",
        GITLAB_PERMISSION_MODE: "readonly",
      });
      const modifyTools = await listTools({
        GITLAB_TOOLSETS: "all",
        GITLAB_PERMISSION_MODE: "modify",
      });

      const names = {
        default: new Set(defaultTools.map(tool => tool.name)),
        readonly: new Set(readonlyTools.map(tool => tool.name)),
        modify: new Set(modifyTools.map(tool => tool.name)),
      };
      const allNames = new Set(allTools.map(tool => tool.name));
      for (const [profile, listed] of Object.entries(names)) {
        assert.deepEqual(
          namesMissingFrom(listed, allNames),
          [],
          `${profile} lists tools that GITLAB_TOOLSETS=all does not; extend this test to cover them`
        );
      }

      const actual = allTools.map(tool => toEntry(tool, names));
      t.diagnostic(
        `default tools/list: ${defaultTools.length} tools, ` +
          `${JSON.stringify({ tools: defaultTools }).length} bytes of JSON`
      );

      if (process.env.UPDATE_TOOLS_LIST_GOLDEN === "1") {
        fs.mkdirSync(path.dirname(GOLDEN_PATH), { recursive: true });
        fs.writeFileSync(GOLDEN_PATH, `${actual.join("\n")}\n`);
        t.diagnostic(`updated ${path.relative(process.cwd(), GOLDEN_PATH)}`);
        return;
      }

      const expected = fs.readFileSync(GOLDEN_PATH, "utf8").split("\n").filter(Boolean);
      assert.ok(
        expected.length === actual.length && expected.every((line, i) => line === actual[i]),
        describeDrift(expected, actual)
      );
    });
  });
});
