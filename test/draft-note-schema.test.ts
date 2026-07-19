import assert from "node:assert/strict";
import { test } from "node:test";
import { GitLabDraftNoteSchema } from "../schemas.js";

test("draft note schema keeps Draft Notes API fields and drops fake timestamps", () => {
  const parsed = GitLabDraftNoteSchema.parse({
    id: 42,
    author_id: 7,
    note: "looks wrong on this line",
    line_code: "a1b2c3d4e5f6_12_17",
    merge_request_id: 99,
    commit_id: "abc123",
    discussion_id: null,
    position: { new_path: "src/app.ts", new_line: 17 },
    resolve_discussion: false,
  });

  assert.equal(parsed.id, "42");
  assert.equal(parsed.author_id, 7);
  assert.equal(parsed.body, "looks wrong on this line");
  assert.equal(parsed.line_code, "a1b2c3d4e5f6_12_17");
  assert.equal(parsed.merge_request_id, 99);
  assert.equal(parsed.commit_id, "abc123");
  assert.equal(parsed.discussion_id, null);
  assert.equal(parsed.resolve_discussion, false);
  assert.equal("created_at" in parsed, false);
  assert.equal("updated_at" in parsed, false);
});

test("draft note schema preserves null line_code for unresolved positions", () => {
  const parsed = GitLabDraftNoteSchema.parse({
    id: "43",
    author_id: 7,
    note: "orphan draft",
    line_code: null,
    merge_request_id: 99,
    commit_id: null,
    discussion_id: null,
    position: null,
    resolve_discussion: false,
  });

  assert.equal(parsed.line_code, null);
  assert.equal(parsed.commit_id, null);
});
