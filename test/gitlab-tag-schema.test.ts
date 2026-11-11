import { describe, it } from "node:test";
import assert from "node:assert";
import { GitLabTagSchema } from "../schemas.js";

function validTag(overrides: Record<string, unknown> = {}) {
  return {
    name: "v1.0.0",
    message: "tag message",
    target: "abc123def456",
    commit: {
      id: "abc123def456",
      short_id: "abc123de",
      title: "Release",
      created_at: "2026-03-13T10:00:00.000Z",
      parent_ids: ["1111111111111111"],
      message: "Release",
      author_name: "Test User",
      author_email: "test@example.com",
      authored_date: "2026-03-13T09:55:00.000Z",
      committer_name: "Test User",
      committer_email: "test@example.com",
      committed_date: "2026-03-13T10:00:00.000Z",
    },
    protected: false,
    created_at: "2026-03-13T10:00:00.000Z",
    ...overrides,
  };
}

describe("When parsing a GitLab tag response", () => {
  describe("with a missing release key", () => {
    it("should accept the tag instead of requiring release", () => {
      const parsed = GitLabTagSchema.parse(validTag());
      assert.strictEqual(parsed.name, "v1.0.0");
      assert.strictEqual(parsed.release, undefined);
    });
  });

  describe("with release set to null", () => {
    it("should accept a null release", () => {
      const parsed = GitLabTagSchema.parse(validTag({ release: null }));
      assert.strictEqual(parsed.release, null);
    });
  });

  describe("with a release object", () => {
    it("should keep tag_name and description", () => {
      const parsed = GitLabTagSchema.parse(
        validTag({
          release: { tag_name: "v1.0.0", description: "notes" },
        })
      );
      assert.strictEqual(parsed.release?.tag_name, "v1.0.0");
      assert.strictEqual(parsed.release?.description, "notes");
    });
  });

  // #1015: GitLab 16.0.x tag responses have no top-level created_at key at all.
  describe("without a top-level created_at key (GitLab < 16.11)", () => {
    const withoutCreatedAt = Object.fromEntries(
      Object.entries(validTag()).filter(([key]) => key !== "created_at")
    );

    it("should accept the tag", () => {
      const parsed = GitLabTagSchema.parse(withoutCreatedAt);
      assert.strictEqual(parsed.name, "v1.0.0");
      assert.strictEqual(parsed.target, "abc123def456");
    });

    it("should not add a created_at key to the parsed output", () => {
      const parsed = GitLabTagSchema.parse(withoutCreatedAt);
      assert.ok(!("created_at" in parsed));
    });

    it("should still accept a null created_at (GitLab 16.11+ lightweight tags)", () => {
      const parsed = GitLabTagSchema.parse(validTag({ created_at: null }));
      assert.strictEqual(parsed.created_at, null);
    });

    it("should still reject a created_at that is not a string or null", () => {
      assert.throws(() => GitLabTagSchema.parse(validTag({ created_at: 42 })));
    });
  });
});
