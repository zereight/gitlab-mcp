import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compactMcpToolResult } from "../../cli/compact-mcp-result.js";

function textResult(text: string): { content: { type: string; text: string }[] } {
  return { content: [{ type: "text", text }] };
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
      });

      assert.equal(compacted, result);
    });
  });

  describe("with a long issue list", () => {
    it("should keep a preview and a CLI replay command", () => {
      const issues = Array.from({ length: 20 }, (_, index) => ({ iid: index + 1, title: "x".repeat(80) }));
      const compacted = compactMcpToolResult({
        result: textResult(JSON.stringify(issues)),
        enabled: true,
        maxChars: 200,
        toolName: "list_issues",
        args: { project_id: "123", state: "opened" },
      });

      assert.ok(isRecord(compacted));
      assert.equal(Object.prototype.hasOwnProperty.call(compacted, "structuredContent"), false);
      const content = compacted.content;
      assert.ok(Array.isArray(content));
      const block = content[0];
      assert.ok(isRecord(block) && typeof block.text === "string");
      const payload = JSON.parse(block.text);
      assert.ok(isRecord(payload));
      assert.equal(payload.compact, true);
      assert.equal(payload.tool, "list_issues");
      assert.equal(payload.items_total, 20);
      assert.ok(Array.isArray(payload.preview));
      assert.equal(payload.preview.length, 5);
      assert.equal(
        payload.cli,
        "zereight-mcp-gitlab tool list_issues --project-id 123 --state opened"
      );
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
      });

      assert.equal(compacted, result);
    });
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
