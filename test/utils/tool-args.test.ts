import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { sanitizeToolArguments } from "../../utils/tool-args.js";

describe("When sanitizeToolArguments runs", () => {
  describe("with top-level null optionals", () => {
    test("should omit null and undefined keys for generic tools", () => {
      const result = sanitizeToolArguments("create_draft_note", {
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

  describe("with nested objects", () => {
    test("should not strip nulls inside nested position objects", () => {
      const position = {
        base_sha: "abc",
        head_sha: "def",
        start_sha: "ghi",
        position_type: "text",
        old_line: null,
        new_line: 12,
      };

      const result = sanitizeToolArguments("create_draft_note", {
        project_id: "g/p",
        merge_request_iid: "1",
        body: "note",
        position,
      });

      assert.deepEqual(result.position, position);
    });

    test("should preserve null entries inside execute_graphql variables", () => {
      const variables = { milestoneId: null, title: "x" };

      const result = sanitizeToolArguments("execute_graphql", {
        query: "query { project { id } }",
        variables,
      });

      assert.deepEqual(result.variables, variables);
    });
  });

  describe("with meaningful falsy values", () => {
    test("should preserve false and zero", () => {
      const result = sanitizeToolArguments("update_merge_request_discussion_note", {
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

  describe("with create_label", () => {
    test("should preserve explicit null priority", () => {
      const result = sanitizeToolArguments("create_label", {
        project_id: "g/p",
        name: "bug",
        color: "#ff0000",
        priority: null,
      });

      assert.equal(result.priority, null);
    });
  });
});
