import { describe, test } from "node:test";
import assert from "node:assert";
import {
  assertDetectorHealthy,
  buildCoverageMarkdown,
  CANARY_INVOKED,
  collectInvocations,
  countInvoked,
  formatFiles,
  GROUP_ORDER,
  groupToolsByToolset,
  MIN_INVOKED,
  percent,
  scanSourceForInvocations,
  toolDocsHref,
} from "./coverage.js";

const TOOLS = new Set(["list_issues", "get_project", "orbit_query"]);

function scan(source: string): Set<string> {
  return scanSourceForInvocations(source, "probe.ts", TOOLS);
}

describe("scanSourceForInvocations", () => {
  test("counts a string literal directly in the argument list", () => {
    assert.deepStrictEqual(
      scan(`await callTool("list_issues", { project_id: "1" });`),
      new Set(["list_issues"])
    );
  });

  test("counts the name in second position after env", () => {
    assert.deepStrictEqual(
      scan(`await callToolAsync(baseEnv(url), "orbit_query", { query });`),
      new Set(["orbit_query"])
    );
  });

  test("counts property-access callees", () => {
    assert.deepStrictEqual(
      scan(`await client.callTool("get_project", { project_id: "1" });`),
      new Set(["get_project"])
    );
  });

  test("counts the SDK object shape when it is the first argument", () => {
    assert.deepStrictEqual(
      scan(`await client.callTool({ name: "list_issues", arguments: {} });`),
      new Set(["list_issues"])
    );
  });

  test("ignores a name object past the first argument (tool input, not invocation)", () => {
    assert.deepStrictEqual(scan(`await callTool(toolName, { name: "get_project" });`), new Set([]));
  });

  test("ignores literals after the call expression closes", () => {
    assert.deepStrictEqual(
      scan(`await callTool(env, toolName, args);\nconst label = "get_project";`),
      new Set([])
    );
  });

  test("ignores variable names", () => {
    assert.deepStrictEqual(scan(`await callTool(env, toolName, args);`), new Set([]));
  });

  test("ignores callees that are not callTool*", () => {
    assert.deepStrictEqual(
      scan(`await callListIssues({ project_id: "1" }, env);\nnotify("get_project");`),
      new Set([])
    );
  });

  test("counts a name inside the same literal as method tools/call", () => {
    assert.deepStrictEqual(
      scan(`JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "list_issues", arguments: args },
      });`),
      new Set(["list_issues"])
    );
  });

  test("ignores name properties outside the tools/call payload", () => {
    assert.deepStrictEqual(
      scan(`
        const listing = { tools: [{ name: "orbit_query", description: "q" }] };
        JSON.stringify({ method: "tools/call", params: { name: "list_issues", arguments: {} } });
      `),
      new Set(["list_issues"])
    );
  });

  test("ignores a variable name in the payload", () => {
    assert.deepStrictEqual(
      scan(`JSON.stringify({ method: "tools/call", params: { name: toolName } });`),
      new Set([])
    );
  });

  test("counts a request-helper call with method and params arguments", () => {
    assert.deepStrictEqual(
      scan(`await sendMcpRequest(proc, "tools/call", { name: "get_project", arguments: {} });`),
      new Set(["get_project"])
    );
  });

  test("ignores request-helper calls for other methods", () => {
    assert.deepStrictEqual(
      scan(`await sendMcpRequest(proc, "initialize", { name: "get_project" });`),
      new Set([])
    );
  });

  test("ignores request-helper calls with non-object params", () => {
    assert.deepStrictEqual(scan(`await sendMcpRequest(proc, "tools/call", params);`), new Set([]));
  });

  test("ignores tools/call when params is not an inline object", () => {
    assert.deepStrictEqual(scan(`JSON.stringify({ method: "tools/call", params });`), new Set([]));
  });

  test("accepts quoted property keys and single quotes", () => {
    assert.deepStrictEqual(
      scan(`JSON.stringify({ "method": 'tools/call', "params": { "name": 'get_project' } });`),
      new Set(["get_project"])
    );
  });

  test("unwraps as expressions around the name", () => {
    assert.deepStrictEqual(
      scan(`await callTool("list_issues" as string);`),
      new Set(["list_issues"])
    );
  });

  test("ignores names outside the known tool set", () => {
    assert.deepStrictEqual(scan(`await callTool("no_such_tool", {});`), new Set([]));
  });

  test("parses .js sources", () => {
    const hits = scanSourceForInvocations(`await callTool("get_project", {});`, "probe.js", TOOLS);
    assert.deepStrictEqual(hits, new Set(["get_project"]));
  });
});

