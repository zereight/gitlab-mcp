import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  CreateDraftNoteSchema,
  CreateLabelSchema,
  ExecuteGraphQLSchema,
  GetBranchDiffsSchema,
  UpdateMergeRequestDiscussionNoteSchema,
  UpdateMergeRequestSchema,
} from "../schemas.js";
import { sanitizeToolArguments } from "../utils/tool-args.js";

const PROJECT_ID = "group/project";
const MERGE_REQUEST_IID = "1";

function parseAfterSanitize<T>(
  toolName: string,
  raw: Record<string, unknown>,
  parse: (value: unknown) => T
): T {
  return parse(sanitizeToolArguments(toolName, raw));
}

describe("When validating tool arguments after sanitization", () => {
  describe("with create_draft_note", () => {
    test("should accept position with null SHAs after sanitize and schema preprocess", () => {
      const parsed = parseAfterSanitize(
        "create_draft_note",
        {
          project_id: PROJECT_ID,
          merge_request_iid: MERGE_REQUEST_IID,
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

    test("should accept position with nullable old_line after sanitize", () => {
      const parsed = parseAfterSanitize(
        "create_draft_note",
        {
          project_id: PROJECT_ID,
          merge_request_iid: MERGE_REQUEST_IID,
          body: "Test note",
          position: {
            base_sha: "base",
            head_sha: "head",
            start_sha: "start",
            position_type: "text",
            new_path: "file.ts",
            old_line: null,
            new_line: 10,
          },
        },
        value => CreateDraftNoteSchema.parse(value)
      );
      assert.equal(parsed.position?.old_line, null);
      assert.equal(parsed.position?.new_line, 10);
    });
  });

  describe("with update_merge_request", () => {
    test("should omit null milestone_id instead of coercing to string null", () => {
      const parsed = UpdateMergeRequestSchema.parse({
        project_id: PROJECT_ID,
        merge_request_iid: MERGE_REQUEST_IID,
        title: "keep",
        milestone_id: null,
      });
      assert.equal(parsed.milestone_id, undefined);
    });

    test("should keep 0 as unassign sentinel", () => {
      const parsed = UpdateMergeRequestSchema.parse({
        project_id: PROJECT_ID,
        merge_request_iid: MERGE_REQUEST_IID,
        milestone_id: 0,
      });
      assert.equal(parsed.milestone_id, "0");
    });
  });

  describe("with update_merge_request_discussion_note", () => {
    test("should accept body plus resolved null after sanitize", () => {
      const parsed = parseAfterSanitize(
        "update_merge_request_discussion_note",
        {
          project_id: PROJECT_ID,
          merge_request_iid: MERGE_REQUEST_IID,
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

    test("should reject when only resolved null remains after sanitize", () => {
      assert.throws(
        () =>
          parseAfterSanitize(
            "update_merge_request_discussion_note",
            {
              project_id: PROJECT_ID,
              merge_request_iid: MERGE_REQUEST_IID,
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
      const parsed = parseAfterSanitize(
        "get_branch_diffs",
        {
          project_id: PROJECT_ID,
          from: "main",
          to: "dev",
          commit: null,
        },
        value => GetBranchDiffsSchema.parse(value)
      );
      assert.equal(Object.hasOwn(parsed, "commit"), false);
    });
  });

  describe("with execute_graphql", () => {
    test("should preserve explicit null variable values after sanitize", () => {
      const parsed = parseAfterSanitize(
        "execute_graphql",
        {
          query: "mutation($id: ID) { updateProject(input: { id: $id }) { project { id } } }",
          variables: { id: null },
        },
        value => ExecuteGraphQLSchema.parse(value)
      );
      assert.equal(parsed.variables?.id, null);
    });
  });

  describe("with create_label", () => {
    test("should preserve explicit null priority after sanitize", () => {
      const parsed = parseAfterSanitize(
        "create_label",
        {
          project_id: PROJECT_ID,
          name: "priority-null",
          color: "#112233",
          priority: null,
        },
        value => CreateLabelSchema.parse(value)
      );
      assert.equal(parsed.priority, null);
    });
  });
});
