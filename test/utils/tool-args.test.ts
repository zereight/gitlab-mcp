import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  cleanMutuallyExclusiveIdUsernameOptions,
  LIST_MERGE_REQUESTS_ID_USERNAME_PAIRS,
  sanitizeToolArguments,
} from "../../utils/tool-args.js";

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

describe("When cleanMutuallyExclusiveIdUsernameOptions runs", () => {
  describe("with list_issues author filters", () => {
    test("should drop author_id when author_username is also set", () => {
      const result = cleanMutuallyExclusiveIdUsernameOptions({
        author_id: "42",
        author_username: "alice",
        state: "opened",
      });

      assert.deepEqual(result, {
        author_username: "alice",
        state: "opened",
      });
    });
  });

  describe("with list_issues assignee filters", () => {
    test("should drop assignee_id when assignee_username is also set", () => {
      const result = cleanMutuallyExclusiveIdUsernameOptions({
        assignee_id: "7",
        assignee_username: ["bob"],
      });

      assert.deepEqual(result, {
        assignee_username: ["bob"],
      });
    });
  });

  describe("with list_merge_requests reviewer filters", () => {
    test("should drop reviewer_id when reviewer_username is also set", () => {
      const result = cleanMutuallyExclusiveIdUsernameOptions(
        {
          reviewer_id: "3",
          reviewer_username: "carol",
        },
        LIST_MERGE_REQUESTS_ID_USERNAME_PAIRS
      );

      assert.deepEqual(result, {
        reviewer_username: "carol",
      });
    });
  });
});
