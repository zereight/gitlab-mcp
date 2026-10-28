import { describe, test } from "node:test";
import assert from "node:assert";
import { isJsonObject, omitInvalidStructuredContent } from "../../utils/structured-content.js";
import { finalizeToolCallResult } from "../../cli/compact-mcp-result.js";

// Issue #675: a validating MCP client (SDK CallToolResultSchema) rejects a
// tools/call result whose structuredContent is not a JSON object.
describe("omitInvalidStructuredContent", () => {
  const content = [{ type: "text", text: "[]" }];

  test("returns the same result when structuredContent is absent", () => {
    const result = { content };
    assert.strictEqual(omitInvalidStructuredContent(result), result);
    assert.equal("structuredContent" in omitInvalidStructuredContent(result), false);
  });

  test("keeps structuredContent when it is a plain object", () => {
    const result = { content, structuredContent: { items: [{ id: 1 }], total: 1 } };
    const normalized = omitInvalidStructuredContent(result);
    assert.strictEqual(normalized, result);
    assert.deepEqual(normalized.structuredContent, { items: [{ id: 1 }], total: 1 });
  });

  test("keeps an empty object", () => {
    const result = { content, structuredContent: {} };
    assert.deepEqual(omitInvalidStructuredContent(result).structuredContent, {});
  });

  for (const [label, structuredContent] of [
    ["array", [{ old_path: "a", new_path: "a" }]],
    ["empty array", []],
    ["string", "diff"],
    ["number", 3],
    ["boolean", true],
    ["null", null],
    ["undefined", undefined],
  ] as const) {
    test(`drops structuredContent when it is ${label}`, () => {
      const result = { content, isError: false, structuredContent };
      const normalized = omitInvalidStructuredContent(result);
      assert.equal(Object.prototype.hasOwnProperty.call(normalized, "structuredContent"), false);
      // Text content and other fields are untouched.
      assert.deepEqual(normalized.content, content);
      assert.equal(normalized.isError, false);
    });
  }
});

// finalizeToolCallResult is the last exit of the tools/call path in index.ts
// (logCompletion). Compaction passes these results through unchanged, so only the
// guard can drop the array.
describe("finalizeToolCallResult", () => {
  const diffs = [{ old_path: "a", new_path: "a", diff: "@@ -1 +1 @@" }];
  const content = [{ type: "text", text: JSON.stringify(diffs) }];

  for (const [label, enabled, isError] of [
    ["compaction disabled", false, false],
    ["compaction enabled, small payload", true, false],
    ["error result", true, true],
  ] as const) {
    test(`drops array structuredContent and keeps text content (${label})`, () => {
      const finalized = finalizeToolCallResult({
        result: { content, isError, structuredContent: diffs },
        enabled,
        maxChars: 10_000,
        toolName: "get_merge_request_diffs",
        args: { project_id: "123", merge_request_iid: "1" },
      });
      assert.equal(Object.prototype.hasOwnProperty.call(finalized, "structuredContent"), false);
      assert.deepEqual(finalized.content, content);
      assert.equal(finalized.isError, isError);
    });
  }
});

describe("isJsonObject", () => {
  test("accepts plain objects only", () => {
    assert.equal(isJsonObject({}), true);
    assert.equal(isJsonObject({ a: 1 }), true);
    assert.equal(isJsonObject([]), false);
    assert.equal(isJsonObject(null), false);
    assert.equal(isJsonObject("x"), false);
    assert.equal(isJsonObject(1), false);
    assert.equal(isJsonObject(undefined), false);
  });
});
