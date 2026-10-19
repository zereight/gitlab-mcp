import assert from "node:assert/strict";
import { test } from "node:test";
import { CreateDraftNoteSchema, CreateMergeRequestNoteSchema } from "../schemas.js";

const GITLAB_NOTE_CHARACTER_LIMIT = 1_000_000;

test("merge request note input schemas accept GitLab's note character limit", () => {
  const body = "a".repeat(GITLAB_NOTE_CHARACTER_LIMIT);

  const note = CreateMergeRequestNoteSchema.parse({
    project_id: "group/project",
    merge_request_iid: 1,
    body,
  });
  const draft = CreateDraftNoteSchema.parse({
    project_id: "group/project",
    merge_request_iid: 1,
    body,
  });

  assert.equal(note.body.length, GITLAB_NOTE_CHARACTER_LIMIT);
  assert.equal(draft.body.length, GITLAB_NOTE_CHARACTER_LIMIT);
});
