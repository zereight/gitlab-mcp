import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { stripNullishToolArguments } from "../../utils/tool-args.js";

describe("When stripNullishToolArguments runs", () => {
  describe("with top-level null optionals", () => {
    test("should omit null and undefined keys", () => {
      const result = stripNullishToolArguments({
        project_id: "g/p",
        merge_request_iid: "1",
        body: "note",
        position: null,
        resolve_discussion: undefined,
      });

      assert.deepEqual(result, {
        project_id: "g/p",
        merge_request_iid: "1",
        body: "note",
      });
    });
  });

  describe("with nested position nulls", () => {
    test("should omit position when all nested values are nullish", () => {
      const result = stripNullishToolArguments({
        project_id: "g/p",
        merge_request_iid: "1",
        body: "note",
        position: {
          base_sha: null,
          head_sha: null,
          start_sha: null,
          position_type: "text",
        },
      });

      assert.deepEqual(result, {
        project_id: "g/p",
        merge_request_iid: "1",
        body: "note",
      });
    });
  });

  describe("with meaningful falsy values", () => {
    test("should preserve false and zero", () => {
      const result = stripNullishToolArguments({
        resolved: false,
        straight: false,
        count: 0,
        label: "",
      });

      assert.deepEqual(result, {
        resolved: false,
        straight: false,
        count: 0,
        label: "",
      });
    });
  });

  describe("with incomplete position objects", () => {
    test("should omit empty position objects", () => {
      const result = stripNullishToolArguments({
        project_id: "g/p",
        position: {},
      });

      assert.deepEqual(result, { project_id: "g/p" });
    });

    test("should keep position when required SHAs are present", () => {
      const result = stripNullishToolArguments({
        position: {
          base_sha: "abc",
          head_sha: "def",
          start_sha: "ghi",
          position_type: "text",
        },
      });

      assert.deepEqual(result, {
        position: {
          base_sha: "abc",
          head_sha: "def",
          start_sha: "ghi",
          position_type: "text",
        },
      });
    });
  });
});
