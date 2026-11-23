import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compactMcpToolResult } from "../../cli/compact-mcp-result.js";
import { allTools } from "../../tools/registry.js";
import { runInEveryShell, withStubWorkspace } from "./shell-replay-harness.js";

function textResult(text: string): { content: { type: string; text: string }[] } {
  return { content: [{ type: "text", text }] };
}

function schemaFor(toolName: string): unknown {
  const tool = allTools.find(entry => entry.name === toolName);
  assert.ok(tool, `unknown registry tool ${toolName}`);
  return tool.inputSchema;
}

function compactedPayload(compacted: Record<string, unknown>): Record<string, unknown> {
  assert.ok(Array.isArray(compacted.content));
  const block = compacted.content[0];
  assert.ok(isRecord(block) && typeof block.text === "string");
  const payload = JSON.parse(block.text);
  assert.ok(isRecord(payload));
  return payload;
}

const LONG_ISSUES = JSON.stringify(
  Array.from({ length: 20 }, (_, index) => ({ iid: index + 1, title: "x".repeat(80) }))
);

function compactIssues(args: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return compactMcpToolResult({
    result: textResult(LONG_ISSUES),
    enabled: true,
    maxChars: 200,
    toolName: "list_issues",
    args,
    inputSchema: schemaFor("list_issues"),
  });
}

describe("When compactMcpToolResult wraps an MCP tool reply", () => {
  describe("with compact mode disabled", () => {
    it("should return the original result", () => {
      const result = textResult("[]");
      const compacted = compactMcpToolResult({
        result,
        enabled: false,
        maxChars: 1,
        toolName: "list_issues",
        args: { project_id: "1" },
        inputSchema: schemaFor("list_issues"),
      });

      assert.equal(compacted, result);
    });
  });

  describe("with a small payload", () => {
    it("should leave the result alone", () => {
      const result = textResult('{"iid":1}');
      const compacted = compactMcpToolResult({
        result,
        enabled: true,
        maxChars: 4000,
        toolName: "get_issue",
        args: { project_id: "1", issue_iid: 1 },
        inputSchema: schemaFor("get_issue"),
      });

      assert.equal(compacted, result);
    });
  });

  describe("with a long issue list", () => {
    it("should keep a preview and a CLI replay command", () => {
      const compacted = compactMcpToolResult({
        result: textResult(LONG_ISSUES),
        enabled: true,
        maxChars: 200,
        toolName: "list_issues",
        args: { project_id: "123", state: "opened" },
        inputSchema: schemaFor("list_issues"),
      });

      assert.ok(isRecord(compacted));
      assert.equal(Object.prototype.hasOwnProperty.call(compacted, "structuredContent"), false);
      const payload = compactedPayload(compacted);
      assert.equal(payload.compact, true);
      assert.equal(payload.tool, "list_issues");
      assert.equal(payload.items_total, 20);
      assert.ok(Array.isArray(payload.preview));
      assert.equal(payload.preview.length, 5);
      assert.equal(payload.cli, "zereight-mcp-gitlab tool list_issues --project-id 123 --state opened");
    });

    it("should attach a double-quoted cli line for a value with a space, which every shell reads as one argument", () => {
      withStubWorkspace(workspace => {
        const payload = compactedPayload(compactIssues({ project_id: "123", search: "foo bar" }));

        assert.ok(Array.isArray(payload.preview));
        assert.equal(Object.prototype.hasOwnProperty.call(payload, "cli_argv"), false);
        assert.equal(payload.cli, 'zereight-mcp-gitlab tool list_issues --project-id 123 --search "foo bar"');
        assert.deepEqual(runInEveryShell(payload.cli, workspace), [
          "tool",
          "list_issues",
          "--project-id",
          "123",
          "--search",
          "foo bar",
        ]);
      });
    });

    const ARGV_ONLY_SEARCHES = [
      ["POSIX command substitution", "x$(touch PWNED) `touch PWNED` $HOME"],
      ["cmd.exe operators", "x & echo INJECTED > marker & rem "],
      ["a PowerShell single quote", "x' ; New-Item PWNED2 ; '"],
    ] as const;

    for (const [label, search] of ARGV_ONLY_SEARCHES) {
      it(`should attach cli_argv, and no cli line, for a value with ${label}`, () => {
        const payload = compactedPayload(compactIssues({ project_id: "123", search }));

        assert.equal(payload.compact, true);
        assert.ok(Array.isArray(payload.preview));
        assert.equal(payload.preview.length, 5);
        assert.equal(Object.prototype.hasOwnProperty.call(payload, "cli"), false);
        assert.deepEqual(payload.cli_argv, [
          "zereight-mcp-gitlab",
          "tool",
          "list_issues",
          "--project-id",
          "123",
          "--search",
          search,
        ]);
      });
    }

    it("should drop both cli and cli_argv, but keep the preview, when an argument name is unsafe", () => {
      const payload = compactedPayload(compactIssues({ project_id: "123", "$(touch PWNED)": "1" }));

      assert.equal(payload.compact, true);
      assert.ok(Array.isArray(payload.preview));
      assert.equal(Object.prototype.hasOwnProperty.call(payload, "cli"), false);
      assert.equal(Object.prototype.hasOwnProperty.call(payload, "cli_argv"), false);
    });
  });

  describe("with structuredContent on a large payload", () => {
    it("should drop structuredContent so the full object cannot leak", () => {
      const issues = Array.from({ length: 20 }, (_, index) => ({ iid: index + 1, title: "x".repeat(80) }));
      const compacted = compactMcpToolResult({
        result: {
          content: [{ type: "text", text: JSON.stringify(issues) }],
          structuredContent: issues,
        },
        enabled: true,
        maxChars: 200,
        toolName: "list_issues",
        args: { project_id: "1" },
        inputSchema: schemaFor("list_issues"),
      });

      assert.ok(isRecord(compacted));
      assert.equal(Object.prototype.hasOwnProperty.call(compacted, "structuredContent"), false);
    });
  });

  describe("with an error result", () => {
    it("should not compact", () => {
      const result = { content: [{ type: "text", text: "boom".repeat(500) }], isError: true };
      const compacted = compactMcpToolResult({
        result,
        enabled: true,
        maxChars: 10,
        toolName: "list_issues",
        args: {},
        inputSchema: schemaFor("list_issues"),
      });

      assert.equal(compacted, result);
    });
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
