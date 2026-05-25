import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CreateDraftNoteSchema } from "../../schemas.js";
import { omitIncompleteMergeRequestPosition } from "../../utils/merge-request-position.js";

describe("When omitIncompleteMergeRequestPosition runs", () => {
  describe("with MCP null-injected SHAs", () => {
    test("should return undefined when all commit SHAs are nullish", () => {
      assert.equal(
        omitIncompleteMergeRequestPosition({
          base_sha: null,
          head_sha: null,
          start_sha: null,
          position_type: "text",
        }),
        undefined
      );
    });

    test("should return undefined for null and undefined", () => {
      assert.equal(omitIncompleteMergeRequestPosition(null), undefined);
      assert.equal(omitIncompleteMergeRequestPosition(undefined), undefined);
    });
  });

  describe("with complete position input", () => {
    test("should return position when all required SHAs are strings", () => {
      const position = {
        base_sha: "abc",
        head_sha: "def",
        start_sha: "ghi",
        position_type: "text",
        old_line: null,
        new_line: 4,
      };
      assert.deepEqual(omitIncompleteMergeRequestPosition(position), position);
    });
  });

  describe("with partially invalid position input", () => {
    test("should pass position through for schema validation to reject", () => {
      const position = {
        base_sha: "abc",
        head_sha: null,
        start_sha: "ghi",
        position_type: "text",
      };
      assert.deepEqual(omitIncompleteMergeRequestPosition(position), position);
    });

    test("should fail schema parse when a required SHA is missing", () => {
      assert.throws(
        () =>
          CreateDraftNoteSchema.parse({
            project_id: "g/p",
            merge_request_iid: "1",
            body: "note",
            position: omitIncompleteMergeRequestPosition({
              base_sha: "abc",
              head_sha: null,
              start_sha: "ghi",
              position_type: "text",
            }),
          }),
        /Expected string, received null/
      );
    });
  });
});
