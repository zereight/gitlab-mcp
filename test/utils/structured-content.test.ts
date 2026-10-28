import { describe, test } from "node:test";
import assert from "node:assert";
import { isJsonObject, omitInvalidStructuredContent } from "../../utils/structured-content.js";

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
