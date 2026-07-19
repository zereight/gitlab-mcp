import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildBulkPublishDraftNotesBody,
  needsGitLab19_2BulkPublish,
} from "../../utils/bulk-publish-options.js";

describe("When buildBulkPublishDraftNotesBody runs", () => {
  describe("with no-op defaults", () => {
    test("should omit internal false and empty note", () => {
      assert.deepEqual(buildBulkPublishDraftNotesBody({ internal: false, note: "" }), {});
    });
  });

  describe("with meaningful 19.2 fields", () => {
    test("should keep reviewer_state, note, and internal true", () => {
      assert.deepEqual(
        buildBulkPublishDraftNotesBody({
          reviewer_state: "reviewed",
          note: "LGTM",
          internal: true,
        }),
        { reviewer_state: "reviewed", note: "LGTM", internal: true }
      );
    });
  });
});

describe("When needsGitLab19_2BulkPublish runs", () => {
  describe("with an empty body", () => {
    test("should return false", () => {
      assert.equal(needsGitLab19_2BulkPublish({}), false);
      assert.equal(needsGitLab19_2BulkPublish(buildBulkPublishDraftNotesBody({ internal: false })), false);
    });
  });

  describe("with a non-empty body", () => {
    test("should return true", () => {
      assert.equal(needsGitLab19_2BulkPublish({ reviewer_state: "reviewed" }), true);
    });
  });
});
