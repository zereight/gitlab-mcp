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

// Drop a key entirely (not `key: undefined`) to mirror a response that never sent it.
function withoutKey(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
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

    it("should accept a release with a null description", () => {
      const parsed = GitLabTagSchema.parse(
        validTag({ release: { tag_name: "v1.0.0", description: null } })
      );
      assert.strictEqual(parsed.release?.description, null);
    });
  });

  describe("without a top-level created_at key (GitLab 16.0.x)", () => {
    it("should accept the tag and leave created_at absent", () => {
      const parsed = GitLabTagSchema.parse(withoutKey(validTag(), "created_at"));
      assert.strictEqual(parsed.name, "v1.0.0");
      assert.strictEqual(parsed.created_at, undefined);
      assert.strictEqual("created_at" in parsed, false);
    });

    it("should accept the array shape returned by list_tags", () => {
      const parsed = GitLabTagSchema.array().parse([withoutKey(validTag(), "created_at")]);
      assert.strictEqual(parsed.length, 1);
      assert.strictEqual(parsed[0].created_at, undefined);
    });
  });

  describe("with a null top-level created_at (lightweight tag)", () => {
    it("should accept null created_at and null message", () => {
      const parsed = GitLabTagSchema.parse(validTag({ created_at: null, message: null }));
      assert.strictEqual(parsed.created_at, null);
      assert.strictEqual(parsed.message, null);
    });
  });

  describe("with a null commit.created_at", () => {
    it("should accept the tag and keep commit.created_at null", () => {
      const parsed = GitLabTagSchema.parse(
        validTag({ commit: { ...validTag().commit, created_at: null } })
      );
      assert.strictEqual(parsed.commit.created_at, null);
      assert.strictEqual(parsed.commit.id, "abc123def456");
    });
  });

  describe("with a lightweight tag from an older GitLab (no created_at key, null commit.created_at)", () => {
    it("should parse the reported shape", () => {
      const legacy = withoutKey(
        validTag({
          message: null,
          commit: { ...validTag().commit, created_at: null },
        }),
        "created_at"
      );
      const parsed = GitLabTagSchema.parse(legacy);
      assert.strictEqual(parsed.name, "v1.0.0");
      assert.strictEqual(parsed.message, null);
      assert.strictEqual(parsed.created_at, undefined);
      assert.strictEqual(parsed.commit.created_at, null);
    });
  });

  describe("with required identity fields missing", () => {
    it("should still reject a tag without name, target, or commit.id", () => {
      assert.throws(() => GitLabTagSchema.parse(withoutKey(validTag(), "name")));
      assert.throws(() => GitLabTagSchema.parse(withoutKey(validTag(), "target")));
      assert.throws(() =>
        GitLabTagSchema.parse(validTag({ commit: withoutKey(validTag().commit, "id") }))
      );
    });
  });
});
