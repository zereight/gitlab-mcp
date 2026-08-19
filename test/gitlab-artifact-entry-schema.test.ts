import { describe, it } from "node:test";
import assert from "node:assert";
import { GitLabArtifactEntrySchema } from "../schemas.js";

function validEntry(overrides: Record<string, unknown> = {}) {
  return {
    name: "report.xml",
    path: "report.xml",
    type: "file",
    ...overrides,
  };
}

describe("When parsing an artifact tree entry", () => {
  describe("with a string mode", () => {
    it("should keep the mode", () => {
      const parsed = GitLabArtifactEntrySchema.parse(
        validEntry({ mode: "100644", size: 1024 })
      );
      assert.strictEqual(parsed.mode, "100644");
      assert.strictEqual(parsed.size, 1024);
    });
  });

  describe("with mode set to null", () => {
    it("should accept null", () => {
      const parsed = GitLabArtifactEntrySchema.parse(validEntry({ mode: null }));
      assert.strictEqual(parsed.mode, null);
    });
  });

  describe("with size set to null", () => {
    it("should accept null", () => {
      const parsed = GitLabArtifactEntrySchema.parse(validEntry({ size: null }));
      assert.strictEqual(parsed.size, null);
    });
  });

  describe("with mode and size omitted", () => {
    it("should leave them undefined", () => {
      const parsed = GitLabArtifactEntrySchema.parse(validEntry());
      assert.strictEqual(parsed.mode, undefined);
      assert.strictEqual(parsed.size, undefined);
    });
  });

  describe("with an unknown type", () => {
    it("should reject the entry", () => {
      assert.throws(() => GitLabArtifactEntrySchema.parse(validEntry({ type: "symlink" })));
    });
  });
});
