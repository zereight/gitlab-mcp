import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  CreateDraftNoteSchema,
  GetBranchDiffsSchema,
  UpdateMergeRequestDiscussionNoteSchema,
} from "../schemas.js";
import { stripNullishToolArguments } from "../utils/tool-args.js";

function parseAfterStrip<T>(raw: Record<string, unknown>, parse: (value: unknown) => T): T {
  return parse(stripNullishToolArguments(raw));
}

describe("When validating issue #281 reported argument shapes", () => {
  describe("with create_draft_note", () => {
    test("should accept only required fields when position is omitted", () => {
      const parsed = parseAfterStrip(
        {
          project_id: "group/project",
          merge_request_iid: "1",
          body: "Test note",
        },
        value => CreateDraftNoteSchema.parse(value)
      );
      assert.equal(parsed.body, "Test note");
    });

    test("should accept position object with null SHAs after strip", () => {
      const parsed = parseAfterStrip(
        {
          project_id: "group/project",
          merge_request_iid: "1",
          body: "Test note",
          position: {
            base_sha: null,
            head_sha: null,
            start_sha: null,
            position_type: "text",
          },
        },
        value => CreateDraftNoteSchema.parse(value)
      );
      assert.equal(parsed.position, undefined);
    });

    test("should accept when optional fields are explicitly null after strip", () => {
      const parsed = parseAfterStrip(
        {
          project_id: "group/project",
          merge_request_iid: "1",
          body: "Test note",
          in_reply_to_discussion_id: null,
          position: null,
          resolve_discussion: null,
        },
        value => CreateDraftNoteSchema.parse(value)
      );
      assert.equal(parsed.position, undefined);
    });

    test("should accept empty position object after strip omits position", () => {
      const parsed = parseAfterStrip(
        {
          project_id: "group/project",
          merge_request_iid: "1",
          body: "Test note",
          position: {},
        },
        value => CreateDraftNoteSchema.parse(value)
      );
      assert.equal(parsed.position, undefined);
    });
  });

  describe("with update_merge_request_discussion_note", () => {
    test("should accept body plus resolved null after strip", () => {
      const parsed = parseAfterStrip(
        {
          project_id: "group/project",
          merge_request_iid: "1",
          discussion_id: "d1",
          note_id: "n1",
          body: "updated",
          resolved: null,
        },
        value => UpdateMergeRequestDiscussionNoteSchema.parse(value)
      );
      assert.equal(parsed.body, "updated");
      assert.equal(parsed.resolved, undefined);
    });

    test("should reject when only resolved null remains after strip", () => {
      assert.throws(
        () =>
          parseAfterStrip(
            {
              project_id: "group/project",
              merge_request_iid: "1",
              discussion_id: "d1",
              note_id: "n1",
              resolved: null,
            },
            value => UpdateMergeRequestDiscussionNoteSchema.parse(value)
          ),
        /At least one of 'body' or 'resolved'/
      );
    });
  });

  describe("with get_branch_diffs", () => {
    test("should ignore unknown commit null field from older clients", () => {
      const parsed = parseAfterStrip(
        {
          project_id: "group/project",
          from: "main",
          to: "dev",
          commit: null,
        },
        value => GetBranchDiffsSchema.parse(value)
      );
      assert.equal("commit" in (parsed as object), false);
    });
  });
});
