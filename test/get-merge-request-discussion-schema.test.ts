import assert from "node:assert/strict";
import { test } from "node:test";
import { GetMergeRequestDiscussionSchema, GitLabDiscussionSchema } from "../schemas.js";

test("get discussion input coerces numeric ids and keeps discussion id", () => {
  const parsed = GetMergeRequestDiscussionSchema.parse({
    project_id: 42,
    merge_request_iid: 7,
    discussion_id: "abc123",
  });

  assert.equal(parsed.project_id, "42");
  assert.equal(parsed.merge_request_iid, "7");
  assert.equal(parsed.discussion_id, "abc123");
});

test("get discussion input rejects a missing discussion id", () => {
  assert.throws(() =>
    GetMergeRequestDiscussionSchema.parse({
      project_id: "42",
      merge_request_iid: "7",
    })
  );
});

test("single discussion response parses the GitLab discussion item shape", () => {
  const parsed = GitLabDiscussionSchema.parse({
    id: "abc123",
    individual_note: false,
    notes: [{ id: 1, body: "please fix", resolvable: true, resolved: false }],
  });

  assert.equal(parsed.id, "abc123");
  assert.equal(parsed.individual_note, false);
  assert.equal(parsed.notes.length, 1);
  assert.equal(parsed.notes[0].body, "please fix");
});
