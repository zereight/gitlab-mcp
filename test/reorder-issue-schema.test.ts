import { describe, it } from "node:test";
import assert from "node:assert";
import { ReorderIssueSchema } from "../schemas.js";

function reorderArgs(overrides: Record<string, unknown> = {}) {
  return {
    project_id: "group/project",
    issue_iid: "12",
    ...overrides,
  };
}

describe("When parsing reorder_issue arguments", () => {
  describe("with move_after_id only", () => {
    it("should parse and leave move_before_id undefined", () => {
      const parsed = ReorderIssueSchema.parse(reorderArgs({ move_after_id: 42 }));
      assert.strictEqual(parsed.move_after_id, 42);
      assert.strictEqual(parsed.move_before_id, undefined);
    });
  });

  describe("with move_before_id only", () => {
    it("should parse and leave move_after_id undefined", () => {
      const parsed = ReorderIssueSchema.parse(reorderArgs({ move_before_id: 7 }));
      assert.strictEqual(parsed.move_before_id, 7);
      assert.strictEqual(parsed.move_after_id, undefined);
    });
  });

  describe("with both ids", () => {
    it("should keep both on the parsed object", () => {
      const parsed = ReorderIssueSchema.parse(
        reorderArgs({ move_after_id: 42, move_before_id: 7 })
      );
      assert.strictEqual(parsed.move_after_id, 42);
      assert.strictEqual(parsed.move_before_id, 7);
    });
  });

  describe("with numeric strings", () => {
    it("should coerce the global ids to numbers", () => {
      const parsed = ReorderIssueSchema.parse(
        reorderArgs({ move_after_id: "42", move_before_id: "7" })
      );
      assert.strictEqual(parsed.move_after_id, 42);
      assert.strictEqual(parsed.move_before_id, 7);
    });
  });

  describe("with neither id", () => {
    it("should reject with a message naming both parameters", () => {
      const result = ReorderIssueSchema.safeParse(reorderArgs());
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.strictEqual(
          result.error.issues[0]?.message,
          "At least one of 'move_after_id' or 'move_before_id' must be provided"
        );
      }
    });
  });

  describe("with a non-integer id", () => {
    it("should reject the value", () => {
      assert.strictEqual(
        ReorderIssueSchema.safeParse(reorderArgs({ move_after_id: 4.5 })).success,
        false
      );
      assert.strictEqual(
        ReorderIssueSchema.safeParse(reorderArgs({ move_before_id: "abc" })).success,
        false
      );
    });
  });

  describe("with issue_iid missing", () => {
    it("should reject the arguments", () => {
      assert.strictEqual(
        ReorderIssueSchema.safeParse({ project_id: "group/project", move_after_id: 1 }).success,
        false
      );
    });
  });
});
