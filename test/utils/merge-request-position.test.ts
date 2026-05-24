import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { omitIncompleteMergeRequestPosition } from "../../utils/merge-request-position.js";

describe("When omitIncompleteMergeRequestPosition runs", () => {
  describe("with incomplete position input", () => {
    test("should return undefined when required SHAs are missing", () => {
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
      };
      assert.deepEqual(omitIncompleteMergeRequestPosition(position), position);
    });
  });
});