describe("collectInvocations", () => {
  test("aggregates per-file hits into sorted file lists", () => {
    const hits = collectInvocations(
      [
        { path: "test/b.ts", text: `callTool("get_project", {});` },
        { path: "test/a.ts", text: `callTool("get_project", {}); callTool("list_issues", {});` },
        { path: "test/a.ts", text: `callTool("get_project", {});` },
      ],
      TOOLS
    );
    assert.deepStrictEqual(hits.get("get_project"), ["test/a.ts", "test/b.ts"]);
    assert.deepStrictEqual(hits.get("list_issues"), ["test/a.ts"]);
    assert.deepStrictEqual(hits.get("orbit_query"), []);
  });
});

describe("groupToolsByToolset", () => {
  test("groups known toolsets and buckets the rest as meta", () => {
    const definitions = GROUP_ORDER.map(id => ({
      id,
      tools: id === "issues" ? ["list_issues"] : [],
    }));
    const grouped = groupToolsByToolset(["list_issues", "stray_tool"], definitions);
    assert.strictEqual(grouped.find(g => g.id === "issues")?.tools.join(","), "list_issues");
    assert.strictEqual(grouped.at(-1)?.id, "meta");
    assert.deepStrictEqual(grouped.at(-1)?.tools, ["stray_tool"]);
  });

  test("throws when GROUP_ORDER names a missing toolset", () => {
    assert.throws(() => groupToolsByToolset([], []), /GROUP_ORDER lists 'projects'/);
  });
});

describe("markdown helpers", () => {
  test("percent handles zero totals", () => {
    assert.strictEqual(percent(1, 2), "50.0%");
    assert.strictEqual(percent(0, 0), "0.0%");
  });

  test("toolDocsHref slugifies the group id", () => {
    assert.strictEqual(
      toolDocsHref("merge_requests", "list_issues"),
      "../tools/merge-requests.md#list_issues"
    );
  });

  test("formatFiles wraps paths in code spans", () => {
    assert.strictEqual(formatFiles(["test/a.ts", "test/b.ts"]), "`test/a.ts`, `test/b.ts`");
  });

  test("countInvoked counts tools with at least one file", () => {
    const hits = new Map([
      ["list_issues", ["test/a.ts"]],
      ["get_project", []],
    ]);
    assert.strictEqual(countInvoked(["list_issues", "get_project"], hits), 1);
  });

  test("buildCoverageMarkdown renders checked and unchecked rows", () => {
    const markdown = buildCoverageMarkdown(
      ["list_issues", "get_project"],
      new Map([
        ["list_issues", ["test/a.ts"]],
        ["get_project", []],
      ]),
      [{ id: "issues", tools: ["list_issues", "get_project"] }]
    );
    assert.match(markdown, /\| Invoked \| 1 \|/);
    assert.match(markdown, /- \[x\] \[`list_issues`\].*`test\/a\.ts`/);
    assert.match(markdown, /- \[ \] \[`get_project`\]/);
  });
});

describe("assertDetectorHealthy", () => {
  test("passes at the floor with all canaries present", () => {
    const hits = new Map(CANARY_INVOKED.map(name => [name, ["test/a.ts"]] as [string, string[]]));
    assert.doesNotThrow(() => assertDetectorHealthy(hits, MIN_INVOKED));
  });

  test("throws below the floor", () => {
    assert.throws(() => assertDetectorHealthy(new Map(), MIN_INVOKED - 1), /expected at least/);
  });

  test("throws when a canary is missing", () => {
    assert.throws(() => assertDetectorHealthy(new Map(), MIN_INVOKED + 10), /canary tool/);
  });
});
